// ab-gate.mjs -- LiteBisect P3 A/B GATE lab: the STATISTICAL release gate of PROPOSAL-ab section 2 (RULED 2026-11-12,
// ROADMAP 5f), run by .github/workflows/ab.yml (dispatch-only, ubuntu-latest + macos-latest). Never part of
// `npm run verify`, `npm test` or a required check. ASCII only. Nothing imports this; it edits no package file.
// NEW BODY (LEDGER law 11: reviewed before its numbers count): it is bench/research/ab-lab.mjs (sha256 211bef39, R4's
// record, unchanged) + ONLY this diff (brief .handoff/p3/BRIEF-abgate.md T1-T5):
//  T1 GATED: a frozen literal map of the 13 gated lane ids -> expected word, typed from the PROPOSAL-ab section 2 text;
//     RESULT / ORACLE lines tag a lane "(gated)" / "(reported)" by membership in GATED (lane.rule and its
//     "(kill-rule)" / "(report)" tags are gone). The AB1 / AB2 research rule blocks still print (REPORT output only;
//     nothing they print sets the exit) and ruleAB1's STOP HARNESS (hint FASTER on uniform) stays. The lab's old
//     "any kill-rule VOID -> exit 2" is gone: the exit is verdictOf's code.
//  T2 verdictOf(lines): ONE function for the live run (every line say() printed) and `--verdict-file <log|->`; prints a
//     `REPORTED ...` summary line and ONE `VERDICT PASS|FINDING|NO VERDICT ...` line (cpu / arch / node from the HEADER).
//  T3 AB-G2 live binding: the 3 F64 kernel bodies cut (same anchors) from the LIVE Bisect.js must equal the frozen
//     bodies byte for byte, else STOP ANCHOR; an unreadable frozen or live file is STOP ANCHOR (was a CRASH on ENOENT).
//  T4 fw oracle teeth: an UNTIMED check per fw lane runs every copy's fw runner once over a VARIANT array whose top two
//     keys differ (a delete ending at len instead of len + 1 is invisible on the timed arrays); mismatch = STOP ORACLE.
//  T5 selftest: the 10 injection children (new exit codes + VERDICT line), 3 live-verdict-path children (clean subset,
//     live-drift, fw-delete-end) and the fixture controls F1-F11 (+ one control per remaining verdictOf check row, law 9)
//     as child `--verdict-file` processes on the sha-pinned R4 fixtures bench/ab-fixtures/*.log.
//  Plus the path changes this location needs (PKG = one level up) and the gate rule printed in the HEADER (law 10).
// Kernels are cut by anchor from the FROZEN bench/research/frozen/88e5b1c-10add825/Bisect.js (full sha256 checked) and
// compiled from it; the live Bisect.js is only compared (T3), never compiled.
//
//   FLAGS="--expose-gc --allow-natives-syntax --no-concurrent-recompilation --min-semi-space-size=4 --max-semi-space-size=4 --single-threaded-gc"
//   node $FLAGS ab-gate.mjs --rung ALL                          the gate run: every lane, K = 11, C = 3 (TIMED: quiet-lock run)
//   node $FLAGS ab-gate.mjs --rung AB1|AB2 [--lanes ids] [--K k] a subset / research run (always NO VERDICT: wrong shape)
//   node $FLAGS ab-gate.mjs --rung AB1|AB2|ALL --oracle-only    build every lane, oracle + fold + TF + stream count, no clock
//   node $FLAGS ab-gate.mjs --selftest                          the STOP gate of ab.yml: prints `SELFTEST all ok` or FAIL
//   node ab-gate.mjs --verdict-file <log|->                     the verdict of a saved gate log (untimed, needs no flags)
//
// Gate (PROPOSAL-ab section 2): per OS, PASS = every gated lane reads its expected word with its controls valid (A/A in
// [0.95, 1.05], SLOW median > 1.25 and q1 > 1.10, B/op 0 (< 1/64) on A, B, AA, SLOW, TF); FINDING = a clean gated lane
// reads another word (AB-G1 / AB-G1a: even with other gated lanes VOID in a complete run, listed; a missing gated
// lane is a wrong run shape: NO VERDICT, the wrong gated words listed); NO VERDICT = any VOID or missing gated lane, a
// wrong run shape (not exactly one `HEADER rung=ALL TIMED` with K=11 C=3 inject=null, no `PROV end`, a lane without
// exactly one RESULT line) or any STOP / CRASH. NO VERDICT is never a PASS. The gate passes only when both OS read PASS
// in the same dispatch. REPORTED lanes (walk:256:1, walk:4096:4, fw:1024, fw:2048 and the
// report lanes) are printed in the REPORTED line and never read by the verdict.
//
// Rungs: AB1 = P0 T2 on the F64 kernels: uni:n + walk:n:d, n = 256, 4096, 65536, d = 1, 4, 64, n/8; A =
// lowerBoundBranchlessF64, B = lowerBoundHintF64 (DEPS: the hint calls lowerBoundBranchlessF64). AB2: A =
// lowerBoundBranchyF64, B = lowerBoundBranchlessF64 (B / A > 1 = branchless slower).
// ro:n (n = 16, 256, 4096, 65536): T2's array generator for n + T2's uniform stream (d = 0), runner 'full'.
// fw:n (n = 16, 128, 1024, 2048): runner 'fw' (law 1, I1's consumer): array capacity n + 1 (first n = T2's generator, slot
// n spare), len = n; per op p = K(a, 0, len, x); a.copyWithin(p + 1, p, len); a[p] = x; q = K(a, 0, len + 1, x);
// a.copyWithin(q, q + 1, len + 1); fold p + q. `one` returns p if q === p else -1 (the oracle catches a q mismatch); fold
// want = 2 x sum(exp) x reps; branch proxy = 2 x compares(len, pos). Live range [0, n) byte-compared to the lane's start
// array after the oracle pass and after timing (STOP ORACLE on a mismatch); slot n is scratch by construction (after an
// op it holds the old a[n - 1] or x), so it is not compared. Lane streams use T2's generator with their own fnv seed per
// lane id ('ro:n' / 'fw:n'); the array seed is T2's ('t2:a:' + n).
// SLOW spin (A + spin at the head of A's kernel): AB1 SPIN_T2 = 256 (P0); ro SPIN_RO = 256; fw SPIN_FW_BASE +
// (n >>> SPIN_FW_SHIFT) = 192 + n / 4 per kernel call, two calls per op.
// Every RESULT lane also prints a RAW line: the K per-round B/A, AA/A, SLOW/A ratios in round order (4 decimals).
//
// Exits: 0 PASS | 2 NO VERDICT | 3 FINDING | 1 STOP (ORACLE, ANCHOR, CLI, FLAGS, CLASSIFIER, HARNESS) or CRASH in this
// process (the handler prints STOP / CRASH, then `VERDICT NO VERDICT (STOP <reason>) ...` listing any wrong gated word
// already printed). `--verdict-file` maps the same verdicts the same way (a STOP line inside the log = NO VERDICT 2).
// `--oracle-only`: 0 = no VOID on a gated lane, 2 = a VOID on a gated lane (no VERDICT line: no clock, no words).
// `--selftest`: 0 = SELFTEST all ok, 1 = any case FAIL (a crashed, timed-out or never-run case is a FAIL).
// VOID markers (per lane): SLOW-DEAD, AA-DRIFT, NOT-TF, ALLOC, GC-WINDOW, NAN, STREAM; a VOID lane is never quoted.
//
// Words (INTAKE): SLOWER = median > 1.05 and q1 > 1; FASTER = median < 0.95 and q3 < 1; else WITHIN. Ratio = B / A per round.

import os from 'node:os';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { GCProfiler, getHeapSpaceStatistics } from 'node:v8';

const ME = fileURLToPath(import.meta.url);
const PKG = resolve(dirname(ME), '..');
const FROZEN = join(PKG, 'bench/research/frozen/88e5b1c-10add825/Bisect.js');
const FROZEN_SHA = '10add825165116c6b014eb9883aa27cef04503d7ed034c0c6a68fd8e96ca365c';
const LIVE = join(PKG, 'Bisect.js');   // T3 (AB-G2): compared to the frozen bodies, never compiled
// T1: the gated lanes and their expected words, typed from PROPOSAL-ab section 2 (RULED 2026-11-12, ROADMAP 5f):
// "uni:* hint SLOWER; walk:4096:1, walk:65536:1 / :4 hint FASTER; walk:256:4 hint SLOWER; ro:* branchless FASTER;
// fw:16 / fw:128 branchless SLOWER." (Q-AB-LANES (a), Q-AB-FEEDSWRITE (a)). Never derived from c5Word, a RULE_* text
// or any run. Every other lane of rungSpecs('ALL') is REPORTED.
const GATED = Object.freeze({
    'uni:256': 'SLOWER', 'uni:4096': 'SLOWER', 'uni:65536': 'SLOWER',
    'walk:4096:1': 'FASTER', 'walk:65536:1': 'FASTER', 'walk:65536:4': 'FASTER',
    'walk:256:4': 'SLOWER',
    'ro:16': 'FASTER', 'ro:256': 'FASTER', 'ro:4096': 'FASTER', 'ro:65536': 'FASTER',
    'fw:16': 'SLOWER', 'fw:128': 'SLOWER',
});
const isGated = (id) => Object.hasOwn(GATED, id);
const gateTag = (id) => (isGated(id) ? ' (gated)' : ' (reported)');
// T5 (c): the R4 hosted logs (run 43127032794), verbatim; a changed fixture = selftest FAIL
const FIXTURES = Object.freeze({
    ubuntu: { path: join(PKG, 'bench/ab-fixtures/r4-ubuntu-rung-all.log'), sha: 'c7bdc7bf1eb0e6ccb7e17765da7ff21effe615238a46c1dd1d2f912bc66e0f58' },
    macos: { path: join(PKG, 'bench/ab-fixtures/r4-macos-rung-all.log'), sha: '569b7d183451150b3ea8fff425b9a55f8351cbd80160973862e91b22ce3d46fe' },
});
const REQUIRED_FLAGS = Object.freeze(['--expose-gc', '--allow-natives-syntax', '--no-concurrent-recompilation',
    '--min-semi-space-size=4', '--max-semi-space-size=4', '--single-threaded-gc']);
