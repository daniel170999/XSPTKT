# WORKLOG — Kết Số

## 2026-08-25 — WP5: nguồn dữ liệu, tài liệu vận hành và kế hoạch phát triển

### Phạm vi đã làm

- Bổ sung danh mục công khai **6** trang công ty XSKT: TPHCM, Tiền Giang, Vĩnh Long, Cần Thơ, Đồng Nai và Bến Tre. Chỉ TPHCM/Vĩnh Long/Cần Thơ được đối chiếu tự động hiện tại khi `robots.txt` cho phép và HTML có đủ **18** số theo đúng thứ tự; các trang iframe/ảnh hoặc không có robots hợp lệ không bị ép parse và không được ghi là đã kiểm.
- Crawler dùng User-Agent nhận diện Kết Số, kiểm tra robots cho nguồn đối chiếu, giãn tối thiểu **0,5 giây/host** và chỉ ghi nhận đối chiếu. Nguồn kết quả ổn định hiện hữu vẫn là nguồn ghi dữ liệu; không tự nhận đã có nguồn chính thức cho toàn bộ 21 đài.
- Sửa đường lỗi thực tế ở XSMB: khi dataset GitHub lỗi, kho `data/xsmb.js` cũ được nạp và giữ lại thay vì có nguy cơ bị ghi thành phần dữ liệu nhỏ.
- Thay `MONETIZATION_PLAN.md` bằng `MARKETING_PLAN.md` với định hướng kết quả công khai/SEO/vận hành; cập nhật README, quy tắc, blueprint, roadmap, hướng dẫn deploy và trang nguồn để khớp kiến trúc trang tĩnh hiện tại. Làm rõ: **21** công ty vẫn vận hành; số **9** chỉ là số tỉnh XSMN theo phạm vi vùng, không phải sáp nhập 21 thành 9.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Unit crawler | Python bundled `test_update.py`: **8/8 đạt**, gồm kiểm tra 18 số theo đúng thứ tự và regression nguồn XSMB hỏng vẫn giữ kho cũ. |
| Crawler thật | `update.py --max-fetch 40`: **3 giây**; XSMB **7.532** và XSMN **6.677** kỳ, cùng đến **24/08/2026**; SHA-256 của `xsmb.js`, `xsmn.js`, `xsmn.json` trước/sau không đổi. |
| Builder + kiểm tra | `build_pages.py --days 90 --check`: **0** thay đổi; vẫn có **180** trang ngày và **21** hub đài. `node --check app.js`, `node --check ui.js`, `node test_model.cjs`, Python compile, quét từ công khai và `git diff --check`: đạt. |
| Công thức | `git diff c8d9bf3 -- app.js` không có output: không đổi công thức hoặc mô hình thống kê. |

## 2026-08-25 — WP4: trang kết quả tĩnh và đường dẫn công khai

### Phạm vi đã làm

