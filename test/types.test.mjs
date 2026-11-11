// test/types.test.mjs -- assertion 10 + 13 (SPEC-p1 U7 T3; rulings P1-R2, P1-R5, P1-R13).
// A consumer project per scenario in a mkdtemp dir under os.tmpdir() (prefix lite-bisect-types-):
//   <tmp>/node_modules/@zakkster/lite-bisect/{Bisect.js, Bisect.d.ts, package.json}  (M6: only these 3)
//   <tmp>/consumer.ts                (test/types/consumer.ts)
//   <tmp>/package.json               {"type": "module"}: the consumer's own project file, so node16 /
//                                    nodenext read consumer.ts as ESM (without it: TS1479, a CJS consumer)
//   <tmp>/tsconfig.<mode>.json       strict, noEmit, lib es2020, skipLibCheck false, one per mode
// and tsc 7.0.2 (exact pin, P1-R5) spawned -p, bounded: the native exe named by typescript/lib/getExePath.js.
// Modes: node16, nodenext, bundler (P1-R13: 7.0.2 removed node10, TS5108). A missing typescript is a FAIL.
// Rows: 3 / 3 modes exit 0, 0 diagnostics, 0 TS2578. Controls (LEDGER law 9, B5 / B6), through the SAME
// stage / tsconfig / spawn / parse code as the real rows:
//   (a) Bisect.d.ts left out of the copy -> non-zero 3 / 3 with TS7016 (no declaration file);
//   (b) the first `// @ts-expect-error` directive line of consumer.ts removed -> non-zero 3 / 3 with exactly one
//       diagnostic, TS2345 (a wrong array type), and no other code.
// Every temp dir is removed in finally (assertion 13); a forced-throw row proves the finally path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// typescript 7 bin/tsc is only a launcher (execve, else execFileSync of a native binary): a SIGKILL on the launcher
// could orphan the native child, so the gate spawns the native exe that typescript/lib/getExePath.js names.
const GET_EXE = join(ROOT, 'node_modules', 'typescript', 'lib', 'getExePath.js');
let TSC = null;
let TSC_ERR = '';
try { TSC = (await import(pathToFileURL(GET_EXE).href)).default(); } catch (e) { TSC_ERR = String((e && e.message) || e); }
const CONSUMER = join(ROOT, 'test', 'types', 'consumer.ts');
const PREFIX = 'lite-bisect-types-';
const SPAWN_MS = 180000;   // load ~18 on the shared host: generous, still bounded
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const PINNED = PKG.devDependencies && PKG.devDependencies.typescript;

const MODES = [
    { name: 'node16', module: 'node16', moduleResolution: 'node16' },
    { name: 'nodenext', module: 'nodenext', moduleResolution: 'nodenext' },
    { name: 'bundler', module: 'esnext', moduleResolution: 'bundler' },
];