const K_FULL = 11;
const C_COPIES = 3;
const NQ = 1 << 18;              // window starts in [0, NQ), window length <= NQ
const NQ2 = NQ * 2;              // distinct ops per lane (no duplicated half: a walk stays continuous)
const MIN_N = 1 << 17;           // shortest window; the stream rule is checked against it untimed too
const TARGET_MS = 5;
const MAX_REPS = 256;
const TF_N = 1 << 12;
const TF_TRIES = 300;
const SETTLE_TRIES = 4;
const WARM_ROUNDS = 3;
const WARM_N = 1 << 14;
const ALLOC_N = 1 << 14;
const ALLOC_REPS = 4;
const ALLOC_WINDOWS = 5;
const ALLOC_MAX = 1 / 64;
const SAMPLE = 4096;
const MIN_BRANCHES = 100000;
const AA_LO = 0.95;
const AA_HI = 1.05;
const SPIN_T2 = 256;             // AB1 (P0 T2 constant)
const SPIN_RO = 256;             // AB2 ro:* (= SPIN_T2)
const SPIN_FW_BASE = 192, SPIN_FW_SHIFT = 2;   // AB2 fw:n: 192 + (n >>> 2) iterations per kernel call, 2 calls per op
const spinFw = (n) => SPIN_FW_BASE + (n >>> SPIN_FW_SHIFT);
const T2_SIZES = [256, 4096, 65536];
const RO_SIZES = [16, 256, 4096, 65536];
const FW_SIZES = [16, 128, 1024, 2048];
const KERNEL_NAMES = ['lowerBoundBranchlessF64', 'lowerBoundBranchyF64', 'lowerBoundHintF64'];
const DEPS = {
    lowerBoundBranchlessF64: [], lowerBoundBranchyF64: [],
    lowerBoundHintF64: ['lowerBoundBranchlessF64'],
};
// selftest bent-oracle: the anchor is picked by lane B entry and applied to THAT entry's own text only, before its DEPS
// are prepended (sub1: a missing / non-unique anchor is STOP ANCHOR, never a silent no-op)
const BENDS = Object.freeze({
    lowerBoundHintF64: ['while (r < hi && a[r] < x)', 'while (r < hi && a[r] <= x)'],
    lowerBoundBranchlessF64: ['b += (0 - ((a[b + h] < x) | 0)) & h;', 'b += (0 - ((a[b + h] <= x) | 0)) & h;'],
});
// a subset K = 3 child is the wrong run shape: a VOID injection reads NO VERDICT 2, a STOP injection reads 1 (T5 a / b).
// `verdict` is the prefix the child's VERDICT line must carry.
const INJECTIONS = Object.freeze({
    'bent-oracle': { want: 1, marker: 'STOP ORACLE', verdict: 'VERDICT NO VERDICT (STOP ORACLE)' },
    'boxed': { want: 2, marker: 'VOID ALLOC', verdict: 'VERDICT NO VERDICT' },
    'slow-dead': { want: 2, marker: 'VOID SLOW-DEAD', verdict: 'VERDICT NO VERDICT' },
    'aa-drift': { want: 2, marker: 'VOID AA-DRIFT', verdict: 'VERDICT NO VERDICT' },
    // T3: one byte of the LIVE lowerBoundBranchyF64 body changed in memory before the live / frozen compare
    'live-drift': { want: 1, marker: 'STOP ANCHOR: live lowerBoundBranchyF64 body differs', verdict: 'VERDICT NO VERDICT (STOP ANCHOR)' },
    // T4: every fw column's delete ends at len (run) / hi (one) instead of len + 1 / hi + 1; only the variant check sees it
    'fw-delete-end': { want: 1, marker: 'fw variant (top two keys distinct)', verdict: 'VERDICT NO VERDICT (STOP ORACLE)' },
});
const SELFTEST_CASES = Object.freeze([
    ['bent-oracle', 'AB1', 'walk:4096:1'], ['bent-oracle', 'AB2', 'ro:256'], ['bent-oracle', 'AB2', 'fw:128'],
    ['boxed', 'AB2', 'ro:256'],
    ['slow-dead', 'AB1', 'walk:4096:1'], ['slow-dead', 'AB2', 'ro:256'], ['slow-dead', 'AB2', 'fw:128'],
    ['aa-drift', 'AB1', 'walk:4096:1'], ['aa-drift', 'AB2', 'ro:256'], ['aa-drift', 'AB2', 'fw:128'],
    // T5 (b): the live verdict path
    [null, 'AB2', 'ro:16'], ['live-drift', 'AB2', 'ro:16'], ['fw-delete-end', 'AB2', 'fw:16'],
]);
// `names`: the clean child must read NO VERDICT for its run shape, not for a VOID or an empty log (B3)
const CLEAN_CHILD = Object.freeze({ want: 2, marker: null, verdict: 'VERDICT NO VERDICT', names: ['rung=AB2 (want ALL)', 'K=3 (want 11)', 'no RESULT for 22 lane(s)'] });
const VARIANT_N = 1 << 14;         // T4: ops per fw variant run (untimed)
const SELFTEST_CASE_MS = 600000;   // a hung child is killed (status null = FAIL), never waited on forever
const RULE_AB1 = 'Rule (C5 comparison, per kill-rule lane): C5 REPRODUCED if every kill-rule lane word equals C5\'s strict word (uni:* SLOWER; walk:256:1 / :4 SLOWER; walk:4096 / 65536 :1 / :4 FASTER); any differing word = C5 DIFFERS at <lanes> (a FINDING, never re-run for agreement). Any VOID kill-rule lane, an incomplete lane set or K != 11 = UNRULED (maintainer).';
const CTRL_T2 = 'Control: hint FASTER on uniform = STOP HARNESS (a gallop cannot beat a fresh search there).';
const REPORT_T2 = 'Report the d where it stops winning at each n.';
const MARGIN_TXT = 'Margin per kill-rule lane = the smaller of |median - threshold| and |q1 or q3 - 1| for its word (SLOWER: 1.05 and q1; FASTER: 0.95 and q3). WITHIN (no INTAKE margin): toS = max(1.05 - median, 1 - q1), toF = max(median - 0.95, q3 - 1), the distance to each word.';
const RULE_AB2_RO = 'Read-only (ro:16, 256, 4096, 65536): default stands if no ro lane reads SLOWER; any ro lane SLOWER = FINDING for Q-AB-README. Any VOID ro lane, an incomplete ro set or K != 11 = UNRULED for this half.';
const RULE_AB2_FW = 'Feeds-write (fw:16, 128, 1024, 2048): I1 REPRODUCED if >= 2 fw lanes read SLOWER and none FASTER; I1 CONTRADICTED if any fw lane reads FASTER; else I1 NOT SHOWN (either of the last two = FINDING for Q-AB-FEEDSWRITE). Any VOID fw lane, an incomplete fw set or K != 11 = UNRULED for this half.';

const RULE_GATE = 'Gate (PROPOSAL-ab section 2, ROADMAP 5f; AB-G1, AB-G1a, AB-G2): per OS, PASS = every gated lane reads its expected word with its controls valid (no VOID tag or line; recomputed from the printed numbers: aa median in [0.95, 1.05], slow median > 1.25 and q1 > 1.10, bop A, B, AA, SLOW each < 1/64, B/A finite and word() of it = the printed word); FINDING = a clean gated lane reads another word (AB-G1 / AB-G1a: even with other gated lanes VOID in a complete run, listed; a missing gated lane is a wrong run shape: NO VERDICT, the wrong gated words listed); NO VERDICT = any VOID or missing gated lane, a wrong run shape (exactly one HEADER rung=ALL TIMED with K=11 C=3 inject=null, a PROV end line, one RESULT line per lane) or any STOP / CRASH. NO VERDICT is never a PASS; the gate passes only when both OS read PASS in the same dispatch; one re-dispatch of a NO VERDICT run (Q-AB-K), never a re-run of a FINDING.';

class Stop extends Error { constructor(reason, msg) { super(msg); this.reason = reason; } }
function stop(reason, msg) { throw new Stop(reason, msg); }
/** Every printed line is kept: the live run's verdict reads exactly what the log shows (T2). */
const LOG = [];
function say(s) { LOG.push(s); process.stdout.write(s + '\n'); }
function settle(ms) { return new Promise((res) => { setTimeout(res, ms); }); }
const fmt = (x, d) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const fmtS = (s, d) => fmt(s.med, d) + '[' + fmt(s.q1, d) + '..' + fmt(s.q3, d) + ']';

// ---------------------------------------------------------------- statistics (LiteLogLogN test/witness-roar.mjs quant / summarize, verbatim)
function quant(sorted, p) {
    const n = sorted.length;
    if (!(n > 0) || typeof p !== 'number' || !(p >= 0 && p <= 1)) return NaN;
    if (n === 1) return sorted[0];
    const h = (n - 1) * p, i = Math.floor(h);
    return i + 1 < n ? sorted[i] + (h - i) * (sorted[i + 1] - sorted[i]) : sorted[i];
}
function summarize(arr) {
    const s = Array.from(arr);
    for (let i = 0; i < s.length; i++) if (typeof s[i] !== 'number' || !Number.isFinite(s[i])) return { med: NaN, q1: NaN, q3: NaN };
    s.sort((a, b) => a - b);
    return { med: quant(s, 0.5), q1: quant(s, 0.25), q3: quant(s, 0.75) };
}

// ---------------------------------------------------------------- verdict words (pair-lab, unchanged)
const aaOk = (s) => s.med >= AA_LO && s.med <= AA_HI;
const slowOk = (s) => s.med > 1.25 && s.q1 > 1.10;
function word(s) {
    if (!Number.isFinite(s.med)) return 'NONE';
    if (s.med > AA_HI && s.q1 > 1) return 'SLOWER';
    if (s.med < AA_LO && s.q3 < 1) return 'FASTER';
    return 'WITHIN';
}
function ratioVec(a, b) {
    if (!a || !b || !(a.length > 0) || a.length !== b.length) return [NaN];
    const v = new Array(a.length);
    for (let i = 0; i < a.length; i++) v[i] = a[i] / b[i];
    return v;
}
function diffVec(a, b) {
    if (!a || !b || !(a.length > 0) || a.length !== b.length) return [NaN];
    const v = new Array(a.length);
    for (let i = 0; i < a.length; i++) v[i] = a[i] - b[i];
    return v;
}

// ---------------------------------------------------------------- kernel text, verbatim from the frozen draft
function uniqueAt(text, needle, what) {
    const i = text.indexOf(needle);
    if (i < 0 || text.indexOf(needle, i + 1) >= 0) stop('ANCHOR', what + ': ' + JSON.stringify(needle) + ' not unique');
    return i;
}
/** T3: an unreadable frozen or live file is STOP ANCHOR (fail closed), never a CRASH. */
function readOrStop(path, what) {
    try { return readFileSync(path); } catch (e) { return stop('ANCHOR', what + ' ' + path + ' unreadable (' + (e.code || e.message) + ')'); }
}
/** The 3 kernel bodies by anchor (`export function <name>(` .. the first `\n}\n`), `export ` stripped. `who` prefixes
 *  every ANCHOR message ('' = frozen, as the lab; 'live ' = T3). */
function cutBodies(text, who) {
    const out = {};
    for (const name of KERNEL_NAMES) {
        const i = uniqueAt(text, 'export function ' + name + '(', who + name);
        const end = text.indexOf('\n}\n', i);
        if (end < 0) stop('ANCHOR', who + name + ': no closing brace');
        const body = text.slice(i + 'export '.length, end + 2);
        if (body.indexOf('export ') >= 0 || body.indexOf('\nfunction ') >= 0) stop('ANCHOR', who + name + ': body runs into the next declaration');
        out[name] = body;
    }
    return out;
}
function loadFrozen() {
    const buf = readOrStop(FROZEN, 'frozen');
    const sha = createHash('sha256').update(buf).digest('hex');
    if (sha !== FROZEN_SHA) stop('ANCHOR', FROZEN + ': sha256 ' + sha.slice(0, 8) + ' (want ' + FROZEN_SHA.slice(0, 8) + ')');
    return cutBodies(buf.toString('utf8'), '');
}
/** T3 (AB-G2 "bind live = frozen"): the same 3 bodies cut from the LIVE Bisect.js must equal the frozen bodies byte for
 *  byte (both files are ASCII by law; a non-ASCII byte decodes to a different string, so string equality is byte
 *  equality here). A comment-only edit outside the bodies does not trip. `inject` 'live-drift' changes one byte of the
 *  live lowerBoundBranchyF64 body in memory, before the compare (selftest). */
function checkLive(frozen, inject) {
    const live = cutBodies(readOrStop(LIVE, 'live').toString('utf8'), 'live ');
    if (inject === 'live-drift') live.lowerBoundBranchyF64 = sub1('live-drift', live.lowerBoundBranchyF64, 'if (a[m] < x)', 'if (a[m] > x)');
    for (const name of KERNEL_NAMES) {
        const a = frozen[name], b = live[name];
        if (a === b) continue;
        let i = 0;
        while (i < a.length && i < b.length && a.charCodeAt(i) === b.charCodeAt(i)) i++;
        stop('ANCHOR', 'live ' + name + ' body differs from the frozen body at char ' + i + ' (live ' + b.length + ' vs frozen ' + a.length + ' chars; ' + LIVE + ')');
    }
}
let KTEXT = null;
/** DEPS first, then the entry; `own` (selftest bent-oracle) replaces the entry's own text only, never a DEP's. */
function block(entry, own) {
    const parts = [];
    for (const d of DEPS[entry]) parts.push(KTEXT[d]);
    parts.push(own === undefined ? KTEXT[entry] : own);
    return parts.join('\n');
}
function sub1(name, text, from, to) {
    const i = uniqueAt(text, from, name);
    return text.slice(0, i) + to + text.slice(i + from.length);
}
globalThis.__labSpin = new Int32Array(256);
function atHead(text, entry, code) {
    const i = uniqueAt(text, 'function ' + entry + '(', 'head ' + entry);
    const j = text.indexOf('{', i);
    if (j < 0) stop('ANCHOR', 'head ' + entry + ': no body');
    return text.slice(0, j + 1) + ' ' + code + text.slice(j + 1);
}
function spinned(text, entry, iters) {
    return atHead(text, entry, 'const __s = globalThis.__labSpin; for (let __i = 0; __i < ' + iters + '; __i++) { __s[__i & 255] = (__s[(__i + 1) & 255] + __i) | 0; }');
}
// selftest `boxed`: a fractional double stored into a PACKED_ELEMENTS array escapes as a HeapNumber on every call
globalThis.__labBox = new Array(256).fill(null);
const boxed = (text, entry) => atHead(text, entry, 'globalThis.__labBox[lo & 255] = x * 0.3 + 0.1;');