- Thêm `build_pages.py` chỉ dùng thư viện chuẩn, đọc `data/xsmb.js`/`data/xsmn.js` qua JSON, kiểm tra số lượng giải và sinh HTML nguyên tử từ một template riêng. `index.html` là đầu ra; `templates/index.template.html` mới là nguồn SPA không bị crawler ghi đè.
- Sinh trang chủ có fallback kết quả thật trước JavaScript, hai hub `/xsmn/` và `/xsmb/`, **180** trang ngày gần nhất (90 mỗi miền), **21** hub đài XSMN, cùng các trang giới thiệu/nguồn/phương pháp/liên hệ/quyền riêng tư.
- Sinh `site-schema.js` từ `data/site-schema.json` để renderer app và builder dùng cùng tên/nhóm giải; không sửa cấu trúc hay công thức trong `app.js`.
- Chỉ đưa route hub/tài liệu vào sitemap (**29** URL); trang ngày vẫn có canonical nhưng không làm sitemap phình lên. `robots.txt` cho crawl public route, chặn dữ liệu thô và tệp nội bộ.
- `serve.py` và GitHub Actions giờ tạo lại trang tĩnh sau khi crawler chạy thành công; nếu crawler hoặc builder lỗi, trạng thái local báo lỗi thay vì ghi nhận cập nhật thành công.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Builder | Chạy lại `build_pages.py --days 90`: **180** trang ngày + **21** hub đài; lần kế tiếp **0** thay đổi. Chế độ `--check` cũng trả **0** thay đổi. |
| Nội dung tĩnh | `/xsmn/` có đúng **1** `h1`, không nạp script app, và có số XSMN mới nhất `225824` trong HTML. Trang chủ chỉ có **1** `h1` fallback; năm `h1` SPA đã đổi thành `h2`. |
| Browser local | `/xsmn/` tại **375px**: `scrollWidth=360`, viewport `375`, không tràn và console **0** lỗi. Trang chủ sau khi app render: fallback ẩn, app hiện; đổi sang XSMB/mở Lịch sử vẫn có kết quả đầy đủ, không tràn ở **375px**, console **0** lỗi. |
| Server local | `/` và `/xsmn/` đều HTTP **200**; `/api/status` báo `live:true`, XSMB **7.532** và XSMN **6.677** kỳ, cùng tới **24/08/2026**. |
| Cú pháp | Python bundled biên dịch `build_pages.py`, `update.py`, `test_update.py`; `node --check app.js` và `node --check ui.js` đạt. |

## 2026-08-25 — WP3: tách tải dữ liệu và cache

### Phạm vi đã làm

- Sinh `data/latest.js` cùng lượt với crawler: 90 kỳ mới nhất mỗi miền; trang đầu chỉ nạp `meta.js` + payload này, còn kho đầy đủ được chèn script động khi mở Thống kê, Hai miền hoặc tra cứu lịch sử sâu.
- Tách CSS còn lại sang `app.css`, giữ token/header thiết yếu inline và preload font 400/700; vẫn dùng đường dẫn tương đối để bản local không phụ thuộc framework hay CDN.
- Thay cache Vercel từ `no-store` cho toàn bộ dữ liệu sang thời hạn ngắn theo từng tệp; local `serve.py` vẫn cố ý `no-store` để nhận dữ liệu mới ngay.
- Thêm trạng thái đang tải/lỗi/thử lại cho kho đầy đủ, và xử lý trường hợp revision dữ liệu đổi trong lúc tải để loader khởi động lại với revision mới.
- `app.js` chỉ đổi lớp nạp dữ liệu từ mảng truyền vào; không sửa bất kỳ công thức hay cổng kiểm chứng nào.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Payload đầu trang | `data/latest.js`: **46.049 bytes**; XSMB **90** kỳ, XSMN **90** kỳ, cùng khoảng **27/05/2026–24/08/2026** |
| Crawler và kho | Python bundled chạy `update.py --max-fetch 40`: **3 giây**; XSMB **7.532**, XSMN **6.677** kỳ đến 24/08/2026. SHA-256 trước/sau giữ nguyên: XSMB `78D148FE…00417`, XSMN `CD3C864F…9625D`, kho thô `2A4EA89F…4218` |
| Dung lượng truyền ước tính | Các response đầu trang nén gzip riêng từng tệp: **130.551 bytes** (HTML, CSS, `latest.js`, JS và 2 font); HTML riêng **6.371 bytes gzip**. Đây là phép đo local, không thay cho Core Web Vitals production |
| Cú pháp và kiểm thử | `node --check app.js`, `node --check ui.js`, `node test_model.cjs`, `node work/check-ui-ids.cjs`: đạt (**73** ID, **0** thiếu). Python bundled `test_update.py`: **5/5**; `work/check_words.py`: đạt |
| UI tải chậm | Browser local: trang đầu có kết quả ngay; mở Thống kê nạp kho đầy đủ; nhập `323` từ trang đầu trả modal **6.677 kỳ** XSMN. Console origin: **0 lỗi**, không tràn ngang ở viewport desktop đang dùng |
| Header local | `curl` local: TTFB **0,001448 s**, HTML **23.291 bytes**; local vẫn trả `Cache-Control: no-store` theo thiết kế LIVE. Header Vercel sẽ xác minh sau deploy |

