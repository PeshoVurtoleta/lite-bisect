// test/Bisect.torture-controls.test.mjs -- the torture gate's controls through its REAL verdict path:
// the exit code of test/torture.mjs itself (AU-R5, audit 2026-11-11 R-TORTURE-MINOR). Each case spawns
// process.execPath on test/torture.mjs and judges the exit code (0 ok, 1 FAIL, 2 NO VERDICT); the stdout
// lines are read only to attribute a FAIL to the planted lane, never instead of the exit code.
//   (a) a copy of ../Bisect.js with `globalThis.__bisectBox = x + 0.5;` planted in upperBoundBranchyF64
//       (one 16 B HeapNumber per op; LITE_BISECT_TORTURE_MODULE) -> exit 1 (steady maxMinor 0 under the pin).
//   (b) the same lane with a `{ x }` plant (one small object per op) -> exit 1.
//   (c) no semi-space pin, one flag only, other values, or the pin followed by an overriding semi-space flag
//       (V8 takes the last value; '_' spelling too) -> exit 2 with the NO VERDICT line, before the build
//       is imported (the module path names a file that throws at import) and before any lane.
//   (d) LITE_BISECT_TORTURE_LEAK=1 -> exit 1.
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
const REFUSAL = 'torture: NO VERDICT -- run with --min-semi-space-size=1 --max-semi-space-size=1';
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

// A FAIL attributed to the planted lane: its LANE line has minor > 0 and FAIL; every other kernel lane is ok.
function assertPlantLane(r) {
    const lanes = r.stdout.split('\n').filter((l) => l.startsWith('LANE '));
    assert.equal(lanes.length, N_LANES, 'LANE lines: ' + lanes.length);
    const bad = lanes.filter((l) => !l.endsWith(' ok'));
    assert.deepEqual(bad.map((l) => l.split(' ')[1]), [PLANT_LANE], bad.join('\n'));
    const m = /^LANE upperBoundBranchyF64 major=0 minor=(\d+) .* FAIL$/.exec(bad[0]);
    assert.ok(m && Number(m[1]) > 0, 'planted lane not failed by a steady minor: ' + bad[0]);
    assert.match(r.stdout, /^GATE .* \| FAIL$/m);
}

test('(a) a 16 B/op box planted in upperBoundBranchyF64 -> torture exit 1', () => {
    const r = torture(['--expose-gc', TIER, ...PIN], { LITE_BISECT_TORTURE_MODULE: plant('box', 'globalThis.__bisectBox = x + 0.5;') });
    console.log('# (a) exit ' + r.status + ' | ' + r.stdout.split('\n').filter((l) => l.startsWith('LANE ' + PLANT_LANE + ' ') || l.startsWith('GATE')).join(' | '));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assertPlantLane(r);
});

test('(b) a { x } object planted in upperBoundBranchyF64 -> torture exit 1', () => {
    const r = torture(['--expose-gc', TIER, ...PIN], { LITE_BISECT_TORTURE_MODULE: plant('obj', 'globalThis.__bisectBox = { x };') });
    console.log('# (b) exit ' + r.status + ' | ' + r.stdout.split('\n').filter((l) => l.startsWith('LANE ' + PLANT_LANE + ' ') || l.startsWith('GATE')).join(' | '));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assertPlantLane(r);
});

test('(c) unpinned / half-pinned / other or overridden semi-space values -> torture exit 2 before the build import and any lane', () => {
    const throwing = join(TMP, 'throws-at-import.js');
    writeFileSync(throwing, "throw new Error('torture imported the build before the pin check');\n");
    for (const flags of [
        ['--expose-gc'],
        ['--expose-gc', TIER],
        ['--expose-gc', PIN[0]],
        ['--expose-gc', PIN[1]],
        ['--expose-gc', '--min-semi-space-size=4', '--max-semi-space-size=4'],
        ['--expose-gc', '--min-semi-space-size=1', '--max-semi-space-size=2'],
        ['--expose-gc', ...PIN, '--max-semi-space-size=16', '--min-semi-space-size=16'],
        ['--expose-gc', ...PIN, '--max_semi_space_size=16'],
        ['--expose-gc', ...PIN, '-max-semi-space-size=16', '-min-semi-space-size=16'],
        ['--expose-gc', ...PIN, '--minor-ms'],
    ]) {
        const r = torture(flags, { LITE_BISECT_TORTURE_MODULE: throwing });
        console.log('# (c) ' + flags.join(' ') + ' -> exit ' + r.status);
        assert.equal(r.status, 2, flags.join(' ') + ': ' + r.stdout + r.stderr);
        assert.equal(r.stderr.trim(), REFUSAL);
        assert.equal(r.stdout, '');
    }
});

test('(d) LITE_BISECT_TORTURE_LEAK=1 -> torture exit 1', () => {
    const r = torture(['--expose-gc', TIER, ...PIN], { LITE_BISECT_TORTURE_LEAK: '1' });
    console.log('# (d) exit ' + r.status + ' | ' + r.stdout.split('\n').filter((l) => l.startsWith('PHASE1') || l.startsWith('GATE')).join(' | '));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^PHASE1 .* size=(\d{4,}) /m);
});
