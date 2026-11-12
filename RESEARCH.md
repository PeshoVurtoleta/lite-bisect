# lite-bisect -- RESEARCH

Research findings for `@zakkster/lite-bisect`, one section per research program. Every number here names its tier
(untimed fact, no gate yet; PRELIMINARY; REPORTED) and its provenance. None of it enters README, llms.txt or CHANGELOG
as a claim; a STATISTICAL claim needs the release lane on hosted CI, x86 and arm64 (ROADMAP sections 6-7, LEDGER law 7).
Laws and entries cited are in LEDGER.md. Working notes, raw logs and the probe harness are in `.handoff/research/p0/`
(gitignored).

## 1. P0 research (2026-11-10): R-4, R-11, R-8 untimed; R-1, R-2 timed; R-9 prior art; Q-BODY (1.8, burst 3)

**Setup.** Kernels under test are the frozen draft `Bisect.draft.js` (sha256 3af35dca..., commit 87389fb), Float64Array.
Host: Apple M4 Pro, node v26.8.2, V8 14.6.202.34. Tools from the LiteUtils checkout at 7c91d1c (ic-diff 11279540,
inlining-budget-diff 55e541e5, bytecode-budget f1070535, alloc-per-op d4386d85). Method (INTAKE, written before any run):
kill rules fixed per rung; every probe self-checks (naive oracle first; must-fail controls); timed rungs interleave A / B
with an A/A twin, a must-fail SLOW control, a B/op lane, K = 11 rounds, C = 3 compilations per column, median + IQR; the
timed harness (`bisect-lab.mjs` 25f677ab) was reviewed (one DESIGN reject, maintainer ruling, re-review APPROVED) before
any of its numbers counted. Deciding timed rungs re-ran once in one `quiet-lock run --strict` hold.

### 1.1 R-4 per-type feedback (untimed; LEDGER C3)
Fed Float64 / Float32 / Uint32 / Uint16 / Int32 arrays in turn (ic-diff, `--no-lazy-feedback-allocation`, runs 3):
- one shared kernel: both keyed loads end MEGAMORPHIC;
- a factory (5 closures of one literal): the same sites go MEGAMORPHIC, lazy or eager feedback allocation alike (one
  FeedbackCell per literal per native context);
- an `instanceof` front over 5 per-type literals: all 10 callee keyed-load sites stay MONOMORPHIC.
Control (F64 vs F64 + plain array) DIFFs. Consequence: per-type literal kernels; the factory is dead.

### 1.2 R-11 inlining through a selector, and bytecode (untimed; LEDGER C1)
A kernel called through a module const or a field set from a setup-time selector gets the SAME TurboFan inlining
decision as a direct import (and the same at Maglev with a raised limit); control DIFFs. Bytecode (report): branchy 55 B,
linear 39 B, branchless 103 B, hint 228 B. The branchless body is over Maglev's < 100 B single-inline limit; the
inherited "98 B" was another package's body. A 92 B form (guard folded into the return, `h & -(a[b + h] < x)`) is correct on 1,147,713 oracle
checks; measured SLOWER at every fixed n = 1..32 under TurboFan (1.8, LEDGER C7).

### 1.3 R-8 allocation (untimed; LEDGER C2)
alloc-per-op, `--n 4000000 --windows 5`, pinned semi-space flags; control (a boxed double per op) reads 16.05 B/op.
Every kernel reads 0.07 B/op (= the floor) inlined into its caller, for Smi, fractional, >= 2^31 and NaN queries. With
`--no-turbo-inlining` (optimized, not inlined): Smi queries 0.07, non-Smi queries 16.06 B/op = one HeapNumber per call.
Zero-GC holds where the kernel inlines or the query is a Smi. Tool defect found (LiteUtils; LEDGER D2): the tool's
STEADY figure (min of windows) failed open when a later tier boxed more.

