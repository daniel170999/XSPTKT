# RULES — Luật bắt buộc khi sửa app này

> Dành cho **mọi AI hoặc người** được giao sửa dự án này.
> Đọc hết file này **trước khi** viết dòng code đầu tiên. Đọc kèm [ROADMAP.md](ROADMAP.md).
> Nếu một yêu cầu mâu thuẫn với file này → **dừng lại và hỏi chủ dự án**, đừng tự ý làm.

---

## R0. Ba câu phải thuộc lòng

1. App này **chỉ** làm 2 số đuôi và 3 số đuôi. Không làm gì khác.
2. Dữ liệu đã đo cho thấy **xổ số không có trí nhớ**. App là công cụ *phân tích*, không phải máy *dự báo*.
3. Chưa đo thì **không được khẳng định**. Mọi con số đưa ra UI phải tính được từ dữ liệu thật.

---

## R1. Kiến trúc — không được phá

| File | Được chứa | KHÔNG được chứa |
|---|---|---|
| `templates/index.template.html` | Nguồn HTML của trang chủ SPA | Logic thống kê, dữ liệu |
| `index.html` | Đầu ra trang chủ tĩnh có fallback kết quả | Sửa tay ngoài `build_pages.py` |
| `app.css` | Toàn bộ CSS dùng chung cho app và các trang tĩnh | Logic thống kê, dữ liệu |
| `app.js` | Toàn bộ toán học & thống kê | Truy cập DOM, `document`, `$` |
| `ui.js` | State, render, sự kiện | Công thức thống kê tự chế |
| `update.py` | Crawl + ghi `data/*.js` | Logic hiển thị |
| `serve.py` | HTTP + tự động cập nhật | Logic thống kê |
| `build_pages.py` | Sinh trang kết quả tĩnh từ dữ liệu đã kiểm tra | Crawl, công thức thống kê |

**Bắt buộc:**
- Thuần HTML/CSS/JS + Python chuẩn. **Không framework, không npm, không pip, không CDN.** Trang tĩnh phải đọc được không cần JavaScript; dùng `serve.py` khi kiểm app tương tác local.
- Cần một phép tính mới → viết hàm trong `app.js`, `ui.js` chỉ gọi.
- Thêm view mới → thêm `<button data-v="tên">` trong `<nav>`, `<div class="view" id="v-tên">`, và `renderTên()` vào object `RENDER`.
- Đổi giao diện → sửa CSS trong `app.css`; trang chủ nguồn sửa ở `templates/index.template.html`, rồi chạy `build_pages.py`.

---

## R2. Luật thống kê — nghiêm ngặt nhất

### R2.1 — Mọi con số đưa ra UI phải kèm mức so sánh
Không bao giờ hiển thị tần suất trần trụi. Luôn đi kèm ít nhất một trong:
- xác suất nền `pBase` của đúng bộ lọc đang chọn,
- bội số so với nền (`×1.08 nền`),
- khoảng tin cậy Wilson.

❌ Sai: `Số 63 ra 31 lần → nên đánh`
✅ Đúng: `Số 63 ra 31/100 kỳ (31%) · ×1.30 nền · KTC 95%: 22–41%`

### R2.2 — Công thức đã chốt, không tự đổi
```
baseSetProb(n,w) = mean_day[1 − (1 − n/U)^m_day]
pBase = baseSetProb(1), pBaseFor(w) = baseSetProb(1,w)

CO NGÓT BAYES THỰC NGHIỆM (cơ chế chống ngụy biện "số nóng"):
  S²   = phương sai tần suất quan sát giữa các số
  V    = p̄(1−p̄)/n          phương sai nếu MỌI số có xác suất như nhau
  τ²   = max(0, S² − V)      phần khác biệt THẬT
  w    = τ² / (τ² + V)       độ tin cậy của tín hiệu, 0…1
  score_i = pBaseFor(targetDow) + Σ_signals w_s · (p̂_{s,i} − mean_s)

hazard(g) = evt[g]/reach[g]  Kaplan–Meier, reach tính cả spell bị kiểm duyệt phải
             scoring chỉ dùng g≤25 và reach≥200; ngoài vùng đó về tâm/nền
Wilson    = khoảng tin cậy cho tỉ lệ k/n
Bonferroni: z tương ứng α/U khi so sánh trên toàn bộ U số
flat      = edgeRatio < zCrit, edge dùng nền đúng thứ và sai số tổng hợp đúng cỡ mẫu từng tín hiệu
             zCrit = −probit(0.005/U)  (Bonferroni α=1% vì ta chọn MAX trong U số;
             U=100 → ~3.9σ, U=1000 → ~4.4σ).
actionable = !flat VÀ có chứng nhận backtest ngoài mẫu đã chốt trước
             chưa actionable → chọn đều tái lập được
```
**Không được** thay lại bằng trọng số cố định do người đặt. Trọng số **phải do dữ liệu quyết định**
qua `ebWeight()` / `ebWeight1()` / `hazardWeight()`. Đây là điểm khác biệt cốt lõi so với mọi ứng dụng dự đoán số khác:
khi dữ liệu không có tín hiệu, thuật toán **tự vô hiệu hoá chính nó** thay vì bịa ra thứ hạng.

