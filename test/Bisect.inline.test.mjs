// test/Bisect.inline.test.mjs -- U5 TurboFan inline pin (SPEC-p1 U5 + M4, assertion 8). Untimed.
// Spawns test/gates/inline-driver.mjs under --allow-natives-syntax --no-concurrent-recompilation
// --trace-turbo-inlining; every expected value comes from test/gates/expect.json (SPEC-p1
// section 1 table), never from Bisect.js (LEDGER law 9). An EDGE is one pinned inline:
//   outer  "Inlining <name> into call_<name>"           -- 45 edges (9 kernels x 5 types)
//   inner  "Inlining <inner.name> into call_<name>"     -- 30 edges (lowerBoundHint x2 sites, segment,
//          nearest, upperBoundHint; segmentHint's inner is an ARRAY: upperBoundHint + upperBoundBranchless)
// = 75 single-channel edges (assertion 8, every Node). 1.1 seghint C13 pin (SPEC seghint-1.1 B-S4, BA3):
// the expect.json channels2 rows also get a literal two-channel caller call2_<name>; each of its edges
// (itself and every inner) is expected at sites x 2 -- 25 edges, judged on the pinned Node only (a skip
// worded NO VERDICT elsewhere, never a pass). channels3 = the c3 control: call3_<name> (driver --chan3)
// must FAIL every inner edge with exactly 2 of the 3 lines (TurboFan's cumulative budget, LEDGER C13).
// V8 names the OUTERMOST function being compiled after "into" (traced on v26.8.2), so the inner
// branchless call of hint / segment / nearest is pinned through the outer caller literal.
// An edge PASSES only if its caller carries the TurboFan bits (calibrated against reference fns
// in the same process; no calibration = NO VERDICT = FAIL) AND the trace has exactly `sites`
// matching lines. Controls: a caller that never optimizes, a kernel that cannot inline, a
// deleted trace line, a wrong kernel name, a broken calibration, and M4 + c3 (the pinned Node only).

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as B from '../Bisect.js';

const DRIVER = fileURLToPath(new URL('./gates/inline-driver.mjs', import.meta.url));
const EXPECT = JSON.parse(readFileSync(new URL('./gates/expect.json', import.meta.url), 'utf8'));
const FLAGS = ['--allow-natives-syntax', '--no-concurrent-recompilation', '--trace-turbo-inlining'];
const PINNED_NODE = 'v26.8.2'; // SPEC-p1 U5: the skip predicate is process.version !== 'v26.8.2'
const PINNED = process.version === PINNED_NODE;
const COLD = new Set(['assertRange', 'assertSorted']);

const INLINE_RE = /^Inlining 0x[0-9a-f]+ \{0x[0-9a-f]+ <SharedFunctionInfo (\w+)>\} into 0x[0-9a-f]+ \{0x[0-9a-f]+ <SharedFunctionInfo (\w+)>\}/;
const SIZE_RE = /^\s+- target: 0x[0-9a-f]+ \{0x[0-9a-f]+ <SharedFunctionInfo (\w+)>\}, bytecode size: (\d+)/;

