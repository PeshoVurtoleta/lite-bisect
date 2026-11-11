// test/types.exports.test.mjs -- assertion 11 (SPEC-p1 U7 T4; rulings P1-R2, P1-R13).
// Bisect.d.ts is hand-written (P1-R2); this is its parity test against the RUNTIME module:
//   value exports of the .d.ts == Object.keys(await import('../Bisect.js'))  (0 missing, 0 extra)
//   declared arity == fn.length per export
//   param 1 == the suffix's array type (F64 Float64Array, F32 Float32Array, U32 Uint32Array,
//     U16 Uint16Array, I32 Int32Array; assertRange / assertSorted: BisectArray); every other param
//     `number`; return `number` (kernels) / `void` (asserts); BisectArray == exactly the 5-type union.
// typescript 7.0.2 has no classic JS API, so the .d.ts is read by a STRICT LINE GRAMMAR: every line is
// blank, a comment, `export function <name>(<p>: <T>, ...): <R>;` on one line, or
// `export type <name> = <T> | ...;` on one line. Any other line is a parse error = FAIL (fail closed).
// Controls (LEDGER law 9, B5 / B6): 7 mutants applied to the .d.ts TEXT (count-checked: one match or
// NOT-APPLIED = FAIL), judged by the SAME parse + compare function AND the same verdict, failing(r), as the
// real row; each must make failing(r) exactly [its own category] (one per category except parse, which the
// unparseable-line control covers). P1-R13 row: package.json top-level `types` === exports["."].types ===
// "./Bisect.d.ts", judged from the package.json TEXT; controls edit that text (field removed / mismatched).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const DTS_TEXT = readFileSync(new URL('../Bisect.d.ts', import.meta.url), 'utf8');
const PKG_TEXT = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const MOD = await import(new URL('../Bisect.js', import.meta.url).href);

// Expected values come from the SPEC (section 1, U7 T1), never from Bisect.d.ts.
const SUFFIX_TYPE = { F64: 'Float64Array', F32: 'Float32Array', U32: 'Uint32Array', U16: 'Uint16Array', I32: 'Int32Array' };
const ASSERTS = ['assertRange', 'assertSorted'];
const UNION = ['Float64Array', 'Float32Array', 'Uint32Array', 'Uint16Array', 'Int32Array'];
const TYPES_PATH = './Bisect.d.ts';

const ID = '[A-Za-z_$][A-Za-z0-9_$]*';
const FN_RE = new RegExp('^export function (' + ID + ')\\(([^()]*)\\): (' + ID + ');$');
const PARAM_RE = new RegExp('^(' + ID + '): (' + ID + ')$');
const TYPE_RE = new RegExp('^export type (' + ID + ') = ([^;]+);$');

function parseDts(text) {
    const fns = new Map();
    const types = new Map();
    const errors = [];
    let inBlock = false;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        const at = 'line ' + (i + 1) + ': ';
        if (inBlock) {
            const end = l.indexOf('*/');
            if (end >= 0) {
                inBlock = false;
                if (l.slice(end + 2).trim() !== '') errors.push(at + 'code after a comment: ' + l);
            }
            continue;
        }
        if (l === '' || l.startsWith('//')) continue;
        if (l.startsWith('/*')) {
            const end = l.indexOf('*/', 2);
            if (end < 0) inBlock = true;
            else if (l.slice(end + 2).trim() !== '') errors.push(at + 'code after a comment: ' + l);
            continue;
        }
        let m = FN_RE.exec(l);
        if (m) {
            const params = m[2].trim() === '' ? [] : m[2].split(',').map((s) => PARAM_RE.exec(s.trim()));
            if (params.some((p) => p === null)) { errors.push(at + 'cannot parse params: ' + l); continue; }
            if (fns.has(m[1])) { errors.push(at + 'duplicate declaration ' + m[1]); continue; }
            fns.set(m[1], { params: params.map((p) => ({ name: p[1], type: p[2] })), ret: m[3] });
            continue;
        }
        m = TYPE_RE.exec(l);
        if (m) {
            if (types.has(m[1])) { errors.push(at + 'duplicate type ' + m[1]); continue; }
            types.set(m[1], m[2].split('|').map((s) => s.trim()));
            continue;
        }
        errors.push(at + 'cannot parse: ' + l);
    }
    if (inBlock) errors.push('unterminated block comment');
    return { fns, types, errors };
}

function expectedArrayType(name) {
    if (ASSERTS.includes(name)) return 'BisectArray';
    const m = /(F64|F32|U32|U16|I32)$/.exec(name);
    return m ? SUFFIX_TYPE[m[1]] : null;
}

// The one verdict path: .d.ts TEXT + the runtime module -> a problem list per category.
function compareDts(dtsText, mod) {
    const p = parseDts(dtsText);
    const keys = Object.keys(mod);
    const r = { parse: p.errors, missing: [], extra: [], arity: [], arrayType: [], params: [], returns: [], union: [] };
    for (const k of keys) if (!p.fns.has(k)) r.missing.push(k);
    for (const [k, d] of p.fns) {
        if (!keys.includes(k)) { r.extra.push(k); continue; }
        if (d.params.length !== mod[k].length) r.arity.push(k + ' declared ' + d.params.length + ' fn.length ' + mod[k].length);
        const want = expectedArrayType(k);
        if (want === null || d.params.length === 0 || d.params[0].type !== want) {
            r.arrayType.push(k + ' param 1 ' + (d.params[0] ? d.params[0].type : '(none)') + ' want ' + want);
        }
        for (let i = 1; i < d.params.length; i++) if (d.params[i].type !== 'number') r.params.push(k + ' param ' + (i + 1) + ' ' + d.params[i].type);
        const wantRet = ASSERTS.includes(k) ? 'void' : 'number';
        if (d.ret !== wantRet) r.returns.push(k + ' returns ' + d.ret + ' want ' + wantRet);
    }
    const u = p.types.get('BisectArray');
    if (!u || u.length !== UNION.length || [...u].sort().join('|') !== [...UNION].sort().join('|')) {
        r.union.push('BisectArray = ' + (u ? u.join(' | ') : '(missing)'));
    }
    for (const t of p.types.keys()) if (t !== 'BisectArray') r.union.push('unexpected type export ' + t);
    return r;
}

