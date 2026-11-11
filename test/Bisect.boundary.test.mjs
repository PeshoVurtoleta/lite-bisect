// test/Bisect.boundary.test.mjs -- SPEC-p1 U3 T3 + assertion 3. A stated outcome per row
// (literal expected values, not the oracle). This file is the row for assertRange /
// assertSorted in the oracle census, and it runs the Proxy cap rows: it is its OWN
// node --test process, so the megamorphic feedback a Proxy leaves in every kernel cannot
// reach another gate (LEDGER C3, SPEC R4).
// Law 4: kernels carry no guard. A non-integer range is NEVER passed to a kernel (the
// branchless body does not terminate on e.g. [0.5, 2)); only assertRange sees one.
// Every call that could hang (caller-error ranges, the 2^30 - 1 cap) runs first through a
// Proxy with a read budget that THROWS after ~1e6 gets, so a hang is a FAIL, not a stall.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../Bisect.js';
import { TYPES, KERNELS } from './oracle.mjs';

// The type and family registries come from oracle.mjs (the one the census checks), so a new
// family or type can never silently skip the rows below.
const ALL = Object.keys(TYPES);
const FAMILIES = Object.keys(KERNELS);
const P30 = 2 ** 30;

function fn(name) {
    const f = B[name];
    assert.equal(typeof f, 'function', name + ' is not an exported function');
    return f;
}

// The expected answer of family `fam` from a want record { lower, upper, segment, nearest }.
// An unknown KERNELS kind THROWS: a family with no stated outcome is a FAIL, never a skip.
function expectedFor(fam, want) {
    const kind = KERNELS[fam];
    if (kind === 'lower' || kind === 'hint') return want.lower;
    if (kind === 'upper') return want.upper;
    if (kind === 'segment') return want.segment;
    if (kind === 'nearest') return want.nearest;
    throw new Error('boundary: no stated outcome for kernel kind ' + kind + ' (' + fam + ')');
}

// Every family of type T on (a, lo, hi, x); the hint runs at every h in hs.
// want = { lower, upper, segment, nearest }; the hint must return `lower`.
function checkAll(T, a, lo, hi, x, want, tag, hs = [lo, hi, lo - 3, hi + 3, NaN, (lo + hi) >>> 1]) {
    const t = tag + ' ' + T + ' [' + lo + ',' + hi + ') x=' + (Object.is(x, -0) ? '-0' : x);
    for (const fam of FAMILIES) {
        const f = fn(fam + T), w = expectedFor(fam, want);
        if (KERNELS[fam] === 'hint') {
            for (const h of hs) assert.equal(f(a, lo, hi, x, h), w, fam + t + ' h=' + h);
        } else {
            assert.equal(f(a, lo, hi, x), w, fam + t);
        }
    }
}
const W = (lower, upper, segment, nearest) => ({ lower, upper, segment, nearest });