// ---- edges from expect.json -----------------------------------------------------------------
// inner: null, ONE {name, sites} object, or an ARRAY of them. names: null = every row, else the
// channel's row names (each must have a row); prefix = the caller literal's prefix; mult = channels
// (sites x mult); innerOnly drops the outer edge (the c3 control pins the inner edges only).
function innersOf(r) {
    if (r.inner === null) return [];
    const list = Array.isArray(r.inner) ? r.inner : [r.inner];
    if (list.length === 0 || typeof r.inner !== 'object') throw new Error('expect.json: bad inner of ' + r.name);
    for (const i of list) {
        if (i === null || typeof i !== 'object' || typeof i.name !== 'string' || !Number.isInteger(i.sites) || !(i.sites >= 1)) {
            throw new Error('expect.json: inner ' + JSON.stringify(i) + ' of ' + r.name + ' is not {name, sites}');
        }
    }
    const seen = new Set(list.map((i) => i.name));
    if (seen.size !== list.length || seen.has(r.name)) throw new Error('expect.json: duplicate or self inner of ' + r.name);
    return list;
}
// names is REQUIRED: null = every row, an array = the channel list; undefined (a missing expect.json
// channels list) or anything else throws, so a missing list can never become "every row".
function edgesOf(rows, names, prefix = 'call_', mult = 1, innerOnly = false) {
    if (names !== null && !Array.isArray(names)) {
        throw new Error('edgesOf: names must be null or an array, got ' + typeof names);
    }
    const byName = new Map(rows.map((r) => [r.name, r]));
    const pick = names === null ? rows : names.map((n) => {
        const r = byName.get(n);
        if (!r) throw new Error('expect.json: channel row ' + n + ' has no row');
        return r;
    });
    const edges = [];
    for (const r of pick) {
        const caller = prefix + r.name;
        if (!innerOnly) edges.push({ id: caller + ' <- ' + r.name, caller, callee: r.name, sites: mult, bytes: r.bytes, op: r.op });
        for (const i of innersOf(r)) {
            const ir = byName.get(i.name);
            if (!ir) throw new Error('expect.json: inner ' + i.name + ' of ' + r.name + ' has no row');
            edges.push({ id: caller + ' <- ' + ir.name + ' (inner)', caller, callee: ir.name, sites: i.sites * mult, bytes: ir.bytes, op: ir.op });
        }
    }
    return edges;
}
const edgesAll = (rows) => [...edgesOf(rows, null), ...edgesOf(rows, EXPECT.channels2, 'call2_', 2)];
const EDGES = edgesOf(EXPECT.rows, null); // single-channel, assertion 8
const EDGES2 = edgesOf(EXPECT.rows, EXPECT.channels2, 'call2_', 2); // two-channel, C13 pin
const EDGES3 = edgesOf(EXPECT.rows, EXPECT.channels3, 'call3_', 3, true); // c3 control (expected to FAIL)
const ALL = [...EDGES, ...EDGES2];

// ---- the checker: pure over (edges, driver stdout) ------------------------------------------
function verdict(edges, text) {
    const lines = text.split('\n');
    const inl = new Map();
    const status = new Map();
    const sizes = new Map();
    let ref = null;
    let done = null;
    for (const line of lines) {
        let m = INLINE_RE.exec(line);
        if (m) { const k = m[1] + ' into ' + m[2]; inl.set(k, (inl.get(k) || 0) + 1); continue; }
        m = SIZE_RE.exec(line);
        if (m) { sizes.set(m[1], Number(m[2])); continue; }
        m = /^ROW (\w+) status=(\d+)$/.exec(line);
        if (m) { status.set(m[1], Number(m[2])); continue; }
        m = /^REF on=(\d+) off=(\d+) maglev=(\d+)$/.exec(line);
        if (m) { ref = { on: Number(m[1]), off: Number(m[2]), maglev: Number(m[3]) }; continue; }
        m = /^DONE rows=(\d+) /.exec(line);
        if (m) done = Number(m[1]);
    }
    let mask = 0;
    let noVerdict = null;
    if (ref === null) noVerdict = 'NO VERDICT: no REF line';
    else {
        mask = ref.on & ~ref.off & ~1;
        if (mask === 0) noVerdict = 'NO VERDICT: TurboFan bits not calibrated (on=' + ref.on + ' off=' + ref.off + ')';
        else if ((ref.maglev & mask) === mask) noVerdict = 'NO VERDICT: Maglev ref carries the TurboFan mask ' + mask;
    }
    const rows = edges.map((e) => {
        const st = status.get(e.caller);
        const n = inl.get(e.callee + ' into ' + e.caller) || 0;
        let reason = null;
        if (noVerdict) reason = noVerdict;
        else if (st === undefined) reason = 'NO VERDICT: no ROW line for ' + e.caller;
        else if ((st & mask) !== mask) reason = 'caller not TurboFan (status ' + st + ', mask ' + mask + ')';
        else if (n !== e.sites) reason = n + ' Inlining lines, expected ' + e.sites;
        return { id: e.id, edge: e, ok: reason === null, reason };
    });
    const callers = new Set(edges.map((e) => e.caller));
    const extra = [...status.keys()].filter((c) => !callers.has(c));
    return { rows, ref, mask, done, sizes, extra, noVerdict };
}

