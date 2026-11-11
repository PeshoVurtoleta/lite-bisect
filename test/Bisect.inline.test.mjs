// test/Bisect.inline.test.mjs -- U5 TurboFan inline pin (SPEC-p1 U5 + M4, assertion 8). Untimed.
// Spawns test/gates/inline-driver.mjs under --allow-natives-syntax --no-concurrent-recompilation
// --trace-turbo-inlining; every expected value comes from test/gates/expect.json (SPEC-p1
// section 1 table), never from Bisect.js (LEDGER law 9). An EDGE is one pinned inline:
//   outer  "Inlining <name> into call_<name>"           -- 35 rows (7 kernels x 5 types)
//   inner  "Inlining <inner.name> into call_<name>"     -- 15 rows (hint x2 sites, segment, nearest)
// V8 names the OUTERMOST function being compiled after "into" (traced on v26.8.2), so the inner
// branchless call of hint / segment / nearest is pinned through the outer caller literal.
// An edge PASSES only if its caller carries the TurboFan bits (calibrated against reference fns
// in the same process; no calibration = NO VERDICT = FAIL) AND the trace has exactly `sites`
// matching lines. Controls: a caller that never optimizes, a kernel that cannot inline, a
// deleted trace line, a wrong kernel name, a broken calibration, and M4 (the pinned Node only).

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
function edgesOf(rows) {
    const byName = new Map(rows.map((r) => [r.name, r]));
    const edges = [];
    for (const r of rows) {
        edges.push({ id: 'call_' + r.name + ' <- ' + r.name, caller: 'call_' + r.name, callee: r.name, sites: 1, bytes: r.bytes, op: r.op });
        if (r.inner) {
            const ir = byName.get(r.inner.name);
            if (!ir) throw new Error('expect.json: inner ' + r.inner.name + ' of ' + r.name + ' has no row');
            edges.push({ id: 'call_' + r.name + ' <- ' + ir.name + ' (inner)', caller: 'call_' + r.name, callee: ir.name, sites: r.inner.sites, bytes: ir.bytes, op: ir.op });
        }
    }
    return edges;
}
const EDGES = edgesOf(EXPECT.rows);

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
test('census: expect.json rows == the kernel exports of Bisect.js (35), driver ROW set == rows', () => {
    const kernels = Object.keys(B).filter((k) => !COLD.has(k)).sort();
    const rows = EXPECT.rows.map((r) => r.name).sort();
    assert.deepEqual(rows, kernels);
    assert.equal(rows.length, 35);
    assert.equal(new Set(rows).size, 35);
    assert.equal(EDGES.length, 50);
    assert.equal(EXPECT.pinned.node, PINNED_NODE, 'expect.json pin != the literal skip predicate');
    for (const r of EXPECT.rows) assert.equal(r.turbofanInlines, true, r.name + ' turbofanInlines');
    const v = verdict(EDGES, BASE);
    assert.equal(v.done, 35, 'driver did not finish 35 rows');
    assert.deepEqual(v.extra, [], 'driver ROW lines with no expect.json row');
});

test('assertion 8: every expect.json edge inlined by TurboFan (bit calibrated in-process)', () => {
    const v = verdict(EDGES, BASE);
    assert.equal(v.noVerdict, null, v.noVerdict);
    assert.ok(v.mask !== 0);
    assert.deepEqual(failing(v), [], fmt(v));
    assert.equal(v.rows.length, 50);
});

// ---- controls (revert checks): each must FAIL exactly its own rows ----------------------------
test('control a1: a planted caller that never reaches TurboFan fails its rows only', () => {
    const v = verdict(EDGES, runDriver([], ['--never-opt', 'call_nearestU16']));
    assert.deepEqual(failing(v), ['call_nearestU16 <- lowerBoundBranchlessU16 (inner)', 'call_nearestU16 <- nearestU16']);
    for (const r of v.rows) if (!r.ok) assert.match(r.reason, /caller not TurboFan/);
});

test('control a2: a planted kernel that cannot inline fails every edge that pins it, only those', () => {
    const v = verdict(EDGES, runDriver([], ['--no-inline', 'upperBoundBranchlessF32']));
    assert.deepEqual(failing(v), ['call_segmentF32 <- upperBoundBranchlessF32 (inner)', 'call_upperBoundBranchlessF32 <- upperBoundBranchlessF32']);
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

test('control b2: a wrong kernel name fails that row only (trace side and expect side)', () => {
    const t = BASE.replace(/<SharedFunctionInfo lowerBoundBranchyF64>\} into/, '<SharedFunctionInfo lowerBoundBranchyF32>} into');
    assert.notEqual(t, BASE);
    assert.deepEqual(failing(verdict(EDGES, t)), ['call_lowerBoundBranchyF64 <- lowerBoundBranchyF64']);
    const rows = EXPECT.rows.map((r) => (r.name === 'segmentU32' ? { ...r, name: 'segmentU23' } : r));
    const v = verdict(edgesOf(rows), BASE);
    assert.deepEqual(failing(v).filter((id) => id.startsWith('call_segmentU23')).length, 2);
    assert.deepEqual(v.extra, ['call_segmentU32']);
});

test('control: a broken TurboFan calibration is NO VERDICT on every row', () => {
    const t = BASE.replace(/^REF on=(\d+) off=(\d+)/m, (_, on) => 'REF on=' + on + ' off=' + on);
    const v = verdict(EDGES, t);
    assert.match(String(v.noVerdict), /TurboFan bits not calibrated/);
    assert.equal(failing(v).length, 50);
    const v2 = verdict(EDGES, BASE.replace(/^REF .*$/m, ''));
    assert.equal(failing(v2).length, 50);
    const v3 = verdict(EDGES, BASE.replace(/^REF on=(\d+) off=(\d+) maglev=\d+$/m, (_, on, off) => 'REF on=' + on + ' off=' + off + ' maglev=' + on)); assert.match(String(v3.noVerdict), /Maglev ref carries/); assert.equal(failing(v3).length, 50);
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
    const want = EDGES.filter((e) => e.op === '==' && e.bytes > limit).map((e) => e.id).sort();
    assert.equal(want.length, 35, 'per type (x5): branchless pair, hint, hint inner, segment inner, nearest inner, and nearest itself (189 B since AU-R1a: 30 -> 35)');
    const v = verdict(EDGES, runDriver([EXPECT.m4.flag], []));
    assert.equal(v.noVerdict, null, v.noVerdict);
    assert.deepEqual(failing(v), want);
    for (const r of v.rows) {
        if (r.ok) assert.ok(r.edge.op === '<' ? r.edge.bytes <= 100 : r.edge.bytes < 100, r.id + ' passed under M4');
        else assert.match(r.reason, /^0 Inlining lines/);
    }
});
