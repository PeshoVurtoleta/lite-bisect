// test/lu.test.mjs -- the LiteUtils resolver (test/gates/lu.mjs) judged on planted temp roots (GATES unit TASK 2).
// Rulings: GU-R1 (the devDependency floor is ^1.1.0) and GU-R2 (a set, non-empty LITE_UTILS_DIR is the ONLY
// source read; an invalid env dir is NO VERDICT, never a fall-through to the installed package).
// Every row is judged TWICE through the one decision: luVerdict(resolveTools({ root, env })) in-process AND the CLI
// child `node test/gates/lu.mjs --root <tmp>` with the row's env (NV: exit 2 + stdout 'NO VERDICT: ...'; ok: exit 0).
// The EXPECTED column (ok / NV, the source, the reason fragment, the tool paths) is typed here from the GATES brief,
// never computed from lu.mjs (LEDGER law 9). Each row varies ONE conjunct from a valid plant.
// Needs no network and no LiteUtils checkout: every plant lives under mkdtemp(os.tmpdir()) and is removed after.
// The env-dir plants need `git` on PATH (a commit is part of a valid LITE_UTILS_DIR: provenance, SPEC-p1 R7).

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTools, runBounded, PKG_ROOT, luVerdict, luVersionOk, LU_FLOOR } from './gates/lu.mjs';

const LU_CLI = fileURLToPath(new URL('./gates/lu.mjs', import.meta.url));
const TMP = mkdtempSync(join(tmpdir(), 'lite-bisect-lu-'));
after(() => rmSync(TMP, { recursive: true, force: true }));

const BOTH = ['alloc-per-op.mjs', 'bytecode-budget.sh'];
const SH_ONLY_100 = ['bytecode-budget.sh', 'allocation-diff.sh', 'deopt-diff.sh', 'ic-diff.sh', 'inlining-budget-diff.sh'];
const BIN_100 = {   // the real 1.0.0 shape: .sh tools only, no alloc-per-op
    'allocation-diff': 'allocation-diff.sh', 'bytecode-budget': 'bytecode-budget.sh', 'deopt-diff': 'deopt-diff.sh',
    'ic-diff': 'ic-diff.sh', 'inlining-budget-diff': 'inlining-budget-diff.sh',
};
const BIN_110 = { ...BIN_100, 'alloc-per-op': 'alloc-per-op.mjs' };
const pj = (version, extra = {}) => ({ name: '@zakkster/lite-utils', version, ...extra });

let seq = 0;
function plant(dir, { pkg, files }) {
    mkdirSync(dir, { recursive: true });
    if (pkg !== null) writeFileSync(join(dir, 'package.json'), typeof pkg === 'string' ? pkg : JSON.stringify(pkg));
    for (const f of files) {
        mkdirSync(dirname(join(dir, f)), { recursive: true });
        writeFileSync(join(dir, f), '#!/bin/sh\n# planted ' + f + '\n');
    }
}
function gitCommit(dir) {
    const G = ['-C', dir, '-c', 'user.name=lu-test', '-c', 'user.email=lu-test@example.invalid',
        '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null'];
    for (const a of [['init', '-q'], ['add', '-A'], ['commit', '-q', '-m', 'plant']]) {
        const r = runBounded('git', [...G, ...a], { timeoutMs: 20000 });
        if (r.status !== 0) throw new Error('plant: git ' + a[0] + ' failed: ' + r.stderr);
    }
}
const installedDir = (root) => join(root, 'node_modules', '@zakkster', 'lite-utils');
const VALID_INSTALLED = { pkg: pj('1.1.0', { bin: BIN_110 }), files: [...SH_ONLY_100, 'alloc-per-op.mjs'] };
const VALID_ENV = { pkg: pj('1.1.0'), files: BOTH, git: true };

