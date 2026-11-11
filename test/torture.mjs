// test/torture.mjs -- the lite-bisect torture gate (SPEC-p1 U4, assertion 7). Run via
// `npm run torture` (node --expose-gc --no-concurrent-recompilation --min-semi-space-size=1 --max-semi-space-size=1
// test/torture.mjs).
// Two phases, GC COUNTS only (the DETERMINISTIC tier): no timing threshold anywhere.
// Semi-space pin (AU-R5): the run REFUSES before any lane -- prints
// `torture: NO VERDICT -- run with --min-semi-space-size=1 --max-semi-space-size=1` and exits 2 -- unless
// process.execArgv holds both flags with exactly these values and NO other semi-space flag (V8 takes the LAST
// value of a repeated flag and reads '_' as '-': a later --max-semi-space-size=16 or --max_semi_space_size=16
// would override the pin and let a 16 B/op plant read minor 0). The refusal also covers one-dash spellings and
// --minor-ms (the AU-R5b class-3 refusal: its young GCs are a kind the profiler does not count). Pinned to 1 MB, a 16 B/op box over a
// 200,000-op lane (3.2 MB) must scavenge, so steady maxMinor 0 sees it; unpinned, new space grows and a
// 16 B/op plant passes (cross-opus, audit 2026-11-11). Exit codes: 0 ok, 1 FAIL, 2 NO VERDICT.
// --no-concurrent-recompilation (B3 finding, not refused here): with concurrent TurboFan jobs a loaded host
// leaves a lane in a non-inlining tier past its 20,000-op warm-up, the fractional / NaN queries box across
// the kernel call and the CLEAN build reads steady minor 1..8 (16 / 16 runs FAILED with 8 tortures in
// parallel; 16 / 16 passed with the flag, B3 2026-11-11). Synchronous tier-up makes the count deterministic.
//
// Phase 1, retention (@zakkster/lite-leak): 4096 cycles, each inside a lite-signal root. A
// cycle builds a sorted typed array (the oracle's TYPE_NAMES in turn), runs all 7 kernels of
// that type against the naive oracle (test/oracle.mjs; law 9), tracks the array, and disposes
// the root. After a forced GC + settle: tracker.size() <= 16, 0 audit findings, 0 leak reports,
// <= 16 of the 4096 arrays still reachable (WeakRef) -- the kernels retain none of the arrays --
// and exactly CYCLES x 5 queries x (oracle KERNELS families) checks ran (a roster family with
// no phase-1 check fails the count).
// Control: LITE_BISECT_TORTURE_LEAK=1 keeps every root (and array) alive: size() reads
// >= 4000 and the run exits 1.
//
// Phase 2, retention per op (@zakkster/lite-gc-profiler): one 200,000-op lane per kernel family
// x type, each a LITERAL per-type call site (LEDGER C3: one shared call site fed several array
// types goes megamorphic; the roster is NOT derived into one generic call site). A census
// checks the lanes against the oracle's roster, Object.keys(KERNELS) x TYPE_NAMES, both ways:
// a family x type with no lane (or two) fails. Per lane, in its own profiler window: a settled
// heap + arrayBuffers sample (two forced GCs) before and after, the steady loop in phase
// 'steady', the GC observer drained with settle() before summary() (GC entries arrive
// asynchronously). Gate per lane (laneOk): steady maxMajor 0 AND maxMinor 0 (AU-R5: any scavenge in the
// steady loop is an allocation per op), arrayBuffers growth 0, AND
// -1.0 < retained heap < 1.0 B/op (P1-R10, LEDGER B4) -- retained = settled heapUsed after minus
// before, / 200,000. That term is RETENTION, not allocation: a short-lived box dies before the
// settled sample and reads ~0 there; under the pin, steady maxMinor 0 is the term that sees it
// (the B/op number per lane is U6's lanes). Resolution: one 1 MB semi-space over 200,000 ops means the steady
// minor check only sees allocation of roughly >= 5 B/op; the per-op bar stays the U6 alloc gate's job.
// Controls, each MUST be flagged or the run FAILS:
//   CONTROL-alloc retains a 128 B Float64Array per op and runs one full GC mid-window: flagged
//   on BOTH GC channels (an arrayBuffers violation and a steady major).
//   CONTROL-retain retains one small on-heap object ({ lo, hi }) per op. It is the last row of
//   the lane loop, judged by the lanes' own verdict line with its GC channels taken as passing,
//   so the retained gate alone must trip it; its real GC channels are printed, not required.
//
// LITE_BISECT_TORTURE_MODULE=<abs path> runs the gate against another build (revert checks).
//
// Output: one LANE line per lane, a CONTROL line, then
//   GATE leak=size <n>/16 findings=<n> warnings=<n> | gc major=<n> minor=<n> maxMs=<n> | retained=<n> B/op | ok|FAIL
// (retained = the max over the kernel lanes; the controls are not in it).

