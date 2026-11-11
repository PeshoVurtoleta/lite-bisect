# LiteBisect -- ROADMAP (DRAFT)

> **Status: DRAFT, 2026-11-10.** Nothing here is a package. `Bisect.draft.js` is a first sketch
> that needs research, review, measurement and a real test suite before any of it ships. Every
> speed number below is copied from LiteLogLogN's research (one CPU, REPORTED tier) and has NOT
> been re-run against this draft. Package name `@zakkster/lite-bisect`: free in the suite folder
> (LiteSearch is fuzzy text search); npm availability not checked.
>
> **LEDGER.md** holds the laws and lessons this package inherits from LiteLogLogN, LiteSignal and
> LiteFastBit32, plus its own refusals and defects. Every planner, research and audit brief
> quotes the LEDGER laws that bear on it.

## 1. The question: one adaptive search (like Timsort), or a menu of measured functions?

Both, split by one rule: **a kernel adapts only to what it can see cheaply at call time; anything
it cannot see is the caller's documented choice.**

Timsort is the model for that rule, not for "use the best of everything". It adapts to what it
can detect while running: array length (insertion sort below ~64), existing runs, and long
one-sided streaks (galloping). It never guesses at things it cannot observe.

Applied to search:

| Layer | Who decides | On what | Draft kernels |
|---|---|---|---|
| A. automatic | the kernel | range length; a hint (previous answer) the caller passes | `lowerBound` (linear below `LINEAR_MAX`, else branchless); `lowerBoundHint` (gallop from the hint, then branchless) |
| B. documented choice | the caller | does the result feed a write? lower or upper bound? | `lowerBoundBranchy` / `lowerBoundBranchless`, the `upper*` twins, `lowerBoundLinear` |
| C. documented structure | the caller | is the array static? | `buildEytzinger` + `lowerBoundEytzinger` |

Why B and C cannot be automatic, from measurements already in the suite:

- **Feeds a write.** Branchless reads 2-4x faster alone, but an `add(x)` + `delete(x)` pair was
  1.09-1.22x **slower** with it. The position feeds a `copyWithin` (LiteLogLogN RESEARCH 18). A
  kernel cannot see what its caller does with the answer.
- **Static or not.** Eytzinger needs a full rebuild after any write. Only the caller knows
  whether writes happen.
- **Element type.** One shared function fed `Float64Array` in one package and `Uint16Array` in
  another loses its single-type feedback on the array reads (V8.md, ElementsKinds.md). So
  per-type kernels are a packaging decision, not a runtime switch (R-4).

Layer A after P0: the length switch LOST in P0 T1 (LEDGER C4, PRELIMINARY). (Expectation before
P0, from S0: branchless ties linear at 8 keys and wins from 16.) The hint gallop is the layer-A idea with the most
potential (section 2: most per-frame call sites query near their last answer); P0 T2: FASTER on coherent walks at n >= 4,096, 2.4-3.4x
SLOWER on uniform queries (LEDGER C5, PRELIMINARY, one CPU).

## 2. Inventory (2026-11-10, two sweeps of main source files, read-only)

**28 sorted-array bisection loops in 13 main files.** Excluded:

- 10 value bisections (Color, Hueforge, Sketch, A11yColor, Repair chroma);
- 3 predicate searches with no array (WaveletTree `_select0` / `_select1`, XFastTrie `_near`);
- the Virtual Fenwick descent;
- quickselect, heap and tree walks.

| Package | file:line | Bound | Array | Result use | Notes |
|---|---|---|---|---|---|
| Charts | Charts.js:400 `bisectNearest` | lower, then nearest | Float32/Float64 series `xs` | read | pointer hover |
| Ohlc | Ohlc.js:392, 418 | lower, upper | Float64Array **ring, masked index** | read | kernel shape does not fit (R-6) |
| Keyframe | Keyframe.js:59 `binarySearch` | segment | caller array at an offset | read | linear for n <= 16 at the call site; per frame |
| MotionPath | MotionPath.js:167, 203 | upper | Float32Array LUT (default 256) | read | per frame |
| O1 | O1.js:5455, 5508 RankSelect | upper | Uint32Array; 5508 computed key | read | linear for hi - lo <= 16 |
| O1 | O1.js:5767 EliasFano.nextGEQ | lower | via `_readLow(i)` method | read | not a plain array |
| Room | Room.js:3610 `_listLowerBound` | lower on (pos, peerId) | Array of objects | **feeds splice** | compound key |
| Virtual | Virtual.js:498, 931 | upper | Float64Array; plain number[] | read | per scroll frame |
| Scrollforge | Scrollforge.js:1310 | segment | Float64Array | read | per frame |
| Chartforge | Repair.js:98 | segment | `cum` (type not traced) | read | |
| LogN | LogN.js:6502 SortedArray._lb | lower | Float64Array | **feeds copyWithin** (insert / delete) | 8 callers |
| LogN | LogN.js:7538, 7558 MergeSortTree | upper, lower | Float64Array runs | read | doc finding below |
| LogN | LogN.js:7786, 8170, 8183, 8196 WaveletTree | exact / lower / upper | Float64Array `_remap` | read | |
| LogLogN | LogLogN.js:1138 YFastTrie._lb | lower | Uint32Array buckets | **feeds copyWithin** | |
| LogLogN | LogLogN.js:2424 `_lb16` | lower | Uint16Array | **feeds copyWithin** | the only branchless one |
| LogLogN | LogLogN.js:2435 `_lbRun`; 3679, 3691 | lower over runs | Uint16Array, key `start + len` | feeds copyWithin (2435) | compound key |
| LogLogN | LogLogN.js:3628, 3635 intersect | gallop + exact | Uint16Array | read | RESEARCH 17.5: branchless was a LEAVE |

What the inventory says:

1. **Element types:** Float64Array 12, Uint16Array 6, Uint32Array 3, Float32Array 2, plain or
   untraced arrays 3, objects 1, method-read 1. At least 4 typed kinds, so per-type kernels
   matter (R-4).
2. **Almost every site searches a sub-range** (offset, run, bucket). The API must be
   `(a, lo, hi, x)`, never `(a, x)`.
3. **5 sites feed a write.** These are exactly the RESEARCH 18 case: keep branchy there unless
   measured otherwise.
4. **About 8 sites run per frame on a query that moves a little per frame** (Keyframe,
   MotionPath x2, Scrollforge, Charts hover, Virtual x2, maybe Ohlc). This is assumed from what
   the packages do, not traced. These are the hint-gallop candidates (R-2).
5. **About 6 sites do not fit a plain kernel:** compound or computed keys (Room, `_lbRun` x3,
   O1 5508), the masked ring (Ohlc x2), and the method-read (EliasFano). Out of scope unless R-6
   says otherwise.
6. **Only 1 of 28 is branchless today** (`_lb16`, adopted 2026-11-08). 2 sites already put a
   linear scan in front (Keyframe, O1 RankSelect), each with its own threshold of 16.

Doc finding, not fixed here: LogN.js:7528 calls `MergeSortTree._lb` a "Branch-free lower-bound".
The loop is branchy (`if (T[mid] <= x)`) and counts `<= x`, which is an upper bound. "Branch-free"
there means "no early exit on equality". A one-line wording fix for the next LogN doc pass.

## 3. Evidence carried over (LiteLogLogN RESEARCH.md; Apple M4 Pro, Node 26.8.2; not re-run)

| Source | Finding | Tier there |
|---|---|---|
| 16.1 S0 | Predecessor over k keys: linear wins at k <= 4, ties at 8; Eytzinger wins from 16 (1.2-4.8x over linear, 1.5-2.6x over branchy); branchless within noise of Eytzinger up to k = 64 (all in L1) | PRELIMINARY |
| 16.2 | The crossover depends on the PAIR compared: linear vs branchy at ~40-64, vs branchless or Eytzinger at ~16 | PRELIMINARY |
| 16.2 | One compilation per kernel shows up to ~20% A/A bias; time 3 independent compilations per column | finding |
| 17.2 L1 | Branchless lower bound beats branchy in all 32 read cells (0.49-0.76x); top-bits offset LUT + branchless 0.22-0.35x (T = 6) | QUIET, 1 run |
| 17.3 | Bytecode sizes: branchless body 98 B (Maglev single-inline limit 100 B); a LUT search 153 B; a LUT write 532 B (over TurboFan's 460 B, so never inlined) | DETERMINISTIC on that Node |
| 17.3 | Prior art (Khuong-Morin arXiv:1509.05053): small n -> sorted + branchless; Eytzinger only for large STATIC arrays; JS has no prefetch, so the prefetched Eytzinger variant has no JS analogue | literature |
| 18 | Branchless loses 1.09-1.22x when its result feeds `copyWithin` (the data flow, not the search) | QUIET + strict, REPORTED |

## 4. What the draft has, and its only check

`Bisect.draft.js`: Float64Array kernels (lower bound linear / branchy / branchless, upper bound
branchy / branchless), adaptive `lowerBound`, `lowerBoundHint`, and Eytzinger build + search.
They come from the measured S0 / L1 kernels, adapted to `[lo, hi)`. Contract in the file header:
NaN query -> `lo`, no validation, no throw, no allocation (P0 U3: 0 B/op inlined; a non-Smi query boxes 16 B across a
non-inlined call, LEDGER C2).

`draft-check.mjs` (`node draft-check.mjs [seed]`):

- **Oracle:** a naive scan written from the definition.
- **Inputs:** random sorted arrays with ~30% duplicates; every sub-range for n <= 24; random
  sub-ranges up to n = 300; queries at, between and outside the values, plus NaN and
  +-Infinity; hints in range, at both ends, outside, NaN, and at the answer.
- **Result:** seeds 1, 12345, 777, 99 all `ok`, 45-48 M checks each.
- **Teeth:** 6 mutants, all killed (scratchpad, 2026-11-10):
  - branchless `<` -> `<=`;
  - the gallop's clamp removed;
  - Eytzinger `rank[0] = 0`;
  - linear `<` -> `<=`;
  - the empty-range guard removed;
  - the hint's direction test `<` -> `<=`.
- **Bug it caught:** `lowerBoundHint` galloped left with `a[l] >= x`, which returned the hint
  for a NaN query. Fixed to `!(a[l] < x)`, the same predicate as every other kernel.

## 5. Open questions (research before any code is final)

- **R-1 Does the length switch earn its bytes?** Compare `lowerBound` vs `lowerBoundBranchless`
  at n = 1..32, using the 16.2 method (3 compilations, A/A, a must-fail control). Kill rule
  fixed before the run: drop layer A's switch unless it wins >= 1.10x somewhere AND loses
  nowhere beyond the A/A band.
  P0 result (T1, 2026-11-10, LEDGER C4, PRELIMINARY, one CPU): DROP. The switch read SLOWER at
  every n = 1..8 (1.640..3.325), WITHIN at 9..32, SLOWER on the mixed-length lane; never FASTER.
- **R-2 Hint gallop vs a fresh search** on coherent query streams: random walk with step d =
  1, 4, 64, n/8, plus a uniform-random control where the hint must lose or tie. Use real
  Keyframe / MotionPath / Virtual traces if they exist.
  P0 result (T2, 2026-11-10, LEDGER C5, PRELIMINARY, one CPU): the hint STANDS on the rule
  (FASTER at d = 1 and 4 at n = 4,096 and 65,536; SLOWER at n = 256); it costs 2.4-3.4x on
  uniform queries, so it is a caller choice, not automatic. Real site traces: not yet.
- **R-3 Branchy vs branchless at FEEDS-WRITE sites** outside LogLogN (SortedArray, YFastTrie):
  does RESEARCH 18 transfer?
- **R-4 Per-type packaging.**
  - Option 1: hand-written literals per element type (F64, F32, U32, U16, I32).
  - Option 2: a factory. Believed to share ONE feedback vector across closures from the same
    literal, so it would NOT separate types. Verify with LiteUtils `ic-diff.sh`.
  - Option 3: generated source, i.e. `new Function` with unique source (the alloc-per-op
    driver lesson). CSP-hostile.
  - Measure what a mixed-type app costs with option 1 vs a single shared function.
- **R-5 Eytzinger in JS beyond L1.** Never measured at n >= 1e5 here. Without prefetch, does it
  still beat branchless? Also the rank array's cost (one extra read per query, 4 B per key).
- **R-6 Shapes the kernel doesn't serve:** the masked ring (Ohlc), compound keys (Room,
  `_lbRun`), method reads (EliasFano). Either a documented "write your own" or a strided /
  key-offset variant; decide from how often each shape appears in the next package written.
