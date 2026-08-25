/* ============================================================================
   ui.js — Lớp giao diện. Mọi tính toán nằm ở app.js.
   ========================================================================== */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e };

const ST = {
  region:"MN", scope:"all", digits:2, win:"max", provs:null, view:"live",
  hmMode:"freq", anaSub:"board", homeIndex:0, historyIndex:0, historyCount:14,
  homeProvince:0, historyProvince:0
};
const WINS = [
  {n:7, label:"7 ngày"}, {n:30, label:"1 tháng"}, {n:90, label:"3 tháng"},
  {n:180, label:"6 tháng"}, {n:365, label:"1 năm"}, {n:1000, label:"3 năm"},
  {n:2000, label:"5 năm"}, {n:5000, label:"5000 ngày"},
];

let A2=null, A3=null, A=null;

/* ---------------- lọc ngày ---------------- */
function baseDays(){
  const src = DB[ST.region].days;
  if(ST.region==="MN" && ST.provs && ST.provs.size){
    return src.map(d=>({d:d.d,w:d.w,draws:d.draws.filter(x=>ST.provs.has(x.p))}))
              .filter(d=>d.draws.length);
  }
  return src;
}
function slicedDays(){
  const F = baseDays();
  const end = F.length;
  const avail = end;
  const K = ST.win==="max" ? avail : Math.min(ST.win, avail);
  return { F, end, avail, days: F.slice(end-K, end) };
}

/* ---------------- tính lại toàn bộ ---------------- */
function recompute(){
  const sl = slicedDays();
  A2 = analyze(sl.days, ST.region, ST.scope, 2);
  A3 = analyze(sl.days, ST.region, ST.scope, 3);
  A  = ST.digits===2 ? A2 : A3;
  return sl;
}

/* ---------------- helper UI ---------------- */
function mkChip(label, on, cb, dis, sub){
  const c = el("button","chip"+(on?" on":"")+(dis?" dis":""), label + (sub?` <small>${sub}</small>`:""));
  c.type="button"; c.disabled=!!dis; c.setAttribute("aria-pressed",String(!!on)); c.onclick = cb; return c;
}
/* --- Bảng màu nhiệt: lạnh nhất (xanh navy) → nóng nhất (đỏ rực).
   9 nấc màu tách bạch. Màu được gán theo THỨ HẠNG PHẦN TRĂM (percentile),
   nên toàn bộ dải màu luôn được dùng hết — không còn cảnh 100 ô cùng một màu
   chỉ vì giá trị thật chỉ chênh nhau vài phần nghìn. --- */
const HEAT_STOPS=[
  [ 40, 53,147],  // 0%   lạnh nhất — xanh navy
  [ 25, 96,180],
  [ 36,141,214],
  [ 98,182,208],
  [250,224,132],  // 50%  vàng nhạt
  [253,180, 86],
  [246,126, 61],
  [230, 66, 45],
  [173, 12, 34],  // 100% nóng nhất — đỏ sậm
];
/** t ∈ [0,1] → {bg, fg}; chữ tự đổi đen/trắng theo độ sáng nền */
function heatColor(t){
  const st=HEAT_STOPS;
  const x=Math.max(0,Math.min(1,t))*(st.length-1);
  const i=Math.min(Math.floor(x),st.length-2), f=x-i;
  const c=st[i].map((a,j)=>Math.round(a+(st[i+1][j]-a)*f));
  const lum=(0.299*c[0]+0.587*c[1]+0.114*c[2])/255;
  return {bg:`rgb(${c[0]},${c[1]},${c[2]})`, fg: lum>0.62 ? "#101520" : "#ffffff"};
}
function heatGradientCss(){
  return "linear-gradient(90deg,"+HEAT_STOPS.map(c=>`rgb(${c[0]},${c[1]},${c[2]})`).join(",")+")";
}
/** Bản đồ giá trị → thứ hạng phần trăm [0,1]; đồng hạng lấy hạng trung bình. */
function percentileMap(vals){
  const sorted=[...vals].sort((a,b)=>a-b), n=sorted.length;
  const lo=new Map(), hi=new Map();
  sorted.forEach((v,i)=>{ if(!lo.has(v))lo.set(v,i); hi.set(v,i) });
  return v => n<=1 ? 0.5 : ((lo.get(v)+hi.get(v))/2)/(n-1);
}
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2000);
}

/* ============================================================================
   TỪ ĐIỂN THUẬT NGỮ + TOOLTIP DẤU !
   Mọi chỉ số khó hiểu trên UI đều có dấu ! bấm vào là ra giải thích đời thường.
   ========================================================================== */
const GLOSSARY={
  nen:{t:"Xác suất nền",b:"Khả năng một số BẤT KỲ xuất hiện ít nhất 1 lần trong kỳ, nếu xổ số hoàn toàn ngẫu nhiên. Ví dụ XSMB quay 27 bộ số mỗi kỳ trên 100 khả năng → nền ≈ 23,8%. Đây là mốc để so: số nào cũng quanh mốc này thì không số nào đáng gọi là 'dễ ra'."},
  lift:{t:"Tỷ lệ so với nền",b:"Tần suất quan sát được chia cho mức nền. 1,00 nghĩa là gần mức ngẫu nhiên; chênh lệch nhỏ thường là nhiễu lấy mẫu."},
  ganht:{t:"Khoảng hiện tại",b:"Số kỳ liên tiếp chưa thấy số này, tính đến kết quả mới nhất. Đây chỉ là khoảng cách trong lịch sử; chờ lâu không làm xác suất ở kỳ sau tăng lên."},
  hazard:{t:"Tỉ lệ lịch sử theo khoảng chờ",b:"Trong các khoảng chờ cũ có cùng độ dài, chỉ số này cho biết bao nhiêu khoảng đã kết thúc ở kỳ kế tiếp. Đây là thống kê quá khứ, không phải dự báo."},
  longest:{t:"Khoảng dài nhất",b:"Số kỳ dài nhất giữa hai lần xuất hiện trong khoảng dữ liệu đang xem, tính cả khoảng hiện tại."},
  shortest:{t:"Khoảng ngắn nhất",b:"Số kỳ ngắn nhất giữa hai lần xuất hiện. Bằng 0 nghĩa là số đó từng xuất hiện ở hai kỳ liên tiếp."},
  tbgap:{t:"Khoảng trung bình",b:"Trung bình bao nhiêu kỳ giữa hai lần xuất hiện trong dữ liệu đang xem."},
  cv:{t:"Độ đều (CV)",b:"Nhịp ra có đều không. CV thấp = ra khá đều đặn; CV cao = lúc dồn dập lúc mất hút. Chỉ mang tính mô tả quá khứ."},
  ktc:{t:"Khoảng tin cậy đồng thời 95%",b:"App đang soi 100 hoặc 1.000 số cùng lúc, nên khoảng này đã hiệu chỉnh Bonferroni để cả bảng có độ tin cậy xấp xỉ 95%. Nó rộng hơn khoảng 95% của một số đơn lẻ. Cận dưới vượt nền mới là dấu hiệu đáng kiểm tra tiếp."},
  sigma:{t:"σ (độ lệch chuẩn) và z",b:"Thước đo 'lệch bao xa so với trung bình'. z=+2σ = cao hơn trung bình ở mức chỉ ~2% số ô đạt được do ngẫu nhiên. Trong 100 ô thì ngẫu nhiên thuần tuý cũng tạo ra ~5 ô vượt ±2σ — nên vài ô nổi bật là chuyện bình thường."},
  chi2:{t:"Kiểm định chi-square (χ²)",b:"Phép thử xem tần suất các số có lệch khỏi mức mọi số như nhau nhiều hơn mức ngẫu nhiên cho phép hay không. p nhỏ cần được kiểm tra thêm, không phải kết luận về kỳ sau."},
  wilson:{t:"Khoảng Wilson",b:"Một cách ước lượng khoảng tin cậy cho tỉ lệ, ổn định hơn khi số quan sát chưa nhiều hoặc tỉ lệ gần 0% hay 100%."},
  uplift:{t:"Uplift ngoài mẫu",b:"Chênh lệch tương đối giữa phép đo trên dữ liệu chưa nhìn thấy và mức ngẫu nhiên. Giá trị quanh 0% là điều thường thấy khi không có tín hiệu."},
  bttest:{t:"Trong mẫu và ngoài mẫu",b:"Ngoài mẫu là đo trên ngày chưa được dùng để lập bảng; trong mẫu dùng lại dữ liệu cũ nên thường đẹp hơn. Chỉ kết quả ngoài mẫu mới phù hợp để đối chiếu."},
  w:{t:"Trọng số độ tin cậy",b:"Trọng số thu nhỏ một chênh lệch quan sát được khi nó có thể chỉ do nhiễu lấy mẫu. Gần 0 nghĩa là chênh lệch không đủ ổn định để dùng làm tín hiệu."},
  heatmap:{t:"Bản đồ số",b:"Mỗi ô là một số. Màu giúp so sánh nhanh các số trong cùng khoảng dữ liệu. Bấm vào ô để xem lịch sử chi tiết."},
  hangvsthuc:{t:"Màu theo thứ hạng",b:"Màu được trải theo thứ hạng để dễ nhìn. Màu đậm hơn chỉ cho biết vị trí tương đối trong dữ liệu cũ, không cho biết kết quả kỳ tiếp theo."},
  carry:{t:"Lặp lại từ kỳ trước",b:"So sánh tần suất một số xuất hiện ở hai kỳ liên tiếp với mức chung trong dữ liệu. Kết quả chỉ mô tả quá khứ."},
  momentum:{t:"So sánh gần và dài hạn",b:"So tần suất 30 kỳ gần nhất với toàn bộ khoảng đang xem. Chênh lệch thường là dao động ngắn hạn."},
  pair:{t:"Cặp số cùng xuất hiện",b:"Hai số xuất hiện trong cùng một ngày nhiều hơn hoặc ít hơn mức kỳ vọng nếu độc lập. Đây chỉ là mô tả lịch sử."},
  score:{t:"Điểm xếp hạng thử nghiệm",b:"Điểm tổng hợp các phép đo lịch sử để phục vụ kiểm chứng. Khi chưa có xác nhận ngoài mẫu, điểm này không là kết luận cho kỳ sau."},
  edge:{t:"Ưu thế và sai số",b:"Ưu thế là phần chênh của giá trị đứng đầu so với nền; sai số là độ không chắc của phép đo. Nếu ưu thế nhỏ hơn sai số, khác biệt không tách được khỏi ngẫu nhiên."},
  nendow:{t:"Mức nền theo thứ",b:"XSMN có số đài quay khác nhau theo ngày trong tuần nên số vị trí kết quả thay đổi. Mức nền được tính theo đúng thứ để so sánh công bằng."},
  duehan:{t:"So với khoảng trung bình",b:"Khoảng hiện tại so với khoảng xuất hiện trung bình của chính số đó. 120% nghĩa là khoảng hiện tại dài hơn mức trung bình 20%; đây chỉ là mô tả quá khứ."},
  klucpct:{t:"% so khoảng dài nhất",b:"Khoảng hiện tại bằng bao nhiêu phần khoảng dài nhất từng ghi nhận của số đó. Chỉ số này không cho biết kết quả kỳ tiếp theo."},
};
const tip = k => GLOSSARY[k] ? `<sup class="info" data-tip="${k}">!</sup>` : "";
document.addEventListener("click", e=>{
  const t=e.target.closest(".info");
  const pop=$("#tipPop");
  if(t){
    const g=GLOSSARY[t.dataset.tip]; if(!g) return;
    pop.innerHTML=`<b>${g.t}</b><div style="margin-top:5px">${g.b}</div>`;
    pop.style.display="block";
    const r=t.getBoundingClientRect(), w=Math.min(320, innerWidth-24);
    pop.style.width=w+"px";
    pop.style.left=Math.max(8, Math.min(r.left-40, innerWidth-w-12))+"px";
    pop.style.top=(r.bottom+8+scrollY)+"px";
    e.stopPropagation();
  } else if(!e.target.closest("#tipPop")) pop.style.display="none";
});