import { GcProfiler, checkNoGc } from '@zakkster/lite-gc-profiler';
import {
    createLeakTracker,
    createOwnerCascadeOrphanKernel,
    createTimerOrphanKernel,
    createListenerOrphanKernel,
    createObserverOrphanKernel,
    createAsyncRetentionKernel,
} from '@zakkster/lite-leak';
import { createRoot, effect, createRegistry, setDefaultRegistry } from '@zakkster/lite-signal';
import { pathToFileURL } from 'node:url';
import { naiveLower, naiveUpper, naiveSegment, naiveNearest, makeRng, KERNELS, TYPE_NAMES } from './oracle.mjs';

// AU-R5: refuse before the build is imported and before any lane (exact flag values; fail closed).
const PIN_FLAGS = ['--min-semi-space-size=1', '--max-semi-space-size=1'];
const SEMI = process.execArgv.filter((f) => /^--?(min|max)[-_]semi[-_]space[-_]size/.test(f));
if (SEMI.length !== 2 || !PIN_FLAGS.every((f) => SEMI.includes(f)) || process.execArgv.some((f) => /^--?minor[-_]ms/.test(f))) {
    console.error('torture: NO VERDICT -- run with --min-semi-space-size=1 --max-semi-space-size=1');
    process.exit(2);
}

const MOD = process.env.LITE_BISECT_TORTURE_MODULE
    ? pathToFileURL(process.env.LITE_BISECT_TORTURE_MODULE).href
    : new URL('../Bisect.js', import.meta.url).href;
const B = await import(MOD);
const {
    lowerBoundBranchlessF64, upperBoundBranchlessF64, lowerBoundBranchyF64, upperBoundBranchyF64,
    lowerBoundHintF64, segmentF64, nearestF64,
    lowerBoundBranchlessF32, upperBoundBranchlessF32, lowerBoundBranchyF32, upperBoundBranchyF32,
    lowerBoundHintF32, segmentF32, nearestF32,
    lowerBoundBranchlessU32, upperBoundBranchlessU32, lowerBoundBranchyU32, upperBoundBranchyU32,
    lowerBoundHintU32, segmentU32, nearestU32,
    lowerBoundBranchlessU16, upperBoundBranchlessU16, lowerBoundBranchyU16, upperBoundBranchyU16,
    lowerBoundHintU16, segmentU16, nearestU16,
    lowerBoundBranchlessI32, upperBoundBranchlessI32, lowerBoundBranchyI32, upperBoundBranchyI32,
    lowerBoundHintI32, segmentI32, nearestI32,
} = B;

if (typeof globalThis.gc !== 'function') {
    console.error('torture: FAIL needs node --expose-gc (npm run torture)');
    process.exit(1);
}