- **R-7 Offset LUT index (RESEARCH 17) as layer C.** It is a maintained structure with upkeep
  on every write, so it probably belongs in its owner (RoaringSet), not here. Decide after the
  RoaringSet Batch B ruling.
- **R-8 Allocation:** every kernel 0 B/op through the LiteUtils `alloc-per-op.mjs` probe,
  including F64 queries that are fractional or >= 2^31 (zero-box law).
- **R-9 Upper-bound and nearest helpers.** Charts needs nearest; Keyframe, Scrollforge,
  Repair and MotionPath (MotionPath.js:173) need "segment" (upper - 1). Thin wrappers or caller code? Read the ecosystem API
  first (one research pass, while drafting the PROPOSAL): d3-array `bisectLeft` /
  `bisectRight` / `bisectCenter` (`bisectCenter` is the "nearest" helper), Python `bisect`
  (`lo`, `hi`, `key=`), C++ `lower_bound` / `upper_bound` / `equal_range`. It settles the
  naming (lower / upper vs left / right) and whether nearest and segment ship.
- **R-10 Other CPUs.** Every number is one Apple M4 Pro. Branch prediction does not transfer.
  An x86 CI run is the minimum before any "faster" claim.
- **R-11 A setup-time selector over the exported kernels** (maintainer proposal, 2026-11-10).
  Every kernel stays exported, so any caller can pick one by name. On top of them:
  `selectLowerBound(traits)` / `selectUpperBound(traits)` take what the kernel cannot see
  (`type`, `feedsWrite`, `static`, `coherent`) and return ONE of the exported functions. The
  caller stores it in a module const or a field that never changes, and calls it directly.
  - Why at setup, not per call: a per-call dispatch (a table lookup, or an indirect call)
    makes the call site polymorphic and blocks inlining. (Correction 2026-11-10, P0 U2: the
    "98 B, just under Maglev's 100 B" figure was LiteLogLogN's `_lb16`; the draft's
    `lowerBoundBranchless` is 103 B, so Maglev does not inline it at its default limit; a
    correct 92 B form exists; P0 T3 measured it SLOWER at every fixed n = 1..32 under TurboFan, so 103 B
    stays, LEDGER C7.) The facts that decide the strategy (feeds a
    write, static, coherent) are not visible at call time anyway (section 1).
  - P0 results (untimed, 2026-11-10, `.handoff/research/p0/PROGRESS.md`): a module const or a
    field returned by a selector gets the SAME inlining decision as a direct import (U2). A
    type-dispatch front over per-type literal kernels keeps each kernel's feedback monomorphic
    (U1c); one shared function fed 5 types goes megamorphic (U1a); a factory shares one
    feedback vector across its closures, so it cannot separate types (U1b). A non-Smi F64
    query boxes 16 B per call across a non-inlined call (U3).
  - Each table row ("traits -> kernel") is a STATISTICAL claim and needs its evidence (R-1,
    R-2, R-3) on x86 as well as arm64 (R-10). A trait combination with no evidence returns the
    safe default (branchy where the result feeds a write).
  - Declined in advance, unless a new mechanism is shown: a mutable global registry that
    packages register into (global state, load-order behavior, conflicts with
    `sideEffects: false`); choosing by timing at runtime (host-dependent results, not
    fail-closed).
  - Probe in R-4: does a type-dispatch front (`a instanceof Float64Array` -> its own per-type
    kernel) keep each kernel's type feedback monomorphic, and what does each call pay for it?
    Does a call through a stored field stay monomorphic and inline the target?
  - Later rung of R-2, not 1.0: a stateful cursor that adapts to its own hint hits (Timsort's
    `min_gallop`), and falls back to a fresh search when gallops keep missing.
  - Output: a Q-id in the P0 PROPOSAL with the trait names, the table and the default per
    row. New public surface, so no planner pass before the ruling.
- **R-12 Interpolation search for near-uniform keys** (optional, post-1.0; added 2026-11-10).
  MotionPath LUTs and many timestamp arrays are close to uniform, where interpolation search
  is O(log log n). It is the one kernel family this roadmap did not consider. A spike rung:
  interpolation (with a bounded fallback to branchless after k probes) vs branchless on
  uniform, mildly skewed and adversarial keys; kill rule fixed before the run. Not a 1.0
  blocker.
- **Q-GUARD (PROPOSAL question, added 2026-11-10):** an out-of-range `[lo, hi)`, an unsorted
  array or a NaN inside it gives a silently wrong answer today, which sits badly with the
  suite's "fail closed" law. The hot kernels stay unchecked (bytes, inlining). The question is
  the cold side: a `checkRange(a, lo, hi)` / `assertSorted(a, lo, hi)` helper, a debug entry
  point, or a documented "caller owns the range" contract only.

Source from an external review of lite-pick (RECOMMENDATIONS.md, read 2026-11-10): R-9's
prior-art pass, R-12, Q-GUARD, and the section 6 / 7 / 9 additions marked "(lite-pick review)".

