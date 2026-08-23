"use strict";

const fs = require("fs");
const vm = require("vm");

global.window = global;

const source = ["data/xsmb.js", "data/xsmn.js", "app.js"]
  .map(file => fs.readFileSync(file, "utf8")).join("\n") + `
{
  const region="MB", scope="all", digits=3, windowSize=365, testDays=300, pickN=10;
  const all=DB[region].days, start=Math.max(windowSize,all.length-testDays);
  let days=0, hit=0, base=0, topHit=0, topBase=0, topVar=0;
  const started=Date.now();
  for(let i=start;i<all.length;i++){
    const A=analyze(all.slice(i-windowSize,i),region,scope,digits);
    const rank=rankAll(A,all[i].w);
    const actual=new Set(tailsOfDay(all[i],region,scope,digits,false));
    for(let n=0;n<pickN;n++) if(actual.has(rank[n].tail)) hit++;
    const p=actual.size/A.U;
    days++; base+=pickN*p; topHit+=actual.has(rank[0].tail)?1:0; topBase+=p; topVar+=p*(1-p);
  }
  console.log(JSON.stringify({region,scope,digits,windowSize,testDays:days,pickN,
    elapsedSeconds:(Date.now()-started)/1000,
    uplift:base?hit/base-1:null,
    top1Z:topVar?(topHit-topBase)/Math.sqrt(topVar):null,
    hit,expected:base}));
}
`;

vm.runInThisContext(source,{filename:"xs-backtest-300.js"});