// ---------------------------------------------------------------- natives + TF check (pair-lab)
const TF_BIT = 32;
let optStatus = null, forceOpt = null;
function armNatives() {
    for (const f of REQUIRED_FLAGS) if (!process.execArgv.includes(f)) stop('FLAGS', 'needs ' + f + ' (got ' + process.execArgv.join(' ') + ')');
    optStatus = new Function('f', 'return %GetOptimizationStatus(f);');
    forceOpt = new Function('f', '%PrepareFunctionForOptimization(f); %OptimizeFunctionOnNextCall(f);');
    const forceTf = new Function('f', '%PrepareFunctionForOptimization(f); f(1); f(2); %OptimizeFunctionOnNextCall(f); f(3);');
    const pTf = new Function('x', 'return (x * 3 + 1) | 0;');
    const pIn = new Function('x', 'return (x * 7 + 1) | 0;');
    forceTf(pTf); pIn(1);
    if ((optStatus(pTf) & TF_BIT) === 0 || (optStatus(pIn) & TF_BIT) !== 0) stop('CLASSIFIER', 'TF_BIT self-check failed');
}

// ---------------------------------------------------------------- GC window, B/op (pair-lab)
const notMinor = (s) => s.gcType !== 'Scavenge' && s.gcType !== 'MinorMarkSweep';
async function gcWindow(fn) {
    globalThis.gc();
    await settle(50);
    const p = new GCProfiler();
    p.start();
    fn();
    await settle(50);
    const st = p.stop().statistics;
    return { major: st.filter(notMinor).length, all: st.length };
}
async function gcControl() {
    const clean = await gcWindow(() => {});
    const forced = await gcWindow(() => { globalThis.gc(); });
    if (clean.major !== 0 || forced.major < 1) stop('CLASSIFIER', 'gc window: empty ' + clean.major + ' / forced ' + forced.major);
    say('CONTROL gc-window: empty clean; forced gc flips major (' + forced.major + ') -- ok');
}
function newSpaceUsed() {
    for (const s of getHeapSpaceStatistics()) if (s.space_name === 'new_space') return s.space_used_size;
    return -1;
}
function allocWindow(e, lane, reps) {
    let min = -1, valid = 0;
    for (let w = 0; w < ALLOC_WINDOWS; w++) {
        globalThis.gc({ type: 'minor' });
        const gp = new GCProfiler();
        gp.start();
        const s0 = newSpaceUsed();
        e.run(e.a, e.los, e.lens, lane.len, e.qs, 0, ALLOC_N, reps, 0);
        const s1 = newSpaceUsed();
        const gcs = gp.stop().statistics.length;
        if (s0 < 0 || s1 < 0 || gcs !== 0 || w === 0) continue;
        valid++;
        if (min < 0 || s1 - s0 < min) min = s1 - s0;
    }
    return valid >= (ALLOC_WINDOWS >>> 1) ? min : null;
}
function allocBop(e, lane) {
    forceOpt(e.run);
    e.run(e.a, e.los, e.lens, lane.len, e.qs, 0, ALLOC_N, 1, 0);
    e.run(e.a, e.los, e.lens, lane.len, e.qs, 0, ALLOC_N, 1, 0);
    allocWindow(e, lane, 1);
    const b1 = allocWindow(e, lane, 1);
    const bN = allocWindow(e, lane, ALLOC_REPS);
    if (b1 === null || bN === null) return Infinity;
    return Math.max(0, bN - b1) / ((ALLOC_REPS - 1) * ALLOC_N);
}

// ---------------------------------------------------------------- seeded data; the references share no code with a kernel
function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
}
function fnv(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
}
/** The definition: the first i in [lo, hi) with a[i] >= x, or hi if none. Visits every slot; no early exit, no halving. */
function refScan(a, lo, hi, x) {
    let first = -1;
    for (let i = hi - 1; i >= lo; i--) if (a[i] >= x) first = i;
    return first < 0 ? hi : first;
}
/** The same definition applied to every query at once over the full range [0, a.length): queries in ascending order,
 *  one monotone cursor (valid because a is non-decreasing, asserted by the caller). O(q log q + n). */
function refSweep(a, qs) {
    const idx = Array.from({ length: qs.length }, (_, i) => i);
    idx.sort((p, q) => qs[p] - qs[q]);
    const out = new Int32Array(qs.length);
    let i = 0;
    for (const j of idx) {
        const x = qs[j];
        while (i < a.length && !(a[i] >= x)) i++;
        out[j] = i;
    }
    return out;
}
function assertSorted(a, what) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== a[i]) stop('HARNESS', what + ': NaN key at ' + i);
        if (i > 0 && a[i - 1] > a[i]) stop('HARNESS', what + ': not sorted at ' + i);
    }
}
function assertNoNaN(qs, what) {
    for (let i = 0; i < qs.length; i++) if (qs[i] !== qs[i]) stop('HARNESS', what + ': NaN query at ' + i);
}
/** Comparisons a classic branchy lower bound makes over `len` keys when the answer is `pos` (index-only, no data). */
function compares(len, pos) {
    let l = 0, h = len, c = 0;
    while (l < h) {
        const m = (l + h) >>> 1;
        c++;
        if (m < pos) l = m + 1; else h = m;
    }
    return c;
}
/** Probes of the gallop-then-bracket search from hint h to answer ans in [lo, hi] (index-only: a[i] < x iff i < ans). */
function hintProbes(h, ans, lo, hi) {
    if (!(h >= lo)) h = lo;
    if (h > hi) h = hi;
    let c = 0, step = 1;
    if (h < hi) c++;
    if (h < hi && h < ans) {
        let prev = h, r = h + 1;
        for (;;) { if (!(r < hi)) break; c++; if (!(r < ans)) break; prev = r; step <<= 1; r = h + step; }
        if (r > hi) r = hi;
        return c + compares(r - prev - 1, ans - prev - 1);
    }
    let top = h, l = h - 1;
    for (;;) { if (!(l >= lo)) break; c++; if (l < ans) break; top = l; step <<= 1; l = h - step; }
    if (l < lo) l = lo - 1;
    return c + compares(top - l - 1, ans - l - 1);
}
/** Conditional search branches per op for a column (the stream rule's count; a proxy by index, never an oracle).
 *  compares() bisects on "m < pos": exact for a branchy lower bound when pos = the lower answer. A fw lane (two searches
 *  per op) doubles it in finishLane. An entry with no stated proxy is STOP HARNESS (fail closed), never a silent default. */
const BINARY_PROXY = new Set(['lowerBoundBranchyF64', 'lowerBoundBranchlessF64']);
function branchProxy(entry, len, pos, prev) {
    if (entry === 'lowerBoundHintF64') return hintProbes(prev, pos, 0, len);
    if (!BINARY_PROXY.has(entry)) stop('HARNESS', 'branchProxy: no proxy stated for ' + entry);
    return compares(len, pos);
}

// ---------------------------------------------------------------- lanes
function finishLane(lane) {
    assertNoNaN(lane.qs, lane.id);
    const brA = new Int32Array(NQ2), brB = new Int32Array(NQ2);
    for (let j = 0; j < NQ2; j++) {
        const lo = lane.los === null ? 0 : lane.los[j];
        const L = opLen(lane, j);
        const pos = lane.exp[j] - lo;
        const prev = j > 0 ? lane.exp[j - 1] : 0;
        brA[j] = branchProxy(lane.A, L, pos, prev) * lane.mul;
        brB[j] = branchProxy(lane.B, L, pos, prev) * lane.mul;
    }
    lane.brA = brA; lane.brB = brB;
    return lane;
}
/** Range length of op j: the lane's fixed len (every AB lane has lens === null). */
const opLen = (lane, j) => (lane.lens === null ? lane.len : lane.lens[j]);
/** T2 generator (P0 t2Lane body, verbatim): n sorted keys with duplicates, range [0, n). d > 0: the key position walks by
 *  exactly +-d (reflected at the ends); d = 0: uniform-random position (the control). Query = the key there or the key +
 *  0.5, coin flip. The stream seed is the lane id (own seed per lane, as P0); the array seed is 't2:a:' + n. */
function t2Stream(n, d, id) {
    const ra = rng(fnv('t2:a:' + n));
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = ra() % (n >>> 1);
    a.sort();
    assertSorted(a, 't2:' + n);
    const r = rng(fnv(id));
    const qs = new Float64Array(NQ2);
    let p = r() % n;
    for (let j = 0; j < NQ2; j++) {
        if (d === 0) p = r() % n;
        else {
            let s = (r() & 1) !== 0 ? d : -d;
            if (p + s < 0 || p + s > n - 1) s = -s;
            p += s;
        }
        qs[j] = (r() & 1) !== 0 ? a[p] : a[p] + 0.5;
    }
    const exp = refSweep(a, qs);
    for (let k = 0; k < SAMPLE; k++) {
        const j = (k * 977 + 31) % NQ2;
        const want = refScan(a, 0, n, qs[j]);
        if (exp[j] !== want) stop('ORACLE', id + ': reference sweep ' + exp[j] + ' vs definition scan ' + want + ' at op ' + j);
    }
    return { a, qs, exp };
}
/** AB1 lane = P0 T2 lane on the F64 kernels: A = branchless, B = hint. */
function t2Lane(n, d) {
    const id = d === 0 ? 'uni:' + n : 'walk:' + n + ':' + d;
    const { a, qs, exp } = t2Stream(n, d, id);
    return finishLane({
        id, rung: 'AB1', len: n, lens: null, a, los: null, qs, exp, ref: refScan, spin: SPIN_T2,
        A: 'lowerBoundBranchlessF64', B: 'lowerBoundHintF64', kindA: 'full', kindB: 'hint', n, d, mul: 1,
    });
}
const t2Ds = (n) => [1, 4, 64, n >>> 3].sort((x, y) => x - y);
/** AB2 ro:n: T2's array + uniform stream (d = 0), full range [0, n), read-only. A = branchy, B = branchless. */
function roLane(n) {
    const id = 'ro:' + n;
    const { a, qs, exp } = t2Stream(n, 0, id);
    return finishLane({
        id, rung: 'AB2', len: n, lens: null, a, los: null, qs, exp, ref: refScan, spin: SPIN_RO,
        A: 'lowerBoundBranchyF64', B: 'lowerBoundBranchlessF64', kindA: 'full', kindB: 'full', n, d: 0, mul: 1,
    });
}
/** AB2 fw:n (feeds-write, law 1): T2's array for n copied into capacity n + 1 (slot n spare, seeded with a[n - 1]),
 *  T2's uniform stream; exp = the lower bound on the UNMODIFIED n keys (p, and q after inserting x at p, both equal it).
 *  mul = 2: the fold and the branch proxy count two searches per op. */
function fwLane(n) {
    const id = 'fw:' + n;
    const s = t2Stream(n, 0, id);
    const a = new Float64Array(n + 1);
    a.set(s.a);
    a[n] = s.a[n - 1];
    return finishLane({
        id, rung: 'AB2', len: n, lens: null, a, los: null, qs: s.qs, exp: s.exp, ref: refScan, spin: spinFw(n),
        A: 'lowerBoundBranchyF64', B: 'lowerBoundBranchlessF64', kindA: 'fw', kindB: 'fw', n, d: 0, mul: 2,
    });
}
const RUNGS = {
    AB1: T2_SIZES.flatMap((n) => [{ id: 'uni:' + n, mk: () => t2Lane(n, 0) },
        ...t2Ds(n).map((d) => ({ id: 'walk:' + n + ':' + d, mk: () => t2Lane(n, d) }))]),
    AB2: [...RO_SIZES.map((n) => ({ id: 'ro:' + n, mk: () => roLane(n) })),
        ...FW_SIZES.map((n) => ({ id: 'fw:' + n, mk: () => fwLane(n) }))],
};
const RUNG_NAMES = ['AB1', 'AB2', 'ALL'];
const rungSpecs = (rung) => (rung === 'ALL' ? [...RUNGS.AB1, ...RUNGS.AB2] : RUNGS[rung]);

