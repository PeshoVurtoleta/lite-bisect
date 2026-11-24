// test/gates/alloc.test.mjs -- U6 alloc-per-op gate (SPEC-p1 U6, assertion 9; P1-R1). Deterministic: no
// clock, so no quiet lock. NOT in the npm test glob (test/*.test.mjs): run by `npm run gates` /
// `npm run gates:local` (LITE_UTILS_DIR=../LiteUtils) on the pinned Node only.
// Two runs of LiteUtils alloc-per-op.mjs over test/gates/alloc-bench.mjs (225 lanes = 9 kernels x 5 types x
// 4 query classes + the 3 hinted families lowerBoundHint / upperBoundHint / segmentHint x 5 types x 3 hint classes,
// nanhint / nanlit (AU-R3) / fracnanhint (NEON-R1)),
// N = 1e6, K = 6, --json. The gate reads EVERY window 1..5 of every lane, never STEADY
// and never the tool's --max (LEDGER D2: STEADY = min of windows 1..K-1 hides a later tier that boxes).
//   run A (inlined):      --expose-gc --no-concurrent-recompilation; every lane <= 1.0 B/op in every window.
//   run B (not inlined):  + --no-turbo-inlining --no-maglev-inlining --allow-natives-syntax; smi lanes <= 1.0,
//                         frac / big / nan lanes 14.0..18.0 (one 16 B HeapNumber per call, LEDGER C2) in
//                         every window; lowerBoundHint<T>.nanhint (Smi query, NaN hint read from a Float64Array)
//                         14.0..18.0 and .nanlit (Smi query, h = the literal NaN) <= 1.0 (AU-R3,
//                         R-NANHINT-BOX: the hint is a number argument too); lowerBoundHint<T>.fracnanhint
//                         (frac query AND NaN hint, both read from Float64Arrays: two non-Smi arguments)
//                         28.0..36.0 = two 16 B boxes per call (NEON-R1: one box per such argument);
//                         upperBoundHint<T> has lowerBoundHint<T>'s ranges; segmentHint<T> (seghint 1.1, SPEC B-S3:
//                         s + 1 inside the wrapper is one more number crossing its non-inlined call into
//                         upperBoundHint<T>, so a non-Smi s boxes twice) .nanhint 28.0..36.0, .nanlit 14.0..18.0,
//                         .fracnanhint 44.0..52.0 (x, s and s + 1: three boxes); its smi / frac / big / nan lanes
//                         keep the class ranges (s is a Smi there); the
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
// tool invocation). If it reads outside [0, 1.0] B/op in ANY window 1..5 (neon-3: a negative reading is not a
// clean harness either) the run is NO VERDICT (harness-noisy) = FAIL:
// never a pass, never a subtraction; thresholds unchanged. P1-R11: run B carries --no-maglev-inlining.
// Controls (law 9): a lane that boxes only from window 3 FAILS here; the tool's own --max 1 gate on it is
// keyed on the tool's --json `signal` (Q-AP-LB (a), LiteUtils LEDGER #128, a field never a version): absent = the old
// STEADY tool, exit 0 + PASS; "space-used-paired" = the new PEAK tool, exit 1 + FAIL; any other = NO VERDICT;
// a never-optimized lane is refused by the tier check; run A's numbers fail run B's floor and run B's
// numbers fail run A's ceiling on exactly the lanes whose run B floor is > 1.0 (170); on each of the 15 hinted
// nanhint / fracnanhint pairs the fracnanhint lane's run B numbers fail the nanhint range and the nanhint numbers
// fail the fracnanhint range (NEON-R1, generalised in seghint 1.1); planted rows just outside each segmentHint range
// fail that row alone, just inside pass; a broken calibration / a missing flag / a missing tier file / a noisy or
// missing empty lane is NO VERDICT; a missing or extra lane row, or a non-number window (the tool's --json
// writes NaN as null), is a FAIL row; a negative empty-lane window read back from JSON is NO VERDICT (neon-3);
// no LiteUtils -> NO VERDICT (judged by luVerdict) and a non-zero exit. Both runs are judged
// ONLY through judge() (U6 review r1 B3), and the judge control feeds it clones of the real rows / tier.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadavg, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KERNELS, TYPE_NAMES } from '../oracle.mjs';
import { resolveTools, luVerdict, provenanceLines, runBounded, missingGateFiles, PKG_ROOT } from './lu.mjs';

