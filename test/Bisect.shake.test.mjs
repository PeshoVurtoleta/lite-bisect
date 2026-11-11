// test/Bisect.shake.test.mjs -- tree-shaking gate (unit SHAKE). In the npm-test glob (test/*.test.mjs).
// Tier: DETERMINISTIC. It gates bundle CONTENT under esbuild (the devDependency version; 0.28.2 when written),
// never bundle size, no clock, no quiet lock. webpack / rollup / terser are NOT tested: the claim is esbuild-only.
//
// What it proves:
//   (a) for EVERY export K of Bisect.js, an esbuild bundle of `import { K } ...; globalThis.__keep = K;` defines
//       exactly closure(K) -- K plus the kernels K calls (DEPS below, a pinned literal: lowerBoundHint* and
//       nearest* call lowerBoundBranchless*, segment* calls upperBoundBranchless*, assertSorted calls
//       assertRange) -- and no other export name in any form. 21 exports bundle alone; 16 carry one callee.
//   (b) a bare side-effect import (`import '<Bisect.js>'`) bundles to no kernel at all.
//   (b2) esbuild reports `ignored-bare-import` for that import: the package.json `"sideEffects": false` is read
//       and honoured. (b) alone cannot see the flag: esbuild drops unused function declarations either way.
//   (c) the all-37 entry defines all 37 (positive row, and the "esbuild emitted nothing" guard).
// Matcher (minify off, so names are not mangled): a kept name K must occur exactly once as the literal text
// `function K(`; every `function <ident>(` declaration in the bundle (regex /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/)
// must be a kept name; every export name NOT kept must not occur at all as an identifier PREFIX
// (/(?<![\w$])name/), which also catches an esbuild collision rename (`nearestI322`) or a non-declaration form
// (`var nearestI32 = ...`). esbuild drops ordinary comments, so a JSDoc mention cannot false-fail; the entry file
// names (entry-<n>.mjs in a mkdtemp dir) carry no export name.
// ONE verdict function, shakeProblems(input) -> string[] ([] = pass), judges every real row AND every control
// (LEDGER B5 / B7). Controls, each must return problems through shakeProblems:
//   (c-ctl) the all-37 bundle judged as a one-kernel row -> 36 problems (the matcher sees names);
//   (d) a scratch copy of Bisect.js with a planted top-level `globalThis.__x = upperBoundBranchyF64;` -> the
//       one-kernel lowerBoundBranchlessF64 bundle now carries a second kernel;
//   (d2) a scratch copy with a planted top-level `console.log(1);` (no kernel name) -> 'top-level residue';
//   (b2-ctl) a scratch fx/ copy whose package.json says "sideEffects": true -> no ignored-bare-import -> problem;
//   (e) esbuild throws (an import of a missing export), and an output text '' -> problems, never [];
//   (f) the real one-kernel text plus a planted `function nearestI32(` -> problem; (f2) a renamed kept
//       declaration (`function nearestF642(`) -> problem; (f3) a kept declaration emitted twice -> problem.
// Top-level residue: every top-level line of the bundle must be one of: '' ; '}' ; an indented line (a function
// body, starts with ' ') ; a '// ' source-path comment ; 'globalThis.__keep = ...' (the entry) ; or
// 'function K(' with K kept. Any other top-level line (a call, a const / let / var, an assignment, an export)
// is a problem, so a side effect that names no kernel (console.log, a LUT, Object.freeze) cannot ride along.
// Fail closed: esbuild missing -> this file fails to load (static import), never a skip.
// LITE_BISECT_SHAKE_SRC=<abs path> points the gate at another build (a frozen before, a planted copy); a
// relative or missing path throws. Run: node --test test/Bisect.shake.test.mjs (or npm test).

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync, version as ESBUILD_VERSION } from 'esbuild';

const DEFAULT_SRC = fileURLToPath(new URL('../Bisect.js', import.meta.url));
const ENV_SRC = process.env.LITE_BISECT_SHAKE_SRC;
if (ENV_SRC !== undefined && !isAbsolute(ENV_SRC)) {
    throw new Error('LITE_BISECT_SHAKE_SRC must be an absolute path, got: ' + JSON.stringify(ENV_SRC));
}
const SRC = ENV_SRC === undefined ? DEFAULT_SRC : ENV_SRC;
if (!existsSync(SRC)) throw new Error('Bisect.shake: file under test does not exist: ' + SRC);
const SRC_TEXT = readFileSync(SRC, 'utf8');

