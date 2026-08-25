# BLUEPRINT — Đặc tả chuẩn của Kết Số

> Tài liệu thiết kế gốc. **Mọi model/người build tiếp phải đọc file này + [RULES.md](RULES.md) trước khi sửa.**
> [ROADMAP.md](ROADMAP.md) cho biết *đang ở đâu, làm gì tiếp*; file này cho biết *app phải như thế nào và vì sao*.

---

## 1. Triết lý sản phẩm — 3 nguyên tắc không đổi

1. **Một luồng kết quả rõ ràng:** người dùng xem kết quả đang quay và các kỳ gần nhất trước, rồi mới tra cứu
   lịch sử **2 số đuôi (00–99)** hoặc **3 số đuôi (000–999)** cho XSMN/XSMB. Phần public không chọn dàn,
   không công bố số cho kỳ tiếp theo và không mở rộng sang loại số khác.
2. **Toán quyết định, không phải cảm xúc:** mọi con số trên UI đều truy được về một công thức trong `app.js`
   và đều so được với mức nền. Trọng số tín hiệu do **dữ liệu tự quyết** (mục 3.4), không ai đặt tay.
3. **Trung thực là tính năng:** app đã tự đo và biết xổ số không có trí nhớ (mục 4).
   Khi toán nói "không số nào hơn số nào", app **nói đúng như vậy**. Backtest, đối chứng in/out-sample và
   khoảng tin cậy vẫn là lớp kiểm toán nội bộ; giao diện public chỉ trình bày lịch sử, không biến chúng thành dự báo.

---

## 2. Kiến trúc

```
┌────────────┐  crawl 8 luồng   ┌──────────────┐   <script src>   ┌──────────────┐
│ xosodaiphat│ ───────────────► │  update.py    │ ───────────────► │  index.html  │
│ GitHub CSV │                  │  → data/*.js  │                  │  app.js (toán)│
└────────────┘                  └──────┬───────┘                  │  ui.js  (vẽ) │
                                       │ gọi định giờ             └──────▲───────┘
                                ┌──────┴───────┐    /api/status + reload  │
                                │   serve.py    │ ─────────────────────────┘
                                │ 127.0.0.1:8368│   (chế độ LIVE, tự cập nhật)
                                └──────────────┘
```

| File | Vai trò | Cấm |
|---|---|---|
| `app.js` | **Toán thuần**: parse, `analyze()`, EB shrinkage, hazard, Wilson, χ², `rankAll()`, `unbiasedPick()` | đụng DOM |
| `ui.js` | **Vẽ**: 5 view public (`live/history/ana/cross/verify`), modal lịch sử, tooltip; model/backtest/nhật ký cũ là code legacy không public | tự chế công thức |
| `templates/index.template.html` | Nguồn khung SPA; `index.html` là đầu ra có fallback kết quả tĩnh | logic |
| `app.css` | CSS chung của app và các trang công khai tĩnh | logic |
| `update.py` | Crawler đa luồng, alias tên đài, lock, ghi nguyên tử | logic hiển thị |
| `serve.py` | HTTP + vòng tự cập nhật 16:35/18:32 | logic thống kê |

Không framework, không npm/pip/CDN. `build_pages.py` tạo HTML có kết quả sẵn cho các route công khai;
`MoApp.bat` → chế độ LIVE cho lớp app tương tác.

---

## 3. Đặc tả thuật toán (đủ để code lại từ đầu)

### 3.1 Dữ liệu → số đuôi
- XSMB: 27 số/kỳ, thứ tự `GĐB,G1,G2×2,G3×6,G4×4,G5×6,G6×3,G7×4`, độ dài `5…5,4…4,3,3,3,2,2,2,2`.
- XSMN: 18 số/đài/kỳ, thứ tự `G8,G7,G6×3,G5,G4×7,G3×2,G2,G1,GĐB`, độ dài `2,3,4×4,5×12,6`.
- `tailsOfDay(day, region, scope, digits)` → mảng đuôi (có lặp). Scope `dd` = {GĐB+G7} (MB) / {G8+GĐB} (MN).
  Số ít chữ số hơn `digits` bị bỏ qua.
