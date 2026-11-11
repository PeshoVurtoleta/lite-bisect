// test/docs/docs.test.mjs -- assertion 12 (SPEC-p1 U7 T5; M5: outside the npm-test glob until U9 moves it).
// Doc truth over README.md, llms.txt, CHANGELOG.md, Bisect.d.ts, Bisect.js (a missing file is a FAIL,
// never a skip). ONE verdict function, docsProblems(texts: Map file -> text), loops each check over its own
// file list and returns '<check> <file>: ...' strings; every real row ("docs: ...") asserts its check's
// slice of docsProblems(live files) is [], and the in-memory must-fail controls ("control: ...") plant one
// violation per (check, file) pair and read the SAME docsProblems (LEDGER B5). So `node --test --test-name-pattern=control
// test/docs/docs.test.mjs` runs the controls alone (U7) and U8 runs the whole file. LEDGER law 9, B5 / B6.
//
// Checks:
//   exports     every export name of Bisect.js (runtime Object.keys) appears in README.md and llms.txt as a
//               whole identifier (not a prefix of a longer one).
//   Q-BOX       the C2 sentence below, held here as a LITERAL (never read from Bisect.js), appears whole on
//               ONE line of README.md, llms.txt, Bisect.d.ts and Bisect.js (4 / 4).
//   never       "never inline" (any case, any whitespace, also "never inlines / inlined / inlining"): 0 hits
//               in all five files (LEDGER C1 / C7: Maglev does not inline the branchless pair; TurboFan does).
//   tokens      banned P0 numbers 0 hits in README.md / llms.txt / CHANGELOG.md. TOKEN RULE: a hit is the
//               literal token text NOT preceded by [0-9.] and NOT followed by [0-9] or by "." + [0-9].
//               So "2.4" hits "x 2.4 ns" and "2.4," but not "12.4", "2.45" or "2.4.1".
//   ascii       0 code points above U+007F in all five, except U+00D7 and U+00B5.
//   snippets    every ```js block of README.md runs (one node process, a mkdtemp dir, bounded); the import
//               specifier "@zakkster/lite-bisect" is mapped to this package's Bisect.js. A CHECKED LINE is
//               one line `<stmt>; // -> <literal>` where <stmt> is `const|let|var <name> = <expr>` or an
//               expression, and <literal> is a number (also -0, NaN, Infinity, -Infinity), true, false,
//               null, undefined, a quoted string, an array of numbers, or `throws <ErrorName>` (expression
//               lines only). Compared with Object.is (arrays / typed arrays element-wise). Any other text
//               after `// -> ` is a FAIL, and so is any line matching /\/\/\s*->/ that is not
//               written `// -> ` (e.g. `//-> 1`, `// ->1`): never skipped. Verdict: k checked lines, k ran,
//               k matched, k > 0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BISECT = join(ROOT, 'Bisect.js');
const DOCS = ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts', 'Bisect.js'];
const QBOX_FILES = ['README.md', 'llms.txt', 'Bisect.d.ts', 'Bisect.js'];
const NAME_FILES = ['README.md', 'llms.txt'];
const TOKEN_FILES = ['README.md', 'llms.txt', 'CHANGELOG.md'];
const QBOX = 'zero allocation where the kernel inlines into its caller, or the query is a Smi; a non-Smi number query passed across a call V8 does not inline boxes one 16 B HeapNumber.';
const TOKENS = ['2.4', '3.4x', '0.614', '0.436', '1.640', '3.325', '1.088', '1.255', '4,096'];
const SPAWN_MS = 120000;
const MOD = await import(pathToFileURL(BISECT).href);
const NAMES = Object.keys(MOD);

// ---- the check functions --------------------------------------------------------------------------

function loadDocs(dir, files) {
    const texts = new Map();
    const missing = [];
    for (const f of files) {
        const p = join(dir, f);
        if (existsSync(p)) texts.set(f, readFileSync(p, 'utf8'));
        else missing.push(f);
    }
    return { texts, missing };
}

function missingNames(text, names) {
    return names.filter((n) => !new RegExp('(^|[^A-Za-z0-9_$])' + n + '([^A-Za-z0-9_$]|$)').test(text));
}

function hasQboxLine(text) {
    return text.split('\n').some((l) => l.includes(QBOX));
}

function neverInlineHits(text) {
    return (text.match(/never\s+inlin/gi) || []).length;
}

function isDigit(c) { return c >= '0' && c <= '9'; }

