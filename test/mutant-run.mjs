// test/mutant-run.mjs -- the LiteBisect mutant runner (SPEC-p1 U4, assertion 6).
//
//   node test/mutant-run.mjs [--rows <json>] [--file <Bisect.js>] [--jobs <n>] [--timeout <ms>]
//                            [--rounds <n>] [--big <n>] [--only <id,id,...>]
//
// For every row of test/mutants.json: apply `find` -> `replace` to a scratch copy of Bisect.js
// (in os.tmpdir(), outside the package root), then run a CHECKER in a CHILD PROCESS with a
// timeout. The checker runs ONLY the row's function against the naive oracle in test/oracle.mjs
// (LEDGER law 9: no expected value comes from Bisect.js). Before any row, one unmutated CONTROL
// per type (every kernel family of that type) must PASS. The roster (kernel families x types) is
// the oracle's KERNELS x TYPE_NAMES, never a copy here: a control whose module lacks a roster
// family exits NOFN and the control FAILS.
//
// Row outcomes (exactly one line each):
//   KILLED       the checker printed >= 1 FAIL line, a RESULT line with fails > 0, exited 1,
//                and ran >= MIN_CHECKS checks.
//   SURVIVED     RESULT fails = 0, exit 0, >= MIN_CHECKS checks.            -> runner FAIL
//   NOT-APPLIED  `find` matches 0 or >= 2 times inside the fn span, or the
//                fn header is not exactly once in the file.                 -> runner FAIL
//   TIMEOUT      the child ran past --timeout and was killed (never killed
//                in the mutation sense).                                    -> runner FAIL
//   CRASH        no RESULT line, a non-zero exit with no FAIL line, a signal,
//                or an exit code that disagrees with the RESULT line.       -> runner FAIL
//   LOWCHECKS    RESULT checks < MIN_CHECKS (whatever the fails).           -> runner FAIL
// Exit 0 only when every control PASSes and killed === rows > 0. The last stdout line is
// `VERDICT PASS` or `VERDICT FAIL`.
//
// Child mode (internal): node test/mutant-run.mjs --child <module path> <fn | *> <T> <rounds> <big>
// (--rounds = the oracle's small rounds n = 0..rounds-1, default 70; --big = rounds with
// n = 1..300 after them, default 10; both exist for the LOWCHECKS control.)

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KERNELS, TYPE_NAMES } from './oracle.mjs';

const SELF = fileURLToPath(import.meta.url);
const MIN_CHECKS = 10000;
const SEED = 12345;
const FAMILIES = Object.keys(KERNELS);
const NAME_RE = new RegExp('^(' + FAMILIES.join('|') + ')(' + TYPE_NAMES.join('|') + ')$');
const TYPES = TYPE_NAMES;

if (process.argv[2] === '--child') {
    await childMain(process.argv.slice(3));
} else {
    process.exitCode = await runnerMain(process.argv.slice(2));
}

// ---- child: one checker run --------------------------------------------------------------
async function childMain(argv) {
    const [modPath, fn, T, roundsArg, bigArg] = argv;
    const { runOracle } = await import(new URL('./oracle.mjs', import.meta.url).href);
    const M = await import(pathToFileURL(modPath).href);
    const pick = {};
    for (const k of Object.keys(M)) {
        const m = NAME_RE.exec(k);
        if (m && m[2] === T && (fn === '*' || k === fn)) pick[k] = M[k];
    }
    const want = fn === '*' ? FAMILIES.length : 1;
    if (Object.keys(pick).length !== want) {
        process.stdout.write('NOFN ' + fn + ' ' + T + ' found ' + Object.keys(pick).length + '\n');
        process.exit(3);
    }
    const r = runOracle(pick, T, SEED, { smallRounds: Number(roundsArg), bigRounds: Number(bigArg) });
    for (const k of Object.keys(r.perName)) {
        if (r.perName[k] === 0) { process.stdout.write('NOFN ' + k + ' ran 0 checks\n'); process.exit(3); }
    }
    let out = '';
    for (const m of r.msgs) out += 'FAIL ' + m + '\n';
    out += 'RESULT checks=' + r.checks + ' fails=' + r.fails + '\n';
    process.stdout.write(out);
    process.exitCode = r.fails === 0 ? 0 : 1;
}

