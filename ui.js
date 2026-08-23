/* ============================================================================
   ui.js — Lớp giao diện. Mọi tính toán nằm ở app.js.
   ========================================================================== */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e };

const ST = {
  region:"MN", scope:"all", digits:2, win:"max", provs:null, view:"live",
  danSize:10, btDays:300, btWin:365, hmMode:"freq", quickN:2, anaSub:"board"
};
const WINS = [
  {n:7, label:"7 ngày"}, {n:30, label:"1 tháng"}, {n:90, label:"3 tháng"},
  {n:180, label:"6 tháng"}, {n:365, label:"1 năm"}, {n:1000, label:"3 năm"},
  {n:2000, label:"5 năm"}, {n:5000, label:"5000 ngày"},
];

let A2=null, A3=null, A=null, RANK2=null, RANK3=null, NEXT=null;

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

/* ---------------- kỳ tới ---------------- */
/* Không còn bộ lọc "Tại ngày" nên sl.end luôn bằng sl.F.length — kỳ tới luôn
   là ngày kế tiếp NGOÀI dữ liệu đã có, chưa từng có kết quả thật để chấm điểm.
   (Trước đây có nhánh "actual" để chấm ✓/✗ khi xem lại quá khứ; đã bỏ cùng lúc
   với "Tại ngày" vì hai tính năng đi chung — xem WORKLOG 2026-08-06.) */
function nextDraw(sl){
  const K=sl.days.length;
  if(!K) return {d:"",w:0,label:""};
  const d = addDays(sl.days[K-1].d, 1), w = dowOf(d);
  return {d, w, label:DOW_VN[w]+" "+fmtD(d)};
}

/* ---------------- tính lại toàn bộ ---------------- */
function recompute(){
  const sl = slicedDays();
  NEXT = nextDraw(sl);
  A2 = analyze(sl.days, ST.region, ST.scope, 2);
  A3 = analyze(sl.days, ST.region, ST.scope, 3);
  A  = ST.digits===2 ? A2 : A3;
  RANK2 = rankAll(A2, NEXT.w);
  RANK3 = rankAll(A3, NEXT.w);
  return sl;
}

