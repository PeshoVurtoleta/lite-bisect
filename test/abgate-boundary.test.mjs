// test/abgate-boundary.test.mjs -- comparator-boundary rows for bench/ab-gate.mjs's verdict path (verdictOf).
// What: ten rows B1-B10 on the sha-pinned ubuntu fixture, each putting ONE value exactly ON a verdictOf comparator
// boundary (word med 1.05 / 0.95, word q1 / q3 = 1, aa med 0.95 / 1.05, slow med 1.25, slow q1 1.10, bop 1/64, a literal
// Infinity), each run through the LIVE gate as a child `--verdict-file -`; plus one must-fail comparator mutant per
// boundary (a `>` / `>=` flip in a scratch copy of the gate) that must read a different exit or VERDICT line there.
// Why: ab-gate.mjs's own selftest rows F1-F45 (FIXTURE_CASES) all sit away from every comparator boundary, so nine of
// the ten > / >= flips below survive all 45 (bopZero does not: every fixture bop cell is 0.0000, on its
// boundary). Ported from LitePerfGate's research probe r0-verdict-parity.mjs (sha 16693c6e),
// section "P5 boundary rows": the BROWS rows and mutations as they are there, and its slicing approach (FIXTURES,
// FIXTURE_CASES, applyMut and MUT_ERR are sliced out of ab-gate.mjs's own source text by unique anchors, never retyped).
// Ruling (maintainer, 2026-11-24): a node:test file in `npm test`, NOT rows inside ab-gate.mjs; ab-gate.mjs stays
// byte-identical (sha pinned below -- a changed gate means AB-G3a (ROADMAP) no longer holds and these rows are
// re-derived). The --verdict-file path is untimed (no clock) and needs no node flags, so no quiet lock.
// ab-gate.mjs:2-3 ("Never part of npm run verify, npm test or a required check") holds for the TIMED gate run only:
// its untimed --verdict-file path runs here, in npm test, npm run coverage and ci.yml's npm test step.
// Every expected text is a committed literal derived from a run of the live gate at the pin (LEDGER law 9: literals,
// never computed in the run that checks them).
// OUT of scope (recorded for post-1.1.0): the in-clock fold / post-timing reference controls -- they need a new
// LAB_INJECT entry, i.e. a gate-logic change.
// Child spawns: 10 live + 10 A/A (unmutated copy from a tmp dir) + 11 mutant = 31. ASCII only.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = fileURLToPath(new URL('..', import.meta.url));
const GATE = join(PKG, 'bench/ab-gate.mjs');
const GATE_PIN = '7e0f9262f5f9b5fff5dee7c3a35a7f25c8b604164a3a45059e1619f0432a7f35';
const sha = (b) => createHash('sha256').update(b).digest('hex');

const gateBuf = readFileSync(GATE);
const gateSha = sha(gateBuf);
const src = gateBuf.toString('utf8');

// both anchors must occur exactly once in the gate source, else the slice is refused
function count(hay, needle) { return hay.split(needle).length - 1; }
function between(a, b) {
    if (count(src, a) !== 1 || count(src, b) !== 1) throw new Error('anchor ' + JSON.stringify(a) + ' / ' + JSON.stringify(b) + ' not unique');
    const i = src.indexOf(a), j = src.indexOf(b);
    if (!(i < j)) throw new Error('anchor ' + JSON.stringify(a) + ' not before ' + JSON.stringify(b));
    return src.slice(i, j);
}
let T = null, sliceErr = null;
try {
    const tablesSrc = between('const FIXTURES = Object.freeze({', 'const REQUIRED_FLAGS') + '\n' +
        between('const MUT_F3 =', 'function child(') + '\nreturn { FIXTURES, FIXTURE_CASES, applyMut, MUT_ERR };';
    T = new Function('join', 'PKG', tablesSrc)(join, PKG);
    for (const k of Object.keys(T.FIXTURES)) {
        T.FIXTURES[k].buf = readFileSync(T.FIXTURES[k].path);
        T.FIXTURES[k].text = T.FIXTURES[k].buf.toString('utf8');
    }
} catch (e) { sliceErr = e; }

let tmp = null;
after(() => { if (tmp !== null) rmSync(tmp, { recursive: true, force: true }); });
function tmpDir() {
    if (tmp === null) tmp = mkdtempSync(join(tmpdir(), 'litebisect-abgate-mut-'));
    return tmp;
}

