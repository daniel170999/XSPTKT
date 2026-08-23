"use strict";

const fs = require("fs");
const vm = require("vm");

global.window = global;

const files = ["data/xsmb.js", "data/xsmn.js", "app.js"];
const source = files.map(file => fs.readFileSync(file, "utf8")).join("\n") + `
function auditBacktest(region, scope, digits, windowSize, testDays, pickN) {
  const all = DB[region].days;
  const start = Math.max(windowSize, all.length - testDays);
  const acc = {days:0, hit:0, base:0, top1:0, top1Base:0, top1Var:0,
    modelDays:0, modelHit:0, modelBase:0, modelTop1:0, modelTop1Base:0, modelTop1Var:0};
  for (let i=start; i<all.length; i++) {
    const A = analyze(all.slice(i-windowSize, i), region, scope, digits);
    const rank = rankAll(A, all[i].w);
    const actual = new Set(tailsOfDay(all[i], region, scope, digits, false));
    let hit = 0;
    for (let n=0; n<pickN; n++) if (actual.has(rank[n].tail)) hit++;
    acc.days++;
    acc.hit += hit;
    acc.base += pickN * actual.size / A.U;
    const topHit = actual.has(rank[0].tail) ? 1 : 0;
    const topBase = actual.size / A.U;
    acc.top1 += topHit;
    acc.top1Base += topBase;
    acc.top1Var += topBase*(1-topBase);
    if (!rank.model.flat) {
      acc.modelDays++;
      acc.modelHit += hit;
      acc.modelBase += pickN * actual.size / A.U;
      acc.modelTop1 += topHit;
      acc.modelTop1Base += topBase;
      acc.modelTop1Var += topBase*(1-topBase);
    }
  }
  return {
    region, scope, digits, windowSize, days:acc.days, pickN,
    uplift: acc.base ? acc.hit/acc.base-1 : null,
    top1Uplift: acc.top1Base ? acc.top1/acc.top1Base-1 : null,
    top1Z: acc.top1Var ? (acc.top1-acc.top1Base)/Math.sqrt(acc.top1Var) : null,
    modelDays: acc.modelDays,
    modelShare: acc.days ? acc.modelDays/acc.days : 0,
    modelUplift: acc.modelBase ? acc.modelHit/acc.modelBase-1 : null,
    modelTop1Uplift: acc.modelTop1Base ? acc.modelTop1/acc.modelTop1Base-1 : null,
    modelTop1Z: acc.modelTop1Var ? (acc.modelTop1-acc.modelTop1Base)/Math.sqrt(acc.modelTop1Var) : null,
  };
}

for (const region of ["MB", "MN"]) {
  for (const scope of ["all", "dd"]) {
    for (const digits of [2, 3]) {
      console.log(JSON.stringify(auditBacktest(region, scope, digits, 365, 1000, 5)));
    }
  }
}
`;

vm.runInThisContext(source, { filename: "xs-backtest-bundle.js" });
