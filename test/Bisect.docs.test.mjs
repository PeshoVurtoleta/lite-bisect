// test/Bisect.docs.test.mjs -- assertion 12 (SPEC-p1 U7 T5). M5: U9 moved it from test/docs/docs.test.mjs into the
// npm-test glob (test/*.test.mjs), so `npm test` and `npm run coverage` run it with every other suite file.
// Doc truth over README.md, llms.txt, CHANGELOG.md, Bisect.d.ts, Bisect.js (a missing file is a FAIL,
// never a skip). ONE verdict function, docsProblems(texts: Map file -> text), loops each check over its own
// file list and returns '<check> <file>: ...' strings; every real row ("docs: ...") asserts its check's
// slice of docsProblems(live files) is [], and the in-memory must-fail controls ("control: ...") plant one
// violation per (check, file) pair and read the SAME docsProblems (LEDGER B5). The controls alone:
// `node --test --test-name-pattern=control test/Bisect.docs.test.mjs`; the whole file: `node --test
// test/Bisect.docs.test.mjs`. LEDGER law 9, B5 / B6.
//
// Checks:
//   exports     every export name of Bisect.js (runtime Object.keys) appears in README.md and llms.txt as a
//               whole identifier (not a prefix of a longer one).
//   roster      (QA gap) a committed LITERAL ROSTER of the 47 export names (typed from Bisect.d.ts, never computed
//               from Bisect.js in the run that checks it, LEDGER law 9): the sorted runtime Object.keys of
//               Bisect.js deep-equals the sorted ROSTER (a missing OR an extra export fails, naming it), and every
//               ROSTER name appears in README.md and llms.txt as a whole identifier. The 'exports' check above
//               cannot fail on a missing export (its names come from the module itself); this one can.
//   Q-BOX       the C2 sentence below, held here as a LITERAL (never read from Bisect.js), appears whole on
//               ONE line of README.md, llms.txt, Bisect.d.ts and Bisect.js (4 / 4).
//   never       "never inline" (any case, any whitespace, also "never inlines / inlined / inlining"): 0 hits
//               in all five files (LEDGER C1 / C7: Maglev does not inline the branchless pair; TurboFan does).
//   tokens      banned P0 numbers 0 hits in README.md / llms.txt / CHANGELOG.md. TOKEN RULE: a hit is the
//               literal token text NOT preceded by [0-9.] and NOT followed by [0-9] or by "." + [0-9].
//               So "2.4" hits "x 2.4 ns" and "2.4," but not "12.4", "2.45" or "2.4.1".
//   ascii       0 code points above U+007F in all five, except U+00D7 and U+00B5.
//   bare        (AU-R4) README.md / llms.txt: no js-fence line carries a bare `// <number>` result comment (the
//               checked form is `// -> <literal>`).
//   cite        (AU-R6, neon-5) every `.md` path cited in README.md / llms.txt / CHANGELOG.md / Bisect.d.ts, as
//               written (`NAME.md`, `./NAME.md`, `../NAME.md`, `dir/NAME.md`, `/NAME.md`, `~/NAME.md`; leading `./`
//               dropped), is in package.json files[]; a file that holds the pointer sentence (PTR below) may also cite LEDGER.md and
//               RESEARCH.md, nothing else. A URL (scheme://) is not a file citation.
//   repo        (NEON-R2) a shipped doc (in files[]) that holds PTR needs a non-empty package.json repository (a
//               string, or an object with a non-empty url): PTR points the reader at that repository.
//   speed       (AU-R7, neon-5) Bisect.d.ts, README.md, llms.txt: every sentence with "slower" / "faster" holds
//               PRELIMINARY, STATISTICAL or REPORTED itself. Blocks never join: a paragraph break, a JSDoc open /
//               close, a list item / heading / fence / JSDoc @tag line, and each markdown table cell end a block,
//               and a block is split into sentences at ".", "!" or "?" (closing quotes / brackets allowed) +
//               whitespace -- so a following sentence, block, cell or list item never lends its tier word. The one
//               exemption is a real disclaimer: the speed word QUOTED, negated by the word before it and naming a
//               statement or claim after it (`no "faster than" statement`, `no "slower" claims`); only that
//               phrase is dropped, the rest of its sentence is still checked.
//   snippets    every ```js block of README.md and llms.txt runs (one node process, a mkdtemp dir, bounded); the import
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

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BISECT = join(ROOT, 'Bisect.js');
const DOCS = ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts', 'Bisect.js'];
const QBOX_FILES = ['README.md', 'llms.txt', 'Bisect.d.ts', 'Bisect.js'];
const NAME_FILES = ['README.md', 'llms.txt'];
const TOKEN_FILES = ['README.md', 'llms.txt', 'CHANGELOG.md'];
const QBOX = 'zero allocation where the kernel inlines into its caller, or every number argument (the query; the hint of lowerBoundHint*; lo / hi) is a Smi; a non-Smi number computed at run time or read from a typed array (a fractional query, a NaN hint read from a Float64Array, -0 for lo / hi) and passed across a call V8 does not inline is boxed by the caller: one 16 B HeapNumber per such argument on Node. For no hint pass lo or the literal NaN: neither boxes.';
const BARE_FILES = ['README.md', 'llms.txt'];
const CITE_FILES = ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts'];
const SPEED_FILES = ['Bisect.d.ts', 'README.md', 'llms.txt'];
const PTR = 'LEDGER and RESEARCH ids refer to LEDGER.md and RESEARCH.md in the source repository; they are not in the npm tarball.';
const PTR_FILES = ['LEDGER.md', 'RESEARCH.md'];   // the only unshipped files PTR explains (neon-5)
const TOKENS = ['2.4', '3.4x', '0.614', '0.436', '1.640', '3.325', '1.088', '1.255', '4,096'];
const SPAWN_MS = 120000;
const MOD = await import(pathToFileURL(BISECT).href);
const NAMES = Object.keys(MOD);

