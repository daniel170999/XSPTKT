"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const ui = fs.readFileSync("ui.js", "utf8");
const match = ui.match(/const PXKEY="xs_pinexcl_v1";[^]*?(?=\r?\nfunction pxStore)/);
assert(match, "không tìm thấy pxLoad");

const ctx = {
  localStorage: { getItem: () => JSON.stringify({ pin: "323", excl: [null] }) },
  result: null,
};
vm.createContext(ctx);
vm.runInContext(`${match[0]}; result=pxLoad();`, ctx);

assert(Array.isArray(ctx.result.pin), "pxLoad phải trả mảng pin khi localStorage sai cấu trúc");
assert(Array.isArray(ctx.result.excl), "pxLoad phải trả mảng excl khi localStorage sai cấu trúc");
assert.deepStrictEqual(Array.from(ctx.result.pin), [], "pin sai kiểu phải bị bỏ");
assert.deepStrictEqual(Array.from(ctx.result.excl), [], "phần tử không phải chuỗi phải bị bỏ");

global.window = global;
for (const file of ["data/xsmb.js", "data/xsmn.js", "app.js"])
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
for (const [U, digits] of [[100, 2], [1000, 3]]) {
  for (let seed = 0; seed < 100; seed++) {
    const all = unbiasedPick(U, digits, U, `audit-prefix-${seed}`);
    for (let n = 1; n <= 10; n++)
      assert.deepStrictEqual(unbiasedPick(U, digits, n, `audit-prefix-${seed}`), all.slice(0, n),
        `unbiasedPick phải giữ tiền tố: U=${U}, seed=${seed}, n=${n}`);
  }
}

console.log("audit_v1_regression: OK");
