// test/types/consumer.ts -- the type-level consumer of @zakkster/lite-bisect (SPEC-p1 U7 T2, assertion 10).
// test/types.test.mjs copies it beside a temp node_modules/@zakkster/lite-bisect and runs tsc 7.0.2 in
// node16 / nodenext / bundler. Every export is called with its own array type; every `@ts-expect-error`
// marks a call or name that MUST be a type error (an unused one is TS2578 = FAIL).
// The FIRST `@ts-expect-error` in this file sits on a wrong-array-type call: control (b) strips it and
// expects TS2345 and no other code. Keep it first.

import * as B from "@zakkster/lite-bisect";
import {
    lowerBoundBranchlessF64, upperBoundBranchlessF64, lowerBoundBranchyF64, upperBoundBranchyF64,
    lowerBoundHintF64, segmentF64, nearestF64,
    lowerBoundBranchlessF32, upperBoundBranchlessF32, lowerBoundBranchyF32, upperBoundBranchyF32,
    lowerBoundHintF32, segmentF32, nearestF32,
    lowerBoundBranchlessU32, upperBoundBranchlessU32, lowerBoundBranchyU32, upperBoundBranchyU32,
    lowerBoundHintU32, segmentU32, nearestU32,
    lowerBoundBranchlessU16, upperBoundBranchlessU16, lowerBoundBranchyU16, upperBoundBranchyU16,
    lowerBoundHintU16, segmentU16, nearestU16,
    lowerBoundBranchlessI32, upperBoundBranchlessI32, lowerBoundBranchyI32, upperBoundBranchyI32,
    lowerBoundHintI32, segmentI32, nearestI32,
    assertRange, assertSorted,
} from "@zakkster/lite-bisect";
import type { BisectArray } from "@zakkster/lite-bisect";

const f64 = new Float64Array([1, 2, 2, 3]);
const f32 = new Float32Array([1, 2, 2, 3]);
const u32 = new Uint32Array([1, 2, 2, 3]);
const u16 = new Uint16Array([1, 2, 2, 3]);
const i32 = new Int32Array([1, 2, 2, 3]);

// ---- wrong array type, one family per kernel, all 5 suffixes covered (the first one is control b's) --
// @ts-expect-error a Float32Array is not a Float64Array
lowerBoundBranchlessF64(f32, 0, 4, 2);
// @ts-expect-error a Float64Array is not a Float32Array
upperBoundBranchlessF32(f64, 0, 4, 2);
// @ts-expect-error an Int32Array is not a Uint32Array
lowerBoundBranchyU32(i32, 0, 4, 2);
// @ts-expect-error a Uint32Array is not a Uint16Array
upperBoundBranchyU16(u32, 0, 4, 2);
// @ts-expect-error a Uint16Array is not an Int32Array
lowerBoundHintI32(u16, 0, 4, 2, 0);
// @ts-expect-error an Int32Array is not a Float64Array
segmentF64(i32, 0, 4, 2);
// @ts-expect-error a Float64Array is not a Uint16Array
nearestU16(f64, 0, 4, 2);
// @ts-expect-error a number[] is not a BisectArray
assertRange([1, 2, 3], 0, 3);

// ---- removed names: none of them exists any more ---------------------------------------------------
// @ts-expect-error lowerBound is gone
B.lowerBound(f64, 0, 4, 2);
// @ts-expect-error LINEAR_MAX is gone
const linearMax: number = B.LINEAR_MAX;
// @ts-expect-error lowerBoundLinear is gone
B.lowerBoundLinear(f64, 0, 4, 2);
// @ts-expect-error buildEytzinger is gone
B.buildEytzinger(f64);
// @ts-expect-error lowerBoundEytzinger is gone
B.lowerBoundEytzinger(f64, 2);

// ---- every export with its own array type ------------------------------------------------------------
let r: number = 0;
r += lowerBoundBranchlessF64(f64, 0, 4, 2);
r += upperBoundBranchlessF64(f64, 0, 4, 2);
r += lowerBoundBranchyF64(f64, 0, 4, 2);
r += upperBoundBranchyF64(f64, 0, 4, 2);
r += lowerBoundHintF64(f64, 0, 4, 2, 1);
r += segmentF64(f64, 0, 4, 2);
r += nearestF64(f64, 0, 4, 2);

r += lowerBoundBranchlessF32(f32, 0, 4, 2);
r += upperBoundBranchlessF32(f32, 0, 4, 2);
r += lowerBoundBranchyF32(f32, 0, 4, 2);
r += upperBoundBranchyF32(f32, 0, 4, 2);
r += lowerBoundHintF32(f32, 0, 4, 2, NaN);
r += segmentF32(f32, 0, 4, 2);
r += nearestF32(f32, 0, 4, 2);

r += lowerBoundBranchlessU32(u32, 0, 4, 2);
r += upperBoundBranchlessU32(u32, 0, 4, 2);
r += lowerBoundBranchyU32(u32, 0, 4, 2);
r += upperBoundBranchyU32(u32, 0, 4, 2);
r += lowerBoundHintU32(u32, 0, 4, 2, 3);
r += segmentU32(u32, 0, 4, 2);
r += nearestU32(u32, 0, 4, 2);

r += lowerBoundBranchlessU16(u16, 0, 4, 2);
r += upperBoundBranchlessU16(u16, 0, 4, 2);
r += lowerBoundBranchyU16(u16, 0, 4, 2);
r += upperBoundBranchyU16(u16, 0, 4, 2);
r += lowerBoundHintU16(u16, 0, 4, 2, 0);
r += segmentU16(u16, 0, 4, 2);
r += nearestU16(u16, 0, 4, 2);

r += lowerBoundBranchlessI32(i32, 0, 4, 2);
r += upperBoundBranchlessI32(i32, 0, 4, 2);
r += lowerBoundBranchyI32(i32, 0, 4, 2);
r += upperBoundBranchyI32(i32, 0, 4, 2);
r += lowerBoundHintI32(i32, 0, 4, 2, 2);
r += segmentI32(i32, 0, 4, 2);
r += nearestI32(i32, 0, 4, 2);

// the namespace form reaches the same declarations
r += B.lowerBoundBranchlessF64(f64, 0, 4, 2);

const arrays: BisectArray[] = [f64, f32, u32, u16, i32];
for (const a of arrays) {
    const v1: void = assertRange(a, 0, a.length);
    const v2: void = assertSorted(a, 0, a.length);
    void v1; void v2;
}

// the return type is number, not string
// @ts-expect-error a kernel returns a number
const s: string = nearestI32(i32, 0, 4, 2);

export { r, linearMax, s };
