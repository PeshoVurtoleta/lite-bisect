// test/Bisect.mutants.test.mjs -- assertion 6 (SPEC-p1 U4). Runs test/mutant-run.mjs over
// test/mutants.json against the live Bisect.js, then proves every outcome class of the runner
// closed with a control that fails on that row ALONE (LEDGER law 9): an inert row SURVIVES, a
// row matching 0 or 2 times is NOT-APPLIED, a hanging mutant TIMES OUT, a mutant that exits /
// throws without a FAIL line CRASHES, a run under 10,000 checks is LOWCHECKS, and a broken
// unmutated control fails the run. None of those may count as killed.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KERNELS as ORACLE_KERNELS, TYPE_NAMES } from './oracle.mjs';

const RUNNER = fileURLToPath(new URL('./mutant-run.mjs', import.meta.url));
const BISECT = fileURLToPath(new URL('../Bisect.js', import.meta.url));
const SPEC = JSON.parse(readFileSync(new URL('./mutants.json', import.meta.url), 'utf8'));
// The roster is the oracle's (its census binds it to Bisect.js both ways), never a copy here.
const KERNELS = Object.keys(ORACLE_KERNELS);
const TYPES = TYPE_NAMES;
const CONTROL_PASS_RE = new RegExp('^CONTROL (' + TYPES.join('|') + ') PASS ');

