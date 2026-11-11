// test/oracle.mjs -- the lite-bisect oracle. Written from the SPEC definitions only
// (.handoff/p1/SPEC-p1.md sections 1 and 3 U3); it imports nothing from Bisect.js and shares
// no code or geometry with the kernels (LEDGER law 9). Every answer is a naive linear scan.
// The module under test is always a PARAMETER (`mod`), so the same driver also runs the
// test-local mutants (the controls) and temp copies of Bisect.js.

import { createHash } from 'node:crypto';

export const TYPES = {
    F64: Float64Array,
    F32: Float32Array,
    U32: Uint32Array,
    U16: Uint16Array,
    I32: Int32Array,
};
export const TYPE_NAMES = Object.keys(TYPES);

// Kernel family -> the oracle row that checks it.
export const KERNELS = {
    lowerBoundBranchless: 'lower',
    upperBoundBranchless: 'upper',
    lowerBoundBranchy: 'lower',
    upperBoundBranchy: 'upper',
    lowerBoundHint: 'hint',
    segment: 'segment',
    nearest: 'nearest',
};
// Exports with no oracle row here: checked row by row in test/Bisect.boundary.test.mjs.
export const COVERED_ELSEWHERE = {
    assertRange: 'test/Bisect.boundary.test.mjs',
    assertSorted: 'test/Bisect.boundary.test.mjs',
};

const NAME_RE = new RegExp('^(' + Object.keys(KERNELS).join('|') + ')(' + TYPE_NAMES.join('|') + ')$');

