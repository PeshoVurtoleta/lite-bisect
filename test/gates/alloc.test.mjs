// test/gates/alloc.test.mjs -- U6 alloc-per-op gate (SPEC-p1 U6, assertion 9; P1-R1). Deterministic: no
// clock, so no quiet lock. NOT in the npm test glob (test/*.test.mjs): run by `npm run gates` /
// `npm run gates:local` (LITE_UTILS_DIR=../LiteUtils) on the pinned Node only.
// Two runs of LiteUtils alloc-per-op.mjs over test/gates/alloc-bench.mjs (150 lanes = 7 kernels x 5 types x
// 4 query classes + lowerBoundHint x 5 types x 2 hint classes, nanhint / nanlit, AU-R3), N = 1e6, K = 6, --json. The gate reads EVERY window 1..5 of every lane, never STEADY
// and never the tool's --max (LEDGER D2: STEADY = min of windows 1..K-1 hides a later tier that boxes).
//   run A (inlined):      --expose-gc --no-concurrent-recompilation; every lane <= 1.0 B/op in every window.
//   run B (not inlined):  + --no-turbo-inlining --no-maglev-inlining --allow-natives-syntax; smi lanes <= 1.0,
//                         frac / big / nan lanes 14.0..18.0 (one 16 B HeapNumber per call, LEDGER C2) in
//                         every window; lowerBoundHint<T>.nanhint (Smi query, NaN hint read from a Float64Array)
//                         14.0..18.0 and .nanlit (Smi query, h = the literal NaN) <= 1.0 (AU-R3,
//                         R-NANHINT-BOX: the hint is a number argument too); the
//                         bench writes a %GetOptimizationStatus tier file (LITE_BISECT_TIER_FILE): every lane
//                         and every kernel must carry the TurboFan bits calibrated in that process, and the
//                         run must have both no-inlining flags, else NO VERDICT = FAIL (LEDGER law 8).
// Why --no-maglev-inlining too (U6 finding, node v26.8.2): with --no-turbo-inlining alone the tool's driver
// runs as Maglev code through windows 0-1 and Maglev inlines the lane and a < 100 B kernel (branchy 55 B),
// so every branchy frac / big / nan lane read 0.49..0.86 B/op in window 1 and 16.4 from window 2, whatever
// --warm (2e5, 5e6) -- the tier that matters is the driver's, which the bench cannot read. Both flags make
// run B a not-inlined run in every tier. --no-concurrent-recompilation makes tier-up deterministic; --warm 5e6
// (tool default 2e5) is margin, not a fix. Pinned Node only (v26.8.2, expect.json): another Node is NO VERDICT
// (the 16 B box is Node's 64-bit HeapNumber; alloc-per-op is checked on v26.8.2 only).
// Harness (P1-R12): each run also measures the bench's empty lane 'harness.empty' ((i) => {}, same flags, same
// tool invocation). If it reads > 1.0 B/op in ANY window 1..5 the run is NO VERDICT (harness-noisy) = FAIL:
// never a pass, never a subtraction; thresholds unchanged. P1-R11: run B carries --no-maglev-inlining.
// Controls (law 9): a lane that boxes only from window 3 FAILS here and PASSES the tool's STEADY --max;
// a never-optimized lane is refused by the tier check; run A's numbers fail run B's floor and run B's
// numbers fail run A's ceiling; a broken calibration / a missing flag / a missing tier file / a noisy or
// missing empty lane is NO VERDICT; a missing or extra lane row, or a non-number window (the tool's --json
// writes NaN as null), is a FAIL row; no LiteUtils -> NO VERDICT and a non-zero exit. Both runs are judged
// ONLY through judge() (U6 review r1 B3), and the judge control feeds it clones of the real rows / tier.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadavg, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KERNELS, TYPE_NAMES } from '../oracle.mjs';
import { resolveTools, provenanceLines, runBounded, missingGateFiles, PKG_ROOT } from './lu.mjs';