function run(args) {
    return new Promise((resolve) => {
        const cp = spawn(process.execPath, [RUNNER, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '', err = '';
        cp.stdout.on('data', (d) => { out += d; });
        cp.stderr.on('data', (d) => { err += d; });
        cp.on('close', (code) => resolve({ code, out, err, lines: out.split('\n').filter(Boolean) }));
    });
}

// Runs the runner on a temp rows file holding `rows` (and optionally a temp Bisect.js copy).
async function runRows(rows, extra = [], bisectText = null) {
    const dir = mkdtempSync(join(tmpdir(), 'lite-bisect-mutants-test-'));
    try {
        const rowsPath = join(dir, 'rows.json');
        writeFileSync(rowsPath, JSON.stringify({ rows }));
        const args = ['--rows', rowsPath, '--jobs', '2', ...extra];
        if (bisectText !== null) {
            const p = join(dir, 'Bisect.js');
            writeFileSync(p, bisectText);
            args.push('--file', p);
        }
        return await run(args);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function summary(r) {
    const m = r.lines.map((l) => /^MUTANTS rows=(\d+) killed=(\d+) .* control=(PASS|FAIL) /.exec(l)).find(Boolean);
    assert.ok(m, 'no MUTANTS summary line:\n' + r.out + r.err);
    return { rows: Number(m[1]), killed: Number(m[2]), control: m[3], verdict: r.lines[r.lines.length - 1] };
}

function row(id) {
    const r = SPEC.rows.find((x) => x.id === id);
    assert.ok(r, 'row ' + id + ' missing from mutants.json');
    return r;
}

// Asserts: exit 1, VERDICT FAIL, killed 0, and exactly one row line of `kind` for `id`.
function assertOutcome(r, kind, id) {
    const s = summary(r);
    assert.equal(r.code, 1, r.out + r.err);
    assert.equal(s.verdict, 'VERDICT FAIL');
    assert.equal(s.killed, 0, 'a ' + kind + ' row counted as killed');
    const hit = r.lines.filter((l) => l.startsWith(kind + ' ' + id + ' ') || l === kind + ' ' + id);
    assert.equal(hit.length, 1, 'want one ' + kind + ' line for ' + id + ':\n' + r.out);
    assert.equal(r.lines.filter((l) => l.startsWith('KILLED ')).length, 0);
}

test('mutants.json: every kernel x type has >= 1 row; ids unique; no inert row', () => {
    const fns = new Set(SPEC.rows.map((r) => r.fn));
    for (const k of KERNELS) for (const T of TYPES) assert.ok(fns.has(k + T), 'no mutant row for ' + k + T);
    assert.equal(new Set(SPEC.rows.map((r) => r.id)).size, SPEC.rows.length);
    for (const r of SPEC.rows) assert.notEqual(r.find, r.replace, r.id + ' is inert');
    // Same rows for every type (one per kernel per compare, x every oracle type), apart from
    // nearest.rounded-tie.*: F64 / F32 / I32 only (on U32 / U16 no rounded tie exists, so the
    // reverted tie-break is an equivalent mutant there and would SURVIVE).
    const RT = 'nearest.rounded-tie.';
    const perType = TYPES.map((T) => SPEC.rows.filter((r) => r.fn.endsWith(T) && !r.id.startsWith(RT)).length);
    assert.ok(perType.every((n) => n === perType[0] && n > 0), 'rows per type ' + perType.join('/'));
    assert.deepEqual(SPEC.rows.filter((r) => r.id.startsWith(RT)).map((r) => r.fn).sort(), ['nearestF32', 'nearestF64', 'nearestI32']);
    assert.equal(SPEC.rows.length, perType[0] * TYPES.length + 3);
});

test('live: every row KILLED (killed === rows), every unmutated control PASS', async () => {
    const r = await run([]);
    const s = summary(r);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(s.verdict, 'VERDICT PASS');
    assert.equal(s.rows, SPEC.rows.length);
    assert.equal(s.killed, SPEC.rows.length);
    assert.equal(s.control, 'PASS');
    assert.equal(r.lines.filter((l) => CONTROL_PASS_RE.test(l)).length, TYPES.length);
    for (const x of SPEC.rows) {
        const ln = r.lines.find((l) => l.startsWith('KILLED ' + x.id + ' '));
        assert.ok(ln, x.id + ' not KILLED');
        const checks = Number(/ checks=(\d+) /.exec(ln)[1]);
        assert.ok(checks >= 10000, x.id + ' checks ' + checks);
    }
});

describe('runner controls (each fails on its row alone)', { concurrency: true }, () => {
    const base = row('lowerBoundBranchless.loop-lt.F64');

    test('inert row (find == replace) -> SURVIVED, run FAILS', async () => {
        const r = await runRows([{ ...base, id: 'inert', replace: base.find }]);
        assertOutcome(r, 'SURVIVED', 'inert');
    });

    test('row matching 0 times -> NOT-APPLIED, run FAILS', async () => {
        const r = await runRows([{ ...base, id: 'zero', find: 'b += (0 - ((a[b + h] < x) | 1)) & h;' }]);
        assertOutcome(r, 'NOT-APPLIED', 'zero');
    });

    test('row matching 2 times in its fn -> NOT-APPLIED, run FAILS', async () => {
        // `a[l] < x` is in the hint twice: the B1 comment and the left-gallop loop.
        const r = await runRows([{ id: 'twice', fn: 'lowerBoundHintF64', find: 'a[l] < x', replace: 'a[l] <= x' }]);
        assertOutcome(r, 'NOT-APPLIED', 'twice');
    });

    test('hanging mutant -> TIMEOUT (killed by the runner), never counted killed', async () => {
        const r = await runRows([{ id: 'hang', fn: 'lowerBoundBranchyF64', find: 'while (lo < hi) {', replace: 'while (lo <= hi) {' }],
            ['--timeout', '3000']);
        assertOutcome(r, 'TIMEOUT', 'hang');
    });

    test('mutant exits 1 with no FAIL line -> CRASH, run FAILS', async () => {
        const r = await runRows([{ id: 'exit1', fn: 'lowerBoundBranchyF64', find: 'return lo;', replace: 'process.exit(1);' }]);
        assertOutcome(r, 'CRASH', 'exit1');
    });

    test('mutant exits 0 mid-run (no RESULT line) -> CRASH, run FAILS', async () => {
        const r = await runRows([{ id: 'exit0', fn: 'lowerBoundBranchyF64', find: 'return lo;', replace: 'process.exit(0);' }]);
        assertOutcome(r, 'CRASH', 'exit0');
    });

    test('mutant throws / does not parse -> CRASH, run FAILS', async () => {
        const r = await runRows([
            { id: 'throws', fn: 'upperBoundBranchyF64', find: 'return lo;', replace: 'throw new Error("boom");' },
            { id: 'syntax', fn: 'segmentF64', find: ' - 1;', replace: ' - ;' },
        ]);
        const s = summary(r);
        assert.equal(r.code, 1);
        assert.equal(s.killed, 0);
        assert.equal(r.lines.filter((l) => l.startsWith('CRASH throws ') || l.startsWith('CRASH syntax ')).length, 2, r.out);
    });

    test('checks < 10,000 -> LOWCHECKS (a real mutant is NOT killed), run FAILS', async () => {
        const r = await runRows([{ ...base, id: 'low' }], ['--rounds', '3', '--big', '0']);
        assertOutcome(r, 'LOWCHECKS', 'low');
    });

    test('unmutated control broken -> CONTROL FAIL, run FAILS although killed === rows', async () => {
        const live = readFileSync(BISECT, 'utf8');
        const s0 = live.indexOf('export function lowerBoundBranchlessF64(');
        const at = live.indexOf(base.find, s0);
        assert.ok(s0 >= 0 && at > s0);
        const broken = live.slice(0, at) + base.replace + live.slice(at + base.find.length);
        const r = await runRows([row('nearest.tie-le.U16')], [], broken);
        const s = summary(r);
        assert.equal(r.code, 1);
        assert.equal(s.verdict, 'VERDICT FAIL');
        assert.equal(s.killed, 1);
        assert.equal(s.rows, 1);
        assert.equal(s.control, 'FAIL');
        assert.ok(r.lines.some((l) => l.startsWith('CONTROL F64 FAIL (KILLED)')), r.out);
    });
});
