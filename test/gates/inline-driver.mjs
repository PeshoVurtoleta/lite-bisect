// test/gates/inline-driver.mjs -- U5 TurboFan inline pin driver (SPEC-p1 U5, assertion 8).
// Spawned by test/Bisect.inline.test.mjs, never imported. Run as:
//   node --allow-natives-syntax --no-concurrent-recompilation --trace-turbo-inlining \
//        test/gates/inline-driver.mjs [--never-opt <caller>] [--no-inline <kernel>] [--chan3]
// One caller LITERAL per kernel x type (LEDGER C3: no shared call site, no factory), each fed
// only its own typed array type. Each caller is warmed in the interpreter, then forced into
// TurboFan with %PrepareFunctionForOptimization / %OptimizeFunctionOnNextCall; with
// --no-concurrent-recompilation the compile (and its --trace-turbo-inlining lines) happens
// inside that one call. The driver prints facts only; the verdict is the test's:
//   REF on=<forced TurboFan ref status> off=<never-optimized ref> maglev=<forced Maglev ref>
//   ROW <caller> status=<%GetOptimizationStatus>
//   DONE rows=<n>   (45 call_ + 10 call2_ = 55; + 5 call3_ = 60 under --chan3)
// 1.1 seghint (SPEC seghint-1.1 B2 / B-S4): call_upperBoundHint<T>(a, x, h) and call_segmentHint<T>(a, x, s)
// join the per-type lists (s walks -1 .. N-1, h walks 0 .. N). call2_<family><T>(a, b, k) is the C13
// two-channel caller in feedback form: channel c keeps its hint in its own Int32Array slot
// (H_<caller>[c] = kernel(..., H_<caller>[c])), the fractional x is read from a Float64Array (QX<T> /
// QY<T>), and channel 2 searches a second array (DATA2). call3_segmentHint<T>(a, b, c, k) adds a third
// channel (QZ<T>, DATA3) and runs only under --chan3 (the c3 control: 2 of 3 inner lines on v26.8.2).
// Markers go through fs.writeSync(1); V8's trace lines go through C stdio, so the two streams
// may interleave out of order: the test matches trace lines by NAME (callee and caller SFI
// names are unique per row), never by position.
// Controls (the test's revert checks): --never-opt <caller> plants a caller that never reaches
// TurboFan; that caller gets neither %PrepareFunctionForOptimization nor %OptimizeFunctionOnNextCall
// (same warm loop, same final call): V8 12.4 / 13.6 (node 22 / 24) abort with
// "Check failed: v8_flags.fuzzing" (SIGTRAP) on either call after %NeverOptimizeFunction, V8 14
// ignores it (P3-R9, CI-TRIAGE class 1). --no-inline <kernel> plants a kernel that cannot inline
// (%NeverOptimizeFunction disables optimization of the SFI, which V8's inlining heuristic refuses).

import { writeSync } from 'node:fs';
import {
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
    upperBoundHintF64, segmentHintF64, upperBoundHintF32, segmentHintF32, upperBoundHintU32, segmentHintU32,
    upperBoundHintU16, segmentHintU16, upperBoundHintI32, segmentHintI32,
} from '../../Bisect.js';

const out = (s) => { writeSync(1, s + '\n'); };

const REQUIRED_FLAGS = ['--allow-natives-syntax', '--no-concurrent-recompilation', '--trace-turbo-inlining'];
for (const f of REQUIRED_FLAGS) {
    if (!process.execArgv.includes(f)) {
        out('NOVERDICT missing node flag ' + f);
        process.exit(2);
    }
}

// ---- callers: one literal per kernel x type ---------------------------------------------
function call_lowerBoundBranchlessF64(a, x) { return lowerBoundBranchlessF64(a, 0, a.length, x); }
function call_upperBoundBranchlessF64(a, x) { return upperBoundBranchlessF64(a, 0, a.length, x); }
function call_lowerBoundBranchyF64(a, x) { return lowerBoundBranchyF64(a, 0, a.length, x); }
function call_upperBoundBranchyF64(a, x) { return upperBoundBranchyF64(a, 0, a.length, x); }
function call_lowerBoundHintF64(a, x, h) { return lowerBoundHintF64(a, 0, a.length, x, h); }
function call_segmentF64(a, x) { return segmentF64(a, 0, a.length, x); }
function call_nearestF64(a, x) { return nearestF64(a, 0, a.length, x); }
function call_upperBoundHintF64(a, x, h) { return upperBoundHintF64(a, 0, a.length, x, h); }
function call_segmentHintF64(a, x, s) { return segmentHintF64(a, 0, a.length, x, s); }