## 2026-08-25 — WP2: bố cục ưu tiên kết quả và mobile

### Phạm vi đã làm

- Giữ nguyên `app.js`, công thức thống kê, scoring, dữ liệu và luồng cập nhật.
- Đưa kết quả lên trước: ngày/trạng thái, Giải đặc biệt, Giải nhất, các giải còn lại và tổng hợp 2 số cuối; dải ngày chuyển xuống sau kết quả.
- XSMN trên mobile có thẻ một đài, chip đổi đài và vuốt ngang; XSMB dùng một thẻ. Desktop giữ bảng ngang trong vùng cuộn riêng với cột Giải và header dính.
- Rút gọn header mobile thành 99px tại 375px, giữ chọn miền nổi bật, đưa 5 điểm đến vào thanh đáy và để tìm số mở khi chạm biểu tượng.
- Sửa màu chọn XSMN ở giao diện sáng từ `#c85536` sang `#c04f31` để chữ trắng đạt tương phản đủ mức; số đuôi chỉ nhấn nhẹ bằng màu nhấn, không dùng màu cảnh báo.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Syntax + model | `node --check app.js`, `node --check ui.js`, `node test_model.cjs`: đạt |
| Crawler + quét từ | Python bundled `test_update.py`: **4/4 đạt**; `work/check_words.py`: đạt |
| Liên kết UI + diff | `node work/check-ui-ids.cjs`: **72** ID được gọi, **0** ID thiếu; `git diff --check`: đạt |
| Responsive | **60** điểm kiểm (5 màn × XSMN/XSMB × 6 kích thước): `scrollWidth - clientWidth = 0`; kích thước trình duyệt thực tế do làm tròn là 321/375/391/415/770/1282px và 1280px |
| Mobile | Header **99px** tại 375px; Giải đặc biệt hiện trong màn hình đầu; tìm số mở/đóng, đổi đài và vuốt đài XSMN hoạt động |
| Desktop | Bảng kết quả hiện đúng Giải đặc biệt → Giải nhất → giải còn lại; cột Giải/header `sticky`; không có body horizontal scroll |
| Console | Console từ origin `127.0.0.1:8368` **0 lỗi**. Hai lỗi inject từ extension ví EVM của Chrome được tách riêng, không thuộc app |
| Tương phản token chính | sáng: chữ **15.01:1**, phụ **6.22:1**, chọn MB **4.91:1**, chọn MN **4.77:1**; tối: **16.45:1**, **9.96:1**, **7.47:1**, **8.82:1** |

## 2026-08-25 — WP1: hệ thiết kế, font tiếng Việt và bảng kết quả tự dựng

### Phạm vi đã làm

- Dùng Be Vietnam Pro tự lưu trữ (400/600/700), có SIL OFL 1.1, `font-display: swap`, `unicode-range` và tổng WOFF2 dưới ngân sách.
- Hợp nhất token sáng/tối theo ngữ nghĩa; thêm lựa chọn Sáng / Tối / Theo hệ thống, lưu cục bộ và chống nháy lúc tải trang.
- Bỏ iframe cùng CSP `frame-src`; bảng kết quả mới nhất dựng từ kho dữ liệu của Kết Số, có polling `data/meta.js` trong giờ cập nhật và nút tải lại.
- Thêm câu nguồn chuẩn dưới mỗi bảng kết quả, trang `/nguon-du-lieu/`, liên kết công bố của công ty xổ số kiến thiết, và cập nhật `privacy.html`.
- Thêm `work/check_words.py` dùng ranh giới Unicode, chạy trong GitHub Actions trước crawler; dọn CSS iframe chết, emoji UI và các control <14px còn sót trên mobile/dark mode.
- Không thay đổi `app.js`, công thức thống kê, scoring hoặc dữ liệu lịch sử.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Font | Be Vietnam Pro 400/600/700 tải local, tổng **84.092 bytes** WOFF2 (ngân sách ≤92.160); `fonts/OFL.txt` có mặt |
| Syntax + model | `node --check app.js`, `node --check ui.js`, `node test_model.cjs`: đạt |
| Crawler unit | `py test_update.py`: **4/4 đạt** |
| Liên kết UI | `node work/check-ui-ids.cjs`: **69** ID được gọi, **0** ID thiếu |
| Quét source | `work/check_words.py`: đạt; `radial-gradient=0`, `backdrop-filter=0`, `iframe=0`, `minhngoc=0`, `prefers-color-scheme=4` |
| Browser | 5 màn public × XSMN/XSMB tại **375px** và **1280px**: không tràn ngang; console **0 lỗi**. Đã chụp sáng/tối ở cả mobile và desktop; font load thành công |
| Trang nguồn | `/nguon-du-lieu/` tải local, dùng font tự host và không có lỗi console |
| Diff/config | `git diff --check` đạt; `vercel.json` parse JSON thành công |