const BENCH = fileURLToPath(new URL('./alloc-bench.mjs', import.meta.url));
const LU_CLI = fileURLToPath(new URL('./lu.mjs', import.meta.url));
const N = 1000000;
const K = 6;
const WARM = 5000000;
// Assertion 9 (SPEC-p1 section 4), typed here, never read from a run:
const CLASSES = ['smi', 'frac', 'big', 'nan'];
const HINT_CLASSES = { lowerBoundHint: ['nanhint', 'nanlit'] };   // AU-R3: extra classes of one kernel
const BOXED = ['frac', 'big', 'nan', 'nanhint'];                  // run B reads one box per call
const NANLIT_MAX = 1.0;
const INLINED_MAX = 1.0;
const SMI_MAX = 1.0;
const BOX_MIN = 14.0;
const BOX_MAX = 18.0;
const FLAGS_A = ['--expose-gc', '--no-concurrent-recompilation'];
const NO_INLINE = ['--no-turbo-inlining', '--no-maglev-inlining'];
const FLAGS_B = [...FLAGS_A, ...NO_INLINE, '--allow-natives-syntax'];
const TIMEOUT_MS = 900000;

const PINNED_NODE = JSON.parse(readFileSync(new URL('./expect.json', import.meta.url), 'utf8')).pinned.node;
const LU = resolveTools();
const needLU = () => {
    if (process.version !== PINNED_NODE) assert.fail('NO VERDICT: node ' + process.version + ' is not the pinned ' + PINNED_NODE + ' (gates run on the pinned Node only)');
    if (!LU.ok) assert.fail('NO VERDICT: ' + LU.reason);
};

// ---- expected roster (oracle.mjs KERNELS x TYPE_NAMES x CLASSES) ------------------------------
const LANES = [];
for (const k of Object.keys(KERNELS)) for (const t of TYPE_NAMES) for (const c of CLASSES) LANES.push(k + t + '.' + c);
for (const k of Object.keys(HINT_CLASSES)) for (const t of TYPE_NAMES) for (const c of HINT_CLASSES[k]) LANES.push(k + t + '.' + c);
LANES.sort();
const HARNESS = 'harness.empty';
const HARNESS_MAX = 1.0;
const classOf = (lane) => lane.slice(lane.lastIndexOf('.') + 1);
const kernelOf = (lane) => lane.slice(0, lane.lastIndexOf('.'));
const KERNEL_NAMES = [...new Set(LANES.map(kernelOf))].sort();

// ---- pure checkers ------------------------------------------------------------------------------
export const expectInlined = () => [0, INLINED_MAX];
export const expectNotInlined = (lane) => {
    const c = classOf(lane);
    return c === 'smi' ? [0, SMI_MAX] : c === 'nanlit' ? [0, NANLIT_MAX] : BOXED.includes(c) ? [BOX_MIN, BOX_MAX] : [NaN, NaN];
};

/** Every window 1..K-1 of every expected lane inside [lo, hi]; NaN fails; a missing / extra lane fails. */
export function checkWindows(rows, lanes, expect, k = K) {
    const byLane = new Map(rows.map((r) => [r.lane, r]));
    const out = [];
    for (const lane of lanes) {
        const r = byLane.get(lane);
        if (!r) { out.push({ lane, ok: false, reason: 'no row' }); continue; }
        const [lo, hi] = expect(lane);
        if (!Array.isArray(r.windows) || r.windows.length !== k) {
            out.push({ lane, ok: false, reason: 'windows ' + JSON.stringify(r.windows) + ', expected ' + k }); continue;
        }
        const w = r.windows.slice(1);
        const bad = w.map((x, i) => [i + 1, x]).filter(([, x]) => !(typeof x === 'number' && x >= lo && x <= hi));
        out.push({ lane, ok: bad.length === 0, min: Math.min(...w), max: Math.max(...w), lo, hi, windows: r.windows,
            reason: bad.length ? 'window ' + bad.map(([i, x]) => i + '=' + f2(x)).join(' ') + ' outside [' + lo + ', ' + hi + ']' : null });
    }
    for (const r of rows) if (!lanes.includes(r.lane)) out.push({ lane: r.lane, ok: false, reason: 'extra row (not in the roster)' });
    return out;
}