// The 47 export names of Bisect.d.ts, typed by hand (45 kernels + assertRange + assertSorted).
const ROSTER = [
    'lowerBoundBranchlessF64', 'upperBoundBranchlessF64', 'lowerBoundBranchyF64',
    'upperBoundBranchyF64', 'lowerBoundHintF64', 'segmentF64', 'nearestF64', 'upperBoundHintF64',
    'segmentHintF64', 'lowerBoundBranchlessF32', 'upperBoundBranchlessF32', 'lowerBoundBranchyF32',
    'upperBoundBranchyF32', 'lowerBoundHintF32', 'segmentF32', 'nearestF32', 'upperBoundHintF32',
    'segmentHintF32', 'lowerBoundBranchlessU32', 'upperBoundBranchlessU32', 'lowerBoundBranchyU32',
    'upperBoundBranchyU32', 'lowerBoundHintU32', 'segmentU32', 'nearestU32', 'upperBoundHintU32',
    'segmentHintU32', 'lowerBoundBranchlessU16', 'upperBoundBranchlessU16', 'lowerBoundBranchyU16',
    'upperBoundBranchyU16', 'lowerBoundHintU16', 'segmentU16', 'nearestU16', 'upperBoundHintU16',
    'segmentHintU16', 'lowerBoundBranchlessI32', 'upperBoundBranchlessI32', 'lowerBoundBranchyI32',
    'upperBoundBranchyI32', 'lowerBoundHintI32', 'segmentI32', 'nearestI32', 'upperBoundHintI32',
    'segmentHintI32', 'assertRange', 'assertSorted',
];

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

function rosterProblems(keys, roster, texts) {
    const out = [];
    const have = new Set(keys);
    const want = new Set(roster);
    for (const n of roster) if (!have.has(n)) out.push('module is missing export ' + n);
    for (const k of keys) if (!want.has(k)) out.push('module has export ' + k + ' not in ROSTER');
    for (const f of NAME_FILES) {
        const m = missingNames(texts.get(f) ?? '', roster);
        if (m.length) out.push(f + ' is missing ' + m.join(', '));
    }
    return out;
}

function hasQboxLine(text) {
    return text.split('\n').some((l) => l.includes(QBOX));
}

