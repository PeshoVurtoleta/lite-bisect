/**
 * @zakkster/lite-bisect -- zero-GC binary search kernels for sorted typed arrays.
 * One monomorphic copy of every kernel per array type, suffix F64 / F32 / U32 / U16 / I32
 * (Float64Array, Float32Array, Uint32Array, Uint16Array, Int32Array).
 *
 * Contract (every kernel):
 *   a         a sorted, non-decreasing typed array of the suffix's type, no NaN inside.
 *   [lo, hi)  the caller owns the range: integers, 0 <= lo <= hi <= a.length, hi - lo <= 2^30 - 1.
 *             The hot kernels trust the caller: no range check, no throw. The cold asserts
 *             assertRange(a, lo, hi) and assertSorted(a, lo, hi) check it and throw RangeError;
 *             no kernel calls them. A caller error such as a bad range may return a wrong index
 *             or never return.
 *   x         a NaN query compares false everywhere: every lower / upper / hint kernel returns lo,
 *             segment returns lo - 1, nearest returns lo.
 *
 * Allocation: zero allocation where the kernel inlines into its caller, or the query is a Smi; a non-Smi number query passed across a call V8 does not inline boxes one 16 B HeapNumber.
 *
 * MIT (c) Zahary Shinikchiev <shinikchiev@yahoo.com>
 *
 * @packageDocumentation
 */

/** Any array type a kernel accepts; the cold asserts take every one of them. */
export type BisectArray = Float64Array | Float32Array | Uint32Array | Uint16Array | Int32Array;

// --- Float64Array -----------------------------------------------------------------------------

/**
 * lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function lowerBoundBranchlessF64(a: Float64Array, lo: number, hi: number, x: number): number;

/**
 * upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function upperBoundBranchlessF64(a: Float64Array, lo: number, hi: number, x: number): number;

/** lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo. Branchy loop. */
export function lowerBoundBranchyF64(a: Float64Array, lo: number, hi: number, x: number): number;

/** upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo. Branchy loop. */
export function upperBoundBranchyF64(a: Float64Array, lo: number, hi: number, x: number): number;

/**
 * lower bound galloping out from the hint h: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * For coherent streams only (each h near its answer, e.g. the previous result); slower on incoherent streams.
 * h is an integer index or NaN (NaN -> lo; outside [lo, hi] clamped). A non-integer h is a caller error
 * that may return a wrong index or never return.
 */
export function lowerBoundHintF64(a: Float64Array, lo: number, hi: number, x: number, h: number): number;

/**
 * segment: the last i in [lo, hi) with a[i] <= x (upper bound - 1); lo - 1 when x < a[lo], on a NaN x,
 * on an empty range.
 */
export function segmentF64(a: Float64Array, lo: number, hi: number, x: number): number;

/**
 * nearest: the index in [lo, hi) closest to x. An exact match wins (the first i with a[i] === x); a tie
 * between the last value below x and the first above goes to the LOWER index; within a run of equal
 * values, the index next to x; past either end -> lo or hi - 1; an empty range -> lo; NaN x -> lo.
 */
export function nearestF64(a: Float64Array, lo: number, hi: number, x: number): number;

// --- Float32Array -----------------------------------------------------------------------------

/**
 * lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function lowerBoundBranchlessF32(a: Float32Array, lo: number, hi: number, x: number): number;

/**
 * upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function upperBoundBranchlessF32(a: Float32Array, lo: number, hi: number, x: number): number;

/** lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo. Branchy loop. */
export function lowerBoundBranchyF32(a: Float32Array, lo: number, hi: number, x: number): number;

/** upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo. Branchy loop. */
export function upperBoundBranchyF32(a: Float32Array, lo: number, hi: number, x: number): number;

/**
 * lower bound galloping out from the hint h: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * For coherent streams only (each h near its answer, e.g. the previous result); slower on incoherent streams.
 * h is an integer index or NaN (NaN -> lo; outside [lo, hi] clamped). A non-integer h is a caller error
 * that may return a wrong index or never return.
 */
export function lowerBoundHintF32(a: Float32Array, lo: number, hi: number, x: number, h: number): number;

/**
 * segment: the last i in [lo, hi) with a[i] <= x (upper bound - 1); lo - 1 when x < a[lo], on a NaN x,
 * on an empty range.
 */
export function segmentF32(a: Float32Array, lo: number, hi: number, x: number): number;

/**
 * nearest: the index in [lo, hi) closest to x. An exact match wins (the first i with a[i] === x); a tie
 * between the last value below x and the first above goes to the LOWER index; within a run of equal
 * values, the index next to x; past either end -> lo or hi - 1; an empty range -> lo; NaN x -> lo.
 */
export function nearestF32(a: Float32Array, lo: number, hi: number, x: number): number;

// --- Uint32Array ------------------------------------------------------------------------------

/**
 * lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function lowerBoundBranchlessU32(a: Uint32Array, lo: number, hi: number, x: number): number;

/**
 * upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function upperBoundBranchlessU32(a: Uint32Array, lo: number, hi: number, x: number): number;

/** lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo. Branchy loop. */
export function lowerBoundBranchyU32(a: Uint32Array, lo: number, hi: number, x: number): number;

/** upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo. Branchy loop. */
export function upperBoundBranchyU32(a: Uint32Array, lo: number, hi: number, x: number): number;