// ---------------------------------------------------------------- columns: fresh `new Function` per copy
function makeCols(lane, inject) {
    const a = block(lane.A);
    let b = block(lane.B);
    if (inject === 'bent-oracle') {
        if (!Object.hasOwn(BENDS, lane.B)) stop('ANCHOR', 'bent-oracle: no bend stated for B entry ' + lane.B);
        // bend lane B's OWN text (not a DEP's), then prepend its DEPS
        b = block(lane.B, sub1('bent-oracle ' + lane.B, KTEXT[lane.B], BENDS[lane.B][0], BENDS[lane.B][1]));
    }
    if (inject === 'boxed') b = boxed(b, lane.B);
    // T4 selftest bend: every column of a fw lane deletes up to len / hi instead of len + 1 / hi + 1 (compileColumn)
    const bd = inject === 'fw-delete-end';
    if (bd && (lane.kindA !== 'fw' || lane.kindB !== 'fw')) stop('ANCHOR', 'fw-delete-end: lane ' + lane.id + ' has no fw runner');
    return [
        { id: 'A', entry: lane.A, kind: lane.kindA, block: a, bendDelete: bd },
        { id: 'B', entry: lane.B, kind: lane.kindB, block: b, bendDelete: bd },
        { id: 'AA', entry: lane.A, kind: lane.kindA, block: inject === 'aa-drift' ? spinned(a, lane.A, lane.spin) : a, bendDelete: bd },
        { id: 'SLOW', entry: lane.A, kind: lane.kindA, block: inject === 'slow-dead' ? a : spinned(a, lane.A, lane.spin), bendDelete: bd },
    ];
}
let NONCE = 0;
function compileColumn(col, tag) {
    const E = col.entry;
    const head = 'function run(a, los, lens, len, qs, start, n, reps, h0) { let acc = 0; const end = start + n; ';
    let run, one;
    if (col.kind === 'full') run = head + 'for (let p = 0; p < reps; p++) for (let i = start; i < end; i++) { acc = (acc + ' + E + '(a, 0, len, qs[i])) | 0; } return acc; }';
    else if (col.kind === 'hint') run = head + 'let h = h0; for (let p = 0; p < reps; p++) for (let i = start; i < end; i++) { const r = ' + E + '(a, 0, len, qs[i], h); h = r; acc = (acc + r) | 0; } return acc; }';
    // fw: insert x at its lower bound p, search again (q), delete at q; the array returns to its start state when q === p
    else if (col.kind === 'fw') run = head + 'for (let rp = 0; rp < reps; rp++) for (let i = start; i < end; i++) { const x = qs[i]; const p = ' + E + '(a, 0, len, x); a.copyWithin(p + 1, p, len); a[p] = x; const q = ' + E + '(a, 0, len + 1, x); a.copyWithin(q, q + 1, len + 1); acc = (acc + p + q) | 0; } return acc; }';
    else stop('HARNESS', 'runner kind ' + col.kind);
    if (col.kind === 'fw') one = 'function one(a, lo, hi, x, h) { const p = ' + E + '(a, lo, hi, x); a.copyWithin(p + 1, p, hi); a[p] = x; const q = ' + E + '(a, lo, hi + 1, x); a.copyWithin(q, q + 1, hi + 1); return q === p ? p : -1; }';
    else one = 'function one(a, lo, hi, x, h) { return ' + E + (col.kind === 'hint' ? '(a, lo, hi, x, h); }' : '(a, lo, hi, x); }');
    if (col.bendDelete === true) {
        run = sub1('fw-delete-end run', run, 'a.copyWithin(q, q + 1, len + 1)', 'a.copyWithin(q, q + 1, len)');
        one = sub1('fw-delete-end one', one, 'a.copyWithin(q, q + 1, hi + 1)', 'a.copyWithin(q, q + 1, hi)');
    }
    const src = '"use strict"; // ab-lab #' + (NONCE++) + ' ' + tag + '\n' + col.block + '\n' + run + '\n' + one + '\nreturn { run, one };';
    return new Function(src)();
}
function buildEntry(col, copy, lane) {
    const { run, one } = compileColumn(col, lane.id + ' ' + col.id + '#' + copy);
    return {
        col: col.id, copy, run, one,
        a: lane.a.slice(), qs: lane.qs.slice(), los: lane.los === null ? new Int32Array(1) : lane.los.slice(),
        lens: lane.lens === null ? new Int32Array(1) : lane.lens.slice(), ns: null,
    };
}
// ---------------------------------------------------------------- self-checks
function checkOracle(e, lane) {
    let h = 0;
    for (let j = 0; j < NQ2; j++) {
        const lo = lane.los === null ? 0 : e.los[j];
        const got = e.one(e.a, lo, lo + opLen(lane, j), e.qs[j], h);
        if (got !== lane.exp[j]) stop('ORACLE', lane.id + ' ' + e.col + '#' + e.copy + ' op ' + j + ' got ' + got + ' want ' + lane.exp[j] + ' (x ' + e.qs[j] + ', lo ' + lo + ')');
        h = got;
    }
    return NQ2;
}
/** After timing: a sample of ops against a FRESH definition scan (not the stored exp), with the stream's own hint. */
function sampleRefs(lane) {
    const out = new Int32Array(SAMPLE);
    for (let k = 0; k < SAMPLE; k++) {
        const j = (k * 1009 + 7) % NQ2;
        const lo = lane.los === null ? 0 : lane.los[j];
        out[k] = lane.ref(lane.a, lo, lo + opLen(lane, j), lane.qs[j]);
    }
    return out;
}
function checkSample(e, lane, refs, where) {
    for (let k = 0; k < SAMPLE; k++) {
        const j = (k * 1009 + 7) % NQ2;
        const lo = lane.los === null ? 0 : e.los[j];
        const h = j > 0 ? lane.exp[j - 1] : 0;
        const got = e.one(e.a, lo, lo + opLen(lane, j), e.qs[j], h);
        if (got !== refs[k]) stop('ORACLE', lane.id + ' ' + e.col + '#' + e.copy + ' sample (' + where + ') op ' + j + ' got ' + got + ' want ' + refs[k]);
    }
    return SAMPLE;
}
/** Every lane: the copy's live range [0, len) equals the lane's start array byte for byte (a read-only lane never writes;
 *  a fw op must restore it). Slot len of a fw array (capacity n + 1) is scratch by construction and not compared. */
function checkArr(e, lane, where) {
    const n8 = lane.len * 8;
    const got = new Uint8Array(e.a.buffer, e.a.byteOffset, n8), want = new Uint8Array(lane.a.buffer, lane.a.byteOffset, n8);
    for (let i = 0; i < n8; i++) {
        if (got[i] !== want[i]) stop('ORACLE', lane.id + ' ' + e.col + '#' + e.copy + ' array (' + where + ') differs from its start copy at byte ' + i + ' (key ' + (i >>> 3) + ': ' + e.a[i >>> 3] + ' vs ' + lane.a[i >>> 3] + ')');
    }
    return lane.len;
}
/** T4 (FILLER M1): in fw:16 / fw:128 the top two keys of the timed array are equal, so a delete ending at len (not
 *  len + 1) leaves the live range unchanged and no other check sees it. UNTIMED, before TF: every copy's fw runner runs
 *  once (VARIANT_N ops from op 0, reps 1) over a VARIANT of the lane's start array: keys [0, n - 1) as the lane, key
 *  n - 1 = key n - 2 + 1 (the top two keys differ; still sorted), spare slot n = key n - 1. The live range [0, n) must
 *  come back byte for byte, and the fold must equal mul x the sum of the definition sweep (refSweep, no kernel code) of
 *  the variant. The timed arrays and streams are not touched (the gated words were measured on them). */
function fwVariantCheck(lane, entries) {
    if (lane.kindA !== 'fw' || lane.kindB !== 'fw') return;
    const n = lane.len;
    const v = new Float64Array(n + 1);
    v.set(lane.a.subarray(0, n));
    v[n - 1] = v[n - 2] + 1;
    v[n] = v[n - 1];
    assertSorted(v.subarray(0, n), lane.id + ' fw variant');
    if (!(v[n - 1] > v[n - 2])) stop('HARNESS', lane.id + ' fw variant: top two keys not distinct');
    const exp = refSweep(v.subarray(0, n), lane.qs.subarray(0, VARIANT_N));
    const want = Math.imul(windowSum(exp, 0, VARIANT_N), lane.mul);
    const n8 = n * 8, vb = new Uint8Array(v.buffer, 0, n8);
    for (const e of entries) {
        const w = v.slice();
        const got = e.run(w, e.los, e.lens, n, e.qs, 0, VARIANT_N, 1, 0);
        const wb = new Uint8Array(w.buffer, 0, n8);
        for (let i = 0; i < n8; i++) {
            if (wb[i] !== vb[i]) stop('ORACLE', lane.id + ' ' + e.col + '#' + e.copy + ' fw variant (top two keys distinct): array differs from its start at byte ' + i + ' (key ' + (i >>> 3) + ': ' + w[i >>> 3] + ' vs ' + v[i >>> 3] + ')');
        }
        if (got !== want) stop('ORACLE', lane.id + ' ' + e.col + '#' + e.copy + ' fw variant (top two keys distinct): fold got ' + got + ' want ' + want);
    }
    say('ORACLE fw-variant lane=' + lane.id + gateTag(lane.id) + ' copies=' + entries.length + ' ops=' + VARIANT_N + ' keys[' + (n - 2) + '..' + (n - 1) + ']=' + v[n - 2] + ',' + v[n - 1] + ' (timed array: ' + lane.a[n - 2] + ',' + lane.a[n - 1] + ') array + fold ok');
}
function windowSum(exp, start, n) {
    let acc = 0;
    for (let i = start; i < start + n; i++) acc = (acc + exp[i]) | 0;
    return acc;
}
/** fw folds p + q per op (both equal exp): 2 x sum(exp) x reps, int32 wrap like the run. */
const foldWant = (lane, start, n, reps) => Math.imul(Math.imul(windowSum(lane.exp, start, n), lane.mul), reps);
const h0Of = (lane, start) => (lane.kindB === 'hint' && start > 0 ? lane.exp[start - 1] : 0);
function verifyRun(e, got, want, lane, where) {
    if (got !== want) stop('ORACLE', lane.id + ' ' + e.col + '#' + e.copy + ' fold (' + where + '): got ' + got + ' want ' + want);
}
function callRun(e, lane, start, n, reps) { return e.run(e.a, e.los, e.lens, lane.len, e.qs, start, n, reps, h0Of(lane, start)); }
function toTf(e, lane) {
    const want = foldWant(lane, 0, TF_N, 1);
    let m = 0;
    do { verifyRun(e, callRun(e, lane, 0, TF_N, 1), want, lane, 'tf'); m++; }
    while (m < TF_TRIES && (optStatus(e.run) & TF_BIT) === 0);
    if ((optStatus(e.run) & TF_BIT) === 0) { forceOpt(e.run); verifyRun(e, callRun(e, lane, 0, TF_N, 1), want, lane, 'tf-forced'); }
    const wantAll = foldWant(lane, 0, NQ, 1);
    for (let a = 0; a < SETTLE_TRIES; a++) {
        verifyRun(e, callRun(e, lane, 0, NQ, 1), wantAll, lane, 'settle');
        if ((optStatus(e.run) & TF_BIT) !== 0) return true;
        forceOpt(e.run);
    }
    return (optStatus(e.run) & TF_BIT) !== 0;
}
function sizeWindow(e, lane) {
    let n = MIN_N, reps = 1;
    for (;;) {
        const t0 = performance.now();
        callRun(e, lane, 0, n, reps);
        const dt = performance.now() - t0;
        if (dt >= TARGET_MS) break;
        if (n < NQ) { n = Math.min(NQ, n * 2); continue; }
        if (reps >= MAX_REPS) break;
        reps *= 2;
    }
    return { n, reps };
}
const roundStart = (r) => Math.imul(r + 1, 39313) & (NQ - 1);
/** Distinct conditional search branches in a window: the smaller of the two columns' proxies (reps add no new ops). */
function windowBranches(lane, start, n) {
    let a = 0, b = 0;
    for (let i = start; i < start + n; i++) { a += lane.brA[i]; b += lane.brB[i]; }
    return Math.min(a, b);
}
function shuffled(arr, r) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = r() % (i + 1);
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}
function buildEntries(lane, cols) {
    const r = rng(fnv('order:' + lane.id));
    const entries = [];
    for (const c of cols) for (let i = 0; i < C_COPIES; i++) entries.push(buildEntry(c, i, lane));
    return shuffled(entries, r);
}