function runDriver(extraFlags, args) {
    const r = spawnSync(process.execPath, [...FLAGS, ...extraFlags, DRIVER, ...args], {
        encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(r.error, undefined, 'spawn error: ' + r.error);
    assert.equal(r.signal, null, 'driver killed by ' + r.signal);
    assert.equal(r.status, 0, 'driver exit ' + r.status + '\n' + r.stderr);
    assert.equal(r.stderr, '', 'driver stderr: ' + r.stderr);
    return r.stdout;
}

const failing = (v) => v.rows.filter((r) => !r.ok).map((r) => r.id).sort();
const fmt = (v) => v.rows.filter((r) => !r.ok).map((r) => r.id + ': ' + r.reason).join('\n');

let BASE = null;
before(() => { BASE = runDriver([], []); });

// ---- the gate ---------------------------------------------------------------------------------
test('census: expect.json rows == the kernel exports of Bisect.js (45), driver ROW set == call_ + call2_ callers (55)', () => {
    const kernels = Object.keys(B).filter((k) => !COLD.has(k)).sort();
    const rows = EXPECT.rows.map((r) => r.name).sort();
    assert.deepEqual(rows, kernels);
    assert.equal(rows.length, 45);
    assert.equal(new Set(rows).size, 45);
    assert.equal(EDGES.length, 75, '45 outer + 30 inner single-channel edges');
    assert.equal(EXPECT.channels2.length, 10);
    assert.equal(new Set(EXPECT.channels2).size, 10);
    assert.equal(EDGES2.length, 25, 'per type: upperBoundHint 2 edges + segmentHint 3 edges, x5');
    assert.equal(EXPECT.channels3.length, 5);
    assert.equal(new Set(EXPECT.channels3).size, 5);
    assert.equal(EDGES3.length, 10, 'per type: segmentHint inner upperBoundHint + upperBoundBranchless, x5');
    assert.equal(EXPECT.pinned.node, PINNED_NODE, 'expect.json pin != the literal skip predicate');
    for (const r of EXPECT.rows) assert.equal(r.turbofanInlines, true, r.name + ' turbofanInlines');
    const v = verdict(ALL, BASE);
    assert.equal(v.done, 55, 'driver DONE rows != 55 (45 call_ + 10 call2_)');
    assert.deepEqual(v.extra, [], 'driver ROW lines with no expect.json row');
    assert.equal(new Set(ALL.map((e) => e.caller)).size, 55);
});

test('assertion 8: every single-channel expect.json edge inlined by TurboFan (bit calibrated in-process)', () => {
    const v = verdict(EDGES, BASE);
    assert.equal(v.noVerdict, null, v.noVerdict);
    assert.ok(v.mask !== 0);
    assert.deepEqual(failing(v), [], fmt(v));
    assert.equal(v.rows.length, 75);
});

// ---- C13 two-channel pin: the pinned Node only; a skip elsewhere, never a pass -----------------
test('C13 pin: both channels inline in every call2_ caller (25 edges at sites x 2)', {
    skip: PINNED ? false : 'C13 NO VERDICT: not ' + PINNED_NODE,
}, () => {
    assert.ok(process.versions.v8.startsWith(EXPECT.pinned.v8Prefix), 'V8 ' + process.versions.v8);
    const v = verdict(EDGES2, BASE);
    assert.equal(v.noVerdict, null, v.noVerdict);
    assert.ok(v.mask !== 0);
    assert.deepEqual(failing(v), [], fmt(v));
    assert.equal(v.rows.length, 25);
    for (const r of v.rows) assert.equal(r.edge.sites, 2, r.id);
});

// ---- controls (revert checks): each must FAIL exactly its own rows ----------------------------
test('control a1: a planted caller that never reaches TurboFan fails its rows only', () => {
    const v = verdict(EDGES, runDriver([], ['--never-opt', 'call_nearestU16']));
    assert.deepEqual(failing(v), ['call_nearestU16 <- lowerBoundBranchlessU16 (inner)', 'call_nearestU16 <- nearestU16']);
    for (const r of v.rows) if (!r.ok) assert.match(r.reason, /caller not TurboFan/);
});

// a2 judges the two-channel edges too on the pinned Node (elsewhere they carry no verdict, so the
// expected list keeps only the single-channel ids there).
const A2_EDGES = PINNED ? ALL : EDGES;
const a2want = (ids) => ids.filter((id) => A2_EDGES.some((e) => e.id === id)).sort();
test('control a2: a planted kernel that cannot inline fails every edge that pins it, only those', () => {
    const v = verdict(A2_EDGES, runDriver([], ['--no-inline', 'upperBoundBranchlessF32']));
    const want = a2want([
        'call_upperBoundBranchlessF32 <- upperBoundBranchlessF32',
        'call_segmentF32 <- upperBoundBranchlessF32 (inner)',
        'call_upperBoundHintF32 <- upperBoundBranchlessF32 (inner)',
        'call_segmentHintF32 <- upperBoundBranchlessF32 (inner)',
        'call2_upperBoundHintF32 <- upperBoundBranchlessF32 (inner)',
        'call2_segmentHintF32 <- upperBoundBranchlessF32 (inner)',
    ]);
    assert.equal(want.length, PINNED ? 6 : 4);
    assert.deepEqual(failing(v), want, fmt(v));
    for (const r of v.rows) if (!r.ok) assert.match(r.reason, /^0 Inlining lines/);
});

test('control a2: a planted upperBoundHintU16 that cannot inline fails its edges and every inner behind it, only those', () => {
    const v = verdict(A2_EDGES, runDriver([], ['--no-inline', 'upperBoundHintU16']));
    const want = a2want([
        'call_upperBoundHintU16 <- upperBoundHintU16',
        'call_upperBoundHintU16 <- upperBoundBranchlessU16 (inner)',
        'call_segmentHintU16 <- upperBoundHintU16 (inner)',
        'call_segmentHintU16 <- upperBoundBranchlessU16 (inner)',
        'call2_upperBoundHintU16 <- upperBoundHintU16',
        'call2_upperBoundHintU16 <- upperBoundBranchlessU16 (inner)',
        'call2_segmentHintU16 <- upperBoundHintU16 (inner)',
        'call2_segmentHintU16 <- upperBoundBranchlessU16 (inner)',
    ]);
    assert.equal(want.length, PINNED ? 8 : 4);
    assert.deepEqual(failing(v), want, fmt(v));
    for (const r of v.rows) if (!r.ok) assert.match(r.reason, /^0 Inlining lines/);
});

test('control b1: one deleted trace line fails that row only', () => {
    const lines = BASE.split('\n');
    const idx = lines.findIndex((l) => /<SharedFunctionInfo nearestF64>\} into .*<SharedFunctionInfo call_nearestF64>\}/.test(l));
    assert.ok(idx >= 0, 'no nearestF64 line to delete');
    lines.splice(idx, 1);
    assert.deepEqual(failing(verdict(EDGES, lines.join('\n'))), ['call_nearestF64 <- nearestF64']);
    const l3 = BASE.split('\n'); l3.splice(idx, 0, l3[idx]); assert.deepEqual(failing(verdict(EDGES, l3.join('\n'))), ['call_nearestF64 <- nearestF64']);
    // and one of the two hint inner sites
    const l2 = BASE.split('\n');
    const j = l2.findIndex((l) => /<SharedFunctionInfo lowerBoundBranchlessI32>\} into .*<SharedFunctionInfo call_lowerBoundHintI32>\}/.test(l));
    assert.ok(j >= 0);
    l2.splice(j, 1);
    assert.deepEqual(failing(verdict(EDGES, l2.join('\n'))), ['call_lowerBoundHintI32 <- lowerBoundBranchlessI32 (inner)']);
});

