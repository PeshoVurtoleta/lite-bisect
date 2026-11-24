# Changelog

All notable changes to `@zakkster/lite-bisect` will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Docs and test-file comments only: citations of the 1.1 evidence folders and files now name `.handoff/archive/1.1.0/`
  (the folders were archived after the 1.1.0 release); no code or behavior change.

## [1.1.0] - 2026-11-24

### Added

- 10 exports in `Bisect.js` (47 in all: 9 kernel families x 5 array types = 45 kernels, plus 2 cold asserts),
  suffix `F64` / `F32` / `U32` / `U16` / `I32` as before:
  - `upperBoundHint*` -- `upperBoundHint<T>(a, lo, hi, x, h)`: the upper bound, galloping out from the hint `h`.
    `h` is an integer index or NaN (NaN -> `lo`; outside `[lo, hi]` clamped); a non-integer `h` is a caller error.
    A NaN query returns `lo`.
  - `segmentHint*` -- `segmentHint<T>(a, lo, hi, x, s)`: `segment`, where `s` is the previous segment result
    (`lo - 1 .. hi - 1`) and the gallop starts at `s + 1`. `s` is an integer or NaN (NaN -> as `s = lo - 1`;
    outside `[lo - 1, hi - 1]` clamped); a non-integer `s` is a caller error. A NaN query returns `lo - 1`.
    For a coherent stream of segment lookups, pass the previous result back as `s`.
  - The `hi - lo <= 2^30 - 1` range cap applies to both.
- The allocation statement (unchanged sentence) gains one line for the new families: the `h` of `upperBoundHint*` is a
  hint as for `lowerBoundHint*`; the no-hint value of `segmentHint*` is `lo - 1` (an integer, no box); a NaN `s`
  (the literal NaN too) or a non-Smi `s` makes one 16 B HeapNumber on Node inside `segmentHint*` when
  `upperBoundHint*` is not inlined into it.
- `Bisect.d.ts` declares the 10 exports; README and `llms.txt` list them in every family enumeration, and the
  README / `llms.txt` statement that there is no `segmentHint*` export is replaced by its description.

### Changed

- `package.json`: `publishConfig.access` is `public`; `repository.url` is `git+https://...` (`npm pkg fix`); the
  description names the hinted upper bound and segment searches (one "segment", families worded as in the README
  opening).
- `Bisect.js` header comment only (no code change): the NaN-query sentence now also states that `segment` /
  `segmentHint` return `lo - 1` and `nearest` returns `lo`; the HeapNumber sentence says "on Node".
- README / `llms.txt`: a `segmentHint*` caller example for a row table with a zero-height leading row. At `pos = 0`
  the segment is the first row with a nonzero height, so a clamp of the `lo - 1` result alone returns 1 where row 0
  is wanted. The example guards `pos` first (`!(pos > 0)`, which also catches NaN), keeps `s` as the raw result, and
  shows that `pos >=` the total returns the row count. The docs test checks every value.

### Gates / Tests

- `test/abgate-boundary.test.mjs` (new): verdict boundary rows B1-B10 of the A/B gate (ported from LitePerfGate
  `r0-verdict-parity.mjs` 16693c6e), 10 must-fail comparator-flip mutants and an A/A control, run against
  `bench/ab-gate.mjs --verdict-file -` (untimed). `bench/ab-gate.mjs` is untouched and its sha256 (7e0f9262) is pinned.
- `test/Bisect.docs.test.mjs`: a roster row holds the 47 export names as a literal list; a name missing from the
  module, README or `llms.txt` now fails.
- `test/Bisect.inline.test.mjs`: a `call2_` source-shape row, and `edgesOf` throws on an undefined list.
- Release A/B (STATISTICAL): ab.yml run 43145179770 also gates 1.1.0 (ruling AB-G3a): the three gated F64 kernel
  bodies are byte-identical to 1.0.0 (AB-G2 parity) and `bench/ab-gate.mjs` is unchanged since the re-judging gate
  (3621f69, sha256 7e0f9262), so no new dispatch. `upperBoundHint*` and `segmentHint*` make no speed claim.