// rows: [types, values, lo, hi, x, W(lower, upper, segment, nearest), label]
const SIGNED = ['F64', 'F32', 'I32'];
const ROWS = [
    // -0 / +0 in the array and in the query (I32 stores -0 as 0: same answers).
    [SIGNED, [-1, -0, 0, 1], 0, 4, 0, W(1, 3, 2, 1), '-0/+0'],
    [SIGNED, [-1, -0, 0, 1], 0, 4, -0, W(1, 3, 2, 1), '-0/+0'],
    [SIGNED, [-1, 0, -0, 1], 0, 4, -0, W(1, 3, 2, 1), '-0/+0'],
    [['F64', 'F32'], [-0, -0], 0, 2, 0, W(0, 2, 1, 0), '-0/+0'],
    [ALL, [0, 0, 1], 0, 3, -0, W(0, 2, 1, 0), '-0/+0'],
    // length 1
    [ALL, [5], 0, 1, 5, W(0, 1, 0, 0), 'length-1'],
    [ALL, [5], 0, 1, 4, W(0, 0, -1, 0), 'length-1'],
    [ALL, [5], 0, 1, 6, W(1, 1, 0, 0), 'length-1'],
    [ALL, [5], 0, 1, 4.5, W(0, 0, -1, 0), 'length-1'],
    [ALL, [5], 0, 1, 5.5, W(1, 1, 0, 0), 'length-1'],
    [ALL, [5], 0, 1, NaN, W(0, 0, -1, 0), 'length-1'],
    [ALL, [5], 0, 1, Infinity, W(1, 1, 0, 0), 'length-1'],
    [ALL, [5], 0, 1, -Infinity, W(0, 0, -1, 0), 'length-1'],
    // all equal
    [ALL, [7, 7, 7, 7], 0, 4, 7, W(0, 4, 3, 0), 'all-equal'],
    [ALL, [7, 7, 7, 7], 0, 4, 6, W(0, 0, -1, 0), 'all-equal'],
    [ALL, [7, 7, 7, 7], 0, 4, 8, W(4, 4, 3, 3), 'all-equal'],
    [ALL, [7, 7, 7, 7], 1, 3, 7, W(1, 3, 2, 1), 'all-equal'],
    [ALL, [7, 7, 7, 7], 1, 3, 6, W(1, 1, 0, 1), 'all-equal'],
    [ALL, [7, 7, 7, 7], 1, 3, 8, W(3, 3, 2, 2), 'all-equal'],
    [ALL, [7, 7, 7, 7], 0, 4, NaN, W(0, 0, -1, 0), 'all-equal'],
    // empty array
    [ALL, [], 0, 0, 1, W(0, 0, -1, 0), 'empty'],
    [ALL, [], 0, 0, NaN, W(0, 0, -1, 0), 'empty'],
    // lo === hi on a non-empty array
    [ALL, [1, 2, 3], 2, 2, 0, W(2, 2, 1, 2), 'lo===hi'],
    [ALL, [1, 2, 3], 2, 2, 2, W(2, 2, 1, 2), 'lo===hi'],
    [ALL, [1, 2, 3], 2, 2, 5, W(2, 2, 1, 2), 'lo===hi'],
    [ALL, [1, 2, 3], 2, 2, NaN, W(2, 2, 1, 2), 'lo===hi'],
    [ALL, [1, 2, 3], 3, 3, 9, W(3, 3, 2, 3), 'lo===hi'],
    // hi - lo = 1
    [ALL, [1, 2, 3], 1, 2, 2, W(1, 2, 1, 1), 'hi-lo=1'],
    [ALL, [1, 2, 3], 1, 2, 1, W(1, 1, 0, 1), 'hi-lo=1'],
    [ALL, [1, 2, 3], 1, 2, 3, W(2, 2, 1, 1), 'hi-lo=1'],
    [ALL, [1, 2, 3], 1, 2, 1.5, W(1, 1, 0, 1), 'hi-lo=1'],
    [ALL, [1, 2, 3], 1, 2, 2.5, W(2, 2, 1, 1), 'hi-lo=1'],
    [ALL, [1, 2, 3], 1, 2, NaN, W(1, 1, 0, 1), 'hi-lo=1'],
    // subnormals (F64; one F32 row at 2^-149)
    [['F64'], [-5e-324, 0, 5e-324, 1e-310], 0, 4, 5e-324, W(2, 3, 2, 2), 'subnormal'],
    [['F64'], [-5e-324, 0, 5e-324, 1e-310], 0, 4, 0, W(1, 2, 1, 1), 'subnormal'],
    [['F64'], [-5e-324, 0, 5e-324, 1e-310], 0, 4, -0, W(1, 2, 1, 1), 'subnormal'],
    [['F64'], [-5e-324, 0, 5e-324, 1e-310], 0, 4, -5e-324, W(0, 1, 0, 0), 'subnormal'],
    [['F64'], [-5e-324, 0, 5e-324, 1e-310], 0, 4, 1e-320, W(3, 3, 2, 2), 'subnormal'],
    [['F64'], [-5e-324, 0, 5e-324, 1e-310], 0, 4, 1e-310, W(3, 4, 3, 3), 'subnormal'],
    [['F32'], [0, 2 ** -149, 2 ** -140], 0, 3, 2 ** -149, W(1, 2, 1, 1), 'subnormal'],
    // U32 around 2^31 and 2^32 (values and queries)
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, 2 ** 31 - 1, W(0, 1, 0, 0), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, 2 ** 31, W(1, 2, 1, 1), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, 2 ** 31 + 1, W(2, 3, 2, 2), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, 2 ** 31 + 0.5, W(2, 2, 1, 1), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, 2 ** 32 - 1.5, W(4, 4, 3, 3), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, 2 ** 32 - 1, W(4, 5, 4, 4), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, 2 ** 32, W(5, 5, 4, 4), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, 2 ** 32 + 1, W(5, 5, 4, 4), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 0, 5, -1, W(0, 0, -1, 0), '2^31/2^32'],
    [['U32'], [2 ** 31 - 1, 2 ** 31, 2 ** 31 + 1, 2 ** 32 - 2, 2 ** 32 - 1], 2, 4, 2 ** 31, W(2, 2, 1, 2), '2^31/2^32'],
    // I32 at both ends (values -2^31, 2^31 - 1; queries 2^31 +- 1, 2^32 +- 1)
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, -(2 ** 31) - 1, W(0, 0, -1, 0), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, -(2 ** 31), W(0, 1, 0, 0), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, -(2 ** 31) + 1, W(1, 2, 1, 1), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, -(2 ** 31) + 0.5, W(1, 1, 0, 0), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, 2 ** 31 - 1.5, W(5, 5, 4, 4), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, 2 ** 31 - 1, W(5, 6, 5, 5), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, 2 ** 31, W(6, 6, 5, 5), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, 2 ** 31 + 1, W(6, 6, 5, 5), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, -(2 ** 32) - 1, W(0, 0, -1, 0), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, 2 ** 32 + 1, W(6, 6, 5, 5), '2^31/2^32'],
    [['I32'], [-(2 ** 31), -(2 ** 31) + 1, -1, 0, 2 ** 31 - 2, 2 ** 31 - 1], 0, 6, -0.5, W(3, 3, 2, 2), '2^31/2^32'],
];

