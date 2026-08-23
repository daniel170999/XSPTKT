# Soi XS

Website xem kết quả trực tiếp và thống kê lịch sử **2 số đuôi** / **3 số đuôi** cho XSMN, XSMB. App không hứa hẹn dự đoán được kết quả; mỗi màn thống kê đều đặt tần suất lịch sử cạnh xác suất nền để tránh đọc nhầm may rủi thành tín hiệu.

## Dùng nhanh

1. Vào **Kết quả** để xem bảng quay trực tiếp XSMN/XSMB từ Minh Ngọc.
2. Vào **Chọn dàn**, chọn miền, phạm vi, loại 2/3 số và số lượng cần lấy.
3. Gõ số lớn ở đầu trang, ví dụ `68` hoặc `668`, rồi Enter để soi lịch sử xuất hiện.
4. Mở **Thống kê** khi cần bảng tần suất, gan, chu kỳ và mẫu; phần dài được thu gọn mặc định.
5. Dùng **Hai miền** để dò chéo; **Kiểm chứng** để xem backtest, không phải để biến thống kê thành lời hứa trúng thưởng.

## Nguồn kết quả trực tiếp

Bảng live được nhúng bằng mã miễn phí chính thức của [Minh Ngọc](https://www.minhngoc.net.vn/tao-ma-nhung/ket-qua-xo-so.html). Trong app luôn có credit, liên kết mở nguồn gốc và lưu ý kết quả chỉ mang tính tham khảo; biên bản quay thưởng của công ty xổ số là căn cứ cuối cùng.

Phần **dữ liệu lịch sử/thống kê** là kho riêng do `update.py` tổng hợp từ các nguồn công khai được khai báo trong crawler; không được gắn nhãn sai là dữ liệu Minh Ngọc.

## Website công khai: không cần database

Bản public dùng dữ liệu tĩnh trong `data/`. GitHub Actions chạy `update.py` lúc **16:42** và **18:42** giờ Việt Nam, chỉ commit khi có kết quả mới; Vercel tự deploy commit đó. Bảng live là iframe từ Minh Ngọc nên hoạt động độc lập với lần cập nhật kho thống kê. Mọi người cùng xem một kho dữ liệu, không có tài khoản, dữ liệu cá nhân hay database vận hành.

Xem hướng dẫn từng bước tại [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md).

## Chạy trên máy

- `MoApp.bat`: mở bản local.
- `CapNhat.bat`: cập nhật tay một lần.
- `py update.py`: cập nhật bằng terminal.

## Cấu trúc chính

- `app.js`: thống kê và mô hình thuần, không thao tác DOM.
- `ui.js`: giao diện và tương tác.
- `update.py`: lấy, kiểm tra và ghi dữ liệu xổ số.
- `.github/workflows/update-lottery-data.yml`: lịch cập nhật public.
- `vercel.json`: không cache file dữ liệu để bản mới hiện sau deploy.

## Lưu ý

Xổ số là ngẫu nhiên. Công cụ này chỉ hỗ trợ xem lịch sử, không đảm bảo kết quả; chỉ chơi với số tiền có thể chấp nhận mất.
