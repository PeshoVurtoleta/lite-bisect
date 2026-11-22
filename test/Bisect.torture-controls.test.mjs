// test/Bisect.torture-controls.test.mjs -- the torture gate's controls through its REAL verdict path:
// the exit code of test/torture.mjs itself (AU-R5, audit 2026-11-11 R-TORTURE-MINOR). Each case spawns
// process.execPath on test/torture.mjs and judges the exit code (0 ok, 1 FAIL, 2 NO VERDICT); the stdout
// lines are read only to attribute a FAIL to the planted lane, never instead of the exit code.
//   (a) a copy of ../Bisect.js with `globalThis.__bisectBox = x + 0.5;` planted in upperBoundBranchyF64
//       (one 16 B HeapNumber per op; LITE_BISECT_TORTURE_MODULE) -> exit 1 (steady maxMinor 0 under the pin).
//   (b) the same lane with a `{ x }` plant (one small object per op) -> exit 1.
//   (c) no semi-space pin, one flag only, other values, or the pin followed by an overriding semi-space flag
//       (V8 takes the last value; '_' spelling too) -> exit 2 with the NO VERDICT line, before the build
//       is imported (the module path names a file that throws at import) and before any lane. Every (c) row
//       carries --single-threaded-gc, so it is refused for its OWN semi-space / --minor-ms reason.
//   (c2) a valid semi-space pin with --single-threaded-gc missing or overridden by a later spelling (V8 takes
//       the last; '_' and one-dash spellings too; --single_threaded_gc alone is refused, fail closed) -> exit 2
//       with the GC NO VERDICT line, before the build import (P3-R10, LEDGER B11).
//   (d) LITE_BISECT_TORTURE_LEAK=1 -> exit 1.
//   (e) a failing assertPlantLane message carries the child's GATE line and stderr (synthetic child, no spawn).
// A failing (a)/(b) assertion prints the child's GATE line and its stderr fails lines (CI shows nothing else).
// Spawns that expect a verdict ((a), (b), (d)) pass npm run torture's flags: TIER, GC and PIN.
// The clean run is `npm run torture` (verify), not repeated here. Plants live in a mktemp dir, removed at
// exit. NODE_V8_COVERAGE is dropped from the child env (c8 must not instrument the torture child).

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KERNELS, TYPE_NAMES } from './oracle.mjs';

const TORTURE = fileURLToPath(new URL('./torture.mjs', import.meta.url));
const BUILD = fileURLToPath(new URL('../Bisect.js', import.meta.url));
const PIN = ['--min-semi-space-size=1', '--max-semi-space-size=1'];
// npm run torture's tier flag: tier-up is synchronous, so a loaded host (node --test runs files in parallel)
// cannot leave a clean lane in a boxing tier and blur the attribution below.
const TIER = '--no-concurrent-recompilation';
// npm run torture's GC flag (P3-R10): gc() sweeps on the main thread, so a loaded host cannot leave dead code
// unswept under the settled "before" sample and credit an unplanted lane with negative retention.
const GC = '--single-threaded-gc';
const REFUSAL = 'torture: NO VERDICT -- run with --min-semi-space-size=1 --max-semi-space-size=1';
const GC_REFUSAL = 'torture: NO VERDICT -- run with --single-threaded-gc';
const TIMEOUT_MS = 120000;
const ANCHOR = 'export function upperBoundBranchyF64(a, lo, hi, x) {\n';
const PLANT_LANE = 'upperBoundBranchyF64';
const N_LANES = Object.keys(KERNELS).length * TYPE_NAMES.length;   // the oracle roster, not torture's own count

const TMP = mkdtempSync(join(tmpdir(), 'lite-bisect-torture-ctl-'));
after(() => { rmSync(TMP, { recursive: true, force: true }); });

function plant(name, line) {
    const src = readFileSync(BUILD, 'utf8');
    const n = src.split(ANCHOR).length - 1;
    if (n !== 1) assert.fail('NO VERDICT: plant anchor found ' + n + ' times in Bisect.js (want 1): ' + JSON.stringify(ANCHOR));
    const out = src.replace(ANCHOR, () => ANCHOR + '    ' + line + '\n');
    assert.equal(out.length, src.length + line.length + 5);
    const p = join(TMP, name + '.js');
    writeFileSync(p, out);
    return p;
}

function torture(flags, env = {}) {
    const e = { ...process.env, ...env };
    delete e.NODE_V8_COVERAGE;
    if (!('LITE_BISECT_TORTURE_MODULE' in env)) delete e.LITE_BISECT_TORTURE_MODULE;
    if (!('LITE_BISECT_TORTURE_LEAK' in env)) delete e.LITE_BISECT_TORTURE_LEAK;
    const r = spawnSync(process.execPath, [...flags, TORTURE], { env: e, encoding: 'utf8', timeout: TIMEOUT_MS });
    if (r.error || r.signal !== null) assert.fail('NO VERDICT: torture child ' + (r.signal || r.error.message));
    return r;
}

