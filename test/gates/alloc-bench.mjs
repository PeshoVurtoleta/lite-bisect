// test/gates/alloc-bench.mjs -- U6 alloc gate BENCH for LiteUtils alloc-per-op.mjs (SPEC-p1 U6, assertion 9).
// Never imported by npm test; test/gates/alloc.test.mjs runs it as:
//   node --expose-gc --no-concurrent-recompilation [--no-turbo-inlining --no-maglev-inlining --allow-natives-syntax] \
//        <LiteUtils>/alloc-per-op.mjs --n 1000000 --windows 6 --warm W --json test/gates/alloc-bench.mjs
// Lanes: one per kernel x type x query class, <kernel><T>.<class>. Every lane is a LITERAL arrow with its
// own call site (LEDGER C3: one shared call site, or closures of one literal, share one feedback vector and
// go megamorphic across array types), and each lane feeds its kernel only its own typed array type.
// The roster is literal; census(classes) derives the expected names from oracle.mjs KERNELS x TYPE_NAMES x
// the caller's class list, so the test fails on a missing or extra lane (LEDGER law 9: the expected value never comes
// from the thing it checks).
// Query classes (LEDGER C2): smi = integer doubles in the Smi range, frac = smi + 0.5, big = integer
// doubles >= 2^31 (not a Smi on Node's 32-bit Smi), nan = NaN. Every query is read from a Float64Array, so
// the value stays a float64 in optimized code until it crosses a call V8 does not inline.
// Hint classes (AU-R3, R-NANHINT-BOX), lowerBoundHint<T> only, Smi query (the smi class's queries):
// nanhint = h read per op from a Float64Array filled with NaN (a non-Smi number across the call: one 16 B box
// when the kernel is not inlined), nanlit = h is the literal NaN (a constant: no box in any tier). The test
// names these extra classes itself and passes them to census().
// State is allocated at import; a lane writes its Smi result to an Int32Array slot and allocates nothing.
// Tier check (LEDGER law 8), only when LITE_BISECT_TIER_FILE names a file (needs --allow-natives-syntax):
// at process exit the bench writes JSON { execArgv, ref: { on, off, maglev }, lanes: { name: status },
// kernels: { name: status } } (%GetOptimizationStatus; the TurboFan bits are calibrated in this process
// against forced reference fns, as in inline-driver.mjs). Control knob: LITE_BISECT_NEVER_OPT_LANE=<lane>
// plants %NeverOptimizeFunction on that lane (the tier check must then refuse it).
// Harness lane (P1-R12): 'harness.empty' is (i) => {}, measured in the same tool invocation with the same
// flags; the test makes the whole run NO VERDICT (harness-noisy) if it reads > 1.0 B/op in any window 1..5.

import { writeFileSync } from 'node:fs';
import { KERNELS, TYPE_NAMES } from '../oracle.mjs';
import * as B from '../../Bisect.js';
import {
    lowerBoundBranchlessF64, upperBoundBranchlessF64, lowerBoundBranchyF64, upperBoundBranchyF64, lowerBoundHintF64, segmentF64, nearestF64,
    lowerBoundBranchlessF32, upperBoundBranchlessF32, lowerBoundBranchyF32, upperBoundBranchyF32, lowerBoundHintF32, segmentF32, nearestF32,
    lowerBoundBranchlessU32, upperBoundBranchlessU32, lowerBoundBranchyU32, upperBoundBranchyU32, lowerBoundHintU32, segmentU32, nearestU32,
    lowerBoundBranchlessU16, upperBoundBranchlessU16, lowerBoundBranchyU16, upperBoundBranchyU16, lowerBoundHintU16, segmentU16, nearestU16,
    lowerBoundBranchlessI32, upperBoundBranchlessI32, lowerBoundBranchyI32, upperBoundBranchyI32, lowerBoundHintI32, segmentI32, nearestI32,
} from '../../Bisect.js';

const LEN = 1024;
const QLEN = 1024;
const QMASK = QLEN - 1;
const TWO31 = 2147483648;

