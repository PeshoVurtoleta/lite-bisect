// test/gates/bytecode.test.mjs -- U6 bytecode gate (SPEC-p1 U6 G3, assertion 9; P1-R1). Deterministic
// (bytecode lengths), no clock: no quiet lock. NOT in the npm test glob (test/*.test.mjs): run by
// `npm run gates` / `npm run gates:local`. Pinned Node only: bytecode-budget.sh --node-version gives
// NO-VERDICT on any other node, and this file fails with NO VERDICT before spawning it (SPEC-p1 R6).
// Every maximum comes from test/gates/expect.json (U5's table, typed from SPEC-p1 section 1 and the U2
// one-shot report), never from Bisect.js (LEDGER law 9): `==` rows pass --max <bytes> to the tool AND must
// read exactly <bytes> here; `<` rows (segment, nearest: Maglev's 100 B single-inline cap) pass
// --max <bytes - 1>. The table itself is checked against SPEC-p1 section 1 typed below. A row passes only
// if the tool exits 0 with VERDICT WITHIN, its fn has exactly 1 match, and the length meets the row; a
// kernel passes only if its 5 per-type copies read the same length (SPEC-p1 section 1).
// Controls (scratch mutants of Bisect.js in a mktemp dir; the driver imports LITE_BISECT_MODULE):
//   +1 B lowerBoundBranchlessF64 (104 B) FAILS (tool OVER, row, copies); segmentF64 padded to exactly
//   100 B FAILS its < 100 row (closes the U5 nit: segment's budget is checked here); segmentF64 at 99 B
//   passes its row and fails copies-equal; segmentF32 + 1 B (26 B) fails copies-equal only; a wrong
//   --node-version is NO VERDICT; parser controls on edited report text.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTools, provenanceLines, runBounded, missingGateFiles, PKG_ROOT } from './lu.mjs';

const EXPECT = JSON.parse(readFileSync(new URL('./expect.json', import.meta.url), 'utf8'));
const DRIVER = fileURLToPath(new URL('./bytecode-driver.mjs', import.meta.url));
const BISECT = join(PKG_ROOT, 'Bisect.js');
const PINNED_NODE = EXPECT.pinned.node;
const TIMEOUT_MS = 900000;
// SPEC-p1 section 1 bytecode expectations, typed here (law 9: the table is checked, not trusted):
const SPEC = {
    lowerBoundBranchless: ['==', 103], upperBoundBranchless: ['==', 103],
    lowerBoundBranchy: ['==', 55], upperBoundBranchy: ['==', 55],
    lowerBoundHint: ['==', 228], segment: ['<', 100], nearest: ['<', 100],
};
const TYPES = ['F64', 'F32', 'U32', 'U16', 'I32'];

const LU = resolveTools();
const need = () => {
    if (process.version !== PINNED_NODE) assert.fail('NO VERDICT: node ' + process.version + ' is not the pinned ' + PINNED_NODE + ' (gates run on the pinned Node only)');
    if (!process.versions.v8.startsWith(EXPECT.pinned.v8Prefix)) assert.fail('NO VERDICT: V8 ' + process.versions.v8 + ' is not ' + EXPECT.pinned.v8Prefix);
    if (!LU.ok) assert.fail('NO VERDICT: ' + LU.reason);
};

export function maxOf(row) {
    if (row.op === '==') return row.bytes;
    if (row.op === '<') return row.bytes - 1;
    throw new Error('expect.json: unknown op ' + row.op + ' for ' + row.name);
}

function runBudget(rows, { module = null, nodeVersion = PINNED_NODE } = {}) {
    const args = [LU.tools['bytecode-budget.sh'], '--max', rows.map((r) => r.name + '=' + maxOf(r)).join(','),
        '--node-version', nodeVersion, '--node', process.execPath, DRIVER];
    const env = { ...process.env };
    if (module) env.LITE_BISECT_MODULE = module; else delete env.LITE_BISECT_MODULE;
    const r = runBounded('bash', args, { timeoutMs: TIMEOUT_MS, env });
    return { ...r, cmd: 'bash ' + args.join(' ') + (module ? '  (LITE_BISECT_MODULE=' + module + ')' : '') };
}

