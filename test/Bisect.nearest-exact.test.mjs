// nearest<T> exactness (audit B3, AU-R1 / R-NEAREST). Oracle independent of test/oracle.mjs:
// every expected value comes from the contract (closest in EXACT arithmetic; exact tie -> lower
// index; exact match wins; past an end -> lo / hi - 1; NaN query -> lo; lo === hi -> lo) and from
// a BigInt reference below (each double as an integer in units of 2^-1074; no float subtraction).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../Bisect.js';

const CTOR = { F64: Float64Array, F32: Float32Array, U32: Uint32Array, U16: Uint16Array, I32: Int32Array };
const TYPES = ['F64', 'F32', 'U32', 'U16', 'I32'];
const NI = Infinity;

// ---- A-N1 fixed rows --------------------------------------------------------------------
// [types, array, x, want]
const ROWS = [
    [['F64', 'F32', 'I32'], [-3, 4], 0.5000000000000001, 1],
    [['F64', 'F32', 'I32'], [-1, 1], 1e-17, 1],
    [['F64'], [-(2 ** 53), 2 ** 53 + 4], 2.5, 1],
    [['F64'], [-NI, 1e308], -1e308, 1],
    [['F64'], [-2, -1e-17], -1, 1],
    [['F64'], [-1e-300, 6], 3, 1],
    [['I32'], [-2147483648, 2147483647], -0.4999999999999999, 1],
    [['F32'], [-(2 ** 60), 2 ** 60 + 2 ** 38], 2 ** 37 + 1, 1],
    // unchanged behaviour
    [['F64'], [-NI, NI], 0, 0],
    [['F64'], [-NI, 5], 1, 1],
    [['F64'], [1, NI], 1e300, 0],
    [['F64'], [1, NI], NI, 1],
    [TYPES, [1, 3], 2, 0],                 // true tie -> lower
    [TYPES, [1, 3, 3, 5, 8], 4, 2],        // README example: 3 / 5 tie around x = 4 -> index 2
    // contract edges
    [TYPES, [1, 3], 0, 0],
    [TYPES, [1, 3], 9, 1],
    [TYPES, [1, 3], 3, 1],
    [TYPES, [1, 3], 1, 0],
    [TYPES, [1, 3], NaN, 0],
    [['F64', 'F32'], [1, 3], -NI, 0],
    [['F64', 'F32'], [1, 3], NI, 1],
];
for (const [types, arr, x, want] of ROWS) {
    for (const T of types) {
        test(`fixed ${T} [${arr.join(',')}] x=${x} -> ${want}`, () => {
            const a = CTOR[T].from(arr);
            assert.equal(B['nearest' + T](a, 0, a.length, x), want);
            // sub-range: same answer shifted, with junk padding either side
            const p = new CTOR[T](a.length + 2);
            p.set(a, 1);
            assert.equal(B['nearest' + T](p, 1, 1 + a.length, x), want + 1);
        });
    }
}
for (const T of TYPES) {
    test(`fixed ${T} lo === hi -> lo`, () => {
        const a = CTOR[T].from([1, 2, 3]);
        assert.equal(B['nearest' + T](a, 2, 2, 2.5), 2);
        assert.equal(B['nearest' + T](a, 0, 0, 2.5), 0);
    });
}

// ---- reference --------------------------------------------------------------------------
const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer), u32 = new Uint32Array(f64.buffer);
function toBig(v) {                               // finite double -> integer in units of 2^-1074
    f64[0] = v;
    const b = u64[0];
    const e = Number((b >> 52n) & 0x7ffn);
    const f = b & 0xfffffffffffffn;
    const m = e === 0 ? f : (f | (1n << 52n));
    const r = m << BigInt(e === 0 ? 0 : e - 1);
    return (b >> 63n) ? -r : r;
}
const stat = { ties: 0, falseTies: 0 };
// a strictly ascending in [lo, hi); returns the contract index (absolute), counting coverage.
function refNearest(a, lo, hi, x) {
    if (lo === hi || x !== x) return lo;
    let i = lo;
    while (i < hi && a[i] < x) i++;               // native compare is exact
    if (i === lo) return lo;
    if (i === hi) return hi - 1;
    const p = a[i - 1], q = a[i];
    const inf0 = p === -NI, inf1 = q === NI && x !== NI;
    if (inf0 || inf1) {
        if (inf0 && inf1) return i - 1;
        return inf0 ? i : i - 1;
    }
    const bx = toBig(x);
    const d0 = bx - toBig(p), d1 = toBig(q) - bx;
    if (d0 === d1) stat.ties++;
    else if (x - p === q - x) stat.falseTies++;  // float subtraction rounds to a tie, exact differs
    return d0 <= d1 ? i - 1 : i;
}