// Row columns: installed (plant | null); envDir (plant | null; planted at <root>/lu-checkout); env (the
// LITE_UTILS_DIR value: undefined = unset, '' = empty, 'DIR' = the planted env dir (absolute), 'REL' = 'lu-checkout'
// (relative: resolved against --root, never the cwd), 'NOTDIR' = <root>/no-such-dir); expect 'ok' | 'NV';
// ok rows: source (typed; for env rows the typed prefix + suffix) and tools (typed paths relative to the source dir);
// NV rows: why (a typed fragment of the reason).
const ROWS = [
    // ---- ok -----------------------------------------------------------------------------------------
    { id: 'ok installed 1.1.0 via bin', expect: 'ok', env: undefined, envDir: null,
        installed: { pkg: pj('1.1.0', { bin: { 'alloc-per-op': 'bin/apo.mjs', 'bytecode-budget': 'bin/bb.sh' } }), files: ['bin/apo.mjs', 'bin/bb.sh'] },
        source: 'installed @zakkster/lite-utils@1.1.0', tools: { 'alloc-per-op.mjs': 'bin/apo.mjs', 'bytecode-budget.sh': 'bin/bb.sh' } },
    { id: 'ok installed 1.1.0 no bin (root files)', expect: 'ok', env: undefined, envDir: null,
        installed: { pkg: pj('1.1.0'), files: BOTH },
        source: 'installed @zakkster/lite-utils@1.1.0', tools: { 'alloc-per-op.mjs': 'alloc-per-op.mjs', 'bytecode-budget.sh': 'bytecode-budget.sh' } },
    { id: 'ok installed 1.1.0 bin keyed by file name', expect: 'ok', env: undefined, envDir: null,
        installed: { pkg: pj('1.1.0', { bin: { 'alloc-per-op.mjs': 'x/apo.mjs', 'bytecode-budget.sh': 'x/bb.sh' } }), files: ['x/apo.mjs', 'x/bb.sh'] },
        source: 'installed @zakkster/lite-utils@1.1.0', tools: { 'alloc-per-op.mjs': 'x/apo.mjs', 'bytecode-budget.sh': 'x/bb.sh' } },
    { id: 'ok installed 1.1.0 bin is a string (root files)', expect: 'ok', env: undefined, envDir: null,
        installed: { pkg: pj('1.1.0', { bin: 'cli.mjs' }), files: BOTH },
        source: 'installed @zakkster/lite-utils@1.1.0', tools: { 'alloc-per-op.mjs': 'alloc-per-op.mjs', 'bytecode-budget.sh': 'bytecode-budget.sh' } },
    { id: 'ok installed real 1.1.0 shape (bin, 6 tools)', expect: 'ok', env: '', envDir: null, installed: VALID_INSTALLED,
        source: 'installed @zakkster/lite-utils@1.1.0', tools: { 'alloc-per-op.mjs': 'alloc-per-op.mjs', 'bytecode-budget.sh': 'bytecode-budget.sh' } },
    { id: 'ok installed 1.2.3', expect: 'ok', env: undefined, envDir: null, installed: { pkg: pj('1.2.3'), files: BOTH },
        source: 'installed @zakkster/lite-utils@1.2.3', tools: { 'alloc-per-op.mjs': 'alloc-per-op.mjs', 'bytecode-budget.sh': 'bytecode-budget.sh' } },
    { id: 'ok installed 1.10.0 (numeric, not string compare)', expect: 'ok', env: undefined, envDir: null, installed: { pkg: pj('1.10.0'), files: BOTH },
        source: 'installed @zakkster/lite-utils@1.10.0', tools: { 'alloc-per-op.mjs': 'alloc-per-op.mjs', 'bytecode-budget.sh': 'bytecode-budget.sh' } },
    { id: 'ok env dir valid WHILE a valid installed package is present (GU-R2)', expect: 'ok', env: 'DIR', envDir: VALID_ENV, installed: VALID_INSTALLED,
        source: ['LITE_UTILS_DIR=', ' (@zakkster/lite-utils@1.1.0)'], tools: { 'alloc-per-op.mjs': 'alloc-per-op.mjs', 'bytecode-budget.sh': 'bytecode-budget.sh' } },
    { id: 'ok env dir relative to --root (not the cwd)', expect: 'ok', env: 'REL', envDir: VALID_ENV, installed: null,
        source: ['LITE_UTILS_DIR=lu-checkout', ' (@zakkster/lite-utils@1.1.0)'], tools: { 'alloc-per-op.mjs': 'alloc-per-op.mjs', 'bytecode-budget.sh': 'bytecode-budget.sh' } },
    // ---- NV: nothing to read ------------------------------------------------------------------------
    { id: 'NV nothing installed + env unset', expect: 'NV', env: undefined, envDir: null, installed: null, why: 'no LiteUtils: @zakkster/lite-utils is not installed' },
    { id: 'NV nothing installed + env empty', expect: 'NV', env: '', envDir: null, installed: null, why: 'no LiteUtils: @zakkster/lite-utils is not installed' },
    // ---- NV: installed version (one conjunct each; tools present unless the row says otherwise) -------
    { id: 'NV installed 1.0.0 real shape (.sh tools only)', expect: 'NV', env: undefined, envDir: null,
        installed: { pkg: pj('1.0.0', { bin: BIN_100 }), files: SH_ONLY_100 }, why: 'version "1.0.0" is not inside ^1.1.0' },
    { id: 'NV installed 1.0.0 WITH both tools (version alone)', expect: 'NV', env: undefined, envDir: null,
        installed: { pkg: pj('1.0.0', { bin: BIN_110 }), files: [...SH_ONLY_100, 'alloc-per-op.mjs'] }, why: 'version "1.0.0" is not inside ^1.1.0' },
    { id: 'NV installed 1.0.9', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj('1.0.9'), files: BOTH }, why: 'version "1.0.9" is not inside ^1.1.0' },
    { id: 'NV installed 0.9.9', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj('0.9.9'), files: BOTH }, why: 'version "0.9.9" is not inside ^1.1.0' },
    { id: 'NV installed 2.0.0', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj('2.0.0'), files: BOTH }, why: 'version "2.0.0" is not inside ^1.1.0' },
    { id: 'NV installed 1.1.0-beta.1', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj('1.1.0-beta.1'), files: BOTH }, why: 'version "1.1.0-beta.1" is not inside ^1.1.0' },
    { id: 'NV installed 1.1.0+b', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj('1.1.0+b'), files: BOTH }, why: 'version "1.1.0+b" is not inside ^1.1.0' },
    { id: 'NV installed " 1.1.0"', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj(' 1.1.0'), files: BOTH }, why: 'version " 1.1.0" is not inside ^1.1.0' },
    { id: 'NV installed "1.1"', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj('1.1'), files: BOTH }, why: 'version "1.1" is not inside ^1.1.0' },
    { id: 'NV installed version 1.1 (a number)', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj(1.1), files: BOTH }, why: 'version 1.1 is not inside ^1.1.0' },
    { id: 'NV installed version missing', expect: 'NV', env: undefined, envDir: null, installed: { pkg: { name: '@zakkster/lite-utils' }, files: BOTH }, why: 'version undefined is not inside ^1.1.0' },
    { id: 'NV installed unreadable package.json', expect: 'NV', env: undefined, envDir: null, installed: { pkg: '{"version": "1.1.0",', files: BOTH }, why: 'has an unreadable package.json' },
    { id: 'NV installed package.json is JSON null', expect: 'NV', env: undefined, envDir: null, installed: { pkg: 'null', files: BOTH }, why: 'package.json is not a JSON object' },
    { id: 'NV installed package.json is an array', expect: 'NV', env: undefined, envDir: null, installed: { pkg: '["1.1.0"]', files: BOTH }, why: 'package.json is not a JSON object' },
    // ---- NV: installed tools ---------------------------------------------------------------------------
    { id: 'NV installed 1.1.0 missing alloc-per-op.mjs', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj('1.1.0'), files: ['bytecode-budget.sh'] }, why: 'has no alloc-per-op.mjs' },
    { id: 'NV installed 1.1.0 missing bytecode-budget.sh', expect: 'NV', env: undefined, envDir: null, installed: { pkg: pj('1.1.0'), files: ['alloc-per-op.mjs'] }, why: 'has no bytecode-budget.sh' },
    { id: 'NV installed bin -> missing file (root file present: no fall-back)', expect: 'NV', env: undefined, envDir: null,
        installed: { pkg: pj('1.1.0', { bin: { 'alloc-per-op': 'bin/gone.mjs' } }), files: BOTH }, why: 'has no alloc-per-op.mjs' },
    // ---- NV: env dir (each WITH a valid installed package present: no fall-through, GU-R2) ------------
    { id: 'NV env dir not a directory (installed valid)', expect: 'NV', env: 'NOTDIR', envDir: null, installed: VALID_INSTALLED, why: 'LITE_UTILS_DIR is not a directory' },
    { id: 'NV env dir 1.0.0 (installed valid)', expect: 'NV', env: 'DIR', envDir: { pkg: pj('1.0.0'), files: BOTH, git: true }, installed: VALID_INSTALLED,
        why: 'LITE_UTILS_DIR version "1.0.0" is not inside ^1.1.0' },
    { id: 'NV env dir 1.1.0-beta.1 (installed valid)', expect: 'NV', env: 'DIR', envDir: { pkg: pj('1.1.0-beta.1'), files: BOTH, git: true }, installed: VALID_INSTALLED,
        why: 'LITE_UTILS_DIR version "1.1.0-beta.1" is not inside ^1.1.0' },
    { id: 'NV env dir missing a tool (installed valid)', expect: 'NV', env: 'DIR', envDir: { pkg: pj('1.1.0'), files: ['alloc-per-op.mjs'], git: true }, installed: VALID_INSTALLED,
        why: 'LITE_UTILS_DIR has no bytecode-budget.sh' },
    { id: 'NV env dir with no package.json (installed valid)', expect: 'NV', env: 'DIR', envDir: { pkg: null, files: BOTH, git: true }, installed: VALID_INSTALLED,
        why: 'LITE_UTILS_DIR has no package.json' },
    { id: 'NV env dir unreadable package.json (installed valid)', expect: 'NV', env: 'DIR', envDir: { pkg: '{', files: BOTH, git: true }, installed: VALID_INSTALLED,
        why: 'LITE_UTILS_DIR has an unreadable package.json' },
    { id: 'NV env dir not a git repo (installed valid)', expect: 'NV', env: 'DIR', envDir: { pkg: pj('1.1.0'), files: BOTH, git: false }, installed: VALID_INSTALLED,
        why: 'cannot read the LiteUtils git commit' },
];