## 2026-08-24 — WP0: làm sạch bản public và cô lập tệp nội bộ

### Phạm vi đã làm

- Thêm `.vercelignore`: chặn tài liệu nội bộ, mã crawler/server/test, `work/`, `.github/` và dữ liệu thô `data/xsmn.json` khỏi artifact Vercel.
- Siết `robots.txt` và thêm `X-Robots-Tag: noindex, nofollow, noarchive` cho phần mở rộng nội bộ còn có thể được request.
- Gỡ khỏi giao diện public toàn bộ luồng chọn số, ghim/loại, nhật ký, kiểm chứng và EV; `Mẫu lịch sử` chỉ còn mô tả kết quả đã công bố, không tạo suy luận cho kỳ sau.
- Lưu bản trích xuất các block UI cũ dưới `work/_removed_for_rewrite/`, đồng thời ignore thư mục này để không thể vô tình commit/deploy.
- Đồng bộ tên thương hiệu và thuật ngữ trong tài liệu/code đang theo dõi. `app.js` chỉ thay chuỗi hiển thị và comment (20 dòng thêm / 21 dòng bỏ); không đổi công thức, scoring hay dữ liệu lịch sử.

### Kiểm chứng local có số liệu

| Hạng mục | Kết quả |
|---|---|
| Cú pháp + model | `node --check app.js`, `node --check ui.js`, `node test_model.cjs`: đạt |
| Liên kết UI | `node work/check-ui-ids.cjs`: **72** ID được gọi, **0** ID thiếu |
| Browser matrix | **56/56** lượt render: 5 tab public + 3 màn Thống kê × XSMN/XSMB × 2/3 số tại **375px** và **1280px**; **0px** tràn ngang, **0** lỗi console từ app |
| Backtest nội bộ | XSMB / tất cả giải / 3 số / W365 / 300 kỳ / dàn 10: **0,897 giây**; hit **66** vs kỳ vọng **68,36**, uplift **−3,45%**, top1 z **0,45** |
| Crawler | `test_update.py`: **4/4 đạt**. `update.py --max-fetch 40`: XSMB **7.532→7.532**, XSMN **6.677→6.677**, cùng đến **24/08/2026**; không mất kỳ cũ |
| Quét public source | Không có cụm định hướng chọn số trong file đang theo dõi/deploy; scan focused không thấy secret, credential, path máy hay email riêng trong source public |
| Kiểm tra diff | `git diff --check`: đạt; `vercel.json` parse JSON: đạt |
| Production | Commit `d294a43` đã deploy: `/` **HTTP 200**; `/ROADMAP.md`, `/update.py`, `/data/xsmn.json` đều **HTTP 404** và có `X-Robots-Tag: noindex, nofollow, noarchive`; `robots.txt` **HTTP 200** |

### Ranh giới phát hành

- Đây là dọn bề mặt public và kiểm soát artifact deploy, không phải chứng nhận pháp lý hay giấy phép kinh doanh.
- Bước viết lại lịch sử Git chỉ được chuẩn bị sau khi bản public đã được xác minh. Lệnh force-push bị giữ lại để chủ dự án phê duyệt riêng.

### Rewrite lịch sử local — 2026-08-25

