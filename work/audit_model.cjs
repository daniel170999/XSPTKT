"use strict";

const fs = require("fs");
const vm = require("vm");

global.window = global;

const files = [
  "data/xsmb.js",
  "data/xsmn.js",
  "app.js",
];

const source = files.map(file => fs.readFileSync(file, "utf8")).join("\n") + `
for (const region of ["MB", "MN"]) {
  for (const scope of ["all", "dd"]) {
    for (const digits of [2, 3]) {
      const sample = DB[region].days;
      const A = analyze(sample, region, scope, digits);
      for (const dow of [4, 6]) {
        const rank = rankAll(A, dow);
        console.log(JSON.stringify({
          region, scope, digits, dow,
          K: A.K,
          pBase: A.pBase,
          pBaseFor: A.pBaseFor(dow),
          modelBase: rank.model.pB,
          top: rank[0].tail,
          topScore: rank[0].score,
          edge: rank.model.edge,
          edgeRatio: rank.model.edgeRatio,
          zCrit: rank.model.zCrit,
          flat: rank.model.flat,
          W: rank.model.W,
          means: Object.fromEntries(Object.entries(rank.model.eb).map(([k, v]) => [k, v.mean ?? null])),
          topSignals: rank[0].p,
          topContrib: rank[0].contrib,
        }));
      }
    }
  }
}

const liveSignals = [];
for (const region of ["MB", "MN"]) {
  for (const scope of ["all", "dd"]) {
    for (const digits of [2, 3]) {
      for (const windowSize of [7,30,90,180,365,1000,2000,5000]) {
        const days = DB[region].days.slice(-windowSize);
        const A = analyze(days, region, scope, digits);
        const targetDow = dowOf(addDays(days.at(-1).d, 1));
        const rank = rankAll(A, targetDow);
        if (!rank.model.flat) liveSignals.push({region,scope,digits,windowSize,top:rank[0].tail,
          edge:rank.model.edge,seOne:rank.model.seOne,edgeRatio:rank.model.edgeRatio,zCrit:rank.model.zCrit,
          W:rank.model.W,center:rank.model.center,p:rank[0].p,contrib:rank[0].contrib});
      }
    }
  }
}
console.log(JSON.stringify({liveSignals}));
`;

vm.runInThisContext(source, { filename: "xs-audit-bundle.js" });