function baseEnv() {
    const e = { ...process.env };
    delete e.LITE_UTILS_DIR;
    return e;
}

for (const row of ROWS) {
    test('resolver row: ' + row.id, () => {
        const root = join(TMP, 'r' + (seq++));
        mkdirSync(root, { recursive: true });
        if (row.installed !== null) plant(installedDir(root), row.installed);
        const envDir = join(root, 'lu-checkout');
        if (row.envDir !== null) {
            plant(envDir, row.envDir);
            if (row.envDir.git) gitCommit(envDir);
        }
        const env = baseEnv();
        if (row.env === '') env.LITE_UTILS_DIR = '';
        else if (row.env === 'DIR') env.LITE_UTILS_DIR = envDir;
        else if (row.env === 'REL') env.LITE_UTILS_DIR = 'lu-checkout';
        else if (row.env === 'NOTDIR') env.LITE_UTILS_DIR = join(root, 'no-such-dir');
        else assert.equal(row.env, undefined, 'table: unknown env column');

        const r = resolveTools({ root, env });
        const nv = luVerdict(r);
        const c = runBounded(process.execPath, [LU_CLI, '--root', root], { timeoutMs: 60000, env, cwd: PKG_ROOT });
        assert.equal(c.timedOut, false, 'CLI timed out');

        if (row.expect === 'ok') {
            assert.equal(nv, null, 'in-process: ' + nv);
            assert.equal(c.status, 0, 'CLI exit ' + c.status + ': ' + c.stdout + c.stderr);
            const srcDir = row.env === 'DIR' || row.env === 'REL' ? envDir : installedDir(root);
            if (typeof row.source === 'string') assert.equal(r.source, row.source);
            else {
                assert.ok(r.source.startsWith(row.source[0]), 'source ' + r.source);
                assert.ok(r.source.endsWith(row.source[1]), 'source ' + r.source);
            }
            for (const t of BOTH) assert.equal(r.tools[t], join(srcDir, row.tools[t]), t);
            for (const t of BOTH) assert.ok(r.tools[t].startsWith(srcDir + sep), t + ' not under ' + srcDir);
            assert.ok(c.stdout.startsWith('# LiteUtils ' + r.source + ' | dir '), 'CLI stdout: ' + c.stdout);
        } else {
            assert.equal(row.expect, 'NV', 'table: unknown expect column');
            assert.equal(typeof nv, 'string', 'in-process read ok: ' + (r.ok ? r.source : ''));
            assert.ok(nv.startsWith('NO VERDICT: '), nv);
            assert.ok(nv.includes(row.why), 'reason "' + nv + '" lacks "' + row.why + '"');
            assert.equal(c.status, 2, 'CLI exit ' + c.status + ': ' + c.stdout + c.stderr);
            assert.ok(c.stdout.startsWith('NO VERDICT:'), 'CLI stdout: ' + c.stdout);
            assert.equal(c.stdout, nv + '\n', 'CLI and in-process verdicts differ');
        }
    });
}

