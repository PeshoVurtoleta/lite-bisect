// test/Bisect.oracle.test.mjs -- assertion 5 (SPEC-p1 U3 T2). Every <kernel><T> export of
// Bisect.js against the naive oracle in test/oracle.mjs, generic over Object.keys(module);
// the census; golden parity with test/fixtures/golden-f64.json; and the law-9 controls.
// assertRange / assertSorted have no oracle row here: they are covered row by row in
// test/Bisect.boundary.test.mjs (oracle.mjs COVERED_ELSEWHERE), which also runs the Proxy
// cap rows in its own process (C3).
// Runtime: target < 60 s for the whole file on the dev host (measured on a stand-in module:
// ~0.3 s per type per seed; 20 type x seed runs + 2 golden passes + 3 temp-copy imports).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as B from '../Bisect.js';
import {
    TYPES, TYPE_NAMES, KERNELS, census, runOracle, goldenReplay, naiveLower, naiveNearest,
} from './oracle.mjs';

const BISECT_PATH = fileURLToPath(new URL('../Bisect.js', import.meta.url));
const GOLDEN = JSON.parse(readFileSync(new URL('./fixtures/golden-f64.json', import.meta.url), 'utf8'));
const SEEDS = [1, 12345, 777, 99];
const BIG_ROUNDS = 40;             // rounds with n = 1 + rnd() * 300 after rounds 0..69
const MIN_CHECKS = 1000000;        // per type per seed (assertion 5)
const GOLDEN_KERNELS = ['lowerBoundBranchless', 'upperBoundBranchless', 'lowerBoundBranchy',
    'upperBoundBranchy', 'lowerBoundHint'];
// The branchless `<` -> `<=` mutant: this find text must occur EXACTLY ONCE inside
// lowerBoundBranchlessF64: the loop compare of the frozen golden body
// (.handoff/p1/golden/lowerBoundBranchless.body.txt), not text read from Bisect.js.
const MUTANT_FIND = 'a[b + h] < x';
const MUTANT_REPLACE = 'a[b + h] <= x';