function call_lowerBoundBranchlessF32(a, x) { return lowerBoundBranchlessF32(a, 0, a.length, x); }
function call_upperBoundBranchlessF32(a, x) { return upperBoundBranchlessF32(a, 0, a.length, x); }
function call_lowerBoundBranchyF32(a, x) { return lowerBoundBranchyF32(a, 0, a.length, x); }
function call_upperBoundBranchyF32(a, x) { return upperBoundBranchyF32(a, 0, a.length, x); }
function call_lowerBoundHintF32(a, x, h) { return lowerBoundHintF32(a, 0, a.length, x, h); }
function call_segmentF32(a, x) { return segmentF32(a, 0, a.length, x); }
function call_nearestF32(a, x) { return nearestF32(a, 0, a.length, x); }
function call_upperBoundHintF32(a, x, h) { return upperBoundHintF32(a, 0, a.length, x, h); }
function call_segmentHintF32(a, x, s) { return segmentHintF32(a, 0, a.length, x, s); }

function call_lowerBoundBranchlessU32(a, x) { return lowerBoundBranchlessU32(a, 0, a.length, x); }
function call_upperBoundBranchlessU32(a, x) { return upperBoundBranchlessU32(a, 0, a.length, x); }
function call_lowerBoundBranchyU32(a, x) { return lowerBoundBranchyU32(a, 0, a.length, x); }
function call_upperBoundBranchyU32(a, x) { return upperBoundBranchyU32(a, 0, a.length, x); }
function call_lowerBoundHintU32(a, x, h) { return lowerBoundHintU32(a, 0, a.length, x, h); }
function call_segmentU32(a, x) { return segmentU32(a, 0, a.length, x); }
function call_nearestU32(a, x) { return nearestU32(a, 0, a.length, x); }
function call_upperBoundHintU32(a, x, h) { return upperBoundHintU32(a, 0, a.length, x, h); }
function call_segmentHintU32(a, x, s) { return segmentHintU32(a, 0, a.length, x, s); }

function call_lowerBoundBranchlessU16(a, x) { return lowerBoundBranchlessU16(a, 0, a.length, x); }
function call_upperBoundBranchlessU16(a, x) { return upperBoundBranchlessU16(a, 0, a.length, x); }
function call_lowerBoundBranchyU16(a, x) { return lowerBoundBranchyU16(a, 0, a.length, x); }
function call_upperBoundBranchyU16(a, x) { return upperBoundBranchyU16(a, 0, a.length, x); }
function call_lowerBoundHintU16(a, x, h) { return lowerBoundHintU16(a, 0, a.length, x, h); }
function call_segmentU16(a, x) { return segmentU16(a, 0, a.length, x); }
function call_nearestU16(a, x) { return nearestU16(a, 0, a.length, x); }
function call_upperBoundHintU16(a, x, h) { return upperBoundHintU16(a, 0, a.length, x, h); }
function call_segmentHintU16(a, x, s) { return segmentHintU16(a, 0, a.length, x, s); }

function call_lowerBoundBranchlessI32(a, x) { return lowerBoundBranchlessI32(a, 0, a.length, x); }
function call_upperBoundBranchlessI32(a, x) { return upperBoundBranchlessI32(a, 0, a.length, x); }
function call_lowerBoundBranchyI32(a, x) { return lowerBoundBranchyI32(a, 0, a.length, x); }
function call_upperBoundBranchyI32(a, x) { return upperBoundBranchyI32(a, 0, a.length, x); }
function call_lowerBoundHintI32(a, x, h) { return lowerBoundHintI32(a, 0, a.length, x, h); }
function call_segmentI32(a, x) { return segmentI32(a, 0, a.length, x); }
function call_nearestI32(a, x) { return nearestI32(a, 0, a.length, x); }
function call_upperBoundHintI32(a, x, h) { return upperBoundHintI32(a, 0, a.length, x, h); }
function call_segmentHintI32(a, x, s) { return segmentHintI32(a, 0, a.length, x, s); }

