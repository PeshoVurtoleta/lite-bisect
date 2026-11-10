/**
 * @zakkster/lite-bisect -- DRAFT ONLY. NOT A PACKAGE, NOT REVIEWED, NOT MEASURED AS WRITTEN.
 *
 * Sorted-array search kernels for typed arrays: the ones the LiteLogLogN layout research measured
 * (RESEARCH.md sections 16-18), written once with one contract so the ~28 hand-written copies in
 * the suite can be compared against them. See ROADMAP.md before using or extending it.
 *
 * Checked so far: draft-check.mjs (every kernel vs a naive scan oracle, random sorted arrays with
 * duplicates, every sub-range, NaN / +-Infinity queries, out-of-range hints). Nothing else.
 *
 * ---------------------------------------------------------------------------------------------
 * Contract (every kernel):
 *   a        a sorted, non-decreasing array (no NaN inside). Float64Array in this draft.
 *   [lo, hi) the half-open range searched; 0 <= lo <= hi <= a.length, hi - lo <= 2^30.
 *   lower bound  = the first i in [lo, hi) with a[i] >= x, or hi if none.
 *   upper bound  = the first i in [lo, hi) with a[i] >  x, or hi if none.
 *   A NaN query compares false everywhere: lower bound and upper bound both return lo.
 *   Hot kernels never validate and never throw (the caller owns the range); no allocation.
 *
 * Three layers (ROADMAP section 1):
 *   A. automatic, inside one kernel: only what the kernel can SEE cheaply (the range length,
 *      the caller's hint). lowerBound() switches on length; lowerBoundHint() gallops from a hint.
 *   B. chosen by the caller, documented: branchy vs branchless (branchless loses when the result
 *      feeds a write, RESEARCH 18), lower vs upper.
 *   C. chosen by the caller, builds a structure: the Eytzinger copy (static arrays only).
 * ---------------------------------------------------------------------------------------------
 *
 * MIT (c) Zahary Shinikchiev <shinikchiev@yahoo.com>
 */

/** Range length at or below which lowerBound() scans. NOMINAL: S0 measured linear winning at
 *  k <= 4 and tying at k = 8 against branchless (RESEARCH 16.1). Open question R-1. */
export const LINEAR_MAX = 8;

// --- layer B: single-strategy kernels --------------------------------------------------------

/** Linear lower bound. Best for tiny ranges; O(hi - lo). */
export function lowerBoundLinear(a, lo, hi, x) {
    let i = lo;
    while (i < hi && a[i] < x) i++;
    return i;
}

/** Classic branchy lower bound. Keep it where the result feeds a write (RESEARCH 18). */
export function lowerBoundBranchy(a, lo, hi, x) {
    while (lo < hi) {
        const m = lo + ((hi - lo) >>> 1);
        if (a[m] < x) lo = m + 1;
        else hi = m;
    }
    return lo;
}

/** Branchy upper bound (first a[i] > x). */
export function upperBoundBranchy(a, lo, hi, x) {
    while (lo < hi) {
        const m = lo + ((hi - lo) >>> 1);
        if (a[m] <= x) lo = m + 1;
        else hi = m;
    }
    return lo;
}

/**
 * Branchless lower bound (the "bfb" kernel of RESEARCH 16/17). Fixed probe count for a given
 * length, no data-dependent branch inside the loop: the compare result becomes a mask.
 * Invariant: the answer is in [b, b + n].
 */
export function lowerBoundBranchless(a, lo, hi, x) {
    let n = hi - lo;
    if (n === 0) return lo;              // a[b] below would read outside the range
    let b = lo;
    while (n > 1) {
        const h = n >>> 1;
        b += (0 - ((a[b + h] < x) | 0)) & h;
        n -= h;
    }
    return b + ((a[b] < x) | 0);
}

/** Branchless upper bound (first a[i] > x). */
export function upperBoundBranchless(a, lo, hi, x) {
    let n = hi - lo;
    if (n === 0) return lo;
    let b = lo;
    while (n > 1) {
        const h = n >>> 1;
        b += (0 - ((a[b + h] <= x) | 0)) & h;
        n -= h;
    }
    return b + ((a[b] <= x) | 0);
}

// --- layer A: the "Timsort" part (adapts only to what it can see) ---------------------------

/** Lower bound that picks linear or branchless by range length. Whether the switch earns its
 *  bytes over plain branchless is open (R-1): the measured gap is small at k <= 8. */
export function lowerBound(a, lo, hi, x) {
    return (hi - lo) <= LINEAR_MAX ? lowerBoundLinear(a, lo, hi, x) : lowerBoundBranchless(a, lo, hi, x);
}

/**
 * Lower bound starting from a hint h (usually the previous answer), galloping outward
 * (exponential search, the same idea as Timsort's galloping mode), then a branchless search in
 * the bracket found. O(log d) for an answer d slots from h. For per-frame queries that move a
 * little each frame (animation time, scroll offset). A hint outside [lo, hi] is clamped.
 */
export function lowerBoundHint(a, lo, hi, x, h) {
    if (!(h >= lo)) h = lo;              // NaN hint -> lo
    if (h > hi) h = hi;
    let step = 1;
    if (h < hi && a[h] < x) {
        // Answer in (h, hi]. Gallop right: prev is the last index known < x.
        let prev = h, r = h + 1;
        while (r < hi && a[r] < x) { prev = r; step <<= 1; r = h + step; }
        if (r > hi) r = hi;
        return lowerBoundBranchless(a, prev + 1, r, x);
    }
    // a[h] >= x or h === hi: answer in [lo, h]. Gallop left: top is the lowest index known >= x.
    let top = h, l = h - 1;
    // !(a[l] < x), not a[l] >= x: the same predicate as every other kernel, so a NaN query
    // gallops to lo like they do (draft-check caught `>=` returning the hint for NaN).
    while (l >= lo && !(a[l] < x)) { top = l; step <<= 1; l = h - step; }
    if (l < lo) l = lo - 1;
    return lowerBoundBranchless(a, l + 1, top, x);
}

// --- layer C: Eytzinger (static arrays only; rebuild after any write) -----------------------

/**
 * Build the Eytzinger (BFS) layout of sorted[0..n) into caller-owned buffers:
 * eyt[1..n] the keys in BFS order, rank[1..n] each node's index in `sorted`, rank[0] = n
 * (the "not found" answer). eyt and rank need length n + 1. Cold path; recursion depth log2 n.
 */
export function buildEytzinger(sorted, n, eyt, rank) {
    let pos = 0;
    const fill = (i) => {
        if (i > n) return;
        fill(2 * i);
        eyt[i] = sorted[pos]; rank[i] = pos; pos++;
        fill(2 * i + 1);
    };
    fill(1);
    rank[0] = n;
}

/** Lower bound over an Eytzinger layout; returns the index in the ORIGINAL sorted order. */
export function lowerBoundEytzinger(eyt, rank, n, x) {
    let i = 1;
    while (i <= n) i = (i << 1) + ((eyt[i] < x) | 0);
    // Drop the trailing "went right" steps plus the last left step: i >>= ffs(~i).
    const t = ~i;
    i >>= 32 - Math.clz32(t & (0 - t));
    return rank[i];
}