async function importTempCopy(text) {
    const dir = mkdtempSync(join(tmpdir(), 'lite-bisect-oracle-'));
    try {
        const p = join(dir, 'Bisect.js');
        writeFileSync(p, text);
        return await import(pathToFileURL(p).href);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

// The text of `export function <name>(` up to the next top-level `export function ` or the end.
function functionSpan(text, name) {
    const head = 'export function ' + name + '(';
    const start = text.indexOf(head);
    if (start < 0 || text.indexOf(head, start + 1) >= 0) return null;
    let end = text.indexOf('\nexport function ', start + head.length);
    if (end < 0) end = text.length;
    return { start, end };
}

function countOf(hay, needle) {
    let c = 0;
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) c++;
    return c;
}

// ---- census ---------------------------------------------------------------------------
test('census: every export of Bisect.js is covered by a row; none missing', () => {
    const keys = Object.keys(B);
    const c = census(keys);
    assert.deepEqual(c.unknown, [], 'exports with no oracle row and no boundary row');
    assert.deepEqual(c.missing, [], 'expected exports absent');
    assert.equal(c.rows.length, Object.keys(KERNELS).length * TYPE_NAMES.length);
    assert.equal(c.ok, true);
    for (const r of c.rows) assert.equal(typeof B[r.name], 'function', r.name);
});

test('census control: in-memory unknown / missing names fail', () => {
    const keys = Object.keys(B);
    const extra = census(keys.concat(['lowerBoundLinearF64']));
    assert.equal(extra.ok, false);
    assert.deepEqual(extra.unknown, ['lowerBoundLinearF64']);
    const dropped = census(keys.filter((k) => k !== 'nearestU16'));
    assert.equal(dropped.ok, false);
    assert.deepEqual(dropped.missing, ['nearestU16']);
});

test('census control: a Bisect.js copy with an extra dummy export fails the census', async () => {
    const text = readFileSync(BISECT_PATH, 'utf8');
    const mod = await importTempCopy(text + '\nexport function zzz() {}\n');
    assert.equal(typeof mod.zzz, 'function', 'the dummy export was not loaded (control NOT-APPLIED)');
    const c = census(Object.keys(mod));
    assert.equal(c.ok, false);
    assert.deepEqual(c.unknown, ['zzz']);
    assert.deepEqual(c.missing, []);
});

// ---- oracle, every export x type x seed ------------------------------------------------
for (const T of TYPE_NAMES) {
    test('oracle ' + T + ': seeds ' + SEEDS.join(' / ') + ', 0 FAIL, >= 1,000,000 checks per seed', () => {
        const expected = Object.keys(KERNELS).map((k) => k + T).sort();
        for (const seed of SEEDS) {
            const r = runOracle(B, T, seed, { bigRounds: BIG_ROUNDS });
            assert.deepEqual(Object.keys(r.perName).sort(), expected, T + ' kernels run');
            for (const name of expected) assert.ok(r.perName[name] > 0, name + ' ran 0 checks');
            assert.equal(r.fails, 0, T + ' seed ' + seed + ': ' + r.fails + ' FAIL\n' + r.msgs.join('\n'));
            assert.ok(r.checks >= MIN_CHECKS, T + ' seed ' + seed + ': checks ' + r.checks + ' < ' + MIN_CHECKS);
            // R-ORACLE coverage floor: the rounded-tie phase must reach >= 1000 false rounded ties where
            // they exist (F64 / F32 / I32); on U32 / U16 none exists (an integer pair has an exact midpoint).
            if (T === 'F64' || T === 'F32' || T === 'I32') {
                assert.ok(r.roundedTies >= 1000, T + ' seed ' + seed + ': rounded ties ' + r.roundedTies + ' < 1000');
            }
            console.log('oracle ' + T + ' seed ' + seed + ' checks ' + r.checks + ' fails ' + r.fails + ' roundedTies ' + r.roundedTies);
        }
    });
}

// ---- oracle controls: each row has a local mutant that fails on that row alone ---------
// Test-local kernels (a branchy binary search written here, NOT from Bisect.js). The
// correct local set must pass with checks > 0; each mutant must be caught (fails > 0).
const okLower = (a, lo, hi, x) => { while (lo < hi) { const m = (lo + hi) >>> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; };
const okUpper = (a, lo, hi, x) => { while (lo < hi) { const m = (lo + hi) >>> 1; if (a[m] <= x) lo = m + 1; else hi = m; } return lo; };
const badLower = (a, lo, hi, x) => { while (lo < hi) { const m = (lo + hi) >>> 1; if (a[m] <= x) lo = m + 1; else hi = m; } return lo; };
const badUpper = (a, lo, hi, x) => okLower(a, lo, hi, x);
const okHint = (a, lo, hi, x, h) => okLower(a, lo, hi, x);
const badHint = (a, lo, hi, x, h) => (x !== x && h >= lo && h <= hi ? h : okLower(a, lo, hi, x));   // B1 mutant
const okSeg = (a, lo, hi, x) => okUpper(a, lo, hi, x) - 1;
const badSeg = (a, lo, hi, x) => okLower(a, lo, hi, x) - 1;
// The nearest control decides the distance comparison EXACTLY (R-ORACLE), never with the kernel's
// rounded x - a[i - 1] <= a[i] - x: each finite double is split by a DataView into a BigInt
// mantissa and a power of two, both sides are scaled to the smaller exponent, then compared.
// Written here, apart from oracle.mjs's exactUnits, so the control and the oracle share no code.
const DV = new DataView(new ArrayBuffer(8));
const split = (v) => {                       // finite v = m * 2^e, m a BigInt
    DV.setFloat64(0, v);
    const hi = DV.getUint32(0), lo = DV.getUint32(4);
    const be = (hi >>> 20) & 0x7ff;
    let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    if (be !== 0) m |= 1n << 52n;
    return { m: hi >>> 31 ? -m : m, e: (be === 0 ? 1 : be) - 1075 };
};
const exactCmp = (d0p, d0n, d1p, d1n) => {  // sign of (d0p - d0n) - (d1p - d1n), all finite doubles
    const t = [split(d0p), split(d0n), split(d1p), split(d1n)];
    let e = t[0].e;
    for (const s of t) if (s.e < e) e = s.e;
    const v = t.map((s) => s.m << BigInt(s.e - e));
    const d = (v[0] - v[1]) - (v[2] - v[3]);
    return d < 0n ? -1 : d > 0n ? 1 : 0;
};
const nearestWith = (le) => (a, lo, hi, x) => {
    const i = okLower(a, lo, hi, x);
    if (i === lo) return lo;
    if (i === hi) return hi - 1;
    const p = a[i - 1], q = a[i];
    if (q === x) return i;               // an exact match (a[i] >= x) wins, Infinity included
    // Infinities by case (x is finite between p < x < q): an infinite distance loses; both -> tie.
    const c = p === -Infinity || q === Infinity ? (p === -Infinity ? 1 : 0) - (q === Infinity ? 1 : 0)
        : exactCmp(x, p, q, x);
    return le ? (c <= 0 ? i - 1 : i) : (c < 0 ? i - 1 : i);
};
const okNear = nearestWith(true);
const badNear = nearestWith(false);   // tie -> UPPER index
const CONTROL_ROWS = [
    ['lowerBoundBranchy', okLower, badLower],
    ['upperBoundBranchless', okUpper, badUpper],
    ['lowerBoundHint', okHint, badHint],
    ['segment', okSeg, badSeg],
    ['nearest', okNear, badNear],
];

test('oracle controls: the correct local kernels pass; each local mutant is caught', () => {
    for (const T of TYPE_NAMES) {
        const good = {};
        for (const [k, ok] of CONTROL_ROWS) good[k + T] = ok;
        const g = runOracle(good, T, 12345, { smallRounds: 30 });
        assert.equal(g.fails, 0, 'correct local set ' + T + '\n' + g.msgs.join('\n'));
        assert.ok(g.checks > 0);
        for (const [k, ok, bad] of CONTROL_ROWS) {
            const m = {};
            for (const [k2, ok2] of CONTROL_ROWS) m[k2 + T] = k2 === k ? bad : ok2;
            const r = runOracle(m, T, 12345, { smallRounds: 30 });
            assert.ok(r.fails > 0, 'mutant ' + k + T + ' NOT caught');
            for (const msg of r.msgs) assert.ok(msg.startsWith(k + T + ' '), 'a non-mutated row failed: ' + msg);
        }
    }
});

test('R-ORACLE: naiveNearest and the local nearest control decide rounded ties exactly (literal answers)', () => {
    // [type, values, x, exact nearest]: the rounded x - a[L] <= a[U] - x says 0 on every `1` row.
    const rows = [
        ['F64', [-3, 4], 0.5000000000000001, 1], ['F32', [-3, 4], 0.5000000000000001, 1],
        ['I32', [-3, 4], 0.5000000000000001, 1], ['I32', [-1, 1], 1e-17, 1], ['F64', [-(2 ** 53), 2 ** 53 + 4], 2.5, 1],
        ['F64', [-2, -1e-17], -1, 1], ['F64', [-1e-300, 6], 3, 1], ['F64', [-Infinity, 1e308], -1e308, 1],
        ['I32', [-2147483648, 2147483647], -0.4999999999999999, 1], ['F32', [-(2 ** 60), 2 ** 60 + 2 ** 38], 2 ** 37 + 1, 1],
        ['F64', [5e-324, 2.5e-323], 1.5e-323, 0], ['F64', [-Infinity, Infinity], 0, 0], ['F64', [-Infinity, 5], 1, 1],
        ['F64', [1, Infinity], 1e300, 0], ['F64', [1, Infinity], Infinity, 1], ['U16', [1, 3], 2, 0], ['F64', [1, 3, 3, 5, 8], 4, 2],
    ];
    for (const [T, vals, x, want] of rows) {
        const a = TYPES[T].from(vals), tag = T + ' [' + vals.join(', ') + '] x=' + x;
        assert.equal(naiveNearest(a, 0, a.length, x), want, 'naiveNearest ' + tag);
        assert.equal(okNear(a, 0, a.length, x), want, 'okNear ' + tag);
    }
});

// ---- golden parity -----------------------------------------------------------------------
test('golden parity: the 5 F64 kernels replay golden-f64.json, both seeds, count + sha256', () => {
    assert.deepEqual(Object.keys(GOLDEN.kernels).sort(), GOLDEN_KERNELS.slice().sort());
    assert.deepEqual(GOLDEN.seeds, [12345, 777]);
    const got = goldenReplay(B, GOLDEN_KERNELS, GOLDEN.seeds);
    for (const k of GOLDEN_KERNELS) {
        assert.deepEqual(got[k], GOLDEN.kernels[k], k + 'F64 golden');
    }
});

test('golden control: the branchless `<` -> `<=` mutant changes the lowerBoundBranchless hash', async () => {
    const text = readFileSync(BISECT_PATH, 'utf8');
    const span = functionSpan(text, 'lowerBoundBranchlessF64');
    assert.ok(span, 'NOT-APPLIED: lowerBoundBranchlessF64 not found exactly once');
    const body = text.slice(span.start, span.end);
    const hits = countOf(body, MUTANT_FIND);
    assert.equal(hits, 1, 'NOT-APPLIED: "' + MUTANT_FIND + '" matches ' + hits + ' times in lowerBoundBranchlessF64');
    const mutated = text.slice(0, span.start) + body.replace(MUTANT_FIND, MUTANT_REPLACE) + text.slice(span.end);
    assert.notEqual(mutated, text);
    // Control of the control: the unmutated temp copy reproduces the golden hash, so the
    // difference below comes from the mutation, not from the copy / import path.
    const plain = goldenReplay(await importTempCopy(text), ['lowerBoundBranchless'], GOLDEN.seeds);
    assert.deepEqual(plain.lowerBoundBranchless, GOLDEN.kernels.lowerBoundBranchless);
    const mut = goldenReplay(await importTempCopy(mutated), ['lowerBoundBranchless'], GOLDEN.seeds);
    for (let i = 0; i < GOLDEN.seeds.length; i++) {
        assert.notEqual(mut.lowerBoundBranchless[i].sha256, GOLDEN.kernels.lowerBoundBranchless[i].sha256,
            'mutant hash equals golden at seed ' + GOLDEN.seeds[i]);
    }
});

test('golden replay self-check: the naive lower reproduces the lowerBound golden hashes', () => {
    // The oracle itself, run through the replay as a stand-in kernel, must hash to the golden
    // value (the golden was cut from the frozen draft; agreement here ties oracle and fixture).
    const mod = { lowerBoundBranchyF64: naiveLower };
    const got = goldenReplay(mod, ['lowerBoundBranchy'], GOLDEN.seeds);
    assert.deepEqual(got.lowerBoundBranchy, GOLDEN.kernels.lowerBoundBranchy);
});
