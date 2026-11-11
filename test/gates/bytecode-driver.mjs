// test/gates/bytecode-driver.mjs -- U6 bytecode gate DRIVER for LiteUtils bytecode-budget.sh (SPEC-p1 U6, G3).
// Never imported by npm test; test/gates/bytecode.test.mjs runs it through
//   bash <LiteUtils>/bytecode-budget.sh --max <fn=N,...> --node-version v26.8.2 --node <node> bytecode-driver.mjs
// V8 prints a function's bytecode only once it is compiled, so the driver calls every kernel export once
// (each on its own array type). It prints nothing: bytecode-budget trusts driver output.
// The module is ../../Bisect.js, or the absolute path in LITE_BISECT_MODULE (the test's scratch mutants;
// a mutant copy lives in a mktemp dir, never in the package).

import { pathToFileURL } from 'node:url';

const SPEC = process.env.LITE_BISECT_MODULE ? pathToFileURL(process.env.LITE_BISECT_MODULE).href : '../../Bisect.js';
const M = await import(SPEC);
const ARR = {
    F64: new Float64Array([1, 2, 2, 3]), F32: new Float32Array([1, 2, 2, 3]), U32: new Uint32Array([1, 2, 2, 3]),
    U16: new Uint16Array([1, 2, 2, 3]), I32: new Int32Array([1, 2, 2, 3]),
};
let calls = 0;
for (const name of Object.keys(M)) {
    const m = /(F64|F32|U32|U16|I32)$/.exec(name);
    if (!m || typeof M[name] !== 'function') continue;
    const a = ARR[m[1]];
    M[name](a, 0, a.length, 2, 1);
    calls++;
}
if (calls === 0) throw new Error('bytecode-driver: no kernel export called');