### 1.4 R-1 the length switch (timed, PRELIMINARY, one CPU; LEDGER C4)
`lowerBound` (linear at n <= LINEAR_MAX = 8, else branchless) vs `lowerBoundBranchless`, random sub-ranges, uniform queries. Strict
hold (entry QUIET, load1 3.18 vs baseline 2.21): SLOWER at every n = 1..8 (B / A 1.640..3.325, +3.80..5.21 ns/op),
WITHIN at n = 9..32 (1.004..1.037), SLOWER on mixed lengths (1.120); never FASTER. Rule result: DROP. Run 1 agreed on
every fixed-n word; its mixed lane VOIDed on A/A drift (0.933) and the lab printed UNRULED (LEDGER C6). Report lane:
linear vs branchy, linear FASTER up to n = 48, WITHIN at 52..64. Why the linear arm loses is not traced (hypothesis: an
unpredictable exit branch on a random stream).

### 1.5 R-2 the hint gallop (timed, PRELIMINARY, one CPU; LEDGER C5)
`lowerBoundHint` (hint = previous answer) vs `lowerBoundBranchless` on random walks of step d. Strict hold, B / A:

| n | d = 1 | d = 4 | d = 64 | uniform (control) |
|---|---|---|---|---|
| 256 | 1.107 SLOWER | 1.683 SLOWER | SLOWER (report) | 3.402 SLOWER |
| 4,096 | 0.614 FASTER | 0.913 FASTER | 1.918 SLOWER | 2.842 SLOWER |
| 65,536 | 0.436 FASTER | 0.654 FASTER | 1.350 SLOWER | 2.375 SLOWER |

Rule result: STANDS (FASTER at d = 1 and 4 at 2 of 3 sizes). Run 1 matched every word (ratios within 3% relative). The
hint is a caller's documented choice for coherent streams, never automatic: it costs 2.4-3.4x on incoherent ones.

### 1.6 R-9 prior art (read 2026-11-10)
d3-array `bisectLeft` / `bisectRight` / `bisectCenter` and `bisector(accessor | comparator)`; Python `bisect_left` /
`bisect_right` (`key=` since 3.10, not applied to x); C++ `lower_bound` / `upper_bound` / `equal_range` (precondition:
partitioned). Of the three, only d3 ships "nearest" (a tie goes to the upper index); none ships "segment". The suite's own nearest
site (Charts.js:400) breaks a tie to the lower index. The ROADMAP inventory's Bound column and the LogN / LogLogN
private names say lower / upper; other sites use binarySearch / bisectNearest / nextGEQ.

### 1.7 What P0 decided (maintainer rulings, ROADMAP section 5a)
Ship per-type generated literals of lower / upper branchless and branchy, `lowerBoundHint`, `segment`, `nearest`; plus
cold `assertRange` / `assertSorted` (Q-GUARD; not per-type). Not at 1.0: the length switch and linear kernel (refused), a selector (parked), a per-call
type front (refused), Eytzinger (parked until R-5). The timed A/B of the 92 B branchless body vs 103 B ran in P0 burst 3 (1.8).
Not covered by P0: R-3 (feeds-write sites), R-5 (n >= 1e5, Eytzinger), R-6 (shapes not served), R-7 (offset LUT), R-10 (x86), R-12; real per-frame site traces for R-2.

### 1.8 Q-BODY the branchless body, 103 B vs 92 B (timed, PRELIMINARY, one CPU; LEDGER C7; P0 burst 3, 2026-11-10T23:08Z, ruled 2026-11-11)
v3 (guard folded into the return, `h & -(cmp)`, 92 B; an upper form with `<=`, 92 B, 1,147,713 oracle checks) vs the
frozen 103 B lower / upper branchless bodies, random sub-ranges n = 1..32 plus mixed lengths, uniform queries; lab
`bisect-lab.mjs` e8942567 (reviewed and APPROVED before its numbers counted). Traced, untimed: TurboFan inlines both
bodies into every traced caller copy (lb:8, lb:mix, ub:8: 36 / 36); Maglev refuses the 103 B bodies at its 100 B single-inline cap and inlines the 92 B ones.
Strict hold (entry QUIET, load1 2.78 vs baseline 2.21): v3 SLOWER at every fixed n for both pairs (lower 1.088..1.255,
upper 1.101..1.279, +0.17..1.46 ns/op); never FASTER. Both mixed-length lanes VOIDed on A/A drift and are not quoted (the
second such episode; LEDGER C6 reopened). Run 1 (host PRELIMINARY, non-verdict) agreed except lower n = 1 (WITHIN).
Ruled (maintainer, INTAKE A5): KEEP 103 B for both pairs on the fixed lanes; Q-BODY "(c) as written (Recommended)": the P1 bytecode gate
on the branchless pair pins TurboFan inlining only and the docs say Maglev does not inline it. Why v3 is slower is not
traced (hypothesis: `-(false)` is -0, a double, so the mask may leave int32); an int32-mask form with the folded guard
reads 104 B (untimed). Not covered: x86 (R-10), Maglev-tier timing, a caller that stays in Maglev.