// ---- data: one sorted array per type, ~1/3 duplicates ---------------------------------------
const A_F64 = new Float64Array(LEN);
const A_F32 = new Float32Array(LEN);
const A_U32 = new Uint32Array(LEN);
const A_U16 = new Uint16Array(LEN);
const A_I32 = new Int32Array(LEN);
for (let i = 0; i < LEN; i++) {
    const k = i - (i % 3 === 2 ? 1 : 0);
    A_F64[i] = -500 + 0.75 * k;
    A_F32[i] = -500 + 0.75 * k;
    A_U32[i] = k * 4194304;            // 0 .. 4.29e9, half the range above 2^31
    A_U16[i] = k * 64;
    A_I32[i] = -1073741824 + k * 2097152;
}

// ---- queries: per type and class, Float64Array; hints: Int32Array ---------------------------
const QS_F64 = new Float64Array(QLEN), QF_F64 = new Float64Array(QLEN), QB_F64 = new Float64Array(QLEN), QN_F64 = new Float64Array(QLEN);
const QS_F32 = new Float64Array(QLEN), QF_F32 = new Float64Array(QLEN), QB_F32 = new Float64Array(QLEN), QN_F32 = new Float64Array(QLEN);
const QS_U32 = new Float64Array(QLEN), QF_U32 = new Float64Array(QLEN), QB_U32 = new Float64Array(QLEN), QN_U32 = new Float64Array(QLEN);
const QS_U16 = new Float64Array(QLEN), QF_U16 = new Float64Array(QLEN), QB_U16 = new Float64Array(QLEN), QN_U16 = new Float64Array(QLEN);
const QS_I32 = new Float64Array(QLEN), QF_I32 = new Float64Array(QLEN), QB_I32 = new Float64Array(QLEN), QN_I32 = new Float64Array(QLEN);
const H = new Int32Array(QLEN);
const HN = new Float64Array(QLEN).fill(NaN);   // nanhint: a NaN hint read from a typed array (AU-R3)
const OUT = new Int32Array(1);

const Q = {
    F64: [QS_F64, QF_F64, QB_F64, QN_F64, A_F64], F32: [QS_F32, QF_F32, QB_F32, QN_F32, A_F32],
    U32: [QS_U32, QF_U32, QB_U32, QN_U32, A_U32], U16: [QS_U16, QF_U16, QB_U16, QN_U16, A_U16],
    I32: [QS_I32, QF_I32, QB_I32, QN_I32, A_I32],
};
let seed = 0x9e3779b9;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
for (const t of Object.keys(Q)) {
    const [qs, qf, qb, qn, a] = Q[t];
    const lo = a[0] - 8, hi = Math.min(a[LEN - 1] + 8, TWO31 - 2);
    for (let j = 0; j < QLEN; j++) {
        const s = Math.floor(lo + rnd() * (hi - lo));   // integer, inside the Smi range
        qs[j] = s;
        qf[j] = s + 0.5;
        qb[j] = TWO31 + Math.floor(rnd() * TWO31);    // integer, 2^31 .. 2^32 - 1
        qn[j] = NaN;
    }
}
for (let j = 0; j < QLEN; j++) H[j] = Math.floor(rnd() * (LEN + 1));   // integer hint in [0, LEN]