test('boundary table: every kernel x type, a stated outcome per row', () => {
    let rows = 0;
    for (const [types, values, lo, hi, x, want, label] of ROWS) {
        for (const T of types) {
            const a = TYPES[T].from(values);
            for (let i = 0; i < values.length; i++) {
                assert.ok(Object.is(a[i], values[i]) || (a[i] === 0 && values[i] === 0),
                    label + ' ' + T + ': value ' + values[i] + ' not stored exactly');
            }
            checkAll(T, a, lo, hi, x, want, label);
            rows++;
        }
    }
    assert.equal(rows, ROWS.reduce((n, r) => n + r[0].length, 0), 'every (row, type) ran');
    assert.ok(rows > 0);
});

// ---- R-NEAREST (audit 2026-11-11, AU-R1): rounded ties decided exactly ---------------------------
// The rounded x - a[L] vs a[U] - x is a false tie on every `want 1` row (the exact distance to a[U]
// is smaller), so the pre-fix kernel answers 0 there. The `unchanged` rows must keep their answer.
// [types, values, lo, hi, x, W(lower, upper, segment, nearest), label]
const NEAREST_ROWS = [
    [SIGNED, [-3, 4], 0, 2, 0.5000000000000001, W(1, 1, 0, 1), 'R-NEAREST want'],
    [SIGNED, [-1, 1], 0, 2, 1e-17, W(1, 1, 0, 1), 'R-NEAREST want'],
    [['F64'], [-(2 ** 53), 2 ** 53 + 4], 0, 2, 2.5, W(1, 1, 0, 1), 'R-NEAREST want'],
    [['F64'], [-2, -1e-17], 0, 2, -1, W(1, 1, 0, 1), 'R-NEAREST want'],
    // Both rounded distances are Infinity (x - -Infinity, and 1e308 - -1e308 overflows); the exact
    // distance to 1e308 is finite (AU-R1a: the 167 B AU-R1 body answered 0 here).
    [['F64'], [-Infinity, 1e308], 0, 2, -1e308, W(1, 1, 0, 1), 'R-NEAREST want'],
    [['F64'], [-1e-300, 6], 0, 2, 3, W(1, 1, 0, 1), 'R-NEAREST want'],
    [['I32'], [-2147483648, 2147483647], 0, 2, -0.4999999999999999, W(1, 1, 0, 1), 'R-NEAREST want'],
    [['F32'], [-(2 ** 60), 2 ** 60 + 2 ** 38], 0, 2, 2 ** 37 + 1, W(1, 1, 0, 1), 'R-NEAREST want'],
    [['F64'], [-Infinity, Infinity], 0, 2, 0, W(1, 1, 0, 0), 'R-NEAREST unchanged'],
    [['F64'], [-Infinity, 5], 0, 2, 1, W(1, 1, 0, 1), 'R-NEAREST unchanged'],
    [['F64'], [1, Infinity], 0, 2, 1e300, W(1, 1, 0, 0), 'R-NEAREST unchanged'],
    [['F64'], [1, Infinity], 0, 2, Infinity, W(1, 2, 1, 1), 'R-NEAREST unchanged'],
    [ALL, [1, 3], 0, 2, 2, W(1, 1, 0, 0), 'R-NEAREST unchanged true tie'],
    [ALL, [1, 3, 3, 5, 8], 0, 5, 4, W(3, 3, 2, 2), 'R-NEAREST unchanged README'],
];
const runRow = ([types, values, lo, hi, x, want, label]) => {
    for (const T of types) {
        const a = TYPES[T].from(values);
        for (let i = 0; i < values.length; i++) {
            assert.ok(Object.is(a[i], values[i]), label + ' ' + T + ': value ' + values[i] + ' not stored exactly');
        }
        checkAll(T, a, lo, hi, x, want, label);
    }
};
for (const row of NEAREST_ROWS) {
    test(row[6] + ' ' + row[0].join('/') + ' [' + row[1].join(', ') + '] x=' + row[4] + ' -> nearest ' + row[5].nearest,
        () => runRow(row));
}

