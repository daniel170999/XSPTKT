# Kết Số

Website công khai để xem kết quả XSMN/XSMB, tra cứu các kỳ đã công bố và xem thống kê mô tả của 2 hoặc 3 số cuối.

## Dùng nhanh

1. Mở **Kết quả** để xem kỳ mới nhất theo XSMN hoặc XSMB.
2. Mở **Lịch sử** để xem lại đầy đủ từng giải theo ngày.
3. Nhập `68` hoặc `668` vào ô tìm kiếm để xem các lần xuất hiện trong kho dữ liệu.
4. Mở **Thống kê** để xem bản đồ số, tần suất, khoảng cách và mẫu lịch sử.

Mọi thống kê chỉ mô tả kết quả đã công bố. Dữ liệu quá khứ không cho biết kết quả kỳ tiếp theo.

## Nguồn và cập nhật

- Kho lịch sử được tổng hợp từ các nguồn công bố kết quả có parser kiểm tra cấu trúc; khi phù hợp, crawler đối chiếu thêm với trang công ty xổ số kiến thiết có `robots.txt` cho phép.
- Một lần tải lỗi không được làm giảm kho dữ liệu đang có; ngày thiếu bảng sẽ được thử lại ở lượt sau.
- GitHub Actions chạy sau hai giờ quay, sau đó chạy `build_pages.py` để cập nhật cả dữ liệu tương tác lẫn HTML tĩnh.

## Kiến trúc public

Không cần database. Dữ liệu công khai nằm trong `data/`:

1. `update.py` tải và kiểm tra dữ liệu.
2. `build_pages.py` sinh trang chủ, hub XSMN/XSMB, 90 ngày mỗi miền, 21 hub đài, sitemap và robots.
3. GitHub Actions chỉ commit khi đầu ra thực sự thay đổi.
4. Vercel deploy commit mới.

Không có tài khoản, API key phía client, server ghi dữ liệu hay service worker. Hướng dẫn deploy: [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

## Chạy trên máy

- `MoApp.bat`: mở bản local có tự cập nhật.
- `CapNhat.bat`: cập nhật dữ liệu thủ công.
- `python update.py` rồi `python build_pages.py`: cập nhật dữ liệu và trang tĩnh bằng terminal.

## Các file chính

- `templates/index.template.html`: nguồn trang chủ app.
- `index.html`: đầu ra trang chủ có fallback kết quả khi JavaScript chưa chạy.
- `app.css`: CSS chung.
- `ui.js`: render kết quả, thống kê và tương tác.
- `app.js`: các phép thống kê thuần, không thao tác DOM.
- `update.py`: tải, kiểm tra và ghi dữ liệu.
- `build_pages.py`: tạo route HTML công khai.
- `.github/workflows/update-lottery-data.yml`: lịch cập nhật public.

## Kiểm tra trước khi phát hành

```powershell
node --check app.js
node --check ui.js
node test_model.cjs
python test_update.py
python build_pages.py --check
python work/check_words.py
```

Sau đó chạy app thật và kiểm tra XSMN/XSMB, 2 số/3 số, các tab, ô tìm kiếm, modal và responsive 375px/1280px theo [RULES.md](RULES.md).