// ---- lanes: literal, one call site each -----------------------------------------------------
export const lanes = {
    'harness.empty': (i) => {},
    'lowerBoundBranchlessF64.smi': (i) => { OUT[0] = lowerBoundBranchlessF64(A_F64, 0, LEN, QS_F64[i & QMASK]); },
    'lowerBoundBranchlessF64.frac': (i) => { OUT[0] = lowerBoundBranchlessF64(A_F64, 0, LEN, QF_F64[i & QMASK]); },
    'lowerBoundBranchlessF64.big': (i) => { OUT[0] = lowerBoundBranchlessF64(A_F64, 0, LEN, QB_F64[i & QMASK]); },
    'lowerBoundBranchlessF64.nan': (i) => { OUT[0] = lowerBoundBranchlessF64(A_F64, 0, LEN, QN_F64[i & QMASK]); },
    'upperBoundBranchlessF64.smi': (i) => { OUT[0] = upperBoundBranchlessF64(A_F64, 0, LEN, QS_F64[i & QMASK]); },
    'upperBoundBranchlessF64.frac': (i) => { OUT[0] = upperBoundBranchlessF64(A_F64, 0, LEN, QF_F64[i & QMASK]); },
    'upperBoundBranchlessF64.big': (i) => { OUT[0] = upperBoundBranchlessF64(A_F64, 0, LEN, QB_F64[i & QMASK]); },
    'upperBoundBranchlessF64.nan': (i) => { OUT[0] = upperBoundBranchlessF64(A_F64, 0, LEN, QN_F64[i & QMASK]); },
    'lowerBoundBranchyF64.smi': (i) => { OUT[0] = lowerBoundBranchyF64(A_F64, 0, LEN, QS_F64[i & QMASK]); },
    'lowerBoundBranchyF64.frac': (i) => { OUT[0] = lowerBoundBranchyF64(A_F64, 0, LEN, QF_F64[i & QMASK]); },
    'lowerBoundBranchyF64.big': (i) => { OUT[0] = lowerBoundBranchyF64(A_F64, 0, LEN, QB_F64[i & QMASK]); },
    'lowerBoundBranchyF64.nan': (i) => { OUT[0] = lowerBoundBranchyF64(A_F64, 0, LEN, QN_F64[i & QMASK]); },
    'upperBoundBranchyF64.smi': (i) => { OUT[0] = upperBoundBranchyF64(A_F64, 0, LEN, QS_F64[i & QMASK]); },
    'upperBoundBranchyF64.frac': (i) => { OUT[0] = upperBoundBranchyF64(A_F64, 0, LEN, QF_F64[i & QMASK]); },
    'upperBoundBranchyF64.big': (i) => { OUT[0] = upperBoundBranchyF64(A_F64, 0, LEN, QB_F64[i & QMASK]); },
    'upperBoundBranchyF64.nan': (i) => { OUT[0] = upperBoundBranchyF64(A_F64, 0, LEN, QN_F64[i & QMASK]); },
    'lowerBoundHintF64.smi': (i) => { OUT[0] = lowerBoundHintF64(A_F64, 0, LEN, QS_F64[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintF64.frac': (i) => { OUT[0] = lowerBoundHintF64(A_F64, 0, LEN, QF_F64[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintF64.big': (i) => { OUT[0] = lowerBoundHintF64(A_F64, 0, LEN, QB_F64[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintF64.nan': (i) => { OUT[0] = lowerBoundHintF64(A_F64, 0, LEN, QN_F64[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintF64.nanhint': (i) => { OUT[0] = lowerBoundHintF64(A_F64, 0, LEN, QS_F64[i & QMASK], HN[i & QMASK]); },
    'lowerBoundHintF64.nanlit': (i) => { OUT[0] = lowerBoundHintF64(A_F64, 0, LEN, QS_F64[i & QMASK], NaN); },
    'segmentF64.smi': (i) => { OUT[0] = segmentF64(A_F64, 0, LEN, QS_F64[i & QMASK]); },
    'segmentF64.frac': (i) => { OUT[0] = segmentF64(A_F64, 0, LEN, QF_F64[i & QMASK]); },
    'segmentF64.big': (i) => { OUT[0] = segmentF64(A_F64, 0, LEN, QB_F64[i & QMASK]); },
    'segmentF64.nan': (i) => { OUT[0] = segmentF64(A_F64, 0, LEN, QN_F64[i & QMASK]); },
    'nearestF64.smi': (i) => { OUT[0] = nearestF64(A_F64, 0, LEN, QS_F64[i & QMASK]); },
    'nearestF64.frac': (i) => { OUT[0] = nearestF64(A_F64, 0, LEN, QF_F64[i & QMASK]); },
    'nearestF64.big': (i) => { OUT[0] = nearestF64(A_F64, 0, LEN, QB_F64[i & QMASK]); },
    'nearestF64.nan': (i) => { OUT[0] = nearestF64(A_F64, 0, LEN, QN_F64[i & QMASK]); },
    'lowerBoundBranchlessF32.smi': (i) => { OUT[0] = lowerBoundBranchlessF32(A_F32, 0, LEN, QS_F32[i & QMASK]); },
    'lowerBoundBranchlessF32.frac': (i) => { OUT[0] = lowerBoundBranchlessF32(A_F32, 0, LEN, QF_F32[i & QMASK]); },
    'lowerBoundBranchlessF32.big': (i) => { OUT[0] = lowerBoundBranchlessF32(A_F32, 0, LEN, QB_F32[i & QMASK]); },
    'lowerBoundBranchlessF32.nan': (i) => { OUT[0] = lowerBoundBranchlessF32(A_F32, 0, LEN, QN_F32[i & QMASK]); },
    'upperBoundBranchlessF32.smi': (i) => { OUT[0] = upperBoundBranchlessF32(A_F32, 0, LEN, QS_F32[i & QMASK]); },
    'upperBoundBranchlessF32.frac': (i) => { OUT[0] = upperBoundBranchlessF32(A_F32, 0, LEN, QF_F32[i & QMASK]); },
    'upperBoundBranchlessF32.big': (i) => { OUT[0] = upperBoundBranchlessF32(A_F32, 0, LEN, QB_F32[i & QMASK]); },
    'upperBoundBranchlessF32.nan': (i) => { OUT[0] = upperBoundBranchlessF32(A_F32, 0, LEN, QN_F32[i & QMASK]); },
    'lowerBoundBranchyF32.smi': (i) => { OUT[0] = lowerBoundBranchyF32(A_F32, 0, LEN, QS_F32[i & QMASK]); },
    'lowerBoundBranchyF32.frac': (i) => { OUT[0] = lowerBoundBranchyF32(A_F32, 0, LEN, QF_F32[i & QMASK]); },
    'lowerBoundBranchyF32.big': (i) => { OUT[0] = lowerBoundBranchyF32(A_F32, 0, LEN, QB_F32[i & QMASK]); },
    'lowerBoundBranchyF32.nan': (i) => { OUT[0] = lowerBoundBranchyF32(A_F32, 0, LEN, QN_F32[i & QMASK]); },
    'upperBoundBranchyF32.smi': (i) => { OUT[0] = upperBoundBranchyF32(A_F32, 0, LEN, QS_F32[i & QMASK]); },
    'upperBoundBranchyF32.frac': (i) => { OUT[0] = upperBoundBranchyF32(A_F32, 0, LEN, QF_F32[i & QMASK]); },
    'upperBoundBranchyF32.big': (i) => { OUT[0] = upperBoundBranchyF32(A_F32, 0, LEN, QB_F32[i & QMASK]); },
    'upperBoundBranchyF32.nan': (i) => { OUT[0] = upperBoundBranchyF32(A_F32, 0, LEN, QN_F32[i & QMASK]); },
    'lowerBoundHintF32.smi': (i) => { OUT[0] = lowerBoundHintF32(A_F32, 0, LEN, QS_F32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintF32.frac': (i) => { OUT[0] = lowerBoundHintF32(A_F32, 0, LEN, QF_F32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintF32.big': (i) => { OUT[0] = lowerBoundHintF32(A_F32, 0, LEN, QB_F32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintF32.nan': (i) => { OUT[0] = lowerBoundHintF32(A_F32, 0, LEN, QN_F32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintF32.nanhint': (i) => { OUT[0] = lowerBoundHintF32(A_F32, 0, LEN, QS_F32[i & QMASK], HN[i & QMASK]); },
    'lowerBoundHintF32.nanlit': (i) => { OUT[0] = lowerBoundHintF32(A_F32, 0, LEN, QS_F32[i & QMASK], NaN); },
    'segmentF32.smi': (i) => { OUT[0] = segmentF32(A_F32, 0, LEN, QS_F32[i & QMASK]); },
    'segmentF32.frac': (i) => { OUT[0] = segmentF32(A_F32, 0, LEN, QF_F32[i & QMASK]); },
    'segmentF32.big': (i) => { OUT[0] = segmentF32(A_F32, 0, LEN, QB_F32[i & QMASK]); },
    'segmentF32.nan': (i) => { OUT[0] = segmentF32(A_F32, 0, LEN, QN_F32[i & QMASK]); },
    'nearestF32.smi': (i) => { OUT[0] = nearestF32(A_F32, 0, LEN, QS_F32[i & QMASK]); },
    'nearestF32.frac': (i) => { OUT[0] = nearestF32(A_F32, 0, LEN, QF_F32[i & QMASK]); },
    'nearestF32.big': (i) => { OUT[0] = nearestF32(A_F32, 0, LEN, QB_F32[i & QMASK]); },
    'nearestF32.nan': (i) => { OUT[0] = nearestF32(A_F32, 0, LEN, QN_F32[i & QMASK]); },
    'lowerBoundBranchlessU32.smi': (i) => { OUT[0] = lowerBoundBranchlessU32(A_U32, 0, LEN, QS_U32[i & QMASK]); },
    'lowerBoundBranchlessU32.frac': (i) => { OUT[0] = lowerBoundBranchlessU32(A_U32, 0, LEN, QF_U32[i & QMASK]); },
    'lowerBoundBranchlessU32.big': (i) => { OUT[0] = lowerBoundBranchlessU32(A_U32, 0, LEN, QB_U32[i & QMASK]); },
    'lowerBoundBranchlessU32.nan': (i) => { OUT[0] = lowerBoundBranchlessU32(A_U32, 0, LEN, QN_U32[i & QMASK]); },
    'upperBoundBranchlessU32.smi': (i) => { OUT[0] = upperBoundBranchlessU32(A_U32, 0, LEN, QS_U32[i & QMASK]); },
    'upperBoundBranchlessU32.frac': (i) => { OUT[0] = upperBoundBranchlessU32(A_U32, 0, LEN, QF_U32[i & QMASK]); },
    'upperBoundBranchlessU32.big': (i) => { OUT[0] = upperBoundBranchlessU32(A_U32, 0, LEN, QB_U32[i & QMASK]); },
    'upperBoundBranchlessU32.nan': (i) => { OUT[0] = upperBoundBranchlessU32(A_U32, 0, LEN, QN_U32[i & QMASK]); },
    'lowerBoundBranchyU32.smi': (i) => { OUT[0] = lowerBoundBranchyU32(A_U32, 0, LEN, QS_U32[i & QMASK]); },
    'lowerBoundBranchyU32.frac': (i) => { OUT[0] = lowerBoundBranchyU32(A_U32, 0, LEN, QF_U32[i & QMASK]); },
    'lowerBoundBranchyU32.big': (i) => { OUT[0] = lowerBoundBranchyU32(A_U32, 0, LEN, QB_U32[i & QMASK]); },
    'lowerBoundBranchyU32.nan': (i) => { OUT[0] = lowerBoundBranchyU32(A_U32, 0, LEN, QN_U32[i & QMASK]); },
    'upperBoundBranchyU32.smi': (i) => { OUT[0] = upperBoundBranchyU32(A_U32, 0, LEN, QS_U32[i & QMASK]); },
    'upperBoundBranchyU32.frac': (i) => { OUT[0] = upperBoundBranchyU32(A_U32, 0, LEN, QF_U32[i & QMASK]); },
    'upperBoundBranchyU32.big': (i) => { OUT[0] = upperBoundBranchyU32(A_U32, 0, LEN, QB_U32[i & QMASK]); },
    'upperBoundBranchyU32.nan': (i) => { OUT[0] = upperBoundBranchyU32(A_U32, 0, LEN, QN_U32[i & QMASK]); },
    'lowerBoundHintU32.smi': (i) => { OUT[0] = lowerBoundHintU32(A_U32, 0, LEN, QS_U32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintU32.frac': (i) => { OUT[0] = lowerBoundHintU32(A_U32, 0, LEN, QF_U32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintU32.big': (i) => { OUT[0] = lowerBoundHintU32(A_U32, 0, LEN, QB_U32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintU32.nan': (i) => { OUT[0] = lowerBoundHintU32(A_U32, 0, LEN, QN_U32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintU32.nanhint': (i) => { OUT[0] = lowerBoundHintU32(A_U32, 0, LEN, QS_U32[i & QMASK], HN[i & QMASK]); },
    'lowerBoundHintU32.nanlit': (i) => { OUT[0] = lowerBoundHintU32(A_U32, 0, LEN, QS_U32[i & QMASK], NaN); },
    'segmentU32.smi': (i) => { OUT[0] = segmentU32(A_U32, 0, LEN, QS_U32[i & QMASK]); },
    'segmentU32.frac': (i) => { OUT[0] = segmentU32(A_U32, 0, LEN, QF_U32[i & QMASK]); },
    'segmentU32.big': (i) => { OUT[0] = segmentU32(A_U32, 0, LEN, QB_U32[i & QMASK]); },
    'segmentU32.nan': (i) => { OUT[0] = segmentU32(A_U32, 0, LEN, QN_U32[i & QMASK]); },
    'nearestU32.smi': (i) => { OUT[0] = nearestU32(A_U32, 0, LEN, QS_U32[i & QMASK]); },
    'nearestU32.frac': (i) => { OUT[0] = nearestU32(A_U32, 0, LEN, QF_U32[i & QMASK]); },
    'nearestU32.big': (i) => { OUT[0] = nearestU32(A_U32, 0, LEN, QB_U32[i & QMASK]); },
    'nearestU32.nan': (i) => { OUT[0] = nearestU32(A_U32, 0, LEN, QN_U32[i & QMASK]); },
    'lowerBoundBranchlessU16.smi': (i) => { OUT[0] = lowerBoundBranchlessU16(A_U16, 0, LEN, QS_U16[i & QMASK]); },
    'lowerBoundBranchlessU16.frac': (i) => { OUT[0] = lowerBoundBranchlessU16(A_U16, 0, LEN, QF_U16[i & QMASK]); },
    'lowerBoundBranchlessU16.big': (i) => { OUT[0] = lowerBoundBranchlessU16(A_U16, 0, LEN, QB_U16[i & QMASK]); },
    'lowerBoundBranchlessU16.nan': (i) => { OUT[0] = lowerBoundBranchlessU16(A_U16, 0, LEN, QN_U16[i & QMASK]); },
    'upperBoundBranchlessU16.smi': (i) => { OUT[0] = upperBoundBranchlessU16(A_U16, 0, LEN, QS_U16[i & QMASK]); },
    'upperBoundBranchlessU16.frac': (i) => { OUT[0] = upperBoundBranchlessU16(A_U16, 0, LEN, QF_U16[i & QMASK]); },
    'upperBoundBranchlessU16.big': (i) => { OUT[0] = upperBoundBranchlessU16(A_U16, 0, LEN, QB_U16[i & QMASK]); },
    'upperBoundBranchlessU16.nan': (i) => { OUT[0] = upperBoundBranchlessU16(A_U16, 0, LEN, QN_U16[i & QMASK]); },
    'lowerBoundBranchyU16.smi': (i) => { OUT[0] = lowerBoundBranchyU16(A_U16, 0, LEN, QS_U16[i & QMASK]); },
    'lowerBoundBranchyU16.frac': (i) => { OUT[0] = lowerBoundBranchyU16(A_U16, 0, LEN, QF_U16[i & QMASK]); },
    'lowerBoundBranchyU16.big': (i) => { OUT[0] = lowerBoundBranchyU16(A_U16, 0, LEN, QB_U16[i & QMASK]); },
    'lowerBoundBranchyU16.nan': (i) => { OUT[0] = lowerBoundBranchyU16(A_U16, 0, LEN, QN_U16[i & QMASK]); },
    'upperBoundBranchyU16.smi': (i) => { OUT[0] = upperBoundBranchyU16(A_U16, 0, LEN, QS_U16[i & QMASK]); },
    'upperBoundBranchyU16.frac': (i) => { OUT[0] = upperBoundBranchyU16(A_U16, 0, LEN, QF_U16[i & QMASK]); },
    'upperBoundBranchyU16.big': (i) => { OUT[0] = upperBoundBranchyU16(A_U16, 0, LEN, QB_U16[i & QMASK]); },
    'upperBoundBranchyU16.nan': (i) => { OUT[0] = upperBoundBranchyU16(A_U16, 0, LEN, QN_U16[i & QMASK]); },
    'lowerBoundHintU16.smi': (i) => { OUT[0] = lowerBoundHintU16(A_U16, 0, LEN, QS_U16[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintU16.frac': (i) => { OUT[0] = lowerBoundHintU16(A_U16, 0, LEN, QF_U16[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintU16.big': (i) => { OUT[0] = lowerBoundHintU16(A_U16, 0, LEN, QB_U16[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintU16.nan': (i) => { OUT[0] = lowerBoundHintU16(A_U16, 0, LEN, QN_U16[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintU16.nanhint': (i) => { OUT[0] = lowerBoundHintU16(A_U16, 0, LEN, QS_U16[i & QMASK], HN[i & QMASK]); },
    'lowerBoundHintU16.nanlit': (i) => { OUT[0] = lowerBoundHintU16(A_U16, 0, LEN, QS_U16[i & QMASK], NaN); },
    'segmentU16.smi': (i) => { OUT[0] = segmentU16(A_U16, 0, LEN, QS_U16[i & QMASK]); },
    'segmentU16.frac': (i) => { OUT[0] = segmentU16(A_U16, 0, LEN, QF_U16[i & QMASK]); },
    'segmentU16.big': (i) => { OUT[0] = segmentU16(A_U16, 0, LEN, QB_U16[i & QMASK]); },
    'segmentU16.nan': (i) => { OUT[0] = segmentU16(A_U16, 0, LEN, QN_U16[i & QMASK]); },
    'nearestU16.smi': (i) => { OUT[0] = nearestU16(A_U16, 0, LEN, QS_U16[i & QMASK]); },
    'nearestU16.frac': (i) => { OUT[0] = nearestU16(A_U16, 0, LEN, QF_U16[i & QMASK]); },
    'nearestU16.big': (i) => { OUT[0] = nearestU16(A_U16, 0, LEN, QB_U16[i & QMASK]); },
    'nearestU16.nan': (i) => { OUT[0] = nearestU16(A_U16, 0, LEN, QN_U16[i & QMASK]); },
    'lowerBoundBranchlessI32.smi': (i) => { OUT[0] = lowerBoundBranchlessI32(A_I32, 0, LEN, QS_I32[i & QMASK]); },
    'lowerBoundBranchlessI32.frac': (i) => { OUT[0] = lowerBoundBranchlessI32(A_I32, 0, LEN, QF_I32[i & QMASK]); },
    'lowerBoundBranchlessI32.big': (i) => { OUT[0] = lowerBoundBranchlessI32(A_I32, 0, LEN, QB_I32[i & QMASK]); },
    'lowerBoundBranchlessI32.nan': (i) => { OUT[0] = lowerBoundBranchlessI32(A_I32, 0, LEN, QN_I32[i & QMASK]); },
    'upperBoundBranchlessI32.smi': (i) => { OUT[0] = upperBoundBranchlessI32(A_I32, 0, LEN, QS_I32[i & QMASK]); },
    'upperBoundBranchlessI32.frac': (i) => { OUT[0] = upperBoundBranchlessI32(A_I32, 0, LEN, QF_I32[i & QMASK]); },
    'upperBoundBranchlessI32.big': (i) => { OUT[0] = upperBoundBranchlessI32(A_I32, 0, LEN, QB_I32[i & QMASK]); },
    'upperBoundBranchlessI32.nan': (i) => { OUT[0] = upperBoundBranchlessI32(A_I32, 0, LEN, QN_I32[i & QMASK]); },
    'lowerBoundBranchyI32.smi': (i) => { OUT[0] = lowerBoundBranchyI32(A_I32, 0, LEN, QS_I32[i & QMASK]); },
    'lowerBoundBranchyI32.frac': (i) => { OUT[0] = lowerBoundBranchyI32(A_I32, 0, LEN, QF_I32[i & QMASK]); },
    'lowerBoundBranchyI32.big': (i) => { OUT[0] = lowerBoundBranchyI32(A_I32, 0, LEN, QB_I32[i & QMASK]); },
    'lowerBoundBranchyI32.nan': (i) => { OUT[0] = lowerBoundBranchyI32(A_I32, 0, LEN, QN_I32[i & QMASK]); },
    'upperBoundBranchyI32.smi': (i) => { OUT[0] = upperBoundBranchyI32(A_I32, 0, LEN, QS_I32[i & QMASK]); },
    'upperBoundBranchyI32.frac': (i) => { OUT[0] = upperBoundBranchyI32(A_I32, 0, LEN, QF_I32[i & QMASK]); },
    'upperBoundBranchyI32.big': (i) => { OUT[0] = upperBoundBranchyI32(A_I32, 0, LEN, QB_I32[i & QMASK]); },
    'upperBoundBranchyI32.nan': (i) => { OUT[0] = upperBoundBranchyI32(A_I32, 0, LEN, QN_I32[i & QMASK]); },
    'lowerBoundHintI32.smi': (i) => { OUT[0] = lowerBoundHintI32(A_I32, 0, LEN, QS_I32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintI32.frac': (i) => { OUT[0] = lowerBoundHintI32(A_I32, 0, LEN, QF_I32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintI32.big': (i) => { OUT[0] = lowerBoundHintI32(A_I32, 0, LEN, QB_I32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintI32.nan': (i) => { OUT[0] = lowerBoundHintI32(A_I32, 0, LEN, QN_I32[i & QMASK], H[i & QMASK]); },
    'lowerBoundHintI32.nanhint': (i) => { OUT[0] = lowerBoundHintI32(A_I32, 0, LEN, QS_I32[i & QMASK], HN[i & QMASK]); },
    'lowerBoundHintI32.nanlit': (i) => { OUT[0] = lowerBoundHintI32(A_I32, 0, LEN, QS_I32[i & QMASK], NaN); },
    'segmentI32.smi': (i) => { OUT[0] = segmentI32(A_I32, 0, LEN, QS_I32[i & QMASK]); },
    'segmentI32.frac': (i) => { OUT[0] = segmentI32(A_I32, 0, LEN, QF_I32[i & QMASK]); },
    'segmentI32.big': (i) => { OUT[0] = segmentI32(A_I32, 0, LEN, QB_I32[i & QMASK]); },
    'segmentI32.nan': (i) => { OUT[0] = segmentI32(A_I32, 0, LEN, QN_I32[i & QMASK]); },
    'nearestI32.smi': (i) => { OUT[0] = nearestI32(A_I32, 0, LEN, QS_I32[i & QMASK]); },
    'nearestI32.frac': (i) => { OUT[0] = nearestI32(A_I32, 0, LEN, QF_I32[i & QMASK]); },
    'nearestI32.big': (i) => { OUT[0] = nearestI32(A_I32, 0, LEN, QB_I32[i & QMASK]); },
    'nearestI32.nan': (i) => { OUT[0] = nearestI32(A_I32, 0, LEN, QN_I32[i & QMASK]); },
};

/**
 * Census: the expected lane names from oracle.mjs (KERNELS x TYPE_NAMES) x the CALLER's class list, plus the
 * caller's per-kernel extra classes ({ kernel: [class, ...] }, a kernel outside KERNELS throws) x TYPE_NAMES
 * (the test passes its own lists, so the expected set never comes from this file) vs the literal roster.
 */
export function census(classes, extra = {}) {
    const expected = [];
    for (const k of Object.keys(KERNELS)) for (const t of TYPE_NAMES) for (const c of classes) expected.push(k + t + '.' + c);
    for (const k of Object.keys(extra)) {
        if (!Object.hasOwn(KERNELS, k)) throw new Error('census: extra classes for unknown kernel ' + k);
        for (const t of TYPE_NAMES) for (const c of extra[k]) expected.push(k + t + '.' + c);
    }
    return { expected: expected.sort(), got: Object.keys(lanes).sort() };
}

// ---- tier check (law 8), opt-in by env --------------------------------------------------------
const TIER_FILE = process.env.LITE_BISECT_TIER_FILE;
const NEVER_OPT = process.env.LITE_BISECT_NEVER_OPT_LANE;
if ((TIER_FILE !== undefined && TIER_FILE !== '') || (NEVER_OPT !== undefined && NEVER_OPT !== '')) {
    // Natives syntax is compiled only here, so the bench still loads without --allow-natives-syntax
    // when no tier file is asked for; with one and no flag, this throws at import = NO VERDICT.
    const status = new Function('f', 'return %GetOptimizationStatus(f);');
    const neverOpt = new Function('f', '%NeverOptimizeFunction(f);');
    if (NEVER_OPT) {
        if (typeof lanes[NEVER_OPT] !== 'function') throw new Error('LITE_BISECT_NEVER_OPT_LANE: no lane ' + NEVER_OPT);
        neverOpt(lanes[NEVER_OPT]);
    }
    if (TIER_FILE) {
        process.on('exit', () => {
            const refOn = new Function('x', 'return x * 3 + 1; // ref on');
            const refOff = new Function('x', 'return x * 3 + 1; // ref off');
            const refMaglev = new Function('x', 'return x * 3 + 1; // ref maglev');
            const calib = new Function('on', 'off', 'mg',
                '%NeverOptimizeFunction(off); %PrepareFunctionForOptimization(on); %PrepareFunctionForOptimization(mg);' +
                'for (let i = 0; i < 64; i++) { on(i); off(i); mg(i); }' +
                '%OptimizeFunctionOnNextCall(on); %OptimizeMaglevOnNextCall(mg); on(1); off(1); mg(1);');
            calib(refOn, refOff, refMaglev);
            const out = { execArgv: process.execArgv, ref: { on: status(refOn), off: status(refOff), maglev: status(refMaglev) },
                lanes: {}, kernels: {} };
            for (const k of Object.keys(lanes)) out.lanes[k] = status(lanes[k]);
            for (const k of Object.keys(B)) if (typeof B[k] === 'function') out.kernels[k] = status(B[k]);
            writeFileSync(TIER_FILE, JSON.stringify(out) + '\n');
        });
    }
}