// ---------------------------------------------------------------- (b) rows: r0 16693c6e P5 BROWS, verbatim
const U4096 = 'aa=1.001[1.000..1.003] slow=5.821[5.815..5.823]', FW16 = 'slow=3.023[3.019..3.026]';
const RO16 = 'B/A=0.338[0.338..0.339] word=FASTER', U256 = 'B:0.0000,A:0.0000 win=262144 reps=2 branches=2098642';
const V_PASS = 'VERDICT PASS', V_NC = 'VERDICT NO VERDICT (gated lane not clean)', V_FIND = 'VERDICT FINDING';
// [id, mutation, want exit, VERDICT prefix, named text the VERDICT line must carry (pinned from the live gate)]
const BROWS = [
    ['B1 gated uni:4096 aa median exactly 0.950', ['sub', U4096, 'aa=0.950[0.940..0.960] slow=5.821[5.815..5.823]'], 0, V_PASS,
        'gated=13/13 clean, every word as expected'],
    ['B2 gated uni:4096 aa median exactly 1.050', ['sub', U4096, 'aa=1.050[1.040..1.060] slow=5.821[5.815..5.823]'], 0, V_PASS,
        'gated=13/13 clean, every word as expected'],
    ['B3 gated fw:16 slow median exactly 1.250', ['sub', FW16, 'slow=1.250[1.200..1.300]'], 2, V_NC,
        'not-clean=[fw:16 slow 1.250[1.200..1.300] not med > 1.25 and q1 > 1.10] gated-clean=12/13'],
    ['B4 gated fw:16 slow q1 exactly 1.100', ['sub', FW16, 'slow=3.023[1.100..3.026]'], 2, V_NC,
        'not-clean=[fw:16 slow 3.023[1.100..3.026] not med > 1.25 and q1 > 1.10] gated-clean=12/13'],
    ['B5 gated uni:256 bop B exactly 1/64', ['sub', U256, 'B:0.015625,A:0.0000 win=262144 reps=2 branches=2098642'], 2, V_NC,
        'not-clean=[uni:256 bop SLOW:0.0000,AA:0.0000,B:0.015625,A:0.0000 not A, B, AA, SLOW each < 1/64] gated-clean=12/13'],
    ['B6 gated ro:16 B/A median exactly 1.050, WITHIN', ['sub', RO16, 'B/A=1.050[1.040..1.060] word=WITHIN'], 3, V_FIND,
        'wrong-gated=[ro:16 WITHIN 1.050[1.040..1.060] expected FASTER] gated-clean=13/13'],
    ['B7 gated ro:16 B/A q1 exactly 1.000, WITHIN', ['sub', RO16, 'B/A=1.100[1.000..1.200] word=WITHIN'], 3, V_FIND,
        'wrong-gated=[ro:16 WITHIN 1.100[1.000..1.200] expected FASTER] gated-clean=13/13'],
    ['B8 gated ro:16 B/A median exactly 0.950, WITHIN', ['sub', RO16, 'B/A=0.950[0.940..0.960] word=WITHIN'], 3, V_FIND,
        'wrong-gated=[ro:16 WITHIN 0.950[0.940..0.960] expected FASTER] gated-clean=13/13'],
    ['B9 gated ro:16 B/A q3 exactly 1.000, WITHIN', ['sub', RO16, 'B/A=0.900[0.800..1.000] word=WITHIN'], 3, V_FIND,
        'wrong-gated=[ro:16 WITHIN 0.900[0.800..1.000] expected FASTER] gated-clean=13/13'],
    ['B10 gated uni:4096 aa q1 literal Infinity', ['sub', U4096, 'aa=1.001[Infinity..1.003] slow=5.821[5.815..5.823]'], 2, V_NC,
        'not-clean=[uni:4096 aa 1.001[NaN..1.003] not finite] gated-clean=12/13'],
];
const rowOf = (key) => {
    const r = BROWS.find((b) => b[0].split(' ')[0] === key);
    if (r === undefined) throw new Error('no B-row ' + key);
    return r;
};