- Đơn vị thống kê chuẩn: **kỳ (ngày)**. `daysCnt` đếm ngày có mặt (unique), `occ` đếm mọi lần.

### 3.2 `analyze(days, region, scope, digits)` — một lượt O(K·perDay)
Tính: `S[tail] = {occ, daysCnt, hits[], last, dow[7], recCnt, carryHit, carryBase, curGap, minGap, maxGap, gaps[], avgGap, cv}`,
`dowTotals[7]`, `occDow[7]`, `daySets[]`, carry toàn cục, hazard, χ².

- **Nền:** tính chính xác theo từng kỳ rồi lấy trung bình:
  `baseSetProb(n,w) = mean_day[1 − (1 − n/U)^m_day]`, với `m_day` là số vị trí hợp lệ của kỳ đó.
  `pBase = baseSetProb(1)` và **nền theo thứ** `pBaseFor(w) = baseSetProb(1,w)`
  — vì XSMN ngày 3 đài vs 4 đài chênh lớn (đo được: T2–T6 ≈ 41,9% · T7 ≈ 50,9%).
- **Hazard Kaplan–Meier:** gap hoàn chỉnh g → `evt[g]++` và `reach[0..g]++`;
  khoảng chờ hiện tại (kiểm duyệt phải) chỉ cộng `reach`. Phần mô tả có thể dùng `reach≥40`, nhưng **điểm dự báo chỉ dùng
  g≤25 và reach≥200**; ngoài vùng đã đo ổn định phải trả về tâm/nền, cấm ngoại suy từ risk-set cực nhỏ.
- **χ²:** `Σ(O−E)²/E` với E=`totalOcc/U`; `pChi` dùng biến đổi Wilson–Hilferty về chuẩn.

### 3.3 Co ngót Bayes thực nghiệm — TRÁI TIM của app
Cho mỗi tín hiệu (freq / rec / dow / hazard / carry):
```
S² = phương sai quan sát giữa các số      V = p̄(1−p̄)/n  (nhiễu lấy mẫu thuần)
τ² = max(0, S² − V)                        w = τ²/(τ²+V)  ∈ [0,1]
score(i) = pBaseFor(targetDow) + Σ_signals w_s · (p̂_s(i) − mean_s)
```
- `w≈0` → chênh lệch là nhiễu → tín hiệu **tự tắt**. Không ai đặt trọng số tay. (`ebWeight`, `ebWeight1`, `hazardWeight`)
- Mỗi tín hiệu phải trừ **tâm riêng `mean_s`** của chính nó. Trừ tất cả bằng một `pBase` sẽ biến lệch chung của mẫu thành edge giả.
- **Phát hiện phẳng trong mẫu:** `edge = score_max − pBaseFor(targetDow)`; `seOne` là căn tổng phương sai của
  từng thành phần sau khi nhân `w_s`, dùng đúng cỡ mẫu của tín hiệu (K, 30, số kỳ theo thứ, risk-set, carry/fresh);
  `edgeRatio = edge/seOne`; `zCrit = −probit(0.005/U)`
  (Bonferroni α=1% vì ta chọn MAX trong U số → U=100 ≈ 3,89σ, U=1000 ≈ 4,42σ); `flat = edgeRatio < zCrit`.
- **Cổng hành động:** chỉ được lấy Top-N khi `flat=false` **và** cấu hình có chứng nhận ngoài mẫu được chốt trước.
  Hiện chưa cấu hình nào đạt, nên `MODEL_OOS_VALIDATED=false` và app chọn đều.
- **Khi chưa đạt cổng hành động:** chọn đều bằng `unbiasedPick(U, digits, n, seed)` — PRNG mulberry32, seed từ
  `ngày|miền|digits|scope|đài` → **tái lập được** (cùng ngày = cùng số). Không có nút reroll.