- `npm test`: 418 tests, 418 pass. Mutants: 146 rows (28 per type x 5 types + 3 rounded-tie + 3 infinity), all
  killed. Coverage: 100% lines, 100% branches, 47 / 47 functions (denominators not quoted: LEDGER C15). Counts from the burst-closing `npm run verify` (`.handoff/archive/1.1.0/fillers/verify.log`, 2026-11-24T07:52:46Z..07:56:59Z, exit 0, node v26.8.2, darwin arm64, host PRELIMINARY (load1 3.40 at start vs baseline 2.21), one run; the mutant rows were last read in the 1.1 cycle's verify).
- Torture: phase 1 4096 cycles, 184320 / 184320 checks; phase 2 45 / 45 lanes x 200000 ops per lane.
- Alloc gate: 225 lanes (45 kernels). Bytecode gate, exact: `upperBoundHint<T>` 212 B, `segmentHint<T>` 31 B, five
  copies equal.
- TurboFan inline pin: 75 single-channel edges (every Node), plus 25 two-channel edges on node v26.8.2 only
  (DETERMINISTIC on the pin; NO VERDICT elsewhere). Trace your own caller.

## [1.0.0] - 2026-11-23

### Added

- 37 exports in `Bisect.js`: 7 kernel families x 5 array types (suffix `F64` Float64Array,
  `F32` Float32Array, `U32` Uint32Array, `U16` Uint16Array, `I32` Int32Array) plus 2 cold asserts.
  - `lowerBoundBranchless*`, `upperBoundBranchless*` (branchless lower / upper bound).
  - `lowerBoundBranchy*`, `upperBoundBranchy*` (branchy lower / upper bound).
  - `lowerBoundHint*` (lower bound galloping out from a hint `h`; for coherent query streams).
  - `segment*` (the last index with `a[i] <= x`; `lo - 1` when none, on NaN, on an empty range).
  - `nearest*` (the closest index; a tie goes to the LOWER index; an exact match wins; an empty range or NaN returns `lo`).
  - `assertRange(a, lo, hi)`, `assertSorted(a, lo, hi)`: cold checks that throw `RangeError`; no kernel calls them.
- The contract: sorted non-decreasing typed arrays with no NaN, integer ranges
  `0 <= lo <= hi <= a.length` with `hi - lo <= 2^30 - 1`; the hot kernels trust the caller; a NaN query
  returns `lo` (`lo - 1` from `segment`); the hint `h` is an integer index or NaN, and a non-integer `h`
  is a caller error. Node >= 22.
- The allocation statement: zero allocation where the kernel inlines into its caller, or every number
  argument (the query; the hint of lowerBoundHint*; lo / hi) is a Smi; a non-Smi number computed at run
  time or read from a typed array (a fractional query, a NaN hint read from a Float64Array, -0 for lo / hi)
  and passed across a call V8 does not inline is boxed by the caller: one 16 B HeapNumber per such argument on Node.
  For no hint pass lo or the literal NaN: neither boxes.
- Hand-written TypeScript declarations (`Bisect.d.ts`), checked by tsc 7.0.2 in node16 / nodenext /
  bundler resolution and by a parity test against the runtime exports; `npm run test:types`.
- Kernels generated from one template (`scripts/gen.mjs`); `npm run gen:check` verifies the generated region.
- Gates: a naive-reference oracle per type (4 seeds), a boundary table, mutant kills (106 rows), a torture
  run with a retained-heap gate, c8 coverage at 100% lines / branches, golden parity, a TurboFan inline pin
  (traced per kernel x type, pinned Node), alloc and bytecode gates (`npm run gates` on the devDependency `@zakkster/lite-utils` ^1.1.0, run by the
  ci.yml `gates` job; `npm run gates:local` on a LiteUtils checkout; pinned Node only; not in `npm test`), tsc type checks, a doc-truth test, and a size / pack gate (`npm run size`: the tarball file list and
  committed size budgets; DETERMINISTIC, not in `npm test`). `npm run verify` chains test, torture, coverage,
  size and gates:local, fail-fast.
- A release A/B (`bench/ab-gate.mjs` in the source repository, hosted ab.yml on ubuntu-latest + macos-latest,
  dispatch-only, once per release; STATISTICAL): 13 gated F64 lanes (hint vs branchless, branchless vs branchy
  read-only and feeds-write); 1.0.0 is gated by run 43145179770 (VERDICT PASS gated=13/13 on AMD EPYC 9V74 x86-64
  and Apple M1 (Virtual) arm64; re-judged 2026-11-23 under AB-G3).
- Tree-shaking gate under esbuild (`test/Bisect.shake.test.mjs`, in `npm test`); devDependency esbuild ^0.28.2.
- README, `llms.txt`, MIT `LICENSE.txt`.

### Fixed

- R-NEAREST: `nearest*` (F64, F32, I32) was wrong on a rounded tie (the two gaps compare equal after
  rounding but are not equal); it now decides the exact rounding error and returns the exactly closer index.
  The body grows 86 -> 189 B, so Maglev is expected not to inline it (189 B >= its 100 B cap; untraced); TurboFan does (inline pin).
- R-ORACLE: the test oracles (`naiveNearest`, `nearestWith`, `cfNearest`) shared the kernel's rounded
  expression; they now decide with exact integer arithmetic, backed by an exact-reference fuzz with a
  coverage floor of false rounded ties.
- R-TORTURE-MINOR: the torture now gates steady minor GCs (0) with a pinned 1 MB semi-space
  (`--expose-gc --no-concurrent-recompilation --single-threaded-gc --min-semi-space-size=1 --max-semi-space-size=1`);
  it prints NO VERDICT and exits 2 without the two semi-space flags, and NO VERDICT without --single-threaded-gc
  (concurrent sweeping made the retained term flaky under load); a must-fail 16 B/op plant exits 1.
  A lane whose GC observer is still undrained after a 2000 ms re-settle (lite-gc-profiler settle()'s 200 ms default
  timed out, by elimination; a host stall inferred; nightly 45024298534) but is otherwise ok, or a control neither
  flagged nor drained, reads UNDRAINED and the run NO VERDICT (exit 2), never a pass; a FAIL still
  wins (exit 1); a test-only LITE_BISECT_TORTURE_STALL_MS hook drives the must-fail controls.
- R-LLMS-SNIPPETS: the `llms.txt` usage results are checked `// -> n` lines; the docs test runs the
  `llms.txt` js fences and fails on a bare `// <number>` result comment in README / `llms.txt`.
- BIS-neon-1: the nearest oracle (`test/oracle.mjs`) and the mutant gate had no +-Infinity, so a flipped
  `d < u` in `nearestF32` / `nearestF64` (wrong on an exact +Infinity match) and the F64 overflow guard removed
  survived. The oracle now answers F64 / F32 infinity groups by its own rule; three mutant rows
  (`nearest.inf-gt.F64`, `nearest.inf-gt.F32`, `nearest.au-r1a.F64`; 106 rows) are KILLED;
  `test/Bisect.nearest-exact.test.mjs` runs its Infinity rows on F32 too. Test-only: no kernel byte changed.
- BIS-neon-2: `bench/ab-gate.mjs` (the ab.yml release verdict) read VERDICT PASS on a negative bop cell, a NaN
  `aa.q1` / `aa.q3` / `slow.q3`, a tampered HEADER `NQ2` / `minWindow`, and a dropped or doubled `PROV start`
  line. It now needs finite medians and quartiles, every bop cell `>= 0`, `NQ2` and `minWindow` equal to the
  gate's own, and exactly one `PROV start`; `--selftest` with `--K` is refused. Fixture controls F37-F45.
- BIS-neon-3: the alloc gate's empty-lane harness check had no floor; a negative window now reads NO VERDICT
  ("outside [0, 1] B/op").
- BIS-neon-4: `test/gates/lu.mjs` (the LiteUtils tool resolver) now checks the package name (env dir and
  installed), requires a `LITE_UTILS_DIR` to be its own git top level (a parent repo's commit is refused),
  compares real paths in its CLI guard (a symlinked path no longer skips the CLI), and runs git without
  `GIT_DIR` / `GIT_INDEX_FILE` / `GIT_WORK_TREE`.
- BIS-neon-5: the doc-truth test (`test/Bisect.docs.test.mjs`) failed open: a `.md` cited with a `./`, `../` or
  `dir/` prefix was invisible; the pointer sentence excused every unshipped `.md`; README and `llms.txt` speed
  words were unchecked; and a following block could lend its tier word. Cited paths are now checked as written
  against `files[]`; the pointer sentence excuses only the LEDGER and RESEARCH files; README and `llms.txt` join
  the speed check, which splits at sentences, paragraphs, JSDoc open / close, list items and table cells and
  exempts only a quoted, negated speed word naming a statement (`no "faster than" statement`). Three README / `llms.txt` speed sentences that
  took their tier from the next sentence now carry it themselves (same evidence, PRELIMINARY; the two hint sentences are STATISTICAL since R-README-TIERS).
- BIS-neon-7: `package.json` had no `repository` while README and `llms.txt` point to the source repository:
  `repository` added (NEON-R2), and a docs row requires it whenever a shipped doc holds the pointer sentence.
  README offered `lowerBoundHintF64` as the hint for the `segmentF64` playhead; it answers a lower bound, not a
  segment (checked lines added; there is no `segmentHint*` export). README counts and provenance refreshed from
  this cycle's runs.
- BIS-neon-8: `assertRange` / `assertSorted` throw RangeError on a non-number or unsafe `a.length` and on unsafe
  lo / hi; every call on the five typed arrays keeps its result and message (parity). `gen.mjs` refuses
  trailing text after the end marker.
- ABOBS: a failing `bench/ab-gate.mjs --selftest` row printed only the child's last 8 lines, so a red selftest
  in ab.yml lost the child's RESULT / RAW lines (macOS run 45079558712, the red itself still unexplained). The selftest now
  replays a failing child's RESULT / RAW / VOID / ORACLE / STOP / CRASH lines from before those 8 lines, then the same 8
  lines; a first selftest row proves it on a stub output. No verdict, word or threshold changed; no kernel byte changed.

### Changed

- R-NANHINT-BOX: the allocation sentence now names every number argument and says a non-Smi number
  computed at run time or read from a typed array (a NaN hint from a Float64Array) is boxed by the
  caller; for no hint pass `lo` or the literal `NaN`. Alloc lanes `lowerBoundHint*.nanhint` and `.nanlit`.
- R-RESEARCH-REF: README and `llms.txt` say LEDGER and RESEARCH ids refer to files in the source
  repository, not the npm tarball; a docs row checks every cited `<NAME>.md`.
- R-DTS-TIER: the `lowerBoundHint*` declarations say the incoherent-stream slowdown is STATISTICAL for F64
  (ab.yml run 43145179770, two CPUs, n <= 65,536), no longer PRELIMINARY; a docs row fails an untiered "slower" / "faster" in `Bisect.d.ts`.
- R-README-TIERS: the choice-table rows for branchless / branchy / hint carry STATISTICAL words from ab.yml run
  43145179770 (both CPUs, F64; branchy n <= 128, the others n <= 65,536); the branchy row moved from INHERITED
  to STATISTICAL (Q-AB-FEEDSWRITE).
- NEON-R1 (BIS-neon-6; amends AU-R3 / R-NANHINT-BOX): the allocation sentence said "one 16 B HeapNumber per
  call"; two non-Smi arguments across a call V8 does not inline box 2 x 16 B, so it now says "one 16 B
  HeapNumber per such argument on Node" in `Bisect.js`, `Bisect.d.ts`, README, `llms.txt` and the docs-test
  literal; README's allocation table says one box per non-Smi argument and gains a two-argument row. Gated by
  the alloc lanes `lowerBoundHint*.fracnanhint` (fractional query and NaN hint, both read from Float64Arrays):
  run B 28..36 B/op, run A the floor.

### Not shipped from the draft

- `lowerBound` (the length switch), `LINEAR_MAX` and `lowerBoundLinear`: refused (LEDGER A4); the switch
  never read faster and read slower at every small length measured (PRELIMINARY: one Apple M4 Pro, one strict run, P0 2026-11-10; no number is claimed).
- `buildEytzinger` and `lowerBoundEytzinger`: parked (LEDGER A6); never measured on this package.
- No selector and no per-call type front that picks a kernel (LEDGER A3, A5): you call the per-type
  kernel by name.