// ---------------------------------------------------------------- (c) flips: one exact replacement each
// [name, from (must occur exactly once in ab-gate.mjs), to, [[target B-row, mutant exit, mutant named text]]]
const FLIPS = [
    ['wordMedHi', "if (s.med > AA_HI && s.q1 > 1) return 'SLOWER';", "if (s.med >= AA_HI && s.q1 > 1) return 'SLOWER';",
        [['B6', 2, 'not-clean=[ro:16 printed word=WITHIN but B/A 1.050[1.040..1.060] reads SLOWER]']]],
    ['wordQ1', "if (s.med > AA_HI && s.q1 > 1) return 'SLOWER';", "if (s.med > AA_HI && s.q1 >= 1) return 'SLOWER';",
        [['B7', 2, 'not-clean=[ro:16 printed word=WITHIN but B/A 1.100[1.000..1.200] reads SLOWER]']]],
    ['wordMedLo', "if (s.med < AA_LO && s.q3 < 1) return 'FASTER';", "if (s.med <= AA_LO && s.q3 < 1) return 'FASTER';",
        [['B8', 2, 'not-clean=[ro:16 printed word=WITHIN but B/A 0.950[0.940..0.960] reads FASTER]']]],
    ['wordQ3', "if (s.med < AA_LO && s.q3 < 1) return 'FASTER';", "if (s.med < AA_LO && s.q3 <= 1) return 'FASTER';",
        [['B9', 2, 'not-clean=[ro:16 printed word=WITHIN but B/A 0.900[0.800..1.000] reads FASTER]']]],
    ['aaBand', 'const aaOk = (s) => s.med >= AA_LO && s.med <= AA_HI;', 'const aaOk = (s) => s.med > AA_LO && s.med < AA_HI;',
        [['B1', 2, 'not-clean=[uni:4096 aa 0.950[0.940..0.960] not in [0.95, 1.05]]'],
            ['B2', 2, 'not-clean=[uni:4096 aa 1.050[1.040..1.060] not in [0.95, 1.05]]']]],
    ['slowMed', 'const slowOk = (s) => s.med > 1.25 && s.q1 > 1.10;', 'const slowOk = (s) => s.med >= 1.25 && s.q1 > 1.10;',
        [['B3', 0, 'VERDICT PASS gated=13/13 clean, every word as expected']]],
    ['slowQ1', 'const slowOk = (s) => s.med > 1.25 && s.q1 > 1.10;', 'const slowOk = (s) => s.med > 1.25 && s.q1 >= 1.10;',
        [['B4', 0, 'VERDICT PASS gated=13/13 clean, every word as expected']]],
    ['bopMax', '!(v < ALLOC_MAX)) bopOk = false;', '!(v <= ALLOC_MAX)) bopOk = false;',
        [['B5', 0, 'VERDICT PASS gated=13/13 clean, every word as expected']]],
    // every bop cell of the fixture is 0.0000 (the 0 floor itself); B1 is a clean PASS row, so the flip reads exit 2 there
    ['bopZero', 'else if (!(v >= 0)) neg.push(b);', 'else if (!(v > 0)) neg.push(b);',
        [['B1', 2, 'not-clean=[uni:256 bop SLOW:0.0000,AA:0.0000,B:0.0000,A:0.0000 negative (want >= 0)']]],
    ['numInf', 'const NUM_RE = /^-?\\d+(\\.\\d+)?$/;', 'const NUM_RE = /^-?(\\d+(\\.\\d+)?|Infinity)$/;',
        [['B10', 2, 'not-clean=[uni:4096 aa 1.001[Infinity..1.003] not finite] gated-clean=12/13']]],
];

// ---------------------------------------------------------------- helpers
function rowText(key) {
    const [id, m] = rowOf(key);
    const text = T.applyMut(T.FIXTURES.ubuntu.text, m);
    assert.ok(!T.MUT_ERR.test(text), id + ': mutation does not apply exactly once: ' + text.slice(0, 200));
    return text;
}
function runGate(gatePath, input) {
    const r = spawnSync(process.execPath, [gatePath, '--verdict-file', '-'], { input, encoding: 'utf8', maxBuffer: 1 << 24, timeout: 60000 });
    const ls = (r.stdout || '').split('\n');
    return { code: r.status, v: ls.filter((l) => l.startsWith('VERDICT ')), r: ls.filter((l) => l.startsWith('REPORTED ')), stderr: r.stderr || '' };
}
const liveCache = new Map();
function live(key) {
    if (!liveCache.has(key)) liveCache.set(key, runGate(GATE, rowText(key)));
    return liveCache.get(key);
}
function needTables() {
    assert.equal(sliceErr, null, 'slicing ab-gate.mjs failed: ' + (sliceErr && sliceErr.message));
    assert.equal(sha(T.FIXTURES.ubuntu.buf), T.FIXTURES.ubuntu.sha, 'ubuntu fixture sha256 differs (see the pin test)');
}

