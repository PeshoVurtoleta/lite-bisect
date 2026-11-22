// test/gates/lu.mjs -- U6 (SPEC-p1 U6, P1-R1): find the LiteUtils tools and record their provenance.
// Imported by test/gates/alloc.test.mjs and test/gates/bytecode.test.mjs; also a CLI:
//   node test/gates/lu.mjs [--root DIR]   -> provenance lines, exit 0; else "NO VERDICT: ..." exit 2
// Resolution order (GU-R2, maintainer 2026-11-22, amends SPEC-p1 U6): a set, non-empty LITE_UTILS_DIR (absolute,
// or relative to the package root -- never to the cwd) is an explicit opt-in and is the ONLY source read: an invalid
// env dir is NO VERDICT and never falls through to the installed package. LITE_UTILS_DIR unset or '' -> the
// installed @zakkster/lite-utils (its package.json `bin` entry by name, else the file at its root). Neither -> NO
// VERDICT. `npm run gates` = the installed package (CI never sets LITE_UTILS_DIR); `npm run gates:local` = the checkout.
// Version floor (GU-R1, maintainer 2026-11-22, amends Q-LU-1a): package.json devDependencies pins
// "@zakkster/lite-utils": "^1.1.0" (1.0.0 shipped no alloc-per-op.mjs). BOTH sources read their package.json
// `version` and are NO VERDICT unless luVersionOk() (a plain x.y.z inside ^LU_FLOOR). The source line names the version.
// Every NO VERDICT decision goes through luVerdict() (one function for the gates, the CLI and the controls).
// Provenance per run (SPEC-p1 RISK R7): LiteUtils git commit, a dirty flag per tool file
// (`git status --porcelain --ignored -- <tool>`: '' clean, else its status code, e.g. M, ?? or !!), sha256 of every
// tool file, node --version, load average. A LITE_UTILS_DIR whose commit cannot be read is NO VERDICT.
// Every spawn here and in the gates goes through runBounded(): a kill timer on each child (SIGTERM; the
// bash tool SIGKILLs its own probe on SIGTERM), never a kill of anything this process did not start.
// Identity (neon-4, audit-neon): BOTH sources' package.json must name @zakkster/lite-utils; a LITE_UTILS_DIR must be
// the TOP of its own git work tree (`git rev-parse --show-toplevel` realpath === realpath(dir); git walks UP, so a
// non-git subdir of another repo would otherwise lend that repo's commit); every git child runs with GIT_DIR,
// GIT_INDEX_FILE and GIT_WORK_TREE removed from its env (an inherited GIT_DIR reads another repo's HEAD); the CLI
// guard compares realpaths, so `node <symlink to lu.mjs>` runs the CLI (exit 2 on NO VERDICT), never exits 0 silently.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { loadavg } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const TOOLS = ['alloc-per-op.mjs', 'bytecode-budget.sh'];
const LU_NAME = '@zakkster/lite-utils';
export const LU_FLOOR = '1.1.0';
const LU_RANGE = '^' + LU_FLOOR;

/** true only for a string 'x.y.z' (decimal digits, no prerelease / build / whitespace) inside ^LU_FLOOR. */
export function luVersionOk(v) {
    if (typeof v !== 'string') return false;
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
    if (m === null) return false;
    const f = /^(\d+)\.(\d+)\.(\d+)$/.exec(LU_FLOOR);
    const maj = Number(m[1]), min = Number(m[2]), pat = Number(m[3]);
    const fMaj = Number(f[1]), fMin = Number(f[2]), fPat = Number(f[3]);
    if (maj !== fMaj) return false;
    if (min !== fMin) return min > fMin;
    return pat >= fPat;
}

/** The one NO VERDICT decision: null when r.ok === true, else 'NO VERDICT: ' + r.reason. */
export function luVerdict(r) {
    if (r !== null && typeof r === 'object' && r.ok === true) return null;
    const reason = r !== null && typeof r === 'object' && typeof r.reason === 'string' ? r.reason : 'no reason given';
    return 'NO VERDICT: ' + reason;
}

/** Read <dir>/package.json -> { meta } or { reason } (missing, unreadable, not a JSON object, version outside the
 *  range, or a name other than LU_NAME -- checked after the version so a missing-version row keeps its reason). */
function readMeta(pj, what) {
    let meta;
    try { meta = JSON.parse(readFileSync(pj, 'utf8')); } catch (e) {
        return { reason: what + ' has an unreadable package.json (' + pj + '): ' + e.message };
    }
    if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) {
        return { reason: what + ' package.json is not a JSON object (' + pj + ')' };
    }
    if (!luVersionOk(meta.version)) {
        return { reason: what + ' version ' + JSON.stringify(meta.version) + ' is not inside ' + LU_RANGE + ' (' + pj + ')' };
    }
    if (meta.name !== LU_NAME) {
        return { reason: what + ' package.json names ' + JSON.stringify(meta.name) + ', not ' + LU_NAME + ' (' + pj + ')' };
    }
    return { meta };
}

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