/* ============================================================================
   BỘ LỌC
   ========================================================================== */
function renderFilters(sl){
  document.documentElement.dataset.region=ST.region;
  $$("#regSeg button").forEach(b=>{
    const on=b.dataset.r===ST.region;
    b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on));
  });

  const sc=$("#fScope"); sc.innerHTML="";
  sc.append(
    mkChip("Tất cả giải", ST.scope==="all", ()=>{ST.scope="all";refresh()}),
    mkChip(ST.region==="MB"?"G7 + GĐB":"G8 + GĐB", ST.scope==="dd", ()=>{ST.scope="dd";refresh()})
  );

  const dg=$("#fDigit"); dg.innerHTML="";
  dg.append(
    mkChip("2 số", ST.digits===2, ()=>{ST.digits=2;refresh()}),
    mkChip("3 số", ST.digits===3, ()=>{ST.digits=3;refresh()})
  );

  const wc=$("#fWin"); wc.innerHTML="";
  for(const w of WINS) wc.append(mkChip(w.label, ST.win===w.n, ()=>{ST.win=w.n;refresh()}, w.n>sl.avail));
  wc.append(mkChip("Toàn bộ lịch sử", ST.win==="max", ()=>{ST.win="max";refresh()}, false, `${sl.avail} kỳ`));

  const winLabel=ST.win==="max"?`Toàn bộ ${sl.avail.toLocaleString("vi-VN")} kỳ`:(WINS.find(w=>w.n===ST.win)?.label||`${ST.win} ngày`);
  $("#filterSummary").textContent=`${ST.region} · ${ST.digits} số đuôi · ${winLabel}`;

  const pr=$("#fProvRow");
  if(ST.region==="MN" && DB.MN.provs.length){
    pr.style.display="";
    const pc=$("#fProv"); pc.innerHTML="";
    pc.append(mkChip("Tất cả đài", !ST.provs||!ST.provs.size, ()=>{ST.provs=null;refresh()}));
    for(const p of DB.MN.provs){
      const on = ST.provs && ST.provs.has(p);
      pc.append(mkChip(p, on, ()=>{
        if(!ST.provs) ST.provs=new Set();
        if(ST.provs.has(p)) ST.provs.delete(p); else ST.provs.add(p);
        if(!ST.provs.size) ST.provs=null;
        refresh();
      }));
    }
  } else pr.style.display="none";
}