test('assertion 3: segment / nearest rows verbatim', () => {
    const seg = fn('segmentF64'), near = fn('nearestF64');
    const s = Float64Array.of(1, 2, 2, 3);
    assert.equal(seg(s, 0, 4, 2), 2);
    assert.equal(seg(s, 0, 4, 0.5), -1);
    assert.equal(seg(s, 0, 4, NaN), -1);
    assert.equal(seg(s, 2, 2, 2), 1);
    const n = Float64Array.of(1, 3);
    assert.equal(near(n, 0, 2, 2), 0);
    assert.equal(near(n, 0, 2, 2.9), 1);
    assert.equal(near(n, 0, 2, NaN), 0);
    assert.equal(near(n, 0, 2, Infinity), 1);
    assert.equal(near(n, 0, 2, -Infinity), 0);
    assert.equal(near(n, 1, 1, 2), 1);
});

// ---- caller errors ----------------------------------------------------------------------
test('assertion 3: assertRange(F64(4)) RangeError for (0,5), (1.5,2), (3,2); undefined for (0,4)', () => {
    const ar = fn('assertRange');
    const a = new Float64Array(4);
    assert.throws(() => ar(a, 0, 5), RangeError);
    assert.throws(() => ar(a, 1.5, 2), RangeError);
    assert.throws(() => ar(a, 3, 2), RangeError);
    assert.equal(ar(a, 0, 4), undefined);
});

test('assertRange caller-error rows: RangeError, never TypeError; valid ranges return undefined', () => {
    const ar = fn('assertRange');
    const a = new Float64Array(4);
    for (const [lo, hi] of [[NaN, 2], [0, NaN], [0, 2.5], [0.5, 2], [-1, 2], [0, Infinity], [-Infinity, 2], [4, 0], [2, 1]]) {
        assert.throws(() => ar(a, lo, hi), RangeError, 'assertRange(' + lo + ', ' + hi + ')');
    }
    for (const [lo, hi] of [[0, 0], [2, 2], [4, 4], [1, 3], [0, 4]]) {
        assert.equal(ar(a, lo, hi), undefined, 'assertRange(' + lo + ', ' + hi + ')');
    }
    // Non-number lo / hi / a.length: the message reports typeof, never String() (RangeError, not TypeError).
    assert.throws(() => ar(a, Object.create(null), 2), RangeError, 'assertRange(null-proto object, 2)');
    assert.throws(() => ar(a, 0, Symbol('s')), RangeError, 'assertRange(0, Symbol)');
    assert.throws(() => ar({ length: 'x' }, 0, 1), RangeError, "assertRange({ length: 'x' }, 0, 1)");
    for (const T of ALL) assert.equal(ar(new TYPES[T](3), 0, 3), undefined, T);
});

