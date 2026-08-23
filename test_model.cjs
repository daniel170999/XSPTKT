"use strict";

const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

global.window = global;
global.__assert = assert;

const files = ["data/xsmb.js", "data/xsmn.js", "app.js"];
const source = files.map(file => fs.readFileSync(file, "utf8")).join("\n") + `
{
  const mn2 = analyze(DB.MN.days, "MN", "all", 2);
  const sat = 6, thu = 4;
  __assert(mn2.pBaseFor(sat) > mn2.pBaseFor(thu), "nền thứ Bảy XSMN phải cao hơn ngày 3 đài");

  const manualSet = n => {
    let sum=0, count=0;
    for(const d of DB.MN.days){
      if(d.w!==sat) continue;
      const m=tailsOfDay(d,"MN","all",2,false).length;
      sum += 1-Math.pow(1-n/100,m); count++;
    }
    return sum/count;
  };
  __assert(Math.abs(mn2.baseSetProb(10,sat)-manualSet(10))<1e-12,
    "xác suất dàn phải lấy trung bình chính xác theo từng kỳ");

  const shortA = analyze(DB.MB.days.slice(-30), "MB", "all", 2);
  const shortM = buildModel(shortA, thu);
  __assert.strictEqual(shortM.W.rec, 0, "không được đếm đôi recent khi recent=toàn cửa sổ");

  const mn3 = analyze(DB.MN.days, "MN", "all", 3);
  const longest = [...mn3.S.entries()].sort((a,b)=>b[1].curGap-a[1].curGap)[0];
  __assert(longest[1].curGap>HAZARD_SCORE_MAX_GAP, "fixture cần một gap dài để kiểm tra fallback");
  const rank3 = rankAll(mn3, thu);
  const scored = scoreOf(mn3,longest[0],thu,rank3.model);
  __assert.strictEqual(scored.p.gap, rank3.model.center.gap,
    "gap ngoài vùng ổn định phải về tâm, không được ngoại suy");

  for(const region of ["MB","MN"]){
    for(const scope of ["all","dd"]){
      for(const digits of [2,3]){
        const A=analyze(DB[region].days,region,scope,digits);
        __assert.strictEqual(rankAll(A,thu).model.actionable,false,
          "chưa có chứng nhận OOS thì không cấu hình nào được actionable");
      }
    }
  }
}
`;

vm.runInThisContext(source, {filename:"xs-model-tests.js"});
console.log("test_model: OK");