/* ---------------- kết quả mới nhất ---------------- */
const VN_TIME_FMT=new Intl.DateTimeFormat("vi-VN",{
  timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
});
const VN_DATE_FMT=new Intl.DateTimeFormat("vi-VN",{
  timeZone:"Asia/Ho_Chi_Minh",weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"
});
function vnTime(){
  const parts=Object.fromEntries(VN_TIME_FMT.formatToParts(new Date()).map(p=>[p.type,p.value]));
  return {text:VN_TIME_FMT.format(new Date()), mins:Number(parts.hour)*60+Number(parts.minute)};
}
function vnIsoDate(){
  const parts=Object.fromEntries(VN_DATE_FMT.formatToParts(new Date()).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function livePhase(region){
  const now=vnTime(), start=DRAW_TIME[region], open=start-10, close=start+55;
  if(now.mins>=open && now.mins<=close)
    return {live:true,label:"Đang cập nhật dữ liệu",detail:"Kết quả hiển thị khi kho dữ liệu nhận được bản công bố."};
  if(now.mins<open){
    const left=open-now.mins;
    return left<=90
      ? {live:false,label:`Sắp quay · còn khoảng ${left} phút`,detail:"Kết quả kỳ gần nhất vẫn đang hiển thị."}
      : {live:false,label:"Xem kết quả mới nhất",detail:`Kỳ ${region} thường bắt đầu lúc ${Math.floor(start/60)}:${pad(start%60,2)}.`};
  }
  return {live:false,label:"Đang kiểm tra kết quả mới",detail:"Kết quả chính thức thường được cập nhật sau khi kỳ quay kết thúc."};
}
const OFFICIAL_NOTICE={
  MN:{href:"https://www.xskthcm.com/",label:"Mở trang công bố của Công ty Xổ số Kiến thiết TP.HCM"},
  MB:{href:"https://xosohaiduong.vn/",label:"Mở trang công bố của Công ty Xổ số Kiến thiết Hải Dương"},
};
function updateLiveStatus(){
  const phase=livePhase(ST.region), now=vnTime();
  const latest=DB[ST.region].days.at(-1);
  const waiting=now.mins>=DRAW_TIME[ST.region] && (!latest || latest.d<vnIsoDate());
  $("#liveClock").textContent=now.text;
  $("#liveStatus").textContent=waiting?"Kỳ hôm nay chưa có dữ liệu":phase.label;
  $("#liveSignal").classList.toggle("on",phase.live);
  $("#liveTitle").textContent=`Kết quả xổ số ${ST.region==="MN"?"Miền Nam":"Miền Bắc"}`;
  const source=OFFICIAL_NOTICE[ST.region];
  $("#liveLead").innerHTML=waiting
    ? `Kỳ hôm nay chưa có dữ liệu, thường cập nhật trong 15–30 phút sau giờ quay. <a href="${source.href}" target="_blank" rel="noopener noreferrer">${source.label}</a>.`
    : `${phase.detail} Chọn Miền Nam hoặc Miền Bắc ở thanh phía trên.`;
  const p=$("#liveP");
  if(p){
    p.innerHTML=`<span class="dot" aria-hidden="true"></span>${phase.live?"Đang cập nhật":"Kết quả hôm nay"}`;
    p.title="Mở kết quả mới nhất";
  }
}
function renderLive(){
  updateLiveStatus();
  renderHomeResults();
  $("#v-live")?.classList.toggle("is-live",livePhase(ST.region).live);
}

/* ---------------- bảng kết quả của kho dữ liệu ---------------- */
const RESULT_GROUPS=window.XS_SITE_SCHEMA?.resultGroups;
if(!RESULT_GROUPS) throw new Error("Không tải được cấu trúc bảng kết quả.");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
function resultDays(region){ return [...DB[region].days].reverse() }
function resultRows(region){
  let start=0;
  return RESULT_GROUPS[region].map(g=>{
    const row={...g,start}; start+=g.c; return row;
  }).sort((a,b)=>(a.kind==="special"?0:a.kind==="first"?1:2)-(b.kind==="special"?0:b.kind==="first"?1:2));
}
function rowNumbers(region,day,row,draw){
  const nums=region==="MN" ? draw?.nums : day.nums;
  return nums ? nums.slice(row.start,row.start+row.c) : [];
}
function drawNumber(n){
  const raw=String(n??""), prefix=raw.length>2?raw.slice(0,-2):"", tail=raw.slice(-2);
  return `<span class="draw-number">${esc(prefix)}<span class="draw-tail">${esc(tail)}</span></span>`;
}
function drawNums(nums){
  return `<div class="draw-values">${nums.map(drawNumber).join("")}</div>`;
}
function renderResultPriority(region,day,rows){
  const featured=rows.filter(row=>row.kind);
  return `<div class="result-priority" aria-label="Giải đặc biệt và giải nhất">
    ${featured.map(row=>{
      const values=region==="MN"
        ? day.draws.map(draw=>({label:draw.p,nums:rowNumbers(region,day,row,draw)}))
        : [{label:"",nums:rowNumbers(region,day,row)}];
      return `<section class="priority-prize ${row.kind}">
        <div class="priority-prize-head"><b>${row.kind==="special"?"Giải đặc biệt":row.n}</b><small>${region==="MN"?`${day.draws.length} đài`:"XSMB"}</small></div>
        <div class="priority-values${values.length===1?" single":""}">${values.map(v=>`<div class="priority-value"><small>${v.label?esc(v.label):"&nbsp;"}</small>${v.nums.length?drawNumber(v.nums[0]):"—"}</div>`).join("")}</div>
      </section>`;
    }).join("")}
  </div>`;
}
function renderDesktopTable(region,day,rows){
  const rest=rows.filter(row=>!row.kind);
  if(region==="MB"){
    return `<div class="result-scroll"><table class="draw-table" aria-label="Các giải còn lại XSMB ngày ${esc(fmtD(day.d))}"><tbody>${rest.map(row=>
      `<tr class="draw-row"><th scope="row" class="prize-name">${row.n}</th><td>${drawNums(rowNumbers(region,day,row))}</td></tr>`
    ).join("")}</tbody></table></div>`;
  }
  return `<div class="result-scroll"><table class="draw-table draw-table-mn" aria-label="Các giải còn lại XSMN ngày ${esc(fmtD(day.d))}">
    <thead><tr><th scope="col">Giải</th>${day.draws.map(draw=>`<th scope="col">${esc(draw.p)}</th>`).join("")}</tr></thead><tbody>${rest.map(row=>
      `<tr class="draw-row"><th scope="row" class="prize-name">${row.n}</th>${day.draws.map(draw=>`<td>${drawNums(rowNumbers(region,day,row,draw))}</td>`).join("")}</tr>`
    ).join("")}</tbody></table></div>`;
}
function resultProvinceKey(slot){ return slot==="home"?"homeProvince":"historyProvince" }
function selectedProvince(slot,day){
  const key=resultProvinceKey(slot), max=Math.max(0,day.draws.length-1);
  ST[key]=Math.min(Math.max(0,ST[key]),max);
  return ST[key];
}
function renderMobileRows(region,day,rows,draw){
  return `<div class="mobile-prize-list">${rows.map(row=>`<div class="mobile-prize-row${row.kind?` ${row.kind}`:""}"><span class="mobile-prize-name">${row.kind==="special"?"Giải đặc biệt":row.n}</span><div>${drawNums(rowNumbers(region,day,row,draw))}</div></div>`).join("")}</div>`;
}
function renderMobileResult(region,day,rows,slot){
  if(region==="MB") return `<div class="result-mobile" data-result-slot="${slot}"><article class="mobile-result-card"><div class="mobile-card-head">XSMB · đầy đủ các giải</div>${renderMobileRows(region,day,rows)}</article></div>`;
  const index=selectedProvince(slot,day), draw=day.draws[index], cardId=`resultCard-${slot}`;
  return `<div class="result-mobile" data-result-slot="${slot}">
    <div class="province-strip" role="tablist" aria-label="Chọn đài XSMN">${day.draws.map((item,i)=>`<button type="button" class="province-chip" role="tab" data-result-slot="${slot}" data-result-province="${i}" aria-selected="${i===index}" aria-controls="${cardId}">${esc(item.p)}</button>`).join("")}</div>
    <article class="mobile-result-card province-result-card" id="${cardId}" role="tabpanel" data-result-slot="${slot}" data-result-total="${day.draws.length}" aria-label="Kết quả ${esc(draw.p)}"><div class="mobile-card-head">${esc(draw.p)} · ${fmtD(day.d)}</div>${renderMobileRows(region,day,rows,draw)}</article>
    ${day.draws.length>1?`<p class="swipe-note">Vuốt sang trái hoặc phải để đổi đài.</p>`:""}
  </div>`;
}
function renderTailRollup(region,day){
  const counts=new Map();
  for(const tail of tailsOfDay(day,region,"all",2,false)) counts.set(tail,(counts.get(tail)||0)+1);
  const tails=[...counts].sort(([a],[b])=>Number(a)-Number(b));
  return `<section class="tail-rollup" aria-label="Hai số cuối trong kỳ">
    <div class="tail-rollup-head"><h4>2 số cuối trong kỳ</h4><p>Bấm một số để xem lịch sử đã công bố.</p></div>
    <div class="tail-list">${tails.map(([tail,count])=>`<button type="button" class="tail-chip" data-tail-query="${tail}" aria-label="Xem lịch sử số ${tail}">${tail}${count>1?`<small>×${count}</small>`:""}</button>`).join("")}</div>
  </section>`;
}
function renderResultSheet(region,day,slot="history"){
  if(!day) return `<div class="result-empty">Chưa có kết quả để hiển thị.</div>`;
  const rows=resultRows(region), area=region==="MN"?"Miền Nam":"Miền Bắc";
  return `<div class="result-sheet" data-result-slot="${slot}">
    <div class="result-meta"><h3>${area} · ${DOW_VN[day.w]}, ${fmtD(day.d)}</h3><span>${region==="MN"?`${day.draws.length} đài mở thưởng`:"Bảng kết quả đầy đủ"}</span></div>
    <div class="result-desktop">${renderResultPriority(region,day,rows)}${renderDesktopTable(region,day,rows)}</div>
    ${renderMobileResult(region,day,rows,slot)}
    ${renderTailRollup(region,day)}
    <p class="result-source"><b>Nguồn:</b> kết quả do các công ty xổ số kiến thiết công bố, căn cứ biên bản của Hội đồng giám sát xổ số. Kết quả chính thức lấy theo thông báo của công ty xổ số kiến thiết.</p>
  </div>`;
}
function renderDateStrip(node,days,selected,onPick){
  node.innerHTML="";
  days.forEach((d,i)=>{
    const b=el("button","date-chip"+(i===selected?" on":""));
    b.type="button"; b.setAttribute("aria-pressed",String(i===selected));
    b.innerHTML=`<b>${DOW_S[d.w]} · ${fmtDS(d.d)}</b><span>${d.d.slice(0,4)}${ST.region==="MN"?` · ${d.draws.length} đài`:""}</span>`;
    b.onclick=()=>onPick(i); node.append(b);
  });
}
function renderHomeResults(){
  const days=resultDays(ST.region), shown=days.slice(0,7);
  ST.homeIndex=Math.min(ST.homeIndex,Math.max(0,shown.length-1));
  renderDateStrip($("#homeDates"),shown,ST.homeIndex,i=>{ST.homeIndex=i;renderHomeResults()});
  const d=shown[ST.homeIndex];
  $("#latestTitle").textContent=`Kết quả ${ST.region} gần nhất`;
  $("#latestNote").textContent=d?`Đã cập nhật đến ${fmtD(days[0].d)} · chọn ngày để xem đầy đủ từng giải.`:"Chưa có dữ liệu.";
  $("#homeResult").innerHTML=renderResultSheet(ST.region,d,"home");
}
function renderHistory(){
  const days=resultDays(ST.region), shown=days.slice(0,ST.historyCount);
  ST.historyIndex=Math.min(ST.historyIndex,Math.max(0,shown.length-1));
  renderDateStrip($("#historyDates"),shown,ST.historyIndex,i=>{ST.historyIndex=i;renderHistory()});
  const d=shown[ST.historyIndex];
  $("#historyTitle").textContent=d?`Kết quả ${ST.region} ngày ${fmtD(d.d)}`:`Lịch sử ${ST.region}`;
  $("#historyResult").innerHTML=renderResultSheet(ST.region,d,"history");
  const more=$("#historyMore");
  const canLoadArchive=archiveState!=="ready" && days.length>=90;
  more.hidden=shown.length>=Math.min(days.length,120)&&!canLoadArchive;
  more.textContent=canLoadArchive
    ? "Xem thêm từ kho đầy đủ"
    : `Hiện thêm ngày (${shown.length}/${Math.min(days.length,120)})`;
}
/* Nhãn phạm vi dùng trong bộ lọc và modal lịch sử công khai. */
const scopeLabel=(reg,sc)=> sc==="dd" ? (reg==="MB"?"G7 + GĐB":"G8 + GĐB") : "Tất cả giải";

/* ============================================================================
   VIEW: BẢNG SỐ
   ========================================================================== */
const HM_MODES=[
  {k:"freq", n:"Số kỳ xuất hiện", d:"số kỳ có xuất hiện trong khoảng đang xem"},
  {k:"gap",  n:"Lâu chưa xuất hiện", d:"số kỳ tính từ lần xuất hiện gần nhất"},
  {k:"rec",  n:"30 kỳ gần đây", d:"số kỳ có xuất hiện trong 30 kỳ gần nhất"},
];
function renderBoard(){
  const hm=$("#hmMode"); hm.innerHTML="";
  for(const m of HM_MODES) hm.append(mkChip(m.n, ST.hmMode===m.k, ()=>{ST.hmMode=m.k;renderBoard()}));
  const mode=HM_MODES.find(m=>m.k===ST.hmMode)||HM_MODES[0];

  // lấy giá trị theo chế độ
  const val=t=>{ const s=A.S.get(t);
    if(mode.k==="gap") return s?s.curGap:A.K;
    if(mode.k==="rec") return s?s.recCnt:0;
    return s?s.daysCnt:0; };
  const label=t=>{ const s=A.S.get(t);
    if(mode.k==="gap") return (s?s.curGap:A.K)+"k";
    if(mode.k==="rec") return (s?s.recCnt:0)+"/"+A.RECN;
    return String(s?s.daysCnt:0); };

  const keys = ST.digits===2
    ? Array.from({length:100},(_,i)=>pad(i,2))
    : [...A.S.entries()].sort((a,b)=>{
        const f = mode.k==="gap" ? b[1].curGap-a[1].curGap
                : mode.k==="rec" ? b[1].recCnt-a[1].recCnt
                : b[1].daysCnt-a[1].daysCnt;
        return f || (a[0]<b[0]?-1:1);
      }).slice(0,120).map(e=>e[0]);

  const vals=keys.map(val);
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
  const sd=Math.sqrt(vals.reduce((a,v)=>a+(v-mean)*(v-mean),0)/Math.max(1,vals.length-1))||1;
  const pct01=percentileMap(vals);

  $("#hmTitle").innerHTML = (ST.digits===2
    ? "Bản đồ số 00 – 99"
    : "120 bộ 3 số nổi bật trong dữ liệu") + tip("heatmap");

  const h=$("#heat");
  h.className = ST.digits===2 ? "hm" : "hm3";
  h.innerHTML="";
  for(const t of keys){
    const v=val(t), z=(v-mean)/sd;
    // gan: giá trị cao = lâu chưa ra = "lạnh" → đảo chiều cho trực giác đúng
    const tt = mode.k==="gap" ? 1-pct01(v) : pct01(v);
    const col=heatColor(tt);
    const s=A.S.get(t);
    const c=el("button","cl"+(Math.abs(z)>=2?" mark":""),
      `<div class="n">${t}</div><div class="c">${label(t)}</div>`);
    c.type="button"; c.setAttribute("aria-label",`Xem lịch sử số ${t}`);
    c.style.background=col.bg; c.style.color=col.fg;
    c.title=`${t} — xuất hiện ${s?s.daysCnt:0}/${A.K} kỳ (${pctS(s?s.daysCnt/A.K:0)}) · ${s?s.occ:0} lần`+
            ` · khoảng hiện tại ${s?s.curGap:A.K} kỳ · 30 kỳ gần ${s?s.recCnt:0}`+
            `\n${mode.n}: ${v} · hạng ${(tt*100).toFixed(0)}/100 · lệch z=${z>=0?"+":""}${z.toFixed(2)}σ`;
    c.onclick=()=>openNum(t,ST.digits);
    h.append(c);
  }

  const nOut=vals.filter(v=>Math.abs((v-mean)/sd)>=2).length;
  $("#hmLegend").innerHTML=`
    <div class="hmleg">
      <div class="hmbar" style="background:${heatGradientCss()}"></div>
      <div class="hmtick"><span>${mode.k==="gap"?"lâu nhất":"ít nhất"}</span><span>giữa bảng</span><span>${mode.k==="gap"?"gần nhất":"nhiều nhất"}</span></div>
      <div class="hmnote">
        Màu thể hiện <b>${mode.n.toLowerCase()}</b>: ${mode.d}. Các ô được trải màu theo thứ hạng để dễ so sánh${tip("hangvsthuc")}.
        Mức xuất hiện chung của một số bất kỳ trong mỗi kỳ là <b>${pctS(A.pBase,2)}</b> với bộ lọc hiện tại.
        ${nOut ? `<span>${nOut} ô có viền nổi bật vì lệch nhiều hơn mức chung; dao động như vậy vẫn có thể xuất hiện ngẫu nhiên.</span>` : ""}
      </div>
    </div>`;

  const rows=[...A.S.entries()];
  const hot=rows.slice().sort((a,b)=>b[1].daysCnt-a[1].daysCnt).slice(0,20);
  $("#hotSub").textContent=`Mức chung của một số bất kỳ: ${pctS(A.pBase,2)} mỗi kỳ.`;
  $("#coldSub").textContent=`Mức chung của một số bất kỳ: ${pctS(A.pBase,2)} mỗi kỳ.`;
  $("#tHot").innerHTML=
    `<thead><tr><th>Số</th><th>Kỳ xuất hiện</th><th>Tỉ lệ</th><th>So mức chung</th><th>Lần gần nhất</th></tr></thead><tbody>`+
    hot.map(([t,s])=>{
      return `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="warm">${s.daysCnt}</td>
        <td>${pctS(s.daysCnt/A.K)}</td><td>×${A.pBase?(s.daysCnt/A.K/A.pBase).toFixed(2):"—"}</td><td>${fmtDS(s.last)}</td></tr>`;
    }).join("")+`</tbody>`;

  const all=[];
  for(let n=0;n<A.U;n++){ const t=pad(n,A.digits), s=A.S.get(t); all.push([t,s?s.daysCnt:0,s]) }
  const cold=all.slice().sort((a,b)=>a[1]-b[1]).slice(0,20);
  $("#tCold").innerHTML=
    `<thead><tr><th>Số</th><th>Kỳ xuất hiện</th><th>Tỉ lệ</th><th>So mức chung</th><th>Kỳ chưa xuất hiện</th><th>Lần gần nhất</th></tr></thead><tbody>`+
    cold.map(([t,c,s])=>`<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="cold">${c}</td>
      <td>${pctS(c/A.K)}</td><td>×${A.pBase?(c/A.K/A.pBase).toFixed(2):"—"}</td><td>${s?s.curGap:A.K}</td><td>${s&&s.last?fmtDS(s.last):"—"}</td></tr>`).join("")+`</tbody>`;

  // đầu / đuôi
  const sec=$("#secHT");
  if(ST.digits!==2){ sec.style.display="none" }
  else{
    sec.style.display="";
    const hd=Array(10).fill(0), tl=Array(10).fill(0);
    for(const[t,s]of A.S){ hd[+t[0]]+=s.occ; tl[+t[1]]+=s.occ }
    const draw=(node,arr)=>{
      const mx=Math.max(...arr,1); node.innerHTML="";
      arr.forEach((v,i)=>node.append(el("div","br",
        `<span class="l">${i}</span><span class="t"><i style="width:${v/mx*100}%"></i></span><span class="v">${v}</span>`)));
    };
    draw($("#bHead"),hd); draw($("#bTail"),tl);
  }
  renderFullTable();
}

const SORT={key:"daysCnt",dir:-1};
function renderFullTable(){
  const q=($("#tf").value||"").trim();
  const z=zBonf(A.U,0.05);
  const rows=[];
  for(let n=0;n<A.U;n++){
    const t=pad(n,A.digits);
    if(q && !t.includes(q)) continue;
    const s=A.S.get(t);
    const[lo,hi]=wilson(s?s.daysCnt:0, A.K, z);
    const p=s?s.daysCnt/A.K:0;
    rows.push({t, occ:s?s.occ:0, daysCnt:s?s.daysCnt:0, p, lift:A.pBase?p/A.pBase:0,
      curGap:s?s.curGap:A.K, maxGap:s?s.maxGap:A.K, minGap:s&&s.minGap!=null?s.minGap:null,
      avgGap:s&&s.avgGap!=null?s.avgGap:null, lo, hi, last:s?s.last:""});
  }
  rows.sort((a,b)=>{
    let va=a[SORT.key], vb=b[SORT.key];
    if(va==null) va=SORT.dir<0?-1:1e9;
    if(vb==null) vb=SORT.dir<0?-1:1e9;
    if(va===vb) return a.t<b.t?-1:1;
    return SORT.dir*(va<vb?-1:1);
  });
  const cols=[["t","Số"],["occ","Số lần"],["daysCnt","Số kỳ"],["p","Tỉ lệ"],["lift","So mức chung"],
              ["curGap","Khoảng hiện tại"],["maxGap","Dài nhất"],["minGap","Ngắn nhất"],["avgGap","Trung bình"],["last","Lần gần nhất"]];
  $("#tFull").innerHTML=
    `<thead><tr>`+cols.map(([k,l])=>`<th onclick="setSort('${k}')">${l}${SORT.key===k?` <span style="font-size:14px">${SORT.dir<0?"▼":"▲"}</span>`:""}</th>`).join("")+`</tr></thead><tbody>`+
    rows.map(r=>`<tr onclick="openNum('${r.t}',${A.digits})"><td class="n">${r.t}</td><td>${r.occ}</td><td>${r.daysCnt}</td>
      <td>${pctS(r.p)}</td><td>×${A.pBase?(r.p/A.pBase).toFixed(2):"—"}</td><td>${r.curGap}</td><td>${r.maxGap}</td><td>${r.minGap==null?"—":r.minGap}</td>
      <td>${r.avgGap==null?"—":r.avgGap.toFixed(1)}</td><td>${r.last?fmtDS(r.last):"—"}</td></tr>`).join("")+
    `</tbody>`;
}
window.setSort = k => {
  if(SORT.key===k) SORT.dir*=-1;
  else { SORT.key=k; SORT.dir=(k==="t"||k==="last"||k==="minGap"||k==="avgGap")?1:-1 }
  renderFullTable();
};

/* ============================================================================
   VIEW: GAN & CHU KỲ
   ========================================================================== */
function renderGap(){
  const all=[];
  for(let n=0;n<A.U;n++){ const t=pad(n,A.digits), s=A.S.get(t); all.push({t,s,cur:s?s.curGap:A.K}) }

  $("#tGan").innerHTML=
    `<thead><tr><th>Số</th><th>Kỳ chưa xuất hiện${tip("ganht")}</th><th>Dài nhất từng có${tip("longest")}</th><th>% so dài nhất${tip("klucpct")}</th><th>Lần gần nhất</th></tr></thead><tbody>`+
    all.slice().sort((a,b)=>b.cur-a.cur).slice(0,25).map(({t,s,cur})=>{
      const mg=s?s.maxGap:A.K;
      const rel=mg?cur/mg:1;
      return `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="cold">${cur}</td>
        <td>${mg}</td><td style="color:${rel>=1?"var(--gold)":"var(--dim)"}">${(rel*100).toFixed(0)}%</td>
        <td>${s&&s.last?fmtDS(s.last):"—"}</td></tr>`;
    }).join("")+`</tbody>`;

  const withGaps=[...A.S.entries()].filter(([,s])=>s.gaps.length>=2);
  $("#tMaxGap").innerHTML=
    `<thead><tr><th>Số</th><th>Khoảng dài nhất${tip("longest")}</th><th>Khoảng hiện tại</th><th>Kỳ xuất hiện</th><th>Khoảng trung bình${tip("tbgap")}</th></tr></thead><tbody>`+
    withGaps.slice().sort((a,b)=>b[1].maxGap-a[1].maxGap).slice(0,25).map(([t,s])=>
      `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="cold">${s.maxGap}</td>
       <td>${s.curGap}</td><td>${s.daysCnt}</td><td>${s.avgGap!=null?s.avgGap.toFixed(1):"—"}</td></tr>`).join("")+`</tbody>`;

  $("#tMinGap").innerHTML=
    `<thead><tr><th>Số</th><th>Khoảng trung bình</th><th>Ngắn nhất${tip("shortest")}</th><th>Dài nhất</th><th>Kỳ xuất hiện</th></tr></thead><tbody>`+
    withGaps.slice().sort((a,b)=>a[1].avgGap-b[1].avgGap).slice(0,25).map(([t,s])=>
      `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="good">${s.avgGap.toFixed(2)}</td>
       <td>${s.minGap}</td><td>${s.maxGap}</td><td>${s.daysCnt}</td></tr>`).join("")+`</tbody>`;

  const rhythm=withGaps.filter(([,s])=>s.cv!=null && s.gaps.length>=5);
  $("#tRhythm").innerHTML=
    `<thead><tr><th>Số</th><th>Độ đều${tip("cv")}</th><th>Khoảng trung bình</th><th>Khoảng hiện tại</th><th>So mức trung bình${tip("duehan")}</th></tr></thead><tbody>`+
    (rhythm.length
      ? rhythm.sort((a,b)=>a[1].cv-b[1].cv).slice(0,25).map(([t,s])=>{
          const due=s.avgGap>0 ? s.curGap/s.avgGap : 0;
          return `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="good">${s.cv.toFixed(2)}</td>
            <td>${s.avgGap.toFixed(1)}</td><td>${s.curGap}</td>
            <td style="color:${due>=1?"var(--gold)":"var(--dim)"}">${(due*100).toFixed(0)}%</td></tr>`;
        }).join("")
      : `<tr><td colspan="5" class="empty">Cần ít nhất 5 lần xuất hiện cho mỗi số</td></tr>`)+`</tbody>`;

  // đường hazard
  const N=Math.min(30, A.hazard.reach.length-1);
  const vals=[];
  let mx=A.pBase;
  for(let g=0;g<=N;g++){
    const r=A.hazard.reach[g], e=A.hazard.evt[g];
    const ok=r>=40, v=ok?e/r:null;
    vals.push({g,v,r,ok}); if(v&&v>mx)mx=v;
  }
  $("#hzChart").innerHTML=
    `<div class="hz">`+vals.map(({g,v,r,ok})=>
      `<div class="b ${ok?"":"dim"}" title="khoảng ${g} kỳ: ${ok?pctS(v)+" ("+r+" quan sát)":"chỉ "+r+" quan sát — chưa đủ dữ liệu"}">
        <i style="height:${v==null?4:Math.max(3,v/mx*100)}%"></i></div>`).join("")+`</div>`+
    `<div class="hzx">`+vals.map(({g})=>`<span>${g%5===0?g:""}</span>`).join("")+`</div>`;
  $("#hzNote").innerHTML=
    `Đường ngang tại <b>${pctS(A.pBase,2)}</b> là mức nền nếu xổ số hoàn toàn ngẫu nhiên (không có trí nhớ).
     Cột xám = chưa đủ 40 quan sát nên không đáng tin.
     <br><b>Cách đọc:</b> các cột dao động quanh mức nền cho thấy thời gian chờ dài hơn không làm xác suất của kỳ sau tăng lên.`;
}

/* ============================================================================
   VIEW: CẦU & MẪU
   ========================================================================== */
function renderPattern(){
  $("#carrySub").innerHTML=
    `Trong toàn bộ mẫu: xuất hiện ở kỳ trước → <b style="color:var(--txt)">${pctS(A.pCarry)}</b> lặp lại ở kỳ liền sau ·
     không xuất hiện ở kỳ trước → <b style="color:var(--txt)">${pctS(A.pFresh)}</b> ·
     mức chung <b style="color:var(--txt)">${pctS(A.pBase)}</b>.`;
  const K=A.K;
  if(K>0){
    const prev=[...A.daySets[K-1]];
    const rows=prev.map(t=>{
      const s=A.S.get(t);
      const own=s.carryBase>=8 ? s.carryHit/s.carryBase : null;
      return {t, own, base:s.carryBase, all:s.daysCnt/A.K};
    }).sort((a,b)=>(b.own??-1)-(a.own??-1)||b.base-a.base).slice(0,20);
    $("#tCarry").innerHTML=
      `<thead><tr><th>Số ở kỳ gần nhất</th><th>Tỉ lệ lặp lại${tip("carry")}</th><th>Mẫu</th><th>Tỉ lệ toàn bộ</th></tr></thead><tbody>`+
      rows.map(r=>`<tr onclick="openNum(&quot;${r.t}&quot;,${A.digits})"><td class="n">${r.t}</td>`+
        `<td>${r.own==null?"—":pctS(r.own)}</td><td style="color:var(--dim2)">${r.base}</td>`+
        `<td style="color:var(--dim)">${pctS(r.all)}</td></tr>`).join("")+`</tbody>`;
  }else{
    $("#tCarry").innerHTML=`<tbody><tr><td class="empty">Chưa có dữ liệu lịch sử.</td></tr></tbody>`;
  }

  const dowRows=[0,1,2,3,4,5,6].map(w=>({w,days:A.dowTotals[w]||0,occ:A.occDow[w]||0}));
  $("#dowSub").textContent="Số kỳ và số lần xuất hiện đã ghi nhận theo từng thứ trong tuần.";
  $("#tDow").innerHTML=
    `<thead><tr><th>Thứ</th><th>Số kỳ</th><th>Lần xuất hiện</th><th>Trung bình/kỳ</th></tr></thead><tbody>`+
    dowRows.map(r=>`<tr><td>${DOW_VN[r.w]}</td><td>${r.days}</td><td>${r.occ}</td>`+
      `<td>${r.days?(r.occ/r.days).toFixed(1):"—"}</td></tr>`).join("")+`</tbody>`;

  renderPairs();
  renderMomentum();
  renderGroups();
}

function renderPairs(){
  if(A.digits!==2){
    $("#tPair").innerHTML=`<tbody><tr><td class="empty">Chỉ áp dụng cho 2 số đuôi (1000 số quá thưa để tìm cặp)</td></tr></tbody>`;
    return;
  }
  const U=A.U, K=A.K;
  const co=new Map();
  for(const set of A.daySets){
    const arr=[...set].sort();
    for(let i=0;i<arr.length;i++)
      for(let j=i+1;j<arr.length;j++)
        { const k=arr[i]+"-"+arr[j]; co.set(k,(co.get(k)||0)+1) }
  }
  const rows=[];
  for(const[k,c]of co){
    if(c<4) continue;
    const[a,b]=k.split("-");
    const sa=A.S.get(a), sb=A.S.get(b);
    const exp=K*(sa.daysCnt/K)*(sb.daysCnt/K);   // kỳ vọng nếu độc lập
    if(exp<1.5) continue;
    rows.push({a,b,c,exp,lift:c/exp});
  }
  rows.sort((x,y)=>y.lift-x.lift||y.c-x.c);
  $("#tPair").innerHTML=
    `<thead><tr><th>Cặp</th><th>Cùng ngày</th><th>Kỳ vọng</th><th>Vượt${tip("pair")}</th></tr></thead><tbody>`+
    (rows.length
      ? rows.slice(0,20).map(r=>`<tr onclick="openNum('${r.a}',2)"><td class="n">${r.a} · ${r.b}</td>
          <td>${r.c}</td><td style="color:var(--dim)">${r.exp.toFixed(1)}</td>
          <td class="good">×${r.lift.toFixed(2)}</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty">Mẫu chưa đủ lớn</td></tr>`)+`</tbody>`;
}

function renderMomentum(){
  const rows=[];
  for(let n=0;n<A.U;n++){
    const t=pad(n,A.digits), s=A.S.get(t);
    if(!s) continue;
    const pAll=s.daysCnt/A.K, pRec=s.recCnt/A.RECN;
    if(s.recCnt<2) continue;
    rows.push({t,pAll,pRec,rec:s.recCnt,lift:pAll>0?pRec/pAll:0});
  }
  rows.sort((a,b)=>b.lift-a.lift||b.rec-a.rec);
  $("#tMomentum").innerHTML=
    `<thead><tr><th>Số</th><th>${A.RECN} kỳ gần</th><th>Toàn mẫu</th><th>Tăng tốc${tip("momentum")}</th></tr></thead><tbody>`+
    rows.slice(0,20).map(r=>`<tr onclick="openNum('${r.t}',${A.digits})"><td class="n">${r.t}</td>
      <td class="warm">${pctS(r.pRec)}</td><td style="color:var(--dim)">${pctS(r.pAll)}</td>
      <td class="good">×${r.lift.toFixed(2)}</td></tr>`).join("")+`</tbody>`;
}

function renderGroups(){
  const G=[];
  const total=A.totalOcc;
  const cnt=t=>{const s=A.S.get(t);return s?s.occ:0};
  const sumIf=fn=>{let c=0;for(const[t,s]of A.S) if(fn(t)) c+=s.occ; return c};
  const countIf=fn=>{let c=0;for(let n=0;n<A.U;n++) if(fn(pad(n,A.digits))) c++; return c};
  const add=(name,fn,note)=>{
    const o=sumIf(fn), k=countIf(fn);
    G.push({name, o, k, obs:total?o/total:0, exp:k/A.U, note});
  };
  if(A.digits===2){
    add("Kép bằng (00,11,…99)", t=>t[0]===t[1]);
    add("Kép lệch (05,16,…)", t=>Math.abs(+t[0]-+t[1])===5);
    add("Tổng chẵn", t=>((+t[0]+ +t[1])%2)===0);
    add("Đầu > Đuôi", t=>+t[0]>+t[1]);
    add("Cả 2 chữ số chẵn", t=>(+t[0]%2===0)&&(+t[1]%2===0));
    add("Cả 2 chữ số lẻ", t=>(+t[0]%2===1)&&(+t[1]%2===1));
    add("Có chữ số 0", t=>t.includes("0"));
    add("Có chữ số 9", t=>t.includes("9"));
  }else{
    add("Ba số giống nhau", t=>t[0]===t[1]&&t[1]===t[2]);
    add("Có ít nhất 1 cặp trùng", t=>t[0]===t[1]||t[1]===t[2]||t[0]===t[2]);
    add("3 chữ số khác nhau", t=>t[0]!==t[1]&&t[1]!==t[2]&&t[0]!==t[2]);
    add("Tăng dần", t=>+t[0]<+t[1]&&+t[1]<+t[2]);
    add("Giảm dần", t=>+t[0]>+t[1]&&+t[1]>+t[2]);
    add("Tổng chia hết cho 3", t=>((+t[0]+ +t[1]+ +t[2])%3)===0);
    add("Toàn chữ số chẵn", t=>[...t].every(c=>+c%2===0));
    add("Toàn chữ số lẻ", t=>[...t].every(c=>+c%2===1));
  }
  $("#tGroup").innerHTML=
    `<thead><tr><th>Nhóm</th><th>Số lượng</th><th>Lần ra</th><th>Thực tế</th><th>Lý thuyết</th><th>Chênh</th></tr></thead><tbody>`+
    G.map(g=>{
      const lift=g.exp?g.obs/g.exp:0;
      const cls=lift>=1.05?"good":lift<=0.95?"warm":"";
      return `<tr style="cursor:default"><td>${g.name}</td><td style="color:var(--dim)">${g.k}</td><td>${g.o}</td>
        <td>${pctS(g.obs,2)}</td><td style="color:var(--dim)">${pctS(g.exp,2)}</td>
        <td class="${cls}">×${lift.toFixed(3)}</td></tr>`;
    }).join("")+`</tbody>`;
}

let CROSS_CACHE={};
function renderCross(){
  const dg=ST.digits;

  /* ---- 1. Hôm nay ---- */
  const mbLast=DB.MB.days[DB.MB.days.length-1], mnLast=DB.MN.days[DB.MN.days.length-1];
  const today=(()=>{const n=new Date();return `${n.getFullYear()}-${pad(n.getMonth()+1,2)}-${pad(n.getDate(),2)}`})();
  const mnToday = mnLast && mnLast.d===today ? mnLast : null;
  const mbToday = mbLast && mbLast.d===today ? mbLast : null;
  const mins=new Date().getHours()*60+new Date().getMinutes();
  const toMB=DRAW_TIME.MB-mins;

  let html=`<div class="grid2">`;
  // XSMN
  html+=`<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span class="badge b2">XSMN</span><b>16:15</b>
      <span style="margin-left:auto;font-size:14px;color:${mnToday?"var(--ok)":"var(--dim)"}">
        ${mnToday?"✓ đã có kết quả "+fmtD(today):"chưa quay / chưa có dữ liệu"}</span></div>`;
  if(mnToday){
    const ts=[...new Set(tailsOfDay(mnToday,"MN","all",dg,false))].sort();
    html+=`<div style="font-size:14px;color:var(--dim);margin-bottom:8px">
      ${mnToday.draws.map(x=>x.p).join(" · ")} — <b style="color:var(--txt)">${ts.length}</b> số ${dg} chữ số riêng biệt:</div>
      <div class="tags">${ts.map(t=>`<button type="button" class="tag clk" onclick="openNum('${t}',${dg})">${t}</button>`).join("")}</div>`;
  } else html+=`<div class="empty" style="padding:14px">Chưa có kết quả hôm nay</div>`;
  html+=`</div>`;
  // XSMB
  html+=`<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span class="badge b3">XSMB</span><b>18:15</b>
      <span style="margin-left:auto;font-size:14px;color:${mbToday?"var(--ok)":"var(--gold)"}">
        ${mbToday?"✓ đã có kết quả "+fmtD(today)
          :(toMB>0?`còn ${Math.floor(toMB/60)}:${pad(toMB%60,2)} nữa quay`:"chưa có dữ liệu")}</span></div>`;
  if(mbToday){
    const ts=[...new Set(tailsOfDay(mbToday,"MB","all",dg,false))].sort();
    const mnSet = mnToday ? new Set(tailsOfDay(mnToday,"MN","all",dg,false)) : null;
    html+=`<div style="font-size:14px;color:var(--dim);margin-bottom:8px">
      <b style="color:var(--txt)">${ts.length}</b> số riêng biệt${mnSet?` — <span style="color:var(--ok)">xanh</span> = trùng với XSMN chiều`:""}:</div>
      <div class="tags">${ts.map(t=>`<button type="button" class="tag clk" ${mnSet&&mnSet.has(t)?'style="color:var(--ok);border-color:rgba(56,217,150,.4)"':""} onclick="openNum('${t}',${dg})">${t}</button>`).join("")}</div>`;
    if(mnSet){
      let ov=0; for(const t of ts) if(mnSet.has(t)) ov++;
      html+=`<div style="font-size:14px;color:var(--dim);margin-top:10px">Trùng <b style="color:var(--txt)">${ov}</b> số với XSMN chiều nay.</div>`;
    }
  } else if(mnToday){
    html+=`<div style="background:var(--card2);border-radius:10px;padding:12px 14px;font-size:14px;color:var(--dim);line-height:1.75">
      <b style="color:var(--txt)">XSMB chưa có kết quả hôm nay.</b> Kết quả XSMN đã được ghi nhận và sẽ được đối chiếu khi đủ dữ liệu 2 miền.</div>`;
  } else html+=`<div class="empty" style="padding:14px">Chưa có kết quả hôm nay</div>`;
  html+=`</div></div>`;
  $("#crossToday").innerHTML=html;

  /* ---- 2. Phép đo quan hệ 2 miền ---- */
  const box=$("#crossTest");
  if(CROSS_CACHE[dg]) paintCrossTest(CROSS_CACHE[dg]);
  else{
    box.innerHTML=`<div class="empty">Đang đo trên toàn bộ lịch sử hai miền…</div>`;
    setTimeout(()=>{ CROSS_CACHE[dg]=crossAnalyze(dg); paintCrossTest(CROSS_CACHE[dg]) },30);
  }

  /* ---- 3. Thống kê gộp ---- */
  const md=mergedDays(dg);
  const U=Math.pow(10,dg);
  const cnt=new Map(); let tot=0;
  const from=Math.max(0,md.length-1000);
  for(let i=from;i<md.length;i++){
    const s=new Set([...tailsOfDay(md[i].mn,"MN","all",dg,false), ...tailsOfDay(md[i].mb,"MB","all",dg,false)]);
    for(const t of s){ cnt.set(t,(cnt.get(t)||0)+1); tot++ }
  }
  const nd=md.length-from;
  const arr=[...cnt.entries()].sort((a,b)=>b[1]-a[1]);
  const z=zBonf(U,0.05);
  const pAvg=tot/nd/U;
  $("#crossMerge").innerHTML=`
    <div style="font-size:14px;color:var(--dim);margin-bottom:12px">
      ${nd} ngày gần nhất có cả hai miền · trung bình <b style="color:var(--txt)">${(tot/nd).toFixed(1)}</b>
      số ${dg} chữ số riêng biệt mỗi ngày khi gộp · mỗi số có <b style="color:var(--txt)">${pctS(pAvg,2)}</b>
      khả năng xuất hiện ở ít nhất một trong hai miền${tip("nen")}</div>
    <div class="tw"><table>
      <thead><tr><th>Hạng</th><th>Số</th><th>Số ngày có mặt</th><th>Tỉ lệ</th><th>Cận dưới 95%${tip("ktc")}</th></tr></thead><tbody>
      ${arr.slice(0,15).map(([t,c],i)=>{
        const[lo]=wilson(c,nd,z);
        return `<tr onclick="openNum('${t}',${dg})"><td style="color:var(--dim2)">#${i+1}</td>
          <td class="n">${t}</td><td class="warm">${c}/${nd}</td><td>${pctS(c/nd)}</td>
          <td style="color:${lo>pAvg?"var(--ok)":"var(--dim)"}">${pctS(lo)}</td></tr>`;
      }).join("")}
    </tbody></table></div>
    <div style="font-size:14px;color:var(--dim2);margin-top:10px">
      Bảng gộp chỉ mô tả mức xuất hiện trên dữ liệu 2 miền; không cho biết kết quả của kỳ tiếp theo.</div>`;
}

function paintCrossTest(C){
  const box=$("#crossTest");
  if(!C){ box.innerHTML=`<div class="empty">Không đủ dữ liệu chung hai miền.</div>`; return }
  const sig1=Math.abs(C.t1.z)>1.96;
  const sigShift=Math.abs(C.shift.z)>C.shift.zCrit;
  const anySig=sig1||sigShift;
  box.innerHTML=`
    <div style="font-size:14px;color:var(--dim);margin-bottom:12px">
      Đo trên <b style="color:var(--txt)">${C.K.toLocaleString("vi")}</b> ngày có đủ cả hai miền
      (${fmtD(C.from)} → ${fmtD(C.to)}) · ${C.digits} số đuôi</div>
    <div class="tw"><table>
      <thead><tr><th style="text-align:left">Giả thuyết</th><th style="text-align:left">Kết quả đo</th><th>Kết luận</th></tr></thead><tbody>
      <tr style="cursor:default"><td>Tỉ lệ XSMB khi số đó đã có mặt ở XSMN</td>
        <td style="text-align:left">Có ra ở MN: <b>${pctS(C.t1.pIn,3)}</b> · không ra ở MN: <b>${pctS(C.t1.pOut,3)}</b><br>
          <span style="color:var(--dim2)">chênh ${((C.t1.pIn-C.t1.pOut)*100).toFixed(3)}pp · z=${C.t1.z.toFixed(2)} · ${C.t1.n.toLocaleString("vi")} quan sát</span></td>
        <td class="${sig1?"warm":"good"}">${sig1?"CÓ":"KHÔNG"}</td></tr>
      <tr style="cursor:default"><td>Số trùng nhau mỗi ngày nhiều hơn mức tình cờ?</td>
        <td style="text-align:left">Thực tế <b>${C.overlap.avg.toFixed(2)}</b> số/ngày · nếu độc lập <b>${C.overlap.exp.toFixed(2)}</b></td>
        <td class="${Math.abs(C.overlap.avg-C.overlap.exp)>0.15?"warm":"good"}">${Math.abs(C.overlap.avg-C.overlap.exp)>0.15?"CÓ":"KHÔNG"}</td></tr>
      <tr style="cursor:default"><td>Phép dịch số GĐB Miền Nam và kết quả XSMB</td>
        <td style="text-align:left">Quét cả ${C.U} phép dịch — mạnh nhất k=${C.shift.k}: <b>${pctS(C.shift.p)}</b> (nền ${pctS(C.shift.base)})<br>
          <span style="color:var(--dim2)">z=${C.shift.z.toFixed(2)} · ngưỡng sau hiệu chỉnh ${C.U} phép thử: ${C.shift.zCrit.toFixed(2)}</span></td>
        <td class="${sigShift?"warm":"good"}">${sigShift?"CÓ":"KHÔNG"}</td></tr>
    </tbody></table></div>

    <div class="mh">Đối chiếu hồi cứu các số XSMN với XSMB cùng ngày</div>
    <div class="tw"><table>
      <thead><tr><th>N số từ XSMN</th><th>Trùng TB/kỳ</th><th>N số ngẫu nhiên</th><th>Chênh lệch</th></tr></thead><tbody>
      ${C.bt.map(b=>`<tr style="cursor:default"><td>${b.N} số</td><td class="good">${b.avg.toFixed(3)}</td>
        <td style="color:var(--dim)">${b.exp.toFixed(3)}</td>
        <td class="${b.lift>0.03?"up":b.lift<-0.03?"dn":""}">${b.lift>=0?"+":""}${(b.lift*100).toFixed(1)}%</td></tr>`).join("")}
    </tbody></table></div>

    <div style="margin-top:14px;padding:12px 15px;border-radius:10px;background:var(--card2);font-size:14px;color:var(--dim);line-height:1.75">
      ${anySig
        ? `<b style="color:var(--warn)">Có dấu hiệu liên hệ.</b> Hãy kiểm tra lại bằng dữ liệu mới trước khi tin — và nhớ rằng
           app đã thử rất nhiều giả thuyết, nên một kết quả "có" đơn lẻ vẫn có thể là trùng hợp.`
        : `<b style="color:var(--ok)">Kết luận: dữ liệu 2 miền không cho thấy mối liên hệ đáng kể.</b>
           Cả ba phép đo đều gần mức ngẫu nhiên, và đối chiếu hồi cứu chênh dưới 1% so với mẫu ngẫu nhiên
           trên ${C.K.toLocaleString("vi")} ngày.
           <br>Điều này hợp lý về cơ chế: hai miền dùng <b>hai bộ lồng cầu khác nhau, ở hai thành phố khác nhau,
           hai hội đồng giám sát khác nhau</b> — không có đường nào để kết quả bên này chạm vào bên kia.
           <br><span style="color:var(--dim2)">Việc XSMB công bố sau không làm kết quả XSMN trở thành thông tin về kỳ XSMB.</span>`}
    </div>`;
}

/* Bản public chỉ trình bày lịch sử đã xảy ra; không hiển thị điểm cho kỳ sau. */
window.openNum = (tail,digits) => {
  const Ax=digits===2?A2:A3, s=Ax.S.get(tail), hits=[];
  Ax.days.forEach(d=>{
    for(const[t,prize,prov] of tailsOfDay(d,ST.region,ST.scope,digits,true))
      if(t===tail) hits.push({d:d.d,w:d.w,prize,prov});
  });
  const dowCnt=[0,0,0,0,0,0,0], seen=new Set();
  for(const h of hits) if(!seen.has(h.d)){seen.add(h.d);dowCnt[h.w]++}

  const cmpF=baseDays();
  const cmpRows=[90,365,1000,"max"].map(w=>{
    const days=w==="max"?cmpF:cmpF.slice(-w);
    if(days.length<30) return null;
    const Ax2=w==="max"&&ST.win==="max"?Ax:analyze(days,ST.region,ST.scope,digits);
    const s2=Ax2.S.get(tail);
    return {label:w==="max"?"Toàn bộ":w===90?"3 tháng":w===365?"1 năm":"3 năm",K:Ax2.K,count:s2?s2.daysCnt:0,rate:s2?s2.daysCnt/Ax2.K:0};
  }).filter(Boolean);
  const cmpHtml=cmpRows.length<2?"":`
    <div class="mh">Qua các khoảng thời gian</div>
    <table class="sig"><tbody>
      <tr style="color:var(--dim2);font-size:14px"><td>Khoảng</td><td>Số kỳ</td><td>Số kỳ có ${esc(tail)}</td><td>Tỉ lệ</td></tr>
      ${cmpRows.map(r=>`<tr><td>${r.label}</td><td>${r.K.toLocaleString("vi-VN")}</td><td>${r.count}</td><td>${pctS(r.rate)}</td></tr>`).join("")}
    </tbody></table>`;

  let gapHtml="";
  if(s&&s.gaps.length){
    const bmax=Math.min(Math.max(...s.gaps,s.curGap)+1,40),cnt=new Array(bmax).fill(0);
    for(const g of s.gaps) cnt[Math.min(g,bmax-1)]++;
    const cmx=Math.max(...cnt,1);
    gapHtml=`<div class="mh">Khoảng cách giữa 2 lần xuất hiện</div><div class="gp">${cnt.map((v,i)=>`<i class="${Math.min(s.curGap,bmax-1)===i?"hl":""}" style="height:${Math.max(4,v/cmx*100)}%" title="${i}${i===bmax-1?"+":""} kỳ: ${v} lần"></i>`).join("")}</div>
      <div style="font-size:14px;color:var(--dim2);margin-top:5px">Cột vàng là khoảng hiện tại: ${s.curGap} kỳ.</div>`;
  }

  let coHtml="";
  if(s){
    const co=new Map();
    for(const di of s.hits) for(const x of Ax.daySets[di]) if(x!==tail) co.set(x,(co.get(x)||0)+1);
    const top=[...co.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
    if(top.length) coHtml=`<div class="mh">Thường cùng xuất hiện trong một kỳ</div><div class="tags">${top.map(([x,c])=>`<button type="button" class="tag clk" onclick="openNum('${x}',${digits})">${x} <b>${c}</b> kỳ</button>`).join("")}</div>`;
  }

  window._modalReturn=document.activeElement;
  $("#modal").innerHTML=`
    <div class="mhead">
      <div><div class="big" id="modalTitle">${esc(tail)}</div><div class="meta">${ST.region} · ${scopeLabel(ST.region,ST.scope)} · ${digits} số cuối<br>${Ax.K.toLocaleString("vi-VN")} kỳ · ${Ax.K?fmtD(Ax.from)+" → "+fmtD(Ax.to):"—"}</div></div>
      <button type="button" class="x" onclick="closeM()" aria-label="Đóng">✕</button>
    </div>
    <div class="ms">
      <div>Tổng số lần<b>${s?s.occ:0}</b></div>
      <div>Số kỳ xuất hiện<b>${s?s.daysCnt:0}/${Ax.K}</b></div>
      <div>Tỉ lệ lịch sử<b>${pctS(s?s.daysCnt/Ax.K:0)}</b></div>
      <div>Lần gần nhất<b style="font-size:14px">${s&&s.last?fmtD(s.last):"Chưa có"}</b></div>
      <div>Lâu chưa xuất hiện<b>${s?s.curGap:Ax.K} kỳ</b></div>
      <div>Khoảng dài nhất<b>${s?s.maxGap:Ax.K} kỳ</b></div>
      <div>Khoảng trung bình<b>${s&&s.avgGap!=null?s.avgGap.toFixed(1)+" kỳ":"—"}</b></div>
      <div>Khoảng ngắn nhất<b>${s&&s.minGap!=null?s.minGap+" kỳ":"—"}</b></div>
    </div>
    ${cmpHtml}${gapHtml}
    <div class="mh">Theo thứ trong tuần</div>
    <div class="dw">${[0,1,2,3,4,5,6].map(w=>{const mx=Math.max(...dowCnt,1);return `<div class="d"><div class="t"><i style="height:${dowCnt[w]/mx*100}%"></i></div>${DOW_S[w]}<br><b>${dowCnt[w]}</b></div>`}).join("")}</div>
    ${coHtml}
    <div class="mh">Các lần xuất hiện gần nhất</div>
    <div class="tags">${hits.length?hits.slice(-60).reverse().map(h=>`<span class="tag"><b>${fmtD(h.d)}</b> · ${esc(h.prize)}${h.prov?" · "+esc(h.prov):""}</span>`).join(""):`<span class="tag">Chưa xuất hiện trong khoảng này</span>`}</div>
    <div class="method-note" style="margin-top:16px">Thông tin trên chỉ mô tả kết quả đã công bố; không cho biết số nào sẽ xuất hiện ở kỳ tiếp theo.</div>`;
  $("#modal").setAttribute("aria-labelledby","modalTitle");
  $("#mbg").classList.add("show");
  $("#modal .x")?.focus();
};
window.closeM = () => {
  $("#mbg").classList.remove("show");
  if(window._modalReturn?.focus) window._modalReturn.focus();
};

/* ============================================================================
   ĐIỀU PHỐI
   ========================================================================== */
/* Tab "Phân tích sâu" gộp 3 màn cũ; chọn màn con bằng chip. */
const ANA_SUBS=[
  {k:"board",   n:"Bản đồ số",       fn:()=>renderBoard()},
  {k:"gap",     n:"Khoảng cách",      fn:()=>renderGap()},
  {k:"pattern", n:"Mẫu lịch sử",      fn:()=>renderPattern()},
];
function renderMethod(){
  const meta=window.XS_META||{}, mb=DB.MB.days, mn=DB.MN.days;
  const archiveReady=archiveState==="ready";
  const range=(a,total)=>archiveReady&&a.length
    ? `${fmtD(a[0].d)} → ${fmtD(a[a.length-1].d)}`
    : `Kho đầy đủ: ${(total||a.length).toLocaleString("vi-VN")} kỳ`;
  $("#methodData").innerHTML=`
    <section class="source-list" aria-label="Nguồn dữ liệu">
      <div class="source-row">
        <span class="source-card-icon" aria-hidden="true">MỚI</span>
        <div><h2>Kết quả mới nhất</h2><p>Bảng được dựng trực tiếp từ kho dữ liệu của Kết Số. Trong giờ quay, trang kiểm tra bản cập nhật mới mỗi 30 giây.</p></div>
        <a href="/nguon-du-lieu/">Xem nguồn dữ liệu</a>
      </div>
      <div class="source-row">
        <span class="source-card-icon archive" aria-hidden="true">KHO</span>
        <div><h2>Lịch sử kết quả</h2><p>Kho riêng được tổng hợp tự động từ thông báo công khai của các công ty xổ số kiến thiết và nguồn đối chiếu.</p></div>
        <span class="source-detail">Mỗi bảng luôn ghi rõ đây là dữ liệu đã công bố.</span>
      </div>
      <div class="source-row">
        <span class="source-card-icon update" aria-hidden="true">AUTO</span>
        <div><h2>Cập nhật hằng ngày</h2><p>Hệ thống kiểm tra dữ liệu sau giờ quay XSMN và XSMB, rồi chỉ phát hành phiên bản mới khi có kết quả mới.</p></div>
        <span class="source-detail">Lần cập nhật kho: ${esc(meta.updated||"chưa xác định")}</span>
      </div>
    </section>
    <section class="data-overview" aria-labelledby="dataOverviewTitle">
      <div class="result-shell-head"><div><span class="eyebrow">Độ sâu dữ liệu</span><h2 id="dataOverviewTitle">Kho đang có</h2></div></div>
      <div class="data-kpis">
        <div><span>XSMN</span><b>${(archiveReady?mn.length:Number(meta.xsmn_days||mn.length)).toLocaleString("vi-VN")}</b><small>kỳ · ${range(mn,Number(meta.xsmn_days))}</small></div>
        <div><span>XSMB</span><b>${(archiveReady?mb.length:Number(meta.xsmb_days||mb.length)).toLocaleString("vi-VN")}</b><small>kỳ · ${range(mb,Number(meta.xsmb_days))}</small></div>
        <div><span>Đài Miền Nam</span><b>${archiveReady?DB.MN.provs.length:"21"}</b><small>${archiveReady?"đài có dữ liệu thường xuyên":"đài trong kho công bố"}</small></div>
      </div>
    </section>
    <div class="method-note" role="note">
      <b>Cách đọc an toàn:</b> số liệu tần suất và bản đồ nhiệt chỉ mô tả những kỳ đã xảy ra. Mọi kết quả tiếp theo vẫn có tính ngẫu nhiên; website không cung cấp giao dịch hay cam kết kết quả.
    </div>`;
}
function renderAna(){
  const ac=$("#anaChips"); ac.innerHTML="";
  for(const s of ANA_SUBS)
    ac.append(mkChip(s.n, ST.anaSub===s.k, ()=>{ST.anaSub=s.k;renderAna()}));
  for(const s of ANA_SUBS)
    $("#sub-"+s.k).style.display = ST.anaSub===s.k ? "" : "none";
  ANA_SUBS.find(s=>s.k===ST.anaSub).fn();
}

const RENDER = { live:renderLive, history:renderHistory, ana:renderAna, cross:renderCross, verify:renderMethod };
let dirty = {};
const VIEW_HASH={live:"ket-qua",history:"lich-su",ana:"thong-ke",cross:"hai-mien",verify:"nguon"};
const FULL_DATA_VIEWS=new Set(["ana","cross"]);
const DATA_SCRIPT_PROMISES=new Map();
let archiveState="latest", archivePromise=null, archiveError="", dataEpoch=0;

function setDataLoading(show, message=""){
  const node=$("#dataLoad"); if(!node) return;
  node.hidden=!show;
  node.textContent=message;
}
function loadDataScript(key, src){
  if(DATA_SCRIPT_PROMISES.has(key)) return DATA_SCRIPT_PROMISES.get(key);
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=src; script.async=true;
    script.onload=()=>{script.remove();resolve()};
    script.onerror=()=>{script.remove();reject(new Error(`Không tải được ${src}`))};
    document.head.append(script);
  });
  DATA_SCRIPT_PROMISES.set(key,promise);
  return promise.catch(err=>{DATA_SCRIPT_PROMISES.delete(key);throw err});
}
function setDeferredView(v, state, message){
  const host=$("#v-"+v); if(!host) return;
  let panel=host.querySelector(".data-state");
  if(state==="ready"){
    host.classList.remove("data-pending"); panel?.remove(); return;
  }
  if(!panel){ panel=el("div","data-state"); host.prepend(panel); }
  host.classList.add("data-pending");
  panel.innerHTML=state==="error"
    ? `<b>Không tải được kho dữ liệu</b><span>${esc(message||"Kiểm tra kết nối rồi thử lại.")}</span><button type="button" class="btn g" data-load-archive>Thử lại</button>`
    : `<b>Đang tải kho dữ liệu</b><span>${esc(message||"Chuẩn bị bảng thống kê đầy đủ.")}</span>`;
}
function currentRevision(){ return (window.XS_META||{}).updated||window.XS_LATEST?.updated||"" }
function loadLatestData(revision){
  const wanted=revision||currentRevision(), epoch=++dataEpoch;
  const suffix=wanted?`?rev=${encodeURIComponent(wanted)}`:"";
  setDataLoading(true,"Đang nhận bản kết quả mới…");
  return loadDataScript(`latest:${wanted}`,`data/latest.js${suffix}`).then(()=>{
    if(epoch!==dataEpoch) return false;
    const latest=window.XS_LATEST;
    if(!latest||!Array.isArray(latest.mb)||!Array.isArray(latest.mn)) throw new Error("Bản kết quả mới không hợp lệ.");
    window.XS_RELOAD_DATA(latest.mb,latest.mn);
    CROSS_CACHE={}; archiveState="latest"; archiveError=""; archivePromise=null;
    setDataLoading(false); return true;
  }).catch(err=>{setDataLoading(false);throw err});
}
function ensureFullData(message="Đang tải kho dữ liệu đầy đủ…"){
  if(archiveState==="ready") return Promise.resolve(true);
  if(archiveState==="loading") return archivePromise;
  archiveState="loading"; archiveError="";
  const revision=currentRevision(), suffix=revision?`?rev=${encodeURIComponent(revision)}`:"", epoch=dataEpoch;
  setDataLoading(true,message);
  archivePromise=Promise.all([
    loadDataScript(`xsmb:${revision}`,`data/xsmb.js${suffix}`),
    loadDataScript(`xsmn:${revision}`,`data/xsmn.js${suffix}`)
  ]).then(()=>{
    if(epoch!==dataEpoch){
      archiveState="latest"; archivePromise=null;
      return ensureFullData(message);
    }
    if(!Array.isArray(window.XSMB_LINES)||!Array.isArray(window.XSMN_LINES)) throw new Error("Kho dữ liệu đầy đủ không hợp lệ.");
    window.XS_RELOAD_DATA(window.XSMB_LINES,window.XSMN_LINES);
    CROSS_CACHE={}; archiveState="ready"; archivePromise=null;
    setDataLoading(false); return true;
  }).catch(err=>{
    archiveState="error"; archiveError=err.message; archivePromise=null;
    setDataLoading(false); throw err;
  });
  return archivePromise;
}
function openHistoryNumber(tail, digits){
  if(archiveState==="ready"){ openNum(tail,digits); return }
  ensureFullData("Đang tải kho dữ liệu để tra cứu lịch sử…")
    .then(()=>{refresh();openNum(tail,digits)})
    .catch(err=>toast(`Chưa thể tra cứu toàn bộ lịch sử: ${err.message}`));
}

function refresh(){
  const sl=recompute();
  renderFilters(sl);
  dirty = {live:1,history:1,ana:1,cross:1,verify:1};
  showView(ST.view);
}
function showView(v){
  if(!RENDER[v]) v="live";
  ST.view=v;
  $("#filtersBar").hidden = v==="live" || v==="history" || v==="verify";
  $$("#nav button").forEach(b=>{
    const on=b.dataset.v===v;
    b.classList.toggle("on",on);
    b.setAttribute("aria-current",on?"page":"false");
  });
  $$(".view").forEach(n=>n.classList.toggle("on", n.id==="v-"+v));
  const stale=$("#staleBar");
  if(stale) stale.style.display=v==="live"||!stale.innerHTML?"none":"";
  if(FULL_DATA_VIEWS.has(v) && archiveState!=="ready"){
    setDeferredView(v,"loading","Đang tải kho dữ liệu đầy đủ để tính từ toàn bộ các kỳ đã công bố.");
    ensureFullData().then(loaded=>{
      if(loaded&&ST.view===v) refresh();
    }).catch(err=>{
      if(ST.view===v) setDeferredView(v,"error",err.message);
    });
    return;
  }
  setDeferredView(v,"ready");
  if(dirty[v]){ RENDER[v](); dirty[v]=0 }
  const hash=VIEW_HASH[v];
  if(hash && location.hash!==`#${hash}`) history.replaceState(null,"",`#${hash}`);
  window.scrollTo({top:0,behavior:"instant"});
}

/* --------- sự kiện --------- */
$("#nav").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(b) showView(b.dataset.v);
});
window.addEventListener("hashchange",()=>{
  const v=Object.entries(VIEW_HASH).find(([,h])=>location.hash===`#${h}`)?.[0];
  if(v && v!==ST.view) showView(v);
});
$("#liveP").addEventListener("click",()=>showView("live"));
$("#liveRefresh").addEventListener("click",()=>location.reload());
$("#homeToHistory").addEventListener("click",()=>showView("history"));
$("#liveToHistory").addEventListener("click",()=>showView("history"));
$("#liveToStats").addEventListener("click",()=>showView("ana"));
$("#historyMore").addEventListener("click",()=>{
  if(archiveState!=="ready"){
    setDeferredView("history","loading","Đang tải kho dữ liệu đầy đủ để mở thêm kỳ cũ.");
    ensureFullData("Đang tải kho dữ liệu đầy đủ để mở thêm lịch sử…")
      .then(()=>{setDeferredView("history","ready");ST.historyCount=Math.min(ST.historyCount+14,120);refresh()})
      .catch(err=>setDeferredView("history","error",err.message));
    return;
  }
  ST.historyCount=Math.min(ST.historyCount+14,120);renderHistory()
});
function selectResultProvince(slot,index){
  ST[resultProvinceKey(slot)]=Math.max(0,Number(index)||0);
  if(slot==="home") renderHomeResults(); else renderHistory();
}
$("#appMain").addEventListener("click",e=>{
  const province=e.target.closest("[data-result-province]");
  if(province){
    selectResultProvince(province.dataset.resultSlot,province.dataset.resultProvince);
    return;
  }
  const tail=e.target.closest("[data-tail-query]");
  if(tail) openHistoryNumber(tail.dataset.tailQuery,2);
  const retry=e.target.closest("[data-load-archive]");
  if(retry){
    const view=retry.closest(".view")?.id.replace("v-","")||ST.view;
    archiveState="latest";
    showView(view);
  }
});
let resultSwipe=null;
document.addEventListener("pointerdown",e=>{
  const card=e.target.closest(".province-result-card");
  if(!card||Number(card.dataset.resultTotal)<2){ resultSwipe=null; return }
  resultSwipe={slot:card.dataset.resultSlot,total:Number(card.dataset.resultTotal),x:e.clientX};
});
document.addEventListener("pointerup",e=>{
  const swipe=resultSwipe; resultSwipe=null;
  if(!swipe||Math.abs(e.clientX-swipe.x)<44) return;
  const key=resultProvinceKey(swipe.slot), delta=e.clientX<swipe.x?1:-1;
  selectResultProvince(swipe.slot,(ST[key]+delta+swipe.total)%swipe.total);
});
document.addEventListener("pointercancel",()=>{resultSwipe=null});
function currentTheme(){ return document.documentElement.dataset.theme||"system" }
function isMobileSearch(){ return window.matchMedia("(max-width: 639px)").matches }
function setSearchOpen(open){
  const box=$("#searchBox"), toggle=$("#searchToggle");
  if(!box||!toggle) return;
  const active=!!open&&isMobileSearch();
  box.classList.toggle("is-open",active);
  box.setAttribute("aria-hidden",String(isMobileSearch()&&!active));
  toggle.setAttribute("aria-expanded",String(active));
  if(active) requestAnimationFrame(()=>$("#gs")?.focus());
}
function updateThemeToggle(){
  const mode=currentTheme(), labels={system:"Theo hệ thống",light:"Sáng",dark:"Tối"};
  const b=$("#themeToggle"), label=$("#themeToggleLabel");
  if(!b||!label) return;
  label.textContent=labels[mode];
  b.setAttribute("aria-label",`Đổi giao diện, hiện ${labels[mode]}`);
  b.title=`Giao diện: ${labels[mode]}. Bấm để đổi.`;
}
function setTheme(mode){
  if(mode==="system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme=mode;
  try{localStorage.setItem("xs_theme",mode)}catch(e){}
  updateThemeToggle();
}
$("#themeToggle").addEventListener("click",()=>{
  setTheme({system:"light",light:"dark",dark:"system"}[currentTheme()]);
});
$("#searchToggle").addEventListener("click",()=>{
  setSearchOpen(!$("#searchBox").classList.contains("is-open"));
});
window.addEventListener("resize",()=>{ if(!isMobileSearch()) setSearchOpen(false) });
document.addEventListener("pointerdown",e=>{
  const box=$("#searchBox"), toggle=$("#searchToggle");
  if(box?.classList.contains("is-open")&&!box.contains(e.target)&&!toggle?.contains(e.target)) setSearchOpen(false);
});
$("#regSeg").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  ST.region=b.dataset.r; ST.provs=null; ST.win="max"; ST.homeIndex=0; ST.historyIndex=0; ST.homeProvince=0; ST.historyProvince=0; refresh();
});
$("#tf").addEventListener("input", renderFullTable);
$("#gs").addEventListener("keydown", e=>{
  if(e.key!=="Enter") return;
  e.preventDefault();
  const v=e.target.value.trim();
  if(!/^\d{2,3}$/.test(v)){
    e.target.style.borderColor="var(--hot)";
    toast("Nhập đúng 2 hoặc 3 chữ số, ví dụ 68 hoặc 668.");
    setTimeout(()=>e.target.style.borderColor="",900); return;
  }
  openHistoryNumber(v, v.length);
  e.target.value="";
  setSearchOpen(false);
});
$("#mbg").addEventListener("click", e=>{ if(e.target.id==="mbg") closeM() });
document.addEventListener("keydown", e=>{
  if(e.key==="Escape"){
    if($("#searchBox").classList.contains("is-open")){ setSearchOpen(false); return }
    closeM();
  }
  if(e.key==="/" && document.activeElement!==$("#gs")){
    e.preventDefault();
    if(isMobileSearch()) setSearchOpen(true); else $("#gs").focus();
  }
});

