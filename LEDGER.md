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
it: law 3 (C1, C3) and law 8 (C2) are confirmed on this package as of 2026-11-10.

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
   crossover. Judge across an n-sweep, never at one size. *(I4, I6)* Binds: R-1, R-5,
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

### A3. A per-call strategy registry; choosing a kernel by timing at runtime *(PROPOSED for refusal 2026-11-10, R-11; NOT YET RULED)*
- **Reason given:** a per-call lookup or indirect call makes the call site polymorphic and
  blocks inlining (law 2, law 3); a mutable global registry is global state with load-order
  behaviour, against `sideEffects: false`; runtime timing makes results depend on the host.
- **Status:** recorded in ROADMAP R-11 as "declined in advance"; the maintainer rules it in the
  P0 PROPOSAL. Until then it is a proposal, not a ruling.

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
  1,147,713 oracle checks, 0 bad; speed unmeasured.
- **Law:** 3 (EXPECTED is not TRACED) extended: a number inherited from another package's body
  is a hypothesis about this body until measured here.
- **Gate:** none yet. P1 bytecode gate `< 100 B` on every kernel Maglev should inline.

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
  read one box (16 B), so the gate is seen to work.

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
  type, hand-written or generated) and the front stay in.

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