const EXPECTED_COUNT = 37;
// Pinned call graph (never computed from Bisect.js; row 'call graph' cross-checks it against the source text).
const DEPS = {
    lowerBoundHintF64: ['lowerBoundBranchlessF64'], segmentF64: ['upperBoundBranchlessF64'], nearestF64: ['lowerBoundBranchlessF64'],
    lowerBoundHintF32: ['lowerBoundBranchlessF32'], segmentF32: ['upperBoundBranchlessF32'], nearestF32: ['lowerBoundBranchlessF32'],
    lowerBoundHintU32: ['lowerBoundBranchlessU32'], segmentU32: ['upperBoundBranchlessU32'], nearestU32: ['lowerBoundBranchlessU32'],
    lowerBoundHintU16: ['lowerBoundBranchlessU16'], segmentU16: ['upperBoundBranchlessU16'], nearestU16: ['lowerBoundBranchlessU16'],
    lowerBoundHintI32: ['lowerBoundBranchlessI32'], segmentI32: ['upperBoundBranchlessI32'], nearestI32: ['lowerBoundBranchlessI32'],
    assertSorted: ['assertRange'],
};

function closure(k) {
    const out = [k];
    for (let i = 0; i < out.length; i++) {
        const d = DEPS[out[i]];
        if (d !== undefined) for (const n of d) if (!out.includes(n)) out.push(n);
    }
    return out.sort();
}

const DECL_RE = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
function escapeRe(s) { return s.replace(/[$]/g, '\\$'); }