// ---------------------------------------------------------------- oracle-only lane (no clock)
function oracleLane(lane, cols, K) {
    const entries = buildEntries(lane, cols);
    let ops = 0, keys = 0;
    for (const e of entries) ops += checkOracle(e, lane);
    for (const e of entries) keys += checkArr(e, lane, 'after the oracle pass');
    fwVariantCheck(lane, entries);
    let tf = 0;
    const tfBad = [];
    for (const e of entries) {
        verifyRun(e, callRun(e, lane, 0, NQ, 1), foldWant(lane, 0, NQ, 1), lane, 'oracle-only fold');
        if (toTf(e, lane)) tf++;
        // the TF'd run once more at the lane's own (timed) length; the tier must hold (P0's post-probe check, no arms here)
        verifyRun(e, callRun(e, lane, 0, NQ, 1), foldWant(lane, 0, NQ, 1), lane, 'oracle-only fold after TF');
        if ((optStatus(e.run) & TF_BIT) === 0) tfBad.push(e.col + '#' + e.copy);
    }
    for (const e of entries) keys += checkArr(e, lane, 'after the TF folds');
    const refs = sampleRefs(lane);
    for (const e of entries) ops += checkSample(e, lane, refs, 'oracle-only');
    for (const e of entries) keys += checkArr(e, lane, 'after the sample');
    let minBranches = Infinity;
    for (let x = 0; x < K; x++) { const b = windowBranches(lane, roundStart(x), MIN_N); if (b < minBranches) minBranches = b; }
    const voids = [];
    if (!(minBranches >= MIN_BRANCHES)) voids.push('STREAM ' + minBranches + ' < ' + MIN_BRANCHES + ' branches at the shortest window (' + MIN_N + ' ops)');
    if (tfBad.length > 0) voids.push('NOT-TF after the oracle-only folds: ' + tfBad.join(','));
    say('ORACLE lane=' + lane.id + gateTag(lane.id) + ' A=' + lane.A + ' B=' + lane.B + ' kind=' + lane.kindA + '/' + lane.kindB +
        ' copies=' + entries.length + ' ops-checked=' + ops + ' fold ok tf=' + tf + '/' + entries.length +
        ' tf-after-fold=' + (entries.length - tfBad.length) + '/' + entries.length + ' array-keys-compared=' + keys +
        ' branches@' + MIN_N + '=' + minBranches + (voids.length > 0 ? ' VOID=[' + voids.join('; ') + ']' : ' ok'));
    for (const v of voids) say('VOID ' + v.split(' ')[0] + ' lane=' + lane.id + ': ' + v);
    return { lane: lane.id, gated: isGated(lane.id), voids, ops };
}

// ---------------------------------------------------------------- timed lane
async function runLane(lane, cols, K) {
    const entries = buildEntries(lane, cols);
    for (const e of entries) e.ns = new Float64Array(K);
    for (const e of entries) checkOracle(e, lane);
    for (const e of entries) checkArr(e, lane, 'after the oracle pass');
    fwVariantCheck(lane, entries);
    for (const e of entries) toTf(e, lane);
    for (let w = 0; w < WARM_ROUNDS; w++) {
        const st = roundStart(w + 1000), want = foldWant(lane, st, WARM_N, 1);
        for (const e of entries) verifyRun(e, callRun(e, lane, st, WARM_N, 1), want, lane, 'warm');
    }
    // one reps = 2 call per copy: feeds the rep-boundary input (hint h = exp[end - 1] for qs[start]) before any timed window
    const st2 = roundStart(1000 + WARM_ROUNDS), want2 = foldWant(lane, st2, WARM_N, 2);
    for (const e of entries) verifyRun(e, callRun(e, lane, st2, WARM_N, 2), want2, lane, 'warm reps=2');
    const { n, reps } = sizeWindow(entries.find((e) => e.col === 'A'), lane);
    const starts = new Int32Array(K), wants = new Int32Array(K), h0s = new Int32Array(K);
    let minBranches = Infinity;
    for (let x = 0; x < K; x++) {
        starts[x] = roundStart(x);
        wants[x] = foldWant(lane, starts[x], n, reps);
        h0s[x] = h0Of(lane, starts[x]);
        const b = windowBranches(lane, starts[x], n);
        if (b < minBranches) minBranches = b;
    }
    const voids = [];
    if (!(minBranches >= MIN_BRANCHES)) voids.push('STREAM ' + minBranches + ' < ' + MIN_BRANCHES + ' branches');
    const tierStart = entries.map((e) => (optStatus(e.run) & TF_BIT) !== 0);
    const N = entries.length, len = lane.len;
    const tfBad = new Uint8Array(N);
    const w = await gcWindow(() => {
        for (let x = 0; x < K; x++) {
            const st = starts[x], want = wants[x], h0 = h0s[x];
            for (let y = 0; y < N; y++) {
                const e = entries[(y + x) % N];
                const t0 = performance.now();
                const got = e.run(e.a, e.los, e.lens, len, e.qs, st, n, reps, h0);
                const t1 = performance.now();
                if (got !== want) verifyRun(e, got, want, lane, 'timed');
                e.ns[x] = (t1 - t0) * 1e6 / (n * reps);
            }
            // tier after EACH round, outside the clock
            for (let y = 0; y < N; y++) if ((optStatus(entries[y].run) & TF_BIT) === 0) tfBad[y] = 1;
        }
    });
    const tierEnd = entries.map((e) => (optStatus(e.run) & TF_BIT) !== 0);
    if (w.major !== 0) voids.push('GC-WINDOW major ' + w.major);
    for (const e of entries) checkArr(e, lane, 'after timing');
    const refs = sampleRefs(lane);
    for (const e of entries) checkSample(e, lane, refs, 'after timing');
    const bop = {};
    for (const e of entries) {
        const b = allocBop(e, lane);
        if (!(e.col in bop) || b > bop[e.col]) bop[e.col] = b;
    }
    for (const e of entries) checkArr(e, lane, 'after the sample and the B/op lane');
    for (const c in bop) if (!(bop[c] < ALLOC_MAX)) voids.push('ALLOC ' + c + ' ' + fmt(bop[c], 3) + ' B/op');
    const notTf = entries.filter((e, i) => !tierStart[i] || !tierEnd[i] || tfBad[i] !== 0).map((e) => e.col + '#' + e.copy);
    if (notTf.length > 0) voids.push('NOT-TF ' + notTf.join(','));

    const rounds = {};
    for (const c of cols) {
        const es = entries.filter((e) => e.col === c.id);
        const out = new Array(K);
        for (let x = 0; x < K; x++) out[x] = summarize(es.map((e) => e.ns[x])).med;
        rounds[c.id] = out;
        if (out.some((v) => !Number.isFinite(v))) voids.push('NAN ' + c.id);
    }
    const ratio = summarize(ratioVec(rounds.B, rounds.A));
    const delta = summarize(diffVec(rounds.B, rounds.A));
    const aa = summarize(ratioVec(rounds.AA, rounds.A));
    const slow = summarize(ratioVec(rounds.SLOW, rounds.A));
    if (!aaOk(aa)) voids.push('AA-DRIFT ' + fmtS(aa, 3));
    if (!slowOk(slow)) voids.push('SLOW-DEAD ' + fmtS(slow, 3));
    const ns = {};
    for (const c of cols) ns[c.id] = summarize(rounds[c.id]);
    const row = { lane: lane.id, gated: isGated(lane.id), n: lane.n, d: lane.d, ratio, delta, aa, slow, ns, bop, win: n, reps, minBranches, voids, word: word(ratio) };
    say('RESULT lane=' + lane.id + gateTag(lane.id) + ' A=' + fmtS(ns.A, 2) + ' B=' + fmtS(ns.B, 2) + ' ns/op' +
        ' B/A=' + fmtS(ratio, 3) + ' word=' + row.word + ' B-A=' + fmtS(delta, 2) + 'ns' +
        ' aa=' + fmtS(aa, 3) + ' slow=' + fmtS(slow, 3) +
        ' bop=' + Object.keys(bop).map((c) => c + ':' + fmt(bop[c], 4)).join(',') +
        ' win=' + n + ' reps=' + reps + ' branches=' + minBranches +
        (voids.length > 0 ? ' VOID=[' + voids.join('; ') + ']' : ''));
    // RAW (INTAKE R0 d): the K per-round ratios in round order, for offline K-subsampling (R3, untimed)
    const raw = (num) => ratioVec(rounds[num], rounds.A).map((v) => fmt(v, 4)).join(',');
    say('RAW lane=' + lane.id + ' B/A=' + raw('B') + ' AA=' + raw('AA') + ' SLOW=' + raw('SLOW'));
    for (const v of voids) say('VOID ' + v.split(' ')[0] + ' lane=' + lane.id + ': ' + v);
    return row;
}

// ---------------------------------------------------------------- rung rules (printed exactly as the INTAKE words them)
const clean = (x) => x !== undefined && x.voids.length === 0;
/** INTAKE R1 margin: the smaller of |median - threshold| and |q1 or q3 - 1| for the lane's word. WITHIN has no INTAKE
 *  margin: it prints its distance to each word (both conditions of a word must be crossed, hence max). */