## 5a. P0 PROPOSAL rulings (maintainer, 2026-11-10, one AskUserQuestion sitting)

The PROPOSAL (`.handoff/PROPOSAL-bisect.md`, gitignored) is the first planner pass's input. Its rulings, quoted:

| Q-id | Ruling | Means |
|---|---|---|
| Q-KERNELS | "(a) Lean set (Recommended)" | ship lower / upper branchless, lower / upper branchy, `lowerBoundHint` (coherent streams only); drop `lowerBound`, `LINEAR_MAX`, `lowerBoundLinear` (LEDGER A4); Eytzinger waits for R-5 (A6) |
| Q-R4 | "(a) Generated (Recommended)" | one template; a dev-only generator writes the 5 per-type copies (F64 / F32 / U32 / U16 / I32) into the main file; gate: generated == committed |
| Q-BODY | "(a) A/B first (Recommended)" | v3 (92 B) only after a timed A/B vs the 103 B body; P1 bytecode gate < 100 B on every kernel Maglev should inline. **Outcome (P0 T3, 2026-11-11; LEDGER C7):** v3 SLOWER at every fixed n = 1..32 under TurboFan; maintainer: KEEP 103 B, "(c) as written (Recommended)" -- the branchless gate pins TurboFan inlining only; docs say Maglev does not inline it |
| Q-BOX | "(a) Qualified wording (Recommended)" | zero allocation where the kernel inlines or the query is a Smi; a not-inlined non-Smi lane in the alloc gate must read ~16 B/op |
| Q-R11 | "(a) No selector at 1.0 (Recommended)" | kernels by name + a README choice table with tiers; A3 refused; selector PARKED (A5) |
| Q-FRONT | "(a) No per-call front (Recommended)" | nothing in the hot path dispatches on type (A5) |
| Q-GUARD | "(a) Cold assert helpers (Recommended)" | cold `assertRange(a, lo, hi)` (throws RangeError) / `assertSorted(a, lo, hi)` (throws on a descent or a NaN in [lo, hi)); hot kernels trust the caller |
| Q-NAMES | "(a) lower/upper + helpers (Recommended)" | lower / upper names; `segment` (upper - 1) and `nearest` (tie -> LOWER index, as Charts.js:400) ship |

Also ruled: the INTAKE A1 departure accepted (non-strict timed runs on a PRELIMINARY host are non-verdict runs; INTAKE A2); a tracked
RESEARCH.md created; Q-LU-1a NOT reopened (section 9).

## 5b. P1 planner rulings (maintainer, 2026-11-11, AskUserQuestion during the P1 planner pass)

The program spec is `.handoff/p1/SPEC-p1.md` (gitignored). Rulings, quoted:

| Id | Ruling | Means |
|---|---|---|
| P1-R1 | "Wire now, I will ping when ready. [...] the scripts can be used" | the alloc-per-op / bytecode-budget gates call the local LiteUtils checkout now (`LITE_UTILS_DIR`); `@zakkster/lite-utils` is not in package.json until 1.0 is on npm (it is 0.0.0, private, npm 404 on 2026-11-11); `gates` stays out of `npm test` and hosted CI until then; 1.0 of this package waits for a green `gates` run |
| P1-R2 | "Hand-written + parity test (Recommended)" | `Bisect.d.ts` is hand-written; a test checks it against the runtime exports (set, arity, array type) with must-fail mutants |
| P1-R3 | "RangeError for both (Recommended)" | `assertSorted` throws RangeError (it calls `assertRange` first) |
| P1-R4 | "No, lo / hi only (Recommended)" | `assertRange` checks lo / hi only and reads only `a.length` |
| P1-R5 | "Exact pin (Recommended)" | `typescript` devDependency pinned exactly; every types-gate run records `tsc --version` |
| P1-R6 | ">=22 (Recommended)" | `engines.node` ">=22", the section 7 CI matrix |
| P1-R7 | "Follow the B1 NaN contract (Recommended)" | NaN query: `nearest` -> lo, `segment` -> lo - 1; an exact match (+-Infinity included) wins; past either end -> lo or hi - 1; tie -> LOWER index |
| P1-R8 | "Cap at 2^30 - 1 (Recommended)" | Q-GUARD's cap becomes hi - lo <= 2^30 - 1: `assertRange` throws RangeError at 2^30, because the frozen hint body never returns there (LEDGER B2); no hot byte changes |
| P1-R9 | "Caller error, documented (Recommended)" | `lowerBoundHint`'s h must be an integer index or NaN (NaN -> lo; outside [lo, hi] clamped); a non-integer h is a caller error that may return a wrong index or never return (the frozen body hangs on h = 10.5), like a non-integer range; documented in the Bisect.js header and the .d.ts JSDoc; no hot bytes, no new export, no cold check (asked 2026-11-11 in the P1 coder burst after the U2 review) |
| P1-R10 | "R < 1.0 B/op (Recommended)" | (steady minor GCs reopened by AU-R5, 5c) The torture gates the retained heap per 200,000-op lane: every lane reads retained < 1.0 B/op (head read 0.071..0.107 over 5 runs), plus a must-fail control lane that retains one small on-heap object per op; deterministic tier, in `npm run torture` (asked 2026-11-11 in P1 coder burst 2 after the U4 review found the channel measured but never gated, LEDGER B4) |
| P1-R11 | "Add --no-maglev-inlining (Recommended)" | U6 alloc gate run B (not inlined) runs `--no-turbo-inlining --no-maglev-inlining`, tier check requires both; every window 1..5 read (asked 2026-11-11 in P1 coder burst 3: with the TurboFan flag alone Maglev inlined the lane and the 55 B branchy body in window 1, 0.49..0.86 B/op) |
| P1-R12 | "Empty-lane NO VERDICT (Recommended)" | Each U6 alloc run measures an empty lane with its own flags; > 1.0 B/op in any window 1..5 = NO VERDICT (gate FAIL, labelled harness-noisy), never a pass; thresholds unchanged (asked 2026-11-11 in P1 coder burst 3: an empty lane read 1.03 at load1 ~28) |
| P1-R13 | "7.0.2; node10 -> nodenext (Recommended)" | typescript pinned exactly 7.0.2 (P1-R5); the U7 types gate runs node16 / nodenext / bundler; the node10 control becomes a types.exports.test row (package.json top-level `types` === exports["."].types === "./Bisect.d.ts", must-fail controls: removed, mismatched) (asked 2026-11-11 in P1 coder burst 4: typescript 7.0.2 removed moduleResolution node10, TS5108, probed) |