const CALLERS = {
    F64: [call_lowerBoundBranchlessF64, call_upperBoundBranchlessF64, call_lowerBoundBranchyF64,
        call_upperBoundBranchyF64, call_lowerBoundHintF64, call_segmentF64, call_nearestF64,
        call_upperBoundHintF64, call_segmentHintF64],
    F32: [call_lowerBoundBranchlessF32, call_upperBoundBranchlessF32, call_lowerBoundBranchyF32,
        call_upperBoundBranchyF32, call_lowerBoundHintF32, call_segmentF32, call_nearestF32,
        call_upperBoundHintF32, call_segmentHintF32],
    U32: [call_lowerBoundBranchlessU32, call_upperBoundBranchlessU32, call_lowerBoundBranchyU32,
        call_upperBoundBranchyU32, call_lowerBoundHintU32, call_segmentU32, call_nearestU32,
        call_upperBoundHintU32, call_segmentHintU32],
    U16: [call_lowerBoundBranchlessU16, call_upperBoundBranchlessU16, call_lowerBoundBranchyU16,
        call_upperBoundBranchyU16, call_lowerBoundHintU16, call_segmentU16, call_nearestU16,
        call_upperBoundHintU16, call_segmentHintU16],
    I32: [call_lowerBoundBranchlessI32, call_upperBoundBranchlessI32, call_lowerBoundBranchyI32,
        call_upperBoundBranchyI32, call_lowerBoundHintI32, call_segmentI32, call_nearestI32,
        call_upperBoundHintI32, call_segmentHintI32],
};
const KERNELS = {
    F64: [lowerBoundBranchlessF64, upperBoundBranchlessF64, lowerBoundBranchyF64, upperBoundBranchyF64,
        lowerBoundHintF64, segmentF64, nearestF64, upperBoundHintF64, segmentHintF64],
    F32: [lowerBoundBranchlessF32, upperBoundBranchlessF32, lowerBoundBranchyF32, upperBoundBranchyF32,
        lowerBoundHintF32, segmentF32, nearestF32, upperBoundHintF32, segmentHintF32],
    U32: [lowerBoundBranchlessU32, upperBoundBranchlessU32, lowerBoundBranchyU32, upperBoundBranchyU32,
        lowerBoundHintU32, segmentU32, nearestU32, upperBoundHintU32, segmentHintU32],
    U16: [lowerBoundBranchlessU16, upperBoundBranchlessU16, lowerBoundBranchyU16, upperBoundBranchyU16,
        lowerBoundHintU16, segmentU16, nearestU16, upperBoundHintU16, segmentHintU16],
    I32: [lowerBoundBranchlessI32, upperBoundBranchlessI32, lowerBoundBranchyI32, upperBoundBranchyI32,
        lowerBoundHintI32, segmentI32, nearestI32, upperBoundHintI32, segmentHintI32],
};

// ---- per-type data: N sorted values with duplicates, Q queries below / inside / above ------
const N = 64;
const Q = 16;
const DATA = {
    F64: new Float64Array(N), F32: new Float32Array(N), U32: new Uint32Array(N),
    U16: new Uint16Array(N), I32: new Int32Array(N),
};
const QUERIES = {
    F64: new Float64Array(Q), F32: new Float64Array(Q), U32: new Float64Array(Q),
    U16: new Float64Array(Q), I32: new Float64Array(Q),
};
const BASE = { F64: -20.25, F32: -20.25, U32: 3000000000, U16: 100, I32: -1000 };
const STEP = { F64: 0.75, F32: 0.75, U32: 7, U16: 3, I32: 5 };
for (const t of Object.keys(DATA)) {
    const a = DATA[t];
    for (let i = 0; i < N; i++) a[i] = BASE[t] + STEP[t] * (i - (i % 3 === 2 ? 1 : 0)); // ~1/3 duplicates
    const q = QUERIES[t];
    for (let k = 0; k < Q; k++) q[k] = BASE[t] + STEP[t] * (k * (N + 4) / (Q - 1) - 2) + STEP[t] / 2;
}