/** P1-R12: the empty lane's windows 1..K-1 all <= 1.0, else NO VERDICT (harness-noisy). null = harness ok. */
export function emptyCheck(rows, k = K) {
    const r = rows.find((x) => x.lane === HARNESS);
    if (!r || !Array.isArray(r.windows) || r.windows.length !== k) return 'NO VERDICT (harness-noisy): no empty-lane row with ' + k + ' windows';
    const bad = r.windows.slice(1).map((x, i) => [i + 1, x]).filter(([, x]) => !(typeof x === 'number' && x <= HARNESS_MAX));
    if (bad.length) return 'NO VERDICT (harness-noisy): empty lane window ' + bad.map(([i, x]) => i + '=' + f2(x)).join(' ') + ' > ' + HARNESS_MAX + ' B/op (load ' + loadavg().map((x) => x.toFixed(2)).join(' ') + ')';
    return null;
}
const laneRows = (rows) => rows.filter((r) => r.lane !== HARNESS);
function logHarness(tag, rows) {
    const r = rows.find((x) => x.lane === HARNESS);
    const w = r ? r.windows : [];
    console.log('# ' + tag + ' harness ' + HARNESS + ' w0..' + (K - 1) + ' ' + w.map(f2).join(' ') + ' | max w1..' + (K - 1) + ' ' +
        (w.length > 1 ? f2(Math.max(...w.slice(1))) : 'n/a') + ' | ' + (emptyCheck(rows) || 'ok (<= ' + HARNESS_MAX + ')'));
}

/** Tier (law 8): calibrated TurboFan mask; every named lane and kernel TurboFan; every flag present. */
export function checkTier(tier, lanes, kernels, needFlags) {
    if (tier === null || typeof tier !== 'object' || !tier.ref) return { noVerdict: 'NO VERDICT: no tier file', bad: [] };
    for (const f of needFlags) {
        if (!(Array.isArray(tier.execArgv) && tier.execArgv.includes(f))) {
            return { noVerdict: 'NO VERDICT: the run lacks ' + f + ' (execArgv ' + JSON.stringify(tier.execArgv) + ')', bad: [] };
        }
    }
    const mask = tier.ref.on & ~tier.ref.off & ~1;
    if (mask === 0) return { noVerdict: 'NO VERDICT: TurboFan bits not calibrated (on=' + tier.ref.on + ' off=' + tier.ref.off + ')', bad: [] };
    if ((tier.ref.maglev & mask) === mask) return { noVerdict: 'NO VERDICT: Maglev ref carries the TurboFan mask ' + mask, bad: [] };
    const bad = [];
    for (const l of lanes) { const s = tier.lanes && tier.lanes[l]; if (!(typeof s === 'number' && (s & mask) === mask)) bad.push('lane ' + l + ' status ' + s); }
    for (const k of kernels) { const s = tier.kernels && tier.kernels[k]; if (!(typeof s === 'number' && (s & mask) === mask)) bad.push('kernel ' + k + ' status ' + s); }
    return { noVerdict: bad.length ? 'NO VERDICT: tier not TurboFan: ' + bad.join(', ') : null, bad, mask };
}

/** The ONE verdict path of runs A and B (tier undefined = run A, no tier check). */
export function judge(rows, expect, tier) {
    return {
        noVerdict: emptyCheck(rows) || (tier === undefined ? null : checkTier(tier, LANES, KERNEL_NAMES, NO_INLINE).noVerdict),
        failing: failing(checkWindows(laneRows(rows), LANES, expect)),
    };
}