// ---- runner ------------------------------------------------------------------------------
function parseArgs(argv) {
    const o = {
        rows: fileURLToPath(new URL('./mutants.json', import.meta.url)),
        file: fileURLToPath(new URL('../Bisect.js', import.meta.url)),
        jobs: Math.max(1, Math.min(6, availableParallelism() - 2)),
        timeout: 60000,
        rounds: 70,
        big: 10,
        only: null,
    };
    for (let i = 0; i < argv.length; i += 2) {
        const k = argv[i], v = argv[i + 1];
        if (v === undefined) throw new RangeError('missing value for ' + k);
        if (k === '--rows') o.rows = v;
        else if (k === '--file') o.file = v;
        else if (k === '--jobs') o.jobs = posInt(k, v);
        else if (k === '--timeout') o.timeout = posInt(k, v);
        else if (k === '--rounds') o.rounds = posInt(k, v);
        else if (k === '--big') o.big = Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : posInt(k, v);
        else if (k === '--only') o.only = new Set(v.split(','));
        else throw new RangeError('unknown option ' + k + ' (known: --rows --file --jobs --timeout --rounds --big --only)');
    }
    return o;
}
function posInt(k, v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) throw new RangeError(k + ' needs a positive integer, got ' + v);
    return n;
}

function countOf(hay, needle) {
    let c = 0;
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) c++;
    return c;
}
// [start, end) of `export function <fn>(` up to the next `export function ` or `// END GENERATED`.
function fnSpan(text, fn) {
    const head = 'export function ' + fn + '(';
    const s = text.indexOf(head);
    if (s < 0 || text.indexOf(head, s + 1) >= 0) return null;
    let e = text.indexOf('\nexport function ', s + head.length);
    const g = text.indexOf('\n// END GENERATED', s + head.length);
    if (e < 0 || (g >= 0 && g < e)) e = g;
    if (e < 0) e = text.length;
    return { s, e };
}

function runChild(modPath, fn, T, o) {
    return new Promise((resolve) => {
        const t0 = Date.now();
        const cp = spawn(process.execPath, [SELF, '--child', modPath, fn, T, String(o.rounds), String(o.big)],
            { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '', err = '', timedOut = false;
        cp.stdout.on('data', (d) => { out += d; });
        cp.stderr.on('data', (d) => { err += d; });
        const timer = setTimeout(() => { timedOut = true; cp.kill('SIGKILL'); }, o.timeout);
        cp.on('close', (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, out, err, timedOut, ms: Date.now() - t0 });
        });
    });
}

// Classify one child run. Returns { kind, checks, fails, first }.
function classify(r) {
    const lines = r.out.split('\n');
    let checks = -1, fails = -1, first = '', failLines = 0, results = 0;
    for (const ln of lines) {
        if (ln.startsWith('FAIL ')) { failLines++; if (first === '') first = ln.slice(5); }
        const m = /^RESULT checks=(\d+) fails=(\d+)$/.exec(ln);
        if (m) { results++; checks = Number(m[1]); fails = Number(m[2]); }
    }
    let kind;
    if (r.timedOut) kind = 'TIMEOUT';
    else if (r.signal !== null || results !== 1) kind = 'CRASH';
    else if (checks < MIN_CHECKS) kind = 'LOWCHECKS';
    else if (fails > 0 && failLines > 0 && r.code === 1) kind = 'KILLED';
    else if (fails === 0 && failLines === 0 && r.code === 0) kind = 'SURVIVED';
    else kind = 'CRASH';
    if (kind === 'CRASH' && first === '') first = (r.err.split('\n').find((l) => /Error|error/.test(l)) || ('exit ' + r.code + ' signal ' + r.signal)).trim();
    return { kind, checks, fails, first };
}

async function pool(items, jobs, work) {
    const res = new Array(items.length);
    let next = 0;
    const lane = async () => { while (next < items.length) { const i = next++; res[i] = await work(items[i]); } };
    const lanes = [];
    for (let j = 0; j < Math.min(jobs, items.length); j++) lanes.push(lane());
    await Promise.all(lanes);
    return res;
}

