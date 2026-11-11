// test/gates/size.test.mjs -- U9 size / pack gate (SPEC-p1 U9, M6 / M7, assertion 14). Run by `npm run size`
// (and `npm run verify`); NOT in the npm-test glob (test/*.test.mjs). Deterministic: no clock, no quiet lock.
// ONE verdict function, sizeProblems(input), returns a list of problem strings ([] = pass). The real row feeds it
// the live package; every must-fail control ("control: ...") feeds it a planted copy of the live input and reads
// the SAME sizeProblems (LEDGER B5 / B7). input = { pack: { status, stdout }, budgetText, bisectText }.
//   pack     `npm pack --dry-run --json` (spawnSync, cwd = package root, bounded timeout). A non-zero exit, a
//            spawn error, unparsable stdout or a shape other than [{ size, unpackedSize, files: [{ path }] }] is
//            a problem. The files list must be EXACTLY PACK_FILES (7 paths incl. package.json): 0 missing,
//            0 extra, 0 duplicates.
//   budget   test/gates/size-budget.json, a committed JSON literal (LEDGER law 9: never computed from the file
//            it bounds). Keys BUDGET_KEYS, each a positive safe integer; a missing key, an unknown key (other
//            than "about"), a missing / unparsable file is a problem, never a skip.
//              tarballBytes         pack JSON `size` (packed .tgz bytes)         <= budget
//              unpackedBytes        pack JSON `unpackedSize`                     <= budget
//              strippedBisectBytes  UTF-8 bytes of Bisect.js, comments removed   <= budget
//   strip    stripComments(text): a one-pass tokenizer with states code / '...' / "..." / `...` / // / /* */.
//            Inside a quoted or template literal a backslash escapes the next char and comment markers are
//            text. A // comment is removed up to (not including) its newline; a /* */ block is removed whole
//            (its newlines too). Everything else is kept byte for byte (whitespace is NOT collapsed).
//            Not handled, so FAIL closed: any `/` in code that does not open a comment (a regex literal or a
//            division; Bisect.js has none) is a problem ('unsupported / in code'). Not handled at all: `${}`
//            nesting a template inside a template. An unterminated literal or block comment is a problem.
// Controls (assertion 14 and the brief's c-f): an extra and a missing file in the pack list; the live tarball
// size x 1.10 exceeds tarballBytes (so every budget sits < 10% above its measured value); a missing budget key;
// a 10x Bisect.js-sized comment pad leaves strippedBisectBytes unchanged and passes, while a 10% code pad
// (a string literal holding // and /*, so a stripper that ignores literals would miss it) FAILS.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUDGET = join(ROOT, 'test', 'gates', 'size-budget.json');
const PACK_FILES = ['Bisect.js', 'Bisect.d.ts', 'llms.txt', 'LICENSE.txt', 'CHANGELOG.md', 'README.md', 'package.json'];
const BUDGET_KEYS = ['tarballBytes', 'unpackedBytes', 'strippedBisectBytes'];
const PACK_MS = 60000;

// ---- strip + verdict --------------------------------------------------------------------------------

// Returns { text, error }: error is null or a string naming the unterminated / unsupported state.
function stripComments(src) {
    let out = '';
    let i = 0;
    const n = src.length;
    while (i < n) {
        const c = src[i];
        const d = i + 1 < n ? src[i + 1] : '';
        if (c === '/' && d === '/') {
            let j = i + 2;
            while (j < n && src[j] !== '\n') j++;
            i = j;
        } else if (c === '/' && d === '*') {
            const j = src.indexOf('*/', i + 2);
            if (j < 0) return { text: out, error: 'unterminated block comment at ' + i };
            i = j + 2;
        } else if (c === '\'' || c === '"' || c === '`') {
            let j = i + 1;
            while (j < n && src[j] !== c) {
                if (src[j] === '\\') j++;
                else if (c !== '`' && src[j] === '\n') return { text: out, error: 'unterminated string at ' + i };
                j++;
            }
            if (j >= n) return { text: out, error: 'unterminated literal at ' + i };
            out += src.slice(i, j + 1);
            i = j + 1;
        } else if (c === '/') return { text: out, error: 'unsupported / in code at ' + i };
        else {
            out += c;
            i++;
        }
    }
    return { text: out, error: null };
}

