# ROADMAP — Kết Số

> Bản đồ dự án: đang ở đâu, làm gì tiếp. Đọc cùng 2 file bắt buộc:
> **[BLUEPRINT.md](BLUEPRINT.md)** — đặc tả thiết kế + thuật toán + bảng sự thật (NGUỒN CHUẨN DUY NHẤT)
> **[RULES.md](RULES.md)** — luật code/thống kê/dữ liệu + checklist trước khi báo xong

## 🔒 v1.0 — khoá ngày 07/08/2026

App đã qua vòng polish UI/UX cuối cùng và được chốt để **dùng lâu dài, không chủ động sửa/thêm nữa**.
Toàn bộ checklist RULES §R5 đã chạy sạch (xem mục 4 dưới). Chỉ nên động vào code khi:
1. Nguồn dữ liệu hỏng (theo quy trình RULES §R6), hoặc sáp nhập đài 2026 đổi tên (mục 4 "Cần theo dõi"), hoặc
2. Một cấu hình đạt chứng nhận OOS thật (không phải chỉnh tay) — lúc đó mới bật `MODEL_OOS_VALIDATED`, hoặc
3. Lỗi thật phát sinh khi dùng (không phải "thêm tính năng cho vui").
Đừng đổi công thức chấm điểm hay thêm tín hiệu mới chỉ vì "có thể đoán chính xác hơn" — 25 phép đo ở
BLUEPRINT §4 đã chỉ ra hướng đó không có kết quả, tốn công mà không đổi được kết luận cốt lõi.

> Cập nhật triển khai 25/08/2026: theo yêu cầu chuyển sang website public, v1.0 được giữ nguyên phần
> thống kê/scoring để kiểm toán nội bộ. Lớp public có 5 tab `Kết quả/Lịch sử/Thống kê/Hai miền/Nguồn`,
> không công bố dàn số, dự báo kỳ sau hay nhật ký dự đoán;
> GitHub Actions cập nhật `data/` hằng ngày và Vercel deploy commit mới. Không dùng database, không có
> service worker và không thêm tín hiệu dự đoán. Lượt redesign cùng ngày đặt XSMN làm miền mặc định,
> sắp kỳ mẫu tăng dần với Toàn bộ lịch sử ở cuối và tách switch miền khỏi tab chức năng. Tab Kết quả
> hiển thị kho kết quả gần nhất trước và sinh HTML tĩnh cho trang chủ, hai miền, ngày gần đây và 21 đài;
> Actions chạy 16:42/18:42 giờ Việt Nam, sau crawler luôn chạy `build_pages.py`. Vẫn không đổi `app.js` hay công thức.
> Xem `DEPLOY_VERCEL.md`.

---

## 1. Mục tiêu tối thượng

Giúp người dùng xem kết quả XSMN/XSMB trực tiếp, tra cứu các kỳ đã công bố và khám phá lịch sử
**2 số đuôi (00–99)** / **3 số đuôi (000–999)** một cách dễ hiểu, đồng thời **nói thật** về giới hạn thống kê.
App **chỉ** làm 2 số đuôi và 3 số đuôi.

## 2. Sự thật đã đo — tóm tắt (đầy đủ 25 phép đo ở BLUEPRINT §4)