// ---- pure luVersionOk (same strings as the rows, plus the edges) ------------------------------------------
const VERSIONS = [
    ['1.1.0', true], ['1.1.1', true], ['1.2.3', true], ['1.10.0', true], ['1.99.99', true],
    ['1.0.0', false], ['1.0.9', false], ['1.0.99', false], ['0.9.9', false], ['2.0.0', false], ['10.1.0', false],
    ['1.1.0-beta.1', false], ['1.1.0+b', false], [' 1.1.0', false], ['1.1.0 ', false], ['1.1.0\n', false],
    ['1.1', false], ['1', false], ['', false], ['v1.1.0', false], ['1.1.0.0', false], ['1.x.0', false],
    ['1.1.', false], ['1-1-0', false], ['1.01.0', true],
    [1.1, false], [110, false], [undefined, false], [null, false], [['1.1.0'], false], [{}, false],
];
test('luVersionOk table (typed, ^1.1.0)', () => {
    for (const [v, want] of VERSIONS) assert.equal(luVersionOk(v), want, JSON.stringify(v));
});

test('luVerdict: one decision (null only for ok === true)', () => {
    assert.equal(luVerdict({ ok: true, source: 's' }), null);
    assert.equal(luVerdict({ ok: false, reason: 'x y' }), 'NO VERDICT: x y');
    assert.equal(luVerdict({ ok: 'true', reason: 'r' }), 'NO VERDICT: r');
    assert.equal(luVerdict({ ok: 1, reason: 'r' }), 'NO VERDICT: r');
    assert.equal(luVerdict({}), 'NO VERDICT: no reason given');
    assert.equal(luVerdict(null), 'NO VERDICT: no reason given');
    assert.equal(luVerdict(undefined), 'NO VERDICT: no reason given');
});

