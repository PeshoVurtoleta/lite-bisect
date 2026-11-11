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

## Not yet covered

- Entries before 87389fb (A1, A2, A3, B1, D1) were written before the repository existed;
  only B1 cites a commit, the one that contains its fix.
- Inherited entries were read from the source ledgers on 2026-11-10; a later change there is
  not tracked here.