// ---------------------------------------------------------------- (a) pins
test('(a) ab-gate.mjs sha256 pin, unique slice anchors, fixture shas', () => {
    assert.equal(gateSha, GATE_PIN, 'ab-gate.mjs changed -> AB-G3a (ROADMAP) no longer holds; re-derive these rows');
    assert.equal(sliceErr, null, 'slicing ab-gate.mjs failed: ' + (sliceErr && sliceErr.message));
    assert.deepEqual(Object.keys(T.FIXTURES), ['ubuntu', 'macos']);
    assert.equal(T.FIXTURE_CASES.length, 45, 'FIXTURE_CASES is F1-F45');
    assert.equal(typeof T.applyMut, 'function');
    assert.ok(T.MUT_ERR instanceof RegExp);
    for (const k of Object.keys(T.FIXTURES)) {
        assert.equal(sha(T.FIXTURES[k].buf), T.FIXTURES[k].sha, 'fixture ' + k + ' sha256 differs from FIXTURES.' + k + '.sha');
    }
    for (const [name, from] of FLIPS) assert.equal(count(src, from), 1, 'flip ' + name + ': from text must occur exactly once in ab-gate.mjs');
});

// ---------------------------------------------------------------- (b) boundary rows through the live gate
for (const [id, , want, prefix, named] of BROWS) {
    const key = id.split(' ')[0];
    test('(b) ' + id + ' -> exit ' + want, () => {
        needTables();
        const o = live(key);
        assert.equal(o.code, want, id + ': exit ' + o.code + ' (want ' + want + ')\n' + o.stderr.slice(0, 400));
        assert.equal(o.v.length, 1, id + ': ' + o.v.length + ' VERDICT lines (want 1)');
        assert.equal(o.r.length, 1, id + ': ' + o.r.length + ' REPORTED lines (want 1)');
        assert.ok(o.v[0].startsWith(prefix + ' '), id + ': VERDICT prefix ' + JSON.stringify(o.v[0].slice(0, 60)) + ' (want ' + prefix + ')');
        assert.ok(o.v[0].includes(named), id + ': VERDICT line does not name ' + JSON.stringify(named) + ': ' + o.v[0]);
    });
}

// ---------------------------------------------------------------- (c) A/A control: the unmutated copy from tmp
test('(c) A/A control: unmutated copy run from a tmp dir reads the live exit + VERDICT + REPORTED on B1-B10', () => {
    needTables();
    const d = join(tmpDir(), 'aa');
    mkdirSync(d);
    const p = join(d, 'ab-gate.mjs');
    writeFileSync(p, src);
    assert.equal(sha(readFileSync(p)), GATE_PIN, 'A/A copy is not byte-identical to ab-gate.mjs');
    for (const [id] of BROWS) {
        const key = id.split(' ')[0];
        const a = live(key), c = runGate(p, rowText(key));
        assert.equal(c.code, a.code, id + ': A/A exit ' + c.code + ' vs live ' + a.code);
        assert.deepEqual(c.v, a.v, id + ': A/A VERDICT differs');
        assert.deepEqual(c.r, a.r, id + ': A/A REPORTED differs');
    }
});

// ---------------------------------------------------------------- (c) must-fail comparator mutants
for (const [name, from, to, targets] of FLIPS) {
    test('(c) flip ' + name + ' must read differently on ' + targets.map((t) => t[0]).join(','), () => {
        needTables();
        const n = count(src, from);
        assert.equal(n, 1, 'flip ' + name + ': from text occurs ' + n + ' times (want 1): ' + from);
        const mutSrc = src.replace(from, () => to);
        assert.notEqual(mutSrc, src, 'flip ' + name + ': replacement changed nothing');
        const d = join(tmpDir(), name);
        mkdirSync(d);
        const p = join(d, 'ab-gate.mjs');
        writeFileSync(p, mutSrc);
        for (const [key, wantExit, named] of targets) {
            const a = live(key), m = runGate(p, rowText(key));
            assert.equal(m.v.length, 1, name + ' on ' + key + ': ' + m.v.length + ' VERDICT lines (want 1)\n' + m.stderr.slice(0, 400));
            assert.ok(m.code !== a.code || m.v[0] !== a.v[0], name + ' on ' + key + ': mutant reads the live verdict (no teeth): ' + m.v[0]);
            assert.equal(m.code, wantExit, name + ' on ' + key + ': mutant exit ' + m.code + ' (want ' + wantExit + ')');
            assert.ok(m.v[0].includes(named), name + ' on ' + key + ': mutant VERDICT does not name ' + JSON.stringify(named) + ': ' + m.v[0]);
        }
    });
}