test('CLI: an unknown argument is NO VERDICT (exit 2)', () => {
    const c = runBounded(process.execPath, [LU_CLI, '--bogus'], { timeoutMs: 60000, env: baseEnv(), cwd: PKG_ROOT });
    assert.equal(c.status, 2);
    assert.ok(c.stdout.startsWith('NO VERDICT: '), c.stdout);
    assert.ok(c.stdout.includes('--bogus'), c.stdout);
});

test('CLI: --root with no value is NO VERDICT (exit 2)', () => { const c = runBounded(process.execPath, [LU_CLI, '--root'], { timeoutMs: 60000, env: baseEnv(), cwd: PKG_ROOT }); assert.equal(c.status, 2); assert.ok(c.stdout.startsWith('NO VERDICT: '), c.stdout); });

test('package.json: devDependencies lite-utils is ^1.1.0 (GU-R1) and dependencies is {}', () => {
    const p = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'));
    assert.equal(LU_FLOOR, '1.1.0');
    assert.equal(p.devDependencies['@zakkster/lite-utils'], '^1.1.0');
    assert.equal(p.devDependencies['@zakkster/lite-utils'], '^' + LU_FLOOR);
    assert.deepEqual(p.dependencies, {});
});

test('LIVE: the real root resolves the installed package (LITE_UTILS_DIR removed)', () => {
    const r = resolveTools({ env: baseEnv() });
    assert.equal(luVerdict(r), null, String(r.reason));
    const P = 'installed @zakkster/lite-utils@';
    assert.ok(r.source.startsWith(P), r.source);
    assert.equal(luVersionOk(r.source.slice(P.length)), true, r.source);
});
