"use strict";

const fs = require("fs");
const vm = require("vm");

global.window = global;
const source = ["data/xsmb.js", "data/xsmn.js", "app.js"]
  .map(file => fs.readFileSync(file, "utf8")).join("\n") + `
function dateDiff(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}
function validateRegion(region) {
  const days = DB[region].days;
  const issues = [];
  const gaps = [];
  const seen = new Set();
  let badShape = 0;
  for (let i=0; i<days.length; i++) {
    const day = days[i];
    if (seen.has(day.d)) issues.push("duplicate:" + day.d);
    seen.add(day.d);
    if (i && day.d <= days[i-1].d) issues.push("order:" + day.d);
    if (i) {
      const gap = dateDiff(days[i-1].d, day.d);
      if (gap > 1) gaps.push({from:days[i-1].d, to:day.d, missing:gap-1});
    }
    if (region === "MB") {
      if (day.nums.length !== 27 || day.nums.some((n,j) => !/^\\d+$/.test(n) || n.length !== LEN_MB[j])) badShape++;
    } else {
      if (![3,4].includes(day.draws.length) || day.draws.some(draw => draw.nums.length !== 18 || draw.nums.some((n,j) => !/^\\d+$/.test(n) || n.length !== LEN_MN[j]))) badShape++;
    }
  }
  return {region, days:days.length, first:days[0]?.d, last:days.at(-1)?.d, badShape, issues, gapCount:gaps.length, missingCalendarDays:gaps.reduce((n,g)=>n+g.missing,0), longestGaps:gaps.sort((a,b)=>b.missing-a.missing).slice(0,10)};
}
console.log(JSON.stringify(validateRegion("MB")));
console.log(JSON.stringify(validateRegion("MN")));
`;

vm.runInThisContext(source, { filename: "xs-data-audit-bundle.js" });
