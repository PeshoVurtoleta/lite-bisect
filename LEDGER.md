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
it: law 3 (C1, C3, C7), law 8 (C2), laws 4 and 6 (C4, C5), law 5 (C6) and law 2 (C7, Maglev tier
only) are confirmed on this package as of 2026-11-11.

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

### A3. A per-call strategy registry; choosing a kernel by timing at runtime *(REFUSED 2026-11-10, P0 PROPOSAL Q-R11)*
- **Reason given:** a per-call lookup or indirect call makes the call site polymorphic and
  blocks inlining (law 2, law 3); a mutable global registry is global state with load-order
  behaviour, against `sideEffects: false`; runtime timing makes results depend on the host.
- **Status:** RULED with Q-R11 (maintainer, 2026-11-10): "(a) No selector at 1.0
  (Recommended)", whose text refuses A3 under every option.
- **Evidence:** .handoff/PROPOSAL-bisect.md Q-R11; ROADMAP R-11 "Declined in advance"; laws 2, 3.
- **Reopens with:** a mechanism that keeps the call site monomorphic and inlined with a
  per-call choice, traced (law 3).

### A4. The length switch (`lowerBound`, `LINEAR_MAX`) and `lowerBoundLinear` *(REFUSED 2026-11-10, Q-KERNELS)*
- **Reason:** C4. The switch never read FASTER and read SLOWER at every n = 1..8; no measured
  case has linear beating branchless. Ruling: "(a) Lean set (Recommended)".
- **Evidence:** `.handoff/PROPOSAL-bisect.md` Q-KERNELS; LEDGER C4.
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
- **Evidence:** .handoff/PROPOSAL-bisect.md Q-KERNELS; ROADMAP section 3 row 16.1 S0 (PRELIMINARY, in L1); R-5.
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
- **Evidence:** audit/2026-11-11-bisect/reviewer-fable/, reviewer-opus/, cross-fable/ (exact BigInt reference,
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
- **Evidence:** audit/2026-11-11-bisect/cross-opus/CROSS.md (17 / 17 audited runs minor = 0; pinned 1 MB: the plant
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
- **Evidence:** audit/2026-11-11-bisect/reviewer-*/REVIEW.md, cross-*/CROSS.md; macOS arm64, node v26.8.2.
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
- **Evidence:** audit/2026-11-11-bisect/cross-fable/CROSS.md and cross-repro.mjs (`--d4`, lanes smiq_nan_from_f64
  16.03 vs smiq_nan_literal 0.03 B/op; flags in its header), cross-opus/CROSS.md (2 runs, load1 2.58); host macOS
  arm64, node v26.8.2.
- **Law:** 8. Fix: the AU-R3 sentence in Bisect.js / Bisect.d.ts / README / llms.txt / the docs test QBOX literal (one
  line, character-identical), README "Known limits", and alloc lanes lowerBoundHint<T>.nanhint (must read one box,
  14.0..18.0 B/op in run B) and .nanlit (<= 1.0 B/op in both runs).
- **Gate:** the docs Q-BOX row (DETERMINISTIC) and `npm run gates:local` lanes. Reopens with: a V8 that passes a
  double unboxed across a non-inlined call.

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

## Not yet covered

- Entries before 87389fb (A1, A2, A3, B1, D1) were written before the repository existed;
  only B1 cites a commit, the one that contains its fix.
- Inherited entries were read from the source ledgers on 2026-11-10; a later change there is
  not tracked here.