/** Pure over (rows, tool exit, tool report text). */
export function check(rows, status, text) {
    const lens = new Map();
    const fnVerdict = new Map();
    let verdict = null;
    for (const line of text.split('\n')) {
        let m = /^ {2}(\w+): (\d+) match\(es\): ([0-9,]+|-)$/.exec(line);
        if (m) { lens.set(m[1], { count: Number(m[2]), lengths: m[3] === '-' ? [] : m[3].split(',').map(Number) }); continue; }
        m = /^ {2}(\w+): (WITHIN|OVER|NO-VERDICT) -- /.exec(line);
        if (m) { fnVerdict.set(m[1], m[2]); continue; }
        m = /^VERDICT (\S+)$/.exec(line);
        if (m) verdict = m[1];
    }
    let noVerdict = null;
    if (status === 2 || verdict === 'NO-VERDICT') noVerdict = 'NO VERDICT: bytecode-budget exit ' + status + ' verdict ' + verdict;
    else if (status !== 0 && status !== 1) noVerdict = 'NO VERDICT: bytecode-budget exit ' + status;
    else if (verdict === null) noVerdict = 'NO VERDICT: no VERDICT line';
    const out = rows.map((r) => {
        const got = lens.get(r.name);
        const v = fnVerdict.get(r.name);
        let reason = null;
        if (noVerdict) reason = noVerdict;
        else if (!got) reason = 'no length line';
        else if (got.count !== 1 || got.lengths.length !== 1) reason = got.count + ' matches (' + got.lengths.join(',') + '), expected 1';
        else if (v !== 'WITHIN') reason = 'tool ' + v + ' at --max ' + maxOf(r) + ' (length ' + got.lengths[0] + ')';
        else if (r.op === '==' && got.lengths[0] !== r.bytes) reason = 'length ' + got.lengths[0] + ' != ' + r.bytes;
        else if (r.op === '<' && !(got.lengths[0] < r.bytes)) reason = 'length ' + got.lengths[0] + ' not < ' + r.bytes;
        return { name: r.name, kernel: r.kernel, ok: reason === null, length: got && got.lengths.length === 1 ? got.lengths[0] : null, reason };
    });
    const kernels = [...new Set(rows.map((r) => r.kernel))];
    const copies = kernels.map((k) => {
        const ls = out.filter((o) => o.kernel === k).map((o) => o.length);
        const ok = ls.length === TYPES.length && ls.every((l) => typeof l === 'number' && l === ls[0]);
        return { kernel: k, ok, lengths: ls, reason: ok ? null : 'copies differ or missing: ' + ls.join(',') };
    });
    const pass = noVerdict === null && status === 0 && verdict === 'WITHIN' && out.every((o) => o.ok) && copies.every((c) => c.ok);
    return { pass, noVerdict, verdict, status, rows: out, copies };
}

function log(tag, res, cmd) {
    console.log('# ' + tag + ' cmd: ' + cmd);
    console.log('# ' + tag + ' tool exit ' + res.status + ' VERDICT ' + res.verdict + (res.noVerdict ? ' | ' + res.noVerdict : ''));
    for (const r of res.rows) console.log(tag + ' ' + (r.ok ? 'ok  ' : 'FAIL') + ' ' + r.name.padEnd(26) + ' ' + String(r.length).padStart(4) + ' B' + (r.reason ? ' | ' + r.reason : ''));
    for (const c of res.copies) console.log(tag + ' ' + (c.ok ? 'ok  ' : 'FAIL') + ' copies ' + c.kernel.padEnd(22) + ' ' + c.lengths.join(',') + (c.reason ? ' | ' + c.reason : ''));
}
const failRows = (res) => res.rows.filter((r) => !r.ok).map((r) => r.name).sort();
const failCopies = (res) => res.copies.filter((c) => !c.ok).map((c) => c.kernel).sort();
const rowsOf = (kernel) => EXPECT.rows.filter((r) => r.kernel === kernel);