const LEAK = process.env.LITE_BISECT_TORTURE_LEAK === '1';
const CYCLES = 4096;
const HOT = 200000;
const WARM = 20000;
const MAX_LIVE = 16;
const TYPES = TYPE_NAMES;               // the roster comes from the oracle, never a copy here
const KERN = Object.keys(KERNELS);
const P1_QUERIES = 5;                   // xs per phase-1 cycle (the literal list below)
const CTOR = { F64: Float64Array, F32: Float32Array, U32: Uint32Array, U16: Uint16Array, I32: Int32Array };
const BASE = { F64: -1000.25, F32: -1000.5, U32: 2147483000, U16: 100, I32: -2000 };
const fails = [];
for (const T of TYPES) {
    if (typeof CTOR[T] !== 'function' || typeof BASE[T] !== 'number') {
        console.error('torture: FAIL census: oracle type ' + T + ' has no CTOR / BASE here');
        process.exit(1);
    }
}

// A sorted array of type T, length n, ~30% duplicates, from rng.
function sortedArray(T, n, rnd) {
    const a = new CTOR[T](n);
    let v = BASE[T];
    for (let i = 0; i < n; i++) {
        if (rnd() < 0.7) v += 1 + ((rnd() * 3) | 0);
        a[i] = v;
    }
    for (let i = 1; i < n; i++) if (!(a[i - 1] <= a[i])) throw new Error('torture: unsorted ' + T);
    return a;
}

// ---- phase 1: retention --------------------------------------------------------------------
const leaks = [];
const warns = [];
let orphans = 0;
function onOrphan() { orphans++; }   // module scope: closes over no target (lite-leak contract)

const tracker = createLeakTracker({
    name: 'lite-bisect-torture',
    onLeak: (r) => leaks.push(r.kind + ':' + String(r.tag)),
    onWarning: (w) => warns.push(w.kind + ':' + w.reason),
});
tracker.registerKernel(createOwnerCascadeOrphanKernel());
tracker.registerKernel(createTimerOrphanKernel());
tracker.registerKernel(createListenerOrphanKernel());
tracker.registerKernel(createObserverOrphanKernel());
tracker.registerKernel(createAsyncRetentionKernel());

// The LEAK control keeps all 4096 roots alive: the default registry's 1024-node pool would throw
// CapacityError before size() could be read, so the torture owns a registry sized for it.
setDefaultRegistry(createRegistry({ maxNodes: 2 * CYCLES }));

const refs = [];
const leakSink = [];
let p1checks = 0;
const rnd1 = makeRng(4242);
for (let c = 0; c < CYCLES; c++) {
    const T = TYPES[c % TYPES.length];
    const dispose = createRoot(() => effect(() => {
        const n = 1 + (c & 63);
        const a = sortedArray(T, n, rnd1);
        const lo = (rnd1() * (n + 1)) | 0;
        const hi = lo + ((rnd1() * (n - lo + 1)) | 0);
        const xs = [a[(rnd1() * n) | 0], a[(rnd1() * n) | 0] + 0.5, -1e12, 1e12, NaN];
        for (const x of xs) {
            const wl = naiveLower(a, lo, hi, x);
            const got = [
                ['lowerBoundBranchless', B['lowerBoundBranchless' + T](a, lo, hi, x), wl],
                ['upperBoundBranchless', B['upperBoundBranchless' + T](a, lo, hi, x), naiveUpper(a, lo, hi, x)],
                ['lowerBoundBranchy', B['lowerBoundBranchy' + T](a, lo, hi, x), wl],
                ['upperBoundBranchy', B['upperBoundBranchy' + T](a, lo, hi, x), naiveUpper(a, lo, hi, x)],
                ['lowerBoundHint', B['lowerBoundHint' + T](a, lo, hi, x, lo + ((rnd1() * (hi - lo + 1)) | 0)), wl],
                ['segment', B['segment' + T](a, lo, hi, x), naiveSegment(a, lo, hi, x)],
                ['nearest', B['nearest' + T](a, lo, hi, x), naiveNearest(a, lo, hi, x)],
            ];
            for (const [k, g, w] of got) {
                p1checks++;
                if (g !== w && fails.length < 8) {
                    fails.push('phase1 ' + k + T + ' n=' + n + ' [' + lo + ',' + hi + ') x=' + x +
                        ' got ' + g + ' want ' + w);
                }
            }
        }
        refs.push(new WeakRef(a));
        tracker.track(a, onOrphan, 'bisect-array:' + T, { audit: true });
        if (LEAK) leakSink.push(a);
    }));
    if (LEAK) leakSink.push(dispose);
    else dispose();
}

