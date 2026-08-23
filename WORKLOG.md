# WORKLOG — Kết Số

## 2026-08-23 — Polish luồng public trước khi tái deploy

- Phạm vi chỉ là UI, trải nghiệm và workflow cập nhật: không sửa `app.js`, scoring, thống kê hay tín hiệu dự đoán.
- Tab Hôm nay chỉ giữ lựa chọn cần thiết trong card dàn số; thanh bộ lọc lớn tự ẩn ở tab này để không lặp thao tác. Dàn số, ô heatmap và thẻ kết quả đều là nút có nhãn truy cập được; thêm nút sang Thống kê, trạng thái toast, focus rõ ràng, skip link và reduced motion.
- Mobile: tách 3 hàng Giải / Số đuôi / Mẫu; bảng dữ liệu đầy đủ được thu gọn mặc định. Ô soi số, ghim/loại và lọc bảng có nhãn, bàn phím số, không tự điền hoặc kiểm tra chính tả.
- GitHub Actions chỉ nâng runtime action `checkout@v5` và `setup-python@v6` để bỏ cảnh báo Node.js 20; lịch chạy, nguồn dữ liệu và quy tắc chỉ commit khi `data/` đổi không thay đổi.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Cú pháp + regression | `node --check app.js`, `node --check ui.js`, `node test_model.cjs`: đạt (`test_model: OK`) |
| Crawler | `update.py --max-fetch 40`: **2 giây**; trước/sau XSMB **7.530**, XSMN **6.675** kỳ, cùng mới nhất **22/08/2026**; thêm/sửa/mất **0** kỳ |
| Test crawler | `test_update.py`: **4/4** đạt |
| Browser local | 4 tab công khai; XSMB/XSMN × 2/3 số; 3 màn Thống kê; modal soi số và thông báo nhập sai: console **0 lỗi** |
| Responsive | 320px: nội dung **305px / viewport 320px**; 768px, 1024px, 1440px: **0px tràn ngang** |
| Backtest UI | XSMN / tất cả giải / 3 số / 300 kỳ / W365 / dàn 10: **2,6 giây**; OOS **−0,1%**, top1 **p=0,752**, đối chứng trong mẫu **+116,9%** |

Kết luận: bản polish không tạo hoặc diễn giải thành predictive edge; dàn kỳ tới vẫn chọn đều, tái lập được theo ngày.

## 2026-08-23 — Chuẩn bị website public + tinh gọn giao diện

### Phạm vi đã làm

- Không sửa `app.js`, công thức thống kê, scoring hay tín hiệu dự đoán.
- Bỏ luồng Nhật ký/nhắc cá nhân khỏi giao diện public; còn 4 tab: Hôm nay, Thống kê, 2 Miền, Kiểm chứng.
- Ô soi số ở header lớn hơn, dùng được `68`/`668`; phần giải thích dài và ghim/loại số được thu gọn mặc định.
- Mobile: 4 tab luôn thấy trên một hàng, header/search xếp theo chiều dọc; không tràn trang.
- Thêm `.github/workflows/update-lottery-data.yml`: GitHub Actions chạy `update.py` lúc 17:37 và 19:37 ICT, chỉ commit khi `data/` đổi. Thêm `vercel.json` không cache `data/*`; thêm `DEPLOY_VERCEL.md` và cập nhật README/ROADMAP.
- Chưa deploy thật: cần Daniel push repo GitHub và kết nối Vercel theo `DEPLOY_VERCEL.md`.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| `node --check app.js` + `node --check ui.js` | đạt |
| `node test_model.cjs` | `test_model: OK` |
| Python bundled `test_update.py` | 4/4 đạt |
| `update.py --max-fetch 40` | 2 giây; trước/sau XSMB **7.530**, XSMN **6.675** kỳ; cùng đến **22/08/2026**; không thêm/mất kỳ |
| Browser local | 4 tab; 12 tổ hợp Phân tích (MB/MN × 2/3 số × 3 màn); soi `668`; console **0 lỗi** |
| Responsive | 320px: rộng nội dung 305px; 1280px: 1265px — **0px tràn ngang** |
| Backtest UI | MN / tất cả giải / 3 số / 300 kỳ / W365 / dàn10: **1,6s**; uplift OOS **−0,1%**, top1 p=**0,752**; trong mẫu **+116,9%** |

Kết luận: thay đổi phân phối/UI không làm phát sinh bằng chứng predictive edge. Website sẵn sàng để Daniel deploy; auto-update chỉ bắt đầu sau khi workflow có quyền ghi trong GitHub repo.