test('control b1 (two-channel): deleting one of the two call2_upperBoundHintF32 lines fails that edge alone', {
    skip: PINNED ? false : 'C13 NO VERDICT: not ' + PINNED_NODE,
}, () => {
    const re = /<SharedFunctionInfo upperBoundHintF32>\} into .*<SharedFunctionInfo call2_upperBoundHintF32>\}/;
    const lines = BASE.split('\n');
    const idx = lines.findIndex((l) => re.test(l));
    assert.ok(idx >= 0, 'no upperBoundHintF32 into call2_upperBoundHintF32 line to delete');
    lines.splice(idx, 1);
    const v = verdict(ALL, lines.join('\n'));
    assert.deepEqual(failing(v), ['call2_upperBoundHintF32 <- upperBoundHintF32']);
    assert.match(v.rows.find((r) => !r.ok).reason, /^1 Inlining lines, expected 2$/);
    const l3 = BASE.split('\n'); l3.splice(idx, 0, l3[idx]);
    assert.deepEqual(failing(verdict(ALL, l3.join('\n'))), ['call2_upperBoundHintF32 <- upperBoundHintF32']);
});

test('control b2: a wrong kernel name fails that row only (trace side and expect side)', () => {
    const t = BASE.replace(/<SharedFunctionInfo lowerBoundBranchyF64>\} into/, '<SharedFunctionInfo lowerBoundBranchyF32>} into');
    assert.notEqual(t, BASE);
    assert.deepEqual(failing(verdict(EDGES, t)), ['call_lowerBoundBranchyF64 <- lowerBoundBranchyF64']);
    const rows = EXPECT.rows.map((r) => (r.name === 'segmentU32' ? { ...r, name: 'segmentU23' } : r));
    const v = verdict(edgesAll(rows), BASE);
    assert.deepEqual(failing(v).filter((id) => id.startsWith('call_segmentU23')).length, 2);
    assert.deepEqual(v.extra, ['call_segmentU32']);
});