Đổi bất cứ thứ gì trong khối này → **bắt buộc chạy lại backtest ≥300 kỳ** và ghi kết quả vào ROADMAP.

### R2.2b — Khi mô hình phẳng
`actionable = false` nghĩa là chưa có bằng chứng đủ để dùng thứ hạng cho kỳ tới. Lúc đó:
- Nút chọn nhanh **phải** dùng `unbiasedPick()` — chọn đều, gieo hạt từ ngày, **tái lập được**.
- **Cấm** nút reroll cùng cấu hình — đó là máy kéo xèng, không phải công cụ phân tích.
- Giao diện **phải** nói thẳng "không số nào hơn số nào" kèm con số `edge` và `seOne`.

### R2.3 — Backtest phải trung thực
- Cửa sổ huấn luyện **chỉ** được dùng ngày < ngày dự đoán. Không có ngoại lệ.
- Chỉ được dùng thông tin biết trước khi quay (ngày, thứ). Không dùng gì của chính ngày đó.
- Luôn báo cáo kèm **đường cơ sở** (chọn bừa) và **giá trị p**.
- Luôn giữ cột đối chứng **trong mẫu vs ngoài mẫu**. Đây là tính năng trung thực nhất của app — **cấm gỡ bỏ**.
- Mặc định ≥300 kỳ. Dưới 200 kỳ phải hiện cảnh báo mẫu nhỏ.