## 2. P3 research burst `ab` (2026-11-11 / 12): the STATISTICAL A/B, locally (PRELIMINARY, one CPU; LEDGER C10, A8)

Question (P3-R1): can a timing gate decide hint vs branchless (Q1) and branchless vs branchy, read-only and feeding a
write (Q2), on hosted x86 and arm64 with no quiet lock? Lab `.handoff/research/ab/t/ab-lab.mjs` 8128d400 (the reviewed
P0 lab plus a stated diff, reviewed in the burst's claims review), F64 kernels frozen from 88e5b1c, K = 11, C = 3, A/A
twin, must-fail SLOW control, B/op lane; selftest 10 / 10 markers. Apple M4 Pro, node v26.8.2.

- Q1 (strict hold, entry QUIET): C5 reproduced word for word on the generated kernels; the hint wins on coherent
  streams (d <= 4) at n >= 4,096 and loses 2.4-3.4x on uniform queries.
- Q2 read-only: branchless FASTER than branchy at every n = 16 .. 65,536 (0.33-0.47). Not measured: n > 65,536,
  non-power-of-two n (algorithmica prior art: branchless can lose out of cache).
- Q2 feeds-write (search -> copyWithin insert -> search -> copyWithin delete): branchless SLOWER at n = 16 .. 2,048
  (1.05-1.49): I1 reproduced, so law 1 is now this package's own (time the consumer).
- Noise (R3, synthetic load): moderate load leaves every high-margin word stable from K = 5; heavy contention VOIDs
  the A/A twin (4 of 5 runs) and the lab reports NO VERDICT, never a wrong high-margin word. Four low-margin lanes
  (walk:256:1, walk:4096:4, fw:1024, fw:2048) move with load; the PROPOSAL keeps them REPORTED, not gated
  (Q-AB-LANES; LEDGER A8 refuses only the contended shape).
- Open, in `.handoff/PROPOSAL-ab.md`: where the release run lives, which lanes gate, K, the A/A band, I1's tier, the
  README "When" wording per CPU, the large-n scope. All seven were ruled 2026-11-12 (PROPOSAL-ab section 5); the hosted run (R4) is section 3.

## 3. P3 unit R4 (2026-11-12): the same lab on hosted x86 + arm64 (REPORTED; LEDGER C11)

`.github/workflows/ab-research.yml` (workflow_dispatch only) ran `bench/research/ab-lab.mjs` (the section 2 lab, frozen
path moved) once per OS in run 43127032794: ubuntu-latest = AMD EPYC 9V45 x86 (4 vCPU, 64 B lines, 4 KB pages),
macos-latest = "Apple M1 (Virtual)" arm64 (3 vCPU, 128 B lines, 16 KB pages, boot-time load). Selftest 10 / 10 on both.
- The 13 gated lanes (PROPOSAL-ab Q-AB-LANES) read their expected words on BOTH runners with A/A medians inside 0.95..1.05.
- x86 differs at the low-margin walk:256:1 (hint WITHIN, not SLOWER) and fw:2048 (WITHIN; the M4 Pro read SLOWER
  at margin 0.002) and in feeds-write size (branchless SLOWER 1.20 /
  1.25 at n = 16 / 128 vs 1.43..1.62 on the Apple hosts). Law 7 confirmed on this package.
- The arm64 VM VOIDed two non-gated lanes (A/A drift, coinciding with boot-time load); the VOID on the kill-rule
  lane walk:256:1 made the R0 lab exit 2 (a report-lane VOID leaves the exit alone); the gate unit's lab must
  scope its verdict to the gated lanes. Hosted numbers are REPORTED (no quiet lock, one run per OS, runner CPUs vary).