## 2026-08-14 — Kiểm tra sức khoẻ sau 1 tuần chạy thật (không sửa code)

### Kết quả: không tìm thấy lỗi nào. Không sửa dòng code nào.

Đây là vòng kiểm tra vận hành sau 1 tuần kể từ khi khoá v1.0, đúng phạm vi ROADMAP cho phép
(theo dõi nguồn dữ liệu + sáp nhập đài). Không đổi công thức, không thêm tính năng.

### Phát hiện vận hành (không phải lỗi code)

- Dữ liệu lúc bắt đầu kiểm tra dừng ở **12/08** trong khi hôm nay là 14/08 — trễ 2 kỳ.
  Nguyên nhân: **`MoApp.bat` không chạy trong tuần**, nên không có tiến trình nào tự crawl.
  Không phải nguồn hỏng: chạy `py update.py` bắt kịp ngay trong **2 giây**.
  → Nhắc người dùng: dữ liệu chỉ tự cập nhật khi `MoApp.bat` đang chạy. Nếu tắt máy/tắt app
  nhiều ngày thì mở lại rồi bấm cập nhật, hoặc chạy `CapNhat.bat` một lần.
- **Sáp nhập đài 2026 chưa ảnh hưởng nguồn crawl**: 60 kỳ gần nhất vẫn đúng **21 tên đài** cũ,
  không tên nào đổi → chưa cần thêm `PROV_ALIAS`. Vẫn giữ trong mục "cần theo dõi" của ROADMAP.

### Số liệu đã đo lại

| Hạng mục | Kết quả |
|---|---|
| `node --check app.js` / `ui.js` | đạt |
| `node test_model.cjs` | `test_model: OK` |
| `node work/audit_v1_regression.cjs` | `audit_v1_regression: OK` |
| `py test_update.py` | 4 tests OK |
| `py update.py` | 2s · XSMB 7.521 kỳ · XSMN 6.666 kỳ · cùng đến 13/08/2026 |
| LIVE `/api/status` | `live:true`, khớp đúng số kỳ trên |
| Browser QA | 36 lần render (6 tab + 3 màn con × MB/MN × 2/3 số): **0 lỗi console** |
| Tràn ngang | **0px** ở cả 375px và 1280px, toàn bộ tổ hợp |
| Backtest MB / tất cả giải / 2 số / 300 kỳ / W365 / dàn 10 | **0,7 giây** |

### Backtest — số thật, kể cả khi không đẹp

- Ngoài mẫu: trúng TB **2,45**/kỳ vs chọn bừa **2,38** → uplift **+3,1%**.
- Số #1 trúng **24,7%** so với nền 23,8% → **p = 0,357**. Không có ý nghĩa thống kê.
- Đối chứng trong mẫu: **+14,5%** (so với +3,1% ngoài mẫu) → khoảng cách này chính là mức overfit.
- Kết luận không đổi: **chưa có bằng chứng predictive edge**, `MODEL_OOS_VALIDATED` vẫn `false`,
  app vẫn chọn đều. Đây là lần đo lại độc lập thứ 3 cho cùng một kết luận.

### Xác minh 2 bản vá của vòng audit 07/08 còn nguyên tác dụng

- **F1** (`pxLoad` chịu được localStorage hỏng): thử 6 dạng dữ liệu hỏng — JSON vỡ, `pin:"323"`,
  số thay vì chuỗi, độ dài sai, trùng lặp, `null`, mảng thay vì object — **6/6 không crash**,
  đều lọc về mảng chuỗi 2/3 chữ số hợp lệ. Đường `renderQuick()` chạy sạch sau mỗi ca.
- **F2** (`openNum` không tính thừa): phạm vi "Toàn bộ" mở modal **35ms** (tái dùng `Ax`);
  phạm vi 1 năm mở **77ms** (tính đủ 4 cửa sổ độc lập, đúng như thiết kế). Cả hai hiện đủ 4 dòng.
- Ghi nhận thêm: chính bảng này đang tự minh hoạ mục đích của nó — số `123` (XSMN, 3 số) nóng
  **×1,28 nền** ở cửa sổ 3 tháng nhưng **×0,97** trên toàn bộ 6.666 kỳ. Nóng ở đúng một cỡ mẫu
  = artifact cắt mẫu, không phải tín hiệu. Đây là ví dụ thật để đọc bảng cho đúng.

## 2026-08-07 — Kiểm toán độc lập và khoá v1.0

### Phạm vi và phát hiện