// ---- runner -------------------------------------------------------------------------------------
function runAlloc(bench, flags, { lanes = [], env = {}, extra = [] } = {}) {
    const args = [...flags, LU.tools['alloc-per-op.mjs'], '--n', String(N), '--windows', String(K), '--warm', String(WARM),
        ...extra, ...lanes.flatMap((l) => ['--lane', l]), bench];
    const r = runBounded(process.execPath, args, { timeoutMs: TIMEOUT_MS, env: { ...process.env, ...env } });
    return { ...r, cmd: 'node ' + args.join(' ') };
}

function runJson(bench, flags, opts) {
    const r = runAlloc(bench, flags, { ...opts, extra: ['--json'] });
    if (r.timedOut || r.signal !== null) assert.fail('NO VERDICT: alloc-per-op killed (' + (r.signal || 'timeout') + '): ' + r.cmd);
    if (r.status !== 0) assert.fail('NO VERDICT: alloc-per-op exit ' + r.status + '\n' + r.stderr + '\ncmd: ' + r.cmd);
    let j;
    try { j = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { assert.fail('NO VERDICT: unparsable --json output: ' + e.message); }
    assert.equal(j.benches.length, 1);
    return { json: j, rows: j.benches[0].rows, cmd: r.cmd };
}

const f2 = (x) => (typeof x === 'number' ? x.toFixed(2) : String(x));
function logRows(tag, res, cmd, floor) {
    console.log('# ' + tag + ' cmd: ' + cmd);
    console.log('# ' + tag + ' floor (tool, empty lane) ' + f2(floor) + ' B/op; gate reads windows 1..' + (K - 1));
    for (const r of res) {
        console.log(tag + ' ' + (r.ok ? 'ok  ' : 'FAIL') + ' ' + r.lane.padEnd(30) + ' [' + r.lo + ', ' + r.hi + '] min ' + f2(r.min) +
            ' max ' + f2(r.max) + ' | w0..' + (K - 1) + ' ' + (r.windows || []).map(f2).join(' ') + (r.reason ? ' | ' + r.reason : ''));
    }
}
const failing = (res) => res.filter((r) => !r.ok).map((r) => r.lane).sort();

let RUN_A = null;
let RUN_B = null;
let TIER_B = null;
const TMP = mkdtempSync(join(tmpdir(), 'lite-bisect-u6-alloc-'));

before(() => {
    if (LU.ok) for (const l of provenanceLines(LU)) console.log(l);
});

process.on('exit', () => { rmSync(TMP, { recursive: true, force: true }); });

// ---- the gate -----------------------------------------------------------------------------------
test('census: both gate files exist and npm run gates names them (a missing named path passes node --test)', () => {
    assert.deepEqual(missingGateFiles(), []);
});

test('census: alloc-bench lanes == KERNELS x TYPE_NAMES x CLASSES (140) + lowerBoundHint x TYPE_NAMES x nanhint / nanlit (10)', async () => {
    const m = await import(BENCH);
    const c = m.census(CLASSES, HINT_CLASSES);
    assert.deepEqual(c.got, [...LANES, HARNESS].sort());
    assert.deepEqual(c.expected, LANES);
    assert.equal(LANES.length, 150);
    assert.equal(LANES.filter((l) => /^lowerBoundHint(F64|F32|U32|U16|I32)\.nan(hint|lit)$/.test(l)).length, 10);
    assert.throws(() => m.census(CLASSES, { noSuchKernel: ['x'] }), /unknown kernel/);
    for (const l of LANES) assert.ok(expectNotInlined(l).every(Number.isFinite), 'no run B range for ' + l);
});

test('assertion 9a: inlined, every lane <= 1.0 B/op in every window 1..5', () => {
    needLU();
    RUN_A = runJson(BENCH, FLAGS_A);
    const res = checkWindows(laneRows(RUN_A.rows), LANES, expectInlined);
    logRows('A', res, RUN_A.cmd, RUN_A.json.floor);
    logHarness('A', RUN_A.rows);
    assert.equal(RUN_A.json.n, N);
    assert.equal(RUN_A.json.windows, K);
    assert.equal(RUN_A.json.warm, WARM);
    assert.deepEqual(judge(RUN_A.rows, expectInlined), { noVerdict: null, failing: [] });
});

test('assertion 9b: --no-turbo-inlining --no-maglev-inlining, frac / big / nan / nanhint 14.0..18.0, smi / nanlit <= 1.0 in every window 1..5, tier TurboFan', () => {
    needLU();
    const tierFile = join(TMP, 'tier-b.json');
    RUN_B = runJson(BENCH, FLAGS_B, { env: { LITE_BISECT_TIER_FILE: tierFile } });
    try { TIER_B = JSON.parse(readFileSync(tierFile, 'utf8')); } catch { TIER_B = null; }
    const tier = checkTier(TIER_B, LANES, KERNEL_NAMES, NO_INLINE);
    console.log('# B tier: ref ' + JSON.stringify(TIER_B && TIER_B.ref) + ' mask ' + tier.mask + ' | lanes ' + LANES.length +
        ' kernels ' + KERNEL_NAMES.length + ' | ' + (tier.noVerdict || 'all TurboFan'));
    const res = checkWindows(laneRows(RUN_B.rows), LANES, expectNotInlined);
    logRows('B', res, RUN_B.cmd, RUN_B.json.floor);
    logHarness('B', RUN_B.rows);
    assert.equal(RUN_B.json.n, N);
    assert.equal(RUN_B.json.windows, K);
    assert.equal(RUN_B.json.warm, WARM);
    assert.deepEqual(judge(RUN_B.rows, expectNotInlined, TIER_B), { noVerdict: null, failing: [] });
});

// ---- controls -------------------------------------------------------------------------------------
test('control: a lane that boxes only from window 3 FAILS the per-window gate, and PASSES the tool STEADY --max 1 (D2)', () => {
    needLU();
    const dir = mkdtempSync(join(TMP, 'late3-'));
    const bench = join(dir, 'late3-bench.mjs');
    // fn(0) once, WARM ops, then window k covers calls 1 + WARM + k*N .. : box from window 3 on.
    const start = 1 + WARM + 3 * N;
    writeFileSync(bench, [
        '// U6 control bench (scratch): late3 boxes one HeapNumber per op from window 3 on.',
        'const C = new Float64Array(1);',
        'const F = new Float64Array(2);',
        'const objs = [{}, {}];',
        'export const lanes = {',
        '    late3: (i) => { const c = C[0]; C[0] = c + 1; if (c >= ' + start + ') objs[i & 1] = i + 0.5; else F[i & 1] = i; },',
        '    clean: (i) => { F[i & 1] = i; },',
        '};',
        '',
    ].join('\n'));
    const j = runJson(bench, FLAGS_A);
    const res = checkWindows(j.rows, ['clean', 'late3'], expectInlined);
    logRows('C-late3', res, j.cmd, j.json.floor);
    assert.deepEqual(failing(res), ['late3']);
    const late = j.rows.find((r) => r.lane === 'late3');
    assert.ok(late.windows[1] <= INLINED_MAX && late.windows[2] <= INLINED_MAX, 'windows 1-2 clean: ' + late.windows);
    assert.ok(late.windows[3] >= BOX_MIN && late.windows[4] >= BOX_MIN && late.windows[5] >= BOX_MIN, 'windows 3-5 box: ' + late.windows);
    // The same run through the tool's own STEADY gate: PASS (exit 0) -- the gate this file refuses to use.
    const s = runAlloc(bench, FLAGS_A, { extra: ['--max', String(INLINED_MAX)] });
    console.log('# C-late3 tool --max ' + INLINED_MAX + ' (STEADY) exit ' + s.status + ': ' + s.stdout.trim().split('\n').pop());
    assert.equal(s.status, 0, 'tool STEADY gate did not PASS the late lane: ' + s.stdout + s.stderr);
    assert.match(s.stdout, /gate --max 1 \(steady B\/op\): PASS/);
});

test('control: a never-optimized lane in run B is refused by the tier check (law 8)', () => {
    needLU();
    const tierFile = join(TMP, 'tier-never.json');
    const lanes = ['segmentF64.frac', 'segmentF64.smi'];
    const j = runJson(BENCH, FLAGS_B, { lanes, env: { LITE_BISECT_TIER_FILE: tierFile, LITE_BISECT_NEVER_OPT_LANE: 'segmentF64.smi' } });
    const tier = checkTier(JSON.parse(readFileSync(tierFile, 'utf8')), lanes, ['segmentF64'], NO_INLINE);
    console.log('# C-tier never-opt segmentF64.smi: ' + tier.noVerdict);
    assert.deepEqual(tier.bad.map((b) => b.split(' status')[0]), ['lane segmentF64.smi']);
    assert.match(String(tier.noVerdict), /^NO VERDICT: tier not TurboFan/);
    logRows('C-tier', checkWindows(j.rows, lanes, expectNotInlined), j.cmd, j.json.floor);
});

test('control: run A numbers fail run B ranges and run B numbers fail run A ceiling (both checks see the box)', () => {
    assert.ok(RUN_A && RUN_B, 'NO VERDICT: run A / run B did not complete');
    const boxed = LANES.filter((l) => BOXED.includes(classOf(l)));   // includes the 5 nanhint lanes, never nanlit
    assert.equal(boxed.filter((l) => classOf(l) === 'nanhint').length, 5);
    assert.deepEqual(failing(checkWindows(laneRows(RUN_A.rows), LANES, expectNotInlined)), boxed, 'B floor 14.0 did not catch an unboxed lane');
    assert.deepEqual(failing(checkWindows(laneRows(RUN_B.rows), LANES, expectInlined)), boxed, 'A ceiling 1.0 did not catch a boxed lane');
});

test('control: the checkers fail closed (missing row, extra row, NaN, short windows, tier file broken)', () => {
    const row = (lane, w) => ({ lane, windows: w });
    const ok = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
    assert.deepEqual(failing(checkWindows([row('a', ok)], ['a', 'b'], expectInlined)), ['b']);
    assert.deepEqual(failing(checkWindows([row('a', ok), row('z', ok)], ['a'], expectInlined)), ['z']);
    assert.deepEqual(failing(checkWindows([row('a', [0, 0, NaN, 0, 0, 0])], ['a'], expectInlined)), ['a']);
    const viaJson = (rows) => JSON.parse(JSON.stringify(rows));   // the tool's --json path: NaN -> null
    assert.equal(viaJson([row('a', [0, 0, NaN, 0, 0, 0])])[0].windows[2], null);
    assert.deepEqual(failing(checkWindows(viaJson([row('a', [0, 0, null, 0, 0, 0])]), ['a'], expectInlined)), ['a']);
    assert.deepEqual(failing(checkWindows(viaJson([row('a', [0, 0, NaN, 0, 0, 0])]), ['a'], expectInlined)), ['a']);
    assert.deepEqual(failing(checkWindows([row('x.smi', [0, 0, '0.3', 0, 0, 0])], ['x.smi'], expectNotInlined)), ['x.smi']);
    for (let k = 1; k < K; k++) {
        const w = Array(K).fill(0.3); w[k] = 1.1;
        assert.deepEqual(failing(checkWindows([row('a', w)], ['a'], expectInlined)), ['a'], 'window ' + k + ' not read (inlined)');
        const v = Array(K).fill(16); v[k] = 0.3;
        assert.deepEqual(failing(checkWindows([row('x.frac', v)], ['x.frac'], expectNotInlined)), ['x.frac'], 'window ' + k + ' not read (box floor)');
    }
    assert.deepEqual(failing(checkWindows([row('a', [0, 0, 0, 0, 0])], ['a'], expectInlined)), ['a']);
    assert.deepEqual(failing(checkWindows([row('a', [99, 0, 0, 0, 0, 0])], ['a'], expectInlined)), [], 'window 0 must not be read');
    assert.deepEqual(failing(checkWindows([row('x.smi', [0, 16, 16, 16, 16, 16])], ['x.smi'], expectNotInlined)), ['x.smi']);
    assert.deepEqual(failing(checkWindows([row('x.nan', [16, 16, 16, 16, 16, 18.01])], ['x.nan'], expectNotInlined)), ['x.nan']);
    for (let k = 1; k < K; k++) {
        const w = Array(K).fill(0.3); w[k] = 16;
        assert.deepEqual(failing(checkWindows([row('x.nanlit', w)], ['x.nanlit'], expectNotInlined)), ['x.nanlit'], 'nanlit window ' + k + ' box not caught');
        const v = Array(K).fill(16); v[k] = 0.3;
        assert.deepEqual(failing(checkWindows([row('x.nanhint', v)], ['x.nanhint'], expectNotInlined)), ['x.nanhint'], 'nanhint window ' + k + ' not read');
    }
    assert.deepEqual(failing(checkWindows([row('x.unknown', [0, 0, 0, 0, 0, 0])], ['x.unknown'], expectNotInlined)), ['x.unknown'], 'an unknown class has no range: FAIL');
    const t = { execArgv: [...NO_INLINE], ref: { on: 41, off: 65, maglev: 25 }, lanes: { l: 41 }, kernels: { k: 41 } };
    assert.equal(checkTier(t, ['l'], ['k'], NO_INLINE).noVerdict, null);
    assert.match(checkTier({ ...t, execArgv: [] }, ['l'], ['k'], NO_INLINE).noVerdict, /lacks --no-turbo-inlining/);
    assert.match(checkTier({ ...t, execArgv: ['--no-turbo-inlining'] }, ['l'], ['k'], NO_INLINE).noVerdict, /lacks --no-maglev-inlining/);
    assert.match(checkTier({ ...t, ref: { on: 65, off: 65, maglev: 25 } }, ['l'], ['k'], NO_INLINE).noVerdict, /not calibrated/);
    assert.match(checkTier({ ...t, ref: { on: 41, off: 65, maglev: 41 } }, ['l'], ['k'], NO_INLINE).noVerdict, /Maglev ref/);
    assert.match(checkTier({ ...t, kernels: { k: 25 } }, ['l'], ['k'], NO_INLINE).noVerdict, /kernel k status 25/);
    assert.match(checkTier({ ...t, lanes: {} }, ['l'], ['k'], NO_INLINE).noVerdict, /lane l status undefined/);
    assert.match(checkTier(null, ['l'], ['k'], NO_INLINE).noVerdict, /no tier file/);
});

test('control: a noisy empty lane (1.1 B/op in one window) makes the run NO VERDICT (P1-R12)', () => {
    const e = (w) => [{ lane: HARNESS, windows: w }, { lane: 'x.smi', windows: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3] }];
    assert.equal(emptyCheck(e([0.3, 0.3, 0.3, 0.3, 0.3, 0.3])), null);
    assert.equal(emptyCheck(e([5, 1.0, 1.0, 1.0, 1.0, 1.0])), null, 'window 0 is not read; 1.0 is within');
    for (let k = 1; k < K; k++) {
        const w = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
        w[k] = 1.1;
        const v = emptyCheck(e(w));
        console.log('# C-harness forced 1.1 in window ' + k + ': ' + v);
        assert.match(String(v), /^NO VERDICT \(harness-noisy\): empty lane window /);
    }
    assert.match(String(emptyCheck(e([0.3, 0.3, NaN, 0.3, 0.3, 0.3]))), /^NO VERDICT \(harness-noisy\)/);
    assert.match(String(emptyCheck(JSON.parse(JSON.stringify(e([0.3, null, 0.3, 0.3, 0.3, 0.3]))))), /^NO VERDICT \(harness-noisy\)/);
    assert.match(String(emptyCheck(JSON.parse(JSON.stringify(e([0.3, NaN, 0.3, 0.3, 0.3, 0.3]))))), /^NO VERDICT \(harness-noisy\)/);
    assert.match(String(emptyCheck([{ lane: 'x.smi', windows: [0, 0, 0, 0, 0, 0] }])), /no empty-lane row/);
    assert.match(String(emptyCheck(e([0.3, 0.3, 0.3, 0.3, 0.3]))), /no empty-lane row/);
    if (RUN_A) assert.ok(RUN_A.rows.some((r) => r.lane === HARNESS), 'run A measured no empty lane');
    if (RUN_B) assert.ok(RUN_B.rows.some((r) => r.lane === HARNESS), 'run B measured no empty lane');
});

