# lite-bisect -- the ledger

*Every design refused, every defect caught, every measurement trap, and the laws they produced,
for the sorted-array search kernels. Each entry names the file, path or source ledger entry it
rests on; nothing here comes from memory. Nothing here is re-litigated without a new mechanism
that clears every gate the original decision cleared.*

Scope: `@zakkster/lite-bisect` (DRAFT, 2026-11-10; see ROADMAP.md). Repository
`github.com/PeshoVurtoleta/lite-bisect`, first commit 87389fb (2026-11-10). Entries written
before that commit name files and dates only. Most of
what this package knows today it INHERITED from other suite ledgers (section I). Inherited
entries are evidence measured on another package's code; they bind the research here, but a
number from them is never quoted as this package's number.

## How to read this file

- Section 0 (the laws) first. Each law cites the entries that prove it and names the ROADMAP
  questions (R-n, Q-ids) it binds.
- Entry ids, never renumbered:
  - `I<n>` inherited from another ledger (source named);
  - `A<n>` designs refused or parked;
  - `B<n>` defects found and fixed;
  - `C<n>` measurement lessons from this package's own runs;
  - `D<n>` process lessons.
- Sources: `git log`, ROADMAP.md, `draft-check.mjs`, `.handoff/` (gitignored, once it exists), and the
  ledgers and RESEARCH.md of LiteLogLogN, LiteSignal and LiteFastBit32 under
  `/Users/zakkster/Work/Portfolio/LiteLibrariesSuite/`.
- Archive (2026-11-24, after 1.0.0): finished specs, review overlays, old commit messages and `audit/`
  (audit/2026-11-11-bisect/ followed on 2026-11-24 with the 1.1 README re-cite) were moved to
  `.handoff/archive/1.0.0/` with their relative paths kept; citations of moved paths name the archive path.
  Archive (2026-11-24 UTC, after 1.1.0): seghint-1.1, bb1b4, ab4bb123, fillers, release-1.1.0, release-1.1.0b,
  PROPOSAL-seghint.md and COMMIT_MSG-CLOSEOUT.txt moved to `.handoff/archive/1.1.0/` the same way, with a copy of the
  1.1.0 commit message as COMMIT_MSG-1.1.0.txt (the archived
  seghint-1.1/evidence/parity.mjs resolves the package root by relative depth, so it no longer runs from there).
- Tiers: DETERMINISTIC gates run in `npm test` / `npm run verify` every time; STATISTICAL
  gates run once per release, interleaved A/B on hosted CI; REPORTED numbers gate nothing.

## How to add an entry

1. Take the next free id in the section (never renumber). Place it at the end of its section.
2. Title in one line with its status and date, e.g. *(RULED 2026-11-10)*. Then: **What
   happened**, **Root cause** (or **Reason**), **Evidence** (path, and the commit once the
   package is a repo), **Law** (number in section 0, or "none new"), **Gate** (file + test /
   tier name, or "none yet").
3. A measurement enters only from a run log of that cycle, with date, host (or CI run id),
   load, Node / V8 and run count as the log states them. An estimate is labelled "nominal".
4. An entry names what would reopen it: a new engine behaviour, a new consumer, a new gate
   result. The reopening change must clear every gate the entry lists.
5. Inherited entries (`I<n>`) quote the source ledger id and path. When this package re-measures
   one, the result becomes a `C<n>` entry and the `I<n>` entry points to it.

---

## 0. The laws (read this first)

All 11 were inherited. Each becomes this package's own law once a `C<n>` entry here confirms
it: law 3 (C1, C3, C7), law 8 (C2), laws 4 and 6 (C4, C5), law 5 (C6), law 2 (C7, Maglev tier
only), law 1 (C10) and law 7 (C11, hosted x86) are confirmed on this package as of 2026-11-12.

1. **Time the consumer, not the search.** A branchless search's result is data at the end of a
   chain of loads; whatever consumes it waits. Branchless read 2-4x faster alone and an
   `add` + `delete` pair 1.09-1.22x slower, because the position fed `copyWithin`. *(I1)*
   Binds: R-3, R-11's `feedsWrite` trait, every P2 adoption at a site that feeds a write.
2. **A kernel's bytes are charged to every caller.** A shared kernel that grows can push a
   caller over its cumulative TurboFan budget. 37 B more at 2 sites dropped `has` out of a
   caller loop; keys >= 2^31 then read 16.04 B/op. Every kernel gets a bytecode-size gate,
   and every adoption traces the CALLER's inlining, not only the kernel's. *(I2, I3, I6)*
   Binds: section 6 bytecode gate, R-11, P2.
3. **EXPECTED inlining or feedback is not TRACED.** An outside claim about the JIT is a
   hypothesis until `--trace-turbo-inlining`, `--trace-deopt` or the LiteUtils tools show it
   on this engine. *(I3, I8)* Binds: R-4 ("believed to share ONE feedback vector"), R-11
   ("the returned kernel stays inlinable").
4. **You cannot out-inline TurboFan by hand.** A guard or fast path that "saves a call" is
   bytes in the body. A length switch or a linear prefix must win measured, or go. *(I6)*
   Binds: R-1 (kill rule already fixed in ROADMAP), the 2 per-site linear prefixes (Keyframe,
   O1 RankSelect) at adoption.
5. **A timing verdict needs its controls and a range, never one run.** 3 independent
   compilations per column (one compilation showed up to ~20% A/A bias), an A/A twin, a
   must-fail SLOW control, each lane on its own instance, median of K interleaved rounds +
   IQR, ranges quoted across runs. A PRELIMINARY host is recorded, not argued. *(I4, I5, I7)*
   Binds: every R-1 / R-2 / R-3 / R-5 probe, the STATISTICAL lane.
6. **A crossover belongs to the pair compared and the size.** Linear vs branchy crosses at
   ~40-64 keys, linear vs branchless at ~16; a layout that wins in L1 can lose past a size
   crossover. Judge across an n-sweep, never at one size. On this package (C4): no
   linear-vs-branchless crossover in 1..8 on a random stream; a crossover also belongs to the
   stream. *(I4, I6, C4)* Binds: R-1, R-5,
   `LINEAR_MAX`.
7. **Branch prediction and memory ordering do not transfer across CPUs.** Every inherited
   timing is one Apple M4 Pro. A "faster" claim needs x86 too. *(I1, I6)* Binds: R-10, the
   nightly lane in ROADMAP section 7.
8. **A zero-box entry is not a zero-box path, and an allocation gate must be able to see the
   box.** A double >= 2^31 or fractional crossing a call V8 does not inline boxes 16 B. The
   LogLogN probe read clean with inlining off on default semi-space flags (it was blind); only
   pinned flags counted. A DETERMINISTIC gate whose control flips only on a JIT decision checks
   the tier or reports no verdict. *(I2, I8)* Binds: R-8, the 0 B/op gate.
9. **A gate fails open until a control proves it closed, and the expected value never comes
   from the thing it checks.** Every checker row has a control that fails on that row alone; a
   crashed or never-run mutant is a FAIL. The oracle shares no code with the kernels. *(I5, B1)*
   Binds: `draft-check.mjs`, every gate in ROADMAP section 6.
10. **Every refusal and every rung names its kill rule before the run.** *(I8)* Binds: P0
    research INTAKE; R-1's kill rule is the model.
11. **A probe harness is reviewed before its numbers count.** *(I7)* Binds: every P0 probe.

Gate consequence: no number in ROADMAP section 3 is this package's number until P0 re-runs it
on these kernels. No single green gate authorises a release.

---

## I. Inherited entries (measured on other packages; not re-run here)

### I1. A branchless search loses when its result feeds a write *(LiteLogLogN #53, MEASURED 2026-11-10)*
- **What happened:** RoaringSet's branchless `_lb16` read 0.355..0.524 of the old body on
  `has`, but `add(x)` + `delete(x)` read 1.089..1.224 SLOWER at 16..2,048 keys. Positions from
  the search's `j` read slower; precomputed positions read faster, with `j` still computed.
- **Reason:** the data flow from the search result into `copyWithin`, not the search.
- **Evidence:** LiteLogLogN/LEDGER.md #53; LiteLogLogN/RESEARCH.md section 18. Apple M4 Pro,
  V8 14.6, QUIET + one `--strict` hold.
- **Here:** 5 of the 28 inventoried sites feed a write (ROADMAP section 2). They stay branchy
  unless R-3 measures otherwise ON THAT SITE. Reopens with: an R-3 result at a write-feeding
  site, on x86 and arm64.

### I2. A 37 B callee growth crossed the caller's cumulative TurboFan budget *(LiteLogLogN #52, FIXED 2026-11-09)*
- **What happened:** a 98 B `_lb16` (was 61 B) dropped `has` out of a mixed-kind caller loop:
  452 + 322 = 774, x1.2 = 929 > the 920 cumulative budget. Keys >= 2^31 then read 16.04 B/op
  in that loop. The single-kind trace and torture's 4-kind lane could not see it.
- **Reason:** the inliner charges a callee's bytes to the caller's cumulative budget.
- **Evidence:** LiteLogLogN/LEDGER.md #52. Fixed with a 91 B body and a gate `_lb16 <= 94`.
- **Here:** the draft's `lowerBoundBranchless` is the same family but NOT the same body: it
  reads 103 B on node v26.8.2 (C1), not LogLogN's 98 B. A shared kernel multiplies the risk
  across every adopting package. Gate: ROADMAP section 6 bytecode gate, plus a caller trace at
  each P2 adoption.

### I3. EXPECTED inlining is not TRACED inlining *(LiteLogLogN #35, standing)*
- **What happened:** a "never inlined" claim was expectation; the trace showed which bodies
  TurboFan declined ("exceeds bytecode limit") and which it inlined.
- **Evidence:** LiteLogLogN/LEDGER.md #35 (V8 14.6 / Node v26.8.2: Maglev 100 B, TurboFan
  460 B).
- **Here:** R-11's claim that a selector-returned kernel inlines through a const or field is
  EXPECTED until `inlining-budget-diff.sh` traces it.

### I4. One compilation per kernel biases an A/B by up to ~20%; crossovers depend on the pair *(LiteLogLogN RESEARCH 16.2, finding)*
- **What happened:** the S0 spike saw up to ~20% A/A bias with one compilation per kernel;
  linear vs branchy crossed at ~40-64 keys, linear vs branchless or Eytzinger at ~16.
- **Evidence:** LiteLogLogN/RESEARCH.md 16.2 (PRELIMINARY there).
- **Here:** the timing method of every P0 probe (law 5); R-1 compares the right pair.

### I5. Gates that failed open, and expected values taken from the code under test *(LiteLogLogN laws 1-2: #22-#28, #46; LiteFastBit32 law 3: B2, B4, B11, B12)*
- **What happened:** checker rows with no control, a never-run mutant counted as a kill, ops
  and keys drawn from one PRNG stream, expected values read from the list they checked.
- **Evidence:** LiteLogLogN/LEDGER.md laws 1-2; LiteFastBit32/LEDGER.md law 3.
- **Here:** `draft-check.mjs` already follows it (naive oracle from the definition, 6 mutants
  killed, ROADMAP section 4). Its mutant runs must count a mutant that never ran as a FAIL when
  it becomes node:test.