- **Quét gian lận cơ học granular nhất có thể** (từng chữ số/từng vị trí, 107+82 vị trí độc lập): **0 bằng chứng**
  ở cả 2 miền (BLUEPRINT §4 #23–24). Tiền đề "hết quay live nên hết giám sát" cũng **sai** — vẫn quay trực tiếp
  hằng ngày, chỉ đổi kênh (#25). App không xây tính năng "tín hiệu rig để hành động theo" — lý do ở BLUEPRINT §4.
- Fibonacci / thần số học / ARIMA / ML / BigData đã nghiên cứu đầy đủ (BLUEPRINT §4, bảng cuối) — không hướng
  nào vượt qua được kết luận "không có tín hiệu" đã đo; ML/ARIMA còn có lý do KỸ THUẬT (không chỉ thực nghiệm)
  giải thích vì sao không thể dùng: biến danh mục + tự tương quan 0 → cả hai suy biến về đúng mức nền đã có.
- Không có mùa / năm / đài / lặp lại kỳ trước / khoảng chờ / mòn bóng / thứ-trong-tuần / ngày / lễ / tự-tương-quan nào tạo tín hiệu.
- Quét 41 cửa sổ 180 kỳ: tìm thấy **đúng 1** giai đoạn lệch thật (2024-03→09, MC p=0,0015) nhưng
  **không bền vững** (r nửa đầu↔nửa sau = 0,17±0,20; 672 kỳ sau đó mọi số về bình thường) → không dùng được.
- **Yếu tố ngoại cảnh (bão/thời sự/chính trị) đã được loại trừ bằng lập luận quét-thời-gian** (BLUEPRINT §4 #17-18).
- **XSMN chiều KHÔNG cho thêm thông tin về XSMB tối** dù XSMB quay sau 2 tiếng (BLUEPRINT §4 #19-22):
  23,880% vs 23,804%, z=0,72 · phép đối chiếu kết quả MN chênh <1% trên 6.583 ngày.
- Tín hiệu MN 3 số (w=0,068) là **artifact** gộp dữ liệu cũ — Monte Carlo p=0,06, tách đài/era thì w→0.
- Không cấu hình nào có chứng nhận ngoài mẫu. Dù một cửa sổ có thể lệch trong mẫu, nút chọn nhanh vẫn dùng
  **chọn đều tái lập được** (`unbiasedPick`, seed theo ngày) cho tới khi có OOS đủ mạnh.
- Biến cấu trúc thật duy nhất: XSMN quay **3 đài CN–T6, 4 đài T7** → phải dùng `pBaseFor(w)` (nền theo thứ).
- Backtest rolling ngoài mẫu 1.000 kỳ (W=365, dàn 5) trên 8 cấu hình: max |top1 z|=1,01; uplift đổi dấu theo cấu hình.
  Đối chứng trong mẫu vẫn đẹp hơn rõ rệt = độ ảo overfit (giữ bảng đối chứng làm bằng chứng).
- Các công cụ chọn bộ số, nhật ký và tính tỉ lệ trả thưởng đã được gỡ khỏi bản public; website chỉ trình bày kết quả và dữ liệu lịch sử đã công bố.

**Cấm viết code hay chữ nào mâu thuẫn với BLUEPRINT §4.**

## 3. Bản đồ file

```
XS/
├── templates/index.template.html  Nguồn khung SPA trang chủ; `index.html` là đầu ra đã sinh
├── app.css         CSS chung cho app và trang kết quả tĩnh
├── app.js          BỘ NÃO: analyze(), ebWeight (co ngót Bayes), hazard KM, Wilson, χ²,
│                   buildModel/scoreOf/rankAll (flat theo zCrit), unbiasedPick, percentile
├── ui.js           LỚP VẼ: 5 view public (live/history/ana/cross/verify) + 3 màn con của ana;
│                   GLOSSARY, tooltip và modal lịch sử công khai
├── update.py       Crawler đa luồng 8 workers, PROV_ALIAS (21 đài), lock, ghi nguyên tử
├── serve.py        LIVE server 127.0.0.1:8368, tự crawl 16:35/18:32, /api/status
├── build_pages.py  Sinh HTML kết quả tĩnh, sitemap, robots và `site-schema.js`
├── TaiDuLieu.bat   MỘT LẦN: tải toàn bộ lịch sử   ├── MoApp.bat  Hằng ngày: mở app LIVE
├── CapNhat.bat     Cập nhật tay 1 lần
├── BLUEPRINT.md    Đặc tả chuẩn + bảng sự thật    ├── RULES.md   Luật bắt buộc
├── ROADMAP.md      File này                        ├── README.md  Cho người dùng cuối
├── CLAUDE.md / AGENTS.md   File trỏ cho AI (nội dung giống nhau)
└── data/  xsmb.js · xsmn.js · xsmn.json (kho thô — CẤM XOÁ) · xsmb_extra.json · meta.js · config.json
```

## 4. Trạng thái (25/08/2026)

### Đã xong
- [x] Kho public hiện có (24/08/2026): XSMB **7.532 kỳ** (10/2005→24/08/2026) · XSMN **6.677 kỳ** (01/2008→24/08/2026)
      · **21 tên đài** chuẩn hoá alias
- [x] LIVE tự cập nhật + tự reload; đã chạy thật ngày 04/08 (crawl 2s sau giờ quay)
- [x] 5 tab public tên đời thường; Kết quả/live và kỳ gần nhất đứng đầu; Lịch sử theo ngày; Thống kê gộp 3 màn con
- [x] Bản public chỉ hiển thị kết quả, lịch sử và thống kê mô tả; không có chức năng chọn số cho kỳ sau.
- [x] Chấm điểm co ngót Bayes thực nghiệm; tâm riêng từng tín hiệu, nền đúng thứ, sai số đúng cỡ mẫu; cổng `actionable` bắt buộc OOS
- [x] Nền theo thứ `pBaseFor(w)` dùng ở mọi chỗ hiển thị kỳ vọng
- [x] Nền dàn số tính chính xác theo từng kỳ bằng `baseSetProb(n,w)`, không cắm số vị trí trung bình vào công thức phi tuyến
- [x] Hazard không ngoại suy gap cực dài: scoring chỉ dùng g≤25 và risk-set≥200; ngoài vùng đó về nền
- [x] Heatmap màu theo thứ hạng phần trăm, 9 nấc navy→đỏ, chữ tự tương phản, viền ±2σ, 3 chế độ tô
- [x] Tooltip dấu **!** toàn app + từ điển 27 mục (GLOSSARY trong ui.js); nhãn đã Việt hoá theo audit UX
- [x] Backtest theo lô + đối chứng in/out-sample và χ² được giữ trong công cụ kiểm toán nội bộ, không còn UI public.
- [x] Không tràn ngang 375px/1280px (đã có script kiểm ở RULES §R4)
- [x] Sửa 12 ngày XSMN lịch sử thiếu đài bằng nguồn dự phòng xskt.com.vn; thêm unit test parser nguồn chính + nguồn phụ
- [x] **Tab 🔗 2 Miền** (`renderCross`, `crossAnalyze`, `mergedDays`): kết quả 2 miền hôm nay,
      4 phép đo quan hệ liên miền tính live, thống kê gộp. Cache theo `digits` trong `CROSS_CACHE`.
- [x] **WP0 pháp lý 24/08/2026**: gỡ khối giao diện legacy về chọn số, nhật ký, backtest UI và tỉ lệ trả thưởng; chỉ giữ kết quả và thống kê mô tả trên website public.
- [x] **WP4 static 25/08/2026**: 90 ngày mỗi miền, 21 hub đài và các trang công khai sinh từ kho dữ liệu; sitemap chỉ chứa hub/tài liệu, không sinh URL theo từng bộ số.

### Cần theo dõi / còn thiếu
- [ ] **Theo dõi hướng dẫn vận hành mới:** 21 công ty XSMN vẫn hoạt động và lịch quay hiện không đổi. Con số 9 là phạm vi tỉnh/thành theo quy định phân vùng, không phải số công ty. Nếu có chỉ đạo mới làm đổi tên đài/lịch quay, cập nhật `PROV_ALIAS`, `expected_mn_draws()` và chạy kiểm 21 tên.
- [x] Nguồn dự phòng xskt.com.vn khi trang chính thiếu đài hoặc đổi HTML; crawler tự đối chiếu số đài kỳ vọng
- [ ] Mở rộng fixture parser rải 20 ngày mọi thời kỳ 2008–2026 (hiện có 2 fixture đại diện và audit 12 ngày lỗi)

## 5. Việc tiếp theo (ưu tiên + nghiệm thu ở BLUEPRINT §7)

> Không được xem “xây xong” là bằng chứng dự đoán tốt. Dữ liệu hiện tại chưa chứng minh lợi thế ngoài mẫu;
> việc có giá trị tiếp theo là vận hành, bảo toàn kho dữ liệu và kiểm tra crawler khi nguồn thay đổi.

1. ~~Thông báo trình duyệt khi có kết quả~~ ✅ **xong** — pill 🔔 ở header báo khi kho dữ liệu có kết quả mới
2. ~~Cảnh báo dữ liệu cũ~~ ✅ **xong** — banner `#staleBar`, tự kiểm mỗi 5 phút
3. ~~Ghim/loại số trong dàn trước khi copy~~ ⛔ **đã gỡ khỏi bản public trong WP0** — không còn luồng chọn số cho kỳ sau.
4. ~~So sánh nhiều cửa sổ trong modal soi số~~ ✅ **xong** — cột 3 tháng/1 năm/3 năm/toàn bộ, gọi lại `analyze()`
   thuần mô tả (không xếp hạng), mục đích chính là lộ số "nóng" giả do cắt mẫu chọn lọc
5. ~~PWA installable~~ ⚠ **một phần** — đã thêm `icon.svg` + `manifest.json` (tên/icon/theme khi "Thêm vào màn hình
   chính"). **Chủ động KHÔNG** thêm service worker: mọi lợi ích offline không bù được rủi ro cache giữ lại
   `data/xsmb.js`/`data/xsmn.js` cũ trong khi bản LIVE đã có kỳ mới — mâu thuẫn trực tiếp với `Cache-Control: no-store`
   mà `serve.py` cố tình đặt. Nếu sau này muốn full offline, bắt buộc network-first + purge cache mỗi lần `meta.updated` đổi.

### Đã cân nhắc nhưng chủ động hoãn (không phải quên)
- **Lọc theo giải cụ thể** (chỉ GĐB, chỉ G7, chỉ G6…) — hiện app chỉ có 2 mức phạm vi (tất cả giải / G7+GĐB hay
  G8+GĐB). Tách nhỏ hơn đòi sửa `tailsOfDay`, `IDX_DD_MB/MN`, mọi chỗ gọi `analyze(...,scope,...)`, và toàn bộ
  nền/bảng thống kê ăn theo `scope` — rủi ro lan quá rộng cho một bản polish cuối cùng để KHOÁ app. Không có
  lý do thống kê để làm (xác suất ra của một đuôi không đổi theo giải cụ thể,
  chỉ đổi theo *số giải quay* — đúng thứ những gì `pBaseFor(w)`/scope 2 mức đã nắm bắt). Hoãn vô thời hạn; chỉ
  làm lại nếu người dùng cần xem thống kê của đúng một giải lẻ (không phải G7+GĐB gộp).
- **Cấm:** tự tối ưu trọng số theo backtest rồi ship (overfit — RULES §R2.4)
- **Cấm:** thêm chỉ số/biểu đồ phân tích mới với lý do "để đoán chính xác hơn" — đã chứng minh vô ích
- **Cấm:** tính năng "tín hiệu thao túng/rig" để hành động theo — 0 bằng chứng qua quét granular nhất có thể
  (BLUEPRINT §4 #23–25); nghi vấn thống kê không tự chứng minh gian lận, và việc này ngoài phạm vi app
- **Cấm:** mọi bộ lọc/trọng số dựa trên Fibonacci, thần số học, ARIMA, ML — đã nghiên cứu đầy đủ, không dùng được
  (lý do kỹ thuật cụ thể ở BLUEPRINT §4, bảng nghiên cứu mở rộng)

### Ghi chú kỹ thuật 2 tính năng mới
- **Cảnh báo dữ liệu cũ** (`checkStale`, `expectedLastDraw`): so ngày mới nhất với ngày quay lẽ ra
  phải có (giờ quay + 45 phút đệm). Trễ 1 kỳ → banner vàng (có thể đài chưa công bố);
  trễ ≥2 kỳ → banner đỏ + gợi ý quy trình sửa nguồn RULES §R6. Có nút gọi `POST /api/update`.
  Chạy lúc khởi động và mỗi 5 phút. **Đây là lưới an toàn chống crawler hỏng âm thầm — cấm gỡ.**

## 6. Vận hành hằng ngày

```
Local:  16:15 XSMN quay → 16:35 serve.py crawl · 18:15 XSMB → 18:32 crawl
Public: 16:42 GitHub Actions crawl XSMN · 18:42 crawl XSMB → sinh HTML tĩnh → commit → Vercel redeploy
```
Người dùng public mở tab Kết quả để xem kho mới nhất; HTML tĩnh và kho tương tác cùng được cập nhật qua Actions.
Người dùng local chỉ cần `MoApp.bat`; các phép kiểm toán mô hình chỉ dành cho công cụ nội bộ.