// ---- channel-2 / channel-3 arrays and fractional query streams (Float64Array), B-S4 ------------
const DATA2 = {
    F64: new Float64Array(N), F32: new Float32Array(N), U32: new Uint32Array(N),
    U16: new Uint16Array(N), I32: new Int32Array(N),
};
const DATA3 = {
    F64: new Float64Array(N), F32: new Float32Array(N), U32: new Uint32Array(N),
    U16: new Uint16Array(N), I32: new Int32Array(N),
};
const QY = {};
const QZ = {};
for (const t of Object.keys(DATA)) {
    for (let i = 0; i < N; i++) {
        DATA2[t][i] = BASE[t] + STEP[t] * (i + 1 - (i % 4 === 3 ? 1 : 0));
        DATA3[t][i] = BASE[t] + STEP[t] * (i + 2 - (i % 5 === 4 ? 1 : 0));
    }
    QY[t] = new Float64Array(Q);
    QZ[t] = new Float64Array(Q);
    for (let k = 0; k < Q; k++) {
        QY[t][k] = QUERIES[t][(k * 7) % Q] + STEP[t] / 4;
        QZ[t][k] = QUERIES[t][(k * 11) % Q] - STEP[t] / 4;
    }
    for (let k = 0; k < Q; k++) {
        if (Number.isInteger(QUERIES[t][k]) || Number.isInteger(QY[t][k]) || Number.isInteger(QZ[t][k])) {
            out('NOVERDICT non-fractional query ' + t + ' ' + k);
            process.exit(2);
        }
    }
}
const QXF64 = QUERIES.F64;
const QYF64 = QY.F64;
const QZF64 = QZ.F64;
const QXF32 = QUERIES.F32;
const QYF32 = QY.F32;
const QZF32 = QZ.F32;
const QXU32 = QUERIES.U32;
const QYU32 = QY.U32;
const QZU32 = QZ.U32;
const QXU16 = QUERIES.U16;
const QYU16 = QY.U16;
const QZU16 = QZ.U16;
const QXI32 = QUERIES.I32;
const QYI32 = QY.I32;
const QZI32 = QZ.I32;