### I6. Bytes cost even when the branch never runs; hand-inlining loses; size and hardware decide *(LiteSignal laws 1, 2, 4, 5)*
- **What happened:** checks that never ran pushed hot bodies out of inlining (#17, #18); manual
  "skip the call" guards made bodies slower (#4-#8); a layout win reversed past a size
  crossover (#27); a win on old hardware / old Node was 0% on current silicon (#19).
- **Evidence:** LiteSignal/LEDGER.md "The laws that fell out" 1, 2, 4, 5.
- **Here:** R-1 (the length switch is bytes), R-5 (Eytzinger past L1), R-10.

### I7. Load, shared instances and unreviewed harnesses each moved a verdict *(LiteLogLogN #31, #33, #34, #38)*
- **What happened:** load flipped gates that looked deterministic (#31); an x2 control shared
  its instance with a third runner (#33); a probe drift was lane-structural, with per-cell
  spread up to 171.3% across QUIET logs (#34); R0 harnesses needed three review rounds before
  their numbers counted (#38).
- **Evidence:** LiteLogLogN/LEDGER.md #31, #33, #34, #38.
- **Here:** each P0 lane gets its own kernel instance and compilation; docs quote min-max
  ranges; the probe is reviewed before its numbers enter RESEARCH.md.

### I8. Zero-box paths, JIT claims and kill rules *(LiteFastBit32 laws 1, 11, 12: B3, B10, A1-A3, A8)*
- **What happened:** a uint32 double crossing a non-inlined call boxed 16 B (B3, B10); an
  audit's deopt claim did not reproduce under `--trace-deopt` (A8); members with no consumer
  were refused by a kill criterion named before coding (A1-A3).
- **Evidence:** LiteFastBit32/LEDGER.md section 0 laws 1, 11, 12.
- **Here:** R-8 includes F64 queries that are fractional or >= 2^31; R-4's feedback claim is
  a hypothesis until `ic-diff.sh` shows it.

---

## A. Designs refused or parked

### A1. LiteUtils tools copied in with sha256 pins *(RULED 2026-11-10, Q-LU-1)*
- **Reason:** the maintainer chose a devDependency so the package follows LiteUtils as it
  develops: "add LiteUtils as a devDependency - it would be further developed".
- **Evidence:** ROADMAP.md section 9.
- **Reopens with:** a LiteUtils release that drops its `bin` / `exports` entries.

### A2. A `>=1.0.0` LiteUtils range *(RULED 2026-11-10, Q-LU-1a)*
- **Reason:** `^1.0.0` takes every minor; no LiteUtils 2.0.0 is planned. A future major is
  adopted on purpose.
- **Evidence:** ROADMAP.md section 9.
- **Amended 2026-11-22 (GU-R1, ROADMAP 5g):** the floor is `^1.1.0`, the first release that ships alloc-per-op.mjs;
  `>=` stays refused.

### A3. A per-call strategy registry; choosing a kernel by timing at runtime *(REFUSED 2026-11-10, P0 PROPOSAL Q-R11)*
- **Reason given:** a per-call lookup or indirect call makes the call site polymorphic and
  blocks inlining (law 2, law 3); a mutable global registry is global state with load-order
  behaviour, against `sideEffects: false`; runtime timing makes results depend on the host.
- **Status:** RULED with Q-R11 (maintainer, 2026-11-10): "(a) No selector at 1.0
  (Recommended)", whose text refuses A3 under every option.
- **Evidence:** .handoff/archive/1.0.0/PROPOSAL-bisect.md Q-R11; ROADMAP R-11 "Declined in advance"; laws 2, 3.
- **Reopens with:** a mechanism that keeps the call site monomorphic and inlined with a
  per-call choice, traced (law 3).

### A4. The length switch (`lowerBound`, `LINEAR_MAX`) and `lowerBoundLinear` *(REFUSED 2026-11-10, Q-KERNELS)*
- **Reason:** C4. The switch never read FASTER and read SLOWER at every n = 1..8; no measured
  case has linear beating branchless. Ruling: "(a) Lean set (Recommended)".
- **Evidence:** `.handoff/archive/1.0.0/PROPOSAL-bisect.md` Q-KERNELS; LEDGER C4.
- **Reopens with:** C4's reopen conditions (an x86 win with no loss, or a predictable caller
  stream measured at that caller).

### A5. A setup-time selector at 1.0; a per-call `instanceof` type front *(PARKED / REFUSED 2026-11-10, Q-R11, Q-FRONT)*
- **Reason:** every "traits -> kernel" row is arm64-only evidence (R-3 and R-10 unrun), so a
  selector would mostly return defaults; the front's per-call cost is unmeasured and callers
  can name the per-type kernel. Rulings: "(a) No selector at 1.0 (Recommended)" (PARKED, not
  refused: U2 showed the selector is free on inlining); "(a) No per-call front (Recommended)"
  (REFUSED).
- **Evidence:** PROPOSAL Q-R11 / Q-FRONT; PROGRESS U1 / U2; C3.
- **Reopens with:** selector -- R-3 plus an x86 run (R-10) giving evidence per row; front -- a
  timed rung of its per-call cost that reads WITHIN against the typed kernel (a bar set by the
  author, not ruled).

### A6. Eytzinger at 1.0 *(PARKED 2026-11-10, Q-KERNELS)*
- **Reason:** never measured on this package (R-5); the inherited win is PRELIMINARY and in L1.
- **Evidence:** .handoff/archive/1.0.0/PROPOSAL-bisect.md Q-KERNELS; ROADMAP section 3 row 16.1 S0 (PRELIMINARY, in L1); R-5.
- **Reopens with:** an R-5 rung (n >= 1e5, kill rule fixed before the run).

### A7. CI shapes not chosen for the hosted workflows *(RULED 2026-11-11, P3-R2..P3-R8)*
- **Reason:** the maintainer took every recommended option (ROADMAP 5d). Not chosen: a 12-leg matrix with
  ubuntu-24.04-arm (OS and arch separated; ~1.5x runner minutes) and a 6-leg matrix with no node 26.8.2 leg (M4
  would never run in CI); coverage + size on every leg (a Node's npm / zlib can move the tarball size with no
  product change) and test + torture only; a LiteUtils `gates` job now (reopens P1-R1: hosted CI waits for LiteUtils
  1.0 on npm); a schedule trigger inside ci.yml and no nightly yet; full commit-SHA action pins (the suite pins
  @v7 majors, one suite-wide bump); `npm install` (resolves ranges at run time); push to main only. P3-R5a
  (2026-11-11, "I agree"): a STATISTICAL A/B lane counting toward the release's "nightly green for a week" (a
  timing streak multiplies the hosted-runner false-red rate by ~7; STATISTICAL is gated once per release).
- **Evidence:** ROADMAP.md section 5d; `.github/workflows/ci.yml`, `nightly.yml`.
- **Law:** none new (law 7 is why the matrix has an x86 and an arm64 OS). **Gate:** `.handoff/p3/ci-check.mjs` checks
  the ruled shape (legs, steps, pins, triggers) with must-fail controls; local, not in `npm test`.
- **Reopens with:** gates -- LiteUtils 1.0 on npm (P1-R1, planned unit, not a reopen); 12 legs -- an R-10 STATISTICAL
  verdict that differs between arm64 Linux and arm64 macOS; SHA pins -- a suite-wide pinning change; every-leg size
  -- a size regression seen only on a Node other than 26.

### A8. The K = 11 / A/A 0.95..1.05 gate shape on a contended host *(REFUSED 2026-11-12, P3 research burst `ab` R3 kill rule; gate shape open in PROPOSAL-ab Q-AB-LANES / Q-AB-K / Q-AB-BAND)*
- **Reason:** (1) the contended host: under 10 busy-loop spinners on this 12-core host (load1 6.35 .. 11.89) the lab
  VOIDed an A/A twin in 4 of 5 runs (9 lanes, aa 0.851 .. 1.191); the INTAKE kill rule (A/A VOID in > 1 of 5) fired, so
  this shape gives no verdict there. It failed CLOSED: no high-margin word changed. Under 4 spinners: 0 VOID in 5 runs.
  (2) Not refused here (no INTAKE kill rule named it; open as PROPOSAL-ab Q-AB-LANES (b)): gating every lane -- four kill-rule lanes have a local margin < 0.10 (walk:256:1 0.044, walk:4096:4 0.033, fw:1024
  0.078, fw:2048 0.002), and their words moved with load (walk:256:1 WITHIN in 3 contended runs, fw:2048 WITHIN /
  SLOWER across QUIET runs). Gating them would make runner noise a release blocker.
- **Evidence:** .handoff/research/ab/PROGRESS.md R1 + R2, R3; logs/r12-strict.log, logs/r3-s4-*.log, logs/r3-s10-*.log,
  logs/r3-ksub-*.log. Apple M4 Pro, node v26.8.2, lab 8128d400, frozen 88e5b1c-10add825, K = 11, C = 3. PRELIMINARY
  (one CPU; synthetic load).
- **Law:** 5 and 9 (the A/A twin is what turned contention into NO VERDICT; the band is not widened to get a verdict).
- **Reopens with:** a hosted run (R4) or a larger K that holds the A/A band under contention, with the must-fail SLOW
  control still tripping; a low-margin lane whose margin reaches >= 0.25 on both CPUs.

### A9. Installed-first tool precedence once lite-utils is a devDependency *(RULED 2026-11-22, GU-R2 "Explicit env wins (Recommended)")*
- **Reason:** SPEC-p1 U6 resolved the installed `@zakkster/lite-utils` first and LITE_UTILS_DIR only when nothing was
  installed. With `^1.1.0` installed, `npm run gates:local` (and `npm run verify`, which runs it) would have read
  node_modules silently, and a LiteUtils checkout under development could never be gated here. GU-R2: a set, non-empty
  LITE_UTILS_DIR overrides the installed package; an invalid one is NO VERDICT, never a fall-through to the installed
  package; the provenance line names the source and its version either way.
- **Evidence:** ROADMAP.md section 5g; test/gates/lu.mjs; test/lu.test.mjs precedence rows (the old resolver read the
  installed package in all 8: .handoff/gates/evidence/revert.txt).
- **Law:** none new. **Gate:** `npm test` (test/lu.test.mjs: the GU-R2 precedence row and the seven `NV env dir ... (installed valid)` rows).
- **Reopens with:** a CI job that sets LITE_UTILS_DIR, or a need to gate a checkout and the installed package in one run.

---

## B. Defects found and fixed

### B1. `lowerBoundHint` returned the hint for a NaN query *(FIXED 2026-11-10, draft)*
- **What happened:** the left gallop tested `a[l] >= x`. For a NaN query every compare is
  false, so the gallop stopped at once and returned the hint instead of `lo`.
- **Root cause:** a predicate written as the "opposite" of `a[l] < x` instead of its negation;
  the two differ only on NaN.
- **Evidence:** 87389fb (the fix is in the first commit); ROADMAP.md section 4;
  `Bisect.draft.js` (`!(a[l] < x)`, with a comment);
  `draft-check.mjs` hint lanes with NaN queries. The mutant scripts lived in a session
  scratchpad: NOT FOUND in the package.
- **Law:** 9. **Gate:** `draft-check.mjs` (becomes node:test in P1). Every kernel uses the one
  predicate `a[i] < x` (lower) or `a[i] <= x` (upper), negated with `!`, never flipped.

### B2. `lowerBoundHint` never returned at hi - lo = 2^30 *(FOUND 2026-11-11, P1 spec review r1; RULED P1-R8)*
- **What happened:** with hi - lo = 2^30 exactly, the hint at hi and x <= a[lo] (or a NaN query), the left
  gallop doubles `step` to 2^30, then `step <<= 1` wraps to -2^31 and then 0, so `l = h` repeats forever. Q-GUARD's
  ruled cap (hi - lo <= 2^30) admitted that range. At 2^30 - 1 every kernel returns. Found by hand on the frozen
  draft body (monotone Proxy array), not by a gate: draft-check never feeds a range near the cap.
- **Root cause:** a 32-bit shift on a step that the cap lets reach 2^30; the right gallop stops earlier because
  `r < hi` fails first.
- **Evidence:** .handoff/p1/SPEC-p1.md addendum r1; frozen draft 3af35dca (`lowerBoundHint`, left gallop).
- **Law:** 9 (the cap was never fed to the kernel it protects). Fix: the cap, not the body (law 4: no hot bytes):
  P1-R8 "Cap at 2^30 - 1 (Recommended)", assertRange throws RangeError at hi - lo = 2^30.
- **Gate:** P1 U3 boundary suite (test/Bisect.boundary.test.mjs): every kernel returns at hi - lo = 2^30 - 1; assertRange throws at 2^30.
  Reopens with: a hint body edit, or a cap change.

### B3. A non-integer hint h hangs `lowerBoundHint` *(FOUND 2026-11-11, P1 U2 review; RULED P1-R9)*
- **What happened:** `lowerBoundHintF64` over 0..15, range [0, 16), x = 5: h = 10.5 never returns (the left gallop
  leaves the fractional bracket [0, 2.5) and the branchless loop runs forever at n = 1.5; killed after 4 s); h = 2.5
  returns 1 where the answer is 5. The frozen draft body does the same. The U2 header said only "clamped to [lo, hi]".
- **Root cause:** the hint clamps h to [lo, hi] and maps NaN to lo, but never makes it an integer; every index the
  gallop derives from h inherits the fraction, and the branchless body assumes an integer range (law 4: no guard).
- **Evidence:** U2 review, .handoff/p1/SPEC-p1.md addendum r4; parked Bisect.js 79e92c19 (.handoff/rejected/U2);
  frozen draft 3af35dca. node v26.8.2, by hand, not by a gate.
- **Law:** 9 (the contract named no domain for h, so no gate fed one). Fix: the contract, not the body (law 4):
  P1-R9 "Caller error, documented (Recommended)": h is an integer index or NaN; a non-integer h may return a wrong
  index or never return. No hot bytes, no new export, no cold check.
- **Gate:** none (a caller error is documented, not checked); the Bisect.js header and the .d.ts JSDoc state it (U2,
  U7). Reopens with: a hint body edit, a cold check for h, or a consumer that derives h from a double.

### B4. The torture measured retained heap per lane and never gated it *(FOUND 2026-11-11, P1 U4 review; RULED P1-R10)*
- **What happened:** U4's test/torture.mjs computed a retained-heap B/op per 200,000-op lane and printed it as
  `alloc=`, but each lane's verdict read only steady major GCs and arrayBuffers growth. A planted lowerBoundBranchyF64
  that keeps one `{ lo, hi }` per call printed `retainedB/op=48.936 ok` and the torture exited 0. A short-lived
  3-element array per call printed `alloc=0.081 B/op`: the label named allocation, the number was retention.
- **Root cause:** a measured channel with no threshold and no must-fail control; on-heap retention within one
  window moves neither major GCs nor arrayBuffers, and phase 1 proves only that the tracked arrays die.
- **Evidence:** U4 review (P1 coder burst 2), planted kernels in the reviewer's scratchpad; parked U4 torture.mjs
  018d72e9 (.handoff/rejected/U4); head read 0.071..0.107 B/op over 5 runs (node v26.8.2, host loaded, untimed).
- **Law:** 9 (a gate fails open until a control proves it closed). Fix: P1-R10 "R < 1.0 B/op (Recommended)": every
  lane gates retained < 1.0 B/op, a control lane retaining one small object per op must trip it, the label reads
  `retained=`. Allocation (short-lived) stays U6's alloc-per-op lanes.
- **Gate:** `npm run torture` (U4, after the fix). Reopens with: a lane reading >= 1.0 B/op on an unchanged kernel
  (flake = a test bug), or U6 lanes that make the torture channel redundant.

### B5. The B4 control proved the predicate, then the wrong bound, not the lanes *(FOUND 2026-11-11, P1 U4 review r2 / r3; FIXED r4)*
- **What happened:** the first P1-R10 fix judged its must-fail retain control by calling `laneOk(true, bpo)`
  outside the lane loop. A mutant restoring the GC-only lane verdict kept every control green, and a planted
  kernel retaining one Smi per call printed `retained=8.961 B/op | ok`, exit 0 -- B4 again. The fix (control row
  run through the lane loop's own verdict line) plus a new floor (`bpo > -1.0`) then let the control count as
  "flagged" when its reading fell BELOW the floor: a sink cleared at the last op read -4.914 B/op and passed.
- **Root cause:** a control that calls the predicate proves the predicate, not the verdict path the lanes take;
  and "the control failed" is not "the control failed for the reason it exists" once a gate has two bounds.
- **Evidence:** .handoff/p1/review-u4r2/VERDICT-r2.md (r2 and r3 mutants tm3, n5, n6p), .handoff/p1/evidence/
  u4r3-*.log, u4r4-*.log; final test/torture.mjs 35d0b056: the retain row runs through
  `const ok = laneOk(mustTrip === true || gcPass(m), bpo)` and counts as flagged only when `bpo >= 1.0`.
- **Law:** 9 (a control must fail on that row alone, and for its own reason). Carried open: a near-bar control
  (~1.5 B/op) would pin the 1.0 threshold itself (one object per op pins it only below ~49 B/op; P1-R10 names one
  object per op, so adding it is a ruling); two-change bypasses (separate verdict branches for control and lanes)
  are outside what one control can catch.
- **Gate:** `npm run torture` revert checks r1-r5 / f1 / f5 / fn. Reopens with: any edit to the lane verdict line
  or laneOk that the retain control does not fail.

### B6. The alloc gate read a JSON null window as 0 B/op *(FOUND 2026-11-11, P1 U6 review r1; FIXED r2)*
- **What happened:** alloc-per-op `--json` writes a NaN window as `null`; the U6 checkers compared
  `x >= lo && x <= hi`, and `null >= 0 && null <= 1` is true, so a null (or a string such as "0.3") window passed
  the inlined lanes, the Smi lanes of the not-inlined run and the P1-R12 empty-lane check. The NaN controls fed a
  JS NaN, which the real path (JSON.parse of the tool's stdout) never receives.
- **Root cause:** relational operators coerce null to 0; a control built from in-memory values instead of the
  serialized form the verdict path reads (the B5 shape).
- **Evidence:** .handoff/p1/review-u6/VERDICT-r1.md (null-window probe); fix in test/gates/alloc.test.mjs 943470b6
  (`typeof x === 'number'` in both filters, null-window controls; .handoff/p1/evidence/u6r2-revert.log B1a / B1b).
- **Law:** 9. **Gate:** `npm run gates:local` controls. Reopens with: a checker that reads a tool value without a
  type check.

### B7. The types / docs controls judged one category or one string, not the row's verdict loop *(FOUND 2026-11-11, P1 U7 review r1; FIX r2)*
- **What happened:** test/types.exports.test.mjs judged each .d.ts mutant by reading `r[category]` from the compare
  function, while the real row passes on a separate `CATEGORIES` loop; dropping 'returns' or 'missing' from that loop
  kept 15 / 15 green, and with 'returns' dropped a .d.ts declaring `segmentI32(...): any` passed every gate (tsc
  accepts `r += any`). The returns / params / union checks had no control. test/docs/docs.test.mjs ran its controls on
  bare predicates over hand-written strings; the real rows loop over file lists, so `NAME_FILES = ['README.md']` (llms.txt
  never checked) and TOKEN_FILES without CHANGELOG.md kept every control green.
- **Root cause:** the B5 shape a third time -- a control fed to the predicate (or one category of its result) proves the
  predicate, not the verdict line and the file / category list the real row iterates.
- **Evidence:** .handoff/p1/review-u7/VERDICT-r1.md (reviewer survivors, harness in the burst scratchpad); fix
  round r2 logs .handoff/p1/evidence/u7r2-*.log.
- **Law:** 9. Lesson for every later gate: the verdict is a function (`failing(r)`, `docsProblems(texts)`) that the
  real row and every control call alike, and each list the real row iterates gets one control per member.
- **Gate:** `npm test` (types.exports) and test/docs/docs.test.mjs controls. Reopens with: a gate whose controls do not
  go through the same verdict function and list as its real row.

### B8. `nearest*` was wrong on a rounded tie, and the oracle shared the kernel's expression *(FOUND 2026-11-11, final audit; RULED AU-R1 "FIX, 167 B body (Recommended)", AMENDED AU-R1a "Fable's 189 B body (Recommended)"; FIXED)*
- **What happened:** `x - a[i - 1] <= a[i] - x` rounds both gaps; when they round equal but are not, the kernel took
  the lower index although the upper is closer (F64 / F32 / I32, e.g. `[-3, 4]`, x = 0.5000000000000001, want 1). The
  three oracles (test/oracle.mjs `naiveNearest`, `nearestWith`, `cfNearest`) used the same rounded expression, so
  every oracle, boundary and fuzz row agreed with the bug; the generators never reach a rounded tie.
- **Root cause:** a tie rule written on rounded differences; an expected value taken from the code under test (law 9).
- **Evidence:**
  .handoff/archive/1.0.0/audit/2026-11-11-bisect/reviewer-fable/, reviewer-opus/, cross-fable/ (exact BigInt reference,
  cross-repro.mjs: 22 fixed + 5 fuzz rows); host macOS arm64, node v26.8.2, loads as the CROSS.md files state.
- **Law:** 9, 2 (the body is 189 B in every copy, TRACED by the bytecode gate 8 / 8; Maglev is expected not to inline
  it (189 B >= its 100 B cap; untraced); TurboFan does (inline pin)). Fix: TwoSum tail plus a `p * 0.5 + q * 0.5 !==
  -Infinity` overflow term in scripts/bisect.template.js (AU-R1a); the oracle decides with BigInt; an exact-reference
  fuzz with a floor of false rounded ties >= 1000 on F64 / F32 / I32 (an oracle fix alone has no teeth).
- **Lesson (AU-R1a):** the first fix (AU-R1, 167 B body) returned 0 on F64 `[-Infinity, 1e308]` x = -1e308 (exact 1:
  both rounded distances overflow). helper-B's independent exact test found it; the cross-checker's claim "both
  distances cannot overflow at once" was false.
- **Gate:** `npm test` (oracle, boundary, exact fuzz). Reopens with: a rounded-tie answer that differs from the exact
  reference, or an oracle that shares an expression with a kernel.

### B9. The torture's steady minor GCs were published and never gated *(FOUND 2026-11-11, final audit; REOPENS B4 / P1-R10 via AU-R5 "Reopen B4: minor 0 + pin (Recommended)", AU-R5a "Accept the flag (Recommended)")*
- **What happened:** the torture printed a minor-GC count per steady lane and no verdict held it; with no allocation
  gate in `npm test` or CI, a 16 B/op plant (`globalThis.__bisectBox = x + 0.5;` in upperBoundBranchyF64, 16.03 B/op)
  passed the torture unpinned (cross-opus: a 16 B/op plant passes at the default semi-space).
- **Root cause:** a measured channel with no threshold (the B4 shape again); short-lived allocation moves minor GCs
  only.
- **Evidence:**
  .handoff/archive/1.0.0/audit/2026-11-11-bisect/cross-opus/CROSS.md (17 / 17 audited runs minor = 0; pinned 1 MB:
  the plant
  trips); host macOS arm64, node v26.8.2, load1 1.3 .. 2.6 as stated there.
- **Law:** 9. Fix: steady `{ maxMajor: 0, maxMinor: 0 }`; `npm run torture` passes --no-concurrent-recompilation
  --min-semi-space-size=1 --max-semi-space-size=1 (AU-R5a "Accept the flag (Recommended)": without the tier flag the
  clean build failed under load, 16 / 16 parallel runs exit 1, minor 1..8, concurrent TurboFan left lanes un-inlined;
  NO VERDICT still checks only the two semi-space flags; B11 adds --single-threaded-gc); torture.mjs prints `torture: NO VERDICT` and exits 2 without
  both flags; a must-fail 16 B/op plant (and a `{ x }` plant) exits 1; the audited build must exit 0.
- **Gate:** `npm run torture`. Reopens with: a pinned run with minor > 0 on an unchanged kernel (a test bug), or an
  allocation gate in `npm test` that makes this redundant.
- **Flag tricks (AU-R5b "Class 3, one-line refusal (Recommended)"):** review round 2 found two hand-typed V8
  flag tricks that let a 16 B/op plant pass: a one-dash `-max-semi-space-size=16` after the pin, and `--minor-ms`
  (V8 then reports young GCs as kind 2, which lite-gc-profiler does not count as minor). Class 3; the pin check
  refuses both (NO VERDICT, exit 2), each with a control row. Upstream lead for LiteGcProfiler: classify kind 2.

### B10. The doc gates ran no llms.txt snippets, tiered no d.ts speed word and checked no cited file *(FOUND 2026-11-11, final audit; RULED AU-R4 / AU-R6 / AU-R7; FIXED)*
- **What happened:** (1) llms.txt Usage carried bare `// 1` result comments no gate ran. (2) Bisect.d.ts said "slower
  on incoherent streams" five times with no tier (a speed claim outside the tier law). (3) README / llms.txt cite
  LEDGER ids and RESEARCH.md, which are not in the npm tarball.
- **Root cause:** the docs gate covered README snippets, one sentence and a token list; each other claim had no row.
- **Evidence:**
  .handoff/archive/1.0.0/audit/2026-11-11-bisect/reviewer-*/REVIEW.md, cross-*/CROSS.md; macOS arm64, node v26.8.2.
- **Law:** 9, and the verification tiers (an untiered claim is unproven). Rulings: AU-R4 "Class 2, fix now
  (Recommended)"; AU-R6 "Pointer sentence + docs row (Recommended)"; AU-R7 "Tiered warning (Recommended)". The d.ts
  text and the pointer sentence are in Bisect.d.ts and README.
- **Gate:** test/Bisect.docs.test.mjs rows bare / cite / speed and the llms.txt snippet row, each with planted
  controls through docsProblems (B7). Reopens with: a doc claim in a file no row loops over.

### B11. Concurrent sweeping under load moved the torture's retained term below its floor *(FOUND 2026-11-11, first hosted CI run; RULED P3-R10 "Flag + NO VERDICT refusal (Recommended)")*
- **What happened:** hosted ci.yml runs 43102263215 / 43102509190 (node 26.8.2, ubuntu + macos): torture-controls
  (a) / (b) failed because one UNPLANTED lane, a different one each time, read major 0 minor 0 and retained -1.083 /
  -1.384 / -1.518 B/op, below the -1.0 floor. Locally (Apple M4 Pro, node v26.8.2, 6 children on efficiency cores,
  load1 4.6 .. 18.3 from other sessions over the triage, 10.9 .. 18.3 in the arms logs, untimed): the CLEAN build
  exited 1 in 4 / 60 contended runs; the three arms with no extra flag (box, CLEAN, instrumented box) 12 / 180 runs
  with an unplanted FAIL (16 / 300 with the --no-memory-reducer / --no-flush-bytecode arms); with --single-threaded-gc
  0 / 240 (Fisher one-sided p = 3.1e-5 on 12 / 180; 6.9e-5 on 16 / 300).
  Standalone `npm run torture` on idle runners never tripped (5 / 5, 0.001 .. 0.047 B/op).
- **Root cause:** the settled "before" sample (two forced GCs) read heapUsed while CONCURRENT sweeper threads had not
  yet swept dead code / bytecode; starved, they finished inside the next 200,000-op window: per-space deltas of a
  failing lane, code_space -244,832 / -156,672 B, old_space -181,480 B, trusted_space -64,576 B. Not the memory
  reducer (3 / 60) nor bytecode flushing (1 / 60). A DETERMINISTIC-tier flake is a test bug; it is also fail-open:
  a -1 .. -2 B/op credit can hide a lane retaining 1 .. 2 B/op inside (-1.0, 1.0).
- **Evidence:** .handoff/p3/CI-TRIAGE.md; .handoff/p3/evidence/arms.log, arms2.log, arm.mjs.
- **Law:** 9, and I7 (load moved a gate that looked deterministic: here a GC helper thread moved the gate's own
  settled sample). Fix: `npm run torture` passes --single-threaded-gc; torture.mjs prints `torture: NO VERDICT -- run with
  --single-threaded-gc` and exits 2 without it (or when a later spelling negates it).
- **Gate:** test/Bisect.torture-controls.test.mjs (c2) refusal rows (fail on the old torture.mjs: it imports the
  build and exits 1); `npm run torture`. Reopens with: an unplanted lane FAIL under --single-threaded-gc on an
  unchanged kernel (a test bug), or a V8 that sweeps concurrently under that flag.

### B12. The inline control a1 aborted V8 12.4 / 13.6 *(FOUND 2026-11-11, first hosted CI run; RULED P3-R9 "Driver fix, 2 lines (Recommended)")*
- **What happened:** test/Bisect.inline.test.mjs "control a1" failed on every node 22 / 24 leg (both OS) with
  `driver killed by SIGTRAP`; node 26 passed. The driver planted a caller with %NeverOptimizeFunction, then still
  called %PrepareFunctionForOptimization and %OptimizeFunctionOnNextCall on it.
- **Root cause:** V8 12.4.254.21 (node v22.23.5) and 13.6.233.17 (v24.22.3) treat either call on an
  optimization-disabled function as fuzzer-only misuse: `Check failed: v8_flags.fuzzing`, exit 133. V8 14 ignores it.
  The control was only ever run on node 26 before CI (NEXT.md watch item "node 22 / 24 legs never ran here").
- **Evidence:** .handoff/p3/CI-TRIAGE.md; .handoff/p3/evidence/a1/ (local abort logs, official darwin-arm64 binaries,
  sha256 checked).
- **Law:** 3 (EXPECTED engine behaviour is not TRACED: a %-call contract checked on one V8 only). Fix: the driver
  skips both calls for the never-opt caller; same verdict() path.
- **Gate:** the hosted node 22 / 24 legs of ci.yml; local revert check (old driver SIGTRAPs on v22 / v24). Reopens
  with: a supported Node whose V8 aborts on %NeverOptimizeFunction itself.

### B13. The ab gate's live-path control could not see the seam, and 8 verdict checks had no control *(FOUND 2026-11-12, P3 A/B gate unit review r1 / r2; FIXED r2 / r3)*
- **What happened:** bench/ab-gate.mjs a00955e4 claimed "one control per verdictOf check row" (law 9). Review r1: the
  only control on the live verdict path (a clean ro:16 K=3 child) checked exit 2 + the `VERDICT NO VERDICT` prefix, so
  the mutant `verdictOf(LOG.slice())` -> `verdictOf([])` survived by construction (an empty log is also NO VERDICT);
  7 checks (not TIMED, HEADER unparsed (that mutant read PASS), PROV end > 1, three bop-cell checks, field()
  uniqueness) survived their mutants with `SELFTEST all ok`. Review r2: the strict-number parse had none either; with
  `Number(s)` an empty gated bop cell parsed as 0 and read PASS (null is not zero).
- **Root cause:** the B5 / B7 shape a fourth time: a control whose expected outcome is also the outcome of the broken
  path (NO VERDICT is the default) proves nothing about the path; and "one control per row" was asserted, not listed.
- **Evidence:** .handoff/p3/BRIEF-abgate*.md; overlays .handoff/archive/1.0.0/p3/overlay-abgate{,-r2,-r3}; fix: the clean child must
  name its three reasons (rung, K, 22 missing lanes), fixture rows F29-F36 each killing its own mutant alone (untimed).
- **Law:** 9 (none new).
- **Gate:** `node bench/ab-gate.mjs --selftest` (ab.yml STOP gate), 47 fixture rows (2 sha pins + F1-F45) + 13 timed children. Reopens with: a
  verdictOf check row added without its row.

### B14. The field-keyed C-late3 table controlled one half of each branch, and the row's own ok test none *(FOUND 2026-11-13, CLATE3 review r1; FIXED r2)*
- **What happened:** test/gates/alloc.test.mjs 104e6094 keyed C-late3's tool-gate expectation on the --json `signal`
  field (LiteUtils ruling Q-AP-LB (a)) through one decision, lateGateVerdict, with 52 planted pairs, 0 wrong. Review r1
  mutants survived every row: the paired regex without its `FAIL` word (no paired + exit 1 + wrong-words pair), the
  `typeof stdout === 'string'` check in either branch (no non-string stdout pair), `gate --max 1 ` dropped from the old
  regex (no other --max pair), and the live row's own `=== 'ok'` test weakened to `!== 'FAIL'` (an unknown live signal
  then passed: nothing fed that line).
- **Root cause:** the B5 / B7 / B13 shape a fifth time: each branch is a conjunction (exit AND words), and the table
  planted a miss of only one conjunct per branch; the row's last comparison sat outside the shared decision code.
- **Evidence:** .handoff/archive/1.0.0/clate3/overlay-r1, overlay-r2, .handoff/clate3/evidence/gates-local-r2.txt; fix: 6 pairs (58 in all), and
  the row decides only through the exported lateGateRow, which throws `<verdict>: ...` unless ok and is fed every
  planted pair. Revert check: the old logic as the decision reads 40 of 58 pairs wrong.
- **Law:** 9 (none new): a conjunction needs a control per conjunct.
- **Gate:** `npm run gates:local`, test "control: lateGateVerdict ..." (needs no LiteUtils). Carried open (r2 NIT): the
  live row's call site (deleting its `throw`, or calling lateGateVerdict instead) survives an unknown live signal; one
  clone row `['live --json as read', clone(), 'ok']` would make it a two-change bypass (the case B5 carries open)
  (NEXT.md FILLERS). Reopens with: the first
  lite-utils 1.1.0 run reading other than PASS on this row.
- **Live read (2026-11-22, GATES unit):** the first space-used-paired run read as 1d797ce planned, on the installed
  lite-utils 1.1.0 and on the LiteUtils checkout at v1.1.0 / 65e500c (tools byte-equal): --json exit 0 with top-level
  signal "space-used-paired"; late3 windows 0..5 = 0.00 0.00 0.32 16.00 16.00 16.00; --max exit 1 + `gate --max 1
  (peak B/op): FAIL`; gates 20 / 20 (node v26.8.2 / V8 14.6.202.34-node.28, darwin arm64, load1 2.15..5.22, one run per source plus one inside
  the coder's verify; .handoff/gates/evidence/gates-installed.txt, gates-local.txt, verify.txt). The carried r2 NIT is CLOSED: the
  live row's clones gained `['live --json as read', clone(), 'ok']` (GATES review r2: deleting the row's throw, or
  calling lateGateVerdict at the live call, now fails on a planted unknown signal; .handoff/gates/review-r1/late3-r2.txt).

### B15. The gates-unit resolver left five version / CLI conjuncts without a control *(FOUND 2026-11-22, GATES review r1; FIXED r2)*
- **What happened:** test/gates/lu.mjs gained a `^1.1.0` version check (luVersionOk) and GU-R2 precedence; test/lu.test.mjs
  (40 tests) killed 37 of the reviewer's 45 mutants. Survivors that change behaviour: `\d+` -> `\d*` (`'1.1.'` read ok),
  `\.` -> `.` (`'1-1-0'` read ok), a string compare and a whole-string `v >= LU_FLOOR` (the row '1.10.0' cannot tell them
  apart at floor 1.1.0; only a leading-zero minor can), and a bare `--root` (the CLI crashed exit 1, not NO VERDICT
  exit 2). The nightly.yml header also still said "no test shells out to git" (lu.test.mjs builds git plants).
- **Root cause:** the B14 shape again (law 9): a typed table that covers each branch but not each conjunct of the
  pattern and the compare.
- **Evidence:** .handoff/gates/review-r1/VERDICT-r1.md, mutants-r1.txt; fix: 3 table entries (`'1.1.'` false, `'1-1-0'`
  false, `'1.01.0'` true per the brief's "as numbers") + a bare `--root` CLI row (41 tests); VERDICT-r2.md.
- **Law:** 9 (none new). Carried open: three equivalent mutants (patch compare at floor patch 0, `v ?` on an env string,
  the CLI deciding `r.ok` inline); leading-zero versions read ok (a DESIGN change to refuse them; npm publishes none).
- **Gate:** `npm test` (test/lu.test.mjs). Reopens with: an edit to luVersionOk or the env / installed order that no row
  of test/lu.test.mjs fails.

### B16. A 200 ms settle() timeout failed an unplanted torture lane with every count zero *(FOUND 2026-11-22, nightly run 45024298534; RULED NF-R1 "Re-settle, then NO VERDICT (Recommended)", NF-R2 "Fix + 1 green nightly (Recommended)"; FIXED 2026-11-22, UNIT 2b; NF-R2 MET 2026-11-23, scheduled nightly 45203373228 (ROADMAP 5h))*
- **What happened:** nightly.yml run 45024298534 (2026-11-22T12:49Z, commit 1d797ce), leg `nightly (macos-latest, node
  latest)` (node v27.0.0-alpha.0.1.1, image macos-26-arm64 20261117.0516; the same node and image were green in run
  44906461931 the day before): torture control (b) saw the planted lane fail AND `LANE lowerBoundHintI32 major=0
  minor=0 abGrowth=0 settled=true retainedB/op=0.001 FAIL`. The child's stderr `fails` lines never reached the log:
  assertPlantLane's messages carried only the bad LANE lines. The other four legs were green. The failure came after
  the step-1 streak (11-12..11-21).
- **Root cause:** test/torture.mjs measureLane ends with `const st = await gc.settle();` (lite-gc-profiler 1.16.0
  defaults: quietTicks 2, maxWaitMs 200) and `if (!st || st.drained === false) report.ok = false;`. A main-thread
  stall that delays settle()'s first setTimeout(0) tick to >= 200 ms returns drained:false with no GC entry at all (a
  later stall does not: with no new GC batch the second tick reaches quiet 2 and returns drained:true before it reads
  the clock); gcPass then fails the lane with every count zero. By elimination, no other channel prints that line: with the
  window's rules (steady maxMajor 0 / maxMinor 0, global maxArrayBuffersGrowth 0) and counts 0 / 0 / 0, settled true and
  observed true, checkNoGc returns verdict 'pass' with no violations; only the drained overwrite is left. A wall-clock
  budget inside a DETERMINISTIC gate: a test bug (the tier law), fail-closed but misclassified (drained:false means
  "not verified", which the profiler's own doc says callers can downgrade to inconclusive). Node 27 is not needed.
  The CI trigger is inferred, not observed: a host stall (a hosted macOS VM under node --test's parallel children: the
  failing (b) test took 4,143 ms against 2,364 ms on the same leg the day before; REPORTED, one run each).
- **Evidence:** .handoff/nightfail/run-45024298534.log; .handoff/nightfail/repro.mjs (spawns the UNMODIFIED
  test/torture.mjs with npm run torture's flags; mode `stop` sends SIGSTOP, waits 300 ms, SIGCONT, random 0..400 ms
  gaps). Host Apple arm64, node v26.8.2, untimed, load1 1.13 .. 1.82, 2026-11-22T19:31-19:33Z:
  plain (b) plant 0 / 10 runs with an unplanted FAIL (repro-1.log); stalled (b) plant 6 / 10 (repro-1.log), one on
  lowerBoundHintI32, each with the stderr line `lane X verdict=pass retained=<r> B/op ` (no violations; r 0.001,
  once 0.047); an
  instrumented copy printing st per lane (torture-instr.mjs): every unplanted FAIL `drained=false waited=303.4 ..
  304.2` ms, 3 / 10 runs (repro-2-instr-stop.log); the CLEAN build stalled: 3 / 10 runs exit 1 (repro-3-clean-stop.log),
  so a standalone `npm run torture` is exposed too. After 2b, the same SIGSTOP repro on the new harness (`stop 10 300 400
  none`, 2026-11-22T20:09:57Z, node v26.8.2, the same host, untimed, host PRELIMINARY load1 4.04 -> 3.94): exit 0 10 / 10,
  exit 1 0 / 10, exit 2 0 / 10 (.handoff/nightfail/coder-2b/repro-new.log; revert checks in coder-2b/revert/, fix-r1/,
  review-2b/).
- **Law:** 9 and I7 (load moved a gate that looked deterministic; here a wall-clock budget, after B11's GC helper
  thread). Fix (2a, diagnosability): a failing assertPlantLane prints the child's GATE line and stderr; the torture's
  fails line names `settle drained=<b> waited=<n>ms`. Fix (2b, NF-R1; landed): measureLane re-settles with
  { maxWaitMs: 2000 } when settle() returns drained:false (or nullish); a lane still undrained but otherwise
  ok reads UNDRAINED, one that also fails another channel is FAIL; a control neither flagged nor drained reads
  UNDRAINED (a flagged control stays flagged, drained or not); run verdict FAIL exit 1 > NO VERDICT exit 2
  (stderr `torture: NO VERDICT -- GC observer not drained (lanes: <names>)`) > ok exit 0, never a pass. Test-only hook
  LITE_BISECT_TORTURE_STALL_MS (/^[1-9][0-9]{0,4}$/, else refused exit 2 before the build import) busy-waits that many
  ms in a setTimeout(0) queued before every settle() of lane lowerBoundHintI32 only (.handoff/nightfail/SPEC-2b.md).
  Upstream lead for LiteGcProfiler: settle()'s 200 ms default turns a host stall into drained:false.
- **Gate:** 2a: test/Bisect.torture-controls.test.mjs (e) (synthetic child; fails on the old assertPlantLane). 2b:
  test/Bisect.torture-controls.test.mjs rows (f1) STALL_MS=300 -> exit 0, lane ok (kills: old 2a single settle + report.ok
  overwrite, r1b -> exit 1; bare re-settle removal, r1a -> exit 2); (f2) 2300 -> exit 2, lane UNDRAINED, GATE NO VERDICT
  (kills: UNDRAINED folded into FAIL, r2 -> exit 1); (f3) 2300 + the (a) box plant in another lane -> exit 1 (kills: run
  precedence flipped, r3 -> exit 2); (f4) '0', '300ms', '100000', '' -> refusal exit 2, stdout '' (kills: validation
  removed, r4; '' as unset, m12 -> exit 1 at ''); (f5) 2300 + a retaining plant IN lowerBoundHintI32 -> exit 1 (kills:
  lane-level precedence flip, m11 -> exit 2). Review r1 REJECTED 2 LITERAL (m11, m12 survived the first 10 rows):
  a precedence control must put both conditions on the SAME lane (cross-lane (f3) let m11 survive); r2 APPROVED
  (.handoff/nightfail/review-2b/VERDICT-r1.md, VERDICT-r2.md). npm test 266 / 266 (was 261). Reopens with: an unplanted
  FAIL whose fails line reads `settle drained=true` and no violation (a channel this entry did not see), or an
  undrained lane after the 2000 ms re-settle on an idle host. Open (not ruled): CONTROL-retain's flag reads heap
  samples taken before settle, so an unflagged + undrained retain control reads UNDRAINED (NO VERDICT) per the spec
  where FAIL would be stronger; fail-closed either way. RULED 2026-11-22: NF-R3 "Keep NO VERDICT (as ruled)" (ROADMAP 5i).
  Status 2026-11-23: NF-R2 MET by scheduled nightly.yml run 45203373228 on 4f36e9f (1.0.0, a descendant of bc425e6),
  conclusion success, all 5 legs success (2026-11-23T15:16Z..15:38Z); 1.0.0 released 2026-11-23 (tag v1.0.0).

### B17. Four gates failed open on forged or out-of-domain input; one oracle had no infinity *(FOUND 2026-11-22, independent audit "neon"; CONFIRMED 8 / 8 on cf1b677; RULED NEON-R1..R3; FIXED (committed c883d19 / 08d45c6 / 46efea9 / bc425e6; docs D 8eb9bf8))*
- **What happened:** (neon-2) `bench/ab-gate.mjs --verdict-file` read exit 0 VERDICT PASS on both pinned R4 fixtures for a
  negative bop cell, NaN aa.q1 / aa.q3 / slow.q3, HEADER NQ2=1 minWindow=1, and a dropped or doubled PROV start line -- the
  ab.yml release verdict. (neon-3) the alloc gate's emptyCheck had no lower bound (judge() null for -0.5 / -5). (neon-4)
  lu.mjs never checked the package name (env and installed paths), took a parent repo's commit for a non-git subdir, and its
  CLI guard skipped the CLI through a symlinked path (exit 0, empty stdout; ci.yml:128 relies on exit 2). (neon-1) the
  oracle had no +-Infinity: the mutant runner SURVIVED nearestF32 / F64 "d < u" flipped (exact +Infinity match) and the F64
  AU-R1a guard removed; F32's flip passed every correctness test. (neon-8) gen --check accepted trailing text after END;
  assertRange accepted {length:'5'} and lo = hi = 1e20 on {length: Infinity}.
- **Root cause:** each check bounded one side (an upper bound with no floor, a med with no quartiles, PROV end with no PROV
  start, a version with no name, a HEAD read with no top-level check); and an oracle whose value domain stopped short of the
  contract's (finite only). The first control written for a floor (F37 at -99) sat far from it and let a weakened floor live
  (review A r1), the B5 shape again.
- **Evidence:** .handoff/audit-neon/CONFIRMATION.md + evidence/confirm-head.log (real verdict paths), review-{A,B,C,E}/
  VERDICT-r*.md, evidence/{A,B,C,E}-*.log. Audit: .handoff/archive/1.0.0/audit/2026-11-22/neon/REVIEW.md (gitignored).
- **Law:** 9 (every conjunct gets a control at its bound, failing on it alone). Equivalent mutants recorded, not gaps:
  au-r1a on F32 and the integer types, inf-gt on the integer types; assertRange's typeof n / safe lo / safe hi conjuncts
  (kept: ruled text, NEON-R3).
- **Gate:** ab-gate selftest F37-F45; test/lu.test.mjs name / top-level / symlink-CLI / git-env rows; alloc.test.mjs neon-3
  judge control + the fracnanhint lane (NEON-R1); mutants.json 106 rows (nearest.inf-gt.F64 / F32, nearest.au-r1a.F64);
  oracle INF_GROUPS; test/gen.test.mjs END rows; test/Bisect.boundary.test.mjs assertRange rows. Reopens with: a verdict
  field read without both bounds; an oracle phase whose values miss part of the documented domain.

### B18. A red ab.yml selftest row could not be diagnosed: the child's RESULT line was discarded *(FOUND 2026-11-23, ab.yml run 45079558712 macOS; UNEXPLAINED; RULED ABDIAG-R1 "Observability, then re-dispatch (Recommended)"; replay fixed 2026-11-23, unit ABOBS; the re-dispatch 45087568692 read SELFTEST all ok on both OS, so the control did not fail again; cause still UNEXPLAINED)*
- **What happened:** on the Apple M1 (Virtual) leg, the selftest's must-fail timed control `slow-dead AB2 fw:128`
  printed no `VOID SLOW-DEAD` (`SELFTEST 1 FAIL`; the gate step was skipped; ubuntu read VERDICT PASS gated=13/13). That
  K = 3 child read `VOID (AA-DRIFT)` only: an unspinned A-twin passed slowOk (med > 1.25, q1 > 1.10 vs A). The 11-12
  dispatch 43145179770 passed the same control on both legs (.handoff/rejudge/run-43145179770.joblog:310 macOS, :858
  ubuntu).
- **Root cause:** UNEXPLAINED. The lead "SLOW shares A's block on a lane that mutates it" is DISPROVEN by reading the
  code: makeCols' `a` is kernel source text (block(), bench/ab-gate.mjs:262 at 8eb9bf8), and every column x copy is a
  fresh `new Function` with its own `lane.a.slice()` (buildEntry). The noise lead is unproven: K = 3 with column-major
  entries rotated one step per round keeps each column at nearly the same in-round positions, so one host stall can hit
  SLOW in 2 of 3 rounds. The defect found: a FAILing timed row replayed only the child's last 8 lines (:1155 at
  8eb9bf8). The uploaded logs artifact is a tee of the same stdout, so no CI artifact holds the RESULT / RAW lines.
- **Evidence:** .handoff/abdiag/DIAG.md; job log .handoff/audit-neon/ab/run-45079558712.log:875-882; local repro
  .handoff/abdiag/slowdead-fw128-local.txt (PRELIMINARY: Apple M4 Pro per DIAG.md, the txt names no CPU; node v26.8.2,
  load1 11.67 -> 11.91, quiet-lock run, 8 children: 8 / 8 VOID SLOW-DEAD, per-round SLOW/A 0.86..1.12, per-round AA up
  to 1.65 / down to 0.67).
- **Law:** 9 (none new; applied to a failing control). A control that fails must leave the numbers it failed on in the
  uploaded logs, otherwise its red run is a finding nobody can diagnose.
- **Gate:** ABOBS (bench/ab-gate.mjs failReplay + selftest row `SELFTEST replay: ...`, run first in every `--selftest`,
  so in ab.yml's STOP gate): the selftest replays a FAILing child's (timed or fixture) RESULT / RAW / VOID / ORACLE /
  STOP / CRASH lines from before its last 8 lines, then those 8 lines unchanged. The row is untimed (a stub child
  output, no spawn) and pins row()'s printing call by its source text (String(row).includes); revert-checked: tail-only,
  row() back to the 8eb9bf8 tail, the slice boundary +-1, the whole output filtered, each prefix kind, the `^` anchor
  (.handoff/abobs/VERDICTS.md). Then ONE ab.yml re-dispatch (ABDIAG-R1).
  Reopens with: a second red on any selftest control after that fix, read from its replayed lines; or a red selftest
  whose selftest.log lacks the failing child's RESULT line.
  Status 2026-11-23: the re-dispatch 45087568692 (3621f69) read `SELFTEST all ok` on both OS, so neither Reopens
  condition fired and no replay was printed. The 45079558712 failure stays UNEXPLAINED; the re-dispatch's gate step then
  gave no verdict for a different reason (B19).

### B19. Hosted A/A drift voided gated lanes on both OS in the ab.yml re-dispatch *(FOUND 2026-11-23, ab.yml run 45087568692; mechanism PRELIMINARY; RULED AB-G3 "Re-judge Nov 12 run (Recommended)"; P3-R1 MET on 43145179770, ROADMAP 5f / 8)*
- **What happened:** the one re-dispatch of a NO VERDICT run (Q-AB-K), on 3621f69, node v26.8.2 / V8 14.6.202.34-node.28
  on both OS: `SELFTEST all ok` on both OS, then `VERDICT NO VERDICT (gated lane not clean)` on both. ubuntu (AMD EPYC
  7763): uni:65536 VOID AA-DRIFT, aa 0.941[0.926..0.951], gated-clean=12/13. macOS (Apple M1 (Virtual)): uni:256 aa
  1.051[0.762..1.133], walk:65536:1 aa 0.945[0.807..1.064], walk:65536:4 aa 1.099[0.953..1.218], ro:65536 aa
  0.913[0.906..1.005], all VOID AA-DRIFT, gated-clean=9/13. No clean gated lane read another word (no FINDING). A second
  NO VERDICT stops for a ruling.
- **Root cause:** hosted-runner noise, PRELIMINARY. The A/A twin times A against itself, so a drift is not a kernel
  result; the gate failed closed as designed. macOS PROV start load1 58.98 (end 11.32) fits; ubuntu PROV start load1
  1.85 (end 1.09) shows no contention, so noise is not shown there: the ubuntu drift is UNEXPLAINED. The run had no
  quiet host and one run per OS.
- **Evidence:** `gh run view 45087568692 --log` (saved as .handoff/rejudge/run-45087568692.joblog); the re-judge of
  43145179770 in .handoff/rejudge/REJUDGE.md (11-12, 679dcad: PASS gated=13/13 on both OS by the 3621f69 gate, log
  sha256/8 6035afb2 ubuntu, d6cc3927 macOS; the equivalence check found no timing-path change since 679dcad).
- **Law:** 5 (a timing verdict needs its controls and a range, never one run); none new.
- **Gate:** .github/workflows/ab.yml + bench/ab-gate.mjs (STATISTICAL), unchanged: the A/A control is the gate working.
  Reopens with: a gated lane reading another word (a FINDING) on any later ab.yml dispatch; a timing-path change to
  bench/ab-gate.mjs, ab.yml or the frozen kernels after 3621f69 (the 43145179770 verdict then no longer applies); a
  later A/A drift VOID on a dispatch whose PROV load lines show no contention on either leg (noise would then be the
  wrong mechanism). PROV load1 is the guest's own: hypervisor steal does not show in it, so this clause cannot see
  contention outside the guest.

---

## C. Measurement lessons (this package's own runs)

### C1. An inherited byte count described a different body *(FOUND 2026-11-10, P0 U2)*
- **What happened:** ROADMAP R-11 and LEDGER I2 said the branchless kernel is "98 B, just under
  Maglev's 100 B". The frozen draft's `lowerBoundBranchless` reads 103 B (`upperBoundBranchless`
  103 B); Maglev refuses it ("big function, size (103) >= max-size (100)") on every call path.
- **Root cause:** 98 B was LiteLogLogN's `_lb16` (Uint16Array, base offset), copied across as if
  it described this body. The draft's empty-range guard alone costs 10 B (93 B without it).
- **Evidence:** `.handoff/research/p0/PROGRESS.md` U2 + U2x; logs/u2-bytecode.log,
  u2x/v.mjs (sha 700464a0): v3 (guard folded into the return, `h & -(a[b + h] < x)`) 92 B,
  1,147,713 oracle checks, 0 bad; speed unmeasured (since measured: C7).
- **Law:** 3 (EXPECTED is not TRACED) extended: a number inherited from another package's body
  is a hypothesis about this body until measured here.
- **Gate:** none yet. P1 bytecode gate `< 100 B` on every kernel Maglev should inline; the branchless
  pair is not one of them (C7: the 103 B body stays, its gate pins TurboFan inlining). Reopens
  with: a Node / V8 change to these bodies' bytecode or to Maglev's inline limit.

### C2. A non-Smi F64 query boxes 16 B per call across a non-inlined call *(MEASURED 2026-11-10, P0 U3)*
- **What happened:** every kernel reads 0.07 B/op (= the floor) when inlined into its caller.
  With `--no-turbo-inlining` (an optimized callee that is not inlined), smi queries stay at
  0.07 and frac / >= 2^31 / NaN queries read 16.06 = one HeapNumber per call, all 8 kernels.
- **Root cause:** a double argument crosses a real call as a HeapNumber (LEDGER I8, FastBit32
  law 1, here on the query instead of a result).
- **Evidence:** `.handoff/research/p0/PROGRESS.md` U3; logs/u3-bench.log, u3-bench-noinl.log,
  u3-diag.log. alloc-per-op d4386d85, node v26.8.2, load1 13.5-34.8 (untimed).
- **Law:** 8 confirmed on this package: zero-GC holds where the kernel inlines into its caller,
  or the query is a Smi. The contract must say so; R-11's selector is free on inlining (U2),
  so a selected kernel inlines exactly where a directly imported one does.
- **Gate:** none yet. P1 alloc gate needs a not-inlined lane with a non-Smi query, which must
  read one box (16 B), so the gate is seen to work. Reopens with: a V8 that passes doubles
  unboxed across a non-inlined call (the not-inlined lane would then read the floor).

### C3. Per-type feedback: one shared fn and a factory both go megamorphic; a type-dispatch front keeps it *(MEASURED 2026-11-10, P0 U1)*
- **What happened:** fed Float64 / Float32 / Uint32 / Uint16 / Int32 in turn, one shared
  `lowerBoundBranchless` ends MEGAMORPHIC on both keyed loads (U1a). Five closures from one
  literal move the SAME sites to MEGAMORPHIC (U1b, lazy and eager feedback allocation alike).
  An `instanceof` front over five per-type literals leaves all ten callee sites MONOMORPHIC
  (U1c raw states; the tool's own verdict on that pair was NO-VERDICT, U1cw corroborates).
- **Root cause:** one FeedbackCell per function literal per native context (V8
  function-architecture.md, feedback-cell.h).
- **Evidence:** `.handoff/research/p0/PROGRESS.md` U1; logs/u1-*.log; ic-diff 11279540.
- **Law:** none new (3 confirmed: the ROADMAP's "believed to share ONE feedback vector" was a
  hypothesis; it held).
- **Gate:** none yet. R-4 option 2 (factory) is dead on this evidence; option 1 (one literal per
  type, hand-written or generated) and the front stay in. Reopens with: a V8 change to feedback
  sharing between closures of one literal (ic-diff on U1b no longer MEGAMORPHIC).

### C4. The length switch loses: the linear arm is slower than branchless at every n <= 8 *(MEASURED 2026-11-10, P0 T1; R-1 DROP)*
- **What happened:** `lowerBound` (linear at n <= `LINEAR_MAX` = 8, else branchless) vs
  `lowerBoundBranchless`, random sub-ranges, uniform queries. In the `--strict` hold it read SLOWER at
  every n = 1..8 (1.640..3.325, B - A 3.80..5.21 ns/op), WITHIN at n = 9..32 (1.004..1.037) and
  SLOWER on the mixed-length lane (1.120). No n was FASTER. Rule (INTAKE A1): DROP the switch.
  Linear vs branchy (report): linear FASTER up to n = 48, WITHIN at 52..64.
- **Root cause:** not established. Hypothesis, untraced: the linear exit branch is unpredictable
  on a random stream and the branchless loop has no data-dependent branch. LogLogN S0's "linear wins at k <= 4" came from
  another pair and stream; it did not transfer.
- **Evidence:** `.handoff/research/p0/PROGRESS.md` T1 + strict re-run; logs/t1-1.log (run 1),
  logs/t1-strict.log (verdict). Apple M4 Pro, node v26.8.2 / V8 14.6.202.34, K = 11, C = 3, lab
  25f677ab, frozen draft 3af35dca; strict entry QUIET (load1 3.18 vs baseline 2.21), busy-node none.
  PRELIMINARY tier: one CPU, one run per verdict.
- **Law:** 4 and 6 confirmed on this package (a switch must win measured or go; a crossover belongs
  to the pair, the size and the stream).
- **Gate:** none (no switch ships: REFUSED, A4 / Q-KERNELS). Reopens with: an x86 run (R-10)
  where some n is FASTER <= 0.909 and none SLOWER, or a caller stream where the linear exit is
  predictable, measured at that caller.

### C5. The hint gallop wins on coherent streams at n >= 4,096 and costs 2.4-3.4x on incoherent ones *(MEASURED 2026-11-10, P0 T2; R-2 STANDS)*
- **What happened:** `lowerBoundHint` (hint = previous answer) vs `lowerBoundBranchless`. In the
  `--strict` hold: n = 4,096 d = 1 / 4 FASTER 0.614 / 0.913; n = 65,536 FASTER 0.436 / 0.654;
  n = 256 SLOWER 1.107 / 1.683. Uniform (control) SLOWER 3.402 / 2.842 / 2.375. It stops winning at
  d = 64 (n >= 4,096). Rule: STANDS (FASTER at d <= 4 at 2 of 3 sizes). Run 1: every word matched; ratios within 3% relative (largest gap 0.093,
  walk:256:64).
- **Reason:** a gallop pays O(log d) probes plus its own bytes (228 B, U2); it beats a fresh
  O(log n) search only when d is small against n, and loses outright when the query is not near
  the hint.
- **Evidence:** PROGRESS.md T2 + strict re-run; logs/t2-1.log, logs/t2-strict.log. Same host and
  build as C4. T2 ran after T1 in the same hold: load1 3.52 at T2 start, 3.79 at end; QUIET was
  checked at hold entry only. Run 1 (non-strict): host PRELIMINARY, load1 3.69. PRELIMINARY tier.
- **Law:** 6 (per size); a kernel that loses 2-3x on the wrong stream cannot be automatic (ROADMAP
  section 1: the caller knows coherence, the kernel does not).
- **Gate:** none yet. Reopens with: an x86 run, or a real per-frame site trace (R-2 asks for
  Keyframe / MotionPath / Virtual) whose step distribution differs from the random walk.

### C6. One VOID lane in run 1 did not reproduce in the strict hold *(FOUND 2026-11-10, P0 T1; REOPENED 2026-11-11, P0 T3)*
- **What happened:** run 1 of T1 VOIDed `sw:mix` on A/A drift (0.933 [0.924..0.947], band
  0.95..1.05; tight IQR), so the lab printed UNRULED. The `--strict` re-run read A/A 1.009 there
  and every fixed-n word matched run 1.
- **Reason:** not established. A and AA differ by compilation, by their own arrays and by their slot in the
  shuffled interleave; law 5 / I4 record up to
  ~20% one-compilation bias, and a tight IQR does not prove a structural cause.
- **Evidence:** logs/t1-1.log line 44-45 vs logs/t1-strict.log. Run 1: host QUIET at start
  (load1 3.10), non-strict.
- **Law:** 5 (a verdict needs a range, never one run) and 9 (the lab failed closed instead of
  printing DROP). The VOID was resolved by the registered re-run, not by argument; it was not
  overridden.
- **Gate:** none. Reopens with: a second `sw:mix` A/A VOID (any run): then investigate the A copies
  (per-copy code layout) before any re-run.
- **Reopened 2026-11-11 (P0 T3 strict, logs/t3-strict.log; the listed trigger names sw:mix, reopened on the
  same mechanism):** both mixed-length lanes VOIDed on A/A
  drift in one run (lb:mix 1.070 [1.061..1.072], ub:mix 0.941 [0.935..0.954]); every fixed-length
  lane's A/A was in band (0.988..1.009). T3 was ruled on its fixed lanes (INTAKE A5, C7). Open: the
  per-copy layout investigation of the mixed-length lanes; no mixed-length lane counts until it closes.

### C7. The 92 B branchless body inlines under Maglev but reads SLOWER under TurboFan at every fixed n = 1..32; the 103 B body stays *(MEASURED 2026-11-10T23:08Z (UTC), RULED 2026-11-11, P0 T3; Q-BODY (c))*
- **What happened:** v3 (empty-range guard folded into the return, `h & -(a[b + h] < x)`, 92 B; upper
  form `<=`, 92 B) vs the frozen 103 B branchless bodies, lower and upper pairs, random sub-ranges
  n = 1..32 plus a mixed-length lane, uniform queries. `--strict` hold (entry QUIET, load1 2.78 vs
  baseline 2.21): v3 SLOWER at every fixed n in both pairs (lower 1.088..1.255, upper 1.101..1.279;
  B - A 0.17..1.46 ns/op on A 1.90..9.86 ns); never FASTER. Both mixed-length lanes VOID (A/A drift,
  C6), not quoted. Run 1 (host PRELIMINARY, a non-verdict run) agreed at every fixed n except lower
  n = 1 (WITHIN 1.013). Traced, untimed: TurboFan inlines both bodies into every traced caller copy
  (lb:8, lb:mix, ub:8: 36 / 36); Maglev
  refuses both 103 B bodies ("big function, size (103) >= max-size (100)") and inlines both 92 B
  bodies. The A3 rule printed UNRULED for both pairs (a VOID mix lane); maintainer
  ruling (INTAKE A5): KEEP the 103 B body for lower and upper on the fixed lanes.
- **Root cause:** not established. Hypothesis, untraced: `-(cmp)` negates a boolean and -(false) is
  -0, a double, so the mask may leave int32 where `(0 - (cmp | 0)) & h` stays int32. The int32 mask
  with the folded guard (u2x/v4.mjs) reads 104 B, so no < 100 B int32 form is known (untimed).
- **Evidence:** `.handoff/research/p0/PROGRESS.md` T3; logs/t3-1.log (run 1), logs/t3-strict.log
  (verdict), t3-trace-turbo-summary.log, t3-trace-maglev.log, u-t3-bytecode.log, u-t3-v4.log. Apple
  M4 Pro, node v26.8.2 / V8 14.6.202.34, K = 11, C = 3, lab e8942567, frozen draft 3af35dca, v.mjs
  700464a0, v3u.mjs fdab97ca; strict busy-node none. PRELIMINARY tier: one CPU, one strict run.
- **Law:** 3 confirmed (INTAKE A3's EXPECTED Maglev decisions, 103 B refused and 92 B inlined, were
  traced at the caller and held); 2 confirmed in the Maglev tier only (the kernel's 103 B, not the
  caller, decided the inline; TurboFan inlined every traced copy, so its cumulative budget was not
  exercised). Lesson: fewer bytes is not faster.
- **Gate:** P1 bytecode gate on the branchless pair pins TurboFan inlining into a caller, not
  `< 100 B`; the docs say Maglev does not inline them (its 100 B single-inline cap). Reopens with: a
  < 100 B body that keeps an int32 mask and is not SLOWER at any n; a V8 change to Maglev's cap or
  to these bodies' bytecode; an x86 run (R-10).

### C8. `--no-turbo-inlining` alone still inlines under Maglev; the empty harness lane reads up to 1.03 B/op under load *(MEASURED 2026-11-11, P1 U6; RULED P1-R11, P1-R12)*
- **What happened:** (1) with `--no-turbo-inlining` only, alloc-per-op's driver ran as Maglev code through
  windows 0-1 and Maglev inlined the lane and the 55 B branchy body: the 30 branchy non-Smi lanes read 0.49..0.86
  B/op in window 1, then ~16.4 from window 2 (with --warm 2e5 and 5e6). (2) An EMPTY lane under run A's flags read
  0.78 / 1.03 / 1.03 B/op in windows 0-2 at load1 ~28 (other sessions' suites), above the 1.0 inlined ceiling; at
  load1 2-9 it read <= 0.52.
- **Root cause:** (1) the not-inlined contract needs both tiers' inlining off (law 3: the flag was EXPECTED to cover
  it). (2) harness / JIT allocation lands in the counter's 256 KiB steps; one extra step at N = 1e6 is 0.26 B/op.
- **Evidence:** .handoff/p1/evidence/u6-harness-probe.log, u6-gates.log, u6r2-gates.log (node v26.8.2, LiteUtils
  085c54d / aed6684, untimed counts). Revert R9a / R9b in u6-revert.log.
- **Law:** 3, 8. Rulings: P1-R11 (run B = `--no-turbo-inlining --no-maglev-inlining`, tier check requires both),
  P1-R12 (same-run empty lane > 1.0 in any window 1..5 = NO VERDICT, never a pass). Open: run A headroom is about
  one quantum (max 0.78 vs 1.0), fail-closed but may read NO VERDICT / FAIL on a loaded host.
- **Gate:** `npm run gates:local`. Reopens with: a V8 change to Maglev inlining flags, or an empty lane > 1.0 on a
  quiet host.

### C9. The NaN-hint box is made by the CALLER, not the kernel *(MEASURED 2026-11-11, final audit D4; RULED AU-R2 "Class 2, release-blocking (Recommended)", AU-R3 "Caller-box wording (Recommended)"; refines C2)*
- **What happened:** the old sentence said the QUERY boxes. cross-fable's probe (real kernel vs a stub): a NaN hint
  read from a Float64Array reads 16.03 B/op for the audited kernel and for the 0-parameter stub alike; the literal NaN
  reads 0.03. cross-opus: a local 5-parameter callee that never reads h boxes 16.02 B/op. So the box is the caller's
  argument materialisation across a call V8 does not inline, not the kernel's body.
- **Root cause:** a double passed as an argument across a real call is a HeapNumber (C2, I8); NaN read from a typed
  array is not a Smi, and lo / hi (-0) and the hint are arguments too. The old sentence named the query only.
- **Evidence:**
  .handoff/archive/1.0.0/audit/2026-11-11-bisect/cross-fable/CROSS.md and cross-repro.mjs (`--d4`, lanes
  smiq_nan_from_f64
  16.03 vs smiq_nan_literal 0.03 B/op; flags in its header), cross-opus/CROSS.md (2 runs, load1 2.58); host macOS
  arm64, node v26.8.2.
- **Law:** 8. Fix: the AU-R3 sentence in Bisect.js / Bisect.d.ts / README / llms.txt / the docs test QBOX literal (one
  line, character-identical), README "Known limits", and alloc lanes lowerBoundHint<T>.nanhint (must read one box,
  14.0..18.0 B/op in run B) and .nanlit (<= 1.0 B/op in both runs).
- **Gate:** the docs Q-BOX row (DETERMINISTIC) and `npm run gates:local` lanes. Reopens with: a V8 that passes a
  double unboxed across a non-inlined call.

### C10. On the generated F64 kernels: C5 reproduces, branchless is 2-3x branchy read-only, and I1 reproduces when the result feeds copyWithin *(MEASURED 2026-11-11T23:10-23:12Z (UTC), P3 research burst `ab` R1 + R2; reopens nothing, ruled at the PROPOSAL-ab handshake)*
- **What happened:** `--strict` hold, entry QUIET (load1 1.95 vs baseline 2.21), K = 11, C = 3, ratio B / A.
  Q1 hint vs branchless: every C5 word reproduced (walk d = 1 / 4 FASTER 0.622 / 0.917 at n = 4,096, 0.451 / 0.676 at
  65,536; SLOWER 1.094 / 1.654 at 256; uniform SLOWER 3.403 / 2.796 / 2.399), each ratio within 0.05 of C5's (largest gap uni:4096 2.796 vs 2.842).
  Q2 read-only, branchless vs branchy, uniform queries: FASTER 0.330 / 0.328 / 0.347 / 0.469 at n = 16 / 256 / 4,096 /
  65,536. Q2 feeds-write (per op: search, copyWithin insert, search, copyWithin delete): branchless SLOWER 1.489 / 1.482 /
  1.128 / 1.052 at n = 16 / 128 / 1,024 / 2,048 (same direction as I1's 1.089 .. 1.224; fw:16 / 128 above that band). Run 1 agreed at every word but
  fw:2048 (WITHIN 1.038). Under 4 spinners (R3) every word but fw:2048's held from K = 5 (fw:2048 flipped at every K).
- **Reason:** I1's mechanism, untraced here: the branchless position is data at the end of a load chain and the copy
  waits on it; branchy's predicted branch lets the copy start early. As n grows the copy dominates and the ratio falls
  toward 1. Read-only, nothing waits, and the branchless loop has no data-dependent branch to mispredict.
- **Evidence:** .handoff/research/ab/PROGRESS.md R1 + R2; logs/r12-1.log, logs/r12-strict.log; INTAKE-2026-11-12.md.
  Apple M4 Pro (128 B lines, 16 KB pages), node v26.8.2 / V8 14.6, lab 8128d400 (P0 lab e8942567 + the R0 diff, claims
  review in this burst), frozen 88e5b1c-10add825. PRELIMINARY: one CPU (law 7), F64 only, n <= 65,536, powers of two.
- **Law:** 1 confirmed on this package (the consumer decides: the same pair is 3x one way read-only and 1.5x the other
  feeding a write); 6 (the fw ratio shrinks with n).
- **Gate:** none yet; the STATISTICAL release gate is PROPOSAL-ab (Q-AB-*). Reopens with: an x86 run (R4) that reads
  another word at a high-margin lane; an out-of-cache read-only lane (Q-AB-LARGEN; algorithmica prior art: branchless
  can lose out of cache). R4 (C11) ran x86: no high-margin word moved; C10 stands.

### C11. On hosted x86 and an arm64 VM the 13 gated words hold; x86 differs at the low-margin walk:256:1 and fw:2048 and in the feeds-write size *(MEASURED 2026-11-12T00:24-00:30Z (UTC), P3 unit R4, ab-research.yml run 43127032794; REPORTED)*
- **What happened:** one dispatch, one run per OS, lab bench/research/ab-lab.mjs 211bef39 (= 8128d400 except the
  frozen path), K = 11, C = 3, node v26.8.2 / V8 14.6.202.34-node.28. Selftest 10 / 10 on both. ubuntu-latest (AMD
  EPYC 9V45, 4 vCPU, load1 0.60): exit 0, A/A 0.987..1.006 on all 23 lanes. macos-latest ("Apple M1 (Virtual)", 3 vCPU,
  load1 9.10 at start, just booted): exit 2, VOID AA-DRIFT on walk:256:1 and walk:65536:8192 (neither gated). The 13
  gated lanes (Q-AB-LANES) read their expected words on both, A/A median inside 0.95..1.05. x86 differs from the M4 Pro
  at walk:256:1 (hint WITHIN 1.016 vs SLOWER 1.094: "C5 DIFFERS", a REPORTED lane; VOID on the M1 VM) and in size,
  not word, at fw:16 / fw:128: SLOWER 1.196 / 1.249 vs 1.489 / 1.482 (M4 Pro) and 1.617 / 1.433 (M1 VM),
  margins 0.146 / 0.199 under the 0.25 that picked the 13. Read-only branchless FASTER 0.326..0.431 (x86) and
  0.372..0.547 (M1 VM). fw:2048 WITHIN on both hosted CPUs (M4 Pro strict SLOWER 1.052,
  margin 0.002; run 1 WITHIN 1.038).
- **Reason:** not traced. Law 7 (branch prediction and memory ordering are per CPU); the cache geometry differs as
  ROADMAP 8a item 5 says (x86 64 B lines / 4 KB pages / L1D 48 KB / L2 1 MB; Apple 128 B / 16 KB / 128 KB / 12-16 MB),
  but at n <= 65,536 F64 (512 KB) no gated word moved with it. The arm64 VM's VOIDs coincide with its boot-time load (A/A
  IQRs up to [0.865..1.064] on gated uni:256), the R3 S = 10 picture (A8): failed CLOSED, no wrong high-margin word.
- **Evidence:** .handoff/research/ab/PROGRESS.md R4; run on e9c6ae8 (ab-research.yml c8b4ca64); logs/r4-43127032794/ (provenance, selftest, rung-all, exit-code,
  ksub-*). REPORTED: hosted, no quiet lock, one run per OS; runner CPUs vary per dispatch.
- **Law:** 7 (an x86 leg changed a low-margin word and the feeds-write size); none new.
- **Gate:** .github/workflows/ab.yml + bench/ab-gate.mjs (P3 A/B gate unit, 2026-11-12; STATISTICAL, not yet dispatched).
  Consequence applied there: the R0 lab's exit 2 fired on any kill-rule VOID (walk:256:1 included), which would make this
  dispatch NO VERDICT on macOS; the gate lab scopes its verdict and exit to the 13 gated lanes (its fixture F2 is this
  run's macOS log and reads PASS). Reopens with: a gated lane reading another word on a release dispatch; a runner CPU
  family not seen here.

### C12. Two non-Smi arguments across a non-inlined call box 2 x 16 B *(MEASURED 2026-11-22, audit neon confirmation; RULED NEON-R1 "Amend + gate (Recommended)"; refines C2 / C9)*
- **What happened:** the shipped AU-R3 sentence said "one 16 B HeapNumber per call". Under the pinned flags
  (--no-turbo-inlining --no-maglev-inlining, semi-space 4, single-threaded GC) lowerBoundHintF64(fractional x, NaN h, both
  read from Float64Arrays) and lowerBoundBranchlessF64(-0 lo read, fractional x) read 32 B/op; one non-Smi argument 16;
  Smi only 0 (2 runs, node v26.8.2, M4 Pro, load1 2.31, untimed counts; .handoff/audit-neon/evidence/confirm-head.log).
  Batch B's fracnanhint lane reads 32.00 B/op in every run-B window on all five types (evidence/B-gates.log).
- **Reason:** the CALLER boxes each non-Smi number argument it passes across a real call (C9); the count is per argument.
- **Law:** 8. **Gate:** gates:local fracnanhint lane, run B [28, 36] B/op, run A the floor. Reopens with: a V8 that passes
  doubles unboxed across calls (the lane then reads the floor and fails low).

### C13. Hinted upperBound / segment: exact with no extra hot bytes; a one-tail body inlined two channels where the shipped hint got one, and beat the caller's workaround on a playhead; a fast check's caller deopted *(MEASURED 2026-11-23, research burst `seghint` R0 + R1 untimed, R2 / R3 one QUIET strict hold (REPORTED); PROPOSAL-seghint RULED SH-R1..SH-R9, SH-R4 PASSED; SH-R9 hold 2026-11-23 kept V-1TAIL)*
- **What happened:** ROADMAP 8a item 11 asked for hinted kernels at the segment / upperBound call sites. R0: the
  lowerBoundHint template with `<` -> `<=` (V-MIRROR) and a one-tail rewrite (V-1TAIL) are exact against a
  linear-scan oracle on 5 types (2,082,484 calls per lane, 0 fails; NaN x, NaN / out-of-range hints, duplicates,
  +-Infinity, -0, empty ranges, sub-ranges; 2^30 - 1 range returns). The audit's segHintFast fails 83,015 of them
  (NaN x: the B1 flipped predicate; NaN hint: never mapped to lo). R1 (TurboFan, frame callers in feedback form,
  fractional x; traced on the R1 harness: n = 4,096, 45,000 warm calls, forced compile): V-1TAIL is 214 B
  (214 B measured with an imported inner; 212 B as shipped, X-8) (+31 B
  segment wrapper; today's lowerBoundHint is 228 B) and TurboFan inlined 2 of 3 channels where V-MIRROR and today's
  lowerBoundHint got 1 (c2 15.87, c3 31.71 B/op). The byte sums do not predict this (2 x 434 = 868 < 920): mechanism
  unverified, so every consumer traces its own caller (law 2). V-1F (268 B, one tail + fast check): its TurboFan caller
  still deopted ("Insufficient type feedback for binary operation") after a 4-wrap warm-up; V-FAST (282 B) reads the
  floor at 3 channels (upper form only; the segment form reads 15.88) because its tail call stayed cold and un-inlined (a JIT feedback outcome, not a size).
  Warm-up Maglev deopts of the same kinds appear in every hinted body, the shipped lowerBoundHint included. Workarounds over the shipped lowerBoundHint: nextUp(x) is exact except
  x = +Infinity with +Infinity in the range, but costs 635 B per channel and two boxes per non-inlined call;
  floor(x) + 1 is exact on integer types; the "i, or i - 1 when a[i] !== x" shortcut is wrong with duplicates.
  R2 / R3 (one `quiet-lock run --strict` hold, QUIET, R2 x 2 + R3 x 1, K = 11, C = 3, feedback form, F64): V-1TAIL's
  segmentHint FASTER than the nextUp workaround over lowerBoundHint on 19 of 25 coherent cells in both runs (B1/W
  0.81 .. 0.88 on every playhead cell; walk1 / walk4 split FASTER / WITHIN), WITHIN it on 13 of 15 incoherent cells;
  on uni, walkN8 (n >= 256) and walk64 (n <= 4,096) both cost more than plain segment (B1 1.35 .. 3.11x, W 1.33 ..
  3.10x: the shipped hint's cost class). On one channel per frame function the
  fast-check body V-FAST read lower still (BF/W 0.60 .. 0.78 on play8 / play2 / walk1; WITHIN on play_2 at n >= 256),
  with no direct BF/B1 column and no multi-channel lane: ruled SH-R9 = measure first. The SH-R9 hold (one QUIET
  strict hold, R2 at 1 / 2 / 3 lookups per frame, run twice) kept V-1TAIL: BF/B1 FASTER 0.71 .. 0.91 on play8 /
  play2 / walk1 at one lookup (SLOWER on play_2 at n <= 65,536), but SLOWER 1.06 .. 1.58 on 37 of 50 cells at 2 / 3 lookups in both
  runs; V-FAST's B/op tier (read as one more call site un-inlined) was above V-1TAIL's on 36 of 50 cells, 33 of them SLOWER (play_2 at n >= 65,536 is SLOWER at equal tier); V-1TAIL beat W on
  all 100 multi-lookup run-cells (0.50 .. 0.80).
- **Reason:** the cumulative TurboFan budget (920 B) is charged per inlined body and inner site (law 2), but the
  traced counts are not the plain byte sums (the trace also counts "existing opt code's inlined bytecode size"): the
  exact accounting is unverified. A fast check returns before code that then collects feedback later, so a path can
  stay cold past the warm-up and deopt the compiled caller when first reached.
- **Measurement trap (audit harness):** a hint lane fed from a PRECOMPUTED hint array has no loop-carried dependency,
  so it measures throughput where a consumer (`h = f(..., h)`) pays latency, and a hinted kernel compared with the
  NON-hinted one re-measures C5's hint-vs-no-hint trade, not the new kernel against what a caller can already write.
  Every seghint lane runs in feedback form with the workaround as the baseline.
- **Evidence:** .handoff/research/seghint/PROGRESS.md (INTAKE, R0, R1, R2 / R3 strict hold, SH-R9 strict hold), logs/r2-1.log, logs/r2-2.log,
  logs/r3.log (2026-11-23T00:55:07Z-00:59:05Z (UTC), load1 1.90 -> 1.24, QUIET; REPORTED), logs/r2-inject.log, logs/r9-1.log, logs/r9-2.log, logs/hold-r9.log (SH-R9, 2026-11-23T07:48:49Z-07:58:47Z (UTC), load1 2.28 .. 4.47, QUIET; REPORTED; r9-ab.mjs 32f9527f, r9-apply.mjs 048f3f18), logs/r0.log, logs/r1.log (2026-11-22T22:59:05Z-22:59:15Z
  (UTC), load1 2.38 -> 5.27 per its PROV lines), logs/r1-deopt.log; probes cand.template.js, r0-oracle.mjs, r1-inline.mjs over the frozen build 2352ccf /
  9a591998; node v26.8.2 / V8 14.6.202.34-node.28, Apple M4 Pro. R0 / R1 untimed (DETERMINISTIC on that engine, not
  gated); R2 / R3 and SH-R9 REPORTED (two local QUIET holds; x86 not run, law 7).
- **Law:** 2, 4, 8, 9 (none new). **Gate (1.1, landed):** oracle + `runHintSweep` (linear-scan
  reference), 146 mutant rows (`test/mutants.json`), bytecode `"=="` rows 212 B / 31 B (`test/gates/expect.json`,
  all 5 copies equal), the inline pin (75 single-channel edges every Node; 25 two-channel edges on node v26.8.2
  only, with the c3 control), alloc gate 225 lanes, torture 45 lanes.
  Reopens with: an explanation of the traced budget accounting, a consumer whose own A/B shows one lookup per frame function on play8 / play2 / walk1-like streams (V-FAST), an x86 run, a V8 that changes the cumulative budget or inlines cold calls,
  or a consumer trace with >= 3 channels in one frame function.

### C14. A bytecode size read on a probe that imports its inner carries +2 B per site *(MEASURED 2026-11-24, X-8; node v26.8.2, --print-bytecode, untimed, one probe run, as .handoff/archive/1.1.0/seghint-1.1/evidence/bytecode-cause.txt states)*
- **What happened:** R1 read the one-tail upperBoundHint at 214 B on a probe that IMPORTS upperBoundBranchless<T>
  (cand.gen.mjs); the shipped Bisect.js reads 212 B (all 5 copies equal). SH-R2 had quoted 214 B.
- **Root cause:** an imported binding loads with LdaModuleVariable + ThrowReferenceErrorIfHole (a 2 B TDZ check) per
  call site; a same-module declaration loads with LdaModuleVariable only. One inner call site: 214 - 2 = 212. The same
  trace cross-checks: the 2-tail mirror with 2 import sites read 232 = 228 + 2 x 2.
- **Lesson:** measure a bytecode budget on the build that ships (the same module), never on a probe that imports the
  inner kernel. The expected value is typed from a derivation and the measurement confirms it, never the reverse.
- **Evidence:** .handoff/archive/1.1.0/seghint-1.1/evidence/bytecode-cause.txt; .handoff/archive/1.1.0/seghint-1.1/SPEC.md X-8.
- **Law:** 9 (none new). **Gate:** test/gates/expect.json "==" rows (each new row carries a "derivation" field) +
  test/gates/bytecode.test.mjs (the 213 B / 32 B controls fail exactly their row and the copies check).
  Reopens with: a V8 that changes how module variables load (the "==" rows are then re-derived, not re-measured
  into place).

### C15. The c8 branch denominator follows the test set, not Bisect.js *(MEASURED 2026-11-24; RULED "Reword, no denominator" (maintainer, AskUserQuestion 2026-11-24, FILLERS burst))*
- **What happened:** the docs quoted "branches (317 / 317)". `npm run coverage` on HEAD 5cd73db read Branches 317 / 317
  in 3 of 3 runs. With the coverage glob minus test/Bisect.docs.test.mjs (on a working tree whose Bisect.js header
  gained one comment line, sha 003f726a; generated region byte-identical to HEAD) it read 315 / 315; with the docs test,
  317 / 317 on the same tree. The two extra branch ranges (c8 json branchMap, present only when the docs test runs) are
  Bisect.js:53:17-55:18 (upperBoundBranchlessF64: the block after `if (n === 0) return lo;`) and Bisect.js:547-548
  (assertRange: the throw path after `return;`). The 1.1 cycle's pre-docs measure pass read 316 with the docs
  export-names row red, on the pre-BB4 README (fewer snippets; cause UNVERIFIED, .handoff/archive/1.1.0/seghint-1.1/qa/qa.md:19).
  Lines moved 563 -> 564 with the one-line header edit (c8 counts physical lines), so "563 / 563" is also not stable.
- **Root cause:** likely, UNVERIFIED: V8 block coverage reports a nested range only where its count differs from its
  parent's, and c8 unions ranges over every test process, so the denominator is a property of the test set's
  execution counts, not of Bisect.js. Percentages stay at 100% in every run.
- **Evidence:** .handoff/archive/1.1.0/fillers/cov-1.log, cov-2.log, cov-3.log (3 full runs on HEAD 5cd73db); one docs-excluded run
  (315 / 315) and one paired full run (317 / 317) on the header-edited tree, .handoff/archive/1.1.0/fillers/c8/ (README.txt with the
  branchMap diff, nodocs-coverage-final.json, all-coverage-final.json); the 316 read:
  .handoff/archive/1.1.0/bb1b4/measure/coverage.log:477 (docs row red at :35); 564 lines: .handoff/archive/1.1.0/fillers/verify.log (coverage step);
  all untimed, node v26.8.2, darwin arm64, measured by the orchestrator 2026-11-24.
- **Law:** none new. **Gate:** none for the denominator (ungated by ruling); c8 `--check-coverage --lines 100
  --branches 100` gates both percentages. README Evidence table and CHANGELOG [Unreleased] now state 100% lines, 100%
  branches and 47 / 47 functions without line or branch denominators. Older entries and ROADMAP rows that quote 317 /
  563 are history and stay.
  Reopens with: a doc that quotes a c8 denominator again (it must name the exact test glob and tree, or be reworded).

---

## D. Process lessons

### D1. A scout's "none found" missed two LiteUtils tools *(2026-11-10)*
- **What happened:** a scout reported no `alloc-per-op` or `ic-diff` anywhere; both are at
  the top of LiteUtils (`alloc-per-op.mjs`, `ic-diff.sh`). The scout searched the consumer
  packages only.
- **Law:** none new; it is the suite trust rule ("a sweeper / scout none found is a lead,
  not proof").
- **Evidence:** this session's check; ROADMAP.md section 9 table.

---

### D2. A measurement tool's STEADY figure failed open *(FOUND 2026-11-10, P0 U3; LiteUtils defect, reported)*
- **What happened:** alloc-per-op printed STEADY 0.13..0.17 B/op for 12 lanes whose windows read
  e.g. `0.21 0.14 16.13 16.06 16.06`: STEADY = min of windows 1..K-1, so a later tier that boxes
  more is hidden. Its header (alloc-per-op.mjs:49) claims STEADY "is never below the true cost".
- **Evidence:** logs/u3-bench-noinl.log line 31 (checked by the orchestrator).
- **Law:** 9 (a gate fails open until a control proves it closed) on the TOOL, not the code:
  a tool's own fail-closed claim is a hypothesis until a lane that changes tier mid-run shows it.
- **Gate:** LiteBisect's P1 alloc gate reads every window >= 1 (ROADMAP section 6); the fix
  belongs in LiteUtils.

### D3. A CI ruling was asked on an unchecked premise: "package-lock.json is committed" *(FOUND 2026-11-11, P3 burst 1; RULED P3-R7a)*
- **What happened:** the orchestrator's install question (P3-R7) said the lockfile was committed because the file
  existed in the checkout; `.gitignore:2` ignored it and `git ls-files` did not list it. The ruled `npm ci` + `cache:
  npm` would have failed at setup on every hosted leg. The coder found it while writing the workflow.
- **Root cause:** presence in the working tree was read as "tracked"; no `git ls-files` / `git check-ignore` check
  before the question.
- **Evidence:** `.handoff/p3/evidence/ci-check.log` (PREREQ row); re-ask P3-R7a "Commit the lockfile (Recommended)"
  (ROADMAP 5d).
- **Law:** none new (law 3's spirit on a repo fact: EXPECTED is not checked). Lesson: every fact in a ruling's option
  text is checked by a command before the question is asked.
- **Gate:** `.handoff/p3/ci-check.mjs` PREREQ (lockfile tracked by git, v3, platform binaries present); exits 1 until
  the lockfile is committed. Not in `npm test` (it reads git state).

### D4. The confirmation script's argv filter dropped `--test` *(FOUND 2026-11-23, audit neon batch C coder)*
- **What happened:** .handoff/audit-neon/confirm.mjs built `['--test', ...files].filter(existsSync)`; '--test' is not a
  file, so `node file1 file2 ...` ran only the oracle file and its "oracle + boundary + nearest-exact exit 0" line overstated
  neon-1 (the two F64 mutants are killed by nearest-exact and boundary). The batch C coder caught it re-running the check.
- **Law:** 11 (a probe harness is reviewed before its numbers count) applies to the orchestrator's own confirmation
  scripts. Lesson: a confirmation row prints the exact argv it ran and the test count it saw.
- **Evidence:** CONFIRMATION.md neon-1 CORRECTION; evidence/C-revert-before.log. **Gate:** none (process).

### D5. `| grep -m1` does not stop a synchronous node parent *(FOUND 2026-11-23, ABOBS coder)*
- **What happened:** the ABOBS brief said `node ab-gate.mjs --selftest | grep -m1 'SELFTEST replay'` would stop before any
  child spawned. The coder tested it under a spawnSync guard: grep printed the row and exited, but the parent kept writing
  and reached the first `--verdict-file` spawnSync. Without the guard it would have run every fixture child and then the
  TIMED children, outside the quiet lock.
- **Root cause:** node ignores SIGPIPE; the EPIPE error arrives asynchronously, and selftest() is fully synchronous, so the
  parent never yields to see it.
- **Law:** none new (the quiet-lock rule: a timed run happens only under `quiet-lock.mjs run`). Lesson: an "untimed part"
  of a synchronous runner is isolated by a preload that stubs spawnSync (exit at the first `--rung` child), never by a pipe.
- **Evidence:** .handoff/abobs/VERDICTS.md (doc review r3 repro); the spawn guards .handoff/abobs/block-all.mjs /
  block-timed.mjs. **Gate:** none (process).

### D6. A strict hold was refused NOISY by the session's own untimed run seconds earlier *(FOUND 2026-11-23, research burst `seghint`, SH-R9)*
- **What happened:** the first SH-R9 `quiet-lock run --strict` attempt exited 76 (NOISY HOST) at 2026-11-23T03:24:25Z
  (UTC): load1 4.62 came from the same session's untimed smoke run just before it, not from another process.
- **Root cause:** load1 is a 1-minute moving average; an untimed run that ends seconds before a strict hold still
  counts against the BASELINE + 1 rule.
- **Law:** none new (the quiet-host rule). Lesson: idle the host ~2 minutes after any local run before a strict hold
  (done for the run that counted, 07:48:49Z).
- **Evidence:** .handoff/research/seghint/logs/hold-r9.log (the 76 attempt, then the run);
  .handoff/research/seghint/PROGRESS.md:424 (the smoke
  run PROV end 03:24:17Z) and :434 (the 120 s idle window before the run that counted); PROPOSAL-seghint section 6.
  **Gate:** none (process).

## Not yet covered

- Entries before 87389fb (A1, A2, A3, B1, D1) were written before the repository existed;
  only B1 cites a commit, the one that contains its fix.
- Inherited entries were read from the source ledgers on 2026-11-10; a later change there is
  not tracked here.