/**
 * lower bound galloping out from the hint h: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * For coherent streams only (each h near its answer, e.g. the previous result); slower on incoherent streams.
 * h is an integer index or NaN (NaN -> lo; outside [lo, hi] clamped). A non-integer h is a caller error
 * that may return a wrong index or never return.
 */
export function lowerBoundHintU32(a: Uint32Array, lo: number, hi: number, x: number, h: number): number;

/**
 * segment: the last i in [lo, hi) with a[i] <= x (upper bound - 1); lo - 1 when x < a[lo], on a NaN x,
 * on an empty range.
 */
export function segmentU32(a: Uint32Array, lo: number, hi: number, x: number): number;

/**
 * nearest: the index in [lo, hi) closest to x. An exact match wins (the first i with a[i] === x); a tie
 * between the last value below x and the first above goes to the LOWER index; within a run of equal
 * values, the index next to x; past either end -> lo or hi - 1; an empty range -> lo; NaN x -> lo.
 */
export function nearestU32(a: Uint32Array, lo: number, hi: number, x: number): number;

// --- Uint16Array ------------------------------------------------------------------------------

/**
 * lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function lowerBoundBranchlessU16(a: Uint16Array, lo: number, hi: number, x: number): number;

/**
 * upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function upperBoundBranchlessU16(a: Uint16Array, lo: number, hi: number, x: number): number;

/** lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo. Branchy loop. */
export function lowerBoundBranchyU16(a: Uint16Array, lo: number, hi: number, x: number): number;

/** upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo. Branchy loop. */
export function upperBoundBranchyU16(a: Uint16Array, lo: number, hi: number, x: number): number;

/**
 * lower bound galloping out from the hint h: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * For coherent streams only (each h near its answer, e.g. the previous result); slower on incoherent streams.
 * h is an integer index or NaN (NaN -> lo; outside [lo, hi] clamped). A non-integer h is a caller error
 * that may return a wrong index or never return.
 */
export function lowerBoundHintU16(a: Uint16Array, lo: number, hi: number, x: number, h: number): number;

/**
 * segment: the last i in [lo, hi) with a[i] <= x (upper bound - 1); lo - 1 when x < a[lo], on a NaN x,
 * on an empty range.
 */
export function segmentU16(a: Uint16Array, lo: number, hi: number, x: number): number;

/**
 * nearest: the index in [lo, hi) closest to x. An exact match wins (the first i with a[i] === x); a tie
 * between the last value below x and the first above goes to the LOWER index; within a run of equal
 * values, the index next to x; past either end -> lo or hi - 1; an empty range -> lo; NaN x -> lo.
 */
export function nearestU16(a: Uint16Array, lo: number, hi: number, x: number): number;

// --- Int32Array -------------------------------------------------------------------------------

/**
 * lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function lowerBoundBranchlessI32(a: Int32Array, lo: number, hi: number, x: number): number;

/**
 * upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo.
 * Branchless. Maglev does not inline it at its default 100 B cap; TurboFan inlines it (traced).
 */
export function upperBoundBranchlessI32(a: Int32Array, lo: number, hi: number, x: number): number;

/** lower bound: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo. Branchy loop. */
export function lowerBoundBranchyI32(a: Int32Array, lo: number, hi: number, x: number): number;

/** upper bound: the first i in [lo, hi) with a[i] > x, else hi. NaN x -> lo. Branchy loop. */
export function upperBoundBranchyI32(a: Int32Array, lo: number, hi: number, x: number): number;

/**
 * lower bound galloping out from the hint h: the first i in [lo, hi) with a[i] >= x, else hi. NaN x -> lo.
 * For coherent streams only (each h near its answer, e.g. the previous result); slower on incoherent streams.
 * h is an integer index or NaN (NaN -> lo; outside [lo, hi] clamped). A non-integer h is a caller error
 * that may return a wrong index or never return.
 */
export function lowerBoundHintI32(a: Int32Array, lo: number, hi: number, x: number, h: number): number;

/**
 * segment: the last i in [lo, hi) with a[i] <= x (upper bound - 1); lo - 1 when x < a[lo], on a NaN x,
 * on an empty range.
 */
export function segmentI32(a: Int32Array, lo: number, hi: number, x: number): number;

/**
 * nearest: the index in [lo, hi) closest to x. An exact match wins (the first i with a[i] === x); a tie
 * between the last value below x and the first above goes to the LOWER index; within a run of equal
 * values, the index next to x; past either end -> lo or hi - 1; an empty range -> lo; NaN x -> lo.
 */
export function nearestI32(a: Int32Array, lo: number, hi: number, x: number): number;

// --- cold checks: one copy each, called by no kernel ------------------------------------------

/**
 * Cold check: throws RangeError unless lo and hi are integers, 0 <= lo <= hi <= a.length and
 * hi - lo <= 2^30 - 1. Reads only a.length. Call it off the hot path.
 */
export function assertRange(a: BisectArray, lo: number, hi: number): void;

/**
 * Cold check: assertRange(a, lo, hi), then throws RangeError on a NaN in [lo, hi) or a descent
 * (a[i] < a[i - 1]). Reads every element of the range. Call it off the hot path.
 */
export function assertSorted(a: BisectArray, lo: number, hi: number): void;