// ---- two-channel callers (C13 pin, B-S4) and three-channel callers (c3 control, --chan3) ------
const H_call2_upperBoundHintF64 = new Int32Array(2);
function call2_upperBoundHintF64(a, b, k) {
    const r0 = upperBoundHintF64(a, 0, a.length, QXF64[k], H_call2_upperBoundHintF64[0]); H_call2_upperBoundHintF64[0] = r0;
    const r1 = upperBoundHintF64(b, 0, b.length, QYF64[k], H_call2_upperBoundHintF64[1]); H_call2_upperBoundHintF64[1] = r1;
    return (r0 + r1) | 0;
}
const H_call2_segmentHintF64 = new Int32Array(2);
function call2_segmentHintF64(a, b, k) {
    const r0 = segmentHintF64(a, 0, a.length, QXF64[k], H_call2_segmentHintF64[0]); H_call2_segmentHintF64[0] = r0;
    const r1 = segmentHintF64(b, 0, b.length, QYF64[k], H_call2_segmentHintF64[1]); H_call2_segmentHintF64[1] = r1;
    return (r0 + r1) | 0;
}
const H_call3_segmentHintF64 = new Int32Array(3);
function call3_segmentHintF64(a, b, c, k) {
    const r0 = segmentHintF64(a, 0, a.length, QXF64[k], H_call3_segmentHintF64[0]); H_call3_segmentHintF64[0] = r0;
    const r1 = segmentHintF64(b, 0, b.length, QYF64[k], H_call3_segmentHintF64[1]); H_call3_segmentHintF64[1] = r1;
    const r2 = segmentHintF64(c, 0, c.length, QZF64[k], H_call3_segmentHintF64[2]); H_call3_segmentHintF64[2] = r2;
    return (r0 + r1 + r2) | 0;
}
const H_call2_upperBoundHintF32 = new Int32Array(2);
function call2_upperBoundHintF32(a, b, k) {
    const r0 = upperBoundHintF32(a, 0, a.length, QXF32[k], H_call2_upperBoundHintF32[0]); H_call2_upperBoundHintF32[0] = r0;
    const r1 = upperBoundHintF32(b, 0, b.length, QYF32[k], H_call2_upperBoundHintF32[1]); H_call2_upperBoundHintF32[1] = r1;
    return (r0 + r1) | 0;
}
const H_call2_segmentHintF32 = new Int32Array(2);
function call2_segmentHintF32(a, b, k) {
    const r0 = segmentHintF32(a, 0, a.length, QXF32[k], H_call2_segmentHintF32[0]); H_call2_segmentHintF32[0] = r0;
    const r1 = segmentHintF32(b, 0, b.length, QYF32[k], H_call2_segmentHintF32[1]); H_call2_segmentHintF32[1] = r1;
    return (r0 + r1) | 0;
}
const H_call3_segmentHintF32 = new Int32Array(3);
function call3_segmentHintF32(a, b, c, k) {
    const r0 = segmentHintF32(a, 0, a.length, QXF32[k], H_call3_segmentHintF32[0]); H_call3_segmentHintF32[0] = r0;
    const r1 = segmentHintF32(b, 0, b.length, QYF32[k], H_call3_segmentHintF32[1]); H_call3_segmentHintF32[1] = r1;
    const r2 = segmentHintF32(c, 0, c.length, QZF32[k], H_call3_segmentHintF32[2]); H_call3_segmentHintF32[2] = r2;
    return (r0 + r1 + r2) | 0;
}
const H_call2_upperBoundHintU32 = new Int32Array(2);
function call2_upperBoundHintU32(a, b, k) {
    const r0 = upperBoundHintU32(a, 0, a.length, QXU32[k], H_call2_upperBoundHintU32[0]); H_call2_upperBoundHintU32[0] = r0;
    const r1 = upperBoundHintU32(b, 0, b.length, QYU32[k], H_call2_upperBoundHintU32[1]); H_call2_upperBoundHintU32[1] = r1;
    return (r0 + r1) | 0;
}
const H_call2_segmentHintU32 = new Int32Array(2);
function call2_segmentHintU32(a, b, k) {
    const r0 = segmentHintU32(a, 0, a.length, QXU32[k], H_call2_segmentHintU32[0]); H_call2_segmentHintU32[0] = r0;
    const r1 = segmentHintU32(b, 0, b.length, QYU32[k], H_call2_segmentHintU32[1]); H_call2_segmentHintU32[1] = r1;
    return (r0 + r1) | 0;
}
const H_call3_segmentHintU32 = new Int32Array(3);
function call3_segmentHintU32(a, b, c, k) {
    const r0 = segmentHintU32(a, 0, a.length, QXU32[k], H_call3_segmentHintU32[0]); H_call3_segmentHintU32[0] = r0;
    const r1 = segmentHintU32(b, 0, b.length, QYU32[k], H_call3_segmentHintU32[1]); H_call3_segmentHintU32[1] = r1;
    const r2 = segmentHintU32(c, 0, c.length, QZU32[k], H_call3_segmentHintU32[2]); H_call3_segmentHintU32[2] = r2;
    return (r0 + r1 + r2) | 0;
}
const H_call2_upperBoundHintU16 = new Int32Array(2);
function call2_upperBoundHintU16(a, b, k) {
    const r0 = upperBoundHintU16(a, 0, a.length, QXU16[k], H_call2_upperBoundHintU16[0]); H_call2_upperBoundHintU16[0] = r0;
    const r1 = upperBoundHintU16(b, 0, b.length, QYU16[k], H_call2_upperBoundHintU16[1]); H_call2_upperBoundHintU16[1] = r1;
    return (r0 + r1) | 0;
}
const H_call2_segmentHintU16 = new Int32Array(2);
function call2_segmentHintU16(a, b, k) {
    const r0 = segmentHintU16(a, 0, a.length, QXU16[k], H_call2_segmentHintU16[0]); H_call2_segmentHintU16[0] = r0;
    const r1 = segmentHintU16(b, 0, b.length, QYU16[k], H_call2_segmentHintU16[1]); H_call2_segmentHintU16[1] = r1;
    return (r0 + r1) | 0;
}
const H_call3_segmentHintU16 = new Int32Array(3);
function call3_segmentHintU16(a, b, c, k) {
    const r0 = segmentHintU16(a, 0, a.length, QXU16[k], H_call3_segmentHintU16[0]); H_call3_segmentHintU16[0] = r0;
    const r1 = segmentHintU16(b, 0, b.length, QYU16[k], H_call3_segmentHintU16[1]); H_call3_segmentHintU16[1] = r1;
    const r2 = segmentHintU16(c, 0, c.length, QZU16[k], H_call3_segmentHintU16[2]); H_call3_segmentHintU16[2] = r2;
    return (r0 + r1 + r2) | 0;
}
const H_call2_upperBoundHintI32 = new Int32Array(2);
function call2_upperBoundHintI32(a, b, k) {
    const r0 = upperBoundHintI32(a, 0, a.length, QXI32[k], H_call2_upperBoundHintI32[0]); H_call2_upperBoundHintI32[0] = r0;
    const r1 = upperBoundHintI32(b, 0, b.length, QYI32[k], H_call2_upperBoundHintI32[1]); H_call2_upperBoundHintI32[1] = r1;
    return (r0 + r1) | 0;
}
const H_call2_segmentHintI32 = new Int32Array(2);
function call2_segmentHintI32(a, b, k) {
    const r0 = segmentHintI32(a, 0, a.length, QXI32[k], H_call2_segmentHintI32[0]); H_call2_segmentHintI32[0] = r0;
    const r1 = segmentHintI32(b, 0, b.length, QYI32[k], H_call2_segmentHintI32[1]); H_call2_segmentHintI32[1] = r1;
    return (r0 + r1) | 0;
}
const H_call3_segmentHintI32 = new Int32Array(3);
function call3_segmentHintI32(a, b, c, k) {
    const r0 = segmentHintI32(a, 0, a.length, QXI32[k], H_call3_segmentHintI32[0]); H_call3_segmentHintI32[0] = r0;
    const r1 = segmentHintI32(b, 0, b.length, QYI32[k], H_call3_segmentHintI32[1]); H_call3_segmentHintI32[1] = r1;
    const r2 = segmentHintI32(c, 0, c.length, QZI32[k], H_call3_segmentHintI32[2]); H_call3_segmentHintI32[2] = r2;
    return (r0 + r1 + r2) | 0;
}
const CALLERS2 = {
    F64: [call2_upperBoundHintF64, call2_segmentHintF64],
    F32: [call2_upperBoundHintF32, call2_segmentHintF32],
    U32: [call2_upperBoundHintU32, call2_segmentHintU32],
    U16: [call2_upperBoundHintU16, call2_segmentHintU16],
    I32: [call2_upperBoundHintI32, call2_segmentHintI32],
};
const HSLOT2 = {
    F64: [H_call2_upperBoundHintF64, H_call2_segmentHintF64],
    F32: [H_call2_upperBoundHintF32, H_call2_segmentHintF32],
    U32: [H_call2_upperBoundHintU32, H_call2_segmentHintU32],
    U16: [H_call2_upperBoundHintU16, H_call2_segmentHintU16],
    I32: [H_call2_upperBoundHintI32, H_call2_segmentHintI32],
};
const CALLERS3 = {
    F64: [call3_segmentHintF64],
    F32: [call3_segmentHintF32],
    U32: [call3_segmentHintU32],
    U16: [call3_segmentHintU16],
    I32: [call3_segmentHintI32],
};
const HSLOT3 = {
    F64: [H_call3_segmentHintF64],
    F32: [H_call3_segmentHintF32],
    U32: [H_call3_segmentHintU32],
    U16: [H_call3_segmentHintU16],
    I32: [H_call3_segmentHintI32],
};