test('assertion 3 + P1-R3: assertSorted RangeError on [1,NaN] and [2,1]; passes [-0,0]', () => {
    const as = fn('assertSorted');
    assert.throws(() => as(Float64Array.of(1, NaN), 0, 2), RangeError);
    assert.throws(() => as(Float64Array.of(2, 1), 0, 2), RangeError);
    assert.equal(as(Float64Array.of(-0, 0), 0, 2), undefined);
});

test('assertSorted rows: descent per type, NaN at lo, sub-range scope, empty range, bad range first', () => {
    const as = fn('assertSorted');
    for (const T of ALL) {
        assert.throws(() => as(TYPES[T].of(1, 3, 2), 0, 3), RangeError, T + ' descent');
        assert.equal(as(TYPES[T].of(1, 2, 2, 3), 0, 4), undefined, T + ' sorted with a duplicate');
    }
    assert.throws(() => as(Float32Array.of(1, NaN), 0, 2), RangeError, 'F32 NaN');
    // Fail closed: a NaN at lo is a NaN in the range (SPEC: RangeError on a[i] !== a[i]).
    assert.throws(() => as(Float64Array.of(NaN, 1), 0, 2), RangeError, 'NaN at lo');
    assert.throws(() => as(Float64Array.of(NaN), 0, 1), RangeError, 'single NaN');
    assert.equal(as(Float64Array.of(0, -0), 0, 2), undefined, '[0, -0]');
    assert.equal(as(Float64Array.of(3, 1), 1, 1), undefined, 'empty range of an unsorted array');
    assert.equal(as(Float64Array.of(5, 1, 2), 1, 3), undefined, 'only [lo, hi) is checked');
    assert.equal(as(new Float64Array(0), 0, 0), undefined, 'empty array');
    // assertRange runs first (P1-R3): a bad range is a RangeError before any element read.
    assert.throws(() => as(Float64Array.of(1, 2), 0, 3), RangeError, 'hi > length');
    assert.throws(() => as(Float64Array.of(1, 2), 0.5, 2), RangeError, 'non-integer lo');
});

// ---- the read budget --------------------------------------------------------------------
const BUDGET = 1000000;
let reads = 0;
function budget(get) {
    return new Proxy({}, {
        get(_, key) {
            if (++reads > BUDGET) throw new Error('READ BUDGET: more than ' + BUDGET + ' reads (a hang)');
            return get(key);
        },
    });
}
function call(f, args) { reads = 0; return f(...args); }

test('caller errors lo > hi and NaN lo: every kernel x type returns a number (no throw, no hang)', () => {
    const cases = [[3, 1, 2.5], [3, 1, NaN], [4, 0, 2], [NaN, 4, 2], [NaN, 4, NaN], [NaN, 2, 1]];
    for (const T of ALL) {
        const typed = TYPES[T].of(1, 2, 3, 4);
        const view = budget((k) => typed[k]);
        for (const fam of FAMILIES) {
            const f = fn(fam + T);
            for (const [lo, hi, x] of cases) {
                const hs = KERNELS[fam] === 'hint' ? [lo, hi, 2] : [undefined];
                for (const h of hs) {
                    const args = KERNELS[fam] === 'hint' ? [lo, hi, x, h] : [lo, hi, x];
                    const tag = fam + T + '(' + args.join(', ') + ')';
                    // Budgeted Proxy first: a hang throws here, before the typed call can stall.
                    assert.equal(typeof call(f, [view, ...args]), 'number', tag + ' on the budgeted view');
                    assert.equal(typeof f(typed, ...args), 'number', tag);
                }
            }
        }
    }
});