// The child's GATE line and full stderr (the torture's `fails` lines), appended to every assertPlantLane message:
// the LANE lines alone cannot say WHY an unplanted lane failed (e.g. settle drained=false).
function childDiag(r) {
    const g = /^GATE .*$/m.exec(r.stdout);
    const e = r.stderr.replace(/^(?:[ \t]*\n)+/, '').trimEnd();   // blank lines off; each line's indent kept verbatim
    return '\n-- child GATE: ' + (g ? g[0] : '(no GATE line)') + '\n-- child stderr:\n' + (e || '(empty stderr)');
}

// A FAIL attributed to the planted lane: its LANE line has minor > 0 and FAIL; every other kernel lane is ok.
function assertPlantLane(r) {
    const diag = childDiag(r);
    const lanes = r.stdout.split('\n').filter((l) => l.startsWith('LANE '));
    assert.equal(lanes.length, N_LANES, 'LANE lines: ' + lanes.length + diag);
    const bad = lanes.filter((l) => !l.endsWith(' ok'));
    assert.deepEqual(bad.map((l) => l.split(' ')[1]), [PLANT_LANE], bad.join('\n') + diag);
    const m = /^LANE upperBoundBranchyF64 major=0 minor=(\d+) .* FAIL$/.exec(bad[0]);
    assert.ok(m && Number(m[1]) > 0, 'planted lane not failed by a steady minor: ' + bad[0] + diag);
    assert.match(r.stdout, /^GATE .* \| FAIL$/m, 'no "GATE ... | FAIL" line in the child stdout' + diag);
}

test('(a) a 16 B/op box planted in upperBoundBranchyF64 -> torture exit 1', () => {
    const r = torture(['--expose-gc', TIER, GC, ...PIN], { LITE_BISECT_TORTURE_MODULE: plant('box', 'globalThis.__bisectBox = x + 0.5;') });
    console.log('# (a) exit ' + r.status + ' | ' + r.stdout.split('\n').filter((l) => l.startsWith('LANE ' + PLANT_LANE + ' ') || l.startsWith('GATE')).join(' | '));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assertPlantLane(r);
});

test('(b) a { x } object planted in upperBoundBranchyF64 -> torture exit 1', () => {
    const r = torture(['--expose-gc', TIER, GC, ...PIN], { LITE_BISECT_TORTURE_MODULE: plant('obj', 'globalThis.__bisectBox = { x };') });
    console.log('# (b) exit ' + r.status + ' | ' + r.stdout.split('\n').filter((l) => l.startsWith('LANE ' + PLANT_LANE + ' ') || l.startsWith('GATE')).join(' | '));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assertPlantLane(r);
});

test('(c) unpinned / half-pinned / other or overridden semi-space values -> torture exit 2 before the build import and any lane', () => {
    const throwing = join(TMP, 'throws-at-import.js');
    writeFileSync(throwing, "throw new Error('torture imported the build before the pin check');\n");
    for (const flags of [
        ['--expose-gc', GC],
        ['--expose-gc', TIER, GC],
        ['--expose-gc', GC, PIN[0]],
        ['--expose-gc', GC, PIN[1]],
        ['--expose-gc', GC, '--min-semi-space-size=4', '--max-semi-space-size=4'],
        ['--expose-gc', GC, '--min-semi-space-size=1', '--max-semi-space-size=2'],
        ['--expose-gc', GC, ...PIN, '--max-semi-space-size=16', '--min-semi-space-size=16'],
        ['--expose-gc', GC, ...PIN, '--max_semi_space_size=16'],
        ['--expose-gc', GC, ...PIN, '-max-semi-space-size=16', '-min-semi-space-size=16'],
        ['--expose-gc', GC, ...PIN, '--minor-ms'],
    ]) {
        const r = torture(flags, { LITE_BISECT_TORTURE_MODULE: throwing });
        console.log('# (c) ' + flags.join(' ') + ' -> exit ' + r.status);
        assert.equal(r.status, 2, flags.join(' ') + ': ' + r.stdout + r.stderr);
        assert.equal(r.stderr.trim(), REFUSAL);
        assert.equal(r.stdout, '');
    }
});