- Đã tạo mirror backup `../XSPTKT-backup-before-rewrite.git`; backup và repo đều có **15** commit, `git fsck --no-dangling` đạt trước khi rewrite.
- File rule gốc có comment mà `git-filter-repo` không tự bỏ qua. Đã phát hiện lỗi ở preflight, khôi phục từ mirror, tạo bản lọc chỉ bỏ comment/blank nhưng giữ nguyên **88** luật thực, rồi chạy lại.
- Một thay thế literal làm biến dạng cụm trung tính có hậu tố giống từ cần lọc. Đã tạo rule repair duy nhất, kiểm `HEAD`, rồi đồng bộ chính xác `BLUEPRINT.md` và `app.js` về `HEAD` sau khi tool để lại index cũ.
- Kết quả cuối: **15/15** commit có **0** hit theo scan có ranh giới từ; không có tên file nhạy cảm trong lịch sử; `node --check app.js`, `node --check ui.js`, `test_model.cjs`, `test_update.py` (**4/4**), ID check (**72/0**) và backtest 300 kỳ (**0,822 giây**, hit **66** vs kỳ vọng **68,36**) đều đạt.
- Browser QA sau rewrite: **56/56** lượt tại 375px và 1280px, **0px** tràn ngang, **0** lỗi console.
- Chủ dự án đã xác nhận force-push. Ngày 25/08/2026, `origin/main` được thay bằng lịch sử đã làm sạch tại SHA `70bf9fa55f1fad305c4f2fd4938832ec92914fcc`; mirror backup còn nguyên. Clone cũ cần fetch/reset hoặc clone lại; fork độc lập không bị xoá.
- Sau force-push, production `https://xsptkt.vercel.app/` trả **HTTP 200**; `/ROADMAP.md`, `/update.py` và `/data/xsmn.json` vẫn trả **HTTP 404**.

## 2026-08-23 — Chuyển thành Kết Số: kết quả/live đứng đầu, public mainstream

### Phạm vi đã làm

- Đổi thương hiệu public thành **Kết Số**; thêm logo SVG, favicon/app icon, social card 1200×630,
  manifest, canonical, Open Graph/Twitter card, JSON-LD, `robots.txt` và `sitemap.xml`.
- Xây lại trang đầu theo thứ tự **kết quả gần nhất → bảng đầy đủ từng giải → live Minh Ngọc**;
  khi đúng giờ quay, bảng live tự được đưa lên trước. XSMN đứng trước XSMB.
- Thêm tab **Lịch sử** theo ngày, giữ ô tìm kiếm lớn cho 2/3 số và thay modal cũ bằng lịch sử thuần mô tả.
  Giao diện public có 5 tab: Kết quả, Lịch sử, Thống kê, Hai miền, Nguồn.
- Loại cột “khả năng ra kỳ sau” và mọi nội dung chọn dàn/nhật ký dự đoán khỏi giao diện public. Bản đồ số,
  khoảng cách và mẫu lịch sử dùng câu ngắn, luôn nêu mức chung và cảnh báo dữ liệu cũ không dự báo kỳ sau.
- Thêm `privacy.html`, security headers trên Vercel và siết iframe còn `allow-scripts allow-same-origin`
  với `referrerpolicy=no-referrer`. Thêm `.gitignore` cho `__pycache__` và settings local.
- Thêm `MONETIZATION_PLAN.md`; thương mại hoá bị chặn cho đến khi có quyền nguồn rõ ràng, rà soát pháp lý
  và cập nhật privacy/consent cho dịch vụ quảng cáo hoặc analytics thực tế.