test('control: a broken TurboFan calibration is NO VERDICT on every row', () => {
    const t = BASE.replace(/^REF on=(\d+) off=(\d+)/m, (_, on) => 'REF on=' + on + ' off=' + on);
    const v = verdict(EDGES, t);
    assert.match(String(v.noVerdict), /TurboFan bits not calibrated/);
    assert.equal(failing(v).length, 75);
    const v2 = verdict(EDGES, BASE.replace(/^REF .*$/m, ''));
    assert.equal(failing(v2).length, 75);
    const v3 = verdict(EDGES, BASE.replace(/^REF on=(\d+) off=(\d+) maglev=\d+$/m, (_, on, off) => 'REF on=' + on + ' off=' + off + ' maglev=' + on)); assert.match(String(v3.noVerdict), /Maglev ref carries/); assert.equal(failing(v3).length, 75);
    assert.equal(failing(verdict(EDGES2, t)).length, 25);
});

// ---- M4: the pinned Node only; a skip elsewhere, never a pass ---------------------------------
test('M4 control: under --max-inlined-bytecode-size=102 exactly the > 102 B edges fail', {
    skip: PINNED ? false : 'M4 NO VERDICT: not ' + PINNED_NODE,
}, () => {
    assert.ok(process.versions.v8.startsWith(EXPECT.pinned.v8Prefix), 'V8 ' + process.versions.v8);
    // the traced candidate sizes agree with the table (exact rows must be traced; budget rows if traced)
    const base = verdict(EDGES, BASE);
    for (const r of EXPECT.rows) {
        const got = base.sizes.get(r.name);
        if (r.op === '==') assert.equal(got, r.bytes, r.name + ' traced size');
        else if (got !== undefined) assert.ok(got < r.bytes, r.name + ' traced size ' + got + ' >= budget ' + r.bytes);
    }
    const limit = EXPECT.m4.limit;
    assert.equal(EXPECT.m4.flag, '--max-inlined-bytecode-size=' + limit);
    const want = ALL.filter((e) => e.op === '==' && e.bytes > limit).map((e) => e.id).sort();
    assert.equal(want.length, 75, 'per type (x5): branchless pair, hint, hint inner, segment inner, nearest inner, nearest itself (189 B since AU-R1a: 30 -> 35); 1.1: upperBoundHint + its inner, segmentHint inner x2 (single 55), and the same 4 per type in call2_ (+20 = 75)');
    const v = verdict(ALL, runDriver([EXPECT.m4.flag], []));
    assert.equal(v.noVerdict, null, v.noVerdict);
    assert.deepEqual(failing(v), want);
    for (const r of v.rows) {
        if (r.ok) assert.ok(r.edge.op === '<' ? r.edge.bytes <= 100 : r.edge.bytes < 100, r.id + ' passed under M4');
        else assert.match(r.reason, /^0 Inlining lines/);
    }
});