test('control: judge() -- the verdict path of 9a / 9b -- refuses clones of the real runs with a noisy harness or a bad tier', () => {
    assert.ok(RUN_A && RUN_B && TIER_B, 'NO VERDICT: run A / run B did not complete');
    const clone = (x) => JSON.parse(JSON.stringify(x));
    assert.deepEqual(judge(clone(RUN_A.rows), expectInlined), { noVerdict: null, failing: [] }, 'unedited run A clone');
    assert.deepEqual(judge(clone(RUN_B.rows), expectNotInlined, clone(TIER_B)), { noVerdict: null, failing: [] }, 'unedited run B clone');
    for (let k = 1; k < K; k++) {
        for (const [tag, run, expect, tier] of [['A', RUN_A, expectInlined, undefined], ['B', RUN_B, expectNotInlined, TIER_B]]) {
            const rows = clone(run.rows);
            rows.find((r) => r.lane === HARNESS).windows[k] = 1.1;
            const v = judge(rows, expect, tier === undefined ? undefined : clone(tier));
            assert.match(String(v.noVerdict), /^NO VERDICT \(harness-noisy\)/, tag + ' harness window ' + k);
        }
    }
    const t1 = clone(TIER_B); t1.lanes['segmentF64.smi'] = t1.ref.off;
    const t2 = clone(TIER_B); t2.kernels.nearestU16 = t2.ref.maglev;
    const t3 = clone(TIER_B); t3.execArgv = t3.execArgv.filter((f) => f !== '--no-maglev-inlining');
    const v1 = judge(clone(RUN_B.rows), expectNotInlined, t1);
    const v2 = judge(clone(RUN_B.rows), expectNotInlined, t2);
    const v3 = judge(clone(RUN_B.rows), expectNotInlined, t3);
    console.log('# C-judge lane off: ' + v1.noVerdict + ' | kernel maglev: ' + v2.noVerdict + ' | flag: ' + v3.noVerdict);
    assert.match(String(v1.noVerdict), /^NO VERDICT: tier not TurboFan: lane segmentF64\.smi status /);
    assert.match(String(v2.noVerdict), /^NO VERDICT: tier not TurboFan: kernel nearestU16 status /);
    assert.match(String(v3.noVerdict), /^NO VERDICT: the run lacks --no-maglev-inlining/);
});

test('control: no LiteUtils -> NO VERDICT and a non-zero exit', () => {
    const empty = mkdtempSync(join(TMP, 'no-lu-'));
    const env = { ...process.env };
    delete env.LITE_UTILS_DIR;
    const r = resolveTools({ root: empty, env });
    assert.equal(r.ok, false);
    assert.match(r.reason, /no LiteUtils/);
    const c = runBounded(process.execPath, [LU_CLI, '--root', empty], { timeoutMs: 60000, env, cwd: PKG_ROOT });
    console.log('# C-nolu exit ' + c.status + ': ' + c.stdout.trim());
    assert.equal(c.status, 2);
    assert.match(c.stdout, /^NO VERDICT: no LiteUtils/);
    const bad = resolveTools({ root: empty, env: { LITE_UTILS_DIR: join(empty, 'nope') } });
    assert.equal(bad.ok, false);
    assert.match(bad.reason, /not a directory/);
});