// ---- PRNG: xorshift32, the draft-check.mjs shape (JS number ops on s) -------------------
export function makeRng(seed) {
    let s = seed >>> 0;
    if (s === 0) throw new RangeError('xorshift32 seed must be non-zero');
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

// ---- naive definitions ------------------------------------------------------------------
// lower: first i in [lo, hi) with a[i] >= x, else hi; NaN query -> lo.
export function naiveLower(a, lo, hi, x) {
    if (x !== x) return lo;
    for (let i = lo; i < hi; i++) if (a[i] >= x) return i;
    return hi;
}
// upper: first i in [lo, hi) with a[i] > x, else hi; NaN query -> lo.
export function naiveUpper(a, lo, hi, x) {
    if (x !== x) return lo;
    for (let i = lo; i < hi; i++) if (a[i] > x) return i;
    return hi;
}
// segment: last i in [lo, hi) with a[i] <= x, else lo - 1; NaN query -> lo - 1.
export function naiveSegment(a, lo, hi, x) {
    if (x !== x) return lo - 1;
    for (let i = hi - 1; i >= lo; i--) if (a[i] <= x) return i;
    return lo - 1;
}
// nearest: empty -> lo; NaN -> lo; else the first i with a[i] === x; else L = last i with
// a[i] < x, U = first i with a[i] > x; no L -> U; no U -> L; else x - a[L] <= a[U] - x decided in
// EXACT arithmetic (exactLeq below), a tie -> L. Never the rounded double expression (R-ORACLE): it
// rounds both distances and calls a false tie for L (e.g. [-3, 4], x = 0.5000000000000001 -> 1).
export function naiveNearest(a, lo, hi, x) {
    if (hi === lo) return lo;
    if (x !== x) return lo;
    for (let i = lo; i < hi; i++) if (a[i] === x) return i;
    let L = -1, U = -1, hasL = false, hasU = false;
    for (let i = hi - 1; i >= lo; i--) if (a[i] < x) { L = i; hasL = true; break; }
    for (let i = lo; i < hi; i++) if (a[i] > x) { U = i; hasU = true; break; }
    if (!hasL) return U;
    if (!hasU) return L;
    return exactLeq(a[L], x, a[U]) ? L : U;
}

// ---- exact arithmetic (R-ORACLE) ----------------------------------------------------------
// exactUnits(v): a finite double v as a BigInt count of 2^-1074 (every finite double is an
// integer multiple of the smallest subnormal), read from its IEEE-754 bits. A non-finite v
// throws (fail closed: an infinity has no unit count).
const BITS_F = new Float64Array(1);
const BITS_U = new BigUint64Array(BITS_F.buffer);
export function exactUnits(v) {
    if (!Number.isFinite(v)) throw new RangeError('exactUnits: non-finite ' + v);
    BITS_F[0] = v;
    const bits = BITS_U[0];
    const biased = Number((bits >> 52n) & 0x7ffn);
    let m = bits & 0xfffffffffffffn;
    if (biased !== 0) m = (m | 0x10000000000000n) << BigInt(biased - 1);   // normal: (2^52 + f) * 2^(e - 1)
    return bits >> 63n ? -m : m;                                            // subnormal: f units as is
}
// exactLeq(p, x, q) for p < x < q: true when x - p <= q - x exactly. x is finite here (p < x < q
// leaves no room for an infinite x). Infinities by case: an infinite distance loses to a finite
// one; two infinite distances ([-Infinity, Infinity]) are a tie -> true (the lower index).
export function exactLeq(p, x, q) {
    const infP = p === -Infinity, infQ = q === Infinity;
    if (infP || infQ) return infQ;
    const X = exactUnits(x);
    return X - exactUnits(p) <= exactUnits(q) - X;
}

// ---- generators -------------------------------------------------------------------------
// ~30% duplicates: a step happens with probability 0.7, else the value repeats.
// F64: the draft-check shape. F32: the same, each value through Math.fround (monotone, so the
// array stays sorted). Integer types: integer steps 1..3 from a base chosen per round:
//   U32: crosses 2^31 / ends just under 2^32 - 1 / small;  I32: crosses 0 / starts at -2^31 /
//   ends just under 2^31 - 1;  U16: small / ends just under 65535.
const MAXV = { U32: 4294967295, U16: 65535, I32: 2147483647 };
function intBase(T, rnd, n, round) {
    const mode = round % 3, top = MAXV[T] - 4 * n - 8, j = (rnd() * 8) | 0;
    if (T === 'U32') return mode === 0 ? 2147483648 - 2 * n - 4 + j : mode === 1 ? top - j : j;
    if (T === 'I32') return mode === 0 ? -2 * n - 4 + j : mode === 1 ? -2147483648 + j : top - j;
    return mode === 1 ? top - j : j; // U16
}
export function genArray(T, rnd, n, round) {
    const a = new TYPES[T](n);
    if (T === 'F64' || T === 'F32') {
        let v = -50 + rnd() * 10;
        for (let i = 0; i < n; i++) {
            if (rnd() < 0.7) v += rnd() < 0.5 ? 1 : rnd() * 3;
            const want = T === 'F32' ? Math.fround(v) : v;
            a[i] = want;
            if (a[i] !== want) throw new Error('genArray ' + T + ' stored ' + a[i] + ' for ' + want + ' at ' + i);
        }
    } else {
        let v = intBase(T, rnd, n, round);
        for (let i = 0; i < n; i++) {
            if (rnd() < 0.7) v += rnd() < 0.5 ? 1 : 1 + ((rnd() * 3) | 0);
            a[i] = v;
            if (a[i] !== v) throw new Error('genArray ' + T + ' stored ' + a[i] + ' for ' + v + ' at ' + i);
        }
    }
    // Generator self-check (fail closed): every stored value equals the generated one and the
    // array is sorted ascending (an integer overflow would wrap and unsort it).
    for (let i = 1; i < n; i++) {
        if (!(a[i - 1] <= a[i])) throw new Error('genArray ' + T + ' not sorted at ' + i);
    }
    return a;
}
// Queries: NaN / +-Infinity / far values, then per stored value: floats a[i], a[i] +- 0.5;
// integer types a[i], a[i] +- 1 and the fractional a[i] + 0.5.
export function genQueries(T, a) {
    const q = [NaN, -Infinity, Infinity, -1e9, 1e9, -1e12, 1e12, -0];
    const isFloat = T === 'F64' || T === 'F32';
    for (let i = 0; i < a.length; i++) {
        const v = a[i];
        if (isFloat) q.push(v, v - 0.5, v + 0.5);
        else q.push(v, v - 1, v + 1, v + 0.5);
    }
    return q;
}
// ---- rounded-tie generator (R-NEAREST / R-ORACLE) ---------------------------------------
// The rounds above never reach a ROUNDED tie (x - p === q - x in doubles while the exact distances
// differ), so a nearest that decides ties by the rounded expression passes them. This phase draws
// sorted pairs [p, q] of type T over wide magnitudes and queries the midpoint p / 2 + q / 2 moved
// by -4..4 ulps plus one uniform point in (p, q). runOracle counts the false rounded ties it hit.
const UF = new Float64Array(1);
const UI = new BigInt64Array(UF.buffer);
const MAG = 0x7fffffffffffffffn;
// v moved k ulps along the number line (finite v; -0 is treated as +0).
export function ulpMove(v, k) {
    UF[0] = v;
    const ord = (UI[0] < 0n ? -(UI[0] & MAG) : UI[0]) + BigInt(k);
    UI[0] = ord < 0n ? (-ord) | (1n << 63n) : ord;
    return UF[0];
}
function tieValue(T, rnd) {
    if (T === 'F64' || T === 'F32') {
        const m = rnd() + rnd() / 4294967296;                     // ~53 random bits in [0, 1)
        const v = (rnd() < 0.5 ? -m : m) * 2 ** (((rnd() * 121) | 0) - 60);
        return T === 'F32' ? Math.fround(v) : v;
    }
    const wide = rnd() < 0.34;
    if (T === 'I32') return wide ? ((rnd() * 4294967296) | 0) : ((rnd() * 2001) | 0) - 1000;
    if (T === 'U32') return wide ? Math.floor(rnd() * 4294967296) : (rnd() * 2001) | 0;
    return wide ? (rnd() * 65536) | 0 : (rnd() * 2001) | 0;    // U16
}
export function genTieCases(T, rnd, draws) {
    const out = [];
    for (let d = 0; d < draws; d++) {
        const u = tieValue(T, rnd), v = tieValue(T, rnd);
        const a = new TYPES[T](2);
        a[0] = u < v ? u : v; a[1] = u < v ? v : u;
        if (!(a[0] < a[1])) continue;
        const p = a[0], q = a[1], mid = p / 2 + q / 2;
        for (let k = -4; k <= 4; k++) out.push(a, ulpMove(mid, k));
        out.push(a, p + (q - p) * rnd());
    }
    return out;
}
// A false rounded tie: p < x < q, the rounded distances are equal, the exact ones are not.
export function isRoundedTie(p, x, q) {
    if (!(p < x && x < q) || x - p !== q - x || p === -Infinity || q === Infinity) return false;
    const X = exactUnits(x);
    return X - exactUnits(p) !== exactUnits(q) - X;
}

// Ranges: every [lo, hi) for n <= 24; else [0, n] plus 20 random sub-ranges.
export function genRanges(rnd, n) {
    const r = [];
    if (n <= 24) {
        for (let lo = 0; lo <= n; lo++) for (let hi = lo; hi <= n; hi++) r.push(lo, hi);
    } else {
        r.push(0, n);
        for (let k = 0; k < 20; k++) {
            const lo = (rnd() * (n + 1)) | 0;
            r.push(lo, lo + ((rnd() * (n - lo + 1)) | 0));
        }
    }
    return r;
}

// ---- census -----------------------------------------------------------------------------
// Every export must be covered by a row: a <kernel><T> name (oracle row here) or a name in
// COVERED_ELSEWHERE. Fail closed both ways: an uncovered export is `unknown`, an expected
// export that is absent is `missing`. ok only when both are empty.
export function census(keys) {
    const unknown = [], rows = [];
    const seen = new Set(keys);
    for (const k of keys) {
        const m = NAME_RE.exec(k);
        if (m) rows.push({ name: k, kernel: m[1], kind: KERNELS[m[1]], T: m[2] });
        else if (!Object.prototype.hasOwnProperty.call(COVERED_ELSEWHERE, k)) unknown.push(k);
    }
    const missing = [];
    for (const kern of Object.keys(KERNELS)) for (const T of TYPE_NAMES) {
        if (!seen.has(kern + T)) missing.push(kern + T);
    }
    for (const k of Object.keys(COVERED_ELSEWHERE)) if (!seen.has(k)) missing.push(k);
    return { ok: unknown.length === 0 && missing.length === 0, unknown, missing, rows };
}

// ---- the oracle driver ------------------------------------------------------------------
// Runs every <kernel><T> function present in `mod` for array type T against the naive
// definitions. Rounds 0..69: n = round (every sub-range for n <= 24, [0, n] + 20 random
// above); then `bigRounds` rounds with n = 1 + rnd() * 300. Hints per (range, x), the
// draft-check list: lo, hi, lo - 3, hi + 3, NaN, a random h in [lo, hi], the oracle answer.
// Then, when `mod` has a nearest kernel, the rounded-tie phase (genTieCases, opts.tieDraws pairs).
// Returns { checks, fails, msgs, perName, roundedTies } -- a function in `mod` that ran 0 checks
// shows up in perName with 0 and the caller fails it; roundedTies counts the false rounded ties hit.
export function runOracle(mod, T, seed, opts = {}) {
    const smallRounds = opts.smallRounds ?? 70;
    const bigRounds = opts.bigRounds ?? 0;
    const nMax = opts.nMax ?? 300;
    const lowers = [], uppers = [], segs = [], nears = [], hints = [];
    const perName = {};
    for (const k of Object.keys(mod)) {
        const m = NAME_RE.exec(k);
        if (!m || m[2] !== T) continue;
        const fn = mod[k];
        if (typeof fn !== 'function') throw new TypeError(k + ' is not a function');
        perName[k] = 0;
        const row = [k, fn];
        const kind = KERNELS[m[1]];
        (kind === 'lower' ? lowers : kind === 'upper' ? uppers : kind === 'segment' ? segs
            : kind === 'nearest' ? nears : hints).push(row);
    }
    const rnd = makeRng(seed);
    let checks = 0, fails = 0;
    const msgs = [];
    const bad = (name, got, want, n, lo, hi, x, h) => {
        fails++;
        if (msgs.length < 8) {
            msgs.push(name + ' n=' + n + ' [' + lo + ',' + hi + ') x=' + x
                + (h === undefined ? '' : ' h=' + h) + ' got ' + got + ' want ' + want);
        }
    };
    const total = smallRounds + bigRounds;
    for (let round = 0; round < total; round++) {
        const n = round < smallRounds ? round : 1 + ((rnd() * nMax) | 0);
        const a = genArray(T, rnd, n, round);
        const qs = genQueries(T, a);
        const rg = genRanges(rnd, n);
        for (let r = 0; r < rg.length; r += 2) {
            const lo = rg[r], hi = rg[r + 1];
            for (let q = 0; q < qs.length; q++) {
                const x = qs[q];
                const wl = naiveLower(a, lo, hi, x);
                const wu = naiveUpper(a, lo, hi, x);
                const ws = naiveSegment(a, lo, hi, x);
                const wn = naiveNearest(a, lo, hi, x);
                for (let k = 0; k < lowers.length; k++) {
                    const got = lowers[k][1](a, lo, hi, x); checks++; perName[lowers[k][0]]++;
                    if (got !== wl) bad(lowers[k][0], got, wl, n, lo, hi, x);
                }
                for (let k = 0; k < uppers.length; k++) {
                    const got = uppers[k][1](a, lo, hi, x); checks++; perName[uppers[k][0]]++;
                    if (got !== wu) bad(uppers[k][0], got, wu, n, lo, hi, x);
                }
                for (let k = 0; k < segs.length; k++) {
                    const got = segs[k][1](a, lo, hi, x); checks++; perName[segs[k][0]]++;
                    if (got !== ws) bad(segs[k][0], got, ws, n, lo, hi, x);
                }
                for (let k = 0; k < nears.length; k++) {
                    const got = nears[k][1](a, lo, hi, x); checks++; perName[nears[k][0]]++;
                    if (got !== wn) bad(nears[k][0], got, wn, n, lo, hi, x);
                }
                // ONE rnd() per (range, x), drawn whether or not a hint kernel is present.
                const hr = lo + ((rnd() * (hi - lo + 1)) | 0);
                for (let k = 0; k < hints.length; k++) {
                    const fn = hints[k][1], name = hints[k][0];
                    const hs0 = lo, hs1 = hi, hs2 = lo - 3, hs3 = hi + 3, hs4 = NaN, hs5 = hr, hs6 = wl;
                    let g;
                    g = fn(a, lo, hi, x, hs0); checks++; if (g !== wl) bad(name, g, wl, n, lo, hi, x, hs0);
                    g = fn(a, lo, hi, x, hs1); checks++; if (g !== wl) bad(name, g, wl, n, lo, hi, x, hs1);
                    g = fn(a, lo, hi, x, hs2); checks++; if (g !== wl) bad(name, g, wl, n, lo, hi, x, hs2);
                    g = fn(a, lo, hi, x, hs3); checks++; if (g !== wl) bad(name, g, wl, n, lo, hi, x, hs3);
                    g = fn(a, lo, hi, x, hs4); checks++; if (g !== wl) bad(name, g, wl, n, lo, hi, x, hs4);
                    g = fn(a, lo, hi, x, hs5); checks++; if (g !== wl) bad(name, g, wl, n, lo, hi, x, hs5);
                    g = fn(a, lo, hi, x, hs6); checks++; if (g !== wl) bad(name, g, wl, n, lo, hi, x, hs6);
                    perName[name] += 7;
                }
            }
        }
    }
    // Rounded-tie phase (nearest kernels only; it draws from rnd AFTER the rounds above, so their
    // stream is unchanged). opts.tieDraws pairs, 10 queries each, over [0, 2) of the pair.
    let roundedTies = 0;
    if (nears.length > 0) {
        const tc = genTieCases(T, rnd, opts.tieDraws ?? 4000);
        for (let c = 0; c < tc.length; c += 2) {
            const a = tc[c], x = tc[c + 1];
            if (isRoundedTie(a[0], x, a[1])) roundedTies++;
            const wn = naiveNearest(a, 0, 2, x);
            for (let k = 0; k < nears.length; k++) {
                const got = nears[k][1](a, 0, 2, x); checks++; perName[nears[k][0]]++;
                if (got !== wn) bad(nears[k][0], got, wn, 2, 0, 2, x);
            }
        }
    }
    return { checks, fails, msgs, perName, roundedTies };
}

// ---- golden replay (test/fixtures/golden-f64.json "stream", implemented from its text) ---
// Returns { <kernel>: [{ seed, count, sha256 }, ...] } for each kernel name in `kernels`,
// calling mod[<kernel> + 'F64']. All streams of a seed come from ONE pass, so they share
// the PRNG sequence as the fixture requires.
export function goldenReplay(mod, kernels, seeds) {
    const out = {};
    for (const k of kernels) {
        if (typeof mod[k + 'F64'] !== 'function') throw new TypeError(k + 'F64 is not a function');
        out[k] = [];
    }
    for (const seed of seeds) {
        const rnd = makeRng(seed);
        const streams = kernels.map(() => []);
        const fns = kernels.map((k) => mod[k + 'F64']);
        const isHint = kernels.map((k) => k === 'lowerBoundHint');
        for (let round = 0; round <= 69; round++) {
            const n = round;
            const a = new Float64Array(n);
            let v = -50 + rnd() * 10;
            for (let i = 0; i < n; i++) { if (rnd() < 0.7) v += (rnd() < 0.5 ? 1 : rnd() * 3); a[i] = v; }
            const qs = [NaN, -Infinity, Infinity, -1e9, 1e9];
            for (let i = 0; i < n; i++) qs.push(a[i], a[i] - 0.5, a[i] + 0.5);
            const ranges = [];
            if (n <= 24) {
                for (let lo = 0; lo <= n; lo++) for (let hi = lo; hi <= n; hi++) ranges.push([lo, hi]);
            } else {
                ranges.push([0, n]);
                for (let t = 0; t < 20; t++) {
                    const lo = (rnd() * (n + 1)) | 0;
                    const hi = lo + ((rnd() * (n - lo + 1)) | 0);
                    ranges.push([lo, hi]);
                }
            }
            for (const [lo, hi] of ranges) {
                for (const x of qs) {
                    const wl = naiveLower(a, lo, hi, x);
                    const hs = [lo, hi, lo - 3, hi + 3, NaN, lo + ((rnd() * (hi - lo + 1)) | 0), wl];
                    for (let k = 0; k < fns.length; k++) {
                        if (isHint[k]) for (const h of hs) streams[k].push(fns[k](a, lo, hi, x, h));
                        else streams[k].push(fns[k](a, lo, hi, x));
                    }
                }
            }
        }
        for (let k = 0; k < kernels.length; k++) {
            const s = streams[k];
            const buf = Buffer.alloc(s.length * 4);
            for (let i = 0; i < s.length; i++) {
                // Fail closed: a non-int32 answer is never truncated into a matching hash.
                if (!Number.isInteger(s[i]) || s[i] !== (s[i] | 0)) {
                    throw new TypeError(kernels[k] + 'F64 returned a non-int32 answer: ' + s[i]);
                }
                buf.writeInt32LE(s[i], i * 4);
            }
            out[kernels[k]].push({ seed, count: s.length, sha256: createHash('sha256').update(buf).digest('hex') });
        }
    }
    return out;
}
