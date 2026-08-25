/* Kiểm chứng lịch sử cho trang /phuong-phap/.
   Chỉ tải kho đầy đủ khi người xem chủ động chạy phép đo. */
"use strict";

const METHOD_WINDOW = 365;
const METHOD_PERIODS = 300;
const METHOD_VALUES = 10;
const methodLoads = new Map();

function loadMethodScript(src){
  if(methodLoads.has(src)) return methodLoads.get(src);
  const task=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=src;
    script.async=false;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`Không tải được ${src}`));
    document.head.appendChild(script);
  });
  methodLoads.set(src,task);
  task.catch(()=>methodLoads.delete(src));
  return task;
}

async function loadMethodData(){
  await loadMethodScript("/data/xsmb.js");
  await loadMethodScript("/data/xsmn.js");
  const db=window.XS_RELOAD_DATA?.(window.XSMB_LINES,window.XSMN_LINES);
  if(!db?.MB.days.length || !db?.MN.days.length) throw new Error("Kho dữ liệu chưa sẵn sàng.");
  return db;
}

/**
 * Giữ phép đo rolling ngoài mẫu từ bản trước WP0: mỗi kỳ chỉ được chấm bằng
 * dữ liệu của các kỳ đứng trước nó. Hàm không tạo khuyến nghị hay thay đổi
 * MODEL_OOS_VALIDATED.
 */
function runBacktest(days,region,digits,{periods=METHOD_PERIODS,windowSize=METHOD_WINDOW,count=METHOD_VALUES,onProgress=()=>{}}={}){
  const F=days.slice();
  const W=Math.min(windowSize,Math.max(0,F.length-2));
  const B=Math.min(periods,Math.max(0,F.length-W-1));
  if(B<20) return Promise.reject(new Error("Không đủ dữ liệu để kiểm chứng tối thiểu 20 kỳ."));

  const acc={sumHit:0,sumBase:0,top1:0,top1Base:0,top1Var:0,topN:0,topNBase:0,days:0};
  const start=F.length-B;
  let index=start;
  const started=performance.now();

  return new Promise((resolve)=>{
    const step=()=>{
      const deadline=performance.now()+90;
      while(index<F.length && performance.now()<deadline){
        const begin=Math.max(0,index-W);
        const analysis=analyze(F.slice(begin,index),region,"all",digits);
        if(analysis.K>=20){
          const ranked=rankAll(analysis,F[index].w);
          const actual=new Set(tailsOfDay(F[index],region,"all",digits,false));
          let hits=0;
          for(let value=0;value<count;value++) if(actual.has(ranked[value].tail)) hits++;
          acc.sumHit+=hits;
          acc.sumBase+=count*actual.size/analysis.U;
          if(actual.has(ranked[0].tail)) acc.top1++;
          if(hits>0) acc.topN++;
          const p1=analysis.pBaseFor(F[index].w);
          acc.top1Base+=p1;
          acc.top1Var+=p1*(1-p1);
          acc.topNBase+=analysis.baseSetProb(count,F[index].w);
          acc.days++;
        }
        index++;
      }
      onProgress(Math.min(1,(index-start)/B),acc.days,B);
      if(index<F.length){ setTimeout(step,0); return; }
      const measured=acc.days;
      const average=measured?acc.sumHit/measured:0;
      const baseline=measured?acc.sumBase/measured:0;
      const uplift=baseline?average/baseline-1:0;
      const z=acc.top1Var>0?(acc.top1-acc.top1Base)/Math.sqrt(acc.top1Var):0;
      const pValue=1-normCdf(z);
      resolve({periods:measured,windowSize:W,count,digits,region,average,baseline,uplift,
        top1Rate:measured?acc.top1/measured:0,top1Baseline:measured?acc.top1Base/measured:0,
        top1PValue:pValue,anyRate:measured?acc.topN/measured:0,
        anyBaseline:measured?acc.topNBase/measured:0,seconds:(performance.now()-started)/1000});
    };
    setTimeout(step,0);
  });
}

function methodPct(value){ return `${(value*100).toFixed(1).replace(".",",")}%`; }
function methodP(value){ return value<0.001?"<0,001":value.toFixed(3).replace(".",","); }
function methodNumber(value){ return value.toFixed(2).replace(".",","); }

function methodConclusion(result){
  const delta=result.uplift>=0?`+${methodPct(result.uplift)}`:methodPct(result.uplift);
  if(result.top1PValue<0.05 && result.uplift>0){
    return `Lượt đo này có chênh lệch dương (${delta}, p = ${methodP(result.top1PValue)}), nhưng cổng kiểm chứng của ứng dụng vẫn tắt. Một lượt đo không đủ để suy luận về kết quả tương lai.`;
  }
  return `Chênh lệch ${delta} với p = ${methodP(result.top1PValue)} không cho thấy bằng chứng thống kê rằng phương pháp này tốt hơn mức ngẫu nhiên.`;
}

function renderMethodResult(target,result){
  const delta=result.uplift>=0?`+${methodPct(result.uplift)}`:methodPct(result.uplift);
  target.innerHTML=`<div class="method-result-grid">
    <div><span>Giá trị TB / kỳ</span><strong>${methodNumber(result.average)}</strong><small>Mức ngẫu nhiên: ${methodNumber(result.baseline)}</small></div>
    <div><span>Uplift ngoài mẫu</span><strong>${delta}</strong><small>${result.periods} kỳ · cửa sổ ${result.windowSize} kỳ</small></div>
    <div><span>Giá trị đầu bảng xuất hiện</span><strong>${methodPct(result.top1Rate)}</strong><small>Nền: ${methodPct(result.top1Baseline)} · p = ${methodP(result.top1PValue)}</small></div>
  </div><p class="method-conclusion"><b>Kết luận:</b> ${methodConclusion(result)}</p><p class="method-note">Phép đo dùng ${result.count} giá trị đứng đầu bảng thử nghiệm ở từng kỳ, chỉ tính từ dữ liệu có trước kỳ đó. Hoàn tất trong ${result.seconds.toFixed(1).replace(".",",")} giây.</p>`;
}

function initMethodPage(){
  const form=document.querySelector("#methodForm");
  const output=document.querySelector("#methodOutput");
  if(!form || !output) return;
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const submit=form.querySelector("button[type=submit]");
    const region=form.elements.region.value;
    const digits=Number(form.elements.digits.value);
    submit.disabled=true;
    output.innerHTML='<p class="method-status" role="status">Đang tải kho dữ liệu để kiểm chứng…</p>';
    try{
      const db=await loadMethodData();
      output.innerHTML='<p class="method-status" role="status">Đang đo 300 kỳ ngoài mẫu…</p>';
      const result=await runBacktest(db[region].days,region,digits,{onProgress:(fraction,done,total)=>{
        output.innerHTML=`<p class="method-status" role="status">Đang đo ${done}/${total} kỳ ngoài mẫu (${Math.round(fraction*100)}%)…</p>`;
      }});
      renderMethodResult(output,result);
    }catch(error){
      output.innerHTML=`<p class="method-error" role="alert">Không thể chạy kiểm chứng: ${error.message}</p>`;
    }finally{
      submit.disabled=false;
    }
  });
}

document.addEventListener("DOMContentLoaded",initMethodPage);