globalThis.gc();
await new Promise((r) => setTimeout(r, 50));
globalThis.gc();
await new Promise((r) => setTimeout(r, 50));

const live = tracker.size();
const findings = tracker.audit();
let alive = 0;
for (const w of refs) if (w.deref() !== undefined) alive++;

// ---- phase 2: allocation lanes ---------------------------------------------------------------
const N = 4096, QN = 1024, QM = QN - 1;
const rnd2 = makeRng(9001);
const A = {}, Q = {}, H = {};
for (const T of TYPES) {
    const a = sortedArray(T, N, rnd2);
    const q = new Float64Array(QN), h = new Int32Array(QN);
    for (let i = 0; i < QN; i++) {
        const j = (rnd2() * N) | 0, m = i & 7;
        // exact values, fractional between values, outside the range, and NaN (lanes 0..7)
        q[i] = m < 3 ? a[j] : m < 6 ? a[j] + 0.5 : m === 6 ? (i & 8 ? -1e12 : 1e12) : NaN;
        // integer hints (LEDGER B3: never a non-integer h) near the answer, some far / outside
        h[i] = m < 6 ? j + ((rnd2() * 9) | 0) - 4 : m === 6 ? -3 : N + 3;
    }
    A[T] = a; Q[T] = q; H[T] = h;
}
const aF64 = A.F64, aF32 = A.F32, aU32 = A.U32, aU16 = A.U16, aI32 = A.I32;
const qF64 = Q.F64, qF32 = Q.F32, qU32 = Q.U32, qU16 = Q.U16, qI32 = Q.I32;
const hF64 = H.F64, hF32 = H.F32, hU32 = H.U32, hU16 = H.U16, hI32 = H.I32;
const acc = new Int32Array(1);   // result sink: keeps every call live, holds no number in a closure

