// draft-check.mjs -- the ONLY check the draft has. node draft-check.mjs [seed]
// Oracle: a naive scan written from the DEFINITION (first a[i] >= x / > x in [lo, hi)), sharing no
// code or geometry with the kernels. Every kernel, every sub-range of small arrays, random queries
// drawn from the stored values, their neighbours, and NaN / +-Infinity.
import * as B from './Bisect.draft.js';

let seed = Number(process.argv[2] || 12345) >>> 0;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };

// Contract: a NaN query returns lo (every compare is false, so the kernels never move right).
const naiveLower = (a, lo, hi, x) => { if (x !== x) return lo; for (let i = lo; i < hi; i++) if (a[i] >= x) return i; return hi; };
const naiveUpper = (a, lo, hi, x) => { if (x !== x) return lo; for (let i = lo; i < hi; i++) if (a[i] > x) return i; return hi; };

let checks = 0, fails = 0;
const fail = (m) => { fails++; if (fails <= 5) console.log('FAIL ' + m); };
const eq = (got, want, what) => { checks++; if (got !== want) fail(what + ' got ' + got + ' want ' + want); };

function sortedArray(n) {
    const a = new Float64Array(n);
    let v = -50 + rnd() * 10;
    for (let i = 0; i < n; i++) { if (rnd() < 0.7) v += rnd() < 0.5 ? 1 : rnd() * 3; a[i] = v; }   // ~30% duplicates
    return a;
}
function queries(a) {
    const q = [NaN, -Infinity, Infinity, -1e9, 1e9];
    for (let i = 0; i < a.length; i++) q.push(a[i], a[i] - 0.5, a[i] + 0.5);
    return q;
}

for (let round = 0; round < 400; round++) {
    const n = round < 70 ? round : 1 + ((rnd() * 300) | 0);
    const a = sortedArray(n);
    const qs = queries(a);
    // Every sub-range for small arrays, random ones for larger.
    const ranges = [];
    if (n <= 24) { for (let lo = 0; lo <= n; lo++) for (let hi = lo; hi <= n; hi++) ranges.push([lo, hi]); }
    else { ranges.push([0, n]); for (let k = 0; k < 20; k++) { const lo = (rnd() * (n + 1)) | 0; ranges.push([lo, lo + ((rnd() * (n - lo + 1)) | 0)]); } }
    for (const [lo, hi] of ranges) {
        for (const x of qs) {
            const wl = naiveLower(a, lo, hi, x), wu = naiveUpper(a, lo, hi, x);
            const tag = ' n=' + n + ' [' + lo + ',' + hi + ') x=' + x;
            eq(B.lowerBoundLinear(a, lo, hi, x), wl, 'linear' + tag);
            eq(B.lowerBoundBranchy(a, lo, hi, x), wl, 'branchy' + tag);
            eq(B.lowerBoundBranchless(a, lo, hi, x), wl, 'branchless' + tag);
            eq(B.lowerBound(a, lo, hi, x), wl, 'adaptive' + tag);
            eq(B.upperBoundBranchy(a, lo, hi, x), wu, 'upperBranchy' + tag);
            eq(B.upperBoundBranchless(a, lo, hi, x), wu, 'upperBranchless' + tag);
            // Hints: in range, at both ends, outside, NaN.
            const hs = [lo, hi, lo - 3, hi + 3, NaN, lo + ((rnd() * (hi - lo + 1)) | 0), wl];
            for (const h of hs) eq(B.lowerBoundHint(a, lo, hi, x, h), wl, 'hint h=' + h + tag);
        }
    }
    // Eytzinger over the whole array.
    const eyt = new Float64Array(n + 1), rank = new Int32Array(n + 1);
    B.buildEytzinger(a, n, eyt, rank);
    for (const x of qs) eq(B.lowerBoundEytzinger(eyt, rank, n, x), naiveLower(a, 0, n, x), 'eytzinger n=' + n + ' x=' + x);
}
console.log('checks ' + checks);
console.log(fails ? 'draft-check: ' + fails + ' FAILED' : 'draft-check: ok');
process.exitCode = fails ? 1 : 0;