/** process.env minus the variables that point git at ANOTHER repo / index / work tree (neon-4). */
export function gitEnv(base = process.env) {
    const e = { ...base };
    delete e.GIT_DIR;
    delete e.GIT_INDEX_FILE;
    delete e.GIT_WORK_TREE;
    return e;
}

function realOrNull(p) {
    try { return realpathSync(p); } catch { return null; }
}

function git(dir, args) {
    const r = runBounded('git', ['-C', dir, ...args], { timeoutMs: 20000, env: gitEnv() });
    if (r.status !== 0) return null;
    return r.stdout;
}

function fromInstalled(root) {
    const dir = join(root, 'node_modules', '@zakkster', 'lite-utils');
    const pj = join(dir, 'package.json');
    if (!isFile(pj)) return null;
    const rm = readMeta(pj, 'installed ' + LU_NAME);
    if (rm.meta === undefined) return { ok: false, reason: rm.reason };
    const meta = rm.meta;
    const bin = typeof meta.bin === 'object' && meta.bin !== null ? meta.bin : {};
    const tools = {};
    for (const t of TOOLS) {
        const stem = t.replace(/\.(mjs|sh)$/, '');
        const rel = typeof bin[stem] === 'string' ? bin[stem] : typeof bin[t] === 'string' ? bin[t] : t;
        const p = resolve(dir, rel);
        if (!isFile(p)) return { ok: false, reason: 'installed ' + LU_NAME + ' has no ' + t + ' (looked at ' + p + ')' };
        tools[t] = p;
    }
    return { ok: true, source: 'installed ' + LU_NAME + '@' + meta.version, dir, tools, commit: 'n/a (installed)', dirty: {} };
}

function fromEnvDir(root, v) {
    const dir = isAbsolute(v) ? v : resolve(root, v);
    if (!isDir(dir)) return { ok: false, reason: 'LITE_UTILS_DIR is not a directory: ' + dir };
    const pj = join(dir, 'package.json');
    if (!isFile(pj)) return { ok: false, reason: 'LITE_UTILS_DIR has no package.json (version unknown): ' + pj };
    const rm = readMeta(pj, 'LITE_UTILS_DIR');
    if (rm.meta === undefined) return { ok: false, reason: rm.reason };
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
    const top = git(dir, ['rev-parse', '--show-toplevel']);
    const realTop = top === null ? null : realOrNull(top.replace(/\n$/, ''));
    const realDir = realOrNull(dir);
    if (realTop === null || realDir === null || realTop !== realDir) {
        return { ok: false, reason: 'LITE_UTILS_DIR is not the top of its own git work tree (dir ' + dir + ', git top ' +
            (top === null ? 'unreadable' : top.trim()) + '): its HEAD would be another repo\'s (provenance, SPEC-p1 R7)' };
    }
    const dirty = {};
    for (const t of TOOLS) {
        const s = git(dir, ['status', '--porcelain', '--ignored', '--', t]);   // a gitignored tool must not read clean
        if (s === null) return { ok: false, reason: 'git status failed for ' + t + ' in ' + dir };
        dirty[t] = s.trim() === '' ? 'clean' : 'dirty(' + s.trim().split(/\s+/)[0] + ')';
    }
    return { ok: true, source: 'LITE_UTILS_DIR=' + v + ' (' + LU_NAME + '@' + rm.meta.version + ')', dir, tools, commit: head.trim(), dirty };
}

/**
 * Resolve the tools. { ok: true, source, dir, tools: { name: absPath }, commit, dirty, sha256 } or
 * { ok: false, reason } (NO VERDICT; judge it with luVerdict). Pure over (root, env) apart from the file system and
 * git reads. GU-R2: a set, non-empty env.LITE_UTILS_DIR is the only source; else the installed package.
 */
export function resolveTools({ root = PKG_ROOT, env = process.env } = {}) {
    const v = env.LITE_UTILS_DIR;
    const r = v !== undefined && v !== '' ? fromEnvDir(root, String(v)) : fromInstalled(root);
    if (r === null) {
        return { ok: false, reason: 'no LiteUtils: ' + LU_NAME + ' is not installed under ' + root +
            ' and LITE_UTILS_DIR is unset (npm ci installs ' + LU_RANGE + '; or use npm run gates:local)' };
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
if (process.argv[1] && existsSync(process.argv[1]) && realOrNull(process.argv[1]) === realOrNull(SELF)) {
    let root = PKG_ROOT;
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' && i + 1 < argv.length) root = resolve(argv[++i]);
        else { root = null; break; }
    }
    const r = root === null ? { ok: false, reason: 'lu.mjs: unknown argument (usage: lu.mjs [--root DIR]): ' + argv.join(' ') }
        : resolveTools({ root });
    const nv = luVerdict(r);
    if (nv !== null) {
        process.stdout.write(nv + '\n');
        process.exitCode = 2;
    } else {
        process.stdout.write(provenanceLines(r).join('\n') + '\n');
    }
}