const LANES = [
    ['lowerBoundBranchlessF64', (i) => { acc[0] ^= lowerBoundBranchlessF64(aF64, 0, N, qF64[i & QM]); }],
    ['upperBoundBranchlessF64', (i) => { acc[0] ^= upperBoundBranchlessF64(aF64, 0, N, qF64[i & QM]); }],
    ['lowerBoundBranchyF64', (i) => { acc[0] ^= lowerBoundBranchyF64(aF64, 0, N, qF64[i & QM]); }],
    ['upperBoundBranchyF64', (i) => { acc[0] ^= upperBoundBranchyF64(aF64, 0, N, qF64[i & QM]); }],
    ['lowerBoundHintF64', (i) => { acc[0] ^= lowerBoundHintF64(aF64, 0, N, qF64[i & QM], hF64[i & QM]); }],
    ['segmentF64', (i) => { acc[0] ^= segmentF64(aF64, 0, N, qF64[i & QM]); }],
    ['nearestF64', (i) => { acc[0] ^= nearestF64(aF64, 0, N, qF64[i & QM]); }],
    ['lowerBoundBranchlessF32', (i) => { acc[0] ^= lowerBoundBranchlessF32(aF32, 0, N, qF32[i & QM]); }],
    ['upperBoundBranchlessF32', (i) => { acc[0] ^= upperBoundBranchlessF32(aF32, 0, N, qF32[i & QM]); }],
    ['lowerBoundBranchyF32', (i) => { acc[0] ^= lowerBoundBranchyF32(aF32, 0, N, qF32[i & QM]); }],
    ['upperBoundBranchyF32', (i) => { acc[0] ^= upperBoundBranchyF32(aF32, 0, N, qF32[i & QM]); }],
    ['lowerBoundHintF32', (i) => { acc[0] ^= lowerBoundHintF32(aF32, 0, N, qF32[i & QM], hF32[i & QM]); }],
    ['segmentF32', (i) => { acc[0] ^= segmentF32(aF32, 0, N, qF32[i & QM]); }],
    ['nearestF32', (i) => { acc[0] ^= nearestF32(aF32, 0, N, qF32[i & QM]); }],
    ['lowerBoundBranchlessU32', (i) => { acc[0] ^= lowerBoundBranchlessU32(aU32, 0, N, qU32[i & QM]); }],
    ['upperBoundBranchlessU32', (i) => { acc[0] ^= upperBoundBranchlessU32(aU32, 0, N, qU32[i & QM]); }],
    ['lowerBoundBranchyU32', (i) => { acc[0] ^= lowerBoundBranchyU32(aU32, 0, N, qU32[i & QM]); }],
    ['upperBoundBranchyU32', (i) => { acc[0] ^= upperBoundBranchyU32(aU32, 0, N, qU32[i & QM]); }],
    ['lowerBoundHintU32', (i) => { acc[0] ^= lowerBoundHintU32(aU32, 0, N, qU32[i & QM], hU32[i & QM]); }],
    ['segmentU32', (i) => { acc[0] ^= segmentU32(aU32, 0, N, qU32[i & QM]); }],
    ['nearestU32', (i) => { acc[0] ^= nearestU32(aU32, 0, N, qU32[i & QM]); }],
    ['lowerBoundBranchlessU16', (i) => { acc[0] ^= lowerBoundBranchlessU16(aU16, 0, N, qU16[i & QM]); }],
    ['upperBoundBranchlessU16', (i) => { acc[0] ^= upperBoundBranchlessU16(aU16, 0, N, qU16[i & QM]); }],
    ['lowerBoundBranchyU16', (i) => { acc[0] ^= lowerBoundBranchyU16(aU16, 0, N, qU16[i & QM]); }],
    ['upperBoundBranchyU16', (i) => { acc[0] ^= upperBoundBranchyU16(aU16, 0, N, qU16[i & QM]); }],
    ['lowerBoundHintU16', (i) => { acc[0] ^= lowerBoundHintU16(aU16, 0, N, qU16[i & QM], hU16[i & QM]); }],
    ['segmentU16', (i) => { acc[0] ^= segmentU16(aU16, 0, N, qU16[i & QM]); }],
    ['nearestU16', (i) => { acc[0] ^= nearestU16(aU16, 0, N, qU16[i & QM]); }],
    ['lowerBoundBranchlessI32', (i) => { acc[0] ^= lowerBoundBranchlessI32(aI32, 0, N, qI32[i & QM]); }],
    ['upperBoundBranchlessI32', (i) => { acc[0] ^= upperBoundBranchlessI32(aI32, 0, N, qI32[i & QM]); }],
    ['lowerBoundBranchyI32', (i) => { acc[0] ^= lowerBoundBranchyI32(aI32, 0, N, qI32[i & QM]); }],
    ['upperBoundBranchyI32', (i) => { acc[0] ^= upperBoundBranchyI32(aI32, 0, N, qI32[i & QM]); }],
    ['lowerBoundHintI32', (i) => { acc[0] ^= lowerBoundHintI32(aI32, 0, N, qI32[i & QM], hI32[i & QM]); }],
    ['segmentI32', (i) => { acc[0] ^= segmentI32(aI32, 0, N, qI32[i & QM]); }],
    ['nearestI32', (i) => { acc[0] ^= nearestI32(aI32, 0, N, qI32[i & QM]); }],
];
// Census, both ways: one lane per oracle family x type (each a function of this build), and no
// lane outside that roster.
for (const k of KERN) for (const T of TYPES) {
    if (typeof B[k + T] !== 'function') fails.push('census: ' + k + T + ' missing from the module');
    if (LANES.filter((l) => l[0] === k + T).length !== 1) fails.push('census: lane ' + k + T + ' not exactly once');
}
if (LANES.length !== KERN.length * TYPES.length) {
    fails.push('census: ' + LANES.length + ' lanes for a roster of ' + KERN.length + ' x ' + TYPES.length);
}