// ---- generators -------------------------------------------------------------------------
function xorshift(seed) {                          // 32-bit xorshift; all steps kept in uint32
    let s = seed >>> 0 || 1;
    return () => {
        s = (s ^ (s << 13)) >>> 0;
        s = (s ^ (s >>> 17)) >>> 0;
        s = (s ^ (s << 5)) >>> 0;
        return s;
    };
}
const rand01 = (r) => r() / 4294967296;
function pow2(e) {                                 // exact 2^e, e in [-1074, 1023]
    f64[0] = 0;
    if (e >= -1022) { u32[1] = (e + 1023) << 20; }
    else if (e >= -1042) { u32[1] = 1 << (e + 1074 - 32); }
    else { u32[0] = (1 << (e + 1074)) >>> 0; }
    return f64[0];
}
function stepUlp(x, j) {                           // x moved j representable doubles toward +inf
    if (x !== x || x === NI || x === -NI) return x;
    f64[0] = x;
    const b = u64[0];
    const mag = b & 0x7fffffffffffffffn;
    let k = (b >> 63n) ? -mag : mag;
    k += BigInt(j);
    const m = k < 0n ? -k : k;
    if (m > 0x7fefffffffffffffn) return x;
    u64[0] = k < 0n ? (m | (1n << 63n)) : m;
    return f64[0];
}
function wide(rk, T) {                             // random signed value, magnitude spread
    const s = (rk() & 1) ? -1 : 1;
    if (T === 'F32') {
        const e = (rk() % 241) - 120;
        return Math.fround(s * (1 + rand01(rk) * (1 - 2 ** -24)) * pow2(e));
    }
    const near = (rk() & 3) === 0;
    const e = near ? (rk() % 121) - 60 : (rk() % 2098) - 1074;   // 2098 -> [-1074, 1023]
    if (e >= -1022) return s * (1 + rand01(rk) * (1 - 2 ** -52)) * pow2(e);
    return s * pow2(e) * (1 + (rk() % 1000));                    // subnormal, rounds as the hardware does
}
const INT = { U32: [0, 4294967295], U16: [0, 65535], I32: [-2147483648, 2147483647] };
function rint(rk, bits) { const b = 1 + (rk() % bits); return Math.floor((rk() >>> (32 - b))); }