function bannedTokenHits(text) {
    const hits = [];
    for (const t of TOKENS) {
        let i = text.indexOf(t);
        while (i >= 0) {
            const prev = i > 0 ? text[i - 1] : '';
            const n1 = text[i + t.length] || '';
            const n2 = text[i + t.length + 1] || '';
            const leftOk = !(isDigit(prev) || prev === '.');
            const rightOk = !(isDigit(n1) || (n1 === '.' && isDigit(n2)));
            if (leftOk && rightOk) hits.push(t + ' @' + i);
            i = text.indexOf(t, i + 1);
        }
    }
    return hits;
}

function nonAsciiHits(text) {
    const hits = [];
    let line = 1;
    for (const ch of text) {
        if (ch === '\n') line++;
        const cp = ch.codePointAt(0);
        if (cp > 0x7f && cp !== 0xd7 && cp !== 0xb5) hits.push('U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ' line ' + line);
    }
    return hits;
}

// The one docs verdict (B5): the real rows and the controls read it. texts: Map file -> text.
function docsProblems(texts) {
    const out = [];
    const each = (check, files, fn) => {
        for (const f of files) {
            if (!texts.has(f)) { out.push(check + ' ' + f + ': missing ' + f); continue; }
            const msg = fn(texts.get(f));
            if (msg) out.push(check + ' ' + f + ': ' + msg);
        }
    };
    each('exists', DOCS, () => '');
    each('names', NAME_FILES, (s) => { const m = missingNames(s, NAMES); return m.length ? 'missing ' + m.join(', ') : ''; });
    each('qbox', QBOX_FILES, (s) => (hasQboxLine(s) ? '' : 'no line holds the Q-BOX sentence'));
    each('never', DOCS, (s) => { const n = neverInlineHits(s); return n ? n + ' "never inline" hit(s)' : ''; });
    each('tokens', TOKEN_FILES, (s) => { const h = bannedTokenHits(s); return h.length ? 'banned ' + h.join(', ') : ''; });
    each('ascii', DOCS, (s) => { const h = nonAsciiHits(s); return h.length ? 'non-ASCII ' + h.join(', ') : ''; });
    return out;
}

function jsSnippets(md) {
    const out = [];
    let cur = null;
    for (const l of md.split('\n')) {
        if (cur === null) { if (/^```js\s*$/.test(l)) cur = []; }
        else if (/^```\s*$/.test(l)) { out.push(cur.join('\n')); cur = null; }
        else cur.push(l);
    }
    if (cur !== null) out.push(null);   // an unclosed fence: reported as a problem
    return out;
}

const LIT_RE = /^(-?(\d+(\.\d+)?([eE][+-]?\d+)?|Infinity)|NaN|true|false|null|undefined|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\[\s*(-?(\d+(\.\d+)?([eE][+-]?\d+)?|Infinity)|NaN)?(\s*,\s*(-?(\d+(\.\d+)?([eE][+-]?\d+)?|Infinity)|NaN))*\s*\])$/;
const CHECK_RE = /^(\s*)(.*?);?\s*\/\/ -> (.*)$/;
const DECL_RE = /^(const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+)$/;
const SPEC_RE = /(['"])@zakkster\/lite-bisect\1/g;

// Rewrites one snippet: imports -> Bisect.js, each checked line -> a recorded check. Throws on a bad line.
function instrument(src, bisectUrl) {
    let checks = 0;
    const lines = src.replace(SPEC_RE, JSON.stringify(bisectUrl)).split('\n').map((l) => {
        if (!/\/\/\s*->/.test(l)) return l;
        const m = CHECK_RE.exec(l);
        if (!m) throw new Error('malformed `// ->` marker (write `// -> <literal>`): ' + l);
        const body = m ? m[2].trim() : '';
        const lit = m ? m[3].trim() : '';
        if (body === '' || body.startsWith('//')) throw new Error('checked line has no statement: ' + l);
        const th = /^throws ([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(lit);
        if (!th && !LIT_RE.test(lit)) throw new Error('unparseable `// -> ` literal: ' + l);
        const id = checks++;
        const exp = th ? '{ throws: ' + JSON.stringify(th[1]) + ' }' : '{ lit: ' + lit + ' }';
        const d = DECL_RE.exec(body);
        if (d) {
            if (th) throw new Error('`throws` on a declaration line: ' + l);
            return m[1] + body + '; globalThis.__check(' + id + ', () => ' + d[2] + ', ' + exp + ');';
        }
        return m[1] + 'globalThis.__check(' + id + ', () => (' + body + '), ' + exp + ');';
    });
    return { code: lines.join('\n'), checks };
}

const RUNNER_HEAD = `
const recs = [];
const show = (v) => (Array.isArray(v) ? '[' + v.map(String).join(', ') + ']' : (Object.is(v, -0) ? '-0' : typeof v === 'string' ? JSON.stringify(v) : String(v)));
globalThis.__check = (id, thunk, exp) => {
    const rec = { snippet: globalThis.__snippet, id, ok: false, actual: '' };
    try {
        let v = thunk();
        if (ArrayBuffer.isView(v)) v = Array.from(v);
        rec.actual = show(v);
        if (!('throws' in exp)) {
            rec.ok = Array.isArray(exp.lit)
                ? Array.isArray(v) && v.length === exp.lit.length && v.every((e, i) => Object.is(e, exp.lit[i]))
                : Object.is(v, exp.lit);
        }
    } catch (e) {
        rec.actual = 'threw ' + (e && e.name);
        rec.ok = 'throws' in exp && !!e && e.name === exp.throws;
    }
    recs.push(rec);
};
const errors = [];
`;

// The one snippet verdict path: markdown TEXT -> spawn -> parse -> problems ([] = k / k, k > 0).
function runSnippets(md, bisectPath) {
    const problems = [];
    const snippets = jsSnippets(md);
    if (snippets.includes(null)) problems.push('an unclosed ```js fence');
    const ok = snippets.filter((s) => s !== null);
    if (ok.length === 0) return { problems: problems.concat('no ```js snippet'), total: 0, ran: 0, matched: 0 };
    let total = 0;
    const files = [];
    try {
        for (const s of ok) { const r = instrument(s, pathToFileURL(bisectPath).href); total += r.checks; files.push(r.code); }
    } catch (e) {
        return { problems: problems.concat('instrument: ' + e.message), total, ran: 0, matched: 0 };
    }
    const dir = mkdtempSync(join(tmpdir(), 'lite-bisect-docs-'));
    let res;
    try {
        let runner = RUNNER_HEAD;
        files.forEach((code, i) => {
            writeFileSync(join(dir, 's' + i + '.mjs'), code);
            runner += 'globalThis.__snippet = ' + i + ';\ntry { await import("./s' + i + '.mjs"); } catch (e) { errors.push(' + i + ' + ": " + (e && e.stack || e)); }\n';
        });
        runner += 'console.log("__DOCS_RESULT__" + JSON.stringify({ recs, errors }));\n';
        writeFileSync(join(dir, 'runner.mjs'), runner);
        const r = spawnSync(process.execPath, [join(dir, 'runner.mjs')], { cwd: dir, encoding: 'utf8', timeout: SPAWN_MS, killSignal: 'SIGKILL' });
        if (r.error || r.signal || r.status !== 0) problems.push('runner exit ' + r.status + ' signal ' + r.signal + ' ' + (r.error || '') + '\n' + r.stderr);
        const line = (r.stdout || '').split('\n').find((l) => l.startsWith('__DOCS_RESULT__'));
        res = line ? JSON.parse(line.slice('__DOCS_RESULT__'.length)) : null;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
    if (!res) return { problems: problems.concat('no result line'), total, ran: 0, matched: 0 };
    for (const e of res.errors) problems.push('snippet threw: ' + e);
    const matched = res.recs.filter((x) => x.ok).length;
    for (const x of res.recs) if (!x.ok) problems.push('snippet ' + x.snippet + ' check ' + x.id + ': got ' + x.actual);
    if (total === 0) problems.push('0 checked lines (k must be > 0)');
    if (res.recs.length !== total) problems.push('ran ' + res.recs.length + ' of ' + total + ' checked lines');
    return { problems, total, ran: res.recs.length, matched };
}

// ---- real rows (U8 / U9 run them; U7 runs only the controls) -------------------------------------

const live = loadDocs(ROOT, DOCS);
const textOf = (f) => { assert.ok(live.texts.has(f), f + ' missing (a FAIL, never a skip)'); return live.texts.get(f); };
const LIVE = docsProblems(live.texts);
const slice = (check) => LIVE.filter((p) => p.startsWith(check + ' '));

test('docs: README.md, llms.txt, CHANGELOG.md, Bisect.d.ts, Bisect.js all exist', () => {
    assert.deepEqual(slice('exists'), []);
});

test('docs: every export name in README.md and llms.txt', () => {
    assert.deepEqual(slice('names'), []);
});

test('docs: the Q-BOX sentence on one line 4 / 4', () => {
    assert.deepEqual(slice('qbox'), []);
});

test('docs: "never inline" 0 hits in all five files', () => {
    assert.deepEqual(slice('never'), []);
});

test('docs: banned P0 tokens 0 hits in README.md / llms.txt / CHANGELOG.md', () => {
    assert.deepEqual(slice('tokens'), []);
});

test('docs: non-ASCII 0 in all five files (U+00D7, U+00B5 excepted)', () => {
    assert.deepEqual(slice('ascii'), []);
});

test('docs: README ```js snippets run, every `// ->` matches (k / k, k > 0)', (t) => {
    const r = runSnippets(textOf('README.md'), BISECT);
    t.diagnostic('snippet checks ' + r.matched + ' / ' + r.total + ' (ran ' + r.ran + ')');
    assert.deepEqual(r.problems, []);
    assert.ok(r.total > 0 && r.matched === r.total && r.ran === r.total);
});

// ---- controls: in-memory input through the same functions ----------------------------------------

// The file lists copied from SPEC assertion 12, NOT the constants docsProblems loops over (law 9).
const SPEC_FILES = { names: ['README.md', 'llms.txt'], qbox: ['README.md', 'llms.txt', 'Bisect.d.ts', 'Bisect.js'], tokens: ['README.md', 'llms.txt', 'CHANGELOG.md'], never: ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts', 'Bisect.js'], ascii: ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts', 'Bisect.js'] };
const CLEAN = NAMES.join(' ') + '\n' + QBOX + '\n';
const cleanMap = () => new Map(SPEC_FILES.never.map((f) => [f, CLEAN]));
const QCUT = QBOX.indexOf(' a non-Smi');
const PLANTS = [
    { check: 'names', files: SPEC_FILES.names, plant: (s) => { assert.equal(s.split('nearestI32').length, 2); return s.replace('nearestI32', ''); } },
    { check: 'qbox', files: SPEC_FILES.qbox, plant: (s) => s.replace(QBOX, QBOX.slice(0, QCUT) + '\n' + QBOX.slice(QCUT + 1)) },
    { check: 'never', files: SPEC_FILES.never, plant: (s) => s + 'never inline\n' },
    { check: 'tokens', files: SPEC_FILES.tokens, plant: (s) => s + ' 2.4 \n' },
    { check: 'ascii', files: SPEC_FILES.ascii, plant: (s) => s + '\u00e9\n' },
];

test('control: docsProblems -- a clean in-memory set has 0 problems', () => {
    assert.deepEqual(docsProblems(cleanMap()), []);
});

test('control: docsProblems -- a file left out is missing in every check that lists it', () => {
    const m = cleanMap();
    m.delete('README.md');
    assert.deepEqual(docsProblems(m), ['exists', 'names', 'qbox', 'never', 'tokens', 'ascii'].map((c) => c + ' README.md: missing README.md'));
});

let plantCases = 0;
for (const p of PLANTS) {
    for (const f of p.files) {
        plantCases++;
        test('control: docsProblems -- ' + p.check + ' violation planted in ' + f + ' is exactly one problem', () => {
            const m = cleanMap();
            m.set(f, p.plant(m.get(f)));
            const pr = docsProblems(m);
            assert.equal(pr.length, 1, JSON.stringify(pr));
            assert.ok(pr[0].startsWith(p.check + ' ' + f + ': '), pr[0]);
        });
    }
}

test('control: docsProblems -- 19 planted (check, file) cases', () => {
    assert.equal(plantCases, 19);
});

test('control: a missing doc file is reported missing', () => {
    const r = loadDocs(join(ROOT, 'test', 'docs', 'no-such-dir'), DOCS);
    assert.deepEqual(r.missing, DOCS);
});

test('control: export names -- a dropped name and a prefix-only name are missing', () => {
    const all = NAMES.join(' ');
    assert.deepEqual(missingNames(all, NAMES), []);
    assert.deepEqual(missingNames(NAMES.filter((n) => n !== 'nearestI32').join(' '), NAMES), ['nearestI32']);
    assert.deepEqual(missingNames(all.replace('nearestI32', 'nearestI32x'), NAMES), ['nearestI32']);
});

test('control: Q-BOX -- split over two lines or one word changed is not found', () => {
    assert.equal(hasQboxLine('Allocation: ' + QBOX + '\n'), true);
    const cut = QBOX.indexOf(' a non-Smi');
    assert.equal(hasQboxLine(QBOX.slice(0, cut) + '\n' + QBOX.slice(cut + 1)), false);
    assert.equal(hasQboxLine(QBOX.replace('16 B', '12 B')), false);
});

test('control: "never inline" is counted in any case and form', () => {
    assert.equal(neverInlineHits('Maglev does not inline it at its default 100 B cap; TurboFan inlines it.'), 0);
    assert.equal(neverInlineHits('V8 will never inline it.'), 1);
    assert.equal(neverInlineHits('Never  inlined, never\ninlining'), 2);
});

test('control: banned tokens -- one hit and one non-hit per side', () => {
    assert.deepEqual(bannedTokenHits('costs x 2.4 ns'), ['2.4 @8']);      // left: a space before -> hit
    assert.deepEqual(bannedTokenHits('costs 12.4 ns'), []);              // left: a digit before -> no hit
    assert.deepEqual(bannedTokenHits('lanes 2.4, then'), ['2.4 @6']);     // right: a comma after -> hit
    assert.deepEqual(bannedTokenHits('lanes 2.45 and 2.4.1'), []);       // right: a digit / ".digit" after -> no hit
    assert.deepEqual(bannedTokenHits('at n >= 4,096.'), ['4,096 @8']);
    assert.deepEqual(bannedTokenHits('at n >= 14,096'), []);
});

test('control: non-ASCII -- e-acute is a hit, U+00D7 and U+00B5 are not', () => {
    assert.deepEqual(nonAsciiHits('caf\u00e9'), ['U+00E9 line 1']);
    assert.deepEqual(nonAsciiHits('3 \u00d7 4 \u00b5s'), []);
});

const fence = (body) => '# t\n\n```js\n' + body + '\n```\n';
const IMPORT = "import { nearestF64, assertRange } from '@zakkster/lite-bisect';\nconst a = new Float64Array([1, 3]);\n";

test('control: snippets -- a correct snippet passes k / k (the path works)', () => {
    const r = runSnippets(fence(IMPORT + 'nearestF64(a, 0, 2, 2); // -> 0\nconst j = nearestF64(a, 0, 2, 2.9); // -> 1\nassertRange(a, 0, 3); // -> throws RangeError'), BISECT);
    assert.deepEqual(r.problems, []);
    assert.equal(r.total, 3);
    assert.equal(r.matched, 3);
});

test('control: snippets -- a wrong `// ->` value fails', () => {
    const r = runSnippets(fence(IMPORT + 'nearestF64(a, 0, 2, 2); // -> 1'), BISECT);
    assert.ok(r.problems.some((p) => p.includes('got 0')), JSON.stringify(r.problems));
});

test('control: snippets -- 0 checked lines fails (k > 0)', () => {
    const r = runSnippets(fence(IMPORT + 'nearestF64(a, 0, 2, 2);'), BISECT);
    assert.ok(r.problems.some((p) => p.startsWith('0 checked lines')), JSON.stringify(r.problems));
});

test('control: snippets -- no ```js snippet at all fails', () => {
    const r = runSnippets('# t\n\n```bash\nnpm i @zakkster/lite-bisect\n```\n', BISECT);
    assert.deepEqual(r.problems, ['no ```js snippet']);
});

test('control: snippets -- a throw before a checked line fails (ran < k)', () => {
    const r = runSnippets(fence(IMPORT + 'assertRange(a, 0, 3);\nnearestF64(a, 0, 2, 2); // -> 0'), BISECT);
    assert.ok(r.problems.some((p) => p.startsWith('snippet threw')), JSON.stringify(r.problems));
    assert.ok(r.problems.some((p) => p.startsWith('ran 0 of 1')), JSON.stringify(r.problems));
});

test('control: snippets -- an unparseable `// ->` literal fails', () => {
    const r = runSnippets(fence(IMPORT + 'nearestF64(a, 0, 2, 2); // -> about 0'), BISECT);
    assert.ok(r.problems.some((p) => p.startsWith('instrument: unparseable')), JSON.stringify(r.problems));
});

test('control: snippets -- a malformed marker (`//-> 0`, `// ->0`) fails, never skipped', () => {
    for (const bad of ['nearestF64(a, 0, 2, 2); //-> 0', 'nearestF64(a, 0, 2, 2); // ->0']) {
        const r = runSnippets(fence(IMPORT + 'nearestF64(a, 0, 2, 2); // -> 0\n' + bad), BISECT);
        assert.ok(r.problems.some((p) => p.startsWith('instrument: malformed')), bad + ': ' + JSON.stringify(r.problems));
    }
});

test('control: snippets -- `throws` on a call that returns fails', () => {
    const r = runSnippets(fence(IMPORT + 'assertRange(a, 0, 2); // -> throws RangeError'), BISECT);
    assert.ok(r.problems.some((p) => p.includes('got undefined')), JSON.stringify(r.problems));
});