function marginText(x) {
    const s = x.ratio;
    if (x.word === 'SLOWER') return fmt(Math.min(Math.abs(s.med - AA_HI), Math.abs(s.q1 - 1)), 3);
    if (x.word === 'FASTER') return fmt(Math.min(Math.abs(s.med - AA_LO), Math.abs(s.q3 - 1)), 3);
    return 'WITHIN(toS=' + fmt(Math.max(AA_HI - s.med, 1 - s.q1), 3) + ',toF=' + fmt(Math.max(s.med - AA_LO, s.q3 - 1), 3) + ')';
}
function laneLine(tag, x, extra) {
    if (x === undefined) return tag + ' (not run)' + extra;
    if (!clean(x)) return tag + ' VOID (' + x.voids.map((v) => v.split(' ')[0]).join(',') + ')' + extra;
    return tag + ' ' + x.word + ' ' + fmtS(x.ratio, 3) + ' margin=' + marginText(x) + extra;
}
const AB1_KILL = [...T2_SIZES.map((n) => 'uni:' + n), ...T2_SIZES.flatMap((n) => ['walk:' + n + ':1', 'walk:' + n + ':4'])];
const c5Word = (id) => (id.startsWith('uni:') || id.startsWith('walk:256:') ? 'SLOWER' : 'FASTER');
function ruleAB1(rows, K) {
    say('AB1-RULE ' + RULE_AB1);
    say('AB1-RULE ' + CTRL_T2);
    say('AB1-RULE ' + MARGIN_TXT);
    const uniFast = T2_SIZES.map((n) => rows.find((x) => x.lane === 'uni:' + n)).filter((x) => clean(x) && x.word === 'FASTER');
    if (uniFast.length > 0) stop('HARNESS', 'hint FASTER on the uniform control at ' + uniFast.map((x) => x.lane + ' ' + fmt(x.ratio.med, 3)).join(', '));
    const kill = AB1_KILL.map((id) => rows.find((x) => x.lane === id));
    for (let i = 0; i < AB1_KILL.length; i++) say(laneLine('AB1-RULE lane=' + AB1_KILL[i], kill[i], ' (C5 ' + c5Word(AB1_KILL[i]) + ')'));
    const missing = AB1_KILL.filter((id, i) => kill[i] === undefined);
    const voided = kill.filter((x) => x !== undefined && x.voids.length > 0).map((x) => x.lane);
    if (missing.length > 0) say('AB1-RULE UNRULED: not every kill-rule lane ran (missing ' + missing.join(',') + ')');
    else if (voided.length > 0) say('AB1-RULE UNRULED: a kill-rule lane is VOID (' + voided.join(',') + '; no verdict, maintainer)');
    else if (K !== K_FULL) say('AB1-RULE UNRULED: K=' + K + ' is not the INTAKE K=' + K_FULL);
    else {
        const differs = kill.filter((x) => x.word !== c5Word(x.lane));
        if (differs.length === 0) say('AB1-RULE C5 REPRODUCED');
        else {
            say('AB1-RULE C5 DIFFERS at ' + differs.map((x) => x.lane).join(','));
            say('AB1-RULE differing words: ' + differs.map((x) => x.lane + ' ' + x.word + ' vs C5 ' + c5Word(x.lane)).join(', ') + ' (a FINDING, never re-run for agreement)');
        }
    }
    say('AB1-REPORT ' + REPORT_T2);
    for (const n of T2_SIZES) {
        const ws = t2Ds(n).map((d) => rows.find((x) => x.lane === 'walk:' + n + ':' + d)).filter((x) => x !== undefined);
        const stopAt = ws.find((x) => !clean(x) || x.word !== 'FASTER');
        say('AB1-REPORT n=' + n + ': ' + ws.map((x) => 'd=' + x.d + ' ' + (clean(x) ? x.word + ' ' + fmt(x.ratio.med, 3) : 'VOID')).join(', ') +
            ' -> stops winning at ' + (stopAt === undefined ? 'no d run' : 'd=' + stopAt.d + (clean(stopAt) ? '' : ' (VOID)')));
    }
}
/** INTAKE R2, two halves ruled separately: a missing / VOID lane or K != 11 makes THAT half UNRULED. */
function ruleAB2(rows, K) {
    say('AB2-RULE ' + RULE_AB2_RO);
    say('AB2-RULE ' + RULE_AB2_FW);
    say('AB2-RULE ' + MARGIN_TXT);
    for (const [half, p, sizes] of [['RO', 'ro:', RO_SIZES], ['FW', 'fw:', FW_SIZES]]) {
        const ids = sizes.map((n) => p + n);
        const xs = ids.map((id) => rows.find((x) => x.lane === id));
        for (let i = 0; i < ids.length; i++) say(laneLine('AB2-' + half + ' lane=' + ids[i], xs[i], ''));
        const missing = ids.filter((id, i) => xs[i] === undefined);
        const voided = xs.filter((x) => x !== undefined && x.voids.length > 0).map((x) => x.lane);
        if (missing.length > 0) say('AB2-' + half + ' UNRULED: not every lane of the half ran (missing ' + missing.join(',') + ')');
        else if (voided.length > 0) say('AB2-' + half + ' UNRULED: a kill-rule lane is VOID (' + voided.join(',') + '; no verdict, maintainer)');
        else if (K !== K_FULL) say('AB2-' + half + ' UNRULED: K=' + K + ' is not the INTAKE K=' + K_FULL);
        else if (half === 'RO') {
            const slowAt = xs.filter((x) => x.word === 'SLOWER').map((x) => x.lane);
            say(slowAt.length === 0 ? 'AB2-RO default stands' : 'AB2-RO SLOWER at ' + slowAt.join(',') + ' (a FINDING for Q-AB-README)');
        } else {
            const fastAt = xs.filter((x) => x.word === 'FASTER').map((x) => x.lane);
            const slowAt = xs.filter((x) => x.word === 'SLOWER').map((x) => x.lane);
            if (fastAt.length > 0) say('AB2-FW I1 CONTRADICTED at ' + fastAt.join(',') + ' (a FINDING for Q-AB-FEEDSWRITE)');
            else if (slowAt.length >= 2) say('AB2-FW I1 REPRODUCED (SLOWER at ' + slowAt.join(',') + ')');
            else say('AB2-FW I1 NOT SHOWN (SLOWER at ' + (slowAt.length > 0 ? slowAt.join(',') : 'none') + '; a FINDING for Q-AB-FEEDSWRITE)');
        }
    }
}

// ---------------------------------------------------------------- T2: the verdict (ONE function: live run + --verdict-file)
// It reads only printed lines: lane ids, VOID tags / lines and the RESULT numbers. It never reads a lane's
// "(gated)" / "(kill-rule)" / "(report)" tag, a rule block, a REPORTED or a VERDICT line.
const HEAD_RE = /^HEADER rung=(\S+) (TIMED|ORACLE-ONLY \(no clock\)) node (\S+)(?: arch (\S+))? v8 (\S+) cpu (.+) K=(\S+) C=(\S+) NQ2=(\S+) minWindow=(\S+) inject=(\S+)$/;
const RESULT_RE = /^RESULT lane=(\S+) /;
const VOIDLINE_RE = /^VOID (\S+) lane=(\S+): /;
const NUM_RE = /^-?\d+(\.\d+)?$/;
const BOP_COLS = Object.freeze(['A', 'B', 'AA', 'SLOW']);
/** Strict number from printed text: '', 'NaN', 'Infinity' or any other text -> NaN (null is not zero). */
const num = (s) => (typeof s === 'string' && NUM_RE.test(s) ? Number(s) : NaN);
/** The value of ` <key>=` (up to the next space); null unless the key occurs exactly once in the line. */
function field(line, key) {
    const k = ' ' + key + '=';
    const i = line.indexOf(k);
    if (i < 0 || line.indexOf(k, i + 1) >= 0) return null;
    const rest = line.slice(i + k.length), sp = rest.indexOf(' ');
    return sp < 0 ? rest : rest.slice(0, sp);
}
/** `med[q1..q3]` as printed by fmtS; anything else -> all NaN. */
function stat3(s) {
    const m = s === null ? null : /^([^[\]]*)\[([^[\]]*)\.\.([^[\]]*)\]$/.exec(s);
    return m === null ? { med: NaN, q1: NaN, q3: NaN } : { med: num(m[1]), q1: num(m[2]), q3: num(m[3]) };
}
/** One lane from its single RESULT line: CLEAN = no VOID tag, no VOID line, and the controls + word recomputed from the
 *  printed numbers (a recomputed-control failure without a VOID tag is not clean). */
function laneState(id, line, voidKinds) {
    const why = [];
    const vt = line.indexOf(' VOID=[');
    if (vt >= 0) why.push('VOID(' + line.slice(vt + 7).split('; ').map((v) => v.split(/[\s\]]/)[0]).join(',') + ')');
    if (voidKinds.has(id)) why.push('VOID-line(' + voidKinds.get(id).join(',') + ')');
    const ratio = stat3(field(line, 'B/A'));
    const printed = field(line, 'word');
    const aa = stat3(field(line, 'aa')), slow = stat3(field(line, 'slow'));
    if (!(Number.isFinite(ratio.med) && Number.isFinite(ratio.q1) && Number.isFinite(ratio.q3))) why.push('B/A not finite');
    if (!aaOk(aa)) why.push('aa ' + fmtS(aa, 3) + ' not in [' + AA_LO + ', ' + AA_HI + ']');
    if (!slowOk(slow)) why.push('slow ' + fmtS(slow, 3) + ' not med > 1.25 and q1 > 1.10');
    const bopTxt = field(line, 'bop');
    const bops = bopTxt === null ? [] : bopTxt.split(',');
    const seen = new Set();
    let bopOk = bops.length === BOP_COLS.length;
    for (const b of bops) {
        const kv = b.split(':');
        if (kv.length !== 2 || !BOP_COLS.includes(kv[0]) || seen.has(kv[0]) || !(num(kv[1]) < ALLOC_MAX)) bopOk = false;
        seen.add(kv[0]);
    }
    if (!bopOk) why.push('bop ' + bopTxt + ' not A, B, AA, SLOW each < 1/64');
    const w = word(ratio);
    if (printed !== w) why.push('printed word=' + printed + ' but B/A ' + fmtS(ratio, 3) + ' reads ' + w);
    return { id, word: printed, ratio, clean: why.length === 0, why };
}
const laneTxt = (s) => s.id + ' ' + s.word + ' ' + fmtS(s.ratio, 3);
/** lines -> { verdict, code, text, reported }. code: 0 PASS | 2 NO VERDICT | 3 FINDING (a STOP / CRASH in THIS process
 *  is mapped to exit 1 by the handler; a STOP line inside a read log is NO VERDICT 2). */
function verdictOf(lines) {
    const ids = rungSpecs('ALL').map((s) => s.id);
    const shape = [];
    let cpu = '?', arch = 'not printed', nodeV = '?';
    const heads = lines.filter((l) => l.startsWith('HEADER rung='));
    if (heads.length !== 1) shape.push(heads.length + ' HEADER rung= lines (want 1)');
    else {
        const m = HEAD_RE.exec(heads[0]);
        if (m === null) shape.push('HEADER rung= line unparsed');
        else {
            nodeV = m[3]; if (m[4] !== undefined) arch = m[4]; cpu = m[6];
            if (m[1] !== 'ALL') shape.push('rung=' + m[1] + ' (want ALL)');
            if (m[2] !== 'TIMED') shape.push('not TIMED');
            if (m[7] !== String(K_FULL)) shape.push('K=' + m[7] + ' (want ' + K_FULL + ')');
            if (m[8] !== String(C_COPIES)) shape.push('C=' + m[8] + ' (want ' + C_COPIES + ')');
            if (m[11] !== 'null') shape.push('inject=' + m[11] + ' (want null)');
        }
    }
    const stops = lines.filter((l) => l.startsWith('STOP ') || l.startsWith('CRASH '));
    for (const l of stops) shape.push(l.startsWith('CRASH ') ? 'CRASH' : 'STOP ' + l.slice(5).split(':')[0]);
    const provEnd = lines.filter((l) => l.startsWith('PROV end ')).length;
    if (provEnd !== 1) shape.push(provEnd + ' PROV end lines (want 1)');
    const res = new Map(), unknown = [];
    const voidKinds = new Map();
    for (const l of lines) {
        const r = RESULT_RE.exec(l);
        if (r !== null) {
            if (!ids.includes(r[1])) unknown.push(r[1]);
            else if (res.has(r[1])) res.get(r[1]).push(l);
            else res.set(r[1], [l]);
        }
        const v = VOIDLINE_RE.exec(l);
        if (v !== null) { if (!voidKinds.has(v[2])) voidKinds.set(v[2], []); voidKinds.get(v[2]).push(v[1]); }
    }
    if (unknown.length > 0) shape.push('RESULT for unknown lane(s) ' + unknown.join(','));
    const missing = ids.filter((id) => !res.has(id)), dup = ids.filter((id) => res.has(id) && res.get(id).length !== 1);
    if (missing.length > 0) shape.push('no RESULT for ' + missing.length + ' lane(s) ' + missing.join(','));
    if (dup.length > 0) shape.push('several RESULT lines for ' + dup.join(','));
    const st = new Map();
    for (const id of ids) if (res.has(id) && res.get(id).length === 1) st.set(id, laneState(id, res.get(id)[0], voidKinds));
    const gatedIds = Object.keys(GATED);
    const wrong = gatedIds.filter((id) => st.has(id) && st.get(id).clean && st.get(id).word !== GATED[id]);
    const notClean = gatedIds.filter((id) => !st.has(id) || !st.get(id).clean);
    const wrongTxt = wrong.map((id) => laneTxt(st.get(id)) + ' expected ' + GATED[id]).join(', ');
    const ncTxt = notClean.map((id) => (st.has(id) ? id + ' ' + st.get(id).why.join(' + ') : id + ' missing')).join(', ');
    const tail = ' | cpu ' + cpu + ' | arch ' + arch + ' | node ' + nodeV;
    const reported = 'REPORTED (never read by the verdict) ' + ids.filter((id) => !isGated(id)).map((id) => (!st.has(id) ? id + ' missing'
        : st.get(id).clean ? laneTxt(st.get(id)) : laneTxt(st.get(id)) + ' NOT-CLEAN ' + st.get(id).why.join(' + '))).join(', ');
    const clean = gatedIds.length - notClean.length;
    if (shape.length > 0) {
        const head = stops.length > 0 ? shape.find((s) => s === 'CRASH' || s.startsWith('STOP ')) : 'run shape';
        return { verdict: 'NO VERDICT', code: 2, reported,
            text: 'VERDICT NO VERDICT (' + head + ') shape=[' + shape.join('; ') + ']' + (wrong.length > 0 ? ' wrong-gated=[' + wrongTxt + ']' : '') +
                ' gated-clean=' + clean + '/' + gatedIds.length + tail };
    }
    if (wrong.length > 0) {
        return { verdict: 'FINDING', code: 3, reported,
            text: 'VERDICT FINDING wrong-gated=[' + wrongTxt + ']' + (notClean.length > 0 ? ' not-clean=[' + ncTxt + ']' : '') +
                ' gated-clean=' + clean + '/' + gatedIds.length + tail };
    }
    if (notClean.length > 0) {
        return { verdict: 'NO VERDICT', code: 2, reported,
            text: 'VERDICT NO VERDICT (gated lane not clean) not-clean=[' + ncTxt + '] gated-clean=' + clean + '/' + gatedIds.length + tail };
    }
    return { verdict: 'PASS', code: 0, reported,
        text: 'VERDICT PASS gated=' + gatedIds.length + '/' + gatedIds.length + ' clean, every word as expected' + tail };
}

