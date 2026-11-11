# Changelog

All notable changes to `@zakkster/lite-bisect` will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  and passed across a call V8 does not inline is boxed by the caller: one 16 B HeapNumber per call on Node.
  For no hint pass lo or the literal NaN: neither boxes.
- Hand-written TypeScript declarations (`Bisect.d.ts`), checked by tsc 7.0.2 in node16 / nodenext /
  bundler resolution and by a parity test against the runtime exports; `npm run test:types`.
- Kernels generated from one template (`scripts/gen.mjs`); `npm run gen:check` verifies the generated region.
- Gates: a naive-reference oracle per type (4 seeds), a boundary table, mutant kills (103 rows), a torture
  run with a retained-heap gate, c8 coverage at 100% lines / branches, golden parity, a TurboFan inline pin
  (traced per kernel x type, pinned Node), alloc and bytecode gates (`npm run gates:local`, LiteUtils
  tools, pinned Node only, not yet in `npm test` or hosted CI), tsc type checks, a doc-truth test, and a size / pack gate (`npm run size`: the tarball file list and
  committed size budgets; DETERMINISTIC, not in `npm test`). `npm run verify` chains test, torture, coverage,
  size and gates:local, fail-fast.
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
- R-LLMS-SNIPPETS: the `llms.txt` usage results are checked `// -> n` lines; the docs test runs the
  `llms.txt` js fences and fails on a bare `// <number>` result comment in README / `llms.txt`.

### Changed

- R-NANHINT-BOX: the allocation sentence now names every number argument and says a non-Smi number
  computed at run time or read from a typed array (a NaN hint from a Float64Array) is boxed by the
  caller; for no hint pass `lo` or the literal `NaN`. Alloc lanes `lowerBoundHint*.nanhint` and `.nanlit`.
- R-RESEARCH-REF: README and `llms.txt` say LEDGER and RESEARCH ids refer to files in the source
  repository, not the npm tarball; a docs row checks every cited `<NAME>.md`.
- R-DTS-TIER: the `lowerBoundHint*` declarations say the incoherent-stream slowdown is PRELIMINARY
  (one CPU, no timing lane gated); a docs row fails an untiered "slower" / "faster" in `Bisect.d.ts`.

### Not shipped from the draft

- `lowerBound` (the length switch), `LINEAR_MAX` and `lowerBoundLinear`: refused (LEDGER A4); the switch
  never read faster and read slower at every small length measured (PRELIMINARY: one Apple M4 Pro, one strict run, P0 2026-11-10; no number is claimed).
- `buildEytzinger` and `lowerBoundEytzinger`: parked (LEDGER A6); never measured on this package.
- No selector and no per-call type front that picks a kernel (LEDGER A3, A5): you call the per-type
  kernel by name.