test('(c2) a valid semi-space pin with --single-threaded-gc missing or overridden -> torture exit 2 before the build import and any lane', () => {
    const throwing = join(TMP, 'throws-at-import-gc.js');
    writeFileSync(throwing, "throw new Error('torture imported the build before the GC pin check');\n");
    // --single-threaded-gc=false is not a row: node itself rejects it (bad option, exit 9) before torture runs.
    for (const flags of [
        ['--expose-gc', TIER, ...PIN],
        ['--expose-gc', TIER, GC, '--no-single-threaded-gc', ...PIN],
        ['--expose-gc', TIER, GC, '--no_single_threaded_gc', ...PIN],
        ['--expose-gc', TIER, GC, '-no-single-threaded-gc', ...PIN],
        ['--expose-gc', TIER, GC, '--nosingle-threaded-gc', ...PIN],
        ['--expose-gc', TIER, '--single_threaded_gc', ...PIN],
    ]) {
        const r = torture(flags, { LITE_BISECT_TORTURE_MODULE: throwing });
        console.log('# (c2) ' + flags.join(' ') + ' -> exit ' + r.status);
        assert.equal(r.status, 2, flags.join(' ') + ': ' + r.stdout + r.stderr);
        assert.equal(r.stderr.trim(), GC_REFUSAL);
        assert.equal(r.stdout, '');
    }
});

test('(d) LITE_BISECT_TORTURE_LEAK=1 -> torture exit 1', () => {
    const r = torture(['--expose-gc', TIER, GC, ...PIN], { LITE_BISECT_TORTURE_LEAK: '1' });
    console.log('# (d) exit ' + r.status + ' | ' + r.stdout.split('\n').filter((l) => l.startsWith('PHASE1') || l.startsWith('GATE')).join(' | '));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^PHASE1 .* size=(\d{4,}) /m);
});

test('(e) control: a failing assertPlantLane message carries the child\'s stderr fails lines and its GATE line (synthetic child, no spawn)', () => {
    const EXTRA = 'lowerBoundHintI32';
    const PLANTED = 'LANE upperBoundBranchyF64 major=0 minor=9 abGrowth=0 settled=true retainedB/op=0.004 FAIL';
    const GATE = 'GATE leak=size 0/16 findings=0 warnings=0 | gc major=0 minor=9 maxMs=0.31 | retained=0.004 B/op | FAIL';
    const ERR_PLANT = '  lane upperBoundBranchyF64 verdict=fail retained=0.004 B/op phases.steady.gc.minor=9 settle drained=true waited=2.7ms';
    const ERR_EXTRA = '  lane lowerBoundHintI32 verdict=pass retained=0.001 B/op  settle drained=false waited=304.7ms';
    // Lane names from the oracle roster (KERNELS x TYPE_NAMES), so the LANE count is N_LANES by construction.
    const child = (extraFails) => {
        const lines = [];
        for (const k of Object.keys(KERNELS)) {
            for (const T of TYPE_NAMES) {
                const name = k + T;
                if (name === PLANT_LANE) lines.push(PLANTED);
                else if (name === EXTRA && extraFails) lines.push('LANE ' + EXTRA + ' major=0 minor=0 abGrowth=0 settled=true retainedB/op=0.001 FAIL');
                else lines.push('LANE ' + name + ' major=0 minor=0 abGrowth=0 settled=true retainedB/op=0.000 ok');
            }
        }
        lines.push(GATE, '');
        return { stdout: lines.join('\n'), stderr: (extraFails ? [ERR_PLANT, ERR_EXTRA] : [ERR_PLANT]).join('\n') + '\n', status: 1 };
    };
    const r = child(true);
    assert.equal(r.stdout.split('\n').filter((l) => l.startsWith('LANE ')).length, N_LANES);
    assert.ok(r.stdout.includes(PLANTED) && r.stdout.includes('LANE ' + EXTRA + ' '), 'fixture lacks the planted or the extra lane');
    assert.throws(() => assertPlantLane(r), (err) => {
        assert.ok(err instanceof assert.AssertionError, 'not an AssertionError: ' + err);
        for (const want of [ERR_PLANT, ERR_EXTRA, GATE]) {
            assert.ok(err.message.includes(want), 'message lacks ' + JSON.stringify(want) + ':\n' + err.message);
        }
        return true;
    });
    // Twin: the extra lane ok and its stderr line gone -> no throw, so the throw above is the extra lane's.
    assertPlantLane(child(false));
    // Rows for the other three messages: a LANE line missing (crashed child), the planted lane without a steady
    // minor, the GATE line not FAIL (and absent). Each message must carry ERR_PLANT and the GATE text verbatim.
    const base = child(false);
    for (const [stdout, gate] of [
        [base.stdout.replace(/^LANE (?!upperBoundBranchyF64 ).*\n/m, ''), GATE],
        [base.stdout.replace(PLANTED, PLANTED.replace(' minor=9 ', ' minor=0 ')), GATE],
        [base.stdout.replace(GATE, GATE.replace(' | FAIL', ' | ok')), GATE.replace(' | FAIL', ' | ok')],
        [base.stdout.replace(GATE + '\n', ''), '(no GATE line)'],
    ]) {
        assert.throws(() => assertPlantLane({ stdout, stderr: base.stderr, status: 1 }), (err) => {
            assert.ok(err instanceof assert.AssertionError && err.message.includes(ERR_PLANT) &&
                err.message.includes('-- child GATE: ' + gate), 'row message lacks the diag:\n' + err.message);
            return true;
        });
    }
});