- Đã đọc theo thứ tự `BLUEPRINT.md` → `RULES.md` → `ROADMAP.md` (mục khoá v1.0) trước khi sửa; kiểm toán lại phần polish cuối theo ROADMAP §4–5. Folder không có Git repository, nên đối chiếu phạm vi bằng roadmap, timestamps và source hiện tại.
- Tìm thấy 2 lỗi thật, đều ngoài công thức thống kê:
  1. `pxLoad()` chỉ bắt JSON vỡ; JSON hợp lệ nhưng sai kiểu (vd `pin:"323"`) có thể làm `.filter()` crash. Đã lọc về mảng duy nhất gồm chuỗi 2/3 chữ số; invalid JSON vẫn fallback mảng rỗng.
  2. `openNum()` tính lại `analyze()` cho dòng “Toàn bộ” khi phạm vi hiện tại đã là Toàn bộ. Đã tái dùng `Ax`; 3 cửa sổ khác vẫn tính độc lập như trước.
- Không sửa scoring, thống kê, tín hiệu, nguồn dữ liệu, service worker hay chính sách chọn đều.

### Kiểm chứng chạy lại

- `node --check app.js`, `node --check ui.js`, `node test_model.cjs`, `node work/audit_v1_regression.cjs`: đạt. Regression kiểm tra localStorage sai cấu trúc và tiền tố `unbiasedPick()` ở U=100/1000, 100 seed, n=1…10.
- Python bundled: `test_update.py` 4/4 đạt. `update.py` chạy 3 giây; trước/sau vẫn XSMB 7.514 kỳ, XSMN 6.659 kỳ, cùng đến 06/08/2026 (meta chỉ đổi timestamp 04:45).
- LIVE `/api/status`: `live:true`. Browser QA: 6 tab, 3 màn Phân tích, MB/MN × 2/3 số, console 0 lỗi; 375px và 1280px đều 0px tràn ngang. Ghim `323` đứng đầu; loại `323` loại khỏi dàn và tự loại trừ hai danh sách. Modal 4 cỡ mẫu mở 344ms.
- Backtest UI: XSMN / tất cả giải / 3 số / 300 kỳ / W365 / dàn10 = 1,8 giây; OOS uplift +5,1%, top1 p=0,752; đối chứng trong mẫu +117,0%. Không đủ bằng chứng predictive edge, nên app vẫn chọn đều.

### Trạng thái khoá

- v1.0 đủ điều kiện dùng lâu dài trong phạm vi công cụ thống kê lịch sử. Báo cáo audit chi tiết: `outputs/XS_DIFFERENTIAL_REVIEW_2026-08-07.md`.

## 2026-08-06 — Tiếp quản sau Claude

### Mục tiêu

- Audit toàn bộ build hiện tại trước khi sửa.
- Sửa lỗi làm sai mức nền/diễn giải của phần chọn số.
- Giảm độ rối của luồng “Bộ số hôm nay”.
- Kiểm tra dữ liệu, crawler, localhost và responsive.

### Baseline đã xác minh

- Đã đọc `BLUEPRINT.md`, `RULES.md`, `ROADMAP.md` và `Claude report.txt`.
- `node --check app.js` và `node --check ui.js`: đạt trước khi sửa.
- Runtime `http://127.0.0.1:8368/`: không có lỗi console; viewport 390 px không tràn ngang.
- Kho dữ liệu: XSMB 7.513 kỳ đến 05/08/2026; XSMN 6.658 kỳ đến 05/08/2026.
- Cấu trúc XSMB hợp lệ. XSMN có 11 ngày lịch sử chỉ còn 2 đài dù lịch đúng phải có 3 đài; nguồn phụ xác nhận ít nhất ngày 24/02/2010 còn thiếu Đồng Nai.

### Lỗi đã chốt trước khi sửa

1. Điểm số XSMN dùng nền toàn mẫu thay vì nền của đúng thứ mục tiêu. Ví dụ XSMN tất cả giải, 2 số, thứ Bảy: nền đúng 50,916% nhưng model neo ở 43,252%; vì vậy model có thể báo “có tín hiệu” dù điểm số dẫn đầu thấp hơn nền đúng.
2. Công thức co ngót ghi trong đặc tả phải trừ tâm riêng của từng tín hiệu, nhưng code đang trừ cùng một mức nền cho mọi tín hiệu; việc này có thể tạo edge tuyệt đối giả.
3. UI nói “mọi trọng số w≈0” trong khi runtime MB hiện `carry w=0.671`; kết luận phẳng chỉ có nghĩa edge chưa vượt ngưỡng đa so sánh.
4. Badge LIVE chỉ kiểm tra giao thức HTTP, chưa xác minh `/api/status`.
5. Nút “Bộ số khác” cho phép reroll dù model phẳng, trái quy tắc chọn đều tái lập được.
6. Kiểm định χ² dùng xấp xỉ chuẩn trực tiếp; đặc tả yêu cầu Wilson–Hilferty hoặc Monte Carlo ở phần đuôi phân phối.