const TMP = mkdtempSync(join(tmpdir(), 'lite-bisect-u6-bytecode-'));
process.on('exit', () => { rmSync(TMP, { recursive: true, force: true }); });

/** A scratch copy of Bisect.js with ONE exact, count-checked replacement inside fn `name`. */
function mutant(tag, name, find, replace) {
    const src = readFileSync(BISECT, 'utf8');
    const start = src.indexOf('export function ' + name + '(');
    assert.ok(start >= 0, 'mutant ' + tag + ': no fn ' + name);
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end);
    assert.equal(body.split(find).length, 2, 'mutant ' + tag + ': find text must match exactly once in ' + name);
    const dir = mkdtempSync(join(TMP, tag + '-'));
    const p = join(dir, 'Bisect.mjs');
    writeFileSync(p, src.slice(0, start) + body.replace(find, replace) + src.slice(end));
    return p;
}

before(() => {
    if (LU.ok) for (const l of provenanceLines(LU)) console.log(l);
});

// ---- the gate -----------------------------------------------------------------------------------
test('census: both gate files exist and npm run gates names them (a missing named path passes node --test)', () => {
    assert.deepEqual(missingGateFiles(), []);
});

test('table: expect.json rows == 7 kernels x 5 types and match SPEC-p1 section 1', () => {
    assert.equal(EXPECT.rows.length, 35);
    for (const [k, [op, bytes]] of Object.entries(SPEC)) {
        const rs = rowsOf(k);
        assert.deepEqual(rs.map((r) => r.type).sort(), [...TYPES].sort(), k + ' types');
        for (const r of rs) {
            assert.equal(r.name, k + r.type);
            assert.equal(r.op, op, r.name + ' op');
            assert.equal(r.bytes, bytes, r.name + ' bytes');
        }
    }
    assert.ok(SPEC.lowerBoundBranchy[1] < 100 && SPEC.upperBoundBranchy[1] < 100, 'branchy < 100 (SPEC-p1)');
});

let BASE = null;
test('assertion 9 bytecode: branchless == 103, branchy == 55 (< 100), hint == 228, segment / nearest < 100, 5 copies equal', () => {
    need();
    const r = runBudget(EXPECT.rows);
    BASE = { ...check(EXPECT.rows, r.status, r.stdout + r.stderr), text: r.stdout };
    log('G', BASE, r.cmd);
    assert.equal(BASE.noVerdict, null, BASE.noVerdict);
    assert.deepEqual(failRows(BASE), []);
    assert.deepEqual(failCopies(BASE), []);
    assert.equal(BASE.rows.length, 35);
    assert.equal(BASE.copies.length, 7);
    assert.ok(BASE.pass);
});

// ---- controls -----------------------------------------------------------------------------------
test('control: +1 B lowerBoundBranchlessF64 (104 B, same semantics) FAILS: tool OVER, its row, copies', () => {
    need();
    const p = mutant('plus1', 'lowerBoundBranchlessF64', 'return b + ((a[b] < x) | 0);', 'const r = b + ((a[b] < x) | 0);\n    return r;');
    const rows = rowsOf('lowerBoundBranchless');
    const r = runBudget(rows, { module: p });
    const res = check(rows, r.status, r.stdout + r.stderr);
    log('C-plus1', res, r.cmd);
    assert.equal(res.status, 1, 'tool must say OVER (exit 1)');
    assert.equal(res.verdict, 'OVER');
    assert.equal(res.rows.find((x) => x.name === 'lowerBoundBranchlessF64').length, 104);
    assert.deepEqual(failRows(res), ['lowerBoundBranchlessF64']);
    assert.deepEqual(failCopies(res), ['lowerBoundBranchless']);
    assert.equal(res.pass, false);
});