### 3.4 Giao thức backtest (cấm vi phạm)
- Cửa sổ huấn luyện chỉ chứa ngày `< ngày đích`. Chạy theo lô ≤110ms/lô để không treo UI.
- Báo cáo: trúng TB/kỳ vs chọn bừa, uplift, top1 vs nền + p-value nhị thức,
  và **bảng đối chứng in-sample vs out-of-sample** (shift bội 7 để giữ thứ) — thước đo overfit, cấm gỡ.
- Mặc định 300 kỳ; <200 kỳ phải hiện cảnh báo mẫu nhỏ.

### 3.5 Phạm vi lọc thống kê
Phạm vi giải là một thuộc tính của phép phân tích: `all` dùng toàn bộ giải, còn `dd` dùng
G7 + GĐB (XSMB) hoặc G8 + GĐB (XSMN). Mỗi phạm vi có số vị trí quay và mức nền khác nhau,
nên mọi bảng phải tính `pBaseFor(w)` theo đúng phạm vi đang xem.

| Phạm vi (XSMB, 2 số) | Bộ số/kỳ | Mức nền mỗi số |
|---|---:|---:|
| Tất cả giải | 27 | 23,77% |
| G7 + GĐB | 5 | **4,90%** |

---

## 4. Sự thật đã đo — nền tảng mọi quyết định thiết kế

Đo trên XSMB **7.513 kỳ** (2005→05/08/2026) và XSMN **6.658 kỳ** (2008→05/08/2026), script tái lập ở `work/`:

| # | Câu hỏi | Kết quả | Hệ quả thiết kế |
|---|---|---|---|
| 1 | Lặp lại kỳ trước? | MB 23,94% vs nền 23,77% · MN 43,19% vs 43,25% | Không có thật → w_carry tự về ~0 |
| 2 | Gan lâu dễ nổ? | hazard g0→g15: 23,9→24,0% — phẳng | "Sắp nổ" là nguỵ biện; app hiển thị đường hazard để chứng minh |
| 3 | Dữ liệu lệch ngẫu nhiên? | MB p=0,33 (không) · MN p=0,0015 (lệch — do gộp đài/thời kỳ) | Cảnh báo khi χ² lệch, khuyên lọc 1 đài |
| 4 | Backtest ngoài mẫu sau sửa công thức (1.000 kỳ, W=365, dàn 5) | all-2: MB +1,4%, MN +3,1%; top1 z −0,07 / +0,78. Quét đủ 8 cấu hình: max |z|=1,01 | Không có kỹ năng dự đoán → điểm chỉ là xếp hạng |
| 5 | Backtest trong mẫu | +17,5% | = độ ảo overfit; giữ bảng đối chứng làm bằng chứng |
| 6 | Tín hiệu thật trong tần suất (EB, toàn dữ liệu) | w: MB2 **0,000** · MB3 0,059 · MN2 0,278 · MN3 0,068 | MB2: 100% chênh lệch là nhiễu |
| 7 | Ưu thế top1 / sai số đo, full-history all-scope, mục tiêu T5 | MB2 0,97/3,89 · MB3 4,28/4,42 · MN2 2,35/3,89 · MN3 **4,55/4,42** | MN3 chỉ vượt trong mẫu; OOS top1 z=−1,01 → **actionable 0/4**, chọn đều |
| 8 | Nền theo thứ (MN) | 2 số: ngày 3 đài 41,88% · **T7 50,87%** — tính chính xác theo từng kỳ | Bắt buộc `pBaseFor(w)`; biến cấu trúc thật duy nhất |
| 9 | Mùa/tháng (MB, 12×χ² df=99) | tháng lệch nhất p=0,022 > ngưỡng Bonferroni 0,0042 | **Không có mùa số.** Cấm thêm "yếu tố mùa" vào scoring |
| 10 | Năm/era (MB, 22×χ²) | chỉ 2010 lệch (số 59, z=4,21) — không lặp lại năm nào khác | Nhiễu đa so sánh, không dùng được |
| 11 | Tín hiệu MN3 w=0,068 soi kỹ | Monte Carlo null p=0,06 · 6/10 đài w≈0 (TPHCM=0,000) · era 2015-2020 w=0,000 | **ARTIFACT** do gộp dữ liệu cũ. Không phải tín hiệu |
| 12 | Chữ số đơn vị GĐB MB theo era 5 năm | p = 0,20–0,86 mọi giai đoạn | Không có mòn bóng/lệch cơ học phát hiện được |
| 14 | Thứ mấy số nào hay ra? (700 ô: 100 số × 7 thứ) | Ô lệch nhất **66 vào T3** z=3,78 · ngưỡng Bonferroni 3,97 | Không có "số của thứ" |
| 15 | Ngày dương lịch 1–31 · ngày lễ (01/01, 30/4, 1/5, 2/9) | 31 kiểm định không ngày nào qua ngưỡng · 83 kỳ lễ p=0,63 | Không có yếu tố lịch |
| 16 | Tự tương quan chuỗi (GĐB hôm nay vs hôm qua) | r = 0,0119 (sai số ±0,0226) | Không có trí nhớ |
| 17 | Quét 41 cửa sổ rời nhau × 180 kỳ | **2024-03-28→09-23 lệch thật**: χ²=164,6; Monte Carlo (PRNG sfc32 đã kiểm chuẩn) p=0,0015 | Có **đúng 1** giai đoạn bất thường |
| 18 | Giai đoạn đó có bền vững / dùng được không? | Tương quan z nửa đầu ↔ nửa sau r=0,166 (±0,196) · 672 kỳ sau đó: 22/32/89 về z −0,33…+0,49, χ²=87,5 | **Không** — bùng phát rồi tắt, không tiên đoán được |
| 19 | **XSMN chiều có đoán được XSMB tối không?** (6.583 ngày có đủ 2 miền) | Ra ở MN → **23,880%** ra ở MB · không ra ở MN → **23,804%** (chênh 0,076pp, z=0,72) | **KHÔNG** |
| 20 | Số trùng nhau mỗi ngày giữa 2 miền | Thực tế **10,30**/ngày · nếu độc lập **10,28** | Đúng như độc lập |
| 21 | Quét 100 phép dịch GĐB miền Nam +k → XSMB | Mạnh nhất k=30: z=−2,09 · ngưỡng Bonferroni 3,48 | **KHÔNG** |
| 22 | Backtest "đánh lại số XSMN sang XSMB" | N=5 **+0,7%** · N=10 **+0,3%** · N=20 **−0,1%** so chọn bừa | Không có edge |
| 23 | **Quét lệch cơ học từng vị trí chữ số** (không gộp đuôi — nhạy hơn hẳn vì mỗi giải dùng lồng cầu riêng cho từng chữ số) | MB: 107 vị trí, **0 vượt Bonferroni** (p<4,67e-4). MN: 82 vị trí, 2 vượt — cả hai đều giải thích được (dưới) | Không có bằng chứng lồng cầu/bóng nào lệch, ở bất kỳ vị trí nào đo được |
| 24 | Soi 2 vị trí MN "lệch": GĐB-chữ-số-1 (χ²=1153!) và G4-chữ-số-2 (χ²=24,6) | GĐB-d1: số 0 chiếm 95,5% (2008) → 49,0% (2009) → ổn định 8–12% (2010→nay) — **GĐB đổi từ <6 sang đúng 6 chữ số năm 2010**, không phải lệch bóng. G4-d2: Monte Carlo p=0,004 nhưng kỳ vọng ~0,3/82 ô đạt mức này do ngẫu nhiên — **1 ô trong 82 phép thử không bất thường** | Cả hai là artifact/nhiễu đa so sánh, không phải rig. `norm_prov`/parser không cần sửa vì đuôi (chữ số cuối) không bị ảnh hưởng — GĐB-d1 là chữ số **đầu**, không nằm trong đuôi 2/3 số |
| 25 | XSMB có còn quay trực tiếp trên truyền hình không? (tiền đề "hết ai giám sát bằng mắt") | **Sai.** Vẫn quay live hằng ngày 18:00–18:30 tại 53E Hàng Bài — chỉ đổi kênh (VTC9 "Let's Việt" → VTVCab4 "On Movie" từ 15/01/2025). XSMN: mỗi đài tự phát trực tiếp trên kênh truyền hình tỉnh mình (phân tán kênh, không phải ngừng phát) | Tiền đề "không ai xem live được nữa" không đúng thực tế — vẫn có kênh, giờ cố định, camera lưu theo TT 22/2021 |

