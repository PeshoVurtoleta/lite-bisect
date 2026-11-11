// scripts/bisect.template.js -- the ONE source of the generated region of Bisect.js.
// scripts/gen.mjs writes it once per array type (F64, F32, U32, U16, I32), replacing the
// placeholder suffix on every name, between the marker comments of Bisect.js. Edit this file,
// then run `npm run gen`; never edit the region by hand. Valid JS on its own (node --check).
// Order: lowerBoundBranchless, upperBoundBranchless, lowerBoundBranchy, upperBoundBranchy,
// lowerBoundHint, segment, nearest (segment / nearest after the kernels they call).
// The four bound bodies are the frozen draft bodies byte-for-byte; no guard is added (law 4).
// MIT (c) Zahary Shinikchiev <shinikchiev@yahoo.com>

export function lowerBoundBranchless$T(a, lo, hi, x) {
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

export function upperBoundBranchless$T(a, lo, hi, x) {
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

export function lowerBoundBranchy$T(a, lo, hi, x) {
    while (lo < hi) {
        const m = lo + ((hi - lo) >>> 1);
        if (a[m] < x) lo = m + 1;
        else hi = m;
    }
    return lo;
}

export function upperBoundBranchy$T(a, lo, hi, x) {
    while (lo < hi) {
        const m = lo + ((hi - lo) >>> 1);
        if (a[m] <= x) lo = m + 1;
        else hi = m;
    }
    return lo;
}

export function lowerBoundHint$T(a, lo, hi, x, h) {
    if (!(h >= lo)) h = lo;              // NaN hint -> lo
    if (h > hi) h = hi;
    let step = 1;
    if (h < hi && a[h] < x) {
        // Answer in (h, hi]. Gallop right: prev is the last index known < x.
        let prev = h, r = h + 1;
        while (r < hi && a[r] < x) { prev = r; step <<= 1; r = h + step; }
        if (r > hi) r = hi;
        return lowerBoundBranchless$T(a, prev + 1, r, x);
    }
    // a[h] >= x or h === hi: answer in [lo, h]. Gallop left: top is the lowest index known >= x.
    let top = h, l = h - 1;
    // !(a[l] < x), never a[l] >= x: a NaN query gallops to lo.
    while (l >= lo && !(a[l] < x)) { top = l; step <<= 1; l = h - step; }
    if (l < lo) l = lo - 1;
    return lowerBoundBranchless$T(a, l + 1, top, x);
}

export function segment$T(a, lo, hi, x) {
    return upperBoundBranchless$T(a, lo, hi, x) - 1;
}

export function nearest$T(a, lo, hi, x) {
    const i = lowerBoundBranchless$T(a, lo, hi, x);
    if (i === lo) return lo;
    if (i === hi) return hi - 1;
    const p = a[i - 1], q = a[i], d = x - p, u = q - x;
    // Rounding is monotone: unequal doubles order the exact distances (a NaN u is an exact +Infinity match).
    if (d !== u) return d < u ? i - 1 : i;
    // Equal after rounding: compare the exact rounding errors of d and u (TwoSum; no allocation). They are
    // NaN when d is Infinity (an infinite neighbour or one overflow): then only a -Infinity lower neighbour
    // with a finite upper one is the farther of the two.
    const s = d - x, t = u - q;
    return i - ((!((x - (d - s)) - (p + s) > (q - (u - t)) - (x + t)) && p * 0.5 + q * 0.5 !== -Infinity) | 0);
}
