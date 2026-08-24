/* ============================================================================
   app.js — Bộ não thống kê của Kết Số — XSMB / XSMN
   Chỉ phục vụ 2 SỐ ĐUÔI (00–99) và 3 SỐ ĐUÔI (000–999).

   Quy ước dùng chung toàn file:
     tail    : chuỗi số đuôi đã pad 0, vd "07" hoặc "007"
     U       : kích thước không gian số (100 hoặc 1000)
     day     : 1 kỳ quay (1 ngày)
     occ     : tổng số LẦN xuất hiện (1 ngày có thể nhiều lần)
     daysCnt : số NGÀY có xuất hiện (≥1 lần)
     gap     : số ngày CHỜ giữa 2 lần xuất hiện (0 = ra 2 ngày liên tiếp)
   ========================================================================== */
"use strict";

/* ---------- hằng số cấu trúc giải ---------- */
function expand(spec){const a=[];for(const[k,c]of spec)for(let i=0;i<c;i++)a.push(k);return a}
const PRIZE_MB = expand([["GĐB",1],["G1",1],["G2",2],["G3",6],["G4",4],["G5",6],["G6",3],["G7",4]]);
const PRIZE_MN = expand([["G8",1],["G7",1],["G6",3],["G5",1],["G4",7],["G3",2],["G2",1],["G1",1],["GĐB",1]]);
const LEN_MB   = [5,5,5,5,5,5,5,5,5,5,4,4,4,4,4,4,4,4,4,4,3,3,3,2,2,2,2];
const LEN_MN   = [2,3,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5,6];
const IDX_DD_MB = [0,23,24,25,26];  // GĐB + G7  (giải "đặc biệt + giải bét")
const IDX_DD_MN = [0,17];           // G8 + GĐB

const DOW_VN = ["Chủ nhật","Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7"];
const DOW_S  = ["CN","T2","T3","T4","T5","T6","T7"];

/* giờ quay thưởng (phút kể từ 00:00) */
const DRAW_TIME = { MN: 16*60+15, MB: 18*60+15 };

/* Hazard chỉ đủ ổn định để dùng vào điểm trong vùng đã đo trước. Ở gap cực dài,
   mẫu risk-set teo nhanh và một vài spell kết thúc cùng lúc có thể tạo ra phần
   trăm rất lớn nhưng không phải xác suất dự báo đã được hiệu chuẩn. */
const HAZARD_SCORE_MAX_GAP = 25;
const HAZARD_SCORE_MIN_REACH = 200;

