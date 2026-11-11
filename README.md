# @zakkster/lite-bisect

> Zero-GC binary search kernels for sorted typed arrays. Lower / upper bound (branchless and branchy), a galloping hint search, segment and nearest -- one monomorphic copy of every kernel per array type (Float64, Float32, Uint32, Uint16, Int32). No throw on the hot path; zero allocation where the kernel inlines into its caller or the query is a Smi; a contract you can read in one screen.

[![npm version](https://img.shields.io/npm/v/@zakkster/lite-bisect.svg?style=for-the-badge&color=latest)](https://www.npmjs.com/package/@zakkster/lite-bisect)
[![sponsor](https://img.shields.io/badge/sponsor-PeshoVurtoleta-ea4aaa.svg?logo=github)](https://github.com/sponsors/PeshoVurtoleta)
![Zero-GC](https://img.shields.io/badge/Zero--GC-Engine-00C853?style=for-the-badge&logo=leaf&logoColor=white)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@zakkster/lite-bisect?style=for-the-badge)](https://bundlephobia.com/result?p=@zakkster/lite-bisect)
[![npm downloads](https://img.shields.io/npm/dm/@zakkster/lite-bisect?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zakkster/lite-bisect)
[![npm total downloads](https://img.shields.io/npm/dt/@zakkster/lite-bisect?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zakkster/lite-bisect)
![TypeScript](https://img.shields.io/badge/TypeScript-Types-informational)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
[![license](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE.txt)

## The sorted-array search the ecosystem was missing

Every hot loop that maps a value to a slot -- a keyframe track, a LUT, a spatial strip, a timeline -- ends up hand-rolling the same binary search, once per array type, with a different edge-case bug each time. `lite-bisect` is that search written once, per type, with one stated contract: what a NaN query returns, what a tie returns, what an empty range returns, and what the caller owes the kernel.

```bash
npm install @zakkster/lite-bisect
```

```js
import { lowerBoundBranchlessF64, upperBoundBranchlessF64, segmentF64, nearestF64 } from "@zakkster/lite-bisect";

// A sorted, non-decreasing Float64Array (no NaN inside). The range [lo, hi) is [0, 5).
const a = new Float64Array([1, 3, 3, 5, 8]);

lowerBoundBranchlessF64(a, 0, 5, 3); // -> 1
upperBoundBranchlessF64(a, 0, 5, 3); // -> 3
segmentF64(a, 0, 5, 4); // -> 2
nearestF64(a, 0, 5, 4); // -> 2
```

Five array types, one contract, zero allocation where the kernel inlines into its caller. The kernels trust you: they do no range check and never throw. Validate once, off the hot path, with `assertRange` / `assertSorted`.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [What you get](#what-you-get)
- [Which call do I use](#which-call-do-i-use)
- [Deep dive: the kernels](#deep-dive-the-kernels)
- [API reference](#api-reference)
- [Composability](#composability)
- [Zero-GC design notes](#zero-gc-design-notes)
- [Design decisions worth knowing](#design-decisions-worth-knowing)
- [Testing](#testing)
- [What this is not](#what-this-is-not)
- [Ecosystem](#ecosystem)
- [License](#license)

---

## Why this exists

- **One search, written once per type.** A kernel that serves several array types from one call site goes megamorphic. So each type gets its own copy (generated from one template, checked byte-for-byte by `npm run gen:check`), and you call the per-type kernel by name.
- **A contract, not a convention.** NaN query -> `lo`. Tie in `nearest` -> the LOWER index. Empty range -> `lo`. Segment before the first key -> `lo - 1`. Each rule is in the header of `Bisect.js`, in the `.d.ts` JSDoc, and below.
- **Fail closed where it is cheap, trust where it is hot.** The hot kernels carry no range check (a guard that never fires still costs its bytes). The cold `assertRange` / `assertSorted` throw `RangeError`; call them once, at setup.
- **Claims that carry their evidence.** Every statement about inlining or allocation here is traced or gated, not assumed (see [Zero-GC design notes](#zero-gc-design-notes)).

---

## What you get

- **37 exports.** 7 kernel families x 5 array types = 35 kernels, plus 2 cold asserts. No classes, no state, no constants.
- **Families:** `lowerBoundBranchless*`, `upperBoundBranchless*`, `lowerBoundBranchy*`, `upperBoundBranchy*`, `lowerBoundHint*`, `segment*`, `nearest*`.
- **Suffixes:** `F64` (Float64Array), `F32` (Float32Array), `U32` (Uint32Array), `U16` (Uint16Array), `I32` (Int32Array).
- **Cold asserts:** `assertRange(a, lo, hi)`, `assertSorted(a, lo, hi)`.
- **Hand-written TypeScript declarations** (`Bisect.d.ts`), checked by `tsc` 7.0.2 and by a parity test against the runtime exports.
- **Zero runtime dependencies**, `sideEffects: false`, single ESM file, Node >= 22.

---

## Which call do I use

| Call | When | Evidence (LEDGER / RESEARCH id) | Tier |
|---|---|---|---|
| `lowerBoundBranchless*` / `upperBoundBranchless*` | The default for a read-only search. No speed is claimed. | C7: TurboFan inlines the 103 B body; Maglev does not inline it at its default 100 B cap. Law 3: traced, not expected. | DETERMINISTIC (inline pin, traced on the pinned Node; see below) |
| `lowerBoundBranchy*` / `upperBoundBranchy*` | The search result feeds a write (an insert position, a splice index). | I1: a branchless search loses when its result feeds a write. Inherited from another package, not re-run here. | INHERITED, not re-run here: unproven for this package, no gate |
| `lowerBoundHint*` | Coherent query streams: each query lands near the previous answer (the hint). | C5: PRELIMINARY, one CPU. Slower on incoherent streams; see RESEARCH.md 1.5. | STATISTICAL: pending (no timing lane gated yet) |
| `segment*` / `nearest*` | "Which interval holds x" (`segment`) / "which key is closest to x" (`nearest`). | Built on `upperBoundBranchless*` / `lowerBoundBranchless*`; contract rows in the oracle and boundary tests. | DETERMINISTIC (oracle, boundary, mutants) |
| `assertRange` / `assertSorted` | Setup, tests, debug builds. Never inside a hot loop. | Cold by design; no kernel calls them. | DETERMINISTIC (boundary tests) |

There is no selector and no per-call front that picks a kernel for you: a per-call lookup makes the call site polymorphic and blocks inlining (LEDGER A3); the selector is parked and the front refused (LEDGER A5). You choose, by name.

---

## Deep dive: the kernels

<details>
<summary><strong>Contract, kernel by kernel</strong></summary>

Every kernel takes `(a, lo, hi, x)`; the hint kernel takes a fifth argument `h`.

- `a` -- a sorted, non-decreasing typed array of the suffix's type, no NaN inside.
- `[lo, hi)` -- the half-open range searched: integers, `0 <= lo <= hi <= a.length`, `hi - lo <= 2^30 - 1`.
- **lower bound** -- the first `i` in `[lo, hi)` with `a[i] >= x`, else `hi`.
- **upper bound** -- the first `i` in `[lo, hi)` with `a[i] > x`, else `hi`.
- **hint** -- `lowerBoundHint*(a, lo, hi, x, h)`: the lower bound, galloping out from `h`. `h` is an integer index or NaN (NaN -> `lo`; outside `[lo, hi]` it is clamped). A non-integer `h` is a caller error that may return a wrong index or never return.
- **segment** -- `upper - 1`: the last `i` with `a[i] <= x`; `lo - 1` when `x < a[lo]`, on a NaN `x`, and on an empty range.
- **nearest** -- the index closest to `x`. A tie between the last value below `x` and the first above goes to the LOWER index. An exact match wins (the first `i` with `a[i] === x`). Within a run of equal values, the index next to `x`. An empty range -> `lo`. NaN -> `lo`.
- **NaN query** -- compares false everywhere: every lower / upper / hint kernel returns `lo`; `segment` returns `lo - 1`; `nearest` returns `lo`.

```js
import { lowerBoundBranchlessF64, lowerBoundBranchyF64, lowerBoundHintF64, segmentF64, nearestF64 } from "@zakkster/lite-bisect";

const a = new Float64Array([1, 3, 3, 5, 8]);

lowerBoundBranchlessF64(a, 0, 5, 4); // -> 3
lowerBoundBranchlessF64(a, 0, 5, 9); // -> 5
lowerBoundBranchlessF64(a, 0, 5, NaN); // -> 0
lowerBoundBranchlessF64(a, 2, 5, NaN); // -> 2
lowerBoundBranchyF64(a, 0, 5, 3); // -> 1

segmentF64(a, 0, 5, 3); // -> 2
segmentF64(a, 0, 5, 0); // -> -1
segmentF64(a, 0, 5, NaN); // -> -1
segmentF64(a, 2, 2, 4); // -> 1

nearestF64(a, 0, 5, 2); // -> 0
nearestF64(a, 0, 5, 3); // -> 1
nearestF64(a, 0, 5, 6.5); // -> 3
nearestF64(a, 0, 5, 100); // -> 4
nearestF64(a, 2, 2, 4); // -> 2

lowerBoundHintF64(a, 0, 5, 3, 4); // -> 1
lowerBoundHintF64(a, 0, 5, 8, 0); // -> 4
lowerBoundHintF64(a, 0, 5, 5, NaN); // -> 3
lowerBoundHintF64(a, 0, 5, 5, 99); // -> 3
```

The tie rule in words: in `[1, 3, 3, 5, 8]`, the value 4 sits exactly between 3 (index 2) and 5 (index 3), so `nearest` returns the lower index 2; 2 sits between 1 and 3 and returns 0; 6.5 sits between 5 and 8 and returns 3.

The other four types behave identically; only the array type and the value domain differ:

```js
import { lowerBoundBranchlessU16, upperBoundBranchlessI32, nearestI32, lowerBoundBranchlessF32, segmentU32 } from "@zakkster/lite-bisect";

lowerBoundBranchlessU16(new Uint16Array([10, 20, 30]), 0, 3, 25); // -> 2
upperBoundBranchlessI32(new Int32Array([-5, 0, 7]), 0, 3, 0); // -> 2
nearestI32(new Int32Array([-5, 0, 7]), 0, 3, -1); // -> 1
lowerBoundBranchlessF32(new Float32Array([0.5, 1.5, 2.5]), 0, 3, 1.5); // -> 1
segmentU32(new Uint32Array([1, 4294967295]), 0, 2, 4294967295); // -> 1
```

</details>

---

## API reference

All 37 exports. Every kernel returns a `number` (an index). `*` is one of `F64`, `F32`, `U32`, `U16`, `I32`; the array type `A` is `Float64Array`, `Float32Array`, `Uint32Array`, `Uint16Array`, `Int32Array` respectively.

| Family | Signature (per suffix) | Returns |
|---|---|---|
| `lowerBoundBranchless*` | `(a: A, lo, hi, x) => number` | first `i` in `[lo, hi)` with `a[i] >= x`, else `hi`; branchless |
| `upperBoundBranchless*` | `(a: A, lo, hi, x) => number` | first `i` in `[lo, hi)` with `a[i] > x`, else `hi`; branchless |
| `lowerBoundBranchy*` | `(a: A, lo, hi, x) => number` | same as lower, branchy loop |
| `upperBoundBranchy*` | `(a: A, lo, hi, x) => number` | same as upper, branchy loop |
| `lowerBoundHint*` | `(a: A, lo, hi, x, h) => number` | lower bound, galloping from the hint `h` |
| `segment*` | `(a: A, lo, hi, x) => number` | last `i` with `a[i] <= x`; `lo - 1` if none, on NaN, or on an empty range |
| `nearest*` | `(a: A, lo, hi, x) => number` | index closest to `x`; tie -> lower; empty / NaN -> `lo` |

The 35 kernel names, in full:

- Float64: `lowerBoundBranchlessF64`, `upperBoundBranchlessF64`, `lowerBoundBranchyF64`, `upperBoundBranchyF64`, `lowerBoundHintF64`, `segmentF64`, `nearestF64`
- Float32: `lowerBoundBranchlessF32`, `upperBoundBranchlessF32`, `lowerBoundBranchyF32`, `upperBoundBranchyF32`, `lowerBoundHintF32`, `segmentF32`, `nearestF32`
- Uint32: `lowerBoundBranchlessU32`, `upperBoundBranchlessU32`, `lowerBoundBranchyU32`, `upperBoundBranchyU32`, `lowerBoundHintU32`, `segmentU32`, `nearestU32`
- Uint16: `lowerBoundBranchlessU16`, `upperBoundBranchlessU16`, `lowerBoundBranchyU16`, `upperBoundBranchyU16`, `lowerBoundHintU16`, `segmentU16`, `nearestU16`
- Int32: `lowerBoundBranchlessI32`, `upperBoundBranchlessI32`, `lowerBoundBranchyI32`, `upperBoundBranchyI32`, `lowerBoundHintI32`, `segmentI32`, `nearestI32`

Cold checks (one copy each, called by no kernel):

| Export | Signature | Behavior |
|---|---|---|
| `assertRange` | `(a: BisectArray, lo: number, hi: number) => void` | `RangeError` unless `lo`, `hi` are integers, `0 <= lo <= hi <= a.length`, `hi - lo <= 2^30 - 1`. Reads only `a.length`. |
| `assertSorted` | `(a: BisectArray, lo: number, hi: number) => void` | `assertRange`, then `RangeError` on a NaN in `[lo, hi)` or a descent (`a[i] < a[i - 1]`). |

`BisectArray` is the type `Float64Array | Float32Array | Uint32Array | Uint16Array | Int32Array`.

```js
import { assertRange, assertSorted } from "@zakkster/lite-bisect";

const a = new Float64Array([1, 3, 3, 5, 8]);

assertRange(a, 0, 5); // -> undefined
assertRange(a, 0, 6); // -> throws RangeError
assertRange(a, 3, 2); // -> throws RangeError
assertSorted(a, 0, 5); // -> undefined
assertSorted(new Float64Array([2, 1]), 0, 2); // -> throws RangeError
assertSorted(new Float64Array([1, NaN]), 0, 2); // -> throws RangeError
```

**Constants:** none. The package exports no constants.

**The contract, in one place**

- Ranges are integers with `0 <= lo <= hi <= a.length` and `hi - lo <= 2^30 - 1`.
- The hot kernels trust the caller. A range outside the contract, an unsorted array, a NaN inside the array, or a non-integer hint may return a wrong index or never return.
- A NaN query returns `lo` from every lower / upper / hint kernel, `lo - 1` from `segment`, and `lo` from `nearest`.
- `nearest`: a tie goes to the LOWER index; an exact match wins; within a run of equal values the index next to `x`; an empty range returns `lo`.
- The hint `h` is an integer index or NaN. A non-integer `h` is a caller error.
- Node >= 22.

---

## Composability

A keyframe track: sorted times in a `Float64Array`, values in a parallel `Float64Array`. Validate once, then sample inside the frame loop with `segmentF64` and a lerp. Allocation follows the rule in [Zero-GC design notes](#zero-gc-design-notes): none once segmentF64 inlines into sample and sample into the frame loop; sample takes and returns doubles, so a call V8 does not inline boxes.

```js
import { assertSorted, segmentF64 } from "@zakkster/lite-bisect";

const times = new Float64Array([0, 10, 20, 40]);
const vals = new Float64Array([0, 100, 50, 90]);
const n = times.length;

// Setup, cold: validate once.
assertSorted(times, 0, n); // -> undefined

// Hot: one segment search, one lerp. Clamps outside [times[0], times[n - 1]].
function sample(t) {
    const i = segmentF64(times, 0, n, t);
    if (i < 0) return vals[0];
    if (i >= n - 1) return vals[n - 1];
    const u = (t - times[i]) / (times[i + 1] - times[i]);
    return vals[i] + (vals[i + 1] - vals[i]) * u;
}

sample(5); // -> 50
sample(30); // -> 70
sample(-3); // -> 0
sample(99); // -> 90
```

For a monotone playhead the previous answer is a good hint, so `lowerBoundHintF64(times, 0, n, t, prev)` is the call to try; whether it beats the plain kernel on your stream is a measurement for your caller (see the table above: STATISTICAL, pending).

---

## Zero-GC design notes

<details>
<summary><strong>Allocation table, inlining, and gated numbers</strong></summary>

The sentence this package stands behind, on one line:

zero allocation where the kernel inlines into its caller, or the query is a Smi; a non-Smi number query passed across a call V8 does not inline boxes one 16 B HeapNumber.

| Situation | Allocation |
|---|---|
| Kernel inlined into its caller (any query) | the floor |
| Kernel called across a real call, Smi query | the floor |
| Kernel called across a real call V8 does not inline, non-Smi query on Node (fractional, NaN, -0, or outside [-2^31, 2^31)) | one 16 B HeapNumber per call on Node (LEDGER C2); pointer-compressed V8 (Chrome / Electron: also [2^30, 2^31)) is unmeasured here |
| `assertRange` / `assertSorted` | cold: the thrown `RangeError` and its message string (only on a failure) |

Where TurboFan inlines a kernel (traced on the pinned Node, LEDGER C7), the non-Smi query never crosses a real call, so there is no box. Where it does not -- an un-optimized caller, or a call site V8 declines to inline -- there is. Pass a Smi query if a kernel sits across such a call.

A wrapper is not a shield: segment* (25 B) and nearest* (86 B) fit Maglev's 100 B cap but their inner 103 B branchless call does not (LEDGER C1), so a Maglev-tier caller with a non-Smi query is expected to box 16 B per call (SPEC R1; expected, not traced here).

Inlining facts (LEDGER C1, C7): the branchless lower / upper bodies are 103 B of bytecode; Maglev does not inline them at its default 100 B cap, TurboFan does. The branchy pair is 55 B. This is a property of the pinned V8, never assumed: the 103 B count and the TurboFan pin are gated below; Maglev's refusal was traced in P0, not gated here (law 3: EXPECTED inlining is not TRACED).

Gated numbers (each is ONE run, quoted as a measurement, never as a law):

| Gate | Result | Source and provenance |
|---|---|---|
| Oracle | 5 types x 4 seeds, 0 failures | `npm test`; `.handoff/p1/evidence/u4r2-coverage.log` (2026-11-11T07:24:26Z, node v26.8.2, load 4.64) |
| Mutants | 100 rows, 100 killed, 0 survived, control PASS | `.handoff/p1/evidence/u4r2-mutants.log` (2026-11-11T07:24:08Z, node v26.8.2, load 4.78); the live row "every row KILLED (killed === rows)" passes in `npm test` |
| Coverage (c8) | 100% lines (414 / 414), 100% branches (223 / 223), 37 / 37 functions | `.handoff/p1/evidence/u9-coverage.log` (2026-11-11T15:52:02Z, node v26.8.2, load averages 3.64 3.72 3.31; the coverage glob includes the docs test) |
| Torture, phase 1 | 4096 cycles, 143360 / 143360 checks, size 0, alive 0, orphans 0, leaks 0 | `.handoff/p1/evidence/u7r2-torture.log` (2026-11-11T09:08:07Z, node v26.8.2, load 10.37) |
| Torture, phase 2 | 35 / 35 lanes x 200000 ops per lane; retained B/op min -0.025, max 0.075; gc major 0, minor 0 | same log |
| TurboFan inline pin | every pinned edge inlined (traced per kernel x type); the M4 size control passes on the pinned Node | `.handoff/p1/evidence/u5-test.log` (2026-11-11T06:38:48Z, node v26.8.2, V8 14.6.202.34, load 39.11); the M4 control skips (never passes) on any other Node |
| Alloc gate, run A (inlined) | 140 / 140 lanes read at most 0.78 B/op in windows 1..5 (empty lane 0.52; tool floor 0.27) | `.handoff/p1/evidence/u6r2-gates.log` (2026-11-11T08:22:49Z, node v26.8.2, V8 14.6.202.34-node.28, load 2.80) |
| Alloc gate, run B (not inlined) | non-Smi lanes (105) read 16.25 .. 16.63 B/op (one HeapNumber); Smi lanes (35) at most 0.61 B/op; empty lane 0.41 | same log |
| Bytecode gate | branchless 103 B, branchy 55 B, hint 228 B, segment 25 B, nearest 86 B, five copies equal | same log |

The alloc and bytecode gates are `npm run gates:local` (the LiteUtils tools, commit aed66841e7949130bc780147d765414873edc3b9, `alloc-per-op.mjs` sha256 d4386d85..., `bytecode-budget.sh` sha256 0b9c9157...). They run on the pinned Node v26.8.2 only and are NOT yet in `npm test` or hosted CI; a run on any other Node is NO VERDICT, never a pass. Tier: DETERMINISTIC when run, not yet wired into the default test run.

</details>

---

## Design decisions worth knowing

- **A per-type kernel, by name.** One call site fed several array types goes megamorphic (LEDGER C3), so there is no `lowerBound(a, ...)` that accepts any type. Call `lowerBoundBranchlessF64` for a Float64Array.
- **No length switch, no linear-scan fallback.** The draft's `lowerBound` (a length switch), `LINEAR_MAX` and `lowerBoundLinear` did not ship: the switch never read faster and read slower at every small n measured (LEDGER A4, C4). (PRELIMINARY: one Apple M4 Pro, one strict run, P0 2026-11-10; no number is claimed)
- **No selector, no per-call front.** A per-call lookup blocks inlining (LEDGER A3); the setup-time selector is parked (its evidence is arm64-only) and the per-call type front is refused (LEDGER A5). No Eytzinger layout either (LEDGER A6, parked: unmeasured here).
- **The branchless body stays at 103 B.** A 92 B body inlines under Maglev but read slower under TurboFan at every fixed length measured; the maintainer ruled to keep the 103 B body (LEDGER C7). (PRELIMINARY: one Apple M4 Pro, one strict run, P0 2026-11-10; no number is claimed)
- **Trust on the hot path, assert on the cold one.** Range checks cost bytes in every call; the asserts are separate functions no kernel calls.
- **NaN fails closed by construction.** The comparisons are written so a NaN query compares false everywhere and returns `lo`.
- **Hint `h` is a caller error when it is not an integer or NaN.** It may return a wrong index or never return. This is documented, not guarded (P1-R9).
- **Range capped at `hi - lo <= 2^30 - 1`** (P1-R8).

---

## Testing

`npm test` runs 108 tests, 108 pass, 0 fail (`.handoff/p1/evidence/u9r2-npm-test.log`, 2026-11-11T16:00:12Z, node v26.8.2, load averages 3.48 3.47 3.32; one run). They cover: a naive-reference oracle per type (4 seeds each), a boundary table (every kernel x type), the contract rows for `segment` / `nearest` / the asserts, mutant kills, golden parity of the generated kernels, the TurboFan inline pin, the types check, and doc truth (snippets, Q-BOX, banned tokens; `test/Bisect.docs.test.mjs`).

```bash
npm test               # oracle, boundary, mutants, golden parity, gen check, inline pin, types, doc truth
npm run torture        # node --expose-gc test/torture.mjs : leak + retained-heap gate
npm run coverage       # c8, 100% lines and branches required
npm run test:types     # tsc in node16 / nodenext / bundler resolution + export parity
npm run gen:check      # the generated kernel region matches its template
npm run gates:local    # alloc + bytecode gates (LiteUtils; pinned Node v26.8.2 only)
npm run size           # npm pack file list + size budgets (test/gates/size-budget.json); not in npm test
npm run verify         # test + torture + coverage + size + gates:local (fail-fast)
```

Statistical claims (hint versus branchless speed, branchless versus branchy speed, the length switch, the 92 B body) are not gated yet: this package reports no timing number.

---

## What this is not

- **Not a general-purpose search.** Typed arrays only, sorted non-decreasing, no NaN inside. No plain `Array`, no comparator callback, no objects.
- **Not a sorting library.** It never reorders anything.
- **Not a validator on the hot path.** The kernels trust the caller; `assertRange` / `assertSorted` are the cold checks.
- **Not a polymorphic front.** There is no `lowerBound(a, ...)` that picks a kernel from the array type or the length; you call the per-type kernel by name.
- **Not a speed claim.** No benchmark table and no "faster than" statement ships here; the choice table above says which call fits which situation and what evidence stands behind it.
- **Not an Eytzinger / B-tree layout.** Plain sorted arrays only.

---

## Ecosystem

Part of the **@zakkster** zero-GC stack:

- [`lite-signal`](https://www.npmjs.com/package/@zakkster/lite-signal) -- zero-GC reactive graph for hot paths
- [`lite-leak`](https://www.npmjs.com/package/@zakkster/lite-leak) -- leak detection (used by the torture gate)
- [`lite-gc-profiler`](https://www.npmjs.com/package/@zakkster/lite-gc-profiler) -- GC and allocation profiling (used by the torture gate)
- **`lite-bisect`** -- this package

---

## License

MIT (c) Zahary Shinikchiev <shinikchiev@yahoo.com>