// input = { built: { text, error, warnings }, names: all export names, keep: names that must be defined,
//           expectBareIgnored: true -> esbuild must report ignored-bare-import for basename(src) }
function shakeProblems(input) {
    const p = [];
    const b = input.built;
    if (b === null || typeof b !== 'object') return ['no build result'];
    if (b.error) p.push('esbuild failed: ' + String(b.error && b.error.message || b.error).split('\n')[0]);
    const text = b.text;
    if (typeof text !== 'string' || text.length === 0) {
        p.push('empty bundle text');
        return p;
    }
    if (!text.includes('globalThis.__keep')) p.push('entry marker globalThis.__keep missing (entry not emitted)');
    const keep = input.keep;
    for (const k of keep) {
        const c = text.split('function ' + k + '(').length - 1;
        if (c !== 1) p.push('kept ' + k + ': `function ' + k + '(` occurs ' + c + 'x, want 1');
    }
    for (const line of text.split('\n')) {
        if (line === '' || line === '}' || line[0] === ' ' || line.startsWith('// ') || line.startsWith('globalThis.__keep = ')) continue;
        const d = /^function ([A-Za-z_$][\w$]*)\(/.exec(line);
        if (d === null || !keep.includes(d[1])) p.push('top-level residue: ' + line.slice(0, 60));
    }
    DECL_RE.lastIndex = 0;
    let m;
    while ((m = DECL_RE.exec(text)) !== null) {
        if (!keep.includes(m[1])) p.push('unexpected declaration function ' + m[1] + '(');
    }
    for (const n of input.names) {
        if (keep.includes(n)) continue;
        if (new RegExp('(?<![\\w$])' + escapeRe(n)).test(text)) p.push('not shaken: ' + n + ' present');
    }
    if (input.expectBareIgnored === true) {
        const ws = Array.isArray(b.warnings) ? b.warnings : [];
        const hit = ws.some((w) => w.id === 'ignored-bare-import' && String(w.text).includes(input.srcBase));
        if (!hit) p.push('no ignored-bare-import warning for ' + input.srcBase + ' (sideEffects not honoured)');
    }
    return p;
}

let dir = '';
let seq = 0;

function build(entryText) {
    const entry = join(dir, 'entry-' + (seq++) + '.mjs');
    writeFileSync(entry, entryText);
    try {
        const r = buildSync({
            entryPoints: [entry], bundle: true, format: 'esm', minify: false, write: false,
            platform: 'neutral', logLevel: 'silent',
        });
        if (r.outputFiles.length !== 1) return { text: '', error: new Error(r.outputFiles.length + ' output files'), warnings: r.warnings };
        return { text: r.outputFiles[0].text, error: null, warnings: r.warnings };
    } catch (e) {
        return { text: '', error: e, warnings: [] };
    }
}

function namedEntry(src, ks) {
    return 'import { ' + ks.join(', ') + ' } from ' + JSON.stringify(src) + ';\nglobalThis.__keep = [' + ks.join(', ') + '];\n';
}
function bareEntry(src) {
    return 'import ' + JSON.stringify(src) + ';\nglobalThis.__keep = 1;\n';
}

const EXPORTS = Object.keys(await import(pathToFileURL(SRC).href)).sort();
const SRC_BASE = basename(SRC);

describe('Bisect.shake: esbuild ' + ESBUILD_VERSION + ' tree-shakes ' + SRC, () => {
    before(() => { dir = mkdtempSync(join(tmpdir(), 'lite-bisect-shake-')); });
    after(() => { if (dir !== '') rmSync(dir, { recursive: true, force: true }); });

    it('exports: 37 export function declarations, equal to the runtime export list', () => {
        assert.equal(EXPORTS.length, EXPECTED_COUNT, 'export count: ' + EXPORTS.join(','));
        const declared = [...SRC_TEXT.matchAll(/^export function ([A-Za-z_$][\w$]*)\(/gm)].map((x) => x[1]).sort();
        assert.deepEqual(declared, EXPORTS);
        for (const k of Object.keys(DEPS)) assert.ok(EXPORTS.includes(k), 'DEPS key ' + k + ' is an export');
    });

    it('call graph: every export-to-export call in the source is pinned in DEPS, and nothing else', () => {
        const starts = [...SRC_TEXT.matchAll(/^export function ([A-Za-z_$][\w$]*)\(/gm)];
        const seen = {};
        for (let i = 0; i < starts.length; i++) {
            const end = i + 1 < starts.length ? starts[i + 1].index : SRC_TEXT.length;
            const body = SRC_TEXT.slice(starts[i].index + starts[i][0].length, end);
            const calls = EXPORTS.filter((n) => new RegExp('(?<![\\w$])' + escapeRe(n) + '\\s*\\(').test(body));
            if (calls.length > 0) seen[starts[i][1]] = calls.sort();
        }
        const pinned = {};
        for (const k of Object.keys(DEPS)) pinned[k] = DEPS[k].slice().sort();
        assert.deepEqual(seen, pinned);
    });

    it('(a) every export bundles alone with exactly its call closure', () => {
        let n = 0;
        for (const k of EXPORTS) {
            const probs = shakeProblems({ built: build(namedEntry(SRC, [k])), names: EXPORTS, keep: closure(k) });
            assert.deepEqual(probs, [], 'row (a) ' + k);
            n++;
        }
        assert.equal(n, EXPECTED_COUNT);
    });

    it('(b) a bare side-effect import bundles to no kernel', () => {
        assert.deepEqual(shakeProblems({ built: build(bareEntry(SRC)), names: EXPORTS, keep: [] }), []);
    });

    it('(b2) esbuild honours "sideEffects": false (ignored-bare-import reported for the bare import)', () => {
        const probs = shakeProblems({
            built: build(bareEntry(SRC)), names: EXPORTS, keep: [], expectBareIgnored: true, srcBase: SRC_BASE,
        });
        assert.deepEqual(probs, []);
    });

    it('(c) all 37 imported -> all 37 defined', () => {
        assert.deepEqual(shakeProblems({ built: build(namedEntry(SRC, EXPORTS)), names: EXPORTS, keep: EXPORTS }), []);
    });

    it('control (c-ctl): the all-37 bundle judged as a one-kernel row fails with 36 problems', () => {
        const probs = shakeProblems({ built: build(namedEntry(SRC, EXPORTS)), names: EXPORTS, keep: ['upperBoundBranchyU16'] });
        assert.equal(probs.filter((s) => s.startsWith('not shaken: ')).length, EXPECTED_COUNT - 1, probs.join('\n'));
    });

    it('control (d): a planted top-level side effect drags a second kernel into a one-kernel bundle', () => {
        const planted = join(dir, 'planted-' + SRC_BASE);
        writeFileSync(planted, SRC_TEXT + '\nglobalThis.__x = upperBoundBranchyF64;\n');
        const probs = shakeProblems({
            built: build(namedEntry(planted, ['lowerBoundBranchlessF64'])), names: EXPORTS, keep: ['lowerBoundBranchlessF64'],
        });
        assert.ok(probs.includes('not shaken: upperBoundBranchyF64 present'), probs.join('\n'));
        assert.ok(probs.includes('unexpected declaration function upperBoundBranchyF64('), probs.join('\n'));
    });

    it('control (d2): a planted top-level side effect that names no kernel is top-level residue', () => {
        const planted = join(dir, 'planted-d2-' + SRC_BASE);
        writeFileSync(planted, SRC_TEXT + '\nconsole.log(1);\n');
        const probs = shakeProblems({
            built: build(namedEntry(planted, ['upperBoundBranchyU16'])), names: EXPORTS, keep: ['upperBoundBranchyU16'],
        });
        assert.deepEqual(probs, ['top-level residue: console.log(1);']);
    });

    it('control (b2-ctl): a copy under "sideEffects": true gets no ignored-bare-import -> problem', () => {
        const fx = join(dir, 'fx');
        mkdirSync(fx);
        writeFileSync(join(fx, 'package.json'), JSON.stringify({ sideEffects: true }) + '\n');
        const copy = join(fx, SRC_BASE);
        writeFileSync(copy, SRC_TEXT);
        const probs = shakeProblems({
            built: build(bareEntry(copy)), names: EXPORTS, keep: [], expectBareIgnored: true, srcBase: SRC_BASE,
        });
        assert.deepEqual(probs, ['no ignored-bare-import warning for ' + SRC_BASE + ' (sideEffects not honoured)']);
    });

    it('control (e): an esbuild failure and an empty output are problems, never []', () => {
        const thrown = shakeProblems({ built: build(namedEntry(SRC, ['noSuchKernelF64'])), names: EXPORTS, keep: ['noSuchKernelF64'] });
        assert.ok(thrown.some((s) => s.startsWith('esbuild failed: ')), thrown.join('\n'));
        const empty = shakeProblems({ built: { text: '', error: null, warnings: [] }, names: EXPORTS, keep: [] });
        assert.deepEqual(empty, ['empty bundle text']);
        assert.deepEqual(shakeProblems({ built: null, names: EXPORTS, keep: [] }), ['no build result']);
    });

    it('control (f): a planted extra declaration and a renamed kept declaration are problems', () => {
        const real = build(namedEntry(SRC, ['nearestF64']));
        const keep = closure('nearestF64');
        assert.deepEqual(shakeProblems({ built: real, names: EXPORTS, keep }), [], 'real nearestF64 row');
        const extra = { text: real.text + '\nfunction nearestI32(a, lo, hi, x) { return lo; }\n', error: null, warnings: [] };
        const pe = shakeProblems({ built: extra, names: EXPORTS, keep });
        assert.ok(pe.includes('unexpected declaration function nearestI32('), pe.join('\n'));
        assert.ok(pe.includes('not shaken: nearestI32 present'), pe.join('\n'));
        const renamed = { text: real.text.replace('function nearestF64(', 'function nearestF642('), error: null, warnings: [] };
        const pr = shakeProblems({ built: renamed, names: EXPORTS, keep });
        assert.ok(pr.includes('kept nearestF64: `function nearestF64(` occurs 0x, want 1'), pr.join('\n'));
        assert.ok(pr.includes('unexpected declaration function nearestF642('), pr.join('\n'));
        const twice = { text: real.text + '\nfunction nearestF64(a, lo, hi, x) { return lo; }\n', error: null, warnings: [] };
        const pt = shakeProblems({ built: twice, names: EXPORTS, keep });
        assert.ok(pt.includes('kept nearestF64: `function nearestF64(` occurs 2x, want 1'), pt.join('\n'));
    });
});