const BENCH = fileURLToPath(new URL('./alloc-bench.mjs', import.meta.url));
const LU_CLI = fileURLToPath(new URL('./lu.mjs', import.meta.url));
const N = 1000000;
const K = 6;
const WARM = 5000000;
// Assertion 9 (SPEC-p1 section 4), typed here, never read from a run:
const CLASSES = ['smi', 'frac', 'big', 'nan'];
const HINT_CLASSES = {   // AU-R3 + NEON-R1: extra classes of the hinted families (seghint 1.1 adds the 2 new families)
    lowerBoundHint: ['nanhint', 'nanlit', 'fracnanhint'],
    upperBoundHint: ['nanhint', 'nanlit', 'fracnanhint'],
    segmentHint: ['nanhint', 'nanlit', 'fracnanhint'],
};
const BOXED = ['frac', 'big', 'nan', 'nanhint'];                  // run B reads one box per call
const BOXED2 = ['fracnanhint'];                                   // run B reads two boxes per call (NEON-R1)
const NANLIT_MAX = 1.0;
const INLINED_MAX = 1.0;
const SMI_MAX = 1.0;
const BOX_MIN = 14.0;
const BOX_MAX = 18.0;
const BOX2_MIN = 28.0;   // NEON-R1: two non-Smi arguments across a non-inlined call = 2 x 16 B (measured 32 B/op)
const BOX2_MAX = 36.0;
const BOX3_MIN = 44.0;   // seghint 1.1 (SPEC B-S3): segmentHint<T>.fracnanhint = x, s and s + 1 across non-inlined calls = 3 x 16 B
const BOX3_MAX = 52.0;
// Per-family run B ranges that differ from the class range (SPEC B-S3, typed from the mechanism, confirmed by BB0 run B,
// never read from a run, LEDGER law 9). A family or class not named here takes the class range; upperBoundHint<T>
// takes lowerBoundHint<T>'s (the class ranges). segmentHint<T>: s + 1 is a new number crossing the call into
// upperBoundHint<T>, so a non-Smi s boxes once at the caller and once inside the wrapper.
const FAMILY_RANGES = {
    segmentHint: { nanhint: [BOX2_MIN, BOX2_MAX], nanlit: [BOX_MIN, BOX_MAX], fracnanhint: [BOX3_MIN, BOX3_MAX] },
};
const FLAGS_A = ['--expose-gc', '--no-concurrent-recompilation'];
const NO_INLINE = ['--no-turbo-inlining', '--no-maglev-inlining'];
const FLAGS_B = [...FLAGS_A, ...NO_INLINE, '--allow-natives-syntax'];
const TIMEOUT_MS = 900000;