function strippedBytes(src) {
    const r = stripComments(src);
    return { bytes: Buffer.byteLength(r.text, 'utf8'), error: r.error };
}

function isPosInt(v) {
    return typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
}

function sizeProblems(input) {
    const probs = [];
    // budget
    let budget = null;
    if (typeof input.budgetText !== 'string') probs.push('budget: size-budget.json missing');
    else {
        let parsedOk = false;
        try { budget = JSON.parse(input.budgetText); parsedOk = true; } catch (e) { probs.push('budget: unparsable: ' + e.message); }
        if (parsedOk && (budget === null || typeof budget !== 'object' || Array.isArray(budget))) {
            probs.push('budget: not a plain object');
            budget = null;
        }
        if (budget !== null) {
            for (const k of BUDGET_KEYS) {
                if (!Object.hasOwn(budget, k)) probs.push('budget: missing key ' + k);
                else if (!isPosInt(budget[k])) probs.push('budget: ' + k + ' not a positive integer: ' + JSON.stringify(budget[k]));
            }
            for (const k of Object.keys(budget)) {
                if (k !== 'about' && !BUDGET_KEYS.includes(k)) probs.push('budget: unknown key ' + k);
            }
        }
    }
    const measured = {};
    // pack
    const pack = input.pack;
    let entry = null;
    if (!pack || pack.status !== 0) probs.push('pack: npm pack exit ' + (pack ? pack.status : 'none') + (pack && pack.error ? ' ' + pack.error : ''));
    else {
        let parsed;
        try { parsed = JSON.parse(pack.stdout); } catch (e) { probs.push('pack: unparsable JSON: ' + e.message); }
        if (parsed !== undefined) {
            if (!Array.isArray(parsed) || parsed.length !== 1 || parsed[0] === null || typeof parsed[0] !== 'object' || !Array.isArray(parsed[0].files)) {
                probs.push('pack: shape is not [{ files: [...] }]');
            } else entry = parsed[0];
        }
    }
    if (entry !== null) {
        const paths = entry.files.map((f) => (f && typeof f.path === 'string' ? f.path : JSON.stringify(f)));
        for (const p of PACK_FILES) if (!paths.includes(p)) probs.push('pack: missing ' + p);
        const seen = new Set();
        for (const p of paths) {
            if (!PACK_FILES.includes(p)) probs.push('pack: extra ' + p);
            else if (seen.has(p)) probs.push('pack: duplicate ' + p);
            seen.add(p);
        }
        if (isPosInt(entry.size)) measured.tarballBytes = entry.size;
        else probs.push('pack: size not a positive integer: ' + JSON.stringify(entry.size));
        if (isPosInt(entry.unpackedSize)) measured.unpackedBytes = entry.unpackedSize;
        else probs.push('pack: unpackedSize not a positive integer: ' + JSON.stringify(entry.unpackedSize));
    }
    // Bisect.js stripped
    if (typeof input.bisectText !== 'string') probs.push('strip: Bisect.js missing');
    else {
        const s = strippedBytes(input.bisectText);
        if (s.error !== null) probs.push('strip: ' + s.error);
        else measured.strippedBisectBytes = s.bytes;
    }
    // budget rows
    if (budget !== null) {
        for (const k of BUDGET_KEYS) {
            if (!isPosInt(budget[k]) || !Object.hasOwn(measured, k)) continue; // already reported above
            if (!(measured[k] <= budget[k])) probs.push('size: ' + k + ' ' + measured[k] + ' > budget ' + budget[k]);
        }
    }
    return probs;
}

// ---- live input ---------------------------------------------------------------------------------------