async function runnerMain(argv) {
    const t0 = Date.now();
    const o = parseArgs(argv);
    const base = readFileSync(o.file, 'utf8');
    const spec = JSON.parse(readFileSync(o.rows, 'utf8'));
    if (!spec || !Array.isArray(spec.rows)) throw new TypeError('rows file has no rows[]');
    const seen = new Set();
    let rows = spec.rows;
    for (const r of rows) {
        if (typeof r.id !== 'string' || seen.has(r.id)) throw new TypeError('row id missing or duplicate: ' + r.id);
        seen.add(r.id);
        if (typeof r.fn !== 'string' || !NAME_RE.test(r.fn)) throw new TypeError(r.id + ': bad fn ' + r.fn);
        if (typeof r.find !== 'string' || r.find === '' || typeof r.replace !== 'string') {
            throw new TypeError(r.id + ': find must be a non-empty string, replace a string');
        }
    }
    if (o.only) rows = rows.filter((r) => o.only.has(r.id));
    const dir = mkdtempSync(join(tmpdir(), 'lite-bisect-mutants-'));
    const lines = [];
    const say = (s) => { lines.push(s); process.stdout.write(s + '\n'); };
    let controlOk = true, killed = 0;
    const tally = { KILLED: 0, SURVIVED: 0, 'NOT-APPLIED': 0, TIMEOUT: 0, CRASH: 0, LOWCHECKS: 0 };
    try {
        // Controls: the unmutated copy, every kernel family per type, must PASS.
        const ctlPath = join(dir, 'control.mjs');
        writeFileSync(ctlPath, base);
        const ctl = await pool(TYPES, o.jobs, async (T) => ({ T, r: await runChild(ctlPath, '*', T, o) }));
        for (const { T, r } of ctl) {
            const c = classify(r);
            const pass = c.kind === 'SURVIVED';
            if (!pass) controlOk = false;
            say('CONTROL ' + T + ' ' + (pass ? 'PASS' : 'FAIL (' + c.kind + ')') + ' checks=' + c.checks +
                ' fails=' + c.fails + ' ms=' + r.ms + (c.first ? ' | ' + c.first : ''));
        }
        // Rows.
        const jobs = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const sp = fnSpan(base, row.fn);
            const n = sp ? countOf(base.slice(sp.s, sp.e), row.find) : -1;
            if (n !== 1) { jobs.push({ row, na: sp ? 'find matches ' + n + 'x in ' + row.fn : 'fn header not exactly once' }); continue; }
            const at = base.indexOf(row.find, sp.s);
            const p = join(dir, 'm' + i + '.mjs');
            writeFileSync(p, base.slice(0, at) + row.replace + base.slice(at + row.find.length));
            jobs.push({ row, path: p });
        }
        const T_OF = (fn) => NAME_RE.exec(fn)[2];
        const res = await pool(jobs, o.jobs, async (j) => (j.na ? j : { ...j, r: await runChild(j.path, j.row.fn, T_OF(j.row.fn), o) }));
        for (const j of res) {
            if (j.na) { tally['NOT-APPLIED']++; say('NOT-APPLIED ' + j.row.id + ' | ' + j.na); continue; }
            const c = classify(j.r);
            tally[c.kind]++;
            if (c.kind === 'KILLED') killed++;
            say(c.kind + ' ' + j.row.id + ' checks=' + c.checks + ' fails=' + c.fails + ' ms=' + j.r.ms +
                (c.first ? ' | ' + c.first : ''));
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
    const ok = controlOk && rows.length > 0 && killed === rows.length;
    say('MUTANTS rows=' + rows.length + ' killed=' + killed + ' survived=' + tally.SURVIVED +
        ' notApplied=' + tally['NOT-APPLIED'] + ' timeout=' + tally.TIMEOUT + ' crash=' + tally.CRASH +
        ' lowchecks=' + tally.LOWCHECKS + ' control=' + (controlOk ? 'PASS' : 'FAIL') +
        ' jobs=' + o.jobs + ' wallMs=' + (Date.now() - t0));
    say('VERDICT ' + (ok ? 'PASS' : 'FAIL'));
    return ok ? 0 : 1;
}