/* ---------- tiện ích ---------- */
const pad = (n,d)=>String(n).padStart(d,"0");
const fmtD = s => { const[y,m,d]=s.split("-"); return `${d}/${m}/${y}` };
const fmtDS = s => { const[y,m,d]=s.split("-"); return `${d}/${m}` };
const pctS = (x,dp=1)=> (x*100).toFixed(dp)+"%";
function dowOf(ds){const[y,m,d]=ds.split("-").map(Number);return new Date(y,m-1,d).getDay()}
function addDays(ds,n){const[y,m,d]=ds.split("-").map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+n);
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1,2)}-${pad(dt.getDate(),2)}`}

/* ---------- nạp dữ liệu thô ---------- */
const DB = { MB:{days:[],provs:[]}, MN:{days:[],provs:[]} };
(function loadRaw(){
  if(window.XSMB_LINES){
    for(const l of XSMB_LINES){
      const a=l.split(",");
      DB.MB.days.push({d:a[0], w:dowOf(a[0]), nums:a.slice(1)});
    }
  }
  if(window.XSMN_LINES){
    const pset=new Map();
    for(const l of XSMN_LINES){
      const seg=l.split("|"), draws=[];
      for(let i=1;i<seg.length;i++){
        const ci=seg[i].indexOf(":");
        const p=seg[i].slice(0,ci);
        draws.push({p, nums:seg[i].slice(ci+1).split(",")});
        pset.set(p,(pset.get(p)||0)+1);
      }
      DB.MN.days.push({d:seg[0], w:dowOf(seg[0]), draws});
    }
    // chỉ giữ đài còn hoạt động thường xuyên (xuất hiện ≥ 20 kỳ)
    DB.MN.provs=[...pset.entries()].filter(([,c])=>c>=20).map(([p])=>p)
      .sort((a,b)=>a.localeCompare(b,"vi"));
  }
  DB.MB.days.sort((a,b)=>a.d<b.d?-1:1);
  DB.MN.days.sort((a,b)=>a.d<b.d?-1:1);
})();

/* ============================================================================
   TRÍCH SỐ ĐUÔI
   ========================================================================== */
/** Trả về mảng tail của 1 ngày. info=true → [tail, tênGiải, tênĐài] */
function tailsOfDay(day, region, scope, digits, info){
  const out=[];
  if(region==="MB"){
    const idxs = scope==="dd" ? IDX_DD_MB : null;
    const n = day.nums.length;
    if(idxs){ for(const i of idxs){ if(LEN_MB[i]>=digits) out.push(info?[day.nums[i].slice(-digits),PRIZE_MB[i],""]:day.nums[i].slice(-digits)); } }
    else    { for(let i=0;i<n;i++){ if(LEN_MB[i]>=digits) out.push(info?[day.nums[i].slice(-digits),PRIZE_MB[i],""]:day.nums[i].slice(-digits)); } }
  }else{
    const idxs = scope==="dd" ? IDX_DD_MN : null;
    for(const dr of day.draws){
      if(idxs){ for(const i of idxs){ if(LEN_MN[i]>=digits) out.push(info?[dr.nums[i].slice(-digits),PRIZE_MN[i],dr.p]:dr.nums[i].slice(-digits)); } }
      else    { for(let i=0;i<dr.nums.length;i++){ if(LEN_MN[i]>=digits) out.push(info?[dr.nums[i].slice(-digits),PRIZE_MN[i],dr.p]:dr.nums[i].slice(-digits)); } }
    }
  }
  return out;
}

/* ============================================================================
   THỐNG KÊ CHÍNH
   ========================================================================== */
/**
 * @param days   mảng ngày đã lọc (theo miền/đài/cửa sổ)
 * @param digits 2 hoặc 3
 * Trả về object thống kê đầy đủ cho không gian số tương ứng.
 */
function analyze(days, region, scope, digits){
  const U = Math.pow(10,digits);
  const K = days.length;
  const S = new Map();
  const dowTotals=[0,0,0,0,0,0,0];
  const occDow=[0,0,0,0,0,0,0];   // tổng bộ số theo thứ — vì XSMN có ngày 3 đài, ngày 4 đài
  const dayOcc=[];                 // số vị trí hợp lệ của từng kỳ (dùng tính nền chính xác)
  const daySets=[];               // Set tail của từng ngày
  let totalOcc=0;
  const RECN = Math.min(30,K), recFrom = K-RECN;

  const mk=()=>({occ:0,daysCnt:0,hits:[],last:"",dow:[0,0,0,0,0,0,0],recCnt:0,carryHit:0,carryBase:0});

  let prev=null, carryHits=0, carryBase=0, freshHits=0, freshBase=0;

  for(let di=0; di<K; di++){
    const day=days[di];
    dowTotals[day.w]++;
    const tails=tailsOfDay(day,region,scope,digits,false);
    dayOcc.push(tails.length);
    totalOcc+=tails.length;
    occDow[day.w]+=tails.length;
    const seen=new Set();
    for(const t of tails){
      let s=S.get(t); if(!s){s=mk();S.set(t,s)}
      s.occ++;
      if(!seen.has(t)){
        seen.add(t); s.hits.push(di); s.last=day.d; s.daysCnt++;
        s.dow[day.w]++; if(di>=recFrom) s.recCnt++;
      }
    }
    if(prev){
      // lặp lại kỳ trước: số đã ra kỳ trước có ra tiếp kỳ này không
      carryBase += prev.size;
      for(const t of prev) if(seen.has(t)){ carryHits++; S.get(t).carryHit++ }
      for(const t of prev) S.get(t).carryBase++;
      // số KHÔNG ra hôm qua → hôm nay ra bao nhiêu
      freshBase += U-prev.size;
      for(const t of seen) if(!prev.has(t)) freshHits++;
    }
    daySets.push(seen); prev=seen;
  }

  const perDay = K ? totalOcc/K : 0;

  /* Xác suất nền của một DÀN n số trong một kỳ có m vị trí là
       1 − (1 − n/U)^m.
     Phải lấy trung bình theo từng kỳ, không cắm số vị trí trung bình vào sau
     cùng: XSMN có ngày 3 đài và thứ Bảy 4 đài nên hai cách không hoàn toàn
     tương đương. n=1 chính là nền của một số. */
  const baseSetProb = (n, targetDow=null) => {
    n=Math.max(0,Math.min(U,n));
    let sum=0, count=0;
    for(let i=0;i<K;i++){
      if(targetDow!=null && days[i].w!==targetDow) continue;
      sum += 1-Math.pow(1-n/U, dayOcc[i]);
      count++;
    }
    if(!count && targetDow!=null) return baseSetProb(n,null);
    return count ? sum/count : 0;
  };
  const pBase = baseSetProb(1);

  /* --- gap của từng số + hazard (Kaplan-Meier, có xử lý kiểm duyệt phải) --- */
  const GMAX = 500;
  const dReach = new Float64Array(GMAX+2);   // mảng hiệu số → prefix sum
  const evt    = new Float64Array(GMAX+1);

  for(const s of S.values()){
    const h=s.hits;
    s.curGap = K-1-(h.length? h[h.length-1] : -1);
    s.gaps=[]; s.minGap=Infinity; s.maxGap=0;
    for(let j=1;j<h.length;j++){
      const g=h[j]-h[j-1]-1;
      s.gaps.push(g);
      if(g<s.minGap)s.minGap=g;
      if(g>s.maxGap)s.maxGap=g;
      const gc=Math.min(g,GMAX);
      evt[gc]++; dReach[0]++; dReach[gc+1]--;
    }
    // khoảng chờ hiện tại = quan sát bị kiểm duyệt phải (chưa kết thúc)
    const cc=Math.min(s.curGap,GMAX);
    dReach[0]++; dReach[cc+1]--;
    if(s.minGap===Infinity) s.minGap=null;
    s.avgGap = s.gaps.length ? s.gaps.reduce((a,b)=>a+b,0)/s.gaps.length : null;
    // độ đều nhịp: hệ số biến thiên của gap (càng nhỏ càng đều)
    if(s.gaps.length>=3){
      const m=s.avgGap;
      const v=s.gaps.reduce((a,b)=>a+(b-m)*(b-m),0)/s.gaps.length;
      s.cv = m>0 ? Math.sqrt(v)/m : null;
    } else s.cv=null;
  }
  const reach=new Float64Array(GMAX+1);
  let run=0;
  for(let g=0; g<=GMAX; g++){ run+=dReach[g]; reach[g]=run }

  const hazard = {
    reach, evt,
    /** xác suất thực nghiệm "đang gan g ngày thì ra ở kỳ kế" */
    at(g){ const gc=Math.min(g,GMAX); return reach[gc]>=40 ? evt[gc]/reach[gc] : pBase; },
    reliable(g){ const gc=Math.min(g,GMAX); return reach[gc]>=40; },
    predictiveReliable(g){
      const gc=Math.min(g,GMAX);
      return g<=HAZARD_SCORE_MAX_GAP && reach[gc]>=HAZARD_SCORE_MIN_REACH;
    },
    predictiveAt(g, fallback=pBase){
      const gc=Math.min(g,GMAX);
      return this.predictiveReliable(g) ? evt[gc]/reach[gc] : fallback;
    }
  };

  /* --- kiểm định chi-square: dữ liệu có lệch khỏi ngẫu nhiên không? --- */
  let chi2=0;
  const E = totalOcc/U;
  if(E>0){
    // Σ(O-E)²/E = (ΣO² − 2E·ΣO + U·E²)/E   — số chưa ra có O=0 nên không cộng vào ΣO²
    let sumSq=0;
    for(const s of S.values()) sumSq += s.occ*s.occ;
    chi2 = (sumSq - 2*E*totalOcc + U*E*E)/E;
  }
  const df = U-1;
  /* Wilson–Hilferty: biến đổi χ² về chuẩn chính xác hơn xấp xỉ tuyến tính
     (χ²−df)/√(2df), nhất là ở phần đuôi đang dùng để ra quyết định p<0,05. */
  const zChi = df>0
    ? (Math.cbrt(Math.max(0,chi2/df))-(1-2/(9*df)))/Math.sqrt(2/(9*df))
    : 0;
  const pChi = 1-normCdf(zChi);

  const pCarry = carryBase ? carryHits/carryBase : pBase;
  const pFresh = freshBase ? freshHits/freshBase : pBase;

  /* Xác suất nền THEO THỨ — quan trọng với XSMN vì ngày 3 đài và ngày 4 đài
     có số bộ số khác nhau hẳn (54 vs 72), nên kỳ vọng trúng cũng khác. */
  const pBaseFor = w => dowTotals[w] >= 5 ? baseSetProb(1,w) : pBase;
  const perDayFor = w => dowTotals[w]>=5 ? occDow[w]/dowTotals[w] : perDay;

  return {
    days, K, U, digits, region, scope, S, daySets, dowTotals, occDow,
    totalOcc, perDay, dayOcc, pBase, pBaseFor, baseSetProb, perDayFor, hazard, RECN,
    from: K?days[0].d:"", to: K?days[K-1].d:"",
    chi2, df, pChi, pCarry, pFresh, carryHits, carryBase, freshHits, freshBase
  };
}

/* hàm phân phối chuẩn tích luỹ (xấp xỉ Abramowitz–Stegun) */
function normCdf(z){
  const t=1/(1+0.2316419*Math.abs(z));
  const d=0.3989423*Math.exp(-z*z/2);
  let p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
  return z>0 ? 1-p : p;
}
/** Khoảng tin cậy Wilson cho tỉ lệ k/n. z mặc định 1.96 (95%). */
function wilson(k,n,z){
  if(!n) return [0,1];
  z = z||1.96;
  const p=k/n, z2=z*z;
  const den=1+z2/n;
  const c=(p+z2/(2*n))/den;
  const h=(z/den)*Math.sqrt(p*(1-p)/n + z2/(4*n*n));
  return [Math.max(0,c-h), Math.min(1,c+h)];
}
/** z tương ứng mức α sau hiệu chỉnh Bonferroni cho U phép so sánh */
function zBonf(U,alpha){
  const a=(alpha||0.05)/U;
  // nghịch đảo Φ bằng xấp xỉ Acklam (đủ chính xác cho mục đích hiển thị)
  return -probit(a/2);
}
function probit(p){
  if(p<=0)return -Infinity; if(p>=1)return Infinity;
  const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.3577518672690,-30.66479806614716,2.506628277459239];
  const b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572];
  const c=[-0.007784894002430293,-0.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d=[0.007784695709041462,0.3224671290700398,2.445134137142996,3.754408661907416];
  const pl=0.02425;
  let q,r;
  if(p<pl){ q=Math.sqrt(-2*Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1) }
  if(p>1-pl){ q=Math.sqrt(-2*Math.log(1-p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1) }
  q=p-0.5; r=q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

/* ============================================================================
   PHÂN TÍCH THỐNG KÊ NỘI BỘ — CO NGÓT BAYES THỰC NGHIỆM (Empirical Bayes)
   ----------------------------------------------------------------------------
   Vấn đề của cách làm ngây thơ: "số ra nhiều thì xếp hạng cao".
   Sai, vì phần lớn chênh lệch tần suất giữa các số CHỈ LÀ NHIỄU LẤY MẪU.

   Cách đúng: tách phương sai quan sát được thành 2 phần
       S²  = phương sai tần suất quan sát được giữa các số
       V   = phương sai kỳ vọng nếu MỌI số đều có xác suất như nhau  = p̄(1−p̄)/n
       τ²  = max(0, S² − V)          ← phần "khác biệt thật" giữa các số
       w   = τ² / (τ² + V)           ← tỉ lệ tin cậy được của tần suất, 0…1

   Ước lượng hậu nghiệm:  p_i = p̄ + w · (p̂_i − p̄)

   Ý nghĩa: nếu dữ liệu không phân biệt được với ngẫu nhiên thì τ²=0 → w=0
   → MỌI số cho ra đúng cùng một điểm p̄. Thuật toán tự vô hiệu hoá chính nó
   thay vì bịa ra thứ hạng. Đây là cơ chế chống ngụy biện từ dao động ngắn hạn.
   ========================================================================== */

/** Tính hệ số tin cậy w cho một tập đếm counts[] trên n phép thử. */
function ebWeight(counts, n){
  const U = counts.length;
  if(!n || U < 2) return {w:0, tau2:0, V:0, S2:0, mean:0};
  let sum=0; for(const k of counts) sum += k/n;
  const mean = sum/U;
  let s2=0; for(const k of counts){ const d=k/n-mean; s2 += d*d }
  const S2 = s2/(U-1);
  const V  = mean*(1-mean)/n;
  const tau2 = Math.max(0, S2 - V);
  const w = (tau2+V) > 0 ? tau2/(tau2+V) : 0;
  return {w, tau2, V, S2, mean, spread:Math.sqrt(tau2)};
}
/** Hệ số tin cậy cho MỘT hiệu ứng đơn lẻ (vd lặp lại kỳ trước): d = chênh lệch, se = sai số chuẩn. */
function ebWeight1(d, se){
  const tau2 = Math.max(0, d*d - se*se);
  const w = (tau2 + se*se) > 0 ? tau2/(tau2 + se*se) : 0;
  return {w, tau2, se};
}

/** Độ tin cậy của đường hazard: nó có thật sự biến thiên theo độ gan không? */
function hazardWeight(A){
  const hs=[], vs=[];
  for(let g=0; g<=HAZARD_SCORE_MAX_GAP; g++){
    const r=A.hazard.reach[g], e=A.hazard.evt[g];
    if(r>=HAZARD_SCORE_MIN_REACH){ const h=e/r; hs.push(h); vs.push(h*(1-h)/r) }
  }
  if(hs.length<5) return {w:0};
  const m=hs.reduce((a,b)=>a+b,0)/hs.length;
  const S2=hs.reduce((a,h)=>a+(h-m)*(h-m),0)/(hs.length-1);
  const V=vs.reduce((a,b)=>a+b,0)/vs.length;
  const tau2=Math.max(0,S2-V);
  return {w:(tau2+V)>0?tau2/(tau2+V):0, tau2, V, S2, mean:m};
}

/** Tên hiển thị của từng tín hiệu */
const SIGNAL_INFO = {
  freq:  "Tần suất toàn mẫu",
  rec:   "Tần suất gần đây",
  dow:   "Theo thứ trong tuần",
  gap:   "Khoảng chờ (hazard)",
  carry: "Lặp lại kỳ liền trước",
};

/* Chưa có cấu hình nào vượt kiểm chứng ngoài mẫu. Một lệch có ý nghĩa ngay
   trong cửa sổ đang nhìn chỉ mô tả quá khứ; nó không được phép tự động biến
   thành suy luận cho kết quả tương lai nếu chưa có chứng nhận OOS riêng. */
const MODEL_OOS_VALIDATED = false;

/**
 * Tính toàn bộ hệ số tin cậy cho một kỳ mục tiêu.
 * Trả về object dùng lại cho mọi số → chỉ tính MỘT lần cho mỗi lần xếp hạng.
 */
function buildModel(A, targetDow){
  const U=A.U, K=A.K, pOverall=A.pBase, pTarget=A.pBaseFor(targetDow);
  const cFreq=new Array(U).fill(0), cRec=new Array(U).fill(0), cDow=new Array(U).fill(0);
  for(let i=0;i<U;i++){
    const s=A.S.get(pad(i,A.digits));
    if(s){ cFreq[i]=s.daysCnt; cRec[i]=s.recCnt; cDow[i]=s.dow[targetDow] }
  }
  const nDow=A.dowTotals[targetDow]||0;
  const eFreq=ebWeight(cFreq, K);
  /* Nếu toàn cửa sổ ≤30 kỳ thì “gần đây” chính là “toàn mẫu”; tắt rec để
     không cộng cùng một quan sát hai lần. */
  const eRec =K>A.RECN ? ebWeight(cRec, A.RECN) : {w:0,mean:eFreq.mean};
  const eDow =nDow>=10 ? ebWeight(cDow, nDow) : {w:0,mean:pTarget};
  const eGap =hazardWeight(A);
  // lặp lại kỳ trước: so sánh trực tiếp P(ra|ra kỳ trước) với P(ra|không ra kỳ trước)
  const seC=Math.sqrt(
    A.pCarry*(1-A.pCarry)/Math.max(1,A.carryBase) +
    A.pFresh*(1-A.pFresh)/Math.max(1,A.freshBase));
  const eCar=ebWeight1(A.pCarry-A.pFresh, Math.max(seC,1e-9));

  /* Tâm riêng của từng tín hiệu. EB chỉ được cộng phần lệch SO VỚI TÂM
     của chính tín hiệu đó; trừ tất cả bằng một pBase sẽ biến dao động chung
     của mẫu thành edge giả. */
  const carN=A.carryBase+A.freshBase;
  const carMean=carN ? (A.carryHits+A.freshHits)/carN : pOverall;
  const center={
    freq:eFreq.mean,
    rec:eRec.mean,
    dow:eDow.mean,
    gap:eGap.mean==null?pOverall:eGap.mean,
    carry:carMean,
  };

  const W={freq:eFreq.w, rec:eRec.w, dow:eDow.w, gap:eGap.w, carry:eCar.w};
  const total=W.freq+W.rec+W.dow+W.gap+W.carry;
  return {W, eb:{freq:eFreq,rec:eRec,dow:eDow,gap:eGap,carry:eCar},
          center, totalW:total, targetDow, nDow, seOne:0,
          pB:pTarget, pBOverall:pOverall,
          flat:true};   // rankAll() sẽ tính lại sau khi biết điểm cao nhất
}

/** Điểm của một số = nền + tổng các độ lệch đã co ngót. */
function scoreOf(A, tail, targetDow, M){
  M = M || buildModel(A, targetDow);
  const s=A.S.get(tail), K=A.K, pB=M.pB;
  const nDow=M.nDow;
  const p = {
    freq:  s ? s.daysCnt/K : 0,
    rec:   s ? s.recCnt/A.RECN : 0,
    dow:   (s && nDow) ? s.dow[targetDow]/nDow : pB,
    gap:   A.hazard.predictiveAt(s ? s.curGap : K, M.center.gap),
    carry: (K>0 && A.daySets[K-1].has(tail)) ? A.pCarry : A.pFresh,
  };
  let score = pB, contrib = {};
  for(const k of ["freq","rec","dow","gap","carry"]){
    const d = M.W[k] * (p[k] - M.center[k]);
    contrib[k] = d;
    score += d;
  }
  score = Math.max(pB*0.2, Math.min(score, 0.999));
  return {tail, s, p, contrib, W:M.W, pBase:pB, score, lift:score/pB,
          curGap: s?s.curGap:K, hitPrev: K>0 && A.daySets[K-1].has(tail),
          flat:M.flat, actionable:M.actionable===true};
}

/** Xếp hạng toàn bộ không gian số. Trả kèm .model để UI hiển thị độ tin cậy. */
function rankAll(A, targetDow){
  const M=buildModel(A, targetDow);
  const out=[];
  for(let n=0;n<A.U;n++) out.push(scoreOf(A, pad(n,A.digits), targetDow, M));
  out.sort((a,b)=> b.score-a.score || (b.s?b.s.daysCnt:0)-(a.s?a.s.daysCnt:0) || (a.tail<b.tail?-1:1));
  /* "Phẳng" = ưu thế của số dẫn đầu không vượt được ngưỡng nhiễu.
     QUAN TRỌNG: vì ta chọn MAX trong U số, ngưỡng phải hiệu chỉnh đa so sánh —
     ngẫu nhiên thuần tuý cũng luôn tạo ra một "số dẫn đầu" trông hơn nền vài σ.
     Ngưỡng = z Bonferroni mức α=1% trên U phép so sánh (U=100 → ~3.9σ, U=1000 → ~4.4σ).
     Đã kiểm chứng bằng Monte Carlo trên dữ liệu thật: tín hiệu MN 3 số (ratio 4.08)
     nằm trong vùng nhiễu → phải bị coi là phẳng. */
  M.edge = out[0].score - M.pB;

  /* Sai số của ĐIỂM phải đi theo cỡ mẫu của từng tín hiệu. Dùng K toàn lịch sử
     cho một edge chủ yếu đến từ 30 kỳ gần sẽ làm sai số nhỏ giả tạo và báo
     “có tín hiệu” chỉ vì một số vừa tình cờ ra dày trong 30 kỳ. */
  const top=out[0], binVar=(p,n)=>n>0?p*(1-p)/n:0;
  const gapStat=top.s ? Math.min(top.s.curGap,A.hazard.reach.length-1) : 0;
  const gapN=top.s && A.hazard.predictiveReliable(top.s.curGap)
    ? (A.hazard.reach[gapStat]||0) : 0;
  const carryN=top.hitPrev ? A.carryBase : A.freshBase;
  const scoreVar =
    M.W.freq*M.W.freq*binVar(M.center.freq,A.K) +
    M.W.rec*M.W.rec*binVar(M.center.rec,A.RECN) +
    M.W.dow*M.W.dow*binVar(M.center.dow,M.nDow) +
    M.W.gap*M.W.gap*binVar(M.center.gap,gapN) +
    M.W.carry*M.W.carry*binVar(M.center.carry,carryN);
  M.seOne=Math.sqrt(Math.max(0,scoreVar));
  M.edgeRatio = M.seOne>0 ? M.edge/M.seOne : 0;
  M.zCrit = -probit(0.005/A.U);
  M.flat = M.edgeRatio < M.zCrit;
  M.oosValidated = MODEL_OOS_VALIDATED;
  M.actionable = !M.flat && M.oosValidated;
  for(const r of out){ r.flat=M.flat; r.actionable=M.actionable }
  out.model=M;
  return out;
}

/* ============================================================================
   HÀM THỐNG KÊ LEGACY
   n = số vị trí trung bình/kỳ hợp lệ với "digits" chữ số (VD: G7 2 chữ số bị
   loại khỏi thống kê 3 số — analyze() đã xử lý đúng qua tailsOfDay/perDay).
   p = tỉ lệ lịch sử số đó xuất hiện ít nhất 1 lần trong kỳ.
   Với XSMN, n là TRUNG BÌNH vì số đài dao động 3–4 theo thứ — analyze() đã gộp đúng.
   ========================================================================== */
function evModel(region, scope, digits){
  const A = analyze(DB[region].days, region, scope, digits);
  return {n:A.perDay, p:A.pBase, U:A.U, K:A.K, from:A.from, to:A.to};
}

/* ============================================================================
   PHÂN TÍCH LIÊN MIỀN — XSMN quay 16:15, XSMB quay 18:15 CÙNG NGÀY
   Câu hỏi kiểm tra: kết quả XSMN chiều có liên hệ với XSMB tối không?
   Mọi phép đo dưới đây tính trực tiếp từ dữ liệu, không hằng số cứng.
   ========================================================================== */
function crossAnalyze(digits){
  const U=Math.pow(10,digits);
  const mbMap=new Map(DB.MB.days.map(d=>[d.d,d]));
  const P=[];
  for(const dn of DB.MN.days){ const mb=mbMap.get(dn.d); if(mb) P.push({d:dn.d,mn:dn,mb}) }
  const K=P.length;
  if(!K) return null;
  const sN=P.map(p=>new Set(tailsOfDay(p.mn,"MN","all",digits,false)));
  const sB=P.map(p=>new Set(tailsOfDay(p.mb,"MB","all",digits,false)));

  /* T1: số ra ở XSMN chiều có dễ ra ở XSMB tối hơn không? */
  let a=0,an=0,b=0,bn=0;
  for(let i=0;i<K;i++) for(let k=0;k<U;k++){
    const t=pad(k,digits), inN=sN[i].has(t), inB=sB[i].has(t);
    if(inN){ an++; if(inB) a++ } else { bn++; if(inB) b++ }
  }
  const pIn=an?a/an:0, pOut=bn?b/bn:0;
  const seT1=Math.sqrt((an?pIn*(1-pIn)/an:0)+(bn?pOut*(1-pOut)/bn:0));
  const zT1=seT1>0?(pIn-pOut)/seT1:0;

  /* T2: số trùng nhau mỗi ngày — thực tế vs nếu độc lập */
  let sum=0;
  for(let i=0;i<K;i++){ let c=0; for(const t of sN[i]) if(sB[i].has(t)) c++; sum+=c }
  const avgOverlap=sum/K;
  const pN=sN.reduce((x,s)=>x+s.size,0)/K/U, pB=sB.reduce((x,s)=>x+s.size,0)/K/U;
  const expOverlap=U*pN*pB;

  /* T3: quét mọi phép dịch GĐB miền Nam +k → có ra ở XSMB không? */
  const gN=P.map(p=>p.mn.draws[0].nums[17].slice(-digits));
  let best={z:0,k:0,p:0};
  for(let k=0;k<U;k++){
    let hit=0;
    for(let i=0;i<K;i++) if(sB[i].has(pad((+gN[i]+k)%U,digits))) hit++;
    const pk=hit/K, se=Math.sqrt(pB*(1-pB)/K), zk=se>0?(pk-pB)/se:0;
    if(Math.abs(zk)>Math.abs(best.z)) best={z:zk,k,p:pk};
  }
  const zCrit=-probit(0.025/U);

  /* T4: đối chiếu số miền Nam với miền Bắc trong cùng ngày */
  const bt=[];
  for(const N of [5,10,20]){
    let hit=0,base=0,n=0;
    for(let i=0;i<K;i++){
      const cand=[...sN[i]]; if(cand.length<N) continue;
      let h=0; for(const t of cand.slice(0,N)) if(sB[i].has(t)) h++;
      hit+=h; base+=N*sB[i].size/U; n++;
    }
    bt.push({N, avg:n?hit/n:0, exp:n?base/n:0, lift:base?hit/base-1:0});
  }

  return {K, from:P[0].d, to:P[K-1].d, U, digits,
    t1:{pIn,pOut,z:zT1,n:an}, overlap:{avg:avgOverlap,exp:expOverlap},
    shift:{...best, base:pB, zCrit}, bt, pN, pB};
}

/** Thống kê gộp cả 2 miền: mỗi ngày cộng dồn số đuôi của cả XSMN và XSMB */
function mergedDays(digits){
  const mbMap=new Map(DB.MB.days.map(d=>[d.d,d]));
  const out=[];
  for(const dn of DB.MN.days){
    const mb=mbMap.get(dn.d); if(!mb) continue;
    out.push({d:dn.d, w:dn.w, mn:dn, mb});
  }
  return out;
}

/* ---------------------------------------------------------------------------
   BỘ PHÂN BỔ ĐỀU (legacy)
   Khi mô hình phẳng (w≈0), mọi số có kỳ vọng như nhau.
   Hàm giữ kết quả tái lập được theo ngày bằng PRNG mulberry32 gieo hạt từ
   chuỗi ngày+miền+số chữ số.
--------------------------------------------------------------------------- */
function hashSeed(str){
  let h=2166136261>>>0;
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0 }
  return h>>>0;
}
function mulberry32(a){
  return function(){
    a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15), 1|a);
    t=(t+Math.imul(t^(t>>>7), 61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
/** n số phân biệt, chọn đều, tái lập được từ seedStr. */
function unbiasedPick(U, digits, n, seedStr){
  const rnd=mulberry32(hashSeed(seedStr));
  const seen=new Set(), out=[];
  let guard=0;
  while(out.length<n && guard++<n*200){
    const v=Math.floor(rnd()*U);
    if(!seen.has(v)){ seen.add(v); out.push(pad(v,digits)) }
  }
  return out;
}
/** Xác suất có ít nhất một số xuất hiện trong tập số (giả định độc lập gần đúng) */
function setHitProb(list){
  let q=1; for(const r of list) q*= (1-Math.min(r.score!=null?r.score:r,0.99));
  return 1-q;
}