const ctlSink = [];
const CTL_GC_AT = HOT >>> 1;
const CONTROL = ['CONTROL-alloc', (i) => {
    ctlSink.push(new Float64Array(16));   // 128 B off-heap backing store, retained: arrayBuffers grows
    // One full GC mid-window: the deterministic major. Retained on-heap garbage reaches a major only
    // when V8's old-space heuristics say so (a revert-check run saw 0), so it cannot be a control.
    if (i === CTL_GC_AT) globalThis.gc();
    acc[0] ^= lowerBoundBranchlessF64(aF64, 0, N, qF64[i & QM]);
}];
const retainSink = [];
const RETAIN = ['CONTROL-retain', (i) => {
    retainSink.push({ lo: i, hi: i });   // one small on-heap object per op, retained to the end
    acc[0] ^= lowerBoundBranchlessF64(aF64, 0, N, qF64[i & QM]);
}];

function drive(fn, n) { for (let i = 0; i < n; i++) fn(i); }

// One lane in its own profiler window. Returns { s, report, bpo }.
async function measureLane(fn) {
    drive(fn, WARM);
    const gc = new GcProfiler(1024).start();
    gc.phase('pre');
    gc.forceSettle();
    const m0 = process.memoryUsage();
    gc.sampleHeap(performance.now(), m0.heapUsed, m0);
    gc.phase('steady');
    drive(fn, HOT);
    gc.phase('post');
    gc.forceSettle();
    const m1 = process.memoryUsage();
    gc.sampleHeap(performance.now(), m1.heapUsed, m1);
    const st = await gc.settle();
    const s = gc.summary();
    gc.stop();
    const report = checkNoGc(s, { maxArrayBuffersGrowth: 0, phases: { steady: { maxMajor: 0, maxMinor: 0 } } });
    if (!st || st.drained === false) report.ok = false;
    return { s, report, bpo: (m1.heapUsed - m0.heapUsed) / HOT };
}

// The GC channels of one lane: steady major 0, arrayBuffers growth 0, settled, observer drained.
function gcPass(m) { return m.report.ok && m.report.verdict === 'pass' && m.s.arrayBuffers.settled === true; }
// THE lane verdict: the GC channels AND the retained gate (P1-R10): -1.0 < retained < 1.0 B/op.
// A NaN fails both compares; the -1.0 floor fails a window that freed > 200 KB of older heap
// (it would hide retention) instead of passing it.
function laneOk(gcOk, bpo) { return gcOk && bpo < 1.0 && bpo > -1.0; }

// The retain control runs through the SAME loop and the same verdict line as the kernel lanes
// (mustTrip = true: its GC channels are taken as passing, so only the retained gate can trip
// it). A lane verdict that drops the retained term leaves the control un-flagged: the run FAILS.
let sumMajor = 0, sumMinor = 0, maxMs = 0, maxBpo = -Infinity, minBpo = Infinity, lanesOk = 0;
let retFlagged = false;
for (const [name, fn, mustTrip] of LANES.concat([[RETAIN[0], RETAIN[1], true]])) {
    const m = await measureLane(fn);
    const { s, report, bpo } = m;
    const sg = s.phases.steady.gc;
    const ok = laneOk(mustTrip === true || gcPass(m), bpo);
    if (mustTrip === true) {
        retFlagged = !ok && bpo >= 1.0;   // the ceiling tripped it, never the floor; NaN fails
        const retMetrics = report.violations.map((v) => v.metric).join(',');
        console.log('CONTROL retain lane retained=' + bpo.toFixed(3) + ' B/op major=' + sg.major +
            ' minor=' + sg.minor + ' abGrowth=' + s.arrayBuffers.growthBytes +
            ' gcChannels=' + (gcPass(m) ? 'pass' : 'flagged(' + retMetrics + ')') + ' ' +
            (retFlagged ? 'flagged by retained (expected)' : 'NOT FLAGGED by retained: the gate is open'));
        if (!retFlagged) fails.push('control retain lane not flagged by the retained gate');
        retainSink.length = 0;
        continue;
    }
    sumMajor += sg.major; sumMinor += sg.minor;
    if (sg.maxMs > maxMs) maxMs = sg.maxMs;
    if (bpo > maxBpo) maxBpo = bpo;       // a NaN bpo fails its own lane in laneOk
    if (bpo < minBpo) minBpo = bpo;
    if (ok) lanesOk++;
    else fails.push('lane ' + name + ' verdict=' + report.verdict + ' retained=' + bpo.toFixed(3) + ' B/op ' +
        report.violations.map((v) => v.metric + '=' + v.actual).join(','));
    console.log('LANE ' + name + ' major=' + sg.major + ' minor=' + sg.minor + ' abGrowth=' +
        s.arrayBuffers.growthBytes + ' settled=' + s.arrayBuffers.settled + ' retainedB/op=' + bpo.toFixed(3) +
        ' ' + (ok ? 'ok' : 'FAIL'));
}