// ---- the cap: hi - lo = 2^30 - 1 on a monotone Proxy (P1-R8, LEDGER B2) -------------------
const CAP_LEN = 2 ** 31 + 8;
const mono = budget((k) => {
    if (k === 'length') return CAP_LEN;
    if (typeof k !== 'string') return undefined;
    const i = Number(k);
    return Number.isInteger(i) && i >= 0 && i < CAP_LEN && String(i) === k ? i : undefined;
});
// Closed forms for a[i] = i on [lo, hi) (no scan, no kernel geometry).
const cfLower = (lo, hi, x) => (x !== x ? lo : Math.min(hi, Math.max(lo, Math.ceil(x))));
const cfUpper = (lo, hi, x) => (x !== x ? lo : Math.min(hi, Math.max(lo, Math.floor(x) + 1)));
// nearest decided EXACTLY (R-ORACLE), never the kernel's rounded x - f <= f + 1 - x: x - f <= f + 1 - x
// <=> 2x <= 2f + 1, and both sides are exact doubles here (2x is a power-of-two scaling, x < 2^32;
// 2f + 1 is an integer below 2^53). The assert fails closed if a row ever leaves that range.
const cfNearest = (lo, hi, x) => {
    if (hi === lo || x !== x || x <= lo) return lo;
    if (x >= hi - 1) return hi - 1;
    const f = Math.floor(x);
    if (f === x) return x;
    assert.ok(f >= 0 && 2 * f + 1 < 2 ** 53 && x < 2 ** 32, 'cfNearest: x = ' + x + ' outside the exact range');
    return 2 * x <= 2 * f + 1 ? f : f + 1;
};

test('cap: every kernel incl. the hint returns the closed-form answer at hi - lo = 2^30 - 1', () => {
    let rows = 0;
    for (const lo of [0, P30 + 5]) {
        const hi = lo + P30 - 1;
        assert.ok(hi <= CAP_LEN);
        const mid = lo + 2 ** 29;
        const xs = [lo - 5, lo, lo + 0.5, mid, mid + 0.25, mid + 0.5, mid + 0.75, hi - 1.5, hi - 1, hi - 0.5, hi, hi + 5,
            NaN, -Infinity, Infinity];
        for (const T of ALL) {
            for (const x of xs) {
                const tag = T + ' [' + lo + ',' + hi + ') x=' + x;
                const wu = cfUpper(lo, hi, x);
                const want = { lower: cfLower(lo, hi, x), upper: wu, segment: wu - 1, nearest: cfNearest(lo, hi, x) };
                for (const fam of FAMILIES) {
                    const f = fn(fam + T), w = expectedFor(fam, want);
                    if (KERNELS[fam] === 'hint') {
                        // The B2 rows: hint at hi with x <= a[lo] and NaN, plus lo / mid / outside hints.
                        for (const h of [hi, lo, mid, lo - 3, hi + 3, NaN]) {
                            assert.equal(call(f, [mono, lo, hi, x, h]), w, fam + ' ' + tag + ' h=' + h);
                        }
                    } else {
                        assert.equal(call(f, [mono, lo, hi, x]), w, fam + ' ' + tag);
                    }
                }
                rows++;
            }
        }
    }
    assert.equal(rows, 2 * ALL.length * 15);
});

test('cap control: the read budget turns a never-returning loop into a FAIL, not a stall', () => {
    // A test-local loop that never returns but reads each iteration (the B2 hang shape): the
    // budget must throw, proving the cap rows above cannot stall on a hang that reads.
    const stuck = (a, lo) => { for (;;) if (a[lo] === -1) return lo; };
    assert.throws(() => call(stuck, [mono, 0]), /READ BUDGET/);
});

test('cap: assertRange throws RangeError at hi - lo = 2^30 and returns at 2^30 - 1; reads only length', () => {
    const ar = fn('assertRange');
    const stub = { length: P30 };
    assert.throws(() => ar(stub, 0, P30), RangeError);
    assert.equal(ar(stub, 0, P30 - 1), undefined);
    assert.equal(ar(stub, 1, P30), undefined);
    const seen = new Set();
    const spy = new Proxy({}, { get(_, k) { seen.add(k); return k === 'length' ? CAP_LEN : undefined; } });
    assert.equal(ar(spy, 0, P30 - 1), undefined);
    assert.equal(ar(spy, P30 + 5, 2 * P30 + 4), undefined);
    assert.throws(() => ar(spy, P30 + 5, 2 * P30 + 5), RangeError);
    assert.throws(() => ar(spy, 0, P30), RangeError);
    for (const k of seen) assert.equal(k, 'length', 'assertRange read ' + String(k) + ' (P1-R4: only a.length)');
});
