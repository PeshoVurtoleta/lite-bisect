# @zakkster/lite-bisect

> Zero-GC binary search kernels for sorted typed arrays. Lower / upper bound (branchless and branchy), galloping hint searches (lower and upper bound), segment (also with a hint: the previous result) and nearest -- one monomorphic copy of every kernel per array type (Float64, Float32, Uint32, Uint16, Int32). No throw on the hot path; zero allocation where the kernel inlines into its caller or every number argument is a Smi; a contract you can read in one screen.

[![npm version](https://img.shields.io/npm/v/@zakkster/lite-bisect.svg?style=for-the-badge&color=latest)](https://www.npmjs.com/package/@zakkster/lite-bisect)
[![sponsor](https://img.shields.io/badge/sponsor-PeshoVurtoleta-ea4aaa.svg?logo=github)](https://github.com/sponsors/PeshoVurtoleta)
![Zero-GC](https://img.shields.io/badge/Zero--GC-Engine-00C853?style=for-the-badge&logo=leaf&logoColor=white)
![Tree-Shakeable](https://img.shields.io/badge/tree--shakeable-yes-brightgreen)
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
- **A contract, not a convention.** NaN query -> `lo` (`lo - 1` from `segment*` and `segmentHint*`). Tie in `nearest` -> the LOWER index. Empty range -> `lo`. Segment before the first key -> `lo - 1`. Each rule is in the header of `Bisect.js`, in the `.d.ts` JSDoc, and below.
- **Fail closed where it is cheap, trust where it is hot.** The hot kernels carry no range check (a guard that never fires still costs its bytes). The cold `assertRange` / `assertSorted` throw `RangeError`; call them once, at setup.
- **Claims that carry their evidence.** Every statement about inlining or allocation here is traced or gated, not assumed (see [Zero-GC design notes](#zero-gc-design-notes)).

---

## What you get

- **47 exports.** 9 kernel families x 5 array types = 45 kernels, plus 2 cold asserts. No classes, no state, no constants.
- **Families:** `lowerBoundBranchless*`, `upperBoundBranchless*`, `lowerBoundBranchy*`, `upperBoundBranchy*`, `lowerBoundHint*`, `segment*`, `nearest*`, `upperBoundHint*`, `segmentHint*`.
- **Suffixes:** `F64` (Float64Array), `F32` (Float32Array), `U32` (Uint32Array), `U16` (Uint16Array), `I32` (Int32Array).
- **Cold asserts:** `assertRange(a, lo, hi)`, `assertSorted(a, lo, hi)`.
- **Hand-written TypeScript declarations** (`Bisect.d.ts`), checked by `tsc` 7.0.2 and by a parity test against the runtime exports.
- **Zero runtime dependencies**, `sideEffects: false`, single ESM file, Node >= 22.

---

## Which call do I use

LEDGER and RESEARCH ids refer to LEDGER.md and RESEARCH.md in the source repository; they are not in the npm tarball.

| Call | When | Evidence (LEDGER / RESEARCH id) | Tier |
|---|---|---|---|
| `lowerBoundBranchless*` / `upperBoundBranchless*` | The default for a read-only search. Read-only on F64 at n 16 / 256 / 4096 / 65,536 `lowerBoundBranchlessF64` read faster than `lowerBoundBranchyF64` on both gated CPUs (STATISTICAL; time ratio 0.373..0.553). | C7: TurboFan inlines the 103 B body; Maglev does not inline it at its default 100 B cap. Law 3: traced, not expected. ab.yml run 43145179770 (lanes ro:16..ro:65536). | STATISTICAL (speed: gated release run 43145179770, AMD EPYC 9V74 x86-64 + Apple M1 (Virtual) arm64; F64, n <= 65,536) + DETERMINISTIC (inline pin, traced on the pinned Node; see below) |
| `lowerBoundBranchy*` / `upperBoundBranchy*` | The search result feeds a write (an insert position, a splice index). On F64 at n 16 and 128, with the result feeding `copyWithin`, `lowerBoundBranchlessF64` read slower than `lowerBoundBranchyF64` on both gated CPUs (STATISTICAL; time ratio 1.128..1.633); n > 128 is not gated. | I1 (inherited) reproduced here: ab.yml run 43145179770 (lanes fw:16, fw:128). | STATISTICAL (gated release run 43145179770, both CPUs; F64, n <= 128) |
| `lowerBoundHint*` | Coherent query streams: each query lands near the previous answer (the hint). On F64 with a coherent walk (n 4096 and 65,536, next answer 1 or 4 slots away) `lowerBoundHint*` read faster than `lowerBoundBranchless*` on both gated CPUs (STATISTICAL; time ratio 0.352..0.572). On uniform (incoherent) queries at n 256 / 4096 / 65,536 it read slower (STATISTICAL; time ratio 1.910..2.762), and at n 256 with the next answer 4 slots away it read slower (STATISTICAL; time ratio 1.217 on AMD EPYC 9V74, 1.311 on Apple M1 (Virtual)). | C5, gated lanes only: ab.yml run 43145179770 (13 / 13 gated lanes as expected on both CPUs; its C5 rule reads DIFFERS at the REPORTED lane walk:256:1; LEDGER B19 says why that 2026-11-12 run stands). | STATISTICAL (gated release run 43145179770, AMD EPYC 9V74 x86-64 + Apple M1 (Virtual) arm64; F64, n <= 65,536) |
| `upperBoundHint*` | Coherent query streams where the answer is an upper bound: pass the previous answer as the hint `h`. Same hint contract as `lowerBoundHint*` (NaN or `lo` for no hint). No speed claim is made for it. | C13: exact against a linear-scan oracle in the 1.1 cycle (oracle + hinted sweep, boundary, mutants); built on `upperBoundBranchless*`. | DETERMINISTIC (oracle, boundary, mutants, inline pin) |
| `segmentHint*` | A coherent stream of segment lookups (a playhead, a timeline cursor): pass the previous segment result back as `s` (`lo - 1` for the first lookup). No speed claim is made for it. | C13: exact against a linear-scan oracle; built on `upperBoundHint*`. | DETERMINISTIC (oracle, boundary, mutants, inline pin) |
| `segment*` / `nearest*` | "Which interval holds x" (`segment`) / "which key is closest to x" (`nearest`). | Built on `upperBoundBranchless*` / `lowerBoundBranchless*`; contract rows in the oracle and boundary tests. | DETERMINISTIC (oracle, boundary, mutants) |
| `assertRange` / `assertSorted` | Setup, tests, debug builds. Never inside a hot loop. | Cold by design; no kernel calls them. | DETERMINISTIC (boundary tests) |

Run provenance: ab.yml run 43145179770, 2026-11-12, commit 679dcad, node v26.8.2, K = 11 interleaved rounds, C = 3 compilations, A/A twin inside 0.95..1.05, load1 1.02 (AMD EPYC 9V74) and 24.11 (Apple M1 (Virtual)) at start, median time ratio candidate / base. Not measured: the upperBound* kernels, the F32 / U32 / U16 / I32 copies, n > 65,536, non-power-of-two n, Maglev-tier callers.

There is no selector and no per-call front that picks a kernel for you: a per-call lookup makes the call site polymorphic and blocks inlining (LEDGER A3); the selector is parked and the front refused (LEDGER A5). You choose, by name.

---

## Deep dive: the kernels

<details>
<summary><strong>Contract, kernel by kernel</strong></summary>

Every kernel takes `(a, lo, hi, x)`; the hint kernels take a fifth argument (`h`; `s` for `segmentHint*`).

- `a` -- a sorted, non-decreasing typed array of the suffix's type, no NaN inside.
- `[lo, hi)` -- the half-open range searched: integers, `0 <= lo <= hi <= a.length`, `hi - lo <= 2^30 - 1`.
- **lower bound** -- the first `i` in `[lo, hi)` with `a[i] >= x`, else `hi`.
- **upper bound** -- the first `i` in `[lo, hi)` with `a[i] > x`, else `hi`.
- **hint** -- `lowerBoundHint*(a, lo, hi, x, h)`: the lower bound, galloping out from `h`. `h` is an integer index or NaN (NaN -> `lo`; outside `[lo, hi]` it is clamped). A non-integer `h` is a caller error that may return a wrong index or never return.
- **upperHint** -- `upperBoundHint*(a, lo, hi, x, h)`: the upper bound, galloping out from `h`. `h` is an integer index or NaN (NaN -> `lo`; outside `[lo, hi]` it is clamped). A non-integer `h` is a caller error that may return a wrong index or never return.
- **segment** -- `upper - 1`: the last `i` with `a[i] <= x`; `lo - 1` when `x < a[lo]`, on a NaN `x`, and on an empty range.
- **segmentHint** -- `segmentHint*(a, lo, hi, x, s)`: `segment`, where `s` is the previous segment result (`lo - 1 .. hi - 1`) and the upper gallop starts from `s + 1`. `s` is an integer or NaN (NaN -> as `s = lo - 1`; outside `[lo - 1, hi - 1]` it is clamped). A non-integer `s` is a caller error that may return a wrong index or never return. The `hi - lo <= 2^30 - 1` cap applies to both new families.
- **nearest** -- the index closest to `x`. A tie between the last value below `x` and the first above goes to the LOWER index. An exact match wins (the first `i` with `a[i] === x`). Within a run of equal values, the index next to `x`. An empty range -> `lo`. NaN -> `lo`.
- **NaN query** -- compares false everywhere: every `lowerBound*` / `upperBound*` kernel (the hinted ones too) returns `lo`; `segment` and `segmentHint` return `lo - 1`; `nearest` returns `lo`.

```js
import { lowerBoundBranchlessF64, lowerBoundBranchyF64, lowerBoundHintF64, upperBoundHintF64, segmentF64, segmentHintF64, nearestF64 } from "@zakkster/lite-bisect";

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

upperBoundHintF64(a, 0, 5, 3, 4); // -> 3
upperBoundHintF64(a, 0, 5, 8, 0); // -> 5
upperBoundHintF64(a, 0, 5, 5, NaN); // -> 4
upperBoundHintF64(a, 0, 5, NaN, 2); // -> 0

segmentHintF64(a, 0, 5, 3, 0); // -> 2
segmentHintF64(a, 0, 5, 4, 2); // -> 2
segmentHintF64(a, 0, 5, 0, -1); // -> -1
segmentHintF64(a, 0, 5, 9, NaN); // -> 4
segmentHintF64(a, 0, 5, NaN, 2); // -> -1
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

All 47 exports. Every kernel returns a `number` (an index). `*` is one of `F64`, `F32`, `U32`, `U16`, `I32`; the array type `A` is `Float64Array`, `Float32Array`, `Uint32Array`, `Uint16Array`, `Int32Array` respectively.

| Family | Signature (per suffix) | Returns |
|---|---|---|
| `lowerBoundBranchless*` | `(a: A, lo, hi, x) => number` | first `i` in `[lo, hi)` with `a[i] >= x`, else `hi`; branchless |
| `upperBoundBranchless*` | `(a: A, lo, hi, x) => number` | first `i` in `[lo, hi)` with `a[i] > x`, else `hi`; branchless |
| `lowerBoundBranchy*` | `(a: A, lo, hi, x) => number` | same as lower, branchy loop |
| `upperBoundBranchy*` | `(a: A, lo, hi, x) => number` | same as upper, branchy loop |
| `lowerBoundHint*` | `(a: A, lo, hi, x, h) => number` | lower bound, galloping from the hint `h` |
| `segment*` | `(a: A, lo, hi, x) => number` | last `i` with `a[i] <= x`; `lo - 1` if none, on NaN, or on an empty range |
| `nearest*` | `(a: A, lo, hi, x) => number` | index closest to `x`; tie -> lower; empty / NaN -> `lo` |
| `upperBoundHint*` | `(a: A, lo, hi, x, h) => number` | upper bound, galloping from the hint `h`; NaN `x` -> `lo` |
| `segmentHint*` | `(a: A, lo, hi, x, s) => number` | `segment`, galloping from `s + 1`, `s` the previous segment result; NaN `x` -> `lo - 1` |

The 45 kernel names, in full:

- Float64: `lowerBoundBranchlessF64`, `upperBoundBranchlessF64`, `lowerBoundBranchyF64`, `upperBoundBranchyF64`, `lowerBoundHintF64`, `segmentF64`, `nearestF64`, `upperBoundHintF64`, `segmentHintF64`
- Float32: `lowerBoundBranchlessF32`, `upperBoundBranchlessF32`, `lowerBoundBranchyF32`, `upperBoundBranchyF32`, `lowerBoundHintF32`, `segmentF32`, `nearestF32`, `upperBoundHintF32`, `segmentHintF32`
- Uint32: `lowerBoundBranchlessU32`, `upperBoundBranchlessU32`, `lowerBoundBranchyU32`, `upperBoundBranchyU32`, `lowerBoundHintU32`, `segmentU32`, `nearestU32`, `upperBoundHintU32`, `segmentHintU32`
- Uint16: `lowerBoundBranchlessU16`, `upperBoundBranchlessU16`, `lowerBoundBranchyU16`, `upperBoundBranchyU16`, `lowerBoundHintU16`, `segmentU16`, `nearestU16`, `upperBoundHintU16`, `segmentHintU16`
- Int32: `lowerBoundBranchlessI32`, `upperBoundBranchlessI32`, `lowerBoundBranchyI32`, `upperBoundBranchyI32`, `lowerBoundHintI32`, `segmentI32`, `nearestI32`, `upperBoundHintI32`, `segmentHintI32`

Cold checks (one copy each, called by no kernel):

| Export | Signature | Behavior |
|---|---|---|
| `assertRange` | `(a: BisectArray, lo: number, hi: number) => void` | `RangeError` unless `a.length` is a number and `a.length`, `lo`, `hi` are safe integers, `0 <= lo <= hi <= a.length`, `hi - lo <= 2^30 - 1`. Reads only `a.length`. |
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
- A NaN query returns `lo` from every `lowerBound*` / `upperBound*` kernel (the hinted ones too) and from `nearest`, and `lo - 1` from `segment` and `segmentHint`.
- `nearest`: a tie goes to the LOWER index; an exact match wins; within a run of equal values the index next to `x`; an empty range returns `lo`.
- The hint `h` of `lowerBoundHint*` / `upperBoundHint*` is an integer index or NaN. `segmentHint*` takes `s`, the previous segment result (`lo - 1 .. hi - 1`) or NaN. A non-integer `h` or `s` is a caller error.
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

`sample` needs a segment (`upper - 1`, the last `i` with `times[i] <= t`). `lowerBoundHint*` answers a lower bound (the first `i` with `times[i] >= t`), not a segment, so it is not a drop-in hint for `segmentF64`. For a coherent stream of segment lookups use `segmentHint*`: pass the previous result back as `s` (`lo - 1` before the first lookup). On `times` above (t = 5) and on a track with a duplicate key (`[0, 10, 10, 20]`, t = 10) the two differ:

```js
import { segmentF64, lowerBoundHintF64 } from "@zakkster/lite-bisect";

const times = new Float64Array([0, 10, 20, 40]);
segmentF64(times, 0, 4, 5); // -> 0
lowerBoundHintF64(times, 0, 4, 5, 0); // -> 1
segmentF64(new Float64Array([0, 10, 10, 20]), 0, 4, 10); // -> 2
lowerBoundHintF64(new Float64Array([0, 10, 10, 20]), 0, 4, 10, 0); // -> 1
```

A playhead with `segmentHintF64`: the previous result is the next `s`, and `lo - 1` (here -1) is the value for no previous result. Hand-derived on `times` above: the upper bound of 5 is 1, of 30 is 3, of 99 is 4, of -3 is 0, and the segment is that minus 1.

```js
import { segmentHintF64 } from "@zakkster/lite-bisect";

const times = new Float64Array([0, 10, 20, 40]);
let s = -1;

s = segmentHintF64(times, 0, 4, 5, s); // -> 0
s = segmentHintF64(times, 0, 4, 30, s); // -> 2
s = segmentHintF64(times, 0, 4, 99, s); // -> 3
s = segmentHintF64(times, 0, 4, -3, s); // -> -1
```

A row table (a virtual list) with a zero-height leading row: `offsets[i]` is the top of row `i`, so the segment is the last `i` with `offsets[i] <= pos`. At `pos = 0` that is the last `i` with `offsets[i] = 0` (here row 1, the first row with a nonzero height), not row 0, so clamping `r < 0 ? 0 : r` returns 1 here. Guard `pos` first; `!(pos > 0)` also catches NaN, which would otherwise give -1. Keep `s` as the previous raw result; an early return leaves it alone. At `pos >= offsets[3]` (the total, here 30) the result is 3, the row count, one past the last row: where the caller needs a row index, clamp the returned value, not `s`.

```js
import { segmentHintF64 } from "@zakkster/lite-bisect";

const offsets = new Float64Array([0, 0, 10, 30]); // three rows, heights 0, 10, 20
const r = segmentHintF64(offsets, 0, 4, 0, -1); // -> 1
(r < 0 ? 0 : r); // -> 1

let s = -1;
function rowAt(pos) {
    if (!(pos > 0)) return 0;
    s = segmentHintF64(offsets, 0, 4, pos, s);
    return s;
}
rowAt(0); // -> 0
rowAt(NaN); // -> 0
rowAt(-5); // -> 0
rowAt(5); // -> 1
rowAt(29); // -> 2
rowAt(0); // -> 0
rowAt(10); // -> 2
rowAt(30); // -> 3
```

Where a lower bound is what your caller needs and the stream is monotone, the previous answer is a good hint; whether `lowerBoundHint*` beats the plain kernel on your stream is a measurement for your caller (see the table above: STATISTICAL on F64, n <= 65,536, two CPUs; your stream, CPU and array type are still a measurement).

---

## Zero-GC design notes

<details>
<summary><strong>Allocation table, inlining, and gated numbers</strong></summary>

The sentence this package stands behind, on one line:

zero allocation where the kernel inlines into its caller, or every number argument (the query; the hint of lowerBoundHint*; lo / hi) is a Smi; a non-Smi number computed at run time or read from a typed array (a fractional query, a NaN hint read from a Float64Array, -0 for lo / hi) and passed across a call V8 does not inline is boxed by the caller: one 16 B HeapNumber per such argument on Node. For no hint pass lo or the literal NaN: neither boxes.

Hinted upper kernels: the `h` of `upperBoundHint*` is a hint as for `lowerBoundHint*` (no hint = `lo` or the literal `NaN`). The no-hint value of `segmentHint*` is `lo - 1` (an integer, no box); a NaN `s` (the literal `NaN` too) or a non-Smi `s` makes one 16 B HeapNumber on Node inside `segmentHint*` (`s + 1` is a new double) when `upperBoundHint*` is not inlined into it.

| Situation | Allocation |
|---|---|
| Kernel inlined into its caller (any query) | the floor |
| Kernel called across a real call, every number argument a Smi (query; h; lo / hi), or h the literal NaN | the floor |
| Kernel called across a real call V8 does not inline, a non-Smi query computed at run time or read from a typed array on Node (fractional, NaN, -0, or outside [-2^31, 2^31)), every other number argument a Smi | one 16 B HeapNumber per non-Smi argument, here one, made by the caller (LEDGER C2, C9, C12); pointer-compressed V8 (Chrome / Electron: also [2^30, 2^31)) is unmeasured here |
| `lowerBoundHint*` / `upperBoundHint*` called with a NaN hint read from a Float64Array and a Smi query, across a call V8 does not inline | one 16 B HeapNumber for the hint (one non-Smi argument), made by the CALLER (LEDGER C9); the literal `NaN` or `h = lo` is the floor |
| `segmentHint*` with no hint (`s = lo - 1`, an integer) and a Smi query | the floor: no box |
| `segmentHint*` called with the literal `NaN` as `s` (or a non-Smi `s` the caller already holds boxed) and a Smi query, across a call V8 does not inline into it | one 16 B HeapNumber made INSIDE `segmentHint*` (`s + 1` is a new double crossing the call to `upperBoundHint*`); gated by the `nanlit` lane (run B 14..18 B/op, run A the floor) |
| `segmentHint*` called with a NaN `s` read from a Float64Array, a Smi query, across a call V8 does not inline | 2 x 16 B: the caller's box for the argument plus the box inside `segmentHint*`; gated by the `nanhint` lane (run B 28..36 B/op) |
| Two non-Smi arguments across a call V8 does not inline (e.g. `lowerBoundHint*` with a fractional query and a NaN hint, both read from Float64Arrays) | 2 x 16 B: one HeapNumber per non-Smi argument, made by the caller (LEDGER C12); gated by the `fracnanhint` lane of the alloc gate (`lowerBoundHint*` / `upperBoundHint*`: run B 28..36 B/op; `segmentHint*` adds the box inside, 3 x 16 B: run B 44..52 B/op; run A the floor) |
| `assertRange` / `assertSorted` | cold: the thrown `RangeError` and its message string (only on a failure) |

Where TurboFan inlines a kernel (traced on the pinned Node, LEDGER C7), the non-Smi query never crosses a real call, so there is no box. Where it does not -- an un-optimized caller, or a call site V8 declines to inline -- there is. Pass a Smi query, and h = lo (or the literal NaN) instead of a NaN read at run time, when a kernel sits across such a call.

A wrapper is not a shield: segment* (25 B) fits Maglev's 100 B cap but its inner 103 B branchless call does not (LEDGER C1), and nearest* (189 B) is expected not to be inlined by Maglev at all (189 B >= its 100 B cap; untraced; TurboFan inlines it), and segmentHint* (31 B) fits the cap while the 212 B upperBoundHint* behind it does not (expected for Maglev, untraced; TurboFan inlines both, gated), so a Maglev-tier caller with a non-Smi query is expected to box 16 B per call (SPEC R1; expected, not traced here).

Inlining facts (LEDGER C1, C7): the branchless lower / upper bodies are 103 B of bytecode; Maglev does not inline them at its default 100 B cap, TurboFan does. The branchy pair is 55 B. This is a property of the pinned V8, never assumed: the 103 B count and the TurboFan pin are gated below; Maglev's refusal was traced in P0, not gated here (law 3: EXPECTED inlining is not TRACED).

Gated numbers (each is ONE run, quoted as a measurement, never as a law):

| Gate | Result | Source and provenance |
|---|---|---|
| Oracle | 5 types x 4 seeds plus a rounded-tie phase (>= 1000 rounded ties per seed on F64 / F32 / I32), exact BigInt reference, 0 failures; an independent exact nearest test (100,000 draws per type) | `npm test` in the same log as the Mutants row |
| Mutants | 146 rows (28 per type x 5 types = 140, + 3 rounded-tie + 3 infinity rows; 7 rows per type for each of `lowerBoundHint*` / `upperBoundHint*`, 1 for `segmentHint*`), every row KILLED, control PASS | `npm run verify` of the 1.1 cycle (`.handoff/archive/1.1.0/seghint-1.1/verify.log`), 2026-11-24T06:11:08Z..06:15:19Z, exit 0, node v26.8.2, npm 11.19.1, darwin arm64, load1 1.74 at start, host QUIET by `quiet-lock`, no other node at 10% CPU or more, one run; the live row "every row KILLED (killed === rows)" |
| Coverage (c8) | 100% lines, 100% branches (c8 `--check-coverage --lines 100 --branches 100` gates both), 47 / 47 functions; the line and branch denominators are not quoted because they are not stable (LEDGER C15) | same log (the `npm run coverage` step; the coverage glob includes the docs test) |
| Torture, phase 1 | 4096 cycles, 184320 / 184320 checks, size 0, alive 0, orphans 0, leaks 0 | same log (the `npm run torture` step, pinned flags) |
| Torture, phase 2 | 45 / 45 lanes x 200000 ops per lane; retained B/op min 0.001, max 0.043; steady gc major 0, minor 0 (both gated) | same log |
| TurboFan inline pin | 75 single-channel edges inlined (traced per kernel x type; every Node); plus 25 two-channel edges (the C13 pin: a feedback-form caller with two channels, each of the 10 hinted-upper exports and every inner behind it), judged on node v26.8.2 only: DETERMINISTIC on the pin, NO VERDICT elsewhere, never a pass; the c3 control (a three-channel segmentHint* caller) fails its edges as planted; the M4 size control fails exactly 75 edges on the pinned Node (those over the limit) | `npm test` in the same log as the Mutants row; the M4 control skips (never passes) on any other Node. Trace your own caller (law 2): the pin covers its own callers, not yours |
| Alloc gate, run A (inlined) | 225 / 225 lanes (45 kernels) read 0.00 B/op in every window 1..5 (empty lane 0.00; tool floor 0.00) | `npm run verify` of the 1.1 cycle (`.handoff/archive/1.1.0/seghint-1.1/verify.log`), 2026-11-24T06:11:08Z..06:15:19Z, exit 0, node v26.8.2, npm 11.19.1, darwin arm64, load1 1.74 at start, host QUIET by `quiet-lock`, no other node at 10% CPU or more, one run (the `npm run gates:local` step; B/op counts, no timing); 24 / 24 alloc + bytecode tests pass |
| Alloc gate, run B (not inlined) | non-Smi query lanes (135), the NaN-hint-read lanes of `lowerBoundHint*` / `upperBoundHint*` (10) and the literal-NaN `s` lanes of `segmentHint*` (5) read 16.00 B/op in every window 1..5 (one HeapNumber); the two-argument `fracnanhint` lanes of `lowerBoundHint*` / `upperBoundHint*` (10) and the NaN-`s`-read lanes of `segmentHint*` (5) 32.00 B/op (two); the `segmentHint*` `fracnanhint` lanes (5) 48.00 B/op (three); Smi lanes (45) 0.00 B/op except `lowerBoundBranchlessF64.smi`, 0.01 B/op in window 4 (inside the gate band [0, 1]); literal-NaN-hint lanes of `lowerBoundHint*` / `upperBoundHint*` (10) 0.00 B/op; empty lane 0.00 | same log as run A |
| Bytecode gate | branchless 103 B, branchy 55 B, lowerBoundHint 228 B, upperBoundHint 212 B, segment 25 B, segmentHint 31 B, nearest 189 B, five copies equal per family; the controls (upperBoundHint + 1 B = 213 B, segmentHint + 1 B = 32 B) each fail exactly their row and the copies check | same log as run A |

The alloc and bytecode rows above were read with `npm run gates:local` on a LiteUtils checkout (`@zakkster/lite-utils` 1.1.1; `alloc-per-op.mjs` sha256 4c16982b7082436d..., `bytecode-budget.sh` sha256 deeee04c9bfc46c7...). The gates run on the pinned Node v26.8.2 only; a run on any other Node is NO VERDICT, never a pass. `npm run gates` takes the tools from the devDependency `@zakkster/lite-utils` (^1.1.0, the first release that ships `alloc-per-op.mjs`) and runs in hosted CI (the `gates` job of `.github/workflows/ci.yml`, ubuntu-latest x86 and macos-latest arm64); `npm run gates:local` takes them from a LiteUtils checkout (`LITE_UTILS_DIR`, which overrides the installed package when set). A LiteUtils version outside ^1.1.0, or a missing tool, is NO VERDICT. Tier: DETERMINISTIC; not in `npm test`.

</details>

---

## Design decisions worth knowing

- **A per-type kernel, by name.** One call site fed several array types goes megamorphic (LEDGER C3), so there is no `lowerBound(a, ...)` that accepts any type. Call `lowerBoundBranchlessF64` for a Float64Array.
- **No length switch, no linear-scan fallback.** The draft's `lowerBound` (a length switch), `LINEAR_MAX` and `lowerBoundLinear` did not ship: the switch never read faster and read slower at every small n measured (LEDGER A4, C4; PRELIMINARY: one Apple M4 Pro, one strict run, P0 2026-11-10; no number is claimed).
- **No selector, no per-call front.** A per-call lookup blocks inlining (LEDGER A3); the setup-time selector is parked (its evidence is arm64-only) and the per-call type front is refused (LEDGER A5). No Eytzinger layout either (LEDGER A6, parked: unmeasured here).
- **The branchless body stays at 103 B.** A 92 B body inlines under Maglev but read slower under TurboFan at every fixed length measured (PRELIMINARY: one Apple M4 Pro, one strict run, P0 2026-11-10; no number is claimed); the maintainer ruled to keep the 103 B body (LEDGER C7).
- **Trust on the hot path, assert on the cold one.** Range checks cost bytes in every call; the asserts are separate functions no kernel calls.
- **NaN fails closed by construction.** The comparisons are written so a NaN query compares false everywhere and returns `lo` (`lo - 1` from `segment` and `segmentHint`).
- **Hint `h` is a caller error when it is not an integer or NaN.** It may return a wrong index or never return. This is documented, not guarded (P1-R9).
- **`segmentHint*` takes the previous segment result, not a hint index.** `s` is the last answer (`lo - 1 .. hi - 1`); the gallop starts at `s + 1`. The `lo - 1` no-hint value is an integer, so it never boxes; a NaN or non-Smi `s` costs one 16 B HeapNumber inside the wrapper when `upperBoundHint*` is not inlined into it (LEDGER C13).
- **Range capped at `hi - lo <= 2^30 - 1`** (P1-R8); the cap applies to the hinted upper kernels too.

### Known limits

- **A NaN hint read at run time boxes in the caller (AU-R2 / AU-R3, LEDGER C9).** `lowerBoundHint*` itself allocates nothing for it; the caller's HeapNumber is made when a NaN read from a Float64Array crosses a call V8 does not inline: 16.03 B/op (lane `smiq_nan_from_f64`) against 0.03 B/op for the literal `NaN` (lane `smiq_nan_literal`). Reproduce with `.handoff/archive/1.0.0/audit/2026-11-11-bisect/cross-fable/cross-repro.mjs --d4 <Bisect.js> <lane>` (flags in its header). Measured 2026-11-11, darwin arm64, node v26.8.2, 2 runs, load1 1.5 / 2.0, by the audit's cross-check probe (a local audit artifact, not published: neither in the npm tarball nor tracked in the repository). For no hint pass `lo` or the literal `NaN`.

---

## Testing

`npm test` runs 418 tests, 418 pass, 0 fail (the `npm test` step of the burst-closing `npm run verify`, `.handoff/archive/1.1.0/fillers/verify.log`, 2026-11-24T07:52:46Z..07:56:59Z, exit 0, node v26.8.2, npm 11.19.1, darwin arm64, load1 3.40 at start vs baseline 2.21, host PRELIMINARY by `quiet-lock` (load1 >= baseline + 1), one run; this count is untimed and deterministic, so the host state does not touch it; the Mutants row above cites the earlier 1.1-cycle log). They cover: a naive-reference oracle per type (4 seeds each) with a hinted-kernel sweep, a boundary table (every kernel x type), the contract rows for `segment` / `nearest` / the hinted kernels / the asserts, mutant kills, golden parity of the generated kernels, the TurboFan inline pin, the types check, doc truth (snippets, Q-BOX, banned tokens; `test/Bisect.docs.test.mjs`), and the A/B gate's verdict boundaries (`test/abgate-boundary.test.mjs`: rows B1-B10 plus 10 comparator-flip must-fail mutants, run against `bench/ab-gate.mjs --verdict-file -`, untimed), the 47-name export roster (a missing export fails the docs test), the `call2_` source-shape row of the inline test, and tree-shaking (`test/Bisect.shake.test.mjs`).

Tree-shaking is gated under esbuild 0.28 only (`test/Bisect.shake.test.mjs`, deterministic, part of `npm test`). A bundle that imports one kernel contains that kernel, the kernels it calls (lowerBoundHint* and nearest* call lowerBoundBranchless*, upperBoundHint* calls upperBoundBranchless*, segment* calls upperBoundBranchless*, segmentHint* calls upperBoundHint* and through it upperBoundBranchless*, assertSorted calls assertRange), and no other top-level code. A bare side-effect import of Bisect.js (the gate imports it by path) emits no kernel, and esbuild reports that it honours `"sideEffects": false`. webpack, rollup and terser are not tested.

```bash
npm test               # oracle, boundary, mutants, golden parity, gen check, inline pin, types, doc truth, tree-shaking
npm run torture        # node --expose-gc --no-concurrent-recompilation --single-threaded-gc --min-semi-space-size=1 --max-semi-space-size=1 test/torture.mjs : leak + retained-heap + steady-minor gate, and NO VERDICT without --single-threaded-gc (concurrent sweeping made the retained term flaky under load), and NO VERDICT (exit 2) when a lane, or a control that is not flagged, is still undrained after a 2000 ms re-settle and nothing FAILs (a FAIL exits 1)
npm run coverage       # c8, 100% lines and branches required
npm run test:types     # tsc in node16 / nodenext / bundler resolution + export parity
npm run gen:check      # the generated kernel region matches its template
npm run gates          # alloc + bytecode gates (installed @zakkster/lite-utils ^1.1.0; pinned Node v26.8.2 only; ci.yml gates job)
npm run gates:local    # the same gates on a LiteUtils checkout (LITE_UTILS_DIR=../LiteUtils)
npm run size           # npm pack file list + size budgets (test/gates/size-budget.json); not in npm test
npm run verify         # test + torture + coverage + size + gates:local (fail-fast)
```

Statistical claims: the hint versus branchless and branchless versus branchy speed words in the choice table are gated once per release by the hosted A/B (`bench/ab-gate.mjs`, run by `.github/workflows/ab.yml`, ubuntu-latest + macos-latest, dispatch-only; in the source repository, not the tarball). 1.0.0 is gated by run 43145179770 (VERDICT PASS gated=13/13 on both CPUs, F64 only; Tier: STATISTICAL); the same run gates 1.1.0, whose three gated F64 kernel bodies are byte-identical to 1.0.0 and whose `bench/ab-gate.mjs` is unchanged (ruling AB-G3a). The length switch and the 92 B body are not gated (PRELIMINARY, see Design decisions). `upperBoundHint*` and `segmentHint*` carry no speed claim.

---

## What this is not

- **Not a general-purpose search.** Typed arrays only, sorted non-decreasing, no NaN inside. No plain `Array`, no comparator callback, no objects.
- **Not a sorting library.** It never reorders anything.
- **Not a validator on the hot path.** The kernels trust the caller; `assertRange` / `assertSorted` are the cold checks.
- **Not a polymorphic front.** There is no `lowerBound(a, ...)` that picks a kernel from the array type or the length; you call the per-type kernel by name.
- **No benchmark table.** The only STATISTICAL speed words are the choice table's rows (F64, two CPUs, one gated release run); the two Design decisions speed words (length switch, 92 B body) are PRELIMINARY (one CPU); the table says which call fits which situation and what evidence stands behind it.
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