### Đo ngoài mẫu ban đầu

- Backtest 1.000 kỳ, cửa sổ 365, dàn 5 cho 8 cấu hình miền/phạm vi/loại số: chưa cấu hình nào có bằng chứng đủ mạnh để tuyên bố hơn chọn đều.
- Những ngày model tự báo “có tín hiệu” chỉ chiếm khoảng 0–2,8% mẫu; số quan sát quá ít và uplift thay đổi dấu theo cấu hình.

### Việc đang làm

- Sửa nền theo thứ và tâm co ngót; đo lại ≥300 kỳ.
- Rút gọn card chọn số; đưa giải thích dài vào phần mở rộng; bỏ reroll khi không có tín hiệu đã kiểm chứng.
- Thêm nguồn dự phòng và test parser cho các ngày XSMN thiếu đài.
- Kiểm chứng desktop/mobile, 6 tab, 2 miền, 2 loại số và localhost LIVE thật.

### Thay đổi đã triển khai trong lát 1

- Sửa nền XSMN theo đúng thứ mục tiêu; xác suất dàn dùng trung bình chính xác theo số vị trí từng kỳ.
- Sửa công thức EB: mỗi tín hiệu trừ tâm riêng; carry so trực tiếp `pCarry` với `pFresh`; χ² dùng Wilson–Hilferty.
- Khóa GAP cực dài khỏi scoring: chỉ dùng `g≤25` và `reach≥200`; ngoài vùng trả về nền. Đồng thời tắt tín hiệu
  “30 kỳ gần” khi toàn cửa sổ cũng ≤30 để tránh đếm đôi cùng dữ liệu.
- Thêm cổng `actionable`: lệch trong mẫu chưa đủ; chưa có chứng nhận OOS thì dàn kỳ tới luôn được chọn đều,
  seed theo ngày, không reroll. Nhật ký cũng dùng đúng cùng chính sách thay vì lén lấy Top lịch sử.
- Sửa copy/UI: lịch sử nổi bật tách khỏi dự đoán; giải thích dài thu gọn; ẩn bộ lọc ngày; LIVE chỉ sáng khi `/api/status` trả thành công.
- Crawler XSMN có nguồn dự phòng `xskt.com.vn`; đã sửa đủ 12 ngày lịch sử thiếu đài. `test_update.py` có 2 test parser và đang đạt.
- Thay các chi tiết cơ chế quay chưa đủ nguồn bằng diễn giải thận trọng và link Thông tư 22/2021/TT-BTC.

### Backtest sau sửa công thức

- Rolling OOS 1.000 kỳ, cửa sổ 365, dàn 5 trên 8 cấu hình miền/phạm vi/loại số: top1 không cấu hình nào đạt |z|>1,5.
- Uplift dàn có cả dấu dương và âm theo cấu hình; không ổn định, không đủ điều kiện mở cổng Top-N.
- Kết luận vận hành: bảng điểm chỉ để phân tích lịch sử; dàn kỳ tới dùng chọn đều có seed cho tới khi có OOS được định trước.

### Kiểm chứng bàn giao

- `node --check app.js`, `node --check ui.js`, `node test_model.cjs`: đạt. `test_model.cjs` khóa nền theo thứ,
  xác suất dàn chính xác, không đếm đôi recent, fallback GAP và cổng OOS.
- `test_update.py`: 4/4 đạt; ngoài 2 parser còn khóa merge đơn điệu, không cho lỗi nguồn ghi `[]` đè kết quả cũ.
- Browser QA: 6 tab + 3 màn Phân tích; XSMB/XSMN; 2/3 số; desktop 1280 và mobile 390; console 0 lỗi,
  không tràn ngang. Bộ chọn “Tại ngày” đã xóa hẳn khỏi UI/code.
- Backtest UI 300 kỳ (MN all, 3 số, W=365, dàn 10) chạy 1,6 giây: OOS uplift +5,1% nhưng top1 p=0,752;
  trong mẫu +117,7% → minh họa overfit, app kết luận không có tín hiệu vượt trội.
- `/api/status` trả `live:true`; desktop shortcut `C:\Users\MR DUOC\Desktop\XS.lnk` trỏ đúng `MoApp.bat`.