// ---- c3: the pinned Node only. A three-channel segmentHint caller inlines 2 of its 3 upperBoundHint
// (and upperBoundBranchless) candidates: TurboFan's cumulative budget (LEDGER C13). The control is
// OPEN (FAIL) if all 3 inline; a caller not in TurboFan is NO VERDICT and FAILS too (tier checked).
test('c3 control: every call3_segmentHint caller fails its upperBoundHint and upperBoundBranchless edges with 2 of 3 lines', {
    skip: PINNED ? false : 'c3 NO VERDICT: not ' + PINNED_NODE,
}, () => {
    assert.ok(process.versions.v8.startsWith(EXPECT.pinned.v8Prefix), 'V8 ' + process.versions.v8);
    const SRC = readFileSync(DRIVER, 'utf8');
    for (const n of EXPECT.channels3) {
        const m = new RegExp('\\nfunction call3_' + n + '\\(a, b, c, k\\) \\{\\n([^}]*)\\n\\}').exec(SRC);
        assert.ok(m, 'no call3_' + n + ' literal');
        for (const ch of ['(a, 0, a.length, QX', '(b, 0, b.length, QY', '(c, 0, c.length, QZ']) assert.equal(m[1].split(n + ch).length - 1, 1, 'call3_' + n + ' channel ' + ch);
    }
    const text = runDriver([], ['--chan3']);
    const all = [...ALL, ...EDGES3];
    const v = verdict(all, text);
    assert.equal(v.noVerdict, null, v.noVerdict);
    assert.equal(v.done, 60, 'driver DONE rows != 60 under --chan3 (55 + 5 call3_)');
    assert.deepEqual(v.extra, [], 'driver ROW lines with no edge');
    for (const r of v.rows) {
        if (!r.id.startsWith('call3_') || r.ok) continue;
        if (/caller not TurboFan/.test(r.reason)) assert.fail('c3 NO VERDICT: ' + r.id + ': ' + r.reason);
        assert.match(r.reason, /^2 Inlining lines, expected 3$/, r.id);
    }
    const want = EDGES3.map((e) => e.id).sort();
    assert.equal(want.length, 10);
    assert.deepEqual(failing(v), want, 'c3 control open or other edges moved:\n' + fmt(v));
});