const CATEGORIES = ['parse', 'missing', 'extra', 'arity', 'arrayType', 'params', 'returns', 'union'];

// The verdict: the categories with a problem. The real row AND every control read this, never one category.
function failing(r) { return CATEGORIES.filter((c) => r[c].length !== 0); }

function replaceOnce(text, find, repl, label) {
    const n = text.split(find).length - 1;
    assert.equal(n, 1, label + ' NOT-APPLIED: find text matches ' + n + ' times');
    return text.replace(find, () => repl);
}

// P1-R13: judged from the package.json TEXT.
function checkTypesField(pkgText) {
    const p = JSON.parse(pkgText);
    const problems = [];
    const top = p.types;
    const ex = p.exports && p.exports['.'] && p.exports['.'].types;
    if (top !== TYPES_PATH) problems.push('top-level types = ' + JSON.stringify(top));
    if (ex !== TYPES_PATH) problems.push('exports["."].types = ' + JSON.stringify(ex));
    if (top !== ex) problems.push('top-level types !== exports["."].types');
    return problems;
}

test('Bisect.d.ts parity with Bisect.js: exports, arity, array types (0 problems)', () => {
    const r = compareDts(DTS_TEXT, MOD);
    assert.deepEqual(failing(r), [], JSON.stringify(r));
    assert.equal(Object.keys(MOD).length, 37, 'the census expects 37 exports');
});

const MUTANTS = [
    {
        label: 'drop a declaration', category: 'missing', name: 'nearestI32',
        find: 'export function nearestI32(a: Int32Array, lo: number, hi: number, x: number): number;\n', repl: '',
    },
    {
        label: 'add a phantom', category: 'extra', name: 'lowerBoundLinearF64',
        find: 'export function assertSorted(',
        repl: 'export function lowerBoundLinearF64(a: Float64Array, lo: number, hi: number, x: number): number;\nexport function assertSorted(',
    },
    {
        label: 'swap one F64 -> F32 param type', category: 'arrayType', name: 'lowerBoundBranchyF64',
        find: 'export function lowerBoundBranchyF64(a: Float64Array,', repl: 'export function lowerBoundBranchyF64(a: Float32Array,',
    },
    {
        label: 'arity + 1', category: 'arity', name: 'segmentU16',
        find: 'export function segmentU16(a: Uint16Array, lo: number, hi: number, x: number): number;',
        repl: 'export function segmentU16(a: Uint16Array, lo: number, hi: number, x: number, y: number): number;',
    },
    {
        label: 'return number -> any', category: 'returns', name: 'segmentI32',
        find: 'export function segmentI32(a: Int32Array, lo: number, hi: number, x: number): number;',
        repl: 'export function segmentI32(a: Int32Array, lo: number, hi: number, x: number): any;',
    },
    {
        label: 'hint h number -> any', category: 'params', name: 'lowerBoundHintU16',
        find: 'export function lowerBoundHintU16(a: Uint16Array, lo: number, hi: number, x: number, h: number)',
        repl: 'export function lowerBoundHintU16(a: Uint16Array, lo: number, hi: number, x: number, h: any)',
    },
    {
        label: 'BisectArray widened by number[]', category: 'union', name: 'BisectArray',
        find: '| Int32Array;', repl: '| Int32Array | number[];',
    },
];

for (const mu of MUTANTS) {
    test('control: .d.ts mutant "' + mu.label + '" is killed in ' + mu.category + ' alone', () => {
        const r = compareDts(replaceOnce(DTS_TEXT, mu.find, mu.repl, mu.label), MOD);
        assert.equal(r[mu.category].length, 1, mu.label + ' SURVIVED: ' + JSON.stringify(r));
        assert.ok(r[mu.category][0].startsWith(mu.name), r[mu.category][0]);
        assert.deepEqual(failing(r), [mu.category], mu.label + ': ' + JSON.stringify(r));
    });
}

test('control: an unparseable export line is a parse error, never skipped', () => {
    const r = compareDts(replaceOnce(DTS_TEXT, 'export function assertRange(', 'export declare function assertRange(', 'declare'), MOD);
    assert.equal(r.parse.length, 1, JSON.stringify(r.parse));
    assert.deepEqual(r.missing, ['assertRange']);
    assert.deepEqual(failing(r), ['parse', 'missing']);
});

test('package.json top-level types === exports["."].types === "./Bisect.d.ts" (P1-R13)', () => {
    assert.deepEqual(checkTypesField(PKG_TEXT), []);
});

test('control: package.json top-level types removed fails (P1-R13)', () => {
    const t = replaceOnce(PKG_TEXT, '\n  "types": "./Bisect.d.ts",\n', '\n', 'types removed');
    const pr = checkTypesField(t);
    assert.ok(pr.length > 0 && pr[0] === 'top-level types = undefined', JSON.stringify(pr));
});

test('control: package.json top-level types mismatched fails (P1-R13)', () => {
    const t = replaceOnce(PKG_TEXT, '\n  "types": "./Bisect.d.ts",\n', '\n  "types": "./index.d.ts",\n', 'types mismatched');
    const pr = checkTypesField(t);
    assert.ok(pr.length > 0 && pr[0] === 'top-level types = "./index.d.ts"', JSON.stringify(pr));
});
