# Kết Số

Website công khai để xem kết quả XSMN/XSMB trực tiếp, tra cứu các kỳ gần nhất và khám phá thống kê lịch sử 2 số hoặc 3 số đuôi.

## Dùng nhanh

1. Mở **Kết quả** để xem kỳ mới nhất; trong giờ quay, bảng trực tiếp của Minh Ngọc tự cập nhật từng giải.
2. Chọn **XSMN** hoặc **XSMB** ở đầu trang để đổi miền.
3. Mở **Lịch sử** để xem lại kết quả đầy đủ theo ngày.
4. Nhập `68` hoặc `668` vào ô tìm kiếm để xem các lần số đó từng xuất hiện.
5. Mở **Thống kê** để xem bản đồ số, tần suất, khoảng cách và mẫu lịch sử.

Mọi thống kê chỉ mô tả kết quả đã công bố. Dữ liệu quá khứ không cho biết kết quả kỳ tiếp theo.

## Nguồn dữ liệu

- **Bảng trực tiếp:** nhúng bằng [công cụ miễn phí của Minh Ngọc](https://www.minhngoc.net.vn/tao-ma-nhung/ket-qua-xo-so.html), có credit và liên kết mở nguồn ngay trên giao diện.
- **Kho lịch sử:** `update.py` tổng hợp từ các nguồn công khai được khai báo trong crawler. Phần này không được gắn nhãn là dữ liệu Minh Ngọc.
- **Kết quả chính thức:** căn cứ thông báo của công ty xổ số kiến thiết.

## Kiến trúc public

Website không cần database. Dữ liệu tĩnh nằm trong `data/`:

1. GitHub Actions chạy `update.py` lúc 16:42 và 18:42 giờ Việt Nam.
2. Workflow chỉ commit khi dữ liệu thật sự thay đổi.
3. Vercel tự deploy commit mới.
4. `vercel.json` buộc file dữ liệu lấy bản mới và đặt security headers.

Không có tài khoản, API key phía client, server ghi dữ liệu hay service worker. Xem hướng dẫn triển khai tại [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

## Chạy trên máy

- `MoApp.bat`: mở bản local.
- `CapNhat.bat`: cập nhật dữ liệu thủ công.
- `py update.py`: cập nhật bằng terminal.

## Cấu trúc chính

- `index.html`: HTML, CSS, metadata SEO và khung giao diện.
- `ui.js`: render kết quả, thống kê và tương tác.
- `app.js`: các phép thống kê thuần, không thao tác DOM.
- `update.py`: tải, kiểm tra và ghi dữ liệu.
- `.github/workflows/update-lottery-data.yml`: lịch cập nhật public.
- `privacy.html`: thông tin quyền riêng tư và nguồn nhúng bên thứ ba.

## Kiểm tra trước khi phát hành

```powershell
node --check app.js
node --check ui.js
node test_model.cjs
```

Sau đó chạy app thật và kiểm tra XSMN/XSMB, 2 số/3 số, các tab, ô tìm kiếm, modal và responsive 375px/1280px theo [RULES.md](RULES.md).