function neverInlineHits(text) {
    return (text.match(/never\s+inlin/gi) || []).length;
}

// A js-fence line whose comment starts with a number (a result written as `// 3`).
function bareResultHits(md) {
    const hits = [];
    let inJs = false;
    let n = 0;
    for (const l of md.split('\n')) {
        n++;
        if (!inJs) { if (/^```js\s*$/.test(l)) inJs = true; }
        else if (/^```\s*$/.test(l)) inJs = false;
        else if (/\/\/\s*[-+]?(\d|NaN\b|Infinity\b)/.test(l)) hits.push('line ' + n);
    }
    return hits;
}

// A cited path as written: [/ | ~/]? [./ | ../]* [dir/]* NAME.md (neon-5: a prefix no longer hides it). The lookbehind
// keeps a match from starting inside a longer path or a URL (scheme://host/... has no start the pattern accepts).
function citedMd(text) {
    return [...new Set(text.match(/(?<![A-Za-z0-9_.\/~-])(?:~?\/)?(?:\.\.?\/)*(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_-]+\.md(?![A-Za-z0-9_])/g) || [])];
}

const citeKey = (p) => p.replace(/^(?:\.\/)+/, '');   // ./README.md is README.md; ../README.md stays outside the package

function uncitable(text, shipped) {
    const ok = text.includes(PTR) ? shipped.concat(PTR_FILES) : shipped;
    return citedMd(text).filter((p) => !ok.includes(citeKey(p)));
}

// non-empty: a string, or an object whose url is a non-empty string.
function hasRepository(pkg) {
    const r = pkg.repository;
    if (typeof r === 'string') return r.trim() !== '';
    return r !== null && typeof r === 'object' && typeof r.url === 'string' && r.url.trim() !== '';
}

// The blocks a speed sentence may not cross (neon-5). A JSDoc open / close ends a block; inside a JSDoc the gutter
// `*` is dropped, outside it a leading `* ` is a markdown list item.
function speedBlocks(text) {
    const blocks = [];
    let cur = [];
    const flush = () => { if (cur.length) blocks.push(cur.join(' ')); cur = []; };
    let inDoc = false;
    for (const part of text.split(/(\/\*\*|\*\/)/)) {
        flush();
        if (part === '/**') { inDoc = true; continue; }
        if (part === '*/') { inDoc = false; continue; }
        for (let l of part.split('\n')) {
            if (inDoc) l = l.replace(/^\s*\*\s?/, '');
            if (/^\s*$/.test(l)) { flush(); continue; }
            if (/^\s*\|/.test(l)) { flush(); for (const c of l.split('|')) { cur.push(c); flush(); } continue; }
            if (/^\s*(?:[-+*]\s|\d+[.)]\s|#|\`\`\`|@[A-Za-z])/.test(l)) flush();
            cur.push(l);
        }
    }
    flush();
    return blocks;
}

const DISCLAIMER = /\bno\s+"(?:faster|slower)(?:\s+than)?"\s+(?:statement|claim)s?\b/gi;

function speedHits(text) {
    const hits = [];
    for (const b of speedBlocks(text)) {
        for (const x of b.split(/[.!?]["')\]]*\s+/)) {
            if (/\b(slower|faster)\b/i.test(x.replace(DISCLAIMER, '')) && !/PRELIMINARY|STATISTICAL|REPORTED/.test(x)) hits.push(x.trim().slice(0, 60));
        }
    }
    return hits;
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
    each('bare', BARE_FILES, (s) => { const h = bareResultHits(s); return h.length ? 'bare // <number> result comment at ' + h.join(', ') : ''; });
    if (!texts.has('package.json')) out.push('cite package.json: missing package.json');
    else {
        const pkg = JSON.parse(texts.get('package.json'));
        const shipped = pkg.files;
        each('cite', CITE_FILES, (s) => { const h = uncitable(s, shipped); return h.length ? 'cites unshipped ' + h.join(', ') + (s.includes(PTR) ? ' (the pointer sentence covers only ' + PTR_FILES.join(' / ') + ')' : ' without the pointer sentence') : ''; });
        each('repo', DOCS.filter((f) => shipped.includes(f)), (s) => (s.includes(PTR) && !hasRepository(pkg) ? 'holds the pointer sentence but package.json has no repository' : ''));
    }
    each('speed', SPEED_FILES, (s) => { const h = speedHits(s); return h.length ? 'untiered speed word: ' + h.join(' | ') : ''; });
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

const live = loadDocs(ROOT, DOCS.concat('package.json'));
const textOf = (f) => { assert.ok(live.texts.has(f), f + ' missing (a FAIL, never a skip)'); return live.texts.get(f); };
const LIVE = docsProblems(live.texts);
const slice = (check) => LIVE.filter((p) => p.startsWith(check + ' '));

test('docs: README.md, llms.txt, CHANGELOG.md, Bisect.d.ts, Bisect.js all exist', () => {
    assert.deepEqual(slice('exists'), []);
});

test('docs: every export name in README.md and llms.txt', () => {
    assert.deepEqual(slice('names'), []);
});

test('docs: roster -- the 47 literal export names equal the module keys and appear in README.md and llms.txt', () => {
    assert.equal(ROSTER.length, 47);
    assert.equal(new Set(ROSTER).size, 47);
    assert.deepEqual([...Object.keys(MOD)].sort(), [...ROSTER].sort());
    assert.deepEqual(rosterProblems(Object.keys(MOD), ROSTER, new Map(NAME_FILES.map((f) => [f, textOf(f)]))), []);
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

test('docs: no bare `// <number>` result comment in a README / llms.txt js fence (AU-R4)', () => {
    assert.deepEqual(slice('bare'), []);
});

test('docs: every cited .md path is shipped, or LEDGER.md / RESEARCH.md under the pointer sentence (AU-R6, neon-5)', () => {
    assert.deepEqual(slice('cite'), []);
});

test('docs: a shipped doc with the pointer sentence has a package.json repository (NEON-R2)', () => {
    assert.deepEqual(slice('repo'), []);
});

test('docs: Bisect.d.ts / README.md / llms.txt "slower" / "faster" sentences carry PRELIMINARY / STATISTICAL / REPORTED (AU-R7, neon-5)', () => {
    assert.deepEqual(slice('speed'), []);
});

test('docs: llms.txt ```js snippets run, every `// ->` matches (k / k, k > 0)', (t) => {
    const r = runSnippets(textOf('llms.txt'), BISECT);
    t.diagnostic('snippet checks ' + r.matched + ' / ' + r.total + ' (ran ' + r.ran + ')');
    assert.deepEqual(r.problems, []);
    assert.ok(r.total > 0 && r.matched === r.total && r.ran === r.total);
});

test('docs: README ```js snippets run, every `// ->` matches (k / k, k > 0)', (t) => {
    const r = runSnippets(textOf('README.md'), BISECT);
    t.diagnostic('snippet checks ' + r.matched + ' / ' + r.total + ' (ran ' + r.ran + ')');
    assert.deepEqual(r.problems, []);
    assert.ok(r.total > 0 && r.matched === r.total && r.ran === r.total);
});

// ---- controls: in-memory input through the same functions ----------------------------------------

// The file lists copied from SPEC assertion 12, NOT the constants docsProblems loops over (law 9).
const SPEC_FILES = { names: ['README.md', 'llms.txt'], qbox: ['README.md', 'llms.txt', 'Bisect.d.ts', 'Bisect.js'], tokens: ['README.md', 'llms.txt', 'CHANGELOG.md'], never: ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts', 'Bisect.js'], ascii: ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts', 'Bisect.js'], bare: ['README.md', 'llms.txt'], cite: ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts'], repo: ['README.md', 'llms.txt', 'CHANGELOG.md', 'Bisect.d.ts', 'Bisect.js'], speed: ['Bisect.d.ts', 'README.md', 'llms.txt'] };
const SHIPPED_FILES = ['Bisect.js', 'Bisect.d.ts', 'llms.txt', 'LICENSE.txt', 'CHANGELOG.md', 'README.md'];
const REPO = { type: 'git', url: 'https://github.com/PeshoVurtoleta/lite-bisect.git' };
const SHIPPED = JSON.stringify({ files: SHIPPED_FILES, repository: REPO });
const NOREPO = JSON.stringify({ files: SHIPPED_FILES });
const CLEAN = NAMES.join(' ') + '\n' + QBOX + '\n';
const cleanMap = () => new Map(SPEC_FILES.never.map((f) => [f, CLEAN]).concat([['package.json', SHIPPED]]));
const QCUT = QBOX.indexOf(' a non-Smi');
const PLANTS = [
    { check: 'names', files: SPEC_FILES.names, plant: (s) => { assert.equal(s.split('nearestI32').length, 2); return s.replace('nearestI32', ''); } },
    { check: 'qbox', files: SPEC_FILES.qbox, plant: (s) => s.replace(QBOX, QBOX.slice(0, QCUT) + '\n' + QBOX.slice(QCUT + 1)) },
    { check: 'never', files: SPEC_FILES.never, plant: (s) => s + 'never inline\n' },
    { check: 'tokens', files: SPEC_FILES.tokens, plant: (s) => s + ' 2.4 \n' },
    { check: 'ascii', files: SPEC_FILES.ascii, plant: (s) => s + '\u00e9\n' },
    { check: 'bare', files: SPEC_FILES.bare, plant: (s) => s + '\n```js\nconst x = f(1); // 3\n```\n' },
    { check: 'cite', files: SPEC_FILES.cite, plant: (s) => s + '\nsee ROADMAP.md\n' },
    // neon-5, the audit's plants (each read exit 0 on the frozen-before docs test):
    { name: 'unshipped under PTR', check: 'cite', files: SPEC_FILES.cite, plant: (s) => s + PTR + '\nSee SECRET_UNSHIPPED.md.\n' },       // PTR covers LEDGER / RESEARCH only
    { name: './ and dir/', check: 'cite', files: SPEC_FILES.cite, plant: (s) => s + '\nSee ./ROADMAP.md and docs/INTERNAL.md.\n' }, // ./ and dir/ prefixes
    { name: './SECRET.md', check: 'cite', files: SPEC_FILES.cite, plant: (s) => s + '\nSee ./SECRET.md\n' },
    { name: '../ under PTR', check: 'cite', files: SPEC_FILES.cite, plant: (s) => s + PTR + '\nSee ../LEDGER.md\n' },               // ../ leaves the package
    { name: '/ root', check: 'cite', files: SPEC_FILES.cite, plant: (s) => s + '\nSee [r](/ROADMAP.md).\n' },     // root prefix (review D r1, split r2)
    { name: '~/ home', check: 'cite', files: SPEC_FILES.cite, plant: (s) => s + '\nSee ~/SECRET.md.\n' },     // home prefix (review D r1, split r2)
    { name: 'after a colon', check: 'cite', files: SPEC_FILES.cite, plant: (s) => s + '\nSee:SECRET.md\n' },     // ':' is not a path character (review D r2)
    { check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\n * It is faster on small arrays.\n' },
    { name: '3x faster', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nlowerBoundBranchlessF64 is 3x faster than branchy on every CPU.\n' },
    // a following block may not lend its tier word (each split conjunct has its own plant):
    { name: 'paragraph lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nIt is faster on small arrays\n\nPRELIMINARY: one CPU.\n' },           // paragraph
    { name: 'JSDoc close lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\n/** It is faster on small arrays */ const PRELIMINARY = 1;\n' },             // JSDoc close (JSDoc blocks on separate lines: a paragraph break)
    { name: 'list item lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\n- It is faster on small arrays\n- PRELIMINARY: one CPU.\n' },          // list item
    { name: 'table cell lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\n| It is faster on small arrays | PRELIMINARY |\n' },                  // table cell
    { name: 'sentence lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nIt is faster on small arrays. PRELIMINARY: one CPU.\n' },             // sentence
    { name: 'sentence .) lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\n(It read 3x faster at every n.) PRELIMINARY applies to another row.\n' },
    { name: 'sentence ! lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nIt is 3x faster! PRELIMINARY: one CPU.\n' },
    { name: 'heading lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nIt is faster on small arrays\n## PRELIMINARY: one CPU\n' },
    { name: 'fence lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nIt is faster on small arrays\n```\nPRELIMINARY: one CPU\n```\n' },
    { name: 'JSDoc @tag lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\n/**\n * It is faster on small arrays\n * @remarks PRELIMINARY: one CPU.\n */\n' },
    { name: 'N) list item lends', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\n1) It is faster on small arrays\n2) PRELIMINARY: one CPU.\n' },
    // the disclaimer exemption is narrow: only a negated QUOTED word is dropped
    { name: 'disclaimer plus a claim', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nNo table and no "faster than" statement ships; it is 3x faster.\n' },
    { name: 'quoted, not negated', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nIt is "faster than" branchy.\n' },
    { name: 'negated quote, no statement', check: 'speed', files: SPEC_FILES.speed, plant: (s) => s + '\nThe hint kernel is no "faster than" lowerBoundBranchless on incoherent streams.\n' },
];

test('control: docsProblems -- a clean in-memory set has 0 problems', () => {
    assert.deepEqual(docsProblems(cleanMap()), []);
});

test('control: docsProblems -- a file left out is missing in every check that lists it', () => {
    const m = cleanMap();
    m.delete('README.md');
    assert.deepEqual(docsProblems(m), ['exists', 'names', 'qbox', 'never', 'tokens', 'ascii', 'bare', 'cite', 'repo', 'speed'].map((c) => c + ' README.md: missing README.md'));
});

let plantCases = 0;
for (const p of PLANTS) {
    for (const f of p.files) {
        plantCases++;
        test('control: docsProblems -- ' + p.check + (p.name ? ' (' + p.name + ')' : '') + ' violation planted in ' + f + ' is exactly one problem', () => {
            const m = cleanMap();
            m.set(f, p.plant(m.get(f)));
            const pr = docsProblems(m);
            assert.equal(pr.length, 1, JSON.stringify(pr));
            assert.ok(pr[0].startsWith(p.check + ' ' + f + ': '), pr[0]);
        });
    }
}

test('control: docsProblems -- 111 planted (check, file) cases', () => {
    assert.equal(plantCases, 111);   // 21 + cite 8 x 4 + speed 16 x 3 + repo 2 x 5 (registered below; counted before any test runs)
});

test('control: a missing doc file is reported missing', () => {
    const r = loadDocs(join(ROOT, 'test', 'no-such-dir'), DOCS);
    assert.deepEqual(r.missing, DOCS);
});

test('control: export names -- a dropped name and a prefix-only name are missing', () => {
    const all = NAMES.join(' ');
    assert.deepEqual(missingNames(all, NAMES), []);
    assert.deepEqual(missingNames(NAMES.filter((n) => n !== 'nearestI32').join(' '), NAMES), ['nearestI32']);
    assert.deepEqual(missingNames(all.replace('nearestI32', 'nearestI32x'), NAMES), ['nearestI32']);
});

test('control: roster -- a dropped module key and a name absent from a doc fail, naming it', () => {
    const docs = new Map(NAME_FILES.map((f) => [f, ROSTER.join(' ')]));
    assert.deepEqual(rosterProblems(ROSTER, ROSTER, docs), []);
    assert.deepEqual(rosterProblems(ROSTER.filter((n) => n !== 'segmentHintI32'), ROSTER, docs),
        ['module is missing export segmentHintI32']);
    assert.deepEqual(rosterProblems([...ROSTER, 'bogusExport'], ROSTER, docs),
        ['module has export bogusExport not in ROSTER']);
    const noLlms = new Map(docs).set('llms.txt', ROSTER.filter((n) => n !== 'upperBoundHintU16').join(' '));
    assert.deepEqual(rosterProblems(ROSTER, ROSTER, noLlms), ['llms.txt is missing upperBoundHintU16']);
    const prefix = new Map(docs).set('README.md', ROSTER.join(' ').replace('assertRange', 'assertRangeX'));
    assert.deepEqual(rosterProblems(ROSTER, ROSTER, prefix), ['README.md is missing assertRange']);
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

test('control: cite -- LEDGER.md / RESEARCH.md pass only with the pointer sentence; a shipped one always passes; nothing else ever', () => {
    const shipped = JSON.parse(SHIPPED).files;
    assert.deepEqual(uncitable('see RESEARCH.md and LEDGER.md', shipped), ['RESEARCH.md', 'LEDGER.md']);
    assert.deepEqual(uncitable('see RESEARCH.md and ./LEDGER.md\n' + PTR, shipped), []);
    assert.deepEqual(uncitable('see ROADMAP.md\n' + PTR, shipped), ['ROADMAP.md']);
    assert.deepEqual(uncitable('see README.md, ./CHANGELOG.md and `./README.md`', shipped), []);
    assert.deepEqual(uncitable('see ../README.md and docs/README.md', shipped), ['../README.md', 'docs/README.md']);
    assert.deepEqual(uncitable('see https://example.com/x/ROADMAP.md', shipped), []);   // a URL is not a file citation
    const m = cleanMap();
    m.set('llms.txt', CLEAN + 'see RESEARCH.md and ./README.md\n' + PTR + '\n');
    assert.deepEqual(docsProblems(m), []);
});

// NEON-R2: the package.json the verdict reads loses its repository -> every shipped doc holding PTR is one problem.
const REPO_PKGS = [['no repository', NOREPO], ['an empty repository url', JSON.stringify({ files: SHIPPED_FILES, repository: { type: 'git', url: '' } })]];
for (const [label, pkg] of REPO_PKGS) {
    for (const f of SPEC_FILES.repo) {
        plantCases++;
        test('control: docsProblems -- repo: PTR in ' + f + ' with ' + label + ' in package.json is exactly one problem', () => {
            const m = cleanMap();
            m.set('package.json', pkg);
            assert.deepEqual(docsProblems(m), []);   // no PTR anywhere: no repository needed
            m.set(f, m.get(f) + PTR + '\n');
            const pr = docsProblems(m);
            assert.equal(pr.length, 1, JSON.stringify(pr));
            assert.ok(pr[0].startsWith('repo ' + f + ': '), pr[0]);
        });
    }
}

test('control: repo -- the live package.json without its repository fails the live docs (a copy, never the file)', () => {
    const pkg = JSON.parse(live.texts.get('package.json'));
    assert.ok(hasRepository(pkg), 'the live package.json has a repository');
    delete pkg.repository;
    const m = new Map(live.texts);
    m.set('package.json', JSON.stringify(pkg));
    const pr = docsProblems(m).filter((p) => p.startsWith('repo '));
    assert.deepEqual(pr, DOCS.filter((f) => live.texts.get(f).includes(PTR)).map((f) => 'repo ' + f + ': holds the pointer sentence but package.json has no repository'));
    assert.ok(pr.length >= 2, 'README.md and llms.txt hold PTR: ' + JSON.stringify(pr));
    assert.equal(hasRepository({ repository: 'github:x/y' }), true);
    assert.equal(hasRepository({ repository: ' ' }), false);
    assert.equal(hasRepository({ repository: null }), false);
    assert.equal(hasRepository({ repository: {} }), false);
});

test('control: bare -- a result comment inside a js fence hits, a checked or prose line does not', () => {
    assert.equal(bareResultHits('```js\nf(); // -> 3\nf(); // 3\n```').length, 1);
    assert.equal(bareResultHits('```js\nf(); // cold, once\n```\nprose // 3').length, 0);
});

test('control: speed -- "slower" without a tier word hits, with one does not', () => {
    assert.equal(speedHits(' * It can be slower than x.').length, 1);
    assert.equal(speedHits(' * It can be slower than x (PRELIMINARY, one CPU).').length, 0);
    // a sentence wrapped over JSDoc lines is one sentence; a disclaimer alone is not a claim
    assert.equal(speedHits('/**\n * It can be slower than x\n * (PRELIMINARY, one CPU).\n */').length, 0);
    assert.equal(speedHits('- **Not a speed claim.** No benchmark table and no "faster than" statement ships here.').length, 0);
});