// ---- argv controls ------------------------------------------------------------------------
let neverOpt = null;
let noInline = null;
let chan3 = false;
for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--never-opt') neverOpt = process.argv[++i];
    else if (arg === '--no-inline') noInline = process.argv[++i];
    else if (arg === '--chan3') chan3 = true;
    else { out('NOVERDICT unknown argument ' + arg); process.exit(2); }
}

// ---- reference: calibrate the TurboFan bits in THIS process --------------------------------
// The %GetOptimizationStatus bit layout moves between V8 versions (v26.8.2 / V8 14.6: a forced
// TurboFan fn reads 41 = 1 | 8 | 32), so the driver hard-codes no bit: it prints three reference
// statuses and the test derives the TurboFan mask as on & ~off, then requires the Maglev reference
// NOT to carry the whole mask (TurboFan distinguishable from Maglev) -- else NO VERDICT.
function refOn(x) { return x * 3 + 1; }
function refOff(x) { return x * 3 + 1; }
function refMaglev(x) { return x * 3 + 1; }
%NeverOptimizeFunction(refOff);
%PrepareFunctionForOptimization(refOn);
%PrepareFunctionForOptimization(refMaglev);
for (let i = 0; i < 64; i++) { refOn(i); refOff(i); refMaglev(i); }
%OptimizeFunctionOnNextCall(refOn);
%OptimizeMaglevOnNextCall(refMaglev);
refOn(1);
refOff(1);
refMaglev(1);
out('REF on=' + %GetOptimizationStatus(refOn) + ' off=' + %GetOptimizationStatus(refOff) +
    ' maglev=' + %GetOptimizationStatus(refMaglev));