test('control: segmentF64 padded to 100 B FAILS its < 100 row; at 99 B the row passes and copies-equal fails', () => {
    need();
    const call = 'return upperBoundBranchlessF64(a, lo, hi, x) - 1;';
    const rows = rowsOf('segment');
    const p100 = mutant('seg100', 'segmentF64', call, 'if (lo > hi) lo = hi;\n    '.repeat(5) + 'if (lo < 0) lo = 0;\n    ' + call);
    const r100 = runBudget(rows, { module: p100 });
    const a = check(rows, r100.status, r100.stdout + r100.stderr);
    log('C-seg100', a, r100.cmd);
    assert.equal(a.rows.find((x) => x.name === 'segmentF64').length, 100, 'the pad must give exactly 100 B');
    assert.equal(a.status, 1);
    assert.deepEqual(failRows(a), ['segmentF64']);
    assert.equal(a.pass, false);
    const p99 = mutant('seg99', 'segmentF64', call, 'if (lo > hi) lo = hi;\n    '.repeat(4) + 'if (x !== x) x = 0;\n    '.repeat(2) + call);
    const r99 = runBudget(rows, { module: p99 });
    const b = check(rows, r99.status, r99.stdout + r99.stderr);
    log('C-seg99', b, r99.cmd);
    assert.equal(b.rows.find((x) => x.name === 'segmentF64').length, 99, 'the pad must give exactly 99 B');
    assert.equal(b.status, 0);
    assert.deepEqual(failRows(b), []);
    assert.deepEqual(failCopies(b), ['segment']);
    assert.equal(b.pass, false);
});

test('control: segmentF32 + 1 B (26 B, within budget) fails copies-equal only', () => {
    need();
    const p = mutant('segf32', 'segmentF32', 'return upperBoundBranchlessF32(a, lo, hi, x) - 1;',
        'const r = upperBoundBranchlessF32(a, lo, hi, x) - 1;\n    return r;');
    const rows = rowsOf('segment');
    const r = runBudget(rows, { module: p });
    const res = check(rows, r.status, r.stdout + r.stderr);
    log('C-segf32', res, r.cmd);
    assert.equal(res.status, 0);
    assert.deepEqual(failRows(res), []);
    assert.deepEqual(failCopies(res), ['segment']);
    assert.equal(res.pass, false);
});

test('control: a node version other than the maxima\'s is NO VERDICT (tool exit 2)', () => {
    need();
    const rows = rowsOf('segment');
    const r = runBudget(rows, { nodeVersion: 'v26.8.1' });
    const res = check(rows, r.status, r.stdout + r.stderr);
    console.log('# C-version tool exit ' + r.status + ' | ' + res.noVerdict);
    assert.equal(r.status, 2);
    assert.match(String(res.noVerdict), /^NO VERDICT/);
    assert.equal(failRows(res).length, 5);
    assert.equal(res.pass, false);
});

test('control: the parser fails closed (missing line, 2 matches, wrong op, no VERDICT line)', () => {
    assert.ok(BASE && BASE.text, 'NO VERDICT: the gate run did not complete');
    const t = BASE.text;
    const one = (name, text, st = 0) => failRows(check(EXPECT.rows, st, text)).includes(name);
    assert.ok(one('nearestU16', t.replace(/^ {2}nearestU16: 1 match\(es\): \d+$/m, '')));
    assert.ok(one('nearestU16', t.replace(/^ {2}nearestU16: 1 match\(es\): (\d+)$/m, '  nearestU16: 2 match(es): $1,$1')));
    assert.ok(one('lowerBoundHintI32', t.replace(/^ {2}lowerBoundHintI32: 1 match\(es\): 228$/m, '  lowerBoundHintI32: 1 match(es): 227')));
    assert.ok(one('lowerBoundHintI32', t.replace(/^ {2}lowerBoundHintI32: WITHIN -- /m, '  lowerBoundHintI32: OVER -- ')));
    assert.equal(check(EXPECT.rows, 0, t.replace(/^VERDICT WITHIN$/m, '')).pass, false);
    assert.equal(check(EXPECT.rows, 2, t).pass, false);
    assert.equal(check(EXPECT.rows, 0, t).pass, true, 'the unedited text must pass (control of the controls)');
    assert.throws(() => maxOf({ name: 'x', op: '<=', bytes: 1 }), /unknown op/);
});