- Không sửa `app.js`, công thức, scoring hay dữ liệu lịch sử.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Cú pháp + regression | `node --check app.js`, `node --check ui.js`, `node test_model.cjs`: đạt; `test_update.py`: **4/4 đạt** |
| Browser matrix | **56/56 lượt render**: 5 tab public + 3 màn Thống kê × XSMN/XSMB × 2/3 số tại **375px và 1280px**; **0px tràn ngang** |
| Console | Sau toàn bộ matrix, tìm kiếm và đổi iframe MN/MB: **0 lỗi console** |
| Kết quả theo ngày | Trang đầu có **7** ngày; XSMN render **9** dòng giải, XSMB **8** dòng; lịch sử mặc định **14** ngày và mở dần đến 120 |
| Search/modal | `68` và `668` mở đúng modal lịch sử, **0px tràn**; input `6` bị chặn với thông báo rõ |
| Backtest nội bộ | XSMB / tất cả giải / 3 số / W365 / 300 kỳ / dàn 10: **0,728 giây**, hit **67** vs kỳ vọng **68,37**, uplift **−2,00%**, top1 z **0,45** |
| Crawler thật | `update.py --max-fetch 40`: **1 giây**; trước/sau XSMB **7.531→7.531**, XSMN **6.676→6.676**, cùng đến **23/08/2026**; không mất kỳ cũ |
| Auto-update | Scheduled run GitHub Actions **#2**, ID `32635122337`: `success`, **17 giây**, ngày 23/08/2026; workflow vẫn có cron 16:42/18:42 ICT |
| Production | Commit giao diện `b87460a` đã lên `main`; `https://xsptkt.vercel.app/` trả **HTTP 200**, mobile/desktop **0px tràn**, **0 lỗi console**; favicon/social card/privacy/sitemap đều HTTP 200 |
| Security headers | Production có CSP, HSTS 2 năm, `nosniff`, `SAMEORIGIN`, Referrer-Policy, Permissions-Policy; `data/meta.js` trả `Cache-Control: no-store` |
| Copy public | Quét 5 view đang hiển thị: **0** từ/cụm định hướng chọn số cho kỳ sau; bản public chỉ mô tả kết quả và dữ liệu đã công bố |
| PII/secrets | Không có private key, credential, email riêng hay path người dùng trong source chuẩn bị commit; GitHub owner và email `users.noreply.github.com` trong lịch sử là metadata public sẵn có |

Kết luận thống kê không đổi: dữ liệu chưa chứng minh lợi thế dự báo. Bản public chỉ phục vụ kết quả,
lịch sử và phân tích những gì đã xảy ra.

## 2026-08-23 — Kết quả live Minh Ngọc + polish public lần cuối

### Phạm vi đã làm

- Thêm tab **Kết quả** đứng đầu và là màn mặc định; nhúng iframe miễn phí chính thức của Minh Ngọc cho
  XSMN/XSMB, có trạng thái theo giờ Việt Nam, tải lại bảng, link mở nguồn, credit và miễn trừ trách nhiệm.
  Chỉ bảng live được ghi nguồn Minh Ngọc; kho lịch sử của app vẫn ghi đúng là dữ liệu crawler riêng.
- Hoàn thiện visual public: 5 tab có hierarchy rõ, hero live, source lockup, footer nguồn/tin cậy,
  metadata SEO/OG + manifest; mobile giữ search lớn và nav nhìn thấy ngay. Không sửa `app.js`, scoring,
  xác suất hay tín hiệu dự đoán.
- Sửa lịch GitHub Actions từ 17:37/19:37 thành **16:42/18:42 ICT** (`09:42`/`11:42 UTC`) để crawl
  ngay sau hai kỳ quay; vẫn chỉ commit khi `data/` thật sự đổi.
- Tìm và sửa 1 bug UI thật: nhấn Enter trong ô soi số mở modal rồi đóng ngay vì focus chuyển sang nút
  đóng trong cùng key event. Thêm `preventDefault()` tại handler search; không ảnh hưởng `openNum()` từ nút số.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Cú pháp + regression | `node --check app.js`, `node --check ui.js`, `node test_model.cjs`: đạt (`test_model: OK`) |
