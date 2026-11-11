// test/gates/lu.mjs -- U6 (SPEC-p1 U6, P1-R1): find the LiteUtils tools and record their provenance.
// Imported by test/gates/alloc.test.mjs and test/gates/bytecode.test.mjs; also a CLI:
//   node test/gates/lu.mjs [--root DIR]   -> provenance lines, exit 0; else "NO VERDICT: ..." exit 2
// Resolution order (P1-R1): an installed @zakkster/lite-utils (its package.json `bin` entry, else the file
// at its root), else LITE_UTILS_DIR (absolute, or relative to the package root -- never to the cwd).
// Neither -> NO VERDICT. package.json lists no @zakkster/lite-utils until 1.0 is on npm (P1-R1).
// Provenance per run (SPEC-p1 RISK R7): LiteUtils git commit, a dirty flag per tool file
// (`git status --porcelain --ignored -- <tool>`: '' clean, else its status code, e.g. M, ?? or !!), sha256 of every
// tool file, node --version, load average. A LITE_UTILS_DIR whose commit cannot be read is NO VERDICT.
// Every spawn here and in the gates goes through runBounded(): a kill timer on each child (SIGTERM; the
// bash tool SIGKILLs its own probe on SIGTERM), never a kill of anything this process did not start.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { loadavg } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const TOOLS = ['alloc-per-op.mjs', 'bytecode-budget.sh'];
const LU_NAME = '@zakkster/lite-utils';

export function sha256File(p) {
    return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/** spawnSync with a bounded kill timer. Returns { status, signal, stdout, stderr, timedOut, error }. */
export function runBounded(cmd, args, { timeoutMs = 600000, env = process.env, cwd = PKG_ROOT } = {}) {
    const r = spawnSync(cmd, args, {
        cwd, env, encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGTERM', maxBuffer: 256 * 1024 * 1024,
    });
    const timedOut = !!(r.error && r.error.code === 'ETIMEDOUT');
    return { status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', timedOut, error: r.error };
}

function isFile(p) {
    try { return statSync(p).isFile(); } catch { return false; }
}

function isDir(p) {
    try { return statSync(p).isDirectory(); } catch { return false; }
}

function git(dir, args) {
    const r = runBounded('git', ['-C', dir, ...args], { timeoutMs: 20000 });
    if (r.status !== 0) return null;
    return r.stdout;
}

function fromInstalled(root) {
    const dir = join(root, 'node_modules', '@zakkster', 'lite-utils');
    const pj = join(dir, 'package.json');
    if (!isFile(pj)) return null;
    let meta;
    try { meta = JSON.parse(readFileSync(pj, 'utf8')); } catch (e) {
        return { ok: false, reason: 'installed ' + LU_NAME + ' has an unreadable package.json: ' + e.message };
    }
    const bin = meta && typeof meta.bin === 'object' && meta.bin !== null ? meta.bin : {};
    const tools = {};
    for (const t of TOOLS) {
        const stem = t.replace(/\.(mjs|sh)$/, '');
        const rel = typeof bin[stem] === 'string' ? bin[stem] : typeof bin[t] === 'string' ? bin[t] : t;
        const p = resolve(dir, rel);
        if (!isFile(p)) return { ok: false, reason: 'installed ' + LU_NAME + ' has no ' + t + ' (looked at ' + p + ')' };
        tools[t] = p;
    }
    return { ok: true, source: 'installed ' + LU_NAME + '@' + String(meta.version), dir, tools, commit: 'n/a (installed)', dirty: {} };
}

function fromEnvDir(root, env) {
    const v = env.LITE_UTILS_DIR;
    if (v === undefined || v === '') return null;
    const dir = isAbsolute(v) ? v : resolve(root, v);
    if (!isDir(dir)) return { ok: false, reason: 'LITE_UTILS_DIR is not a directory: ' + dir };
    const tools = {};
    for (const t of TOOLS) {
        const p = join(dir, t);
        if (!isFile(p)) return { ok: false, reason: 'LITE_UTILS_DIR has no ' + t + ': ' + p };
        tools[t] = p;
    }
    const head = git(dir, ['rev-parse', 'HEAD']);
    if (head === null || !/^[0-9a-f]{40}\n?$/.test(head)) {
        return { ok: false, reason: 'cannot read the LiteUtils git commit in ' + dir + ' (provenance, SPEC-p1 R7)' };
    }
    const dirty = {};
    for (const t of TOOLS) {
        const s = git(dir, ['status', '--porcelain', '--ignored', '--', t]);   // a gitignored tool must not read clean
        if (s === null) return { ok: false, reason: 'git status failed for ' + t + ' in ' + dir };
        dirty[t] = s.trim() === '' ? 'clean' : 'dirty(' + s.trim().split(/\s+/)[0] + ')';
    }
    return { ok: true, source: 'LITE_UTILS_DIR=' + v, dir, tools, commit: head.trim(), dirty };
}

/**
 * Resolve the tools. { ok: true, source, dir, tools: { name: absPath }, commit, dirty, sha256 } or
 * { ok: false, reason } (NO VERDICT). Pure over (root, env) apart from the file system and git reads.
 */
export function resolveTools({ root = PKG_ROOT, env = process.env } = {}) {
    const r = fromInstalled(root) || fromEnvDir(root, env);
    if (r === null) {
        return { ok: false, reason: 'no LiteUtils: ' + LU_NAME + ' is not installed under ' + root +
            ' and LITE_UTILS_DIR is unset (use npm run gates:local)' };
    }
    if (!r.ok) return r;
    r.sha256 = {};
    for (const t of TOOLS) r.sha256[t] = sha256File(r.tools[t]);
    return r;
}

// `npm run gates` names both files; node --test exits 0 on a missing named path when another one matches
// (v26.8.2), so each gate file checks that its sibling exists (both missing = node --test exit 1).
export const GATE_FILES = ['test/gates/alloc.test.mjs', 'test/gates/bytecode.test.mjs'];
export function missingGateFiles(root = PKG_ROOT) {
    const pj = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const named = (pj.scripts && pj.scripts.gates) || '';
    return GATE_FILES.filter((f) => !isFile(join(root, f)) || !named.includes(f));
}

/** The provenance header: one line per fact. */
export function provenanceLines(r) {
    const la = loadavg().map((x) => x.toFixed(2)).join(' ');
    const out = [
        '# LiteUtils ' + r.source + ' | dir ' + r.dir + ' | commit ' + r.commit,
        '# node ' + process.version + ' | v8 ' + process.versions.v8 + ' | ' + process.platform + ' ' + process.arch +
            ' | load ' + la + ' | ' + new Date().toISOString(),
    ];
    for (const t of TOOLS) {
        out.push('# tool ' + t + ' sha256 ' + r.sha256[t] + ' | ' + (r.dirty[t] || 'n/a'));
    }
    return out;
}

// ---- CLI ----------------------------------------------------------------------------------------
const SELF = fileURLToPath(import.meta.url);
if (process.argv[1] && existsSync(process.argv[1]) && resolve(process.argv[1]) === SELF) {
    let root = PKG_ROOT;
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' && i + 1 < argv.length) root = resolve(argv[++i]);
        else { process.stderr.write('lu.mjs: NO VERDICT: unknown argument ' + argv[i] + '\n'); process.exit(2); }
    }
    const r = resolveTools({ root });
    if (!r.ok) {
        process.stdout.write('NO VERDICT: ' + r.reason + '\n');
        process.exitCode = 2;
    } else {
        process.stdout.write(provenanceLines(r).join('\n') + '\n');
    }
}
