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
- The allocation statement: zero allocation where the kernel inlines into its caller, or the query is a
  Smi; a non-Smi number query passed across a call V8 does not inline boxes one 16 B HeapNumber.
- Hand-written TypeScript declarations (`Bisect.d.ts`), checked by tsc 7.0.2 in node16 / nodenext /
  bundler resolution and by a parity test against the runtime exports; `npm run test:types`.
- Kernels generated from one template (`scripts/gen.mjs`); `npm run gen:check` verifies the generated region.
- Gates: a naive-reference oracle per type (4 seeds), a boundary table, mutant kills (100 rows), a torture
  run with a retained-heap gate, c8 coverage at 100% lines / branches, golden parity, a TurboFan inline pin
  (traced per kernel x type, pinned Node), alloc and bytecode gates (`npm run gates:local`, LiteUtils
  tools, pinned Node only, not yet in `npm test` or hosted CI), tsc type checks, a doc-truth test, and a size / pack gate (`npm run size`: the tarball file list and
  committed size budgets; DETERMINISTIC, not in `npm test`). `npm run verify` chains test, torture, coverage,
  size and gates:local, fail-fast.
- README, `llms.txt`, MIT `LICENSE.txt`.

### Not shipped from the draft

- `lowerBound` (the length switch), `LINEAR_MAX` and `lowerBoundLinear`: refused (LEDGER A4); the switch
  never read faster and read slower at every small length measured (PRELIMINARY: one Apple M4 Pro, one strict run, P0 2026-11-10; no number is claimed).
- `buildEytzinger` and `lowerBoundEytzinger`: parked (LEDGER A6); never measured on this package.
- No selector and no per-call type front that picks a kernel (LEDGER A3, A5): you call the per-type
  kernel by name.