| Test crawler | Python bundled `test_update.py`: **4/4 đạt** |
| Crawler thật | `update.py --max-fetch 40`: **2 giây**; XSMB **7.530→7.531** kỳ, XSMN **6.676→6.676**; cả hai đến **23/08/2026**, không mất dữ liệu cũ |
| GitHub Actions hiện hữu | Scheduled run **#2** hoàn tất `success` trong **17 giây**, tạo commit dữ liệu `a55a8ce`; chứng minh quyền ghi + auto-update đang hoạt động trước khi đổi lịch |
| Browser matrix | **56 lượt render**: 5 tab public + 3 màn Thống kê × MN/MB × 2/3 số tại **375px và 1280px**; **0 case lỗi, 0px tràn ngang** |
| Live source | Iframe MN/MB tải xong, URL live/source/credit đúng; origin app **0 lỗi console**. Iframe Minh Ngọc có 2 `SecurityError` cross-origin từ jQuery của chính nguồn nhưng bảng vẫn tải và tự cập nhật |
| Search/modal | `68` và `668` đều mở đúng modal, giữ focus ở nút đóng, có bảng 4 cỡ mẫu; input `6` bị chặn với thông báo đúng; **0px tràn** |
| Backtest UI | XSMB / tất cả giải / 3 số / 300 kỳ / W365 / dàn 10: **0,8 giây**; OOS **−2,0%**, top1 **p=0,325**, trong mẫu **+98,9%** |

Kết luận thống kê không đổi: chưa có predictive edge; tab Chọn dàn tiếp tục chọn đều, tái lập theo ngày.

## 2026-08-23 — Redesign toàn bộ flow public, ưu tiên mobile

- Phạm vi được chủ dự án mở lại sau bản khoá v1.0: chỉ thay kiến trúc thông tin, visual, responsive, animation và accessibility; **không sửa `app.js`, scoring, xác suất hay tín hiệu dự đoán**.
- XSMN đứng trước và là miền mặc định; switch miền tách khỏi 4 tab chức năng. Tab có tên + mục đích trên desktop, icon + nhãn ngắn trên mobile.
- Kỳ mẫu sắp tăng dần: **7 ngày → 1 tháng → 3 tháng → 6 tháng → 1 năm → 3 năm → 5 năm → 5000 ngày → Toàn bộ lịch sử**. Mobile có tóm tắt mẫu đang dùng và gợi ý vuốt.
- Trang Hôm nay đổi thành flow 3 bước: phạm vi giải → 2/3 số → số lượng; kết quả, xác suất nền và CTA copy nằm trong một vùng riêng. Thêm màu nhận diện theo miền (MN cam, MB xanh), hierarchy mới, micro-interaction, view/modal/number entrance animation và `prefers-reduced-motion`.
- Thống kê có tiêu đề trang, subnav rõ, bộ lọc chia nhóm; favicon + manifest đồng bộ visual mới. Các control chính dùng button semantic, có focus-visible/ARIA.

### Kiểm chứng có số liệu

| Hạng mục | Kết quả |
|---|---|
| Cú pháp + regression | `node --check app.js`, `node --check ui.js`, `node test_model.cjs`: đạt (`test_model: OK`) |
| Browser matrix | 4 tab công khai + 3 màn Thống kê × XSMN/XSMB × 2/3 số tại 320px: **0 lỗi console, 0px tràn ngang** |
| Responsive | 320, 375, 768, 1024, 1440px: **0px tràn ngang**; search invalid/valid, modal `668`, focus nút đóng đều đạt |
| Backtest UI | XSMB / tất cả giải / 3 số / 300 kỳ / W365 / dàn 10: **1,1 giây**; OOS **−2,0%**, top1 **p=0,325**, trong mẫu **+100,3%** |
| Crawler | `update.py --max-fetch 40`: **3 giây**; trước/sau XSMB **7.530**, XSMN **6.675** kỳ, cùng mới nhất **22/08/2026**; thêm/sửa/mất **0** kỳ |
| Test crawler | `test_update.py`: **4/4** đạt |

Kết luận thống kê không đổi: chưa có predictive edge; dàn kỳ tới tiếp tục chọn đều, tái lập theo ngày.

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
- Tại thời điểm ghi mục này chưa deploy thật; cần push repo GitHub và kết nối Vercel theo `DEPLOY_VERCEL.md`.

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

Kết luận: thay đổi phân phối/UI không làm phát sinh bằng chứng predictive edge. Website sẵn sàng để deploy; auto-update chỉ bắt đầu sau khi workflow có quyền ghi trong GitHub repo.

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
- `/api/status` trả `live:true`; desktop shortcut local trỏ đúng `MoApp.bat`.