// ---------------------------------------------------------------- provenance, CLI, selftest
function provenance(tag) {
    const la = os.loadavg().map((x) => x.toFixed(2)).join(' ');
    let busy = '';
    try {
        const out = execFileSync('ps', ['-Ao', 'pcpu=,pid=,comm='], { encoding: 'utf8' });
        busy = out.split('\n').map((l) => l.trim()).filter((l) => l && /(^|\/)node( |$)/.test(l.split(/\s+/).slice(2).join(' ')) && Number(l.split(/\s+/)[0]) >= 10 && Number(l.split(/\s+/)[1]) !== process.pid).join(' | ');
    } catch (e) { busy = 'ps failed: ' + e.message; }
    say('PROV ' + tag + ' ' + new Date().toISOString() + ' load ' + la + ' busy-node [' + busy + ']');
}
function parseCli(argv) {
    const o = { rung: null, lanes: null, K: K_FULL, kGiven: false, selftest: false, oracleOnly: false, verdictFile: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--selftest') { o.selftest = true; continue; }
        if (a === '--oracle-only') { o.oracleOnly = true; continue; }
        const v = argv[++i];
        if (v === undefined) stop('CLI', a + ' needs a value');
        if (a === '--rung') o.rung = v;
        else if (a === '--lanes') o.lanes = v.split(',');
        else if (a === '--K') { o.K = Number(v); o.kGiven = true; }
        else if (a === '--verdict-file') o.verdictFile = v;
        else stop('CLI', 'unknown flag ' + a);
    }
    if (o.verdictFile !== null && (o.selftest || o.oracleOnly || o.rung !== null || o.lanes !== null || o.kGiven)) stop('CLI', '--verdict-file takes no other flag');
    if (o.selftest && (o.oracleOnly || o.rung !== null || o.lanes !== null)) stop('CLI', '--selftest takes no other flag');
    if (!o.selftest && o.verdictFile === null && !RUNG_NAMES.includes(o.rung)) stop('CLI', 'give --rung ' + RUNG_NAMES.join('|') + ' [--oracle-only], --selftest or --verdict-file <log|->');
    if (!Number.isInteger(o.K) || !(o.K >= 1 && o.K <= 51)) stop('CLI', '--K 1..51');
    if (o.lanes !== null) {
        const ids = rungSpecs(o.rung).map((l) => l.id);
        for (const l of o.lanes) if (!ids.includes(l)) stop('CLI', 'unknown lane ' + l + ' for ' + o.rung + ' (lanes: ' + ids.join(',') + ')');
    }
    return o;
}
/** T2 `--verdict-file <log|->`: the same verdictOf as the live run, the same exit mapping (no flags needed, no clock). */
function verdictFile(path) {
    let buf;
    try { buf = readFileSync(path === '-' ? 0 : path); } catch (e) { return stop('CLI', '--verdict-file ' + path + ' unreadable (' + (e.code || e.message) + ')'); }
    const lines = buf.toString('utf8').split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    say('VERDICT-FILE ' + (path === '-' ? '(stdin)' : path) + ' sha256 ' + createHash('sha256').update(buf).digest('hex').slice(0, 8) + ' lines=' + lines.length);
    const v = verdictOf(lines);
    say(v.reported);
    say(v.text);
    return v.code;
}

// ---------------------------------------------------------------- selftest (T5)
// (c) fixture controls: [id, fixture, mutations, want exit, VERDICT prefix, texts the VERDICT line must name]. A mutation
// is ['sub', from, to] (exactly one occurrence), ['drop' | 'dup', line prefix] (exactly one line), ['append', text].
// A mutation that does not match exactly once = that row FAILs. F1-F11 = the brief; F12-F36 = one control per remaining
// verdictOf check row (LEDGER law 9), each tripping that row alone.
const MUT_F3 = ['sub', 'B/A=0.338[0.338..0.339] word=FASTER', 'B/A=1.338[1.338..1.339] word=SLOWER'];   // ro:16 -> SLOWER, consistent
const MUT_F4 = [['sub', 'aa=1.001[1.000..1.003] slow=5.821[5.815..5.823]', 'aa=1.080[1.070..1.090] slow=5.821[5.815..5.823]'],
    ['sub', 'branches=3145826\n', 'branches=3145826 VOID=[AA-DRIFT 1.080[1.070..1.090]]\n']];             // uni:4096 VOID AA-DRIFT