function withTypesDir(fn) {
    const dir = mkdtempSync(join(tmpdir(), PREFIX));
    try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

function tsconfig(mode) {
    return JSON.stringify({
        compilerOptions: {
            strict: true, noEmit: true, lib: ['es2020'], skipLibCheck: false,
            module: mode.module, moduleResolution: mode.moduleResolution,
        },
        files: ['consumer.ts'],
    }, null, 2) + '\n';
}

function stage(dir, { dropDts, consumerText }) {
    const pkgDir = join(dir, 'node_modules', '@zakkster', 'lite-bisect');
    mkdirSync(pkgDir, { recursive: true });
    for (const f of ['Bisect.js', 'Bisect.d.ts', 'package.json']) {
        if (dropDts && f === 'Bisect.d.ts') continue;
        copyFileSync(join(ROOT, f), join(pkgDir, f));
    }
    writeFileSync(join(dir, 'consumer.ts'), consumerText);
    writeFileSync(join(dir, 'package.json'), '{ "name": "lite-bisect-types-consumer", "private": true, "type": "module" }\n');
    for (const m of MODES) writeFileSync(join(dir, 'tsconfig.' + m.name + '.json'), tsconfig(m));
}

function spawnTsc(args, cwd) {
    assert.ok(TSC !== null && existsSync(TSC), 'typescript missing: ' + (TSC || GET_EXE) + ' ' + TSC_ERR +
        ' (npm install; a missing tsc is a FAIL, never a skip)');
    const r = spawnSync(TSC, args, { cwd, encoding: 'utf8', timeout: SPAWN_MS, killSignal: 'SIGKILL' });
    assert.equal(r.error, undefined, 'tsc spawn error: ' + r.error);
    assert.equal(r.signal, null, 'tsc killed by ' + r.signal + ' (bound ' + SPAWN_MS + ' ms)');
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// Every "error TSnnnn" in the output, with or without a file(line,col) prefix.
function parseDiagnostics(out) {
    const codes = [];
    for (const line of out.split('\n')) {
        const m = /(?:^|\s|:\s)error (TS\d+):/.exec(line);
        if (m) codes.push(m[1]);
    }
    return codes;
}

// The one verdict path: stage a scenario, run tsc in every mode, parse.
function runScenario({ dropDts = false, consumerText = readFileSync(CONSUMER, 'utf8') } = {}) {
    return withTypesDir((dir) => {
        stage(dir, { dropDts, consumerText });
        return MODES.map((m) => {
            const r = spawnTsc(['-p', join(dir, 'tsconfig.' + m.name + '.json'), '--pretty', 'false'], dir);
            return { mode: m.name, status: r.status, out: r.out, codes: parseDiagnostics(r.out) };
        });
    });
}

function stripFirstExpectError(text) {
    const lines = text.split('\n');
    // a directive line (`// @ts-expect-error ...`), never a comment that merely mentions it
    const i = lines.findIndex((l) => /^\s*\/\/ @ts-expect-error\b/.test(l));
    assert.ok(i >= 0, 'control (b) NOT-APPLIED: no @ts-expect-error directive in consumer.ts');
    lines.splice(i, 1);
    return lines.join('\n');
}

test('tsc --version is the exact pin (P1-R5)', (t) => {
    assert.match(String(PINNED), /^\d+\.\d+\.\d+$/, 'devDependencies.typescript must be an exact version, got ' + PINNED);
    const r = spawnTsc(['--version'], ROOT);
    assert.equal(r.status, 0, r.out);
    t.diagnostic('tsc --version: ' + r.out.trim());
    console.log('# tsc --version: ' + r.out.trim());
    assert.equal(r.out.trim(), 'Version ' + PINNED);
});

test('consumer.ts calls every export of Bisect.js', async () => {
    const mod = await import(new URL('../Bisect.js', import.meta.url).href);
    const text = readFileSync(CONSUMER, 'utf8');
    const missing = Object.keys(mod).filter((k) => !new RegExp('(^|[^A-Za-z0-9_$])' + k + '\\(').test(text));
    assert.deepEqual(missing, []);
});

test('tsc: node16 / nodenext / bundler exit 0, 0 diagnostics, 0 TS2578 (3 / 3)', () => {
    const rows = runScenario();
    assert.equal(rows.length, 3);
    for (const r of rows) {
        assert.equal(r.status, 0, r.mode + ': exit ' + r.status + '\n' + r.out);
        assert.deepEqual(r.codes, [], r.mode + ': diagnostics\n' + r.out);
        assert.ok(!r.out.includes('TS2578'), r.mode + ': TS2578');
        assert.ok(!/error/i.test(r.out), r.mode + ': unparsed error text\n' + r.out);
    }
});

test('tsc control (a): Bisect.d.ts left out of the copy fails 3 / 3 with TS7016', () => {
    const rows = runScenario({ dropDts: true });
    assert.equal(rows.length, 3);
    for (const r of rows) {
        assert.notEqual(r.status, 0, r.mode + ': control (a) passed\n' + r.out);
        assert.ok(r.codes.includes('TS7016'), r.mode + ': no TS7016\n' + r.out);
    }
});

test('tsc control (b): the first @ts-expect-error stripped fails 3 / 3 with TS2345 alone', () => {
    const rows = runScenario({ consumerText: stripFirstExpectError(readFileSync(CONSUMER, 'utf8')) });
    assert.equal(rows.length, 3);
    for (const r of rows) {
        assert.notEqual(r.status, 0, r.mode + ': control (b) passed\n' + r.out);
        assert.deepEqual(r.codes, ['TS2345'], r.mode + ': codes ' + r.codes.join(',') + '\n' + r.out);
    }
});

test('cleanup: a throw inside the staged dir still removes it (finally path)', () => {
    let seen = null;
    assert.throws(() => withTypesDir((dir) => {
        seen = dir;
        stage(dir, { dropDts: false, consumerText: readFileSync(CONSUMER, 'utf8') });
        assert.ok(existsSync(join(dir, 'consumer.ts')));
        throw new Error('forced failure inside the try');
    }), /forced failure inside the try/);
    assert.ok(seen && seen.includes(PREFIX), 'no dir was made');
    assert.equal(existsSync(seen), false, 'temp dir left behind: ' + seen);
});