/* ============================================================================
   CẢNH BÁO DỮ LIỆU CŨ
   Nếu nguồn đổi cấu trúc HTML, crawler sẽ im lặng trả về 0 ngày và app vẫn
   hiển thị bình thường bằng số liệu cũ. Banner này để chuyện đó không trôi qua.
   ========================================================================== */
/** Ngày quay gần nhất mà lẽ ra PHẢI có kết quả rồi, tính đến thời điểm hiện tại. */
function expectedLastDraw(region){
  const now=new Date();
  const mins=now.getHours()*60+now.getMinutes();
  // cho nguồn 45 phút để công bố + crawler chạy
  const ready=DRAW_TIME[region]+45;
  let d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(mins<ready) d.setDate(d.getDate()-1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1,2)}-${pad(d.getDate(),2)}`;
}
function checkStale(){
  const bar=$("#staleBar");
  const meta=window.XS_META||{};
  const rows=[];
  for(const reg of ["MB","MN"]){
    const days=DB[reg].days;
    if(!days.length) continue;
    const have=days[days.length-1].d, want=expectedLastDraw(reg);
    if(have>=want) continue;
    // đếm số kỳ bị thiếu (XSMB nghỉ Tết ~4 ngày/năm nên 1 kỳ trễ chưa chắc là lỗi)
    const lag=Math.round((new Date(want)-new Date(have))/86400000);
    rows.push({reg, have, want, lag});
  }
  if(!rows.length){ bar.style.display="none"; bar.innerHTML=""; return }
  const worst=Math.max(...rows.map(r=>r.lag));
  const bad=worst>=2;
  bar.style.display=ST.view==="live"?"none":"";
  bar.innerHTML=`<div class="stale ${bad?"bad":"warn"}">
    <div style="flex:1;min-width:210px">
      <b>${bad?"Dữ liệu đang cũ — có thể nguồn đã hỏng":"Chưa có kết quả kỳ gần nhất"}</b><br>
      ${rows.map(r=>`${r.reg}: mới nhất <b>${fmtD(r.have)}</b>, lẽ ra phải có đến <b>${fmtD(r.want)}</b>
        (trễ ${r.lag} kỳ)`).join("<br>")}
      <br><span style="opacity:.85">Cập nhật lần cuối: ${meta.updated||"—"}.
      ${bad
        ? `Workflow cập nhật có thể đã lỗi hoặc nguồn đổi cấu trúc. Chủ website cần kiểm tra tab Actions trên GitHub.`
        : `Có thể đài chưa quay, hoặc workflow chưa chạy xong. Thử tải lại sau ít phút.`}</span>
    </div>
    <div class="act"><button class="btn g" onclick="this.closest('#staleBar').style.display='none'">Ẩn</button></div>
  </div>`;
}

/* --------- dữ liệu public (GitHub Actions → Vercel) --------- */
(function dataStatus(){
  const p=$("#liveP");
  const updated=(window.XS_META||{}).updated;
  p.className="pill live action";
  p.title=updated
    ? `Mở kết quả mới nhất. Kho thống kê cập nhật lần cuối: ${updated}.`
    : "Mở kết quả xổ số trực tiếp.";
})();
let metaVersion=(window.XS_META||{}).updated||"";
function pollLiveMeta(){
  loadDataScript(`meta:${Date.now()}`,`data/meta.js?ts=${Date.now()}`)
    .then(()=>{
    const next=(window.XS_META||{}).updated||"";
    if(next&&metaVersion&&next!==metaVersion){
      metaVersion=next;
      return loadLatestData(next).then(loaded=>{ if(loaded) refresh() });
    }
    metaVersion=next||metaVersion;
    updateLiveStatus();
  }).catch(()=>{});
}
setInterval(()=>{
  if(ST.view!=="live") return;
  const phase=livePhase(ST.region);
  updateLiveStatus();
  $("#v-live")?.classList.toggle("is-live",phase.live);
  if(phase.live) pollLiveMeta();
}, 30000);
setInterval(checkStale, 5*60000);

/* --------- khởi động --------- */
function initApp(){
  if(!DB.MB.days.length && !DB.MN.days.length){
    $("#noData").style.display="";
    $$(".view").forEach(n=>n.classList.toggle("on",n.id==="v-live"));
    document.querySelector(".filters").style.display="none";
    renderLive();
    return;
  }
  if(!DB.MB.days.length) ST.region="MN";
  const wanted=Object.entries(VIEW_HASH).find(([,h])=>location.hash===`#${h}`)?.[0];
  if(wanted) ST.view=wanted;
  checkStale();
  $("#foot").innerHTML=`
    <div class="foot-grid">
      <div class="foot-brand"><span class="foot-brand-mark" aria-hidden="true"><img src="/icon.svg?v=2" width="30" height="30" alt=""></span><span><b>Kết Số</b><span>Kết quả rõ ràng, mỗi ngày.</span></span></div>
      <div class="foot-trust">
        <span><b style="color:var(--txt)">Kết quả mới nhất</b><br>Hiển thị từ kho dữ liệu tự cập nhật của Kết Số.</span>
        <span><b style="color:var(--txt)">Kho dữ liệu</b><br>Cập nhật tự động sau kỳ quay · lần cuối ${window.XS_META?.updated||"chưa xác định"}.</span>
      </div>
    </div>
    <div class="foot-legal"><b style="color:var(--txt)">Lưu ý:</b> website chỉ tổng hợp kết quả và phân tích dữ liệu đã công bố. Mọi kết quả có tính ngẫu nhiên; dữ liệu quá khứ không dự báo tương lai. Website không yêu cầu tài khoản và không cung cấp giao dịch. <a href="/privacy.html">Quyền riêng tư</a>.</div>`;
  updateThemeToggle();
  setSearchOpen(false);
  refresh();
  requestAnimationFrame(()=>{ document.documentElement.dataset.appReady="true"; });
}
(function init(){
  const metaUpdated=(window.XS_META||{}).updated||"";
  const latestUpdated=window.XS_LATEST?.updated||"";
  if(metaUpdated&&latestUpdated!==metaUpdated){
    loadLatestData(metaUpdated).catch(()=>{}).finally(initApp);
  }else initApp();
})();