const ctl = await measureLane(CONTROL[1]);
// Flagged on BOTH channels, each by its own violation: the arrayBuffers growth AND the steady major.
const ctlMetrics = ctl.report.violations.map((v) => v.metric).join(',');
const ctlFlagged = !ctl.report.ok && ctl.report.verdict === 'fail' && /arrayBuffers/.test(ctlMetrics) &&
    ctl.s.phases.steady.gc.major > 0 && /major/i.test(ctlMetrics);
console.log('CONTROL alloc lane major=' + ctl.s.phases.steady.gc.major + ' minor=' + ctl.s.phases.steady.gc.minor +
    ' abGrowth=' + ctl.s.arrayBuffers.growthBytes + ' verdict=' + ctl.report.verdict + ' violations=' + ctlMetrics + ' ' +
    (ctlFlagged ? 'flagged (expected)' : 'NOT FLAGGED: the gate is open'));
if (!ctlFlagged) fails.push('control alloc lane not flagged');
ctlSink.length = 0;

const ok = fails.length === 0 && ctlFlagged && lanesOk === LANES.length && live <= MAX_LIVE &&
    alive <= MAX_LIVE && findings.length === 0 && leaks.length === 0 &&
    p1checks === CYCLES * P1_QUERIES * KERN.length && retFlagged;
console.log('PHASE1 cycles=' + CYCLES + ' checks=' + p1checks + '/' + (CYCLES * P1_QUERIES * KERN.length) + ' size=' + live + ' alive=' + alive +
    ' orphans=' + orphans + ' leaks=' + leaks.length + (LEAK ? ' (LITE_BISECT_TORTURE_LEAK=1 control)' : ''));
console.log('PHASE2 lanes=' + lanesOk + '/' + LANES.length + ' ops/lane=' + HOT + ' retained B/op min=' +
    minBpo.toFixed(3) + ' max=' + maxBpo.toFixed(3) + ' acc=' + acc[0]);
console.log(
    'GATE leak=size ' + live + '/' + MAX_LIVE + ' findings=' + findings.length +
    ' warnings=' + warns.length +
    ' | gc major=' + sumMajor + ' minor=' + sumMinor + ' maxMs=' + maxMs.toFixed(2) +
    ' | retained=' + maxBpo.toFixed(3) + ' B/op' +
    ' | ' + (ok ? 'ok' : 'FAIL'));
if (!ok) {
    for (const f of fails) console.error('  ' + f);
    for (const f of findings) console.error('  finding ' + f.kind + ':' + f.reason);
    for (const l of leaks.slice(0, 8)) console.error('  leak ' + l);
    if (live > MAX_LIVE) console.error('  tracker.size() ' + live + ' > ' + MAX_LIVE);
    if (alive > MAX_LIVE) console.error('  ' + alive + ' arrays still reachable > ' + MAX_LIVE);
    if (p1checks !== CYCLES * P1_QUERIES * KERN.length) {
        console.error('  phase1 checks ' + p1checks + ' != ' + CYCLES + ' x ' + P1_QUERIES + ' x ' + KERN.length);
    }
    process.exitCode = 1;
}