// ---- rows ---------------------------------------------------------------------------------
const WARM = 12; // passes over the Q queries in the interpreter before the forced compile
let rows = 0;
let sink = 0;
for (const t of Object.keys(CALLERS)) {
    const a = DATA[t];
    const q = QUERIES[t];
    const callers = CALLERS[t];
    const kernels = KERNELS[t];
    for (let r = 0; r < callers.length; r++) {
        const fn = callers[r];
        const name = fn.name;
        const off = name.startsWith('call_segmentHint') ? -1 : 0; // s = h - 1: -1 .. N-1
        if (noInline !== null && kernels[r].name === noInline) %NeverOptimizeFunction(kernels[r]);
        if (neverOpt === name) %NeverOptimizeFunction(fn);
        if (neverOpt !== name) %PrepareFunctionForOptimization(fn);
        for (let w = 0; w < WARM; w++) {
            for (let k = 0; k < Q; k++) {
                // h walks the whole [0, N] range so the hint takes both gallops and both inner sites
                sink += fn(a, q[k], ((k * 5 + w * 7) % (N + 1)) + off);
            }
        }
        if (neverOpt !== name) %OptimizeFunctionOnNextCall(fn);
        sink += fn(a, q[3], off);
        out('ROW ' + name + ' status=' + %GetOptimizationStatus(fn));
        rows++;
    }
}

// ---- two-channel rows, then three-channel rows (--chan3): hints start at "no hint" ----------
for (const t of Object.keys(CALLERS2)) {
    const a = DATA[t];
    const b = DATA2[t];
    for (let r = 0; r < CALLERS2[t].length; r++) {
        const fn = CALLERS2[t][r];
        const name = fn.name;
        const hs = HSLOT2[t][r];
        const init = name.startsWith('call2_segmentHint') ? -1 : 0;
        hs[0] = init;
        hs[1] = init;
        if (neverOpt === name) %NeverOptimizeFunction(fn);
        if (neverOpt !== name) %PrepareFunctionForOptimization(fn);
        for (let w = 0; w < WARM; w++) for (let k = 0; k < Q; k++) sink += fn(a, b, k);
        if (neverOpt !== name) %OptimizeFunctionOnNextCall(fn);
        sink += fn(a, b, 3);
        out('ROW ' + name + ' status=' + %GetOptimizationStatus(fn));
        rows++;
    }
}
if (chan3) {
    for (const t of Object.keys(CALLERS3)) {
        const a = DATA[t];
        const b = DATA2[t];
        const c = DATA3[t];
        for (let r = 0; r < CALLERS3[t].length; r++) {
            const fn = CALLERS3[t][r];
            const name = fn.name;
            const hs = HSLOT3[t][r];
            hs[0] = -1;
            hs[1] = -1;
            hs[2] = -1;
            if (neverOpt === name) %NeverOptimizeFunction(fn);
            if (neverOpt !== name) %PrepareFunctionForOptimization(fn);
            for (let w = 0; w < WARM; w++) for (let k = 0; k < Q; k++) sink += fn(a, b, c, k);
            if (neverOpt !== name) %OptimizeFunctionOnNextCall(fn);
            sink += fn(a, b, c, 3);
            out('ROW ' + name + ' status=' + %GetOptimizationStatus(fn));
            rows++;
        }
    }
}
out('DONE rows=' + rows + ' sink=' + sink);