const PINNED_NODE = JSON.parse(readFileSync(new URL('./expect.json', import.meta.url), 'utf8')).pinned.node;
const LU = resolveTools();
const needLU = () => {
    if (process.version !== PINNED_NODE) assert.fail('NO VERDICT: node ' + process.version + ' is not the pinned ' + PINNED_NODE + ' (gates run on the pinned Node only)');
    const nv = luVerdict(LU); if (nv !== null) assert.fail(nv);
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
const familyOf = (lane) => { const k = kernelOf(lane); for (const t of TYPE_NAMES) if (k.endsWith(t)) return k.slice(0, -t.length); return k; };

// ---- pure checkers ------------------------------------------------------------------------------
export const expectInlined = () => [0, INLINED_MAX];
export const expectNotInlined = (lane) => {
    const c = classOf(lane);
    const fam = familyOf(lane);
    if (Object.hasOwn(FAMILY_RANGES, fam) && Object.hasOwn(FAMILY_RANGES[fam], c)) return [...FAMILY_RANGES[fam][c]];
    return c === 'smi' ? [0, SMI_MAX] : c === 'nanlit' ? [0, NANLIT_MAX] : BOXED.includes(c) ? [BOX_MIN, BOX_MAX]
        : BOXED2.includes(c) ? [BOX2_MIN, BOX2_MAX] : [NaN, NaN];
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

/** P1-R12: the empty lane's windows 1..K-1 all inside [0, 1.0] (neon-3: a lower bound too), else NO VERDICT
 *  (harness-noisy). null = harness ok. */
export function emptyCheck(rows, k = K) {
    const r = rows.find((x) => x.lane === HARNESS);
    if (!r || !Array.isArray(r.windows) || r.windows.length !== k) return 'NO VERDICT (harness-noisy): no empty-lane row with ' + k + ' windows';
    const bad = r.windows.slice(1).map((x, i) => [i + 1, x]).filter(([, x]) => !(typeof x === 'number' && x >= 0 && x <= HARNESS_MAX));
    if (bad.length) return 'NO VERDICT (harness-noisy): empty lane window ' + bad.map(([i, x]) => i + '=' + f2(x)).join(' ') + ' outside [0, ' + HARNESS_MAX + '] B/op (load ' + loadavg().map((x) => x.toFixed(2)).join(' ') + ')';
    return null;
}
const laneRows = (rows) => rows.filter((r) => r.lane !== HARNESS);
function logHarness(tag, rows) {
    const r = rows.find((x) => x.lane === HARNESS);
    const w = r ? r.windows : [];
    console.log('# ' + tag + ' harness ' + HARNESS + ' w0..' + (K - 1) + ' ' + w.map(f2).join(' ') + ' | max w1..' + (K - 1) + ' ' +
        (w.length > 1 ? f2(Math.max(...w.slice(1))) : 'n/a') + ' | ' + (emptyCheck(rows) || 'ok (inside [0, ' + HARNESS_MAX + '])'));
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

// ---- C-late3: the tool's own --max gate (Q-AP-LB (a)) -------------------------------------------
// Typed from the ruling, never read from a run (law 9). Keyed on the --json `signal` field only.
const LATE_PAIRED = 'space-used-paired';
const LATE_OLD_EXIT = 0;
const LATE_OLD_LINE = /gate --max 1 \(steady B\/op\): PASS/;
const LATE_NEW_EXIT = 1;
const LATE_NEW_LINE = /gate --max 1 \(peak B\/op\): FAIL/;

/** The ONLY place the C-late3 tool-gate expectation is decided. json = the row's --json run; status /
 *  stdout = the tool's --max 1 run. verdict 'ok' | 'FAIL' | 'NO VERDICT'; null signal is not absent. */
export function lateGateVerdict(json, status, stdout) {
    if (json === null || typeof json !== 'object' || Array.isArray(json)) {
        return { verdict: 'NO VERDICT', branch: 'none', reason: '--json is not an object (' + (json === null ? 'null' : Array.isArray(json) ? 'array' : typeof json) + ')' };
    }
    if (!Object.hasOwn(json, 'signal')) {
        const ok = status === LATE_OLD_EXIT && typeof stdout === 'string' && LATE_OLD_LINE.test(stdout);
        return { verdict: ok ? 'ok' : 'FAIL', branch: 'absent (old STEADY tool)',
            reason: ok ? null : 'expected exit ' + LATE_OLD_EXIT + ' + ' + LATE_OLD_LINE.source + ', got exit ' + status };
    }
    const sig = json.signal;
    if (typeof sig === 'string' && sig === LATE_PAIRED) {
        const ok = status === LATE_NEW_EXIT && typeof stdout === 'string' && LATE_NEW_LINE.test(stdout);
        return { verdict: ok ? 'ok' : 'FAIL', branch: LATE_PAIRED + ' (new PEAK tool)',
            reason: ok ? null : 'expected exit ' + LATE_NEW_EXIT + ' + ' + LATE_NEW_LINE.source + ', got exit ' + status };
    }
    let shown;
    try { shown = typeof sig + ' ' + JSON.stringify(sig); } catch { shown = typeof sig; }
    return { verdict: 'NO VERDICT', branch: 'unknown', reason: 'unknown --json signal (' + shown + ')' };
}

/** The C-late3 row verdict: lateGateVerdict, then THROW unless 'ok' (message starts with the verdict word). */
export function lateGateRow(json, status, stdout) {
    const v = lateGateVerdict(json, status, stdout);
    if (v.verdict !== 'ok') throw new Error(v.verdict + ': C-late3 tool gate (' + v.branch + '): ' + v.reason);
    return v;
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

test('census: alloc-bench lanes == KERNELS x TYPE_NAMES x CLASSES (180) + lowerBoundHint / upperBoundHint / segmentHint x TYPE_NAMES x nanhint / nanlit / fracnanhint (45)', async () => {
    const m = await import(BENCH);
    const c = m.census(CLASSES, HINT_CLASSES);
    assert.deepEqual(c.got, [...LANES, HARNESS].sort());
    assert.deepEqual(c.expected, LANES);
    assert.equal(LANES.length, 225);
    assert.equal(KERNEL_NAMES.length, 45);
    assert.equal(LANES.filter((l) => /^(lowerBoundHint|upperBoundHint|segmentHint)(F64|F32|U32|U16|I32)\.nan(hint|lit)$/.test(l)).length, 30);
    assert.equal(LANES.filter((l) => /^(lowerBoundHint|upperBoundHint|segmentHint)(F64|F32|U32|U16|I32)\.fracnanhint$/.test(l)).length, 15);
    // run B ranges of the hinted families, typed here as literals (SPEC B-S3), lane by lane against expectNotInlined
    const TYPED = {
        lowerBoundHint: { smi: [0, 1], frac: [14, 18], big: [14, 18], nan: [14, 18], nanhint: [14, 18], nanlit: [0, 1], fracnanhint: [28, 36] },
        upperBoundHint: { smi: [0, 1], frac: [14, 18], big: [14, 18], nan: [14, 18], nanhint: [14, 18], nanlit: [0, 1], fracnanhint: [28, 36] },
        segmentHint: { smi: [0, 1], frac: [14, 18], big: [14, 18], nan: [14, 18], nanhint: [28, 36], nanlit: [14, 18], fracnanhint: [44, 52] },
    };
    let typedN = 0;
    for (const l of LANES) {
        const f = familyOf(l);
        if (!Object.hasOwn(TYPED, f)) continue;
        assert.deepEqual(expectNotInlined(l), TYPED[f][classOf(l)], l);
        typedN++;
    }
    assert.equal(typedN, 105);
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

test('assertion 9b: --no-turbo-inlining --no-maglev-inlining, frac / big / nan / nanhint 14.0..18.0, fracnanhint 28.0..36.0, smi / nanlit <= 1.0; segmentHint<T> nanhint 28.0..36.0, nanlit 14.0..18.0, fracnanhint 44.0..52.0 in every window 1..5, tier TurboFan', () => {
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
test('control: a lane that boxes only from window 3 FAILS the per-window gate; the tool --max 1 gate reads as its --json signal says (absent = STEADY PASS, space-used-paired = PEAK FAIL, other = NO VERDICT) (D2, Q-AP-LB)', () => {
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
    // The same bench through the tool's own --max gate (the gate this file refuses to use). What it must
    // read is decided ONLY by lateGateRow (= lateGateVerdict + throw unless ok), keyed on the --json run's `signal` (Q-AP-LB (a)).
    const s = runAlloc(bench, FLAGS_A, { extra: ['--max', String(INLINED_MAX)] });
    if (s.timedOut || s.signal !== null) assert.fail('NO VERDICT: alloc-per-op --max killed (' + (s.signal || 'timeout') + '): ' + s.cmd);
    let live = null;
    let err = null;
    try { live = lateGateRow(j.json, s.status, s.stdout); } catch (e) { err = e; }
    const hasSig = j.json !== null && typeof j.json === 'object' && Object.hasOwn(j.json, 'signal');
    const gateLine = String(s.stdout).split('\n').filter((l) => /gate --max/.test(l)).pop() || ('(no gate line) ' + String(s.stdout).trim().split('\n').pop());
    console.log('# C-late3 tool --max ' + INLINED_MAX + ' signal ' + (hasSig ? JSON.stringify(j.json.signal) : 'absent') + ' exit ' + s.status + ' ' +
        (err ? String(err.message) : 'ok branch ' + live.branch) + ' | ' + gateLine);
    if (err) throw err;
    // B5 / B7: clones of the REAL --json + the live --max run, through the same decision function. The live
    // row passed its own branch above, so the OTHER branch's exit / words cannot match (expectations typed
    // from the ruling, never from lateGateVerdict): live old tool -> deleted ok, paired FAIL; live new tool ->
    // deleted FAIL, paired ok; unknown string / null -> NO VERDICT either way.
    const liveOld = !hasSig;
    const clone = () => JSON.parse(JSON.stringify(j.json));
    const cDel = clone(); delete cDel.signal;
    const cPaired = clone(); cPaired.signal = LATE_PAIRED;
    const cUnknown = clone(); cUnknown.signal = 'total-allocated';
    const cNull = clone(); cNull.signal = null;
    const clones = [
        ['signal deleted', cDel, liveOld ? 'ok' : 'FAIL'],
        ['signal "space-used-paired"', cPaired, liveOld ? 'FAIL' : 'ok'],
        ['signal "total-allocated"', cUnknown, 'NO VERDICT'],
        ['signal null', cNull, 'NO VERDICT'],
        ['live --json as read', clone(), 'ok'],
    ];
    const got = clones.map(([tag, json, want]) => [tag, lateGateVerdict(json, s.status, s.stdout).verdict, want]);
    console.log('# C-late3 live clones (' + (liveOld ? 'old tool' : 'new tool') + '): ' + got.map(([t, g, w]) => t + ' -> ' + g + ' (want ' + w + ')').join(' | '));
    for (const [tag, g, w] of got) assert.equal(g, w, 'live clone ' + tag + ': got ' + g + ', want ' + w);
});

test('control: lateGateVerdict -- the C-late3 tool-gate expectation keyed on the --json signal field (planted pairs, runs without LiteUtils)', () => {
    const viaJson = (x) => JSON.parse(JSON.stringify(x));
    const OLD_PASS = 'gate --max 1 (steady B/op): PASS';
    const OLD_FAIL = 'gate --max 1 (steady B/op): FAIL (late3)';
    const NEW_FAIL = 'gate --max 1 (peak B/op): FAIL (late3)';
    const NEW_PASS = 'gate --max 1 (peak B/op): PASS';
    const NEW_NV = 'gate --max 1 (peak B/op): NO VERDICT (within band +-0.5)';
    const base = { n: N, windows: K, benches: [{ rows: [] }] };
    const absent = viaJson(base);
    const sig = (v) => viaJson({ ...base, signal: v });
    // [tag, json, status, stdout, want]
    const cases = [
        ['absent + exit 0 + steady PASS', absent, 0, 'floor\n\n' + OLD_PASS + '\n', 'ok'],
        ['paired + exit 1 + peak FAIL', sig(LATE_PAIRED), 1, 'floor\n\n' + NEW_FAIL + '\n', 'ok'],
        // (a) signal absent but the tool says FAIL
        ['absent + exit 1 + steady FAIL', absent, 1, OLD_FAIL, 'FAIL'],
        ['absent + exit 0 + steady FAIL', absent, 0, OLD_FAIL, 'FAIL'],
        ['absent + exit 1 + steady PASS', absent, 1, OLD_PASS, 'FAIL'],
        ['absent + exit 0 + peak PASS', absent, 0, NEW_PASS, 'FAIL'],
        ['absent + exit 1 + peak FAIL', absent, 1, NEW_FAIL, 'FAIL'],
        // (b) paired but exit 0
        ['paired + exit 0 + peak PASS', sig(LATE_PAIRED), 0, NEW_PASS, 'FAIL'],
        ['paired + exit 0 + peak FAIL', sig(LATE_PAIRED), 0, NEW_FAIL, 'FAIL'],
        ['paired + exit 1 + steady FAIL (old words)', sig(LATE_PAIRED), 1, OLD_FAIL, 'FAIL'],
        ['paired + exit 0 + steady PASS (old pair)', sig(LATE_PAIRED), 0, OLD_PASS, 'FAIL'],
        ['paired + exit 2 + peak NO VERDICT', sig(LATE_PAIRED), 2, NEW_NV, 'FAIL'],
        ['paired + exit null (killed) + peak FAIL', sig(LATE_PAIRED), null, NEW_FAIL, 'FAIL'],
        ['paired + exit "1" + peak FAIL', sig(LATE_PAIRED), '1', NEW_FAIL, 'FAIL'],
        ['absent + exit "0" + steady PASS', absent, '0', OLD_PASS, 'FAIL'],
        ['paired + exit 1 + peak PASS', sig(LATE_PAIRED), 1, NEW_PASS, 'FAIL'],
        ['paired + exit 1 + peak NO VERDICT', sig(LATE_PAIRED), 1, NEW_NV, 'FAIL'],
        ['absent + exit 0 + stdout not a string', absent, 0, [OLD_PASS], 'FAIL'],
        ['paired + exit 1 + stdout not a string', sig(LATE_PAIRED), 1, [NEW_FAIL], 'FAIL'],
        ['absent + exit 0 + steady PASS at --max 2', absent, 0, 'gate --max 2 (steady B/op): PASS', 'FAIL'],
        ['paired + exit 1 + peak FAIL at --max 2', sig(LATE_PAIRED), 1, 'gate --max 2 (peak B/op): FAIL (late3)', 'FAIL'],
    ];
    // (c) unknown string signals and (d) non-string signals: NO VERDICT with EITHER tool's passing pair
    for (const v of ['total-allocated', '', 'Space-Used-Paired', 'space-used-paired ', null, 1, 0, true, false, [LATE_PAIRED], {}, { signal: LATE_PAIRED }]) {
        const t = 'signal ' + JSON.stringify(v);
        cases.push([t + ' + old PASS pair', sig(v), 0, OLD_PASS, 'NO VERDICT']);
        cases.push([t + ' + new FAIL pair', sig(v), 1, NEW_FAIL, 'NO VERDICT']);
    }
    // not representable in JSON (passed as is): a present key holding undefined, a NaN that JSON makes null
    const undef = { ...absent, signal: undefined };
    cases.push(['signal present = undefined + old PASS pair', undef, 0, OLD_PASS, 'NO VERDICT']);
    cases.push(['signal present = undefined + new FAIL pair', undef, 1, NEW_FAIL, 'NO VERDICT']);
    cases.push(['signal NaN via JSON (null) + old PASS pair', sig(NaN), 0, OLD_PASS, 'NO VERDICT']);
    // the json itself is not an object
    for (const [t, v] of [['null', null], ['string', 'space-used-paired'], ['number', 0], ['array', []], ['undefined', undefined]]) {
        cases.push(['json ' + t + ' + old PASS pair', v === undefined ? v : viaJson(v), 0, OLD_PASS, 'NO VERDICT']);
        cases.push(['json ' + t + ' + new FAIL pair', v === undefined ? v : viaJson(v), 1, NEW_FAIL, 'NO VERDICT']);
    }
    assert.equal(Object.hasOwn(sig(null), 'signal'), true, 'JSON keeps a null signal as a present key');
    assert.equal(Object.hasOwn(absent, 'signal'), false);
    const bad = [];
    for (const [tag, json, status, stdout, want] of cases) {
        const v = lateGateVerdict(json, status, stdout);
        if (v.verdict !== want) bad.push(tag + ': got ' + v.verdict + ' (' + v.branch + '), want ' + want);
        else if (want !== 'ok' && typeof v.reason !== 'string') bad.push(tag + ': ' + v.verdict + ' with no reason');
    }
    console.log('# C-late3-decide ' + cases.length + ' planted pairs, ' + bad.length + ' wrong');
    assert.deepEqual(bad, []);
    // N1: the row verdict itself (the live row calls lateGateRow and nothing else): ok returns, else throws "<want>: ".
    for (const [tag, json, status, stdout, want] of cases) {
        if (want === 'ok') assert.doesNotThrow(() => lateGateRow(json, status, stdout), 'lateGateRow ' + tag);
        else assert.throws(() => lateGateRow(json, status, stdout), { message: new RegExp('^' + want + ': ') }, 'lateGateRow ' + tag);
    }
    const nv = lateGateVerdict(sig('total-allocated'), 0, OLD_PASS);
    assert.match(nv.verdict + ': ' + nv.reason, /^NO VERDICT: unknown --json signal/);
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
    // The boxed set is derived from each lane's run B range: floor > the run A ceiling 1.0 = run B expects a box there.
    const boxed = LANES.filter((l) => expectNotInlined(l)[0] > INLINED_MAX);
    // Typed per-class arithmetic (SPEC B-S3): frac / big / nan 3 x 9 families x 5 types = 135; nanhint 3 hinted families
    // x 5 = 15; fracnanhint 15; nanlit segmentHint only = 5 (lowerBoundHint / upperBoundHint nanlit stay unboxed); smi 0.
    const perClass = (c) => boxed.filter((l) => classOf(l) === c).length;
    assert.deepEqual([perClass('smi'), perClass('frac'), perClass('big'), perClass('nan'), perClass('nanhint'), perClass('nanlit'), perClass('fracnanhint')],
        [0, 45, 45, 45, 15, 5, 15]);
    assert.deepEqual(boxed.filter((l) => classOf(l) === 'nanlit').map(familyOf), Array(5).fill('segmentHint'));
    assert.equal(boxed.length, 170);
    assert.deepEqual(failing(checkWindows(laneRows(RUN_A.rows), LANES, expectNotInlined)), boxed, 'B floor 14.0 did not catch an unboxed lane');
    assert.deepEqual(failing(checkWindows(laneRows(RUN_B.rows), LANES, expectInlined)), boxed, 'A ceiling 1.0 did not catch a boxed lane');
});

test('control: NEON-R1 swap -- on 15 pairs (5 types x 3 hinted families) run B fracnanhint numbers fail the nanhint range and nanhint numbers fail the fracnanhint range (real rows, through judge)', () => {
    assert.ok(RUN_B && TIER_B, 'NO VERDICT: run B did not complete');
    const clone = (x) => JSON.parse(JSON.stringify(x));
    // per pair the fracnanhint lane carries one more box than its nanhint sibling (lower / upper 32 vs 16,
    // segmentHint 48 vs 32), so the two ranges are disjoint and a swap must fail both ways
    const fnh = LANES.filter((l) => classOf(l) === 'fracnanhint');
    const nh = fnh.map((l) => kernelOf(l) + '.nanhint');
    assert.equal(fnh.length, 15);
    assert.deepEqual([...new Set(fnh.map(familyOf))].sort(), ['lowerBoundHint', 'segmentHint', 'upperBoundHint']);
    for (const l of nh) assert.ok(LANES.includes(l), 'no nanhint sibling ' + l);
    for (let i = 0; i < fnh.length; i++) {
        const w2 = RUN_B.rows.find((r) => r.lane === fnh[i]).windows;
        const w1 = RUN_B.rows.find((r) => r.lane === nh[i]).windows;
        console.log('# C-swap B ' + fnh[i] + ' w0..' + (K - 1) + ' ' + w2.map(f2).join(' ') + ' [' + expectNotInlined(fnh[i]) + '] | ' +
            nh[i] + ' ' + w1.map(f2).join(' ') + ' [' + expectNotInlined(nh[i]) + ']');
    }
    // fracnanhint numbers judged as the nanhint lane: the fracnanhint rows' windows written into the nanhint rows
    const r1 = clone(RUN_B.rows);
    for (let i = 0; i < fnh.length; i++) r1.find((r) => r.lane === nh[i]).windows = clone(RUN_B.rows.find((r) => r.lane === fnh[i]).windows);
    const v1 = judge(r1, expectNotInlined, clone(TIER_B));
    assert.equal(v1.noVerdict, null);
    assert.deepEqual(v1.failing, [...nh].sort(), 'a nanhint range did not catch its fracnanhint reading');
    // nanhint numbers judged as the fracnanhint lane
    const r2 = clone(RUN_B.rows);
    for (let i = 0; i < fnh.length; i++) r2.find((r) => r.lane === fnh[i]).windows = clone(RUN_B.rows.find((r) => r.lane === nh[i]).windows);
    const v2 = judge(r2, expectNotInlined, clone(TIER_B));
    assert.equal(v2.noVerdict, null);
    assert.deepEqual(v2.failing, [...fnh].sort(), 'a fracnanhint range did not catch its nanhint reading');
    // the same through checkWindows with each pair's nanhint range forced on the real fracnanhint rows
    const nhRange = (l) => expectNotInlined(kernelOf(l) + '.nanhint');
    assert.deepEqual(failing(checkWindows(laneRows(RUN_B.rows).filter((r) => fnh.includes(r.lane)), fnh, nhRange)), [...fnh].sort());
});

test('control: segmentHint<T> run B ranges (SPEC B-S3), planted rows (runs without LiteUtils): a value just outside each range fails that row alone, just inside passes; the ranges are kernel-aware', () => {
    const row = (lane, w) => ({ lane, windows: w });
    const PLANT = [['nanhint', 28, 36], ['nanlit', 14, 18], ['fracnanhint', 44, 52]];   // typed literals (B-S3)
    const lanes = [];
    const span = {};
    for (const t of TYPE_NAMES) for (const [c, lo, hi] of PLANT) { const l = 'segmentHint' + t + '.' + c; lanes.push(l); span[l] = [lo, hi]; }
    lanes.sort();
    for (const l of lanes) assert.ok(LANES.includes(l), 'not in the roster: ' + l);
    const base = () => lanes.map((l) => row(l, Array(K).fill((span[l][0] + span[l][1]) / 2)));
    assert.deepEqual(failing(checkWindows(base(), lanes, expectNotInlined)), [], 'mid-range rows pass');
    let n = 0;
    for (const l of lanes) {
        const [lo, hi] = span[l];
        for (const [v, want] of [[lo - 0.01, [l]], [hi + 0.01, [l]], [lo, []], [hi, []]]) {
            for (let k = 1; k < K; k++) {
                const rows = base();
                rows.find((r) => r.lane === l).windows[k] = v;
                assert.deepEqual(failing(checkWindows(rows, lanes, expectNotInlined)), want, l + ' window ' + k + ' = ' + v);
                n++;
            }
        }
        const r0 = base(); r0.find((r) => r.lane === l).windows[0] = hi + 100;
        assert.deepEqual(failing(checkWindows(r0, lanes, expectNotInlined)), [], 'window 0 must not be read: ' + l);
    }
    console.log('# C-seghint planted ' + n + ' rows over ' + lanes.length + ' lanes');
    assert.equal(n, 300);
    // kernel-aware: the same reading is judged by the lane's family (lower / upper keep the class ranges)
    const one = (lane, v) => failing(checkWindows([row(lane, Array(K).fill(v))], [lane], expectNotInlined));
    for (const t of TYPE_NAMES) {
        for (const f of ['lowerBoundHint', 'upperBoundHint']) {
            assert.deepEqual(one(f + t + '.nanhint', 16), [], f + t + '.nanhint 16');
            assert.deepEqual(one(f + t + '.nanhint', 32), [f + t + '.nanhint']);
            assert.deepEqual(one(f + t + '.nanlit', 0), [], f + t + '.nanlit 0');
            assert.deepEqual(one(f + t + '.nanlit', 16), [f + t + '.nanlit']);
            assert.deepEqual(one(f + t + '.fracnanhint', 32), [], f + t + '.fracnanhint 32');
            assert.deepEqual(one(f + t + '.fracnanhint', 48), [f + t + '.fracnanhint']);
        }
        const s = 'segmentHint' + t;
        assert.deepEqual(one(s + '.nanhint', 16), [s + '.nanhint']);
        assert.deepEqual(one(s + '.nanlit', 0), [s + '.nanlit'], 'a segmentHint nanlit that reads no box fails');
        assert.deepEqual(one(s + '.fracnanhint', 32), [s + '.fracnanhint']);
        for (const c of CLASSES) assert.deepEqual(expectNotInlined(s + '.' + c), expectNotInlined('segment' + t + '.' + c), s + '.' + c + ' keeps the class range');
        for (const c of [...CLASSES, 'nanhint', 'nanlit', 'fracnanhint']) {
            assert.deepEqual(expectNotInlined('upperBoundHint' + t + '.' + c), expectNotInlined('lowerBoundHint' + t + '.' + c), 'upperBoundHint' + t + '.' + c);
        }
    }
    assert.deepEqual(expectNotInlined('segmentF64.nanlit'), [0, NANLIT_MAX], 'the segment family is not segmentHint');
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
    // NEON-R1 planted (runs without LiteUtils): 32 passes fracnanhint and fails nanhint; 16 the other way round
    assert.deepEqual(failing(checkWindows([row('x.fracnanhint', Array(K).fill(32))], ['x.fracnanhint'], expectNotInlined)), []);
    assert.deepEqual(failing(checkWindows([row('x.nanhint', Array(K).fill(32))], ['x.nanhint'], expectNotInlined)), ['x.nanhint']);
    assert.deepEqual(failing(checkWindows([row('x.fracnanhint', Array(K).fill(16))], ['x.fracnanhint'], expectNotInlined)), ['x.fracnanhint']);
    assert.deepEqual(failing(checkWindows([row('x.fracnanhint', [32, 32, 32, 32, 32, 36.01])], ['x.fracnanhint'], expectNotInlined)), ['x.fracnanhint']);
    assert.deepEqual(failing(checkWindows([row('x.fracnanhint', [32, 27.99, 32, 32, 32, 32])], ['x.fracnanhint'], expectNotInlined)), ['x.fracnanhint']);
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
    // neon-3: a negative window is not a clean harness; judge() is the verdict path, fed rows as the real path reads
    // them (JSON.parse of a serialized --json-like payload, LEDGER B6). -Infinity cannot arrive (JSON writes null).
    const payload = (hw) => JSON.parse(JSON.stringify({ n: N, windows: K, benches: [{ rows: [
        { lane: HARNESS, windows: hw }, ...LANES.map((l) => ({ lane: l, windows: Array(K).fill(0.3) }))] }] })).benches[0].rows;
    assert.deepEqual(judge(payload([0.3, 0.3, 0.3, 0.3, 0.3, 0.3]), expectInlined), { noVerdict: null, failing: [] }, 'clean payload');
    assert.deepEqual(judge(payload([0.3, 0, -0, 0.3, 1.0, 0.3]), expectInlined), { noVerdict: null, failing: [] }, '0, -0 and 1.0 are inside');
    assert.deepEqual(judge(payload([-0.5, 0.3, 0.3, 0.3, 0.3, 0.3]), expectInlined), { noVerdict: null, failing: [] }, 'window 0 is not read');
    for (const neg of [-0.5, -5, -0.01]) {
        for (let k = 1; k < K; k++) {
            const w = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
            w[k] = neg;
            const v = judge(payload(w), expectInlined);
            if (k === 1) console.log('# C-harness forced ' + neg + ' in window ' + k + ' (via JSON, judge): ' + v.noVerdict);
            assert.match(String(v.noVerdict), /^NO VERDICT \(harness-noisy\): empty lane window .* outside \[0, 1\] B\/op/, 'harness ' + neg + ' window ' + k);
        }
    }
    assert.equal(JSON.parse(JSON.stringify([-Infinity]))[0], null, '-Infinity arrives as null (already refused)');
    assert.match(String(judge(payload([0.3, 0.3, -Infinity, 0.3, 0.3, 0.3]), expectInlined).noVerdict), /^NO VERDICT \(harness-noisy\)/);
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
    assert.match(String(luVerdict(r)), /^NO VERDICT: no LiteUtils/);
    const c = runBounded(process.execPath, [LU_CLI, '--root', empty], { timeoutMs: 60000, env, cwd: PKG_ROOT });
    console.log('# C-nolu exit ' + c.status + ': ' + c.stdout.trim());
    assert.equal(c.status, 2);
    assert.match(c.stdout, /^NO VERDICT: no LiteUtils/);
    const bad = resolveTools({ root: empty, env: { LITE_UTILS_DIR: join(empty, 'nope') } });
    assert.match(String(luVerdict(bad)), /^NO VERDICT: LITE_UTILS_DIR is not a directory/);
});