// ---- NIT a: call2_ driver SOURCE shape (pure source read, every Node, no driver run) ------------------
// Per name in channels2: the literal `function call2_<n>(a, b, k) {` exists once; channel a calls
// `<n>(a, 0, a.length, QX` once and channel b `<n>(b, 0, b.length, QY` once; each channel reads AND writes
// only its own slot (H_call2_<n>[0] for a, [1] for b). segmentHint's walk starts at -1: the setup loop
// (`init = name.startsWith('call2_segmentHint') ? -1 : 0`, both slots set to init) is pinned once.
function call2SrcProblems(src, names) {
    const out = [];
    const cnt = (hay, needle) => hay.split(needle).length - 1;
    for (const n of names) {
        const c = 'call2_' + n;
        const lit = 'function ' + c + '(a, b, k) {';
        if (cnt(src, '\n' + lit + '\n') !== 1) { out.push(c + ': literal "' + lit + '" count != 1'); continue; }
        const m = new RegExp('\\nfunction ' + c + '\\(a, b, k\\) \\{\\n([^}]*)\\n\\}').exec(src);
        if (!m) { out.push(c + ': no body'); continue; }
        const body = m[1];
        const h = 'H_' + c;
        const a = new RegExp('^    const r0 = ' + n + '\\(a, 0, a\\.length, QX\\w+\\[k\\], '
            + h + '\\[0\\]\\); ' + h + '\\[0\\] = r0;$', 'm');
        const b = new RegExp('^    const r1 = ' + n + '\\(b, 0, b\\.length, QY\\w+\\[k\\], '
            + h + '\\[1\\]\\); ' + h + '\\[1\\] = r1;$', 'm');
        if (cnt(body, n + '(a, 0, a.length, QX') !== 1) out.push(c + ': channel a call count != 1');
        if (cnt(body, n + '(b, 0, b.length, QY') !== 1) out.push(c + ': channel b call count != 1');
        if (!a.test(body)) out.push(c + ': channel a does not read and write its own slot ' + h + '[0]');
        if (!b.test(body)) out.push(c + ': channel b does not read and write its own slot ' + h + '[1]');
        if (cnt(body, h + '[0]') !== 2 || cnt(body, h + '[1]') !== 2) out.push(c + ': slot use count != 2 + 2');
        if (cnt(src, 'const ' + h + ' = new Int32Array(2);') !== 1) {
            out.push(c + ': slot array ' + h + ' not declared once as Int32Array(2)');
        }
    }
    const initLit = "const init = name.startsWith('call2_segmentHint') ? -1 : 0;\n"
        + '        hs[0] = init;\n        hs[1] = init;';
    if (cnt(src, initLit) !== 1) {
        out.push('call2_segmentHint: -1 start of the slot walk (init, hs[0], hs[1]) not pinned once');
    }
    return out;
}

test('call2_ source shape: literal, one call per channel, own hint slot (pure source read)', () => {
    assert.equal(EXPECT.channels2.length, 10);
    const SRC = readFileSync(DRIVER, 'utf8');
    assert.deepEqual(call2SrcProblems(SRC, EXPECT.channels2), []);
});

test('control: call2_ source shape fails a swapped slot index, naming the caller', () => {
    const SRC = readFileSync(DRIVER, 'utf8');
    for (const n of EXPECT.channels2) {
        const h = 'H_call2_' + n;
        const from = ', ' + h + '[1]); ' + h + '[1] = r1;';
        assert.equal(SRC.split(from).length, 2, 'no unique channel-b line for ' + n);
        const bad = SRC.replace(from, ', ' + h + '[0]); ' + h + '[1] = r1;');
        const got = call2SrcProblems(bad, EXPECT.channels2);
        assert.ok(got.length >= 1 && got.every((p) => p.startsWith('call2_' + n + ':')), n + ': ' + got.join(' | '));
    }
    const renamed = SRC.replace('\nfunction call2_segmentHintF32(a, b, k) {',
        '\nfunction call2_segmentHintF32(a, b, c) {');
    assert.notEqual(renamed, SRC);
    assert.deepEqual(call2SrcProblems(renamed, EXPECT.channels2).map((p) => p.split(':')[0]), ['call2_segmentHintF32']);
});

test('control: edgesOf throws on an undefined channels list; null stays every row', () => {
    assert.throws(() => edgesOf(EXPECT.rows, undefined, 'call2_', 2), /names must be null or an array/);
    assert.throws(() => edgesOf(EXPECT.rows, 'call2_', 'x', 2), /names must be null or an array/);
    assert.equal(edgesOf(EXPECT.rows, null).length, 75);
    assert.equal(edgesOf(EXPECT.rows, EXPECT.channels2, 'call2_', 2).length, 25);
});