// key stream: sorted distinct values for type T (plain numbers, already representable)
function keys(rk, T) {
    const v = [];
    const mode = rk() & 3;
    if (T === 'F64' || T === 'F32') {
        const maxE = T === 'F32' ? 100 : 1000;
        if (mode === 0) {                           // exact tie: p, p + 2g, centre representable
            const s = pow2((rk() % (2 * maxE + 1)) - maxE);
            const p = ((rk() % 4096) - 2048) * s, g = (1 + rk() % 2048) * s;
            v.push(p, p + 2 * g);
        } else if (mode === 1) {                    // [-A, A + D], D much smaller: fine ulp mid, coarse ends
            const A = Math.abs(wide(rk, T)) || 1;
            const D = A * pow2(-(1 + (rk() % 60)));
            v.push(-A, A + D);
        } else if (mode === 2) {                    // same sign, coarse
            const p = wide(rk, T);
            v.push(p, p + p * pow2(-(1 + (rk() % 30))));
        } else {
            v.push(wide(rk, T), wide(rk, T));
        }
        if (T === 'F64' && (rk() & 15) === 0) v.push((rk() & 1) ? NI : -NI);
        for (let n = rk() % 4; n > 0; n--) v.push(wide(rk, T));
    } else {
        const [L, H] = INT[T];
        const bits = T === 'U16' ? 16 : 32;
        if (mode === 0) {
            const p = L + rint(rk, bits) % (H - L - 1), g = 1 + rint(rk, bits) % 1000;
            v.push(p, p + 2 * g);
        } else if (mode === 1) {
            let A = Math.min(rint(rk, bits) % (H - 1) + 1, H - 1);
            if (T === 'I32' && (rk() & 1)) A = 1073741824 + (rk() >>> 3) % 1000000000;   // coarse ends
            const D = 1 + rint(rk, 12) % Math.max(1, H - A);
            if (L < 0) v.push(-A, A + D > H ? H : A + D); else v.push(A, Math.min(H, A + D));   // I32: [-A, A + D]
        } else {
            v.push(L + rint(rk, bits) % (H - L + 1), L + rint(rk, bits) % (H - L + 1));
        }
        for (let n = mode === 1 && (rk() & 3) ? 0 : rk() % 4; n > 0; n--) v.push(L + rint(rk, bits) % (H - L + 1));
    }
    const a = CTOR[T].from(v);                      // coercion to the stored type
    const s = Array.from(a).filter((z) => z === z).sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i < s.length; i++) if (i === 0 || s[i] !== s[i - 1]) out.push(s[i]);
    return out;
}
// op stream: a query for the sorted values
function query(ro, vals) {
    const r = ro() % 10;
    if (T_SPECIAL && r === 0) return (ro() & 1) ? NI : -NI;
    const n = vals.length;
    const j = (ro() % 7) - 3;
    if (n < 2 || r === 1) return stepUlp(vals[ro() % n], j);
    const pi = ro() % (n - 1);
    const p = vals[pi], q = vals[pi + 1];
    if (r === 2) return p + rand01(ro) * (q - p);
    let mid = p / 2 + q / 2;
    if (!Number.isFinite(mid)) mid = 0;
    if (r === 3) return mid + ((ro() & 1) ? -1 : 1) * rand01(ro) * pow2(-(ro() % 70)) * Math.abs(q - p || 1);
    return stepUlp(mid, j);
}
let T_SPECIAL = false;

const DRAWS = 100000;
const SEEDS = { F64: [0x9e3779b9, 0x85ebca6b], F32: [0xc2b2ae35, 0x27d4eb2f], U32: [0x165667b1, 0xd3a2646c],
                U16: [0xfd7046c5, 0xb55a4f09], I32: [0x68e31da4, 0x1b873593] };   // [key seed, op seed]
for (const T of TYPES) {
    test(`fuzz ${T}: ${DRAWS} draws agree with the exact reference`, () => {
        const rk = xorshift(SEEDS[T][0]), ro = xorshift(SEEDS[T][1]);
        const fn = B['nearest' + T];
        T_SPECIAL = T === 'F64';
        stat.ties = 0; stat.falseTies = 0;
        const buf = new CTOR[T](8);
        let wrong = 0, first = '';
        for (let d = 0; d < DRAWS; d++) {
            const vals = keys(rk, T);
            const x = query(ro, vals);
            const n = vals.length;
            for (let i = 0; i < n; i++) buf[i + 1] = vals[i];
            const want = refNearest(buf, 1, 1 + n, x);
            const got = fn(buf, 1, 1 + n, x);
            if (got !== want) { wrong++; if (!first) first = `[${vals.join(',')}] x=${x} got ${got - 1} want ${want - 1}`; }
        }
        const msg = `${T}: wrong=${wrong} ties=${stat.ties} falseRoundedTies=${stat.falseTies} ${first}`;
        if (process.env.NEAREST_EXACT_REPORT) console.log(msg);
        assert.equal(wrong, 0, msg);
        assert.ok(stat.ties >= 1000, 'exact tie floor: ' + msg);
        if (T === 'U32' || T === 'U16') {
            // Documented fact: x - p and q - x are exact for non-negative integers p <= x <= q < 2^53.
            assert.equal(stat.falseTies, 0, msg);
        } else {
            assert.ok(stat.falseTies >= 1000, 'false rounded tie floor: ' + msg);
        }
    });
}