### R2.4 — Cấm tuyệt đối
- ❌ Nói/ám chỉ số nào "chắc ra", "sắp nổ", "về đẹp", "cầu đẹp".
- ❌ Bịa xác suất không tính từ dữ liệu.
- ❌ Gỡ hoặc làm nhẹ đi phần cảnh báo trung thực, disclaimer, tab Kiểm chứng.
- ❌ Trình bày điểm số như xác suất đã hiệu chuẩn. Nó là **điểm xếp hạng**.
- ❌ Thêm chức năng gợi ý số tiền cược, tính tiền lời, hay bất cứ thứ gì khuyến khích cược nặng.
- ❌ Tính năng "tín hiệu thao túng/rig" để hành động theo (BLUEPRINT §4 #23–25) — đã quét granular nhất
  có thể, 0 bằng chứng; nghi vấn thống kê không tự chứng minh gian lận và việc điều tra thực sự nằm
  ngoài phạm vi dữ liệu tần suất mà app có.
- ❌ Bộ lọc/trọng số dựa trên Fibonacci, thần số học, ARIMA, mô hình ML (BLUEPRINT §4, bảng nghiên cứu
  mở rộng) — đã nghiên cứu đầy đủ, có lý do kỹ thuật cụ thể vì sao không áp dụng được, không phải "chưa thử".

### R2.5 — Xấp xỉ thống kê phải tự kiểm bằng Monte Carlo khi nghi ngờ
Xấp xỉ chuẩn cho χ² (`(χ²−df)/√(2df)`) và cả Wilson–Hilferty đều có thể **sai lệch đáng kể** khi số quan sát
mỗi ô thưa (quy tắc ngón tay: cần ≥5, nhưng ngay cả ~7-8/ô cũng có thể đánh lừa — đã gặp thật: kiểm định
Markov bậc 2 trên GĐB MB cho p(xấp xỉ chuẩn)=0,049 "có ý nghĩa", nhưng Monte Carlo 2.000 lần với PRNG đã
kiểm chuẩn cho p thật=0,21 — hoàn toàn null). **Bắt buộc**: bất kỳ kết quả nào dùng để kết luận "có tín hiệu"
hoặc "có bất thường" mà p nằm trong khoảng 0,001–0,1 (vùng dễ bị xấp xỉ đánh lừa) phải chạy Monte Carlo đối
chứng trước khi đưa vào code hoặc báo cáo cho người dùng. Không tin xấp xỉ một mình.

---

## R3. Luật dữ liệu

- **Không bao giờ xoá `data/xsmn.json`.** Đó là kho tích luỹ, mất là phải crawl lại ~10 phút.
- Merge phải **đơn điệu**: chỉ thêm ngày mới hoặc thay một ngày thiếu bằng bản có nhiều đài hợp lệ hơn;
  cấm ghi bản ít đài hơn hay `[]` đè lên ngày đã có kết quả.
- `store[ngày] = []` nghĩa là "đã kiểm tra, hôm đó không quay" — giữ lại để khỏi hỏi lại.
- Ngày hôm nay chưa có kết quả thì **không ghi gì cả**, để lần sau thử lại.
- Ghi file phải nguyên tử: ghi `.tmp` rồi `os.replace`. Đã làm sẵn trong `save_json` / `write_js`.
- Đổi định dạng `data/*.js` → phải sửa đồng bộ hàm nạp trong `app.js` **và** ghi rõ trong ROADMAP.
- Tôn trọng khoá `data/.update.lock`. Không chạy 2 tiến trình crawl cùng lúc.
- Tốc độ crawl tối đa **8 luồng**. Đừng tăng — sẽ bị chặn IP và mất luôn nguồn.
- Khi nguồn XSMB hoặc kho phụ lỗi, dữ liệu XSMB đang có phải được giữ nguyên; không được ghi một kho ngắn hơn chỉ vì một lần tải thất bại.
- Nguồn công ty xổ số kiến thiết chỉ được dùng để đối chiếu khi `robots.txt` cho phép và parser xác minh đúng 18 số theo thứ tự. Chưa đủ parser cho một đài thì ghi rõ giới hạn, không tự nhận đã đối chiếu.

### Định dạng dữ liệu (bất biến)
```js
// data/xsmb.js — 27 số/kỳ theo đúng thứ tự:
// GĐB, G1, G2×2, G3×6, G4×4, G5×6, G6×3, G7×4
window.XSMB_LINES = ["2026-08-03,79247,27241,31300,...,46"]

// data/xsmn.js — 18 số/đài theo đúng thứ tự:
// G8, G7, G6×3, G5, G4×7, G3×2, G2, G1, GĐB
window.XSMN_LINES = ["2026-08-03|TPHCM:08,545,6957,...,574027|Đồng Tháp:..."]
```
Số đã pad 0 sẵn (`"08"` chứ không phải `"8"`). Đừng pad lại lần nữa.

---

## R4. Luật giao diện

- **Tiếng Việt toàn bộ.** Không trộn tiếng Anh trừ thuật ngữ đã quen (gap, backtest, uplift).
- Mọi trang phải chạy tốt trên điện thoại. Bảng rộng bọc trong `.tw` hoặc `.scrolly` (đều có `overflow-x:auto`).
- **Không được để trang tràn ngang.** Kiểm tra bắt buộc sau mỗi lần sửa CSS/bảng, ở cả 375px và 1280px:
  ```js
  // dán vào console, phải in ra "ok" cho mọi tổ hợp public
  (()=>{const d=document.documentElement;const s=()=>{const o=[];
   for(const v of ["live","history","cross","verify"]){showView(v);
   if(d.scrollWidth>d.clientWidth)o.push(v+":"+(d.scrollWidth-d.clientWidth)+"px")}
   for(const x of ["board","gap","pattern"]){ST.anaSub=x;showView("ana");
   if(d.scrollWidth>d.clientWidth)o.push("ana/"+x+":"+(d.scrollWidth-d.clientWidth)+"px")}
   return o.join(" ")||"ok"};
   const r={};for(const[g,n] of [["MN",2],["MN",3],["MB",2],["MB",3]]){
   ST.region=g;ST.digits=n;ST.win="max";ST.provs=null;refresh();r[g+n]=s()}return r})()
  ```
  > ⚠️ **Bẫy đã gặp 3 lần:** phần tử con trong `grid`/`flex` mặc định `min-width:auto`, nên một cái bảng
  > hay một dải chip dài sẽ kéo giãn ô chứa nó và đẩy tràn cả trang — dù đã đặt `overflow-x:auto`.
  > Đã xử lý bằng `.grid2>*,.grid3>*{min-width:0}`, `#fProv{flex-wrap:wrap;min-width:0}`, `.hzx span{min-width:0}`.
  > Thêm bảng/chip mới ở đâu thì nhớ luật này ở đó.
- `th,td` có `white-space:nowrap` toàn cục. Ô chứa câu dài phải ghi đè `white-space:normal` (xem `.sig td`).
- Dùng biến CSS có sẵn (`--acc`, `--gold`, `--ok`, `--hot`…). Không hardcode màu mới.
- Bấm vào số ở **bất kỳ đâu** đều phải mở được modal soi số → gọi `openNum(tail, digits)`.
- Không để trang treo quá 200ms. Việc nặng phải chia lô như `runBacktest()`.
- Có ô trống thì hiển thị `<div class="empty">lý do</div>`, không để trắng trơn.

---

## R5. Quy trình bắt buộc trước khi báo "xong"

```bash
node --check app.js && node --check ui.js && node --check method.js
```
Rồi mở app và kiểm tra đủ **5 tab public (+3 màn con của Thống kê) × 2 miền × 2 chế độ số** không lỗi console:

- [ ] `node --check` sạch cho `app.js`, `ui.js` và `method.js`
- [ ] Console trình duyệt không có lỗi đỏ
- [ ] Cả 5 tab public + 3 màn con Thống kê render được ở XSMB và XSMN
- [ ] Trang chủ, `/xsmn/`, `/xsmb/` và một trang ngày có đúng một `h1`, chứa kết quả trong HTML thô và vẫn đọc được khi JavaScript không chạy
- [ ] Đổi 2 số ↔ 3 số không vỡ
- [ ] Bảng thống kê, ô tìm kiếm và modal lịch sử thống nhất cùng bộ lọc; tần suất luôn có mức nền/mức chung
- [ ] Backtest `/phuong-phap/` 300 kỳ chạy xong dưới 10 giây, kết luận có uplift/p-value và không suy luận kết quả tương lai
- [ ] `py update.py` chạy được, không mất dữ liệu cũ
- [ ] Nếu đổi công thức → đã chạy lại backtest và cập nhật bảng số liệu trong ROADMAP

---

## R6. Khi nguồn dữ liệu hỏng

Nếu `xosodaiphat.com` đổi cấu trúc hoặc trả thiếu đài, crawler phải thử nguồn dự phòng `xskt.com.vn`.
Nếu cả hai nguồn hỏng, ngày đó không được ghi đè vào kho và log phải nói rõ.
Cách xử lý đúng:

1. Tải 1 trang về xem tận mắt với User-Agent định danh của crawler.
2. Tìm marker: `grep -oE 'table-xsmn livetn[0-9]' /tmp/x.html`
3. Sửa `MN_SPEC` / `norm_label` / parser nguồn tương ứng trong `update.py`.
4. Kiểm tra lại **nhiều thời kỳ**, không chỉ hôm nay:
   ```
   py -c "import sys;sys.path.insert(0,'.');import update;h=open('/tmp/x.html',encoding='utf-8',errors='ignore').read();print(len(update.parse_xsmn_page(h)))"
   ```
   Chạy cả `parse_xsmn_page()` và `parse_xsmn_backup_page()`. Kết quả dùng phải có đúng số đài kỳ vọng, mỗi đài đúng 18 số.
5. **Không** nới lỏng điều kiện `len(nums)==18` để "cho qua". Thà thiếu ngày còn hơn có dữ liệu sai.

## R6.1. Bề mặt public và nội dung sinh tự động

- Chạy `python work/check_words.py` trước mỗi commit public; không đưa vào câu chữ cổ vũ hành vi không phù hợp, tỉ lệ chi trả hay sổ theo dõi giao dịch.
- Chỉ sinh trang ngày trong giới hạn `build_pages.py --days 90`; không tạo URL theo tổ hợp số tự do, không nhân bản nội dung giữa nhiều domain.
- Sau `update.py`, bắt buộc chạy `build_pages.py` trước khi commit dữ liệu để HTML, sitemap và kho app cùng revision.

---

## R7. Thói quen giao tiếp

- Báo cáo **con số thật**, kể cả khi kết quả xấu ("uplift −3.1%, không có tín hiệu").
- Không viết "đã tối ưu", "đã cải thiện đáng kể" nếu chưa đo.
- Đo xong việc gì đáng nhớ → ghi vào bảng ở mục 2 của ROADMAP.
- Chủ dự án muốn app **thắng cược**. Việc của bạn là đưa công cụ phân tích tốt nhất
  **và** nói thật về giới hạn — không phải chiều lòng bằng lời hứa suông.