function readOrNull(p) {
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

function runPack(cwd) {
    const r = spawnSync('npm', ['pack', '--dry-run', '--json'], {
        cwd, encoding: 'utf8', timeout: PACK_MS, maxBuffer: 1 << 24,
    });
    return { status: r.status, stdout: r.stdout, error: r.error ? r.error.message : null };
}

const live = {
    pack: runPack(ROOT),
    budgetText: readOrNull(BUDGET),
    bisectText: readOrNull(join(ROOT, 'Bisect.js')),
};

function clone(over) {
    return Object.assign({ pack: live.pack, budgetText: live.budgetText, bisectText: live.bisectText }, over);
}

function livePackEntry() {
    return JSON.parse(live.pack.stdout)[0];
}

function plantedPack(fn) {
    const arr = JSON.parse(live.pack.stdout);
    fn(arr[0]);
    return { status: 0, stdout: JSON.stringify(arr), error: null };
}

// ---- real row -----------------------------------------------------------------------------------------

test('size: npm pack lists exactly the 7 files and every size is <= its size-budget.json key', (t) => {
    const probs = sizeProblems(live);
    if (live.pack.status === 0) {
        try {
            const e = livePackEntry();
            t.diagnostic('measured tarballBytes=' + e.size + ' unpackedBytes=' + e.unpackedSize +
                ' files=' + e.files.map((f) => f.path).join(','));
        } catch { /* sizeProblems already reports it */ }
    }
    if (typeof live.bisectText === 'string') t.diagnostic('measured strippedBisectBytes=' + strippedBytes(live.bisectText).bytes +
        ' rawBisectBytes=' + Buffer.byteLength(live.bisectText, 'utf8'));
    assert.deepEqual(probs, []);
});

// ---- controls (each planted input judged by the same sizeProblems) -------------------------------------

test('control: an extra file in the pack list fails', () => {
    const pack = plantedPack((e) => e.files.push({ path: 'demo/index.html', size: 10, mode: 420 }));
    assert.deepEqual(sizeProblems(clone({ pack })), ['pack: extra demo/index.html']);
});

test('control: a missing file in the pack list fails', () => {
    const pack = plantedPack((e) => { e.files = e.files.filter((f) => f.path !== 'README.md'); });
    assert.deepEqual(sizeProblems(clone({ pack })), ['pack: missing README.md']);
});

test('control: a duplicated file in the pack list fails', () => {
    const pack = plantedPack((e) => e.files.push({ path: 'Bisect.js', size: 1, mode: 420 }));
    assert.deepEqual(sizeProblems(clone({ pack })), ['pack: duplicate Bisect.js']);
});

test('control: the live tarball size x 1.10 exceeds tarballBytes (assertion 14)', () => {
    const padded = Math.ceil(livePackEntry().size * 1.10);
    const pack = plantedPack((e) => { e.size = padded; });
    const b = JSON.parse(live.budgetText);
    assert.deepEqual(sizeProblems(clone({ pack })), ['size: tarballBytes ' + padded + ' > budget ' + b.tarballBytes]);
});

test('control: the live unpacked size x 1.10 exceeds unpackedBytes', () => {
    const padded = Math.ceil(livePackEntry().unpackedSize * 1.10);
    const pack = plantedPack((e) => { e.unpackedSize = padded; });
    const b = JSON.parse(live.budgetText);
    assert.deepEqual(sizeProblems(clone({ pack })), ['size: unpackedBytes ' + padded + ' > budget ' + b.unpackedBytes]);
});

for (const k of BUDGET_KEYS) {
    test('control: a missing budget key fails -- ' + k, () => {
        const b = JSON.parse(live.budgetText);
        delete b[k];
        assert.deepEqual(sizeProblems(clone({ budgetText: JSON.stringify(b) })), ['budget: missing key ' + k]);
    });
}

test('control: an unknown budget key fails (did you mean a typo)', () => {
    const b = JSON.parse(live.budgetText);
    b.tarbalBytes = 1;
    assert.deepEqual(sizeProblems(clone({ budgetText: JSON.stringify(b) })), ['budget: unknown key tarbalBytes']);
});

test('control: a missing budget file, a missing Bisect.js, a failed or unparsable pack each fail', () => {
    assert.deepEqual(sizeProblems(clone({ budgetText: null })), ['budget: size-budget.json missing']);
    assert.deepEqual(sizeProblems(clone({ bisectText: null })), ['strip: Bisect.js missing']);
    assert.deepEqual(sizeProblems(clone({ pack: { status: 1, stdout: '', error: null } })), ['pack: npm pack exit 1']);
    const bad = sizeProblems(clone({ pack: { status: 0, stdout: 'npm notice not json', error: null } }));
    assert.equal(bad.length, 1);
    assert.ok(bad[0].startsWith('pack: unparsable JSON: '), bad[0]);
    assert.deepEqual(sizeProblems(clone({ pack: { status: 0, stdout: '[]', error: null } })), ['pack: shape is not [{ files: [...] }]']);
});

test('control: a budget file holding JSON null fails (not a plain object)', () => {
    assert.deepEqual(sizeProblems(clone({ budgetText: 'null' })), ['budget: not a plain object']);
});

test('control: npm pack printing JSON null fails the shape check', () => {
    assert.deepEqual(sizeProblems(clone({ pack: { status: 0, stdout: 'null', error: null } })), ['pack: shape is not [{ files: [...] }]']);
});

test('control: a string budget value fails (not a positive integer)', () => {
    const b = JSON.parse(live.budgetText);
    b.tarballBytes = String(b.tarballBytes);
    assert.deepEqual(sizeProblems(clone({ budgetText: JSON.stringify(b) })),
        ['budget: tarballBytes not a positive integer: ' + JSON.stringify(b.tarballBytes)]);
});

test('control: a two-entry pack array fails the shape check', () => {
    const arr = JSON.parse(live.pack.stdout);
    arr.push(arr[0]);
    assert.deepEqual(sizeProblems(clone({ pack: { status: 0, stdout: JSON.stringify(arr), error: null } })), ['pack: shape is not [{ files: [...] }]']);
});

test('control: a / in code (a regex literal or a division) fails the strip, never strips silently', () => {
    const at = live.bisectText.length + 1 + 'const r = '.length;
    assert.deepEqual(sizeProblems(clone({ bisectText: live.bisectText + '\nconst r = /a\/\/b/;\n' })), ['strip: unsupported / in code at ' + at]);
    assert.deepEqual(sizeProblems(clone({ bisectText: live.bisectText + '\nconst r = 4 / 2;\n' })), ['strip: unsupported / in code at ' + (at + 2)]);
});

test('control: a 10x comment pad does not change the stripped size and passes', () => {
    const raw = Buffer.byteLength(live.bisectText, 'utf8');
    assert.equal(live.bisectText.split(') {\n').length > 1, true); // a code line to hang a // comment on
    const padText = '/*' + 'x'.repeat(raw * 10) + '*/' + live.bisectText.replace(') {\n', ') {// ' + 'y'.repeat(raw) + '\n');
    assert.equal(strippedBytes(padText).bytes, strippedBytes(live.bisectText).bytes);
    assert.deepEqual(sizeProblems(clone({ bisectText: padText })), []);
});

test('control: a 10% code pad (a string literal holding // and /*) fails strippedBisectBytes', () => {
    const base = strippedBytes(live.bisectText).bytes;
    const pad = Math.ceil(base * 0.10);
    const line = '\nexport const PAD = \'// /* ' + 'z'.repeat(pad) + '\';\n';
    const padText = live.bisectText + line;
    const got = strippedBytes(padText).bytes;
    assert.equal(got, base + Buffer.byteLength(line, 'utf8'));
    const b = JSON.parse(live.budgetText);
    assert.deepEqual(sizeProblems(clone({ bisectText: padText })), ['size: strippedBisectBytes ' + got + ' > budget ' + b.strippedBisectBytes]);
});

test('control: an unterminated block comment or string fails the strip', () => {
    assert.deepEqual(sizeProblems(clone({ bisectText: live.bisectText + '\n/* open' })),
        ['strip: unterminated block comment at ' + (live.bisectText.length + 1)]);
    assert.deepEqual(sizeProblems(clone({ bisectText: live.bisectText + '\nconst s = \'open\n' })),
        ['strip: unterminated string at ' + (live.bisectText.length + 11)]);
});