Planner details settled in the spec (not rulings): 37 exports, `<kernel><T>` suffix names with T in F64 / F32 / U32 /
U16 / I32; `segment` and `nearest` are per-type (a shared wrapper would need a type dispatch, refused by Q-FRONT, and
its reads would go megamorphic, LEDGER C3). Void at 1.0 (Q-KERNELS): section 6's Eytzinger item and the
`LINEAR_MAX: 8` example, and 2 of section 4's 6 starting mutants (Eytzinger, linear). Until LiteUtils 1.0 is on npm
(P1-R1), section 6's alloc-per-op and bytecode-size gates run in `npm run gates`, not `npm test`, and section 8's P1
lite-utils devDependency line is deferred. Section 6's "2^30 cap" means hi - lo <= 2^30 - 1 (P1-R8).

## 5c. P1 final-audit rulings (maintainer, 2026-11-11, Session B step B2)

Asked 2026-11-11 in P1 final audit Session B (B2), one AskUserQuestion sitting after the cross-check (audit/2026-11-11-bisect/cross-{opus,fable}/CROSS.md); all answered. Quoted:

| Id | Question | Ruling | Means |
|---|---|---|---|
| AU-R1 | D6 R-NEAREST | "FIX, 167 B body (Recommended)" | nearest* gets cross-fable's exact 167 B body (d0 !== d1 fast path, TwoSum error terms, branch-free tail); leaves Maglev's 100 B inline cap (TurboFan still inlines); SPEC "nearest < 100" -> "== 167"; class 1 |
| AU-R1a | AU-R1 gap (B3) | "Fable's 189 B body (Recommended)" | AMENDS AU-R1: the 167 B body returned 0 on F64 [-Infinity, 1e308] x = -1e308 (exact 1; both distances overflow); nearest* gets reviewer-fable's 189 B body with the -Infinity overflow term; SPEC nearest == traced (~189 B) |
| AU-R2 | D2 R-NANHINT-BOX class | "Class 2, release-blocking (Recommended)" | class 2 / DOCUMENT: the caller boxes (D4), no package code allocates; the sentence fails open, so it lands before /release 1.0.0 |
| AU-R3 | R-NANHINT-BOX sentence | "Caller-box wording (Recommended)" | the caller-box sentence (Smi / literal-NaN exempt; a run-time non-Smi number argument across a non-inlined call is boxed by the caller, 16 B on Node; pass lo or literal NaN) in header, d.ts, README, llms.txt, CHANGELOG, QBOX literal; alloc-bench lanes lowerBoundHint<T>.nanhint (~16 B) and .nanlit (<= 1 B) in gates:local |
| AU-R4 | D3 R-LLMS-SNIPPETS class | "Class 2, fix now (Recommended)" | class 2; fixed now: llms.txt results in the checked `// -> n` form, docs.test runs llms.txt fences, a row fails on a bare `// <number>` result comment |
| AU-R5 | R-TORTURE-MINOR scope | "Reopen B4: minor 0 + pin (Recommended)" | LEDGER B4 / P1-R10 reopened (mechanism: a published minor-GC count no verdict holds; no allocation gate in npm test / CI): steady maxMinor 0, torture script pins --min-semi-space-size=1 --max-semi-space-size=1, NO VERDICT exit 2 without them, a 16 B/op must-fail plant exits 1 |
| AU-R5a | AU-R5 tier flag (B3) | "Accept the flag (Recommended)" | the torture script adds `--no-concurrent-recompilation` (clean build failed under load without it: concurrent TurboFan left lanes un-inlined, so non-Smi queries boxed); NO VERDICT still checks only the two semi-space flags |
| AU-R5b | torture pin, flag tricks (B3) | "Class 3, one-line refusal (Recommended)" | class 3: the pin check also refuses one-dash semi-space spellings and `--minor-ms` (exit 2); lite-gc-profiler counts young GCs of kind 2 (--minor-ms) as not minor: an upstream lead (LEDGER B9) |
| AU-R6 | R-RESEARCH-REF | "Pointer sentence + docs row (Recommended)" | keep the citations; one pointer sentence in README and llms.txt (LEDGER / RESEARCH ids live in the source repository, not the tarball); a docs row with a planted-citation control; llms.txt:60-61 untouched (D1); no package.json change |
| AU-R7 | R-DTS-TIER | "Tiered warning (Recommended)" | d.ts x5: "on incoherent streams it can be slower than lowerBoundBranchless* (PRELIMINARY, one CPU; no timing lane gated)"; a docs row fails on an untiered d.ts slower / faster sentence |

## 5d. P3 CI rulings (maintainer, 2026-11-11, P3 burst 1 unit 1)

Asked 2026-11-11 in P3 burst 1 (two AskUserQuestion calls, one sitting); all answered. They settle section 7's "owner
open" and resize its sketch. The workflows are `.github/workflows/ci.yml` and `nightly.yml` in this repository. Quoted:

| Id | Question | Ruling | Means |
|---|---|---|---|
| P3-R2 | matrix | "8 legs, as LiteUtils (Recommended)" | ubuntu-latest (x86) + macos-latest (arm64) x node 22 / 24 / 26, plus one node 26.8.2 leg per OS so the pinned M4 inline control runs in CI; M4 was traced only on Apple M4 Pro, so a red 26.8.2 ubuntu leg is a finding to rule, never continue-on-error |
| P3-R3 | steps per leg | "test+torture all, cov+size once (Recommended)" | `npm test` and `npm run torture` (the script owns the pinned flags) on every leg; `npm run coverage` and `npm run size` once, on ubuntu-latest node 26 (CPU-independent; size reads that leg's npm pack); no continue-on-error |
| P3-R4 | LiteUtils `gates` job | "Nothing now; later unit (Recommended)" | no gates job and no stub until LiteUtils 1.0 is on npm (P1-R1); NEXT.md carries a "gates CI job" unit (lite-utils devDep, then a job running `npm run gates`) that blocks `/release 1.0.0` |
| P3-R5 | nightly | "Separate nightly.yml (Recommended)" | `.github/workflows/nightly.yml`: daily cron + workflow_dispatch, the same DETERMINISTIC steps as ci.yml on node 'latest' (check-latest) and '22' x ubuntu-latest / macos-latest; never a required check; the STATISTICAL A/B lane joins later, from its ruled PROPOSAL |
| P3-R5a | which nightly counts toward section 8 P3 "CI nightly green for a week" (asked in chat 2026-11-11 after the burst; the P3-R5 question text assumed nightly.yml, no ruling text said so) | "I agree" (to the orchestrator's recommendation) | the week = 7 consecutive green runs of the DETERMINISTIC `nightly.yml` only; the STATISTICAL A/B is gated ONCE per release by one release-gating run on x86 AND arm64 that passes its own controls (A/A band, must-fail SLOW control), never by a streak; any nightly A/B run is REPORTED evidence only and gates nothing. Not chosen: the A/B lane counting toward the week (a timing streak multiplies the false-red rate by ~7 on hosted runners and turns the once-per-release verdict into a streak); both lanes counting |
| P3-R6 | action pinning | "Major tags @v7, as the suite (Recommended)" | actions/checkout@v7 + actions/setup-node@v7, `permissions: contents: read`, `persist-credentials: false`; same as LiteUtils / LiteSignal (one suite-wide bump); full-SHA pins not chosen |
| P3-R7 | install | "npm ci + npm cache (Recommended)" | `npm ci` from the committed lockfile with setup-node `cache: npm`; a lockfile drift fails the job |
| P3-R7a | P3-R7 re-ask (its premise was wrong: `.gitignore` ignored package-lock.json; LEDGER D3) | "Commit the lockfile (Recommended)" | `/package-lock.json` leaves `.gitignore` and the existing lockfile (v3, registry.npmjs.org only, linux-x64 / linux-arm64 / darwin-arm64 esbuild + typescript binaries) is committed; P3-R7 stands as ruled (LiteSignal precedent); not chosen: the gitignored-lockfile suite norm (`npm install --no-audit --no-fund`, no cache) |
| P3-R8 | triggers | "push + PR + dispatch (Recommended)" | on push (every branch), pull_request, workflow_dispatch; concurrency cancels superseded runs except on main; timeout-minutes 30 per job, re-sized from the first run's wall times |

Not chosen (LEDGER A7): 12 legs with ubuntu-24.04-arm; 6 legs with no pinned leg; every step on every leg; test +
torture only; a job that checks out the LiteUtils repo now (would reopen P1-R1); a schedule trigger inside ci.yml; no
nightly yet; full commit-SHA pins; `npm install`; push to main only.

## 5e. P3 CI-fix rulings (maintainer, 2026-11-12, P3 CI-fix burst unit 2)

The first two hosted ci.yml runs (43102263215, 43102509190; tree bcc2ad61) were RED in two classes; triage
`.handoff/p3/CI-TRIAGE.md` (cause, local reproduction, options). Asked in one AskUserQuestion sitting; both answered. Quoted:

| Id | Question | Ruling | Means |
|---|---|---|---|
| P3-R9 | class 1: inline control a1 SIGTRAP on node 22 / 24 (V8 12.4 / 13.6 `Check failed: v8_flags.fuzzing` on Prepare / OptimizeOnNextCall after NeverOptimize) | "Driver fix, 2 lines (Recommended)" | inline-driver.mjs skips %PrepareFunctionForOptimization and %OptimizeFunctionOnNextCall for the planted never-opt caller only; a1 stays live on all 8 legs through the same verdict() path; gate failing on the old code: the hosted node 22 / 24 legs + a local revert check with the official v22 / v24 binaries; LEDGER B12 |
| P3-R10 | class 2: an unplanted torture lane trips the retained floor under CPU contention (concurrent sweeper; clean build 4 / 60 contended runs exit 1) | "Flag + NO VERDICT refusal (Recommended)" | `npm run torture` adds --single-threaded-gc; torture.mjs refuses (exit 2, NO VERDICT) unless execArgv carries it, also refusing a later --no-single-threaded-gc and one-dash / '_' spellings (as AU-R5 / R5b); the controls test passes it and gains (c) rows for flag missing / overridden -> exit 2 (these fail on the old code); controls (a) / (b) keep strict attribution; README / CHANGELOG / torture header updated; LEDGER B11 |

Not chosen: class 1 -- the driver fix plus a static source row; a1 as a node:test SKIP off the pinned Node (a1 on 2
of 8 legs, assertion 8 uncontrolled elsewhere; law 9); `--fuzzing` (offered in the triage, not asked: it changes
every %-call's misuse behaviour). Class 2 -- the flag with no refusal (a run without it can credit away 1-2 B/op of
retention: fail-open, unlike AU-R5a's tier flag); settle-until-stable (timing-dependent); serializing the controls
file only (mitigation; the clean gate still flakes); widening the floor (offered in the triage, not asked).

## 6. Verification plan, by tier

- **DETERMINISTIC (`npm test`):**
  - the draft-check oracle as node:test, per element type;
  - boundary suite (empty range, `lo === hi`, `hi - lo = 1`, all-equal arrays, 2^30 cap);
  - Eytzinger over n = 0..1,000 exhaustively;
  - `alloc-per-op` gate at 0 B/op on every kernel, with a must-fail boxed lane;
  - bytecode-size gate (`bytecode-budget.sh`): the branchless pair keeps its 103 B body and the
    gate pins TurboFan inlining into a caller; Maglev does not inline it (100 B cap; Q-BODY (c),
    LEDGER C7). Kernels Maglev should inline stay < 100 B.
  - the `alloc-per-op` gate reads every window >= 1, not only STEADY (P0 U3 found STEADY = min
    fails open when a later tier boxes more).
  - boundary inputs the draft-check oracle does not feed yet (lite-pick review): `-0` and `+0`
    in the array and as the query, `lo > hi`, non-integer `lo` / `hi`, length-1 arrays,
    subnormals, values next to 2^31 and 2^32 for the integer kinds. Each input gets a stated
    outcome (an answer, or "caller error" under Q-GUARD).
  - a committed mutant set (lite-pick review; LEDGER B1, I5): every mutant must be killed; a
    mutant that never ran, crashed or timed out is a FAIL. It replaces the hand-run scratchpad
    mutants. Starting set: the 6 from ROADMAP section 4, plus one per kernel per comparison.
  - c8 coverage at 100% lines and 100% branches on the main file (lite-pick review); a branch
    that cannot be covered is proven unreachable and removed.
  - a types-compat fixture compiled under TS `node16`, `bundler` and `node10` resolution;
    exact literal types in the `.d.ts` (e.g. `LINEAR_MAX: 8`) (lite-pick review).
  - a packed-size budget (`npm pack --dry-run`), and the main file's size with comments
    stripped (lite-pick review): "tiny" is part of the pitch, so it is measured.
  - source comments: the shipped file keeps JSDoc to contract, complexity and ownership; design
    history lives in the LEDGER / `decisions/`, never in the shipped file (lite-pick review).
- **STATISTICAL (once per release, hosted CI):**
  - R-1, R-2 and R-3 as interleaved A/B with the 16.2 method;
  - each claim worded with its statistic, K rounds and a must-fail control.
- **REPORTED:** n-sweep tables (n = 4 .. 1e7) per kernel and element type, with provenance.
- **Revert check:** at adoption, each migrated call site's own tests must pass on both the old
  and the new search (same answers), and the A/B must be run on the real package, never on a
  copy.

## 7. CI (sketch; the timing lane matters more here than for most packages)

Ruled 2026-11-11 (section 5d, P3-R2..P3-R8): the owner is this repository, `.github/workflows/ci.yml` (every push /
PR) and `nightly.yml` (daily), DETERMINISTIC tier only. The sketch below stays as the plan for the STATISTICAL lane.

- **Every push:** `npm test` (DETERMINISTIC, with the types-compat fixture inside it) + `npm run torture`, Node
  22 / 24 / 26 + 26.8.2, ubuntu-latest (x86) and macos-latest (arm64); coverage + the packed-size budget once
  (ubuntu-latest, Node 26) (P3-R2, P3-R3).
- **Nightly (STATISTICAL, not yet written):** the A/B lane on ubuntu-latest (x86) AND macos-latest (arm64). R-10 is the
  point: a branchless verdict from one ARM chip says nothing about x86 branch predictors. Upload
  the logs as artifacts; the verdicts are REPORTED until a release run gates them.
- The quiet-lock does not exist on hosted runners. Noise is handled by the interleaved A/B
  design itself (A/A band, must-fail control), not by a quiet host.

## 8. Phases

- **P0 research:** R-1, R-2, R-4, R-8, on the draft, plus R-11's selector surface as a
  PROPOSAL Q-id (its R-4 probe runs with R-4). Output: a RESEARCH.md with the kill rules
  written before each run, and a maintainer ruling per question. Each finding that confirms or
  breaks an inherited LEDGER entry (`I<n>`) becomes a `C<n>` entry there.
- **P1 package:** the kernels that survived P0, per element type, plus node:test and the
  0 B/op gate. `Bisect.draft.js` is never shipped as is. `@zakkster/lite-utils` `^1.0.0` is
  a devDependency and the tools are called through its bins (Q-LU-1, Q-LU-1a, section 9).
- **P1 final audit (maintainer, 2026-11-11):** "one dual final review - fable 5.2 high and
  opus 5.5 high, as the rules say, and one session to confirm all the findings + fix. See
  lite-utils workflow". After P1 qa, before `/release 1.0.0`; modeled on LiteUtils ROADMAP
  Phase 7 and its 2026-11-09 audit. Session A: snapshot + two independent reviewers (Opus 5.5
  high, Fable 5.2 high) + orchestrator spot-check of every reproduction. Session B: each
  finding cross-checked by the other model, maintainer rulings in one sitting, fixes through
  the pipeline (each reproduction becomes a test that fails on the audited build), then every
  reproduction re-run on the candidate. Untimed. Plan: `.handoff/PLAN-final-audit.md`.
- **P2 adoption, one package at a time, highest value first:**
  - LogN SortedArray / MergeSortTree / WaveletTree (9 sites, Float64Array, mostly reads);
  - then the per-frame sites (Keyframe, MotionPath, Scrollforge, Virtual) if R-2 wins.
  - Each adoption is that package's own reviewed change and A/B.
  - Sites that feed a write stay branchy unless R-3 says otherwise.
- **P3 release:** CI nightly green for a week, the STATISTICAL claims gated once, docs with
  tiers. The week is 7 consecutive green `nightly.yml` (DETERMINISTIC) runs; the A/B is one
  release-gating run, never a streak (P3-R5a, section 5d).
  - Ruling P3-R1 (maintainer, 2026-11-11, asked "Should a benchmark be planned post 1.0.0 or
    prior?"; answer "As you recommend"): the STATISTICAL A/B (hint vs branchless, branchless vs
    branchy; interleaved, hosted CI on x86 AND arm64, R-10) is gated BEFORE `/release 1.0.0`,
    because the README choice table's "When" advice rests on one Apple M4 Pro (PRELIMINARY) and
    an inherited I1; the REPORTED n-sweep tables wait until after 1.0.0 (docs only, a 1.0.x
    docs release). Not chosen: ship 1.0 as correctness-only with neutral "When" wording and
    move every benchmark to 1.1. Needs first: the CI workflow (owner ruled 2026-11-11, section 5d) and the
    A/B tests (a research rung, then a gate unit); both may run during the final audit.

The likely outcome to plan for: the main value is ONE tested set of kernels with one contract
replacing ~28 copies; speed wins are per site and must be shown per site.

## 9. LiteUtils integration (planning only, 2026-11-10)

LiteUtils is the suite's V8 measurement tooling. Today it is `0.0.0`, `private: true`, with no
`bin` or `exports` (LiteUtils/package.json:3, 9-10). The maintainer plans its full release soon,
possibly 2026-11-10. Nothing below is wired yet.

**How LiteSignal and LiteLogLogN integrate it today:** copied scripts, never imported. Neither
package.json depends on `@zakkster/lite-utils`.
- LiteLogLogN: `test/tools/inlining-budget-diff.sh`, whose header names the LiteUtils source
  sha256 (`740da13b...`, 902 lines), cut to driver mode. `test/InliningTool.test.js` tests the
  copy; npm script `inline-budget-diff`. ROADMAP R0 item 4: "copied, never imported".
- LiteSignal: `bench/inlining-budget-diff.sh` and `bench/bytecode-budget.sh` (npm scripts
  `inline-budget-diff`, `bytecode-budget`), replaced by the maintainer's LiteUtils copy
  (CHANGELOG, decision D-b143-2, 2026-10-30). `test/94-inlining-budget-diff.test.mjs` runs
  the copy's `--self-test`.

**Which tool serves which item here:**

| LiteUtils tool | Serves | Tier |
|---|---|---|
| `alloc-per-op.mjs` | R-8; the 0 B/op gate on every kernel, with a must-fail boxed lane (section 6) | DETERMINISTIC |
| `ic-diff.sh` | R-4 (does a factory share one feedback vector?); R-11 (does a type-dispatch front keep each kernel monomorphic?) | research probe |
| `bytecode-budget.sh` | the bytecode gate: < 100 B on kernels Maglev should inline; the branchless pair stays 103 B and pins TurboFan inlining (Q-BODY (c), LEDGER C7) | DETERMINISTIC on a pinned Node |
| `inlining-budget-diff.sh` | R-11: does the kernel the selector returns still inline into the caller through a const / stored field? | research probe, then a gate if R-11 is adopted |
| `deopt-diff.sh` | R-4: does a mixed-type app deopt a shared kernel, and do the per-type kernels stay clean? | research probe |
| `allocation-diff.sh` | role here not decided: read its `-h` first (candidate: before / after allocation at P2 adoption) | TBD |

The quiet lock is a suite hook (`~/.claude/hooks/quiet-lock.mjs`), not part of LiteUtils.

**Q-LU-1 -- RULED 2026-11-10 (maintainer):** "add LiteUtils as a devDependency - it would be
further developed, so 1.0.0 and above would assure that always the newest version will be
installed".
- `@zakkster/lite-utils` is a devDependency at `^1.0.0` (Q-LU-1a), not an exact pin, so
  LiteBisect follows LiteUtils as it develops. npm scripts call its bins; hosted CI gets the
  tools from `npm install`. `dependencies` stays empty, so the zero-deps law holds.
- Needs: a LiteUtils release >= 1.0.0 that ships `bin` entries (or `exports`) for the tools in
  the table above.
- Declined: copying the tools with sha256 pins (the LiteSignal / LiteLogLogN pattern).
- Consequence: a gate's verdict can change when LiteUtils changes, with no edit in this
  package. So every gate and probe run records the INSTALLED LiteUtils version
  (`npm ls @zakkster/lite-utils`) in its provenance, and a changed verdict is first checked
  against a LiteUtils version change before the kernels are blamed.
- Note: `package-lock.json` is gitignored, as in LiteLogLogN and LiteFastBit32. So every fresh
  `npm install` (local or CI) resolves the newest 1.x, and no diff in this repo shows that
  LiteUtils moved. The recorded installed version is the only trace, which is why every run
  records it.

**Q-LU-1a -- RULED 2026-11-10 (maintainer):** `^1.0.0`. "There are not planned 2.0.0, only
minors, so your recommendation is accepted". The newest 1.x is installed when the lock is
refreshed. A LiteUtils 2.0.0, if one ever ships, is not picked up until this package moves to
`^2.0.0` on purpose. Declined: `>=1.0.0` (would take any future major too).

**Note on Q-LU-1a (2026-11-10; ruled: NOT reopened):** an external review of lite-pick
(RECOMMENDATIONS.md section 5) recommends pinning `@zakkster/*` tooling EXACTLY, because "a
tooling update can move a perf gate". P0 produced a concrete case (LEDGER D2): when LiteUtils
fixes alloc-per-op's STEADY fail-open, LiteBisect's alloc gate results change with no diff in
this repo. That is a new mechanism, so the LEDGER rules allow reopening Q-LU-1a; whether to
reopen is the maintainer's decision. Raised 2026-11-10 (P0 burst 2), ruled "Keep ^1.0.0": NOT reopened. `^1.0.0` stands, with the installed version
recorded in every run's provenance.

Until LiteUtils >= 1.0.0 is published, P0 research probes call the tools from the LiteUtils
checkout by absolute path, and record the LiteUtils commit + sha in each probe's provenance.