/* ---------------- helper UI ---------------- */
function mkChip(label, on, cb, dis, sub){
  const c = el("button","chip"+(on?" on":"")+(dis?" dis":""), label + (sub?` <small>${sub}</small>`:""));
  c.type="button"; c.disabled=!!dis; c.setAttribute("aria-pressed",String(!!on)); c.onclick = cb; return c;
}
function liftTag(l){
  const cls = l>=1.15?"up": l<=0.87?"dn":"flat";
  return `<span class="lift ${cls}">×${l.toFixed(2)} nền</span>`;
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
  lift:{t:"×N nền (lift)",b:"Điểm của số này gấp bao nhiêu lần mức nền. ×1.00 = y hệt chọn bừa. ×1.05 = nhỉnh hơn 5%. Dưới ×1.10 gần như chắc chắn chỉ là nhiễu."},
  ganht:{t:"Gan hiện tại",b:"Số kỳ liên tiếp CHƯA ra, tính đến kỳ mới nhất. Gan 7 = đã 7 kỳ chưa thấy mặt. Lưu ý: gan lâu KHÔNG làm số dễ ra hơn — app đã đo trên toàn bộ lịch sử, xác suất ra gần như không đổi theo độ gan."},
  hazard:{t:"Tỉ lệ lịch sử sau gap",b:"Trong các khoảng chờ lịch sử đang ở đúng gap g, bao nhiêu khoảng kết thúc ở kỳ kế. App chỉ hiện tỉ lệ riêng khi g≤25 và còn ít nhất 200 quan sát; ngoài vùng đó nó trả về mức nền. Đây là mô tả lịch sử, không phải lời hứa số gan sẽ nổ."},
  longest:{t:"Longest gap",b:"Kỷ lục nhịn lâu nhất của số đó trong mẫu — khoảng dài nhất giữa 2 lần ra (tính cả khoảng đang chờ hiện tại)."},
  shortest:{t:"Shortest gap",b:"Khoảng chờ ngắn nhất giữa 2 lần ra. Bằng 0 = từng ra 2 kỳ liên tiếp."},
  tbgap:{t:"TB gap / chu kỳ",b:"Trung bình bao nhiêu kỳ thì số đó ra một lần. TB gap 3,2 = trung bình khoảng 3 kỳ ra 1 lần."},
  cv:{t:"Độ đều (CV)",b:"Nhịp ra có đều không. CV thấp = ra khá đều đặn; CV cao = lúc dồn dập lúc mất hút. Chỉ mang tính mô tả quá khứ."},
  ktc:{t:"Khoảng tin cậy đồng thời 95%",b:"App đang soi 100 hoặc 1.000 số cùng lúc, nên khoảng này đã hiệu chỉnh Bonferroni để cả bảng có độ tin cậy xấp xỉ 95%. Nó rộng hơn khoảng 95% của một số đơn lẻ. Cận dưới vượt nền mới là dấu hiệu đáng kiểm tra tiếp."},
  sigma:{t:"σ (độ lệch chuẩn) và z",b:"Thước đo 'lệch bao xa so với trung bình'. z=+2σ = cao hơn trung bình ở mức chỉ ~2% số ô đạt được do ngẫu nhiên. Trong 100 ô thì ngẫu nhiên thuần tuý cũng tạo ra ~5 ô vượt ±2σ — nên vài ô nổi bật là chuyện bình thường."},
  chi2:{t:"Kiểm định chi-square (χ²)",b:"Phép thử: tần suất các số có lệch khỏi 'mọi số đều như nhau' nhiều hơn mức ngẫu nhiên cho phép không. p ≥ 0.05 → không có bằng chứng lệch. p < 0.05 → có lệch, nhưng phải tìm nguyên nhân (thường do gộp nhiều đài/thời kỳ) trước khi kết luận."},
  uplift:{t:"Uplift",b:"Làm theo app hơn chọn bừa bao nhiêu %. Uplift +3% = trúng nhiều hơn chọn bừa 3% (quá nhỏ để có ý nghĩa). Quanh 0% = ngang chọn bừa — đó là kết quả trung thực với xổ số công bằng."},
  bttest:{t:"Trong mẫu vs ngoài mẫu",b:"'Ngoài mẫu' = đoán ngày mà công thức CHƯA từng thấy → thước đo thật. 'Trong mẫu' = chấm lại chính những ngày đã dùng để xây công thức → luôn đẹp hơn, vì công thức đã 'học thuộc' quá khứ. Chênh lệch giữa 2 cột chính là độ ảo (overfit)."},
  w:{t:"Độ tin cậy w (0…1)",b:"App tách chênh lệch quan sát được thành 2 phần: tín hiệu thật và nhiễu lấy mẫu. w = phần tín hiệu thật. w≈0 → chênh lệch toàn là nhiễu, tín hiệu đó bị bỏ qua khi chấm điểm. Đây là cơ chế chống ảo tưởng 'số nóng'."},
  dan:{t:"Kỳ vọng trúng ≥1 số",b:"Đánh cả dàn N số thì khả năng có ÍT NHẤT một số về là bao nhiêu. Ví dụ dàn 10 số XSMN ~99% — nghe cao nhưng nhớ: trúng 1 số chưa chắc đủ gỡ tiền vốn cả dàn. Đây là toán kỳ vọng, không phải cam kết."},
  heatmap:{t:"Bản đồ nhiệt",b:"Mỗi ô một số. Màu đỏ = thứ hạng cao trong bảng, xanh = thấp. Bấm vào ô để soi chi tiết số đó. Đổi cách tô màu bằng các nút phía trên."},
  hangvsthuc:{t:"Màu theo thứ hạng",b:"Màu được trải theo THỨ HẠNG để mắt dễ phân biệt. Nhưng chênh lệch THẬT giữa các ô thường rất nhỏ (xem con số trung bình ± bên cạnh) — ô đỏ nhất không có nghĩa 'sắp ra', nó chỉ đứng đầu bảng xếp hạng quá khứ."},
  carry:{t:"Lặp lại kỳ trước",b:"Niềm tin dân gian: số vừa về hôm trước dễ về tiếp. App đã đo trên toàn bộ lịch sử: tỉ lệ 'rơi tiếp' ≈ đúng mức nền — tức lặp lại kỳ trước KHÔNG có thật. Bảng này để bạn tự kiểm chứng."},
  momentum:{t:"Tăng tốc",b:"So tần suất 30 kỳ gần với tần suất toàn mẫu. ×1.5 = gần đây ra dày gấp rưỡi bình thường. Thường chỉ là dao động ngắn hạn."},
  pair:{t:"Cặp số đi cùng",b:"Hai số hay xuất hiện chung một ngày nhiều hơn mức tình cờ (cột 'Vượt' ×1.3 = nhiều hơn kỳ vọng 30%). Mang tính mô tả — chưa có bằng chứng dùng để đoán được."},
  score:{t:"Điểm xếp hạng thử nghiệm",b:"Điểm tổng hợp = nền đúng kỳ mục tiêu + các độ lệch lịch sử đã co ngót. Nó chỉ dùng để kiểm tra một mô hình xếp hạng; khi chưa có chứng nhận ngoài mẫu, app không dùng điểm này để chọn dàn kỳ tới."},
  edge:{t:"Ưu thế vs sai số",b:"Ưu thế = điểm số dẫn đầu trừ mức nền. Sai số = độ chính xác của chính phép đo. Ưu thế < sai số → bảng xếp hạng không phân biệt được với may rủi → app chuyển sang chế độ chọn đều."},
  nendow:{t:"Nền theo thứ",b:"XSMN ngày thường quay 3 đài, thứ Bảy 4 đài → số bộ số khác nhau → xác suất nền mỗi thứ mỗi khác (2 số: ~41,9% vs ~51%). App tự dùng nền đúng của thứ đó — đây là biến cấu trúc thật duy nhất đã tìm thấy trong dữ liệu."},
  duehan:{t:"So nhịp cũ",b:"Gan hiện tại so với nhịp về quen thuộc của chính số đó. 120% = đang chờ lâu hơn nhịp cũ 20%. ⚠ Chỉ là mô tả — app đã đo: chờ lâu hơn nhịp KHÔNG làm số dễ ra hơn."},
  doichung:{t:"Máy chọn (đối chứng)",b:"Bộ số tái lập được mà app tạo trước giờ quay. Nếu bạn nhập dàn riêng bằng tay, nhật ký sẽ so dàn của bạn với dàn máy cùng số lượng. Nếu bạn chốt trực tiếp bộ app thì hai dàn giống nhau và không còn phép so riêng."},
  evper:{t:"Trả theo số lần về",b:"Về mấy lần trong kỳ thì ăn mấy lần — cách trả phổ biến nhất của hình thức trả thưởng theo số lần ('trả theo số lần xuất hiện'). Ví dụ về 3 lần, mỗi lần 800k, thì nhận 2.400k."},
  evflat:{t:"Trả 1 lần cố định",b:"Về bao nhiêu lần trong kỳ cũng chỉ ăn đúng 1 lần tiền thưởng. Ít phổ biến hơn — hỏi kỹ host trước khi tin theo kiểu này."},
  evfair:{t:"Tỉ lệ công bằng",b:"Mức trả thưởng mà tại đó EV = 0, tức không ai lời ai lỗ về lâu dài. Host luôn trả THẤP HƠN mức này — chênh lệch chính là phần host ăn chắc (chênh lệch kỳ vọng)."},
  klucpct:{t:"% so kỷ lục",b:"Gan hiện tại bằng bao nhiêu phần kỷ lục nhịn lâu nhất của chính số đó. 120% = đang nhịn lâu hơn kỷ lục cũ 20%. ⚠ Vượt kỷ lục không có nghĩa là sắp ra — xác suất mỗi kỳ vẫn như cũ."},
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

/* ============================================================================
   VIEW: DỰ ĐOÁN
   ========================================================================== */
function renderHero(){
  const now=new Date();
  const mins=now.getHours()*60+now.getMinutes();
  const dt=DRAW_TIME[ST.region];
  let cdT, cdL;
  if(mins<dt){
    const r=dt-mins;
    cdT=`${Math.floor(r/60)}:${pad(r%60,2)}`; cdL="còn tới giờ quay";
  } else { cdT="✓"; cdL="đã quay xong hôm nay" }
  $("#hero").innerHTML=`
    <div class="hero-copy">
      <div class="eyebrow">Kỳ quay tiếp theo · ${ST.region}</div>
      <h1>${ST.region==="MB"?"Xổ số Miền Bắc":"Xổ số Miền Nam"}</h1>
      <div class="hero-date">${NEXT.label||"—"}</div>
      <div class="sm"><span>Quay lúc <b>${Math.floor(DRAW_TIME[ST.region]/60)}:${pad(DRAW_TIME[ST.region]%60,2)}</b></span>
        <span>Mẫu <b>${A2.K.toLocaleString("vi-VN")}</b> kỳ · ${A2.K?fmtD(A2.from)+" → "+fmtD(A2.to):"—"}</span>
        ${ST.region==="MN"?`<span>${ST.provs&&ST.provs.size?[...ST.provs].join(", "):"Tất cả đài"}</span>`:""}</div>
    </div>
    <div class="cd"><div class="l">${cdL}</div><div class="t">${cdT}</div><div class="cd-foot">Giờ Việt Nam</div></div>`;
}

/* ---------------- kết quả trực tiếp ---------------- */
const LIVE_SOURCE={
  MN:{
    name:"Miền Nam", code:"XSMN",
    embed:"https://www.minhngoc.net.vn/free/xo-so-truc-tiep/mien-nam.html",
    source:"https://www.minhngoc.net.vn/xo-so-truc-tiep/mien-nam.html"
  },
  MB:{
    name:"Miền Bắc", code:"XSMB",
    embed:"https://www.minhngoc.net.vn/free/xo-so-truc-tiep/mien-bac.html",
    source:"https://www.minhngoc.net.vn/xo-so-truc-tiep/mien-bac.html"
  }
};
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
function livePhase(region){
  const now=vnTime(), start=DRAW_TIME[region], open=start-10, close=start+55;
  if(now.mins>=open && now.mins<=close)
    return {live:true,label:"Đang tường thuật trực tiếp",detail:"Bảng bên dưới tự nhận từng giải khi nguồn công bố"};
  if(now.mins<open){
    const left=open-now.mins;
    return left<=90
      ? {live:false,label:`Sắp quay · còn khoảng ${left} phút`,detail:"Giữ trang này mở, bảng nguồn sẽ tự cập nhật"}
      : {live:false,label:"Xem kết quả mới nhất",detail:`Kỳ ${region} thường bắt đầu lúc ${Math.floor(start/60)}:${pad(start%60,2)}`};
  }
  return {live:false,label:"Kỳ hôm nay đã kết thúc",detail:"Bảng bên dưới đang hiển thị kết quả mới nhất"};
}
function setLiveFrame(region,force=false){
  const frame=$("#liveFrame"), loading=$("#liveLoading"), src=LIVE_SOURCE[region];
  if(!frame||(!force && frame.dataset.region===region)) return;
  loading?.classList.remove("done");
  if(loading) loading.lastChild.textContent="Đang kết nối bảng kết quả…";
  frame.dataset.region=region;
  frame.title=`Bảng kết quả ${src.code} trực tiếp từ Minh Ngọc`;
  frame.src=src.embed;
}
function updateLiveStatus(){
  const src=LIVE_SOURCE[ST.region], phase=livePhase(ST.region), now=vnTime();
  $("#liveClock").textContent=now.text;
  $("#liveStatus").textContent=phase.label;
  $("#liveSignal").classList.toggle("on",phase.live);
  $("#liveTitle").textContent=`Kết quả xổ số ${src.name}`;
  $("#liveLead").textContent=phase.detail+". Chọn miền ở thanh phía trên để đổi bảng.";
  $("#liveBoardTitle").textContent=`Trực tiếp ${src.code} · ${VN_DATE_FMT.format(new Date())}`;
  $("#liveBoardNote").textContent=ST.region==="MN"
    ? "Bảng tự cập nhật khi các đài bắt đầu quay. Trên điện thoại, vuốt ngang trong bảng để xem đủ đài."
    : "Bảng tự cập nhật từng giải khi miền Bắc bắt đầu quay; không cần tải lại cả website.";
  $("#liveSource").href=src.source;
  const p=$("#liveP");
  if(p){
    p.innerHTML=`<span class="dot" aria-hidden="true"></span>${phase.live?"Đang quay":"Xem kết quả"}`;
    p.title=`Mở bảng ${src.code} trực tiếp từ Minh Ngọc`;
  }
}
function renderLive(){
  updateLiveStatus();
  setLiveFrame(ST.region);
}

function predPanel(node, Ax, rank, kind){
  const N=ST.danSize;
  const top=rank.slice(0,N);
  const pBd=Ax.pBaseFor(NEXT.w);
  const pSet=Ax.baseSetProb(N,NEXT.w);
  const cells=top.map((r,i)=>{
    const s=r.s;
    return `<button type="button" class="nb ${i===0&&rank.model.actionable?"p1":""}" onclick="openNum('${r.tail}',${Ax.digits})" aria-label="Soi số ${r.tail}">
      <div class="rk">#${i+1}</div>
      <div class="v">${r.tail}</div>
      <div class="mt">Ra <b>${s?s.daysCnt:0}</b>/${Ax.K} kỳ · gan <b>${r.curGap}</b></div>
      ${liftTag(r.lift)}
    </button>`;
  }).join("");

  const dan=[5,10,20,30].map(n=>
    `<button type="button" class="chip ${N===n?"on":""}" onclick="setDan(${n})" aria-pressed="${N===n}">${n} số</button>`).join("");

  node.innerHTML=`
    <div class="predhead">
      <span class="badge ${kind==="2"?"b2":"b3"}">${kind} SỐ ĐUÔI</span>
      <b class="predlabel">${rank.model.actionable?"Xếp hạng đã qua kiểm chứng":"Lịch sử nổi bật · không phải dự đoán"}</b>
      <span style="font-size:12.5px;color:var(--dim)">${Ax.U} khả năng · nền ${pctS(pBd,2)}/số${tip("nen")} · mỗi ô kèm lift${tip("lift")}</span>
      <div class="kpi"><b>${pctS(pSet)}</b>xác suất nền có ≥1 số${tip("dan")}<br>khi chọn dàn ${N} số</div>
    </div>
    ${!rank.model.actionable?`<div style="font-size:11.5px;color:var(--dim2);margin:-6px 0 10px">
      ⚖ ${rank.model.flat?"Chênh lệch đang nằm trong nhiễu":"Có lệch trong mẫu nhưng chưa lặp lại ngoài mẫu"}${tip("edge")}
      — thứ tự dưới đây chỉ mô tả lịch sử, không dùng làm dàn cho kỳ tới.</div>`:""}
    <div class="nums n${kind}">${cells}</div>
    <div class="dan">Dàn: ${dan}
      ${!rank.model.actionable
        ? `<span class="histonly">Muốn lấy số cho kỳ tới: dùng bộ số ở khung ⚡ phía trên.</span>`
        : `<button class="copy" onclick="copyDan(${Ax.digits})" style="margin-left:auto">📋 Copy dàn</button>`}
    </div>`;
}

/* ---------------- NÚT CHỌN NHANH ---------------- */
/**
 * Trả về n số cho kỳ tới + giải thích căn cứ.
 * - Chỉ lấy Top n khi tín hiệu vừa vượt ngưỡng trong mẫu VÀ đã có chứng nhận OOS.
 * - Còn lại → chọn ĐỀU, gieo hạt từ ngày,
 *   tái lập được, không cảm tính.
 */
/* ---------------- ghim / loại số ---------------- */
/* Ghi đè thủ công của người dùng lên dàn ⚡ — KHÔNG đụng tới cách xếp hạng/chọn đều.
   Ghim = luôn có trong dàn. Loại = không bao giờ lấy. Một số không thể vừa ghim vừa loại
   (thêm sau thắng, tự gỡ khỏi danh sách kia). Lưu localStorage nên giữ được qua lần mở lại. */
const PXKEY="xs_pinexcl_v1";
function pxLoad(){
  try{
    const o=JSON.parse(localStorage.getItem(PXKEY));
    const clean=v=>[...new Set(Array.isArray(v) ? v.filter(t=>typeof t==="string" && /^\d{2,3}$/.test(t)) : [])];
    return {pin:clean(o&&o.pin), excl:clean(o&&o.excl)};
  }
  catch(e){ return {pin:[], excl:[]} }
}
function pxStore(o){ try{ localStorage.setItem(PXKEY, JSON.stringify(o)) }catch(e){} }
window.pxAdd = kind => {
  const inp = $(kind==="pin" ? "#pinIn" : "#exclIn");
  const add = parsePicks(inp.value, ST.digits);
  if(!add.length){ toast(`Nhập số đúng ${ST.digits} chữ số, cách nhau bằng dấu cách`); return }
  const o=pxLoad(), other = kind==="pin" ? "excl" : "pin";
  for(const t of add){
    if(!o[kind].includes(t)) o[kind].push(t);
    o[other]=o[other].filter(x=>x!==t);
  }
  pxStore(o); inp.value=""; renderPinExcl(); renderQuick();
};
window.pxDel = (kind, t) => {
  const o=pxLoad(); o[kind]=o[kind].filter(x=>x!==t);
  pxStore(o); renderPinExcl(); renderQuick();
};
function renderPinExcl(){
  const box=$("#pinChips"); if(!box) return; // chưa render view pred lần nào
  const o=pxLoad();
  const chip=(kind,t)=>`<span class="tag">${t} <button type="button" class="jdel" onclick="pxDel('${kind}','${t}')" aria-label="Bỏ số ${t}">✕</button></span>`;
  const pin=o.pin.filter(t=>t.length===ST.digits), excl=o.excl.filter(t=>t.length===ST.digits);
  $("#pinChips").innerHTML = pin.length ? pin.map(t=>chip("pin",t)).join(" ")
    : `<span style="color:var(--dim2);font-size:11.5px">Chưa ghim số nào</span>`;
  $("#exclChips").innerHTML = excl.length ? excl.map(t=>chip("excl",t)).join(" ")
    : `<span style="color:var(--dim2);font-size:11.5px">Chưa loại số nào</span>`;
}

function quickPick(Ax, rank, n){
  const M=rank.model;
  const seed=`${NEXT.d}|${ST.region}|${Ax.digits}|${ST.scope}|${ST.provs?[...ST.provs].sort().join(","):"all"}`;
  const px=pxLoad();
  const excl=new Set(px.excl.filter(t=>t.length===Ax.digits));
  const pin=px.pin.filter(t=>t.length===Ax.digits && !excl.has(t));
  // Không ghim/loại gì → hệt hành vi cũ (unbiasedPick(U) rồi cắt n vẫn ra đúng n số đầu tiên của
  // dòng ngẫu nhiên tái lập được, vì thuật toán chọn tuần tự không thay đổi khi xin thêm phần tử).
  const pool = M.actionable ? rank.map(r=>r.tail) : unbiasedPick(Ax.U, Ax.digits, Ax.U, seed);
  const rest = pool.filter(t=>!excl.has(t) && !pin.includes(t));
  const picks = pin.concat(rest).slice(0, Math.max(n, pin.length));
  return {mode: M.actionable?"bayes":"đều", picks, M, seed, pinned:pin.length};
}
function renderQuick(){
  const Ax = ST.digits===2 ? A2 : A3;
  const rank = ST.digits===2 ? RANK2 : RANK3;
  const n=ST.quickN;
  const q=quickPick(Ax, rank, n);
  const nEff=q.picks.length;             // có thể > n nếu ghim nhiều hơn số "Lấy"
  const pB=Ax.pBaseFor(NEXT.w);          // nền đúng theo thứ (MN: 3 đài vs 4 đài)
  const pAny=Ax.baseSetProb(nEff,NEXT.w);
  const M=q.M;
  const wRows=Object.entries(M.W).map(([k,w])=>
    `${SIGNAL_INFO[k]} <b style="color:${w>0.05?"var(--ok)":"var(--dim2)"}">${w.toFixed(3)}</b>`).join(" · ");

  $("#quick").innerHTML=`
    <div class="quick-head">
      <div>
        <div class="eyebrow">Dàn tham khảo hôm nay</div>
        <h2>Chọn dàn trong 3 bước</h2>
        <p>${NEXT.label} · ${ST.region} · ${scopeLabel(ST.region,ST.scope)} · ${Ax.digits} số đuôi</p>
      </div>
      ${!M.actionable?`<div class="mode-badge"><b>Máy chọn đều</b><span>Tái lập theo ngày</span></div>`:""}
    </div>
    <div class="qcfg">
      <div class="qstep">
        <div class="qstep-head"><span>1</span><b>Phạm vi giải</b></div>
        <div class="qstep-options">${["all","dd"].map(sc=>`<button type="button" class="chip ${ST.scope===sc?"on":""}" onclick="setQScope('${sc}')" aria-pressed="${ST.scope===sc}">${scopeLabel(ST.region,sc)}</button>`).join("")}</div>
      </div>
      <div class="qstep">
        <div class="qstep-head"><span>2</span><b>Loại số đuôi</b></div>
        <div class="qstep-options">${[2,3].map(dg=>`<button type="button" class="chip ${ST.digits===dg?"on":""}" onclick="setQDigits(${dg})" aria-pressed="${ST.digits===dg}">${dg} số</button>`).join("")}</div>
      </div>
      <div class="qstep">
        <div class="qstep-head"><span>3</span><b>Số lượng trong dàn</b></div>
        <div class="qstep-options">${[2,3,4,5,6,8,10].map(k=>`<button type="button" class="chip ${n===k?"on":""}" onclick="setQuickN(${k})" aria-pressed="${n===k}">${k}</button>`).join("")}</div>
      </div>
    </div>
    <div class="qresult">
      <div class="qresult-head"><span>Dàn đã chọn</span><b>${nEff} số · ${Ax.digits} chữ số</b></div>
      <div class="qout">
        <div class="qnums">${q.picks.map(t=>
          `<button type="button" class="qn" onclick="openNum('${t}',${Ax.digits})" aria-label="Soi chi tiết số ${t}">${t}</button>`
        ).join("")}</div>
        <div class="qmeta">
          <span>Nền mỗi số <b>${pctS(pB,2)}</b>${tip("nen")} ở kỳ ${DOW_S[NEXT.w]}${ST.region==="MN"?tip("nendow"):""}</span>
          <span>Dàn <b>${nEff} số</b>${q.pinned>n?` <em>(ghim ${q.pinned})</em>`:""} → có ≥1 số <b class="prob">${pctS(pAny)}</b>${tip("dan")}</span>
        </div>
      </div>
      <div class="qacts">
        <button class="qbtn" onclick="copyQuick()"><span aria-hidden="true">⧉</span> Copy dàn ${nEff} số</button>
        <button class="btn g" onclick="goToStats()">Xem thống kê chi tiết</button>
      </div>
      <div class="qnote">Bấm vào từng số để soi lịch sử. Dàn cố định theo ngày và không có nút quay lại để đổi số.</div>
    </div>
    <details class="qwhy">
      <summary>${!M.actionable?"Vì sao app chọn đều?":"Vì sao app chọn các số này?"}</summary>
      <div class="qwhybody">
      ${M.flat
        ? `<span class="ok">✔ Kết luận:</span> chưa đo được số nào có lợi thế đáng tin cậy trong <b>${Ax.K}</b> kỳ.
           Edge lớn nhất là
           <b>${(M.edge*100).toFixed(3)}pp</b>, trong khi sai số của chính phép đo đã là
           <b>±${(M.seOne*100).toFixed(3)}pp</b>: z = <b>${M.edgeRatio.toFixed(2)}</b>, chưa vượt ngưỡng đa so sánh
           <b>${M.zCrit.toFixed(2)}</b>.
           <br>Khi mọi số có kỳ vọng bằng nhau, lựa chọn tối ưu về mặt toán học là <b>chọn đều, không thiên vị</b>.
           App gieo hạt từ mã ngày <b>${NEXT.d}</b> nên bộ số này <b>tái lập được</b> — mở lại vẫn ra đúng nó,
           không cho phép quay lại nhiều lần tới khi ưng mắt.`
        : !M.oosValidated
        ? `<span class="wn">◆ Có lệch trong mẫu, chưa có edge dự đoán:</span> số dẫn đầu đạt z=<b>${M.edgeRatio.toFixed(2)}</b>
           so với ngưỡng ${M.zCrit.toFixed(2)}, nhưng backtest ngoài mẫu chưa chứng minh lệch này lặp lại ở ngày kế tiếp.
           Vì vậy app vẫn <b>chọn đều</b>; bảng xếp hạng bên dưới chỉ mô tả lịch sử.`
        : `<span class="wn">◆ Căn cứ:</span> dữ liệu <b>có</b> tín hiệu vượt nhiễu — ưu thế của số dẫn đầu là
           <b>${(M.edge*100).toFixed(3)}pp</b> so với sai số ±${(M.seOne*100).toFixed(3)}pp
           (z <b>${M.edgeRatio.toFixed(2)}</b> ≥ ${M.zCrit.toFixed(2)}), nên app lấy Top ${n} theo ước lượng đã trừ hao may rủi.
           Số dẫn đầu ước lượng <b>${pctS(rank[0].score,2)}</b> so với nền đúng kỳ tới ${pctS(M.pB,2)} — chênh
           <b>${((rank[0].score/M.pB-1)*100).toFixed(1)}%</b>. Hãy kiểm chứng bằng tab Backtest trước khi tin.`}
      <br><span style="color:var(--dim2)">Trọng số tin cậy${tip("w")} từng tín hiệu: ${wRows}</span>
      </div>
    </details>`;
  renderPinExcl();
}
window.setQuickN = k => { ST.quickN=k; renderQuick() };
window.setQScope = sc => { ST.scope=sc; refresh() };
window.setQDigits = dg => { ST.digits=dg; refresh() };
window.goToStats = () => showView("ana");

window.copyQuick = () => {
  const Ax=ST.digits===2?A2:A3, rank=ST.digits===2?RANK2:RANK3;
  const txt=quickPick(Ax,rank,ST.quickN).picks.join(", ");
  navigator.clipboard?.writeText(txt).then(()=>toast("Đã copy: "+txt),()=>toast(txt));
};


function renderPred(){
  const gb=$("#guideB");
  if(!localStorage.getItem("xs_guide_v1")){
    gb.innerHTML=`<div class="guide">
      <div class="guide-title"><span>Mới dùng lần đầu?</span><b>Đi từ dàn số đến dữ liệu trong 30 giây.</b></div>
      <div class="guide-steps">
        <span><b>1</b> Chọn dàn</span><i>→</i><span><b>2</b> Bấm số để soi</span><i>→</i><span><b>3</b> Kiểm chứng bằng backtest</span>
      </div>
      <button class="btn g" onclick="localStorage.setItem('xs_guide_v1','1');this.closest('.guide').remove()">Đã hiểu</button>
    </div>`;
  } else gb.innerHTML="";
  renderHero();
  renderQuick();
  predPanel($("#pred2"), A2, RANK2, "2");
  predPanel($("#pred3"), A3, RANK3, "3");

  const sig = A.pChi<0.05;
  const z=zBonf(A.U,0.05);
  const best=(ST.digits===2?RANK2:RANK3)[0];
  const [lo] = wilson(best.s?best.s.daysCnt:0, A.K, z);
  $("#honest").innerHTML=`
    <span class="tag">⚖️ ĐỌC CHO ĐÚNG.</span>
    Mỗi số 2 chữ số có xác suất nền <b>${pctS(A2.pBase,2)}</b> ra ít nhất 1 lần trong kỳ (${A2.perDay.toFixed(1)} bộ số/kỳ);
    số 3 chữ số là <b>${pctS(A3.pBase,2)}</b>.
    Bảng xếp hạng trên là <b>điểm thử nghiệm trên lịch sử</b> tổng hợp 5 tín hiệu, <b>không phải xác suất đã hiệu chuẩn</b>.
    <br>Kiểm định chi-square${tip("chi2")} trên mẫu ${A.K} kỳ (${A.digits} số): p = <b>${A.pChi<0.001?"<0.001":A.pChi.toFixed(3)}</b> —
    ${sig
      ? `dữ liệu <b>có lệch</b> khỏi phân phối đều ở mức ý nghĩa 5%. Vẫn nên kiểm chứng bằng tab Backtest trước khi tin.`
      : `<b>không có bằng chứng</b> dữ liệu lệch khỏi ngẫu nhiên. Nghĩa là "nóng/lạnh/gan" nhiều khả năng chỉ là dao động mẫu.`}
    <br>Sau hiệu chỉnh đa so sánh (Bonferroni, ${A.U} số), số dẫn đầu <b>${best.tail}</b> có cận dưới tần suất thật ${pctS(lo,2)}
    ${lo>A.pBase ? `— <b style="color:var(--ok)">cao hơn nền có ý nghĩa</b>.` : `— <b>chưa vượt mức nền</b>, tức chưa phân biệt được với may rủi.`}
    <br>👉 Hãy mở tab <b>🧪 Kiểm chứng</b> và bấm Backtest để xem công thức có thật sự hơn chọn bừa hay không.`;
}
window.setDan = n => { ST.danSize=n; renderPred() };
window.copyDan = dg => {
  const rank = dg===2?RANK2:RANK3;
  const txt = rank.slice(0,ST.danSize).map(r=>r.tail).join(", ");
  navigator.clipboard?.writeText(txt).then(()=>toast("Đã copy: "+txt), ()=>toast(txt));
};
/* ============================================================================
   VIEW: BẢNG SỐ
   ========================================================================== */
const HM_MODES=[
  {k:"freq", n:"Tần suất", d:"số kỳ đã ra, quy về độ lệch chuẩn so với trung bình"},
  {k:"gap",  n:"Gan hiện tại", d:"đang bao nhiêu kỳ chưa ra"},
  {k:"rec",  n:"Phong độ gần", d:"số kỳ đã ra trong 30 kỳ gần nhất"},
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
    ? "🌡️ Bản đồ nhiệt 00 – 99"
    : "🌡️ 120 bộ 3 số nổi bật nhất") + tip("heatmap");

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
    c.type="button"; c.setAttribute("aria-label",`Soi số ${t}`);
    c.style.background=col.bg; c.style.color=col.fg;
    c.title=`${t} — ra ${s?s.daysCnt:0}/${A.K} kỳ (${pctS(s?s.daysCnt/A.K:0)}) · ${s?s.occ:0} lần`+
            ` · gan ${s?s.curGap:A.K} · 30 kỳ gần ${s?s.recCnt:0}`+
            `\n${mode.n}: ${v} · hạng ${(tt*100).toFixed(0)}/100 · lệch z=${z>=0?"+":""}${z.toFixed(2)}σ`;
    c.onclick=()=>openNum(t,ST.digits);
    h.append(c);
  }

  const nOut=vals.filter(v=>Math.abs((v-mean)/sd)>=2).length;
  const expOut=Math.round(keys.length*0.0455);
  $("#hmLegend").innerHTML=`
    <div class="hmleg">
      <div class="hmbar" style="background:${heatGradientCss()}"></div>
      <div class="hmtick"><span>${mode.k==="gap"?"gan lâu nhất":"thấp nhất"}</span><span>giữa bảng</span><span>${mode.k==="gap"?"vừa ra gần đây":"cao nhất"}</span></div>
      <div class="hmnote">
        Màu theo <b>${mode.n}</b> — ${mode.d}. Màu trải theo <b>thứ hạng</b> giữa ${keys.length} ô để dễ phân biệt bằng mắt${tip("hangvsthuc")}.
        Chênh lệch thật: trung bình <b>${mean.toFixed(1)}</b> ± <b>${sd.toFixed(1)}</b>.
        Ô có <b>viền trắng</b> = lệch quá ±2σ${tip("sigma")}: <b>${nOut}</b> ô — ngẫu nhiên thuần tuý cũng tạo ra ~<b>${expOut}</b> ô như vậy.
        ${nOut<=expOut*1.6
          ? `<span style="color:var(--ok)">→ Mức bình thường, không có số nào "nóng thật".</span>`
          : `<span style="color:var(--warn)">→ Nhiều hơn kỳ vọng — xem thêm tab Kiểm chứng.</span>`}
      </div>
    </div>`;

  const z=zBonf(A.U,0.05);
  const rows=[...A.S.entries()];
  const hot=rows.slice().sort((a,b)=>b[1].daysCnt-a[1].daysCnt).slice(0,20);
  $("#tHot").innerHTML=
    `<thead><tr><th>Số</th><th>Kỳ ra</th><th>Tỉ lệ</th><th>KTC đồng thời${tip("ktc")}</th><th>Cuối</th></tr></thead><tbody>`+
    hot.map(([t,s])=>{
      const[lo,hi]=wilson(s.daysCnt,A.K,z);
      const sigp = lo>A.pBase;
      return `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="warm">${s.daysCnt}</td>
        <td>${pctS(s.daysCnt/A.K)}</td><td style="color:${sigp?"var(--ok)":"var(--dim)"}">${pctS(lo)}–${pctS(hi)}</td>
        <td>${fmtDS(s.last)}</td></tr>`;
    }).join("")+`</tbody>`;

  const all=[];
  for(let n=0;n<A.U;n++){ const t=pad(n,A.digits), s=A.S.get(t); all.push([t,s?s.daysCnt:0,s]) }
  const cold=all.slice().sort((a,b)=>a[1]-b[1]).slice(0,20);
  $("#tCold").innerHTML=
    `<thead><tr><th>Số</th><th>Kỳ ra</th><th>Tỉ lệ</th><th>Gan h.tại</th><th>Cuối</th></tr></thead><tbody>`+
    cold.map(([t,c,s])=>`<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="cold">${c}</td>
      <td>${pctS(c/A.K)}</td><td>${s?s.curGap:A.K}</td><td>${s&&s.last?fmtDS(s.last):"—"}</td></tr>`).join("")+`</tbody>`;

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
    rows.push({t, occ:s?s.occ:0, daysCnt:s?s.daysCnt:0, p:s?s.daysCnt/A.K:0,
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
  const cols=[["t","Số"],["occ","Lần"],["daysCnt","Kỳ ra"],["p","Tỉ lệ"],["lo","Tối thiểu chắc chắn"],
              ["curGap","Gan"],["maxGap","Nhịn lâu nhất"],["minGap","Về sát nhất"],["avgGap","Nhịp TB"],["last","Cuối"]];
  $("#tFull").innerHTML=
    `<thead><tr>`+cols.map(([k,l])=>`<th onclick="setSort('${k}')">${l}${SORT.key===k?` <span style="font-size:9px">${SORT.dir<0?"▼":"▲"}</span>`:""}</th>`).join("")+`</tr></thead><tbody>`+
    rows.map(r=>`<tr onclick="openNum('${r.t}',${A.digits})"><td class="n">${r.t}</td><td>${r.occ}</td><td>${r.daysCnt}</td>
      <td>${pctS(r.p)}</td><td style="color:${r.lo>A.pBase?"var(--ok)":"var(--dim)"}">${pctS(r.lo)}</td>
      <td>${r.curGap}</td><td>${r.maxGap}</td><td>${r.minGap==null?"—":r.minGap}</td>
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
    `<thead><tr><th>Số</th><th>Gan h.tại${tip("ganht")}</th><th>Kỷ lục nhịn${tip("longest")}</th><th>% kỷ lục${tip("klucpct")}</th><th>Khả năng ra kỳ sau${tip("hazard")}</th><th>Cuối</th></tr></thead><tbody>`+
    all.slice().sort((a,b)=>b.cur-a.cur).slice(0,25).map(({t,s,cur})=>{
      const mg=s?s.maxGap:A.K;
      const rel=mg?cur/mg:1;
      const ok=A.hazard.predictiveReliable(cur);
      return `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="cold">${cur}</td>
        <td>${mg}</td><td style="color:${rel>=1?"var(--gold)":"var(--dim)"}">${(rel*100).toFixed(0)}%</td>
        <td>${ok?pctS(A.hazard.predictiveAt(cur)):`<span style="color:var(--dim2)">≈${pctS(A.pBase)} ¹</span>`}</td>
        <td>${s&&s.last?fmtDS(s.last):"—"}</td></tr>`;
    }).join("")+
    `</tbody><tfoot><tr><td colspan="6" style="color:var(--dim2);font-size:10.5px;border:0">¹ gap &gt;25 hoặc còn &lt;200 quan sát → không ngoại suy, dùng mức nền</td></tr></tfoot>`;

  const withGaps=[...A.S.entries()].filter(([,s])=>s.gaps.length>=2);
  $("#tMaxGap").innerHTML=
    `<thead><tr><th>Số</th><th>Nhịn lâu nhất${tip("longest")}</th><th>Gan h.tại</th><th>Kỳ ra</th><th>Mấy kỳ về 1 lần${tip("tbgap")}</th></tr></thead><tbody>`+
    withGaps.slice().sort((a,b)=>b[1].maxGap-a[1].maxGap).slice(0,25).map(([t,s])=>
      `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="cold">${s.maxGap}</td>
       <td>${s.curGap}</td><td>${s.daysCnt}</td><td>${s.avgGap!=null?s.avgGap.toFixed(1):"—"}</td></tr>`).join("")+`</tbody>`;

  $("#tMinGap").innerHTML=
    `<thead><tr><th>Số</th><th>TB gap</th><th>Về sát nhau nhất${tip("shortest")}</th><th>Nhịn lâu nhất</th><th>Kỳ ra</th></tr></thead><tbody>`+
    withGaps.slice().sort((a,b)=>a[1].avgGap-b[1].avgGap).slice(0,25).map(([t,s])=>
      `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="good">${s.avgGap.toFixed(2)}</td>
       <td>${s.minGap}</td><td>${s.maxGap}</td><td>${s.daysCnt}</td></tr>`).join("")+`</tbody>`;

  const rhythm=withGaps.filter(([,s])=>s.cv!=null && s.gaps.length>=5);
  $("#tRhythm").innerHTML=
    `<thead><tr><th>Số</th><th>Độ đều (CV)${tip("cv")}</th><th>TB gap</th><th>Gan h.tại</th><th>So nhịp cũ${tip("duehan")}</th></tr></thead><tbody>`+
    (rhythm.length
      ? rhythm.sort((a,b)=>a[1].cv-b[1].cv).slice(0,25).map(([t,s])=>{
          const due=s.avgGap>0 ? s.curGap/s.avgGap : 0;
          return `<tr onclick="openNum('${t}',${A.digits})"><td class="n">${t}</td><td class="good">${s.cv.toFixed(2)}</td>
            <td>${s.avgGap.toFixed(1)}</td><td>${s.curGap}</td>
            <td style="color:${due>=1?"var(--gold)":"var(--dim)"}">${(due*100).toFixed(0)}%</td></tr>`;
        }).join("")
      : `<tr><td colspan="5" class="empty">Cần mẫu lớn hơn (≥5 lần ra/số)</td></tr>`)+`</tbody>`;

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
      `<div class="b ${ok?"":"dim"}" title="gan ${g}: ${ok?pctS(v)+" ("+r+" quan sát)":"chỉ "+r+" quan sát — không đủ tin cậy"}">
        <i style="height:${v==null?4:Math.max(3,v/mx*100)}%"></i></div>`).join("")+`</div>`+
    `<div class="hzx">`+vals.map(({g})=>`<span>${g%5===0?g:""}</span>`).join("")+`</div>`;
  $("#hzNote").innerHTML=
    `Đường ngang tại <b>${pctS(A.pBase,2)}</b> là mức nền nếu xổ số hoàn toàn ngẫu nhiên (không có trí nhớ).
     Cột xám = chưa đủ 40 quan sát nên không đáng tin.
     <br><b>Cách đọc đúng:</b> nếu các cột dao động quanh mức nền mà không có xu hướng tăng theo độ gan, thì
     <b>"gan lâu sắp nổ" là niềm tin sai</b> — xác suất không tăng theo thời gian chờ.`;
}

/* ============================================================================
   VIEW: CẦU & MẪU
   ========================================================================== */
function renderPattern(){
  $("#carrySub").innerHTML=
    `Toàn cục: về kỳ trước → <b style="color:var(--txt)">${pctS(A.pCarry)}</b> ra tiếp ·
     không về kỳ trước → <b style="color:var(--txt)">${pctS(A.pFresh)}</b> ·
     nền <b style="color:var(--txt)">${pctS(A.pBase)}</b>`;
  const K=A.K;
  if(K>0){
    const prev=[...A.daySets[K-1]];
    const rows=prev.map(t=>{
      const s=A.S.get(t);
      const own = s.carryBase>=8 ? s.carryHit/s.carryBase : null;
      const sc = scoreOf(A,t,NEXT.w);
      return {t, own, base:s.carryBase, score:sc.score, lift:sc.lift};
    }).sort((a,b)=>b.score-a.score).slice(0,20);
    $("#tCarry").innerHTML=
      `<thead><tr><th>Số về kỳ trước</th><th>Tỉ lệ rơi riêng${tip("carry")}</th><th>Mẫu</th><th>Điểm thử nghiệm${tip("score")}</th></tr></thead><tbody>`+
      rows.map(r=>`<tr onclick="openNum('${r.t}',${A.digits})"><td class="n">${r.t}</td>
        <td>${r.own==null?"—":pctS(r.own)}</td><td style="color:var(--dim2)">${r.base}</td>
        <td class="good">${pctS(r.score)} <span style="color:var(--dim);font-size:11px">×${r.lift.toFixed(2)}</span></td></tr>`).join("")+`</tbody>`;
  }

  const nD=A.dowTotals[NEXT.w]||0;
  $("#dowSub").innerHTML=`Kỳ tới là <b style="color:var(--txt)">${DOW_VN[NEXT.w]}</b> — trong mẫu có ${nD} kỳ cùng thứ`;
  const z=zBonf(A.U,0.05);
  const dowRows=[];
  for(const[t,s]of A.S){
    if(!s.dow[NEXT.w]) continue;
    const[lo]=wilson(s.dow[NEXT.w], nD, 1.96);
    dowRows.push({t, k:s.dow[NEXT.w], p:nD?s.dow[NEXT.w]/nD:0, lo, all:s.daysCnt/A.K});
  }
  dowRows.sort((a,b)=>b.p-a.p||b.k-a.k);
  $("#tDow").innerHTML=
    `<thead><tr><th>Số</th><th>Ra ${DOW_S[NEXT.w]}</th><th>Tỉ lệ</th><th>So toàn mẫu</th></tr></thead><tbody>`+
    (nD>=6
      ? dowRows.slice(0,20).map(r=>`<tr onclick="openNum('${r.t}',${A.digits})"><td class="n">${r.t}</td>
          <td>${r.k}/${nD}</td><td class="warm">${pctS(r.p)}</td>
          <td style="color:var(--dim)">${pctS(r.all)} <span style="color:${r.p>r.all?"var(--ok)":"var(--dim2)"}">×${r.all?(r.p/r.all).toFixed(2):"—"}</span></td></tr>`).join("")
      : `<tr><td colspan="4" class="empty">Cần ít nhất 6 kỳ cùng thứ trong mẫu</td></tr>`)+`</tbody>`;

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

/* ============================================================================
   VIEW: NHẬT KÝ DỰ ĐOÁN
   Lưu trong localStorage. Mỗi bộ số ghi lại CẢ dàn của người dùng lẫn dàn app
   gợi ý TẠI THỜI ĐIỂM ĐÓ, để sau này so kè công bằng.
   ========================================================================== */
const JKEY="xs_journal_v1";
const JST={region:"MN", digits:2, scope:"all"};
/** Nhãn ngắn cho phạm vi giải — dùng cả ở form lẫn bảng lịch sử */
const scopeLabel=(reg,sc)=> sc==="dd" ? (reg==="MB"?"G7 + GĐB":"G8 + GĐB") : "Tất cả giải";

function jLoad(){ try{ return JSON.parse(localStorage.getItem(JKEY))||[] }catch(e){ return [] } }
function jStore(l){ try{ localStorage.setItem(JKEY, JSON.stringify(l)) }catch(e){ toast("Không lưu được — bộ nhớ trình duyệt đầy") } }

/** Toàn bộ kỳ của một miền, đã lọc đài (mảng tên đài hoặc null) */
function daysOf(region, provsArr){
  const src=DB[region].days;
  if(region==="MN" && provsArr && provsArr.length){
    const s=new Set(provsArr);
    return src.map(d=>({d:d.d,w:d.w,draws:d.draws.filter(x=>s.has(x.p))})).filter(d=>d.draws.length);
  }
  return src;
}
/** Dàn của app cho một ngày, tính CHỈ từ dữ liệu TRƯỚC ngày đó (không rò rỉ tương lai). */
function appPicksFor(date, region, scope, digits, provsArr, n){
  const src=daysOf(region, provsArr);
  let i=0; while(i<src.length && src[i].d < date) i++;
  const hist=src.slice(0,i);
  if(hist.length<60) return null;
  const Ax=analyze(hist, region, scope, digits);
  const tgt=src[i] && src[i].d===date ? src[i] : null;
  const rank=rankAll(Ax, tgt?tgt.w:dowOf(date));
  if(rank.model.actionable) return rank.slice(0,n).map(r=>r.tail);
  const seed=`${date}|${region}|${digits}|${scope}|${provsArr?[...provsArr].sort().join(","):"all"}`;
  return unbiasedPick(Ax.U,digits,n,seed);
}
/** Chấm một bộ số với kết quả thật (nếu đã có) */
function jResolve(e){
  const src=daysOf(e.region, e.provs);
  const day=src.find(d=>d.d===e.date);
  if(!day) return {pending:true};
  const act=new Set(tailsOfDay(day, e.region, e.scope||"all", e.digits, false));
  const U=Math.pow(10,e.digits);
  const app=e.appPicks||[];
  return {
    pending:false, act,
    uHit:e.picks.filter(t=>act.has(t)).length,
    aHit:app.filter(t=>act.has(t)).length,
    uExp:e.picks.length*act.size/U,
    aExp:app.length*act.size/U,
    isHas:t=>act.has(t)
  };
}

function renderJournal(){
  // form
  const jr=$("#jRegion"); jr.innerHTML="";
  for(const r of ["MB","MN"]) jr.append(mkChip(r==="MB"?"XSMB":"XSMN", JST.region===r, ()=>{JST.region=r;renderJournal()}));
  const jd=$("#jDigits"); jd.innerHTML="";
  for(const d of [2,3]) jd.append(mkChip(d+" số", JST.digits===d, ()=>{JST.digits=d;renderJournal()}));
  const js=$("#jScope"); js.innerHTML="";
  for(const sc of ["all","dd"])
    js.append(mkChip(scopeLabel(JST.region,sc), JST.scope===sc, ()=>{JST.scope=sc;renderJournal()}));
  const di=$("#jDate");
  if(!di.value){
    const src=DB[JST.region].days;
    di.value = src.length ? addDays(src[src.length-1].d,1) : "";
  }
  const src=DB[JST.region].days;
  if(src.length){ di.min=src[0].d; di.max=addDays(src[src.length-1].d,7) }

  // Mức nền của đúng kiểu bộ số đang chọn — để người dùng biết mình đang theo dõi cái gì
  try{
    const dw = di.value ? dowOf(di.value) : NEXT.w;
    const Aj = analyze(daysOf(JST.region,null).slice(-1500), JST.region, JST.scope, JST.digits);
    const pb = Aj.pBaseFor(dw);
    const nPick = parsePicks($("#jPicks").value, JST.digits).length;
    $("#jBase").innerHTML =
      `Kiểu bộ số đang chọn: <b>${JST.region} · ${scopeLabel(JST.region,JST.scope)} · ${JST.digits} số</b> →
       mỗi kỳ quay ra <b>${Aj.perDayFor(dw).toFixed(0)}</b> bộ số, nên mỗi con có
       <b style="color:var(--gold)">${pctS(pb,2)}</b> khả năng về${tip("nen")}.` +
      (nPick ? ` Chọn <b>${nPick}</b> số → xác suất nền có ≥1: <b style="color:var(--ok)">${pctS(Aj.baseSetProb(nPick,dw))}</b>${tip("dan")}` : "");
  }catch(e){ $("#jBase").innerHTML="" }

  // thống kê
  const list=jLoad();
  const done=[], wait=[];
  let uH=0,uE=0,uN=0, uAny=0;
  for(const e of list){
    const r=jResolve(e);
    (r.pending?wait:done).push([e,r]);
    if(!r.pending){
      uH+=r.uHit; uE+=r.uExp; uN+=e.picks.length; if(r.uHit>0) uAny++;
    }
  }
  const n=done.length;
  const pctOf=(h,e)=> e>0 ? ((h/e-1)*100) : 0;
  const cls=v=> v>=3?"up":v<=-3?"dn":"";
  $("#jStats").innerHTML = !n
    ? `<div class="empty">Chưa có bộ số nào được chấm.${wait.length?` Đang chờ kết quả ${wait.length} bộ số.`:" Ghi bộ số đầu tiên ở ô bên dưới."}</div>`
    : `<div class="vs">
        <div class="b me">Trúng trung bình / kỳ<b>${(uH/n).toFixed(2)}</b>chọn bừa được ${(uE/n).toFixed(2)}</div>
        <div class="b app">Hơn/kém chọn bừa<b class="${cls(pctOf(uH,uE))}">${pctOf(uH,uE)>=0?"+":""}${pctOf(uH,uE).toFixed(1)}%</b>${tip("uplift")}${Math.abs(pctOf(uH,uE))<10?"trong biên độ may rủi":""}</div>
        <div class="b">Kỳ trúng ít nhất 1 số<b>${pctS(uAny/n)}</b>${uAny}/${n} kỳ</div>
        <div class="b">Tổng đã lưu<b>${uN} số</b>qua ${n} kỳ đã chốt${wait.length?` · ${wait.length} chờ`:""}</div>
      </div>
      <div style="margin-top:14px;padding:11px 14px;border-radius:10px;background:var(--card2);font-size:12.5px;color:var(--dim);line-height:1.7">
        ${n<30
          ? `<b style="color:var(--warn)">Mới ${n} kỳ — chưa kết luận được gì.</b> Cần ít nhất <b>30–60 kỳ</b> thì con số mới đủ ổn định.
             Ở mẫu nhỏ, chênh lệch ±40% xảy ra thường xuyên chỉ do may rủi.`
          : `Đã đủ <b>${n} kỳ</b> để tham khảo. Cột "ngẫu nhiên" là số trúng kỳ vọng nếu bạn chọn bừa đúng ngần ấy số —
             muốn nói mình có tay, phải vượt cột đó một cách <b>ổn định</b> chứ không phải vài kỳ.`}
      </div>`;

  // bảng lịch sử
  const rows=[...wait.reverse(), ...done.reverse()];
  $("#jTbl").innerHTML = !list.length
    ? `<tbody><tr><td class="empty">Chưa có bộ số nào.<br>Sang tab <b>🎯 Bộ số hôm nay</b> rồi bấm <b>✅ Lưu bộ số</b> — chỉ một cú bấm.</td></tr></tbody>`
    : `<thead><tr><th>Ngày</th><th>Kiểu bộ số</th><th class="jcell">Bộ số đã lưu</th><th>Kết quả</th><th></th></tr></thead><tbody>`+
      rows.map(([e,r])=>{
        const chip=(t,hit)=>`<span class="pk ${r.pending?"w":(hit?"y":"n")}" onclick="openNum('${t}',${e.digits})">${t}</span>`;
        return `<tr style="cursor:default">
          <td style="white-space:nowrap">${fmtD(e.date)}<br><span style="color:var(--dim2);font-size:10.5px">${DOW_S[dowOf(e.date)]}</span></td>
          <td style="white-space:nowrap">${e.region} · ${e.digits} số<br><span style="color:var(--dim2);font-size:10px">${scopeLabel(e.region,e.scope||"all")}${e.provs&&e.provs.length?"<br>"+e.provs.join(", ").slice(0,18):""}</span></td>
          <td class="jcell">${e.picks.map(t=>chip(t, !r.pending&&r.isHas(t))).join("")}
            ${e.note?`<div style="color:var(--dim2);font-size:10.5px;margin-top:3px">${e.note.replace(/[<>&]/g,"")}</div>`:""}</td>
          <td style="white-space:nowrap">${r.pending
              ? `<span style="color:var(--warn)">chờ KQ</span>`
              : `<b class="${r.uHit?"good":""}" style="font-size:15px">${r.uHit}</b>/${e.picks.length} trúng<br>
                 <span style="color:var(--dim2);font-size:10.5px">chọn bừa: ${r.uExp.toFixed(2)}</span>`}</td>
          <td><span class="jdel" onclick="jDel('${e.id}')" title="Xoá bộ số">✕</span></td></tr>`;
      }).join("")+`</tbody>`;
}

window.jDel = id => {
  const l=jLoad().filter(e=>e.id!==id);
  jStore(l); renderJournal(); toast("Đã xoá bộ số");
};
function parsePicks(s, digits){
  const out=[], seen=new Set();
  for(const m of (s.match(/\d+/g)||[])){
    if(m.length!==digits) continue;
    if(!seen.has(m)){ seen.add(m); out.push(m) }
  }
  return out;
}
function jAddEntry(){
  const date=$("#jDate").value;
  const picks=parsePicks($("#jPicks").value, JST.digits);
  const msg=$("#jMsg");
  if(!date){ msg.innerHTML=`<span style="color:var(--hot)">Chọn ngày quay đã.</span>`; return }
  if(!picks.length){ msg.innerHTML=`<span style="color:var(--hot)">Nhập ít nhất 1 số ${JST.digits} chữ số (vd: ${JST.digits===2?"88 40 22":"888 400 222"}).</span>`; return }
  const provs = (JST.region==="MN" && ST.region==="MN" && ST.provs && ST.provs.size) ? [...ST.provs] : null;
  const appPicks = appPicksFor(date, JST.region, JST.scope, JST.digits, provs, picks.length) || [];
  const l=jLoad();
  l.push({id:String(Date.now())+Math.random().toString(36).slice(2,6),
          date, region:JST.region, digits:JST.digits, scope:JST.scope, provs,
          picks, appPicks, note:$("#jNote").value.trim().slice(0,60)});
  jStore(l);
  $("#jPicks").value=""; $("#jNote").value="";
  msg.innerHTML=`<span style="color:var(--ok)">✓ Đã lưu ${picks.length} số cho ${fmtD(date)} ·
    ${JST.region} · ${scopeLabel(JST.region,JST.scope)}${appPicks.length?` — kèm ${appPicks.length} số app chọn cùng điều kiện để so kè`:""}.</span>`;
  renderJournal();
}
function jFillFromApp(){
  const date=$("#jDate").value;
  if(!date){ $("#jMsg").innerHTML=`<span style="color:var(--hot)">Chọn ngày quay đã.</span>`; return }
  const provs = (JST.region==="MN" && ST.region==="MN" && ST.provs && ST.provs.size) ? [...ST.provs] : null;
  const p=appPicksFor(date, JST.region, JST.scope, JST.digits, provs, 10);
  if(!p){ $("#jMsg").innerHTML=`<span style="color:var(--hot)">Không đủ dữ liệu trước ngày đó.</span>`; return }
  $("#jPicks").value=p.join(" ");
  $("#jMsg").innerHTML=`<span style="color:var(--dim)">Đã điền 10 số máy chọn đều (${scopeLabel(JST.region,JST.scope)}). Bộ số tái lập theo ngày; bạn có thể sửa trước khi lưu.</span>`;
}
function jExport(){
  const blob=new Blob([JSON.stringify(jLoad(),null,1)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="nhat-ky-soi-cau.json";
  a.click(); URL.revokeObjectURL(a.href);
  toast("Đã xuất file nhật ký");
}
function jImportFile(f){
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const inc=JSON.parse(rd.result);
      if(!Array.isArray(inc)) throw new Error("sai định dạng");
      const l=jLoad(), have=new Set(l.map(e=>e.id));
      let add=0;
      for(const e of inc) if(e && e.id && e.date && Array.isArray(e.picks) && !have.has(e.id)){ l.push(e); add++ }
      jStore(l); renderJournal(); toast(`Đã nhập thêm ${add} bộ số`);
    }catch(err){ toast("File không hợp lệ") }
  };
  rd.readAsText(f);
}

/* ============================================================================
   VIEW: KIỂM CHỨNG
   ========================================================================== */
function renderVerify(){
  const bd=$("#btDays"); bd.innerHTML="";
  for(const n of [100,300,600,1000,2000]){
    bd.append(mkChip(String(n), ST.btDays===n, ()=>{ST.btDays=n;renderVerify()}, n>A.K-60));
  }
  const bw=$("#btWin"); bw.innerHTML="";
  for(const n of [90,180,365,730,1500]){
    bw.append(mkChip(String(n), ST.btWin===n, ()=>{ST.btWin=n;renderVerify()}, n>A.K-60));
  }
  const sig=A.pChi<0.05;
  $("#chiOut").innerHTML=`
    <div class="stats3">
      <div class="b">Thống kê χ²${tip("chi2")}<b>${A.chi2.toFixed(1)}</b>bậc tự do ${A.df}</div>
      <div class="b">Giá trị p<b class="${sig?"dn":"up"}">${A.pChi<0.001?"<0.001":A.pChi.toFixed(4)}</b>${sig?"lệch có ý nghĩa":"phù hợp ngẫu nhiên"}</div>
      <div class="b">Tổng lần ra<b>${A.totalOcc.toLocaleString("vi")}</b>trên ${A.K} kỳ · ${A.U} số</div>
      <div class="b">Kỳ vọng mỗi số<b>${(A.totalOcc/A.U).toFixed(1)}</b>lần nếu hoàn toàn đều</div>
    </div>
    <div style="color:var(--dim);font-size:12.5px;margin-top:14px;line-height:1.7">
      ${sig
        ? `<b style="color:var(--warn)">p &lt; 0.05:</b> tần suất các số lệch khỏi phân phối đều nhiều hơn mức ngẫu nhiên thường tạo ra.
           Nguyên nhân có thể là dữ liệu thật sự lệch, <b>hoặc</b> do mẫu gộp nhiều đài/nhiều thời kỳ có cấu trúc giải khác nhau. Hãy thử lọc 1 đài duy nhất rồi kiểm lại.`
        : `<b style="color:var(--ok)">p ≥ 0.05:</b> không có bằng chứng thống kê nào cho thấy số nào "dễ ra hơn" số nào.
           Đây là kết quả bình thường và đúng như kỳ vọng với xổ số công bằng — mọi chênh lệch nóng/lạnh bạn thấy đều nằm trong biên độ may rủi.`}
    </div>`;

}

let btBusy=false;
/** Backtest chạy theo lô để không treo giao diện, có thanh tiến trình. */
function runBacktest(){
  if(btBusy) return;
  const sl=slicedDays();
  const F=sl.F.slice(0,sl.end);
  const dg=A.digits, U=A.U, N=ST.danSize;
  // Cửa sổ trượt bị giới hạn để mỗi bước mô phỏng đủ nhanh.
  const W=Math.min(A.K, ST.btWin);
  const B=Math.min(ST.btDays, Math.max(0, F.length-W-1));
  if(B<20){ $("#btOut").innerHTML=`<div class="empty">Không đủ dữ liệu — cần thêm lịch sử hoặc giảm cửa sổ mẫu.</div>`; return }

  btBusy=true; $("#btRun").disabled=true; $("#btRun").textContent="⏳ Đang chạy…";

  const start=F.length-B;
  // Đối chứng "trong mẫu": chấm cùng bảng xếp hạng lên một ngày NẰM TRONG cửa sổ huấn luyện,
  // cách đúng bội số 7 để giữ nguyên thứ trong tuần. Chênh lệch giữa 2 cột chính là mức overfit.
  const IN_SHIFT = 7*Math.max(1, Math.floor(W/21));
  const acc={sumHit:0,sumBase:0,top1:0,top1Base:0,top1Var:0,
    top3:0,top3Base:0,topN:0,topNBase:0,days:0,
    inTop1:0,inHit:0,inBase:0,inDays:0};
  let j=start;
  const t0=performance.now();

  const paint=frac=>{
    $("#btOut").innerHTML=
      `<div style="color:var(--dim);font-size:12.5px;margin-bottom:8px">Đang mô phỏng ${B} kỳ · cửa sổ trượt ${W} kỳ…</div>
       <div style="height:8px;background:var(--card2);border-radius:5px;overflow:hidden">
         <i style="display:block;height:100%;width:${(frac*100).toFixed(1)}%;background:var(--acc);border-radius:5px;transition:width .2s"></i></div>
       <div style="color:var(--dim2);font-size:11.5px;margin-top:6px">${acc.days}/${B} kỳ</div>`;
  };
  paint(0);

  const step=()=>{
    const deadline=performance.now()+110;   // mỗi lô ~110ms rồi nhả luồng
    while(j<F.length && performance.now()<deadline){
      const ws=Math.max(0,j-W);
      const Ax=analyze(F.slice(ws,j), ST.region, ST.scope, dg);
      if(Ax.K>=20){
        const rank=rankAll(Ax, F[j].w);
        const actual=new Set(tailsOfDay(F[j],ST.region,ST.scope,dg,false));
        let h=0; for(let i=0;i<N;i++) if(actual.has(rank[i].tail)) h++;
        acc.sumHit+=h;
        acc.sumBase+=N*actual.size/U;
        if(actual.has(rank[0].tail)) acc.top1++;
        if(rank.slice(0,3).some(r=>actual.has(r.tail))) acc.top3++;
        if(h>0) acc.topN++;
        const p1=Ax.pBaseFor(F[j].w);
        acc.top1Base+=p1;
        acc.top1Var+=p1*(1-p1);
        acc.top3Base+=Ax.baseSetProb(3,F[j].w);
        acc.topNBase+=Ax.baseSetProb(N,F[j].w);
        acc.days++;
        // đối chứng trong mẫu
        const ij=j-IN_SHIFT;
        if(ij>=ws){
          const inAct=new Set(tailsOfDay(F[ij],ST.region,ST.scope,dg,false));
          let ih=0; for(let i=0;i<N;i++) if(inAct.has(rank[i].tail)) ih++;
          acc.inHit+=ih; acc.inBase+=N*inAct.size/U;
          if(inAct.has(rank[0].tail)) acc.inTop1++;
          acc.inDays++;
        }
      }
      j++;
    }
    if(j<F.length){ paint((j-start)/B); setTimeout(step,0); return }
    finish();
  };

  const finish=()=>{
    btBusy=false; $("#btRun").disabled=false; $("#btRun").textContent="▶ Chạy backtest";
    const d=acc.days;
    if(!d){ $("#btOut").innerHTML=`<div class="empty">Không mô phỏng được kỳ nào.</div>`; return }
    const avgHit=acc.sumHit/d, avgBase=acc.sumBase/d;
    const upl=avgBase? (avgHit/avgBase-1)*100 : 0;
    const zT1=acc.top1Var>0 ? (acc.top1-acc.top1Base)/Math.sqrt(acc.top1Var) : 0;
    const pT1=1-normCdf(zT1);
    const cls=upl>=2?"up":upl<=-2?"dn":"";
    const secs=((performance.now()-t0)/1000).toFixed(1);
    const inUpl=acc.inDays&&acc.inBase ? (acc.inHit/acc.inBase-1)*100 : null;
    const inTop1=acc.inDays ? acc.inTop1/acc.inDays : null;
    const small=d<200;
    $("#btOut").innerHTML=`
      <div style="color:var(--dim);font-size:12.5px">Đã kiểm tra bảng xếp hạng thử nghiệm trên <b style="color:var(--txt)">${d}</b> kỳ ·
        cửa sổ trượt ${W} kỳ · dàn ${N} số · ${dg} số đuôi · ${ST.region} · ${secs}s</div>
      <div class="stats3">
        <div class="b">Trúng TB / kỳ<b>${avgHit.toFixed(2)}</b>chọn bừa: ${avgBase.toFixed(2)}</div>
        <div class="b">Uplift so chọn bừa<b class="${cls}">${upl>=0?"+":""}${upl.toFixed(1)}%</b>${Math.abs(upl)<3?"≈ ngang nhau":upl>0?"nhỉnh hơn":"kém hơn"}</div>
        <div class="b">Kỳ có ≥1 số trúng<b>${pctS(acc.topN/d)}</b>nền ${pctS(acc.topNBase/d)}</div>
        <div class="b">Số #1 trúng<b>${pctS(acc.top1/d)}</b>nền ${pctS(acc.top1Base/d)} · p=${pT1<0.001?"<0.001":pT1.toFixed(3)}</div>
        <div class="b">Top 3 có số trúng<b>${pctS(acc.top3/d)}</b>nền ${pctS(acc.top3Base/d)}</div>
      </div>

      ${inUpl===null?"":`
      <div class="mh" style="margin-top:18px">Đối chứng: chấm điểm trong mẫu vs ngoài mẫu${tip("bttest")}</div>
      <div class="tw"><table><thead><tr><th>Cách chấm</th><th>Trúng TB/kỳ</th><th>Uplift</th><th>Số #1 trúng</th></tr></thead><tbody>
        <tr style="cursor:default"><td>🔒 <b>Ngoài mẫu</b> (ngày chưa từng thấy) — <i>thước đo thật</i></td>
          <td>${avgHit.toFixed(2)}</td><td class="${cls}">${upl>=0?"+":""}${upl.toFixed(1)}%</td><td>${pctS(acc.top1/d)}</td></tr>
        <tr style="cursor:default"><td>👀 Trong mẫu (ngày đã nằm trong dữ liệu huấn luyện)</td>
          <td>${(acc.inHit/acc.inDays).toFixed(2)}</td><td class="up">+${inUpl.toFixed(1)}%</td><td>${pctS(inTop1)}</td></tr>
      </tbody></table></div>
      <div style="font-size:11.5px;color:var(--dim2);margin-top:6px">
        Dòng "trong mẫu" luôn đẹp hơn vì mô hình đã <i>nhìn thấy</i> ngày đó. Chênh lệch giữa 2 dòng chính là mức
        <b>overfit</b> — lý do mọi phương pháp dự đoán theo mẫu quá khứ "kiểm tra lại quá khứ thấy đúng" đều sụp đổ khi áp dụng cho ngày mai.
      </div>`}

      <div style="margin-top:14px;padding:12px 15px;border-radius:10px;background:var(--card2);font-size:12.5px;color:var(--dim);line-height:1.7">
        ${small?`<b style="color:var(--warn)">⚠ Mẫu nhỏ (${d} kỳ).</b> Với dưới 200 kỳ, kết quả dao động rất mạnh —
           cùng một công thức có thể cho +50% hoặc −30% chỉ do may rủi. Hãy chọn 300–1000 kỳ rồi chạy lại.<br>`:""}
        ${pT1<0.01 && upl>0
          ? `<b style="color:var(--warn)">Cờ nghiên cứu, chưa phải khuyến nghị.</b> Số #1 cao hơn nền ở đúng phép chạy này (p=${pT1.toFixed(3)}),
             nhưng chưa qua kiểm chứng lặp lại trên nhiều cửa sổ ngoài mẫu đã định trước. App vẫn chọn đều cho kỳ tới.`
          : `<b style="color:var(--warn)">Không có tín hiệu vượt trội.</b> Kết quả nằm trong biên độ may rủi (p=${pT1<0.001?"<0.001":pT1.toFixed(3)}).
             Đây là kết quả <b>đúng như kỳ vọng</b> với xổ số công bằng. Ý nghĩa thực tế: app giúp bạn
             <b>chọn số có hệ thống, có kỷ luật và biết rõ mình đang lựa chọn cái gì</b> — chứ không làm tăng xác suất thắng.`}
      </div>`;
  };
  setTimeout(step,30);
}

/* ============================================================================
   VIEW: 2 MIỀN — XSMN quay trước, XSMB quay sau cùng ngày
   ========================================================================== */
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
      <span style="margin-left:auto;font-size:12px;color:${mnToday?"var(--ok)":"var(--dim)"}">
        ${mnToday?"✓ đã có kết quả "+fmtD(today):"chưa quay / chưa có dữ liệu"}</span></div>`;
  if(mnToday){
    const ts=[...new Set(tailsOfDay(mnToday,"MN","all",dg,false))].sort();
    html+=`<div style="font-size:12px;color:var(--dim);margin-bottom:8px">
      ${mnToday.draws.map(x=>x.p).join(" · ")} — <b style="color:var(--txt)">${ts.length}</b> số ${dg} chữ số riêng biệt:</div>
      <div class="tags">${ts.map(t=>`<button type="button" class="tag clk" onclick="openNum('${t}',${dg})">${t}</button>`).join("")}</div>`;
  } else html+=`<div class="empty" style="padding:14px">Chưa có kết quả hôm nay</div>`;
  html+=`</div>`;
  // XSMB
  html+=`<div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span class="badge b3">XSMB</span><b>18:15</b>
      <span style="margin-left:auto;font-size:12px;color:${mbToday?"var(--ok)":"var(--gold)"}">
        ${mbToday?"✓ đã có kết quả "+fmtD(today)
          :(toMB>0?`còn ${Math.floor(toMB/60)}:${pad(toMB%60,2)} nữa quay`:"chưa có dữ liệu")}</span></div>`;
  if(mbToday){
    const ts=[...new Set(tailsOfDay(mbToday,"MB","all",dg,false))].sort();
    const mnSet = mnToday ? new Set(tailsOfDay(mnToday,"MN","all",dg,false)) : null;
    html+=`<div style="font-size:12px;color:var(--dim);margin-bottom:8px">
      <b style="color:var(--txt)">${ts.length}</b> số riêng biệt${mnSet?` — <span style="color:var(--ok)">xanh</span> = trùng với XSMN chiều`:""}:</div>
      <div class="tags">${ts.map(t=>`<button type="button" class="tag clk" ${mnSet&&mnSet.has(t)?'style="color:var(--ok);border-color:rgba(56,217,150,.4)"':""} onclick="openNum('${t}',${dg})">${t}</button>`).join("")}</div>`;
    if(mnSet){
      let ov=0; for(const t of ts) if(mnSet.has(t)) ov++;
      html+=`<div style="font-size:12px;color:var(--dim);margin-top:10px">Trùng <b style="color:var(--txt)">${ov}</b> số với XSMN chiều nay.</div>`;
    }
  } else if(mnToday){
    html+=`<div style="background:var(--card2);border-radius:10px;padding:12px 14px;font-size:12.5px;color:var(--dim);line-height:1.75">
      ⏳ <b style="color:var(--txt)">XSMB chưa quay.</b> Bạn đang biết trước toàn bộ kết quả XSMN chiều nay.
      Câu hỏi tự nhiên: có nên đánh lại chính những số đó ở XSMB không?
      <br>→ Xem phép đo ngay bên dưới.</div>`;
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
    <div style="font-size:12.5px;color:var(--dim);margin-bottom:12px">
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
    <div style="font-size:11.5px;color:var(--dim2);margin-top:10px">
      Gộp hai miền chỉ làm mẫu to hơn, <b>không</b> tạo ra tín hiệu mới — vì hai miền đã được đo là độc lập (bảng trên).
      Cột cận dưới xanh mới đáng gọi là "cao hơn nền thật".</div>`;
}

function paintCrossTest(C){
  const box=$("#crossTest");
  if(!C){ box.innerHTML=`<div class="empty">Không đủ dữ liệu chung hai miền.</div>`; return }
  const sig1=Math.abs(C.t1.z)>1.96;
  const sigShift=Math.abs(C.shift.z)>C.shift.zCrit;
  const anySig=sig1||sigShift;
  box.innerHTML=`
    <div style="font-size:12.5px;color:var(--dim);margin-bottom:12px">
      Đo trên <b style="color:var(--txt)">${C.K.toLocaleString("vi")}</b> ngày có đủ cả hai miền
      (${fmtD(C.from)} → ${fmtD(C.to)}) · ${C.digits} số đuôi</div>
    <div class="tw"><table>
      <thead><tr><th style="text-align:left">Giả thuyết</th><th style="text-align:left">Kết quả đo</th><th>Kết luận</th></tr></thead><tbody>
      <tr style="cursor:default"><td>Số đã ra ở XSMN chiều → dễ ra ở XSMB tối hơn?</td>
        <td style="text-align:left">Có ra ở MN: <b>${pctS(C.t1.pIn,3)}</b> · không ra ở MN: <b>${pctS(C.t1.pOut,3)}</b><br>
          <span style="color:var(--dim2)">chênh ${((C.t1.pIn-C.t1.pOut)*100).toFixed(3)}pp · z=${C.t1.z.toFixed(2)} · ${C.t1.n.toLocaleString("vi")} quan sát</span></td>
        <td class="${sig1?"warm":"good"}">${sig1?"CÓ":"KHÔNG"}</td></tr>
      <tr style="cursor:default"><td>Số trùng nhau mỗi ngày nhiều hơn mức tình cờ?</td>
        <td style="text-align:left">Thực tế <b>${C.overlap.avg.toFixed(2)}</b> số/ngày · nếu độc lập <b>${C.overlap.exp.toFixed(2)}</b></td>
        <td class="${Math.abs(C.overlap.avg-C.overlap.exp)>0.15?"warm":"good"}">${Math.abs(C.overlap.avg-C.overlap.exp)>0.15?"CÓ":"KHÔNG"}</td></tr>
      <tr style="cursor:default"><td>Có phép biến đổi nào (GĐB miền Nam + k) trúng XSMB?</td>
        <td style="text-align:left">Quét cả ${C.U} phép dịch — mạnh nhất k=${C.shift.k}: <b>${pctS(C.shift.p)}</b> (nền ${pctS(C.shift.base)})<br>
          <span style="color:var(--dim2)">z=${C.shift.z.toFixed(2)} · ngưỡng sau hiệu chỉnh ${C.U} phép thử: ${C.shift.zCrit.toFixed(2)}</span></td>
        <td class="${sigShift?"warm":"good"}">${sigShift?"CÓ":"KHÔNG"}</td></tr>
    </tbody></table></div>

    <div class="mh">Backtest: mỗi ngày đánh lại chính số của XSMN sang XSMB</div>
    <div class="tw"><table>
      <thead><tr><th>Đánh N số</th><th>Trúng TB/kỳ</th><th>Chọn bừa N số</th><th>Hơn/kém</th></tr></thead><tbody>
      ${C.bt.map(b=>`<tr style="cursor:default"><td>${b.N} số</td><td class="good">${b.avg.toFixed(3)}</td>
        <td style="color:var(--dim)">${b.exp.toFixed(3)}</td>
        <td class="${b.lift>0.03?"up":b.lift<-0.03?"dn":""}">${b.lift>=0?"+":""}${(b.lift*100).toFixed(1)}%</td></tr>`).join("")}
    </tbody></table></div>

    <div style="margin-top:14px;padding:12px 15px;border-radius:10px;background:var(--card2);font-size:12.5px;color:var(--dim);line-height:1.75">
      ${anySig
        ? `<b style="color:var(--warn)">Có dấu hiệu liên hệ.</b> Hãy kiểm tra lại bằng dữ liệu mới trước khi tin — và nhớ rằng
           app đã thử rất nhiều giả thuyết, nên một kết quả "có" đơn lẻ vẫn có thể là trùng hợp.`
        : `<b style="color:var(--ok)">Kết luận: XSMN không nói gì về XSMB.</b>
           Cả ba phép đo đều cho kết quả trùng khớp mức ngẫu nhiên, và backtest "đánh lại số miền Nam" chênh dưới 1% so với chọn bừa
           trên ${C.K.toLocaleString("vi")} ngày.
           <br>Điều này hợp lý về cơ chế: hai miền dùng <b>hai bộ lồng cầu khác nhau, ở hai thành phố khác nhau,
           hai hội đồng giám sát khác nhau</b> — không có đường nào để kết quả bên này chạm vào bên kia.
           <br><span style="color:var(--dim2)">Việc XSMB quay sau chỉ có nghĩa bạn <i>biết thêm thông tin</i>, chứ thông tin đó
           không mang giá trị dự đoán. Giống như biết kết quả xúc xắc của bàn bên cạnh.</span>`}
    </div>`;
}

/* ============================================================================
   MÁY TÍNH KỲ VỌNG (EV) — cuối tab Trợ giúp
   Công thức trả theo số lần về (đã xác nhận với người dùng, xem BLUEPRINT §4):
     kỳ vọng số lần về/kỳ = n / U          (linearity of expectation, đúng dù các
                                             vị trí có độc lập hay không)
     EV = (n/U)·(đơn giá·tỉ lệ) − đơn giá·n
        = đơn giá·n·(tỉ lệ/U − 1)
     ⇒ EV% = tỉ lệ/U − 1                    KHÔNG phụ thuộc n hay phạm vi cược!
   Kiểu trả 1 lần cố định (bất kể về mấy lần) dùng p đo được (A.pBase) thay vì n/U.
   ========================================================================== */
const EVST = {mode:"per", unit:10000, ratio2:80, ratio3:600};
let EV_MODELS=null;
function getEvModels(){
  if(EV_MODELS) return EV_MODELS;
  const rows=[];
  for(const region of ["MB","MN"]) for(const scope of ["all","dd"]) for(const digits of [2,3])
    rows.push({region,scope,digits, ...evModel(region,scope,digits)});
  return EV_MODELS=rows;
}
function renderEvCalc(){
  $("#evFormula").innerHTML=`
    <div style="font-size:12.5px;color:var(--dim);line-height:1.85">
      <b style="color:var(--txt)">Cược</b> = đơn giá × số vị trí (n).
      <b style="color:var(--txt)">Nếu trả theo số lần về</b>${tip("evper")}: kỳ vọng thắng = (n ÷ không gian số) × tiền thắng mỗi lần —
      rút gọn lại, <b style="color:var(--gold)">EV% = tỉ lệ trả ÷ không gian số − 1</b>, đúng với <b>mọi n</b> và mọi phạm vi cược.
      Ví dụ 2 số với tỉ lệ trả 80: 80÷100−1 = <b class="hot">−20%</b> dù bạn đánh 1 vị trí hay 27 vị trí, chênh lệch kỳ vọng luôn vậy.
      <br><b style="color:var(--txt)">Nếu trả 1 lần cố định</b>${tip("evflat")} (dù về mấy lần vẫn chỉ ăn 1 lần): EV phụ thuộc n
      và xác suất về ít nhất 1 lần đo được từ dữ liệu — phạm vi càng rộng thường càng đỡ lỗ vì dễ trúng hơn,
      nhưng vẫn luôn âm.
    </div>`;

  const mc=$("#evMode"); mc.innerHTML="";
  mc.append(mkChip("Theo số lần về", EVST.mode==="per", ()=>{EVST.mode="per";renderEvCalc()}));
  mc.append(mkChip("1 lần cố định", EVST.mode==="flat", ()=>{EVST.mode="flat";renderEvCalc()}));

  const unit=parseFloat(($("#evUnit").value||"").replace(/\D/g,""))||0;
  const ratio2=parseFloat($("#evRatio2").value)||0;
  const ratio3=parseFloat($("#evRatio3").value)||0;
  EVST.unit=unit; EVST.ratio2=ratio2; EVST.ratio3=ratio3;

  const rows=getEvModels().map(m=>{
    const ratio=m.digits===2?ratio2:ratio3;
    const cost=unit*m.n, win=unit*ratio;
    const ev = EVST.mode==="per" ? (m.n/m.U)*win-cost : m.p*win-cost;
    const evPct = cost? ev/cost*100 : 0;
    const fairRatio = EVST.mode==="per" ? m.U : (m.p? m.n/m.p : Infinity);
    return {...m, ratio, cost, win, ev, evPct, fairRatio};
  }).sort((a,b)=>b.evPct-a.evPct);

  $("#evTable").innerHTML=`
    <div class="tw"><table>
      <thead><tr><th style="text-align:left">Kiểu cược</th><th>Vị trí (n)</th><th>Cược</th><th>Thắng/lần</th>
        <th>Tỉ lệ công bằng${tip("evfair")}</th><th>EV mỗi lượt</th></tr></thead><tbody>
      ${rows.map((r,i)=>{
        const cls=r.evPct>=-15?"var(--warn)":r.evPct>=-35?"var(--hot)":"#ff3b3b";
        return `<tr style="cursor:default"><td style="text-align:left">${i===0?"👍 ":""}${r.region} · ${scopeLabel(r.region,r.scope)} · ${r.digits} số</td>
          <td>${r.n.toFixed(r.n<10?2:1)}</td>
          <td>${Math.round(r.cost).toLocaleString("vi")}đ</td>
          <td>${Math.round(r.win).toLocaleString("vi")}đ</td>
          <td style="color:var(--dim)">tỉ lệ trả ${r.fairRatio.toFixed(0)}</td>
          <td><b style="color:${cls}">${r.evPct>=0?"+":""}${r.evPct.toFixed(1)}%</b></td></tr>`;
      }).join("")}
    </tbody></table></div>
    <div style="font-size:11.5px;color:var(--dim2);margin-top:10px;line-height:1.7">
      Xếp từ <b>đỡ lỗ nhất</b> (👍) đến <b>lỗ nặng nhất</b>. <b>Tỉ lệ công bằng</b> = mức trả thưởng để EV=0 —
      host trả càng thấp hơn số đó thì bạn càng thiệt. Vị trí (n) và xác suất lấy trung bình thật từ
      ${rows[0]?rows[0].K.toLocaleString("vi"):"?"}+ kỳ dữ liệu (XSMN dao động theo thứ vì 3–4 đài/ngày).
      <br><b style="color:var(--warn)">Không có dòng nào dương.</b> Đây không phải để tìm cửa thắng — không có —
      mà để thấy rõ cửa nào đang "cắt máu" bạn ít nhất nếu vẫn muốn chơi.
    </div>`;
}

/* ============================================================================
   VIEW: TRỢ GIÚP (hướng dẫn + từ điển + dữ liệu)
   ========================================================================== */
function renderHelp(){
  $("#howto").innerHTML=`
    <div style="font-size:13px;color:var(--dim);line-height:2">
      <div><span class="num" style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:var(--acc);color:#04101f;font-weight:800;font-size:11.5px;align-items:center;justify-content:center;margin-right:8px">1</span>
        <b style="color:var(--txt)">Mỗi chiều trước giờ quay</b> — mở tab <b>🎯 Bộ số hôm nay</b>, chọn <b>phạm vi giải</b> nào (tất cả giải hay chỉ G7+GĐB), <b>2 hay 3 số</b>, <b>lấy mấy con</b> — app hiện số ngay.</div>
      <div><span class="num" style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:var(--acc);color:#04101f;font-weight:800;font-size:11.5px;align-items:center;justify-content:center;margin-right:8px">2</span>
        <b style="color:var(--txt)">Bấm ✅ Lưu bộ số</b> — xong. App tự lưu đúng bộ số đó, tối tự chấm trúng/trượt.
        Bạn không phải nhập gì cả.</div>
      <div><span class="num" style="display:inline-flex;width:20px;height:20px;border-radius:50%;background:var(--acc);color:#04101f;font-weight:800;font-size:11.5px;align-items:center;justify-content:center;margin-right:8px">3</span>
        <b style="color:var(--txt)">Sau 1–2 tháng</b> — mở tab <b>📓 Sổ theo dõi</b> xem mình trúng bao nhiêu so với chọn bừa.
        Đó là câu trả lời thật duy nhất về cách chơi của bạn.</div>
      <div style="margin-top:10px;padding-top:12px;border-top:1px solid var(--line)">
        <b style="color:var(--txt)">Các tab còn lại khi nào cần thì mở:</b><br>
        🔍 <b>Phân tích sâu</b> — soi từng số: bản đồ nhiệt, gan, chu kỳ, lặp lại kỳ trước, cặp số…<br>
        🧪 <b>App có đáng tin?</b> — tự chạy kiểm chứng xem công thức có hơn chọn bừa không (khuyên xem 1 lần cho biết).<br>
        Gõ số bất kỳ vào ô 🔍 trên đầu (hoặc bấm phím <code>/</code>) rồi Enter để soi số đó.<br>
        Thấy dấu <sup class="info" style="pointer-events:none">!</sup> ở đâu — bấm vào đó là có giải thích.</div>
    </div>`;

  $("#facts").innerHTML=`
    <div style="font-size:12.5px;color:var(--dim);line-height:1.8">
      <b style="color:var(--txt)">Cơ chế giám sát:</b> theo Thông tư 22/2021/TT-BTC, Hội đồng giám sát kiểm tra
      thiết bị quay, bóng, việc niêm phong và quy trình quay thưởng.
      <a href="https://vbpq.mof.gov.vn/DKC.FileManagement/FileStorage/File/103180" target="_blank" rel="noopener">Xem văn bản Bộ Tài chính ↗</a>.
      Quy trình giám sát làm giảm rủi ro; riêng chuỗi kết quả chỉ giúp phát hiện lệch phân phối, không thể tự xác định nguyên nhân hay chứng minh tuyệt đối không có can thiệp.<br><br>
      <b style="color:var(--txt)">Đã kiểm tra trên ${DB.MB.days.length.toLocaleString("vi")} kỳ XSMB + ${DB.MN.days.length.toLocaleString("vi")} kỳ XSMN:</b></div>
    <div class="tw" style="margin-top:8px"><table>
      <thead><tr><th style="text-align:left">Giả thuyết</th><th style="text-align:left">Kết quả đo</th><th>Kết luận</th></tr></thead><tbody>
      <tr style="cursor:default"><td>Có "mùa" số đẹp theo tháng?</td><td style="text-align:left">12 kiểm định χ², tháng lệch nhất p=0.022 &gt; ngưỡng 0.0042</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Năm nào có số "tủ"?</td><td style="text-align:left">Chỉ 2010 lệch (số 59) — không lặp lại ở 21 năm còn lại</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Số vừa về dễ về tiếp (lặp lại kỳ trước)?</td><td style="text-align:left">23,94% vs nền 23,77% (MB) — trong sai số</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Gan lâu dễ nổ?</td><td style="text-align:left">Đường xác suất phẳng 23,9% → 24,0% từ gan 0 đến gan 15</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Chữ số GĐB có lệch qua các thời kỳ?</td><td style="text-align:left">p = 0.20–0.86 ở mọi giai đoạn 5 năm</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Thứ mấy thì số nào hay ra?</td><td style="text-align:left">700 ô (100 số × 7 thứ): ô lệch nhất là <b>66 vào thứ Ba</b> z=3,78 — ngưỡng cần vượt 3,97</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Ngày dương lịch 1–31?</td><td style="text-align:left">31 kiểm định, không ngày nào qua ngưỡng</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Ngày lễ (Tết dương, 30/4, 2/9)?</td><td style="text-align:left">83 kỳ lễ: p=0,63 — không khác ngày thường</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Hôm qua có gợi ý gì cho hôm nay?</td><td style="text-align:left">Tương quan GĐB lag-1 = 0,012 (sai số ±0,023)</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Có giai đoạn nào bất thường?</td><td style="text-align:left">41 cửa sổ 180 kỳ: <b>2024-03→09 lệch thật</b> (χ²=165, Monte&nbsp;Carlo p=0,0015)</td><td class="warm">CÓ 1 lần</td></tr>
      <tr style="cursor:default"><td>…giai đoạn đó có dùng để đoán được không?</td><td style="text-align:left">Số nóng nửa đầu ↔ nửa sau: r=0,17 (±0,20). Sau đó 672 kỳ: tất cả về mức bình thường (z −0,3…+0,5)</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>Thứ trong tuần có ảnh hưởng?</td><td style="text-align:left">XSMN: CN–T6 quay 3 đài, T7 quay 4 đài → nền 41,9% vs ~51%</td><td class="warm">CÓ — app đã tính đúng</td></tr>
      <tr style="cursor:default"><td>Lồng cầu/bóng có lệch cơ học không? (quét 107 vị trí MB + 82 vị trí MN, từng chữ số riêng — không gộp đuôi)</td><td style="text-align:left">MB: 0/107 vượt ngưỡng Bonferroni. MN: 2/82 vượt, cả hai đều giải thích được (dòng dưới)</td><td class="good">KHÔNG</td></tr>
      <tr style="cursor:default"><td>…2 ô "lệch" của MN là gì?</td><td style="text-align:left">GĐB-chữ-số-1: do đổi định dạng &lt;6→6 chữ số năm 2010 (0 chiếm 95,5% năm 2008, ổn định 8–12% từ 2010) — không phải đuôi, không phải lệch bóng. G4-chữ-số-2: Monte Carlo p=0,004, nhưng ~0,3/82 ô đạt mức này chỉ do ngẫu nhiên — không bất thường</td><td class="good">Giải thích được</td></tr>
      <tr style="cursor:default"><td>XSMB còn quay trực tiếp trên TV không? (tiền đề "hết ai giám sát bằng mắt")</td><td style="text-align:left">Vẫn quay live 18:00–18:30 hằng ngày — chỉ đổi kênh VTC9 → VTVCab4 "On Movie" từ 15/01/2025. XSMN: mỗi đài phát live trên kênh tỉnh mình</td><td class="good">Tiền đề sai</td></tr>
    </tbody></table></div>
    <div style="margin-top:14px;padding:12px 15px;border-radius:10px;background:var(--card2);font-size:12.5px;color:var(--dim);line-height:1.75">
      <b style="color:var(--txt)">Về "yếu tố ngoại cảnh" (thời sự, bão, chính trị…):</b> không cần thử từng thứ một.
      Nếu <i>bất kỳ</i> yếu tố nào ngoài đời tác động được lên số, nó phải làm phân phối lệch đi ở <i>giai đoạn</i> tương ứng.
      App đã quét toàn bộ ${DB.MB.days.length.toLocaleString("vi")} kỳ theo tháng, năm, ngày, lễ và 41 cửa sổ 180 kỳ.
      Chỉ tìm thấy <b>đúng một</b> giai đoạn lệch (giữa 2024) — và chính giai đoạn đó cũng <b>không lặp lại, không tiên đoán được</b>:
      những số nóng lúc ấy trở về mức bình thường ngay sau đó.
      <br><span style="color:var(--dim2)">Đây là kết luận từ dữ liệu đã đo, không phải bằng chứng tuyệt đối về nguyên nhân vật lý.
      Một bất thường thống kê chỉ là cờ cần kiểm tra thêm, không tự động đồng nghĩa gian lận.</span>
    </div>
    <div style="font-size:12.5px;color:var(--dim);line-height:1.8;margin-top:12px">
      <b style="color:var(--txt)">Kỳ vọng thua lỗ:</b> với luật "trả theo số lần về" (phổ biến nhất), chênh lệch kỳ vọng
      chỉ phụ thuộc tỉ lệ trả — 2 số với tỉ lệ trả 80 ≈ <b class="warm">−20%</b> mỗi lượt,
      3 số với tỉ lệ trả 600 ≈ <b class="warm">−40%</b>, bất kể đánh mấy vị trí.
      Vé số truyền thống trả tối đa 50% giá trị vé ≈ <b class="warm">−50%</b>.
      Toán không đổi dấu được các con số này — thứ bạn kiểm soát duy nhất là <b>tổng tiền đặt</b>.
      Máy tính chi tiết ở cuối trang này.</div>`;

  $("#glossary").innerHTML=`<table class="sig"><tbody>`+
    Object.values(GLOSSARY).map(g=>
      `<tr><td style="width:150px"><b style="color:var(--txt)">${g.t}</b></td><td>${g.b}</td></tr>`).join("")+
    `</tbody></table>`;

  const m=window.XS_META||{};
  const mb=DB.MB.days, mn=DB.MN.days;
  $("#dataInfo").innerHTML=`
    <div class="stats3">
      <div class="b">XSMB<b>${mb.length.toLocaleString("vi")}</b>kỳ · ${mb.length?fmtD(mb[0].d)+" → "+fmtD(mb[mb.length-1].d):"—"}</div>
      <div class="b">XSMN<b>${mn.length.toLocaleString("vi")}</b>kỳ · ${mn.length?fmtD(mn[0].d)+" → "+fmtD(mn[mn.length-1].d):"—"}</div>
      <div class="b">Số đài XSMN<b>${DB.MN.provs.length}</b>đang hoạt động</div>
      <div class="b">Cập nhật lần cuối<b style="font-size:15px">${m.updated||"—"}</b></div>
    </div>
    <div style="margin-top:16px;font-size:12.5px;color:var(--dim);line-height:1.8">
      <b style="color:var(--txt)">Nguồn:</b> XSMB từ bộ dữ liệu mở trên GitHub (từ 01/10/2005) · XSMN crawl từ kho lưu trữ xosodaiphat.com (từ 2008).<br>
      <b style="color:var(--txt)">Cập nhật:</b> chạy <code>MoApp.bat</code> để app tự động tải kết quả mới ngay khi có (XSMN ~16:35, XSMB ~18:32),
      hoặc <code>CapNhat.bat</code> để cập nhật thủ công một lần.<br>
      <b style="color:var(--txt)">Tải toàn bộ lịch sử:</b> <code>TaiDuLieu.bat</code> — chạy một lần duy nhất, mất khoảng 10 phút.
    </div>`;

  const rows=A.days.slice(-20).reverse();
  $("#tRecent").innerHTML=
    `<thead><tr><th>Ngày</th><th style="text-align:left">Các bộ ${A.digits} số đuôi</th></tr></thead><tbody>`+
    rows.map(d=>{
      const ts=tailsOfDay(d,ST.region,ST.scope,A.digits,false);
      const uniq=[...new Set(ts)].sort();
      return `<tr style="cursor:default"><td style="white-space:nowrap">${fmtD(d.d)} <span style="color:var(--dim2)">${DOW_S[d.w]}</span></td>
        <td style="text-align:left;white-space:normal;line-height:2">
        ${uniq.map(t=>`<button type="button" class="tag clk" onclick="openNum('${t}',${A.digits})">${t}</button>`).join(" ")}</td></tr>`;
    }).join("")+`</tbody>`;

  renderEvCalc();
}

/* ============================================================================
   MODAL SOI SỐ
   ========================================================================== */
window.openNum = (tail, digits) => {
  const Ax = digits===2 ? A2 : A3;
  const rank = digits===2 ? RANK2 : RANK3;
  const s = Ax.S.get(tail);
  const sc = scoreOf(Ax, tail, NEXT.w, rank.model);

  const hits=[];
  Ax.days.forEach(d=>{
    for(const[t,prize,prov] of tailsOfDay(d,ST.region,ST.scope,digits,true))
      if(t===tail) hits.push({d:d.d,w:d.w,prize,prov});
  });
  const dowCnt=[0,0,0,0,0,0,0], seen=new Set();
  for(const h of hits) if(!seen.has(h.d)){ seen.add(h.d); dowCnt[h.w]++ }

  const z=zBonf(Ax.U,0.05);
  const[lo,hi]=wilson(s?s.daysCnt:0, Ax.K, z);

  let gapHtml="";
  if(s && s.gaps.length){
    const bmax=Math.min(Math.max(...s.gaps, s.curGap)+1, 40);
    const cnt=new Array(bmax).fill(0);
    for(const g of s.gaps) cnt[Math.min(g,bmax-1)]++;
    const cmx=Math.max(...cnt,1);
    gapHtml=`<div class="mh">Phân bố khoảng chờ (gap)</div><div class="gp">`+
      cnt.map((v,i)=>`<i class="${Math.min(s.curGap,bmax-1)===i?"hl":""}" style="height:${Math.max(4,v/cmx*100)}%" title="gap ${i}${i===bmax-1?"+":""}: ${v} lần"></i>`).join("")+
      `</div><div style="font-size:10.5px;color:var(--dim2);margin-top:4px">0 → ${bmax-1}+ kỳ · cột vàng = vị trí gan hiện tại (${s.curGap})</div>`;
  }

  // bạn số
  let coHtml="";
  if(s){
    const co=new Map();
    for(const di of s.hits) for(const x of Ax.daySets[di]) if(x!==tail) co.set(x,(co.get(x)||0)+1);
    const top=[...co.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
    if(top.length) coHtml=`<div class="mh">Hay về cùng ngày với ${tail}</div><div class="tags">`+
      top.map(([x,c])=>`<button type="button" class="tag clk" onclick="openNum('${x}',${digits})">${x} <b>${c}</b> kỳ</button>`).join("")+`</div>`;
  }

  // So sánh nhanh qua nhiều cỡ mẫu — số ổn định phải giữ tỉ lệ gần nền ở MỌI cột;
  // chỉ nóng ở đúng 1 cột cỡ mẫu là dấu hiệu cắt mẫu chọn lọc (overfitting), không phải tín hiệu thật.
  const cmpF = baseDays();
  const cmpRows = [90,365,1000,"max"].map(w=>{
    const days = w==="max" ? cmpF : cmpF.slice(-w);
    if(days.length<30) return null;
    // Ở phạm vi "Toàn bộ", Ax hiện có đúng cùng dữ liệu/phạm vi: không tính lại cùng một thống kê.
    const Ax2 = w==="max" && ST.win==="max" ? Ax : analyze(days, ST.region, ST.scope, digits);
    const s2 = Ax2.S.get(tail);
    const rate = s2 ? s2.daysCnt/Ax2.K : 0;
    return {label: w==="max"?"Toàn bộ":w===90?"3 tháng":w===365?"1 năm":"3 năm",
            K:Ax2.K, rate, gap:s2?s2.curGap:Ax2.K, base:Ax2.pBase};
  }).filter(Boolean);
  const cmpHtml = cmpRows.length<2 ? "" : `
    <div class="mh">So sánh qua nhiều cỡ mẫu</div>
    <table class="sig"><tbody>
      <tr style="color:var(--dim2);font-size:11px"><td>Cửa sổ</td><td>Số kỳ</td><td>Tỉ lệ ra</td><td>So nền</td><td>Gan hiện tại</td></tr>
      ${cmpRows.map(r=>`<tr><td>${r.label}</td><td>${r.K}</td><td>${pctS(r.rate)}</td>
        <td style="color:${r.rate>r.base*1.15?"var(--ok)":r.rate<r.base*0.85?"var(--hot)":"var(--dim2)"}">×${(r.rate/r.base).toFixed(2)} nền</td>
        <td>${r.gap}</td></tr>`).join("")}
    </tbody></table>
    <div style="font-size:11px;color:var(--dim2);margin-top:4px;margin-bottom:2px">
      Số đáng tin phải lệch <b>cùng chiều</b> ở hầu hết các cột. Lệch chỉ ở 1 cỡ mẫu thường là do cắt mẫu trúng ngẫu nhiên.
    </div>`;

  // Bảng tín hiệu: quan sát thô → nhân với trọng số tin cậy w → đóng góp vào điểm
  const sigRows = ["freq","rec","dow","gap","carry"].map(k=>{
    const raw=sc.p[k], w=sc.W[k], c=sc.contrib[k];
    return `<tr><td>${SIGNAL_INFO[k]}</td>
      <td>${pctS(raw,2)}</td>
      <td style="color:${w>0.05?"var(--ok)":"var(--dim2)"}">${w.toFixed(3)}</td>
      <td style="color:${c>0?"var(--ok)":c<0?"var(--hot)":"var(--dim2)"}">${c>=0?"+":""}${(c*100).toFixed(3)}pp</td></tr>`;
  }).join("");

  $("#modal").innerHTML=`
    <div class="mhead">
      <div>
        <div class="big">${tail}</div>
        <div class="meta">${ST.region} · ${ST.scope==="all"?"tất cả giải":(ST.region==="MB"?"G7+GĐB":"G8+GĐB")} · ${digits} số đuôi<br>
          mẫu ${Ax.K} kỳ (${Ax.K?fmtD(Ax.from)+" → "+fmtD(Ax.to):"—"})</div>
      </div>
      <button type="button" class="x" onclick="closeM()" aria-label="Đóng soi số">✕</button>
    </div>
    <div class="ms">
      <div>Tổng lần ra<b>${s?s.occ:0}</b></div>
      <div>Số kỳ ra<b>${s?s.daysCnt:0}/${Ax.K}</b></div>
      <div>Tỉ lệ<b>${pctS(s?s.daysCnt/Ax.K:0)}</b></div>
      <div>KTC đồng thời 95%<b style="font-size:13px">${pctS(lo)}–${pctS(hi)}</b></div>
      <div>Gan hiện tại<b>${s?s.curGap:Ax.K}</b></div>
      <div>Nhịn lâu nhất<b>${s?s.maxGap:Ax.K}</b></div>
      <div>Về sát nhau nhất<b>${s&&s.minGap!=null?s.minGap:"—"}</b></div>
      <div>Nhịp TB<b>${s&&s.avgGap!=null?s.avgGap.toFixed(1):"—"}</b></div>
      <div>Lần cuối<b style="font-size:13px">${s&&s.last?fmtD(s.last):"chưa ra"}</b></div>
      <div>Độ đều (CV)<b>${s&&s.cv!=null?s.cv.toFixed(2):"—"}</b></div>
    </div>

    ${cmpHtml}

    <div class="mh">Điểm xếp hạng thử nghiệm — ${NEXT.label}</div>
    <table class="sig"><tbody>
      <tr style="color:var(--dim2);font-size:11px"><td>Tín hiệu</td><td>Quan sát</td><td>Độ tin cậy w${tip("w")}</td><td>Đóng góp</td></tr>
      ${sigRows}
      <tr class="tot"><td>ĐIỂM = nền + tổng đóng góp</td>
        <td><b style="color:var(--gold);font-size:15px">${pctS(sc.score,2)}</b></td>
        <td><b style="color:${sc.lift>=1.05?"var(--ok)":sc.lift<=0.95?"var(--hot)":"var(--dim)"}">×${sc.lift.toFixed(3)}</b></td>
        <td style="color:var(--dim2)">nền kỳ tới ${pctS(sc.pBase,2)}</td></tr>
    </tbody></table>
    <div style="font-size:11.5px;color:var(--dim2);margin-top:6px;line-height:1.65">
      <b>w</b> = phần chênh lệch quan sát được là tín hiệu thật (Bayes thực nghiệm).
      w≈0 nghĩa là chênh lệch đó hoàn toàn do nhiễu lấy mẫu, nên nó <b>không</b> được cộng vào điểm.<br>
      ${sc.actionable
        ? "✓ Tín hiệu đã vượt ngưỡng trong mẫu và có chứng nhận kiểm chứng ngoài mẫu."
        : (sc.flat
          ? `<span style="color:var(--warn)">⚠ Edge tổng hợp chưa vượt ngưỡng đa so sánh — chưa có bằng chứng số này khác ${Ax.U-1} số còn lại.</span>`
          : `<span style="color:var(--warn)">⚠ Có lệch trong mẫu, nhưng chưa lặp lại ở backtest ngoài mẫu — không dùng điểm này làm xác suất kỳ tới.</span>`)}
    </div>

    ${gapHtml}

    <div class="mh">Theo thứ trong tuần (vàng = kỳ tới)</div>
    <div class="dw">${[0,1,2,3,4,5,6].map(w=>{
      const mx=Math.max(...dowCnt,1);
      return `<div class="d ${w===NEXT.w?"hl":""}"><div class="t"><i style="height:${dowCnt[w]/mx*100}%"></i></div>
        ${DOW_S[w]}<br><b>${dowCnt[w]}</b>/${Ax.dowTotals[w]}</div>`;
    }).join("")}</div>

    ${coHtml}

    <div class="mh">Lịch sử xuất hiện (mới → cũ)</div>
    <div class="tags">${hits.length
      ? hits.slice(-60).reverse().map(h=>`<span class="tag"><b>${fmtD(h.d)}</b> ${DOW_S[h.w]} · ${h.prize}${h.prov?" "+h.prov:""}</span>`).join("")
      : `<span class="tag">Chưa ra lần nào trong mẫu này</span>`}</div>`;
  $("#mbg").classList.add("show");
  $("#modal .x")?.focus();
};
window.closeM = () => $("#mbg").classList.remove("show");

/* ============================================================================
   ĐIỀU PHỐI
   ========================================================================== */
/* Tab "Phân tích sâu" gộp 3 màn cũ; chọn màn con bằng chip. */
const ANA_SUBS=[
  {k:"board",   n:"🌡️ Bảng số",       fn:()=>renderBoard()},
  {k:"gap",     n:"⏳ Gan & chu kỳ",   fn:()=>renderGap()},
  {k:"pattern", n:"🧩 Mẫu & liên quan",fn:()=>renderPattern()},
];
function renderAna(){
  const ac=$("#anaChips"); ac.innerHTML="";
  for(const s of ANA_SUBS)
    ac.append(mkChip(s.n, ST.anaSub===s.k, ()=>{ST.anaSub=s.k;renderAna()}));
  for(const s of ANA_SUBS)
    $("#sub-"+s.k).style.display = ST.anaSub===s.k ? "" : "none";
  ANA_SUBS.find(s=>s.k===ST.anaSub).fn();
}

const RENDER = { live:renderLive, pred:renderPred, ana:renderAna, cross:renderCross, verify:renderVerify };
let dirty = {};

function refresh(){
  const sl=recompute();
  renderFilters(sl);
  dirty = {live:1,pred:1,ana:1,cross:1,verify:1};
  showView(ST.view);
}
function showView(v){
  ST.view=v;
  $("#filtersBar").hidden = v==="live" || v==="pred";
  $$("#nav button").forEach(b=>{
    const on=b.dataset.v===v;
    b.classList.toggle("on",on);
    b.setAttribute("aria-current",on?"page":"false");
  });
  $$(".view").forEach(n=>n.classList.toggle("on", n.id==="v-"+v));
  const stale=$("#staleBar");
  if(stale) stale.style.display=v==="live"||!stale.innerHTML?"none":"";
  if(dirty[v]){ RENDER[v](); dirty[v]=0 }
  window.scrollTo({top:0,behavior:"instant"});
}

/* --------- sự kiện --------- */
$("#nav").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(b) showView(b.dataset.v);
});
$("#liveP").addEventListener("click",()=>showView("live"));
$("#liveRefresh").addEventListener("click",()=>setLiveFrame(ST.region,true));
$("#liveToPred").addEventListener("click",()=>showView("pred"));
$("#liveToCross").addEventListener("click",()=>showView("cross"));
$("#liveFrame").addEventListener("load",()=>{
  const loading=$("#liveLoading");
  if(loading){ loading.lastChild.textContent="Đã kết nối nguồn Minh Ngọc"; setTimeout(()=>loading.classList.add("done"),350) }
});
$("#regSeg").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  ST.region=b.dataset.r; ST.provs=null; ST.win="max"; refresh();
});
$("#tf").addEventListener("input", renderFullTable);
$("#btRun").onclick=runBacktest;
$("#pinAddBtn").onclick=()=>pxAdd("pin");
$("#exclAddBtn").onclick=()=>pxAdd("excl");
$("#pinIn").addEventListener("keydown", e=>{ if(e.key==="Enter") pxAdd("pin") });
$("#exclIn").addEventListener("keydown", e=>{ if(e.key==="Enter") pxAdd("excl") });
$("#gs").addEventListener("keydown", e=>{
  if(e.key!=="Enter") return;
  const v=e.target.value.trim();
  if(!/^\d{2,3}$/.test(v)){
    e.target.style.borderColor="var(--hot)";
    toast("Nhập đúng 2 hoặc 3 chữ số, ví dụ 68 hoặc 668.");
    setTimeout(()=>e.target.style.borderColor="",900); return;
  }
  openNum(v, v.length);
  e.target.value="";
});
$("#mbg").addEventListener("click", e=>{ if(e.target.id==="mbg") closeM() });
document.addEventListener("keydown", e=>{
  if(e.key==="Escape") closeM();
  if(e.key==="/" && document.activeElement!==$("#gs")){ e.preventDefault(); $("#gs").focus() }
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
    <span class="ico">${bad?"🚨":"⚠️"}</span>
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
    ? `Mở kết quả trực tiếp. Kho thống kê cập nhật lần cuối: ${updated}.`
    : "Mở kết quả xổ số trực tiếp.";
})();
setInterval(()=>{ if(ST.view==="pred") renderHero() }, 30000);
setInterval(()=>{ if(ST.view==="live") updateLiveStatus() }, 30000);
setInterval(checkStale, 5*60000);

/* --------- khởi động --------- */
(function init(){
  if(!DB.MB.days.length && !DB.MN.days.length){
    $("#noData").style.display="";
    $$(".view").forEach(n=>n.classList.toggle("on",n.id==="v-live"));
    document.querySelector(".filters").style.display="none";
    renderLive();
    return;
  }
  if(!DB.MB.days.length) ST.region="MN";
  checkStale();
  $("#foot").innerHTML=`
    <b style="color:var(--dim)">Nguồn trực tiếp:</b> bảng kết quả được nhúng từ Minh Ngọc™ và chỉ mang tính tham khảo.
    <b style="color:var(--dim)">Miễn trừ trách nhiệm:</b> xổ số là trò chơi ngẫu nhiên.
    App này là công cụ <b>thống kê và phân tích dữ liệu quá khứ</b>, không dự báo được tương lai và không đảm bảo bất kỳ kết quả nào.
    Mọi con số hiển thị đều kèm mức nền để bạn tự đánh giá. Hãy dùng tab Kiểm chứng trước khi tin vào bất kỳ tín hiệu nào.
    Chơi có trách nhiệm — chỉ dùng số tiền bạn sẵn sàng mất.`;
  refresh();
})();