**Bối cảnh cơ chế (đã tra cứu có nguồn):** [Thông tư 22/2021/TT-BTC của Bộ Tài chính](https://vbpq.mof.gov.vn/DKC.FileManagement/FileStorage/File/103180) quy định Hội đồng giám sát kiểm tra
thiết bị quay, bóng, việc niêm phong và quy trình quay thưởng. Không giữ các chi tiết chưa đủ nguồn như xuất xứ thiết bị,
dung sai hay thời gian lưu camera. Dữ liệu kết quả có thể phát hiện lệch phân phối, nhưng không tự xác định nguyên nhân
hay chứng minh tuyệt đối không có can thiệp.
Trong dữ liệu của app, chưa có phép phân tích tần suất nào tạo được lợi thế ngoài mẫu đủ tin cậy.

**Lập luận về "yếu tố ngoại cảnh" (thời sự / thời tiết / bão / chính trị):** không cần kiểm từng yếu tố.
Bất kỳ yếu tố nào tác động được lên số đều phải làm phân phối lệch ở giai đoạn tương ứng.
Đã quét theo tháng (#9), năm (#10), ngày & lễ (#15), và 41 cửa sổ 180 kỳ (#17) — chỉ tìm thấy đúng
một giai đoạn lệch, và chính nó cũng không lặp lại (#18). Bất thường thống kê chỉ là cờ cần điều tra thêm,
không tự động đồng nghĩa gian lận hay chỉ ra nguyên nhân vật lý.
**Đừng thêm biến ngoại cảnh vào mô hình** — đã đo là không có.

> ⚠️ **Bẫy đã gặp khi tự đo:** LCG tự chế (`seed*1103515245+12345`) cho phân phối χ² sai lệch nghiêm trọng
> (max 147–150 thay vì trải 120–170) → suýt báo dương tính giả. Monte Carlo **bắt buộc** dùng PRNG tốt
> (sfc32/mulberry32 gieo bằng `crypto`) và **phải tự kiểm**: χ² mô phỏng trung bình ≈ df, sd ≈ √(2·df).
> Ngoài ra xấp xỉ chuẩn `(χ²−df)/√(2df)` sai ở đuôi (cho 1,6e-6 trong khi Wilson–Hilferty cho 4,0e-5) —
> khi cần p-value chính xác ở đuôi thì dùng Wilson–Hilferty hoặc Monte Carlo.

**Về việc XSMB quay sau XSMN (16:15 vs 18:15):** biết trước kết quả miền Nam **không** giúp đoán miền Bắc (#19–22).
Hai miền dùng hai bộ lồng cầu, hai thành phố, hai hội đồng giám sát khác nhau — không có đường truyền vật lý.
Tab 🔗 2 Miền tồn tại để người dùng **tự kiểm chứng điều này**, và để xem kết quả XSMN chiều khi XSMB chưa quay
(thông tin thật, chỉ là không mang giá trị dự đoán). **Cấm** biến tab đó thành công cụ dự đoán đối chiếu hai miền.

**Về nghi vấn thao túng ("rig"):** #23–25 là bộ kiểm tra granular nhất có thể làm từ dữ liệu công khai — soi
từng chữ số ở từng vị trí (không phải đuôi gộp) vì đó là nơi lệch bóng/lồng cầu vật lý sẽ lộ rõ nhất, không bị
trung hoà bởi việc gộp nhiều vị trí lại. Kết quả: **0 bằng chứng** ở cả hai miền, trên toàn bộ lịch sử có được.
Một kiểm định thống kê "lệch" không tự nó chứng minh hay loại trừ gian lận — nó chỉ là cờ cần điều tra thêm bằng
nguồn ngoài dữ liệu tần suất (băng ghi hình, biên bản Hội đồng giám sát…), việc mà app này không tiếp cận được.
**Do đó app không xây tính năng "tín hiệu rig để hành động theo":** (a) chưa từng có bằng chứng nào trong dữ liệu,
(b) phân biệt "lệch 3-sigma do may rủi" với "gian lian thật" từ tần suất lịch sử đơn thuần gần như bất khả thi —
chính quá trình đo #17, #24 vừa cho thấy 2 lần suýt báo sai (LCG tự chế, và ngộ nhận GĐB-d1 là lệch bóng) dù đã
rất cẩn thận, (c) các vụ gian lận xổ số có thật trong lịch sử (PA 1980 Triple Six Fix, Eddie Tipton/Hot Lotto)
đều bị phát hiện qua **kiểm toán vận hành/phần mềm và mẫu hình giao dịch bất thường**, không phải bằng phân tích
tần suất kết quả của người dùng bên ngoài — nên đó không phải việc app này có thể làm thay.

**Nghiên cứu mở rộng (Fibonacci, số học, thần số học, ARIMA/ML/BigData) — tổng hợp quyết định:**
| Hướng | Đã kiểm tra | Kết luận |
|---|---|---|
| Fibonacci | Pisano mod 100 = chu kỳ 300, **chạm đủ 100/100** số; mod 1000 = chu kỳ 1500, **chỉ chạm 750/1000 (75%)** | 2 số: vô hại nhưng vô ích. 3 số: tự loại 25% không gian số, không đổi lại gì — **cấm dùng để lọc dàn** |
| Chuỗi thời gian bậc cao (Markov bậc 2, Fourier/spectral, entropy) | Markov bậc 1→2 (MB) LR=876,6 p(chuẩn)=0,049 nhưng **Monte Carlo p thật=0,21** (xấp xỉ chuẩn sai vì ~7,5 quan sát/ô); spectral 100 chuỗi/miền: MB 0 chuỗi qua Bonferroni, MN "chu kỳ 7" hoá ra chỉ là cấu trúc T7-4-đài đã biết (tách riêng thì null); entropy = 99,85% mức tối đa (gần như không nén được) | **Không có trí nhớ bậc cao, không có chu kỳ ẩn.** Xấp xỉ χ² chuẩn không đáng tin khi ô thưa — luôn Monte Carlo khi nghi ngờ (đã ghi thành luật, xem cảnh báo PRNG ở trên) |
| Số học / bay đa so sánh | Mọi phép chia tập con (chẵn/lẻ, kép, bống số, tổng chia hết…) đều có EV giống hệt nhau vì rút mẫu đều — chọn tập con nào cũng như tập con nào. Quét N cách chia càng nhiều thì càng chắc tìm ra ≥1 cách "có vẻ lệch" chỉ do may rủi | Nhóm số trong tab Cầu & Mẫu chỉ để **mô tả**, không phải căn cứ chọn — đã có disclaimer đúng chỗ |
| Các trường hợp tạo lợi thế có thật (Mandel, [Cash WinFall](https://newsfeed.time.com/2012/08/07/how-mit-students-scammed-the-massachusetts-lottery-for-8-million/), Srivastava, Tipton, phương pháp Thorp) | Mọi ca đều đến từ: mua hết tổ hợp khi EV dương tạm thời (roll-down phá vỡ tính pari-mutuel), lỗi thiết kế vé in sẵn, gian lận phần mềm RNG, hoặc bài **không hoàn lại nên có bộ nhớ trạng thái** (khác rút thăm có hoàn lại) | **Không trường hợp nào** đến từ phân tích tần suất lịch sử của máy quay công bằng — nhóm này không áp dụng được cho app |
| Thần số học (Kinh Dịch/Lạc Thư, Pythagoras, Veda, quan niệm Việt/Hoa) | Có hiệu ứng kinh tế **thật** lên giá cả do con người định giá (biển số xe TQ/HK: số "8" +hàng chục nghìn USD, "4" giảm giá — [nghiên cứu ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S016748700700027X)) — nhưng đó là hành vi **người mua**, không phải xác suất **máy quay** | Giá trị thật của các hệ thống này là tâm lý/văn hoá/kỷ luật chọn số, không phải dự đoán — nêu ở tab Trợ giúp với sự tôn trọng, không dùng để tính điểm |
| ARIMA | Giả định biến liên tục có tự tương quan; đuôi xổ số là biến **danh mục** (khoảng cách 00↔99 vô nghĩa) và tự tương quan lag-1 đã đo = 0,012±0,023 → ARIMA suy biến về ARIMA(0,0,0) = **dự đoán bằng trung bình**, đúng bằng nền app đã tính | Không có gì để ARIMA học — dùng nó chỉ là vỏ bọc phức tạp hoá cho phép tính đã có |
| Machine Learning (LSTM/XGBoost…) | Nếu X (lịch sử) không mang thông tin về Y (kỳ tới) — đã chứng minh qua toàn bộ bảng #1–22 — mọi mô hình dù mạnh đến đâu cũng hội tụ về dự đoán = tỉ lệ nền khi tối ưu đúng cách; sai khác so với nền trên tập test chỉ là overfit (giống *y hệt* bảng đối chứng #4–5 app đã có) | Thêm ML = thêm nguy cơ overfit, không thêm tín hiệu. **Cấm build** |
| Big Data (nhiều dữ liệu hơn) | Thêm dữ liệu giảm **phương sai** của ước lượng (khoảng tin cậy hẹp lại) chứ không tạo ra tín hiệu nếu tín hiệu thật = 0. Bảng #1–22 đã dùng *toàn bộ* dữ liệu có được | Không có "thêm data để đoán đúng hơn" — chỉ có "thêm data để đo chính xác hơn rằng không có gì" |

**⚠ Theo dõi 2026:** 21 công ty XSMN hiện vẫn hoạt động và lịch quay không đổi. Con số 9 trong quy định phân vùng là số tỉnh/thành, không phải số công ty. Nếu có chỉ đạo mới làm đổi tên đài hoặc lịch quay thì cập nhật `PROV_ALIAS` và `expected_mn_draws()` theo quy trình ROADMAP.
Lỗ hổng dữ liệu hợp lệ (không phải lỗi crawler): COVID 4/2020 cả nước · XSMN 09/7–21/10/2021 · XSMB 08–22/8/2021 · Tết ~4 ngày/năm (chỉ XSMB nghỉ).

**Ghi đè bảng này chỉ khi có phép đo mới ≥300 kỳ, và phải cập nhật cả ROADMAP.**

---

## 5. Đặc tả UI public — 5 tab, tên đời thường

| Tab | Mục đích | Thành phần chính |
|---|---|---|
| 🔴 **Kết quả** | Xem kết quả mới nhất | XSMN/XSMB switch · trạng thái theo giờ Việt Nam · bảng tự dựng từ kho dữ liệu · tải lại |
| 🗓️ **Lịch sử** | Xem lại theo ngày | 14 kỳ gần nhất mặc định · mở dần đến 120 kỳ · bảng đầy đủ từng giải |
| 📊 **Thống kê** | Tra cứu dữ liệu cũ | 3 màn con: Bản đồ số · Khoảng cách · Mẫu lịch sử |
| 🔗 **Hai miền** | Dò và kiểm tra liên miền | Kết quả hai miền cùng ngày · phép đo XSMN chiều vs XSMB tối · thống kê gộp |
| ℹ️ **Nguồn** | Minh bạch dữ liệu | Nguồn bảng live · độ sâu kho · lịch cập nhật tự động · giới hạn thống kê |

**Quy tắc UI bắt buộc:**
- Mọi thuật ngữ có dấu **!** (class `info`, `data-tip=key` → `GLOSSARY[key]` trong ui.js). Thêm chỉ số mới = thêm entry GLOSSARY + dấu !.
- **Bản đồ số:** màu theo **thứ hạng phần trăm** (`percentileMap`), chữ tự đổi đen/trắng theo độ sáng
  (`heatColor`), viền nổi bật khi |z|≥2σ. Chú giải dùng lời đời thường và luôn nêu mức chung; không bao giờ
  biến màu nổi bật thành lời dự báo.
- Bấm số ở bất kỳ đâu → `openNum(tail, digits)`.
- Trang Kết quả hiển thị bảng tự dựng từ kho dữ liệu; nguồn và thời điểm cập nhật phải đọc được ngay trong ứng dụng.
- Không tràn ngang ở 375px và 1280px (script kiểm ở RULES §R4; bẫy `min-width:auto` của grid/flex).
- Thanh kỳ mẫu trên mobile cuộn ngang một hàng; không có bộ chọn “Tại ngày”.
- Việc nặng chia lô ≤110ms (mẫu: `runBacktest`).
- Màu/token: dùng biến `:root` có sẵn, không hardcode.

---

## 6. Dữ liệu & vận hành

- Định dạng `data/xsmb.js`, `data/xsmn.js`, alias tên đài (`PROV_ALIAS` — TP.HCM≡TPHCM…, đúng **21 đài**),
  lock chống chạy trùng, ghi nguyên tử — chi tiết ở RULES §R3.
- Local: XSMN quay 16:15 → `serve.py` tự crawl 16:35 · XSMB 18:15 → 18:32 · trang tự reload.
- Public: GitHub Actions crawl 16:42 và 18:42 giờ Việt Nam, sinh lại HTML tĩnh rồi commit khi có đổi để Vercel redeploy.
- `TaiDuLieu.bat` (một lần) · `MoApp.bat` (hằng ngày) · `CapNhat.bat` (thủ công).
- Nguồn hỏng → quy trình chẩn đoán RULES §R6. Kho `data/xsmn.json` là tài sản — cấm xoá.

---

## 7. Việc tiếp theo (thứ tự ưu tiên, kèm tiêu chí nghiệm thu)

> **Giai đoạn xây đã xong.** Không tồn tại tín hiệu dự đoán (§4) ⇒ thêm tính năng phân tích = giá trị 0.
> Việc còn tạo giá trị là giữ nguồn live/crawler ổn định và kiểm tra dữ liệu mới không làm vỡ parser.

| # | Việc | Nghiệm thu |
|---|---|---|
| — | Nhật ký/dự báo kỳ sau | Không public; website chỉ công bố kết quả và dữ liệu quá khứ |
| ✅ | ~~Cảnh báo dữ liệu cũ~~ | Xong — vàng khi trễ 1 kỳ, đỏ khi ≥2 kỳ, có nút cập nhật ngay |
| — | Ghim/loại số trong dàn gợi ý | Code legacy không public; không dùng cho định hướng Kết Số |
| ✅ | ~~So sánh nhiều cửa sổ cạnh nhau cho 1 số~~ | Xong — 3 tháng/1 năm/3 năm/toàn bộ + KTC |
| — | **Lọc theo giải cụ thể** (chỉ GĐB, chỉ G7…) | Hoãn vô thời hạn; xem ROADMAP §5 |
| — | **PWA offline** | Chỉ có manifest; không thêm service worker để tránh cache dữ liệu cũ |
| 6 | Kiểm tra parser mọi thời kỳ 2008–2026 + nguồn dự phòng | Script quét 20 ngày rải đều parse đủ 18 số/đài |

Việc **cấm làm**: tự tối ưu trọng số theo backtest rồi ship (overfit); mọi thứ trong RULES §R2.4.

---

## 8. Trước khi báo "xong" (tóm tắt — đầy đủ ở RULES §R5)

```bash
node --check app.js && node --check ui.js
```
5 view public × 2 miền × 2 chế độ số + 3 màn con Thống kê, console sạch, không tràn ngang 375/1280px,
backtest 300 kỳ <10s, `py update.py` không mất dữ liệu. Đổi công thức → đo lại + cập nhật bảng mục 4.