const FIXTURE_CASES = Object.freeze([
    ['F1 ubuntu verbatim', 'ubuntu', [], 0, 'VERDICT PASS', ['AMD EPYC']],
    ['F2 macos verbatim (VOIDs on REPORTED lanes only)', 'macos', [], 0, 'VERDICT PASS', ['Apple M1']],
    ['F3 gated ro:16 rewritten consistently to SLOWER', 'ubuntu', [MUT_F3], 3, 'VERDICT FINDING', ['ro:16 SLOWER 1.338[1.338..1.339] expected FASTER']],
    ['F4 gated uni:4096 VOID=[AA-DRIFT], aa out of band', 'ubuntu', MUT_F4, 2, 'VERDICT NO VERDICT (gated lane not clean)', ['uni:4096 VOID(AA-DRIFT)']],
    ['F5 macos gated fw:16 RESULT line deleted', 'macos', [['drop', 'RESULT lane=fw:16 ']], 2, 'VERDICT NO VERDICT (run shape)', ['no RESULT for 1 lane(s) fw:16']],
    ['F6 F3 + F4: FINDING wins (AB-G1)', 'ubuntu', [MUT_F3, ...MUT_F4], 3, 'VERDICT FINDING', ['ro:16 SLOWER', 'not-clean=[uni:4096 VOID(AA-DRIFT)']],
    ['F7 gated walk:4096:1 word changed, numbers kept', 'ubuntu', [['sub', 'B/A=0.604[0.603..0.606] word=FASTER', 'B/A=0.604[0.603..0.606] word=SLOWER']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['walk:4096:1 printed word=SLOWER']],
    ['F8 gated fw:128 aa out of band, no VOID tag', 'ubuntu', [['sub', 'aa=1.000[0.999..1.002] slow=2.730[2.730..2.735]', 'aa=1.080[1.070..1.090] slow=2.730[2.730..2.735]']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['fw:128 aa 1.080']],
    ['F9 STOP line appended', 'ubuntu', [['append', 'STOP HARNESS: selftest F9 control\n']], 2, 'VERDICT NO VERDICT (STOP HARNESS)', []],
    ['F10 HEADER K=7', 'ubuntu', [['sub', ' K=11 C=3 ', ' K=7 C=3 ']], 2, 'VERDICT NO VERDICT (run shape)', ['K=7']],
    ['F11 REPORTED walk:256:32 word flipped', 'ubuntu', [['sub', 'B/A=2.517[2.516..2.520] word=SLOWER', 'B/A=2.517[2.516..2.520] word=FASTER']], 0, 'VERDICT PASS', []],
    ['F12 HEADER C=2', 'ubuntu', [['sub', ' C=3 NQ2=', ' C=2 NQ2=']], 2, 'VERDICT NO VERDICT (run shape)', ['C=2']],
    ['F13 HEADER inject=aa-drift', 'ubuntu', [['sub', 'inject=null\n', 'inject=aa-drift\n']], 2, 'VERDICT NO VERDICT (run shape)', ['inject=aa-drift']],
    ['F14 HEADER rung=AB2', 'ubuntu', [['sub', 'HEADER rung=ALL TIMED', 'HEADER rung=AB2 TIMED']], 2, 'VERDICT NO VERDICT (run shape)', ['rung=AB2']],
    ['F15 PROV end line deleted', 'ubuntu', [['drop', 'PROV end ']], 2, 'VERDICT NO VERDICT (run shape)', ['0 PROV end']],
    ['F16 CRASH line appended', 'ubuntu', [['append', 'CRASH Error: selftest F16 control\n']], 2, 'VERDICT NO VERDICT (CRASH)', []],
    ['F17 REPORTED walk:256:32 RESULT line twice', 'ubuntu', [['dup', 'RESULT lane=walk:256:32 ']], 2, 'VERDICT NO VERDICT (run shape)', ['several RESULT lines for walk:256:32']],
    ['F18 VOID line for gated ro:256, no tag', 'ubuntu', [['append', 'VOID NOT-TF lane=ro:256: NOT-TF A#1\n']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['ro:256 VOID-line(NOT-TF)']],
    ['F19 gated fw:16 slow median 1.200', 'ubuntu', [['sub', 'slow=3.023[3.019..3.026]', 'slow=1.200[1.150..1.250]']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['fw:16 slow 1.200']],
    ['F20 gated fw:16 slow q1 1.050 (median kept)', 'ubuntu', [['sub', 'slow=3.023[3.019..3.026]', 'slow=3.023[1.050..3.026]']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['fw:16 slow 3.023[1.050']],
    ['F21 gated uni:256 bop column A missing', 'ubuntu', [['sub', ',A:0.0000 win=262144 reps=2 branches=2098642', ' win=262144 reps=2 branches=2098642']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['uni:256 bop']],
    ['F22 gated uni:256 bop B 0.0200', 'ubuntu', [['sub', 'B:0.0000,A:0.0000 win=262144 reps=2 branches=2098642', 'B:0.0200,A:0.0000 win=262144 reps=2 branches=2098642']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['uni:256 bop']],
    ['F23 gated uni:256 B/A q3 NaN (word unchanged)', 'ubuntu', [['sub', 'B/A=2.912[2.903..2.918]', 'B/A=2.912[2.903..NaN]']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['uni:256 B/A not finite']],
    ['F24 HEADER rung= line twice', 'ubuntu', [['dup', 'HEADER rung=']], 2, 'VERDICT NO VERDICT (run shape)', ['2 HEADER rung=']],
    ['F25 RESULT for an unknown lane', 'ubuntu', [['append', 'RESULT lane=walk:1:1 (reported) B/A=1.000[1.000..1.000] word=WITHIN\n']], 2, 'VERDICT NO VERDICT (run shape)', ['unknown lane(s) walk:1:1']],
    ['F26 gated ro:4096 VOID=[NOT-TF] tag only', 'ubuntu', [['sub', 'branches=1572910\n', 'branches=1572910 VOID=[NOT-TF A#1]\n']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['ro:4096 VOID(NOT-TF)']],
    ['F27 gated ro:16 wrong word but VOID: never a FINDING', 'ubuntu', [MUT_F3, ['sub', 'branches=1089206\n', 'branches=1089206 VOID=[NOT-TF A#1]\n']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['ro:16 VOID(NOT-TF)']],
    ['F28 STOP + a clean wrong gated word: NO VERDICT lists it', 'ubuntu', [MUT_F3, ['append', 'STOP HARNESS: selftest F28 control\n']], 2, 'VERDICT NO VERDICT (STOP HARNESS)', ['wrong-gated=[ro:16 SLOWER']],
    ['F29 HEADER not TIMED', 'ubuntu', [['sub', 'HEADER rung=ALL TIMED', 'HEADER rung=ALL ORACLE-ONLY (no clock)']], 2, 'VERDICT NO VERDICT (run shape)', ['not TIMED']],
    ['F30 HEADER unparsed', 'ubuntu', [['sub', ' NQ2=', ' NQ3=']], 2, 'VERDICT NO VERDICT (run shape)', ['HEADER rung= line unparsed']],
    ['F31 gated uni:256 bop column A twice, SLOW absent', 'ubuntu', [['sub', 'bop=SLOW:0.0000,AA:0.0000,B:0.0000,A:0.0000 win=262144 reps=2 branches=2098642', 'bop=A:0.0000,AA:0.0000,B:0.0000,A:0.0000 win=262144 reps=2 branches=2098642']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['uni:256 bop']],
    ['F32 gated uni:256 bop unknown column TF', 'ubuntu', [['sub', 'bop=SLOW:0.0000,AA:0.0000,B:0.0000,A:0.0000 win=262144 reps=2 branches=2098642', 'bop=TF:0.0000,AA:0.0000,B:0.0000,A:0.0000 win=262144 reps=2 branches=2098642']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['uni:256 bop']],
    ['F33 gated uni:256 bop malformed cell', 'ubuntu', [['sub', 'bop=SLOW:0.0000,AA:0.0000,B:0.0000,A:0.0000 win=262144 reps=2 branches=2098642', 'bop=SLOW:0.0000,AA:0.0000,B:0.0000,A:0.0000:9 win=262144 reps=2 branches=2098642']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['uni:256 bop']],
    ['F34 gated ro:16 word= field twice', 'ubuntu', [['sub', 'branches=1089206\n', 'branches=1089206 word=SLOWER\n']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['ro:16 printed word=null']],
    ['F35 PROV end line twice', 'ubuntu', [['dup', 'PROV end ']], 2, 'VERDICT NO VERDICT (run shape)', ['2 PROV end']],
    ['F36 gated uni:256 bop A empty (null is not zero)', 'ubuntu', [['sub', 'bop=SLOW:0.0000,AA:0.0000,B:0.0000,A:0.0000 win=262144 reps=2 branches=2098642', 'bop=SLOW:0.0000,AA:0.0000,B:0.0000,A: win=262144 reps=2 branches=2098642']], 2, 'VERDICT NO VERDICT (gated lane not clean)', ['uni:256 bop']],
]);
function applyMut(text, m) {
    if (m[0] === 'sub') {
        const n = text.split(m[1]).length - 1;
        return n === 1 ? text.replace(m[1], () => m[2]) : 'sub ' + JSON.stringify(m[1]) + ' matched ' + n + ' times (want 1)';
    }
    if (m[0] === 'append') return text.endsWith('\n') ? text + m[1] : 'append: fixture does not end in a newline';
    const lines = text.split('\n');
    const at = [];
    for (let i = 0; i < lines.length; i++) if (lines[i].startsWith(m[1])) at.push(i);
    if (at.length !== 1) return m[0] + ' ' + JSON.stringify(m[1]) + ' matched ' + at.length + ' lines (want 1)';
    if (m[0] === 'drop') lines.splice(at[0], 1);
    else if (m[0] === 'dup') lines.splice(at[0], 0, lines[at[0]]);
    else return 'unknown mutation ' + m[0];
    return lines.join('\n');
}
const MUT_ERR = /^(sub|append|drop|dup|unknown mutation)\b/;
function child(args, env, input) {
    const r = spawnSync(process.execPath, [...process.execArgv, ME, ...args],
        { encoding: 'utf8', env, input, maxBuffer: 1 << 24, timeout: SELFTEST_CASE_MS });
    const out = (r.stdout || '') + (r.stderr || '');
    const vs = out.split('\n').filter((l) => l.startsWith('VERDICT '));
    return { status: r.status, out, vline: vs.length === 1 ? vs[0] : null, nV: vs.length };
}
function envWith(inject) {
    const env = { ...process.env };
    delete env.LAB_INJECT;
    if (inject !== null) env.LAB_INJECT = inject;
    return env;
}
function selftest() {
    let bad = 0, ran = 0;
    const total = FIXTURE_CASES.length + SELFTEST_CASES.length;
    const row = (ok, txt, out) => { ran++; say('SELFTEST ' + txt + ' -> ' + (ok ? 'ok' : 'FAIL')); if (!ok) { bad++; if (out) say(out.split('\n').slice(-8).join('\n')); } };
    // (c) fixtures, untimed: sha-pinned, then each control through a child --verdict-file process (the real exit mapping)
    const fx = {};
    for (const k of Object.keys(FIXTURES)) {
        let buf = null;
        try { buf = readFileSync(FIXTURES[k].path); } catch (e) { buf = null; }
        const sha = buf === null ? 'unreadable' : createHash('sha256').update(buf).digest('hex');
        fx[k] = sha === FIXTURES[k].sha ? buf.toString('utf8') : null;
        say('SELFTEST fixture ' + k + ' ' + FIXTURES[k].path + ' sha256 ' + sha.slice(0, 8) + ' (pinned ' + FIXTURES[k].sha.slice(0, 8) + ') -> ' + (fx[k] !== null ? 'ok' : 'FAIL'));
        if (fx[k] === null) bad++;
    }
    for (const [id, base, muts, want, prefix, names] of FIXTURE_CASES) {
        if (fx[base] === null) { row(false, id + ': fixture ' + base + ' not verified, case not run'); continue; }
        let text = fx[base], err = null;
        for (const m of muts) { const t = applyMut(text, m); if (MUT_ERR.test(t)) { err = t; break; } text = t; }
        if (err !== null) { row(false, id + ': mutation did not apply: ' + err); continue; }
        const r = muts.length === 0 ? child(['--verdict-file', FIXTURES[base].path], envWith(null), undefined) : child(['--verdict-file', '-'], envWith(null), text);
        const named = names.every((s) => r.vline !== null && r.vline.includes(s));
        const ok = r.status === want && r.vline !== null && r.vline.startsWith(prefix) && named;
        row(ok, id + ': exit ' + r.status + ' (want ' + want + ') verdict ' + (r.vline === null ? '(' + r.nV + ' VERDICT lines)' : JSON.stringify(r.vline.slice(0, 160))) +
            ' (want ' + JSON.stringify(prefix) + (names.length > 0 ? ' naming ' + JSON.stringify(names) : '') + ')', ok ? null : r.out);
    }
    // (a) + (b) timed children: a subset K = 3 run is NO VERDICT 2; a STOP is 1 with `VERDICT NO VERDICT (STOP <reason>)`
    for (const [name, rung, lane] of SELFTEST_CASES) {
        const spec = name === null ? CLEAN_CHILD : INJECTIONS[name];
        const r = child(['--rung', rung, '--lanes', lane, '--K', '3'], envWith(name), undefined);
        const has = spec.marker === null ? !/^(STOP|CRASH) /m.test(r.out) : r.out.includes(spec.marker);
        const ok = r.status === spec.want && has && r.vline !== null && r.vline.startsWith(spec.verdict) && !r.vline.includes('verdictOf crashed') &&
            (spec.names === undefined || spec.names.every((s) => r.vline.includes(s)));
        row(ok, (name === null ? 'clean' : name) + ' ' + rung + ' ' + lane + ': exit ' + r.status + ' (want ' + spec.want + ') ' +
            (spec.marker === null ? 'no STOP / CRASH ' + (has ? 'ok' : 'VIOLATED') : 'marker ' + JSON.stringify(spec.marker) + ' ' + (has ? 'present' : 'ABSENT')) +
            ' verdict ' + (r.vline === null ? '(' + r.nV + ' VERDICT lines)' : JSON.stringify(r.vline.slice(0, 80))) + ' (want ' + JSON.stringify(spec.verdict) + ')', ok ? null : r.out);
    }
    if (ran !== total) { bad++; say('SELFTEST ran ' + ran + ' of ' + total + ' cases -> FAIL'); }
    say('SELFTEST ' + (bad === 0 ? 'all ok' : bad + ' FAIL'));
    return bad === 0 ? 0 : 1;
}

async function main() {
    const o = parseCli(process.argv.slice(2));
    for (const id of Object.keys(GATED)) if (!rungSpecs('ALL').some((s) => s.id === id)) stop('HARNESS', 'GATED lane ' + id + ' is not a lane of rung ALL');
    if (o.verdictFile !== null) return verdictFile(o.verdictFile);
    armNatives();
    if (o.selftest) return selftest();
    const inject = process.env.LAB_INJECT === undefined ? null : process.env.LAB_INJECT;
    if (inject !== null && !Object.hasOwn(INJECTIONS, inject)) stop('CLI', 'LAB_INJECT unknown: ' + inject);
    if (inject !== null && o.oracleOnly) stop('CLI', 'LAB_INJECT is for timed runs only');
    KTEXT = loadFrozen();
    checkLive(KTEXT, inject);
    say('HEADER rung=' + o.rung + (o.oracleOnly ? ' ORACLE-ONLY (no clock)' : ' TIMED') + ' node ' + process.version + ' arch ' + process.arch + ' v8 ' + process.versions.v8 +
        ' cpu ' + os.cpus()[0].model + ' K=' + o.K + ' C=' + C_COPIES + ' NQ2=' + NQ2 + ' minWindow=' + MIN_N + ' inject=' + inject);
    say('HEADER frozen ' + FROZEN + ' sha256 ' + FROZEN_SHA.slice(0, 8) + ' ok; A = fresh / base kernel, B = candidate, AA = A twin, SLOW = A + spin');
    say('HEADER live ' + LIVE + ': ' + KERNEL_NAMES.join(', ') + ' bodies byte-identical to the frozen bodies -- ok (AB-G2)');
    say('HEADER kernels ' + KERNEL_NAMES.join(', ') + ' (DEPS lowerBoundHintF64 <- lowerBoundBranchlessF64); flags ' + REQUIRED_FLAGS.join(' '));
    say('HEADER ' + RULE_GATE);
    say('HEADER GATED ' + Object.keys(GATED).map((id) => id + '=' + GATED[id]).join(' ') + '; every other lane REPORTED');
    if (o.rung !== 'AB2') { say('HEADER AB1 A=lowerBoundBranchlessF64 B=lowerBoundHintF64 spin=' + SPIN_T2); say('HEADER ' + RULE_AB1); say('HEADER ' + CTRL_T2); say('HEADER ' + REPORT_T2); }
    if (o.rung !== 'AB1') {
        say('HEADER AB2 A=lowerBoundBranchyF64 B=lowerBoundBranchlessF64 ro spin=' + SPIN_RO + ' fw spin=' + SPIN_FW_BASE + ' + (n >>> ' + SPIN_FW_SHIFT + ') per kernel call (2 calls/op): ' + FW_SIZES.map((n) => 'fw:' + n + '=' + spinFw(n)).join(' '));
        say('HEADER ' + RULE_AB2_RO); say('HEADER ' + RULE_AB2_FW);
    }
    say('HEADER the AB1 / AB2 rule blocks are REPORT output: only the VERDICT line (the gate rule above) sets the exit');
    provenance('start');
    if (!o.oracleOnly) await gcControl();
    const rows = [];
    for (const spec of rungSpecs(o.rung)) {
        if (o.lanes !== null && !o.lanes.includes(spec.id)) continue;
        const lane = spec.mk();
        const cols = makeCols(lane, inject);
        rows.push(o.oracleOnly ? oracleLane(lane, cols, o.K) : await runLane(lane, cols, o.K));
    }
    if (rows.length === 0) stop('CLI', 'no lane selected');
    provenance('end');
    if (o.oracleOnly) {
        const code = rows.some((x) => x.gated && x.voids.length > 0) ? 2 : 0;
        let ops = 0;
        for (const x of rows) ops += x.ops;
        say('ORACLE-ONLY ' + o.rung + ': lanes=' + rows.length + ' ops-checked=' + ops + ' -> ' + (code === 0 ? 'clean' : 'VOID on a gated lane'));
        return code;
    }
    if (o.rung !== 'AB2') ruleAB1(rows, o.K);
    if (o.rung !== 'AB1') ruleAB2(rows, o.K);
    const v = verdictOf(LOG.slice());
    say(v.reported);
    say(v.text);
    return v.code;
}

main().then((c) => { process.exitCode = c; }, (e) => {
    const head = e instanceof Stop ? 'STOP ' + e.reason : 'CRASH';
    say(e instanceof Stop ? 'STOP ' + e.reason + ': ' + e.message : 'CRASH ' + (e && e.stack));
    // the same verdictOf over every line printed so far: NO VERDICT, naming any wrong gated word already printed
    let text;
    try { text = verdictOf(LOG.slice()).text; } catch (e2) { text = 'VERDICT NO VERDICT (' + head + ') verdictOf crashed: ' + (e2 && e2.message); }
    say(text);
    process.exitCode = 1;
});
