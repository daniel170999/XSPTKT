# Soi XS

Website thống kê lịch sử **2 số đuôi** và **3 số đuôi** cho XSMB/XSMN. App không hứa hẹn dự đoán được kết quả; mỗi màn đều đặt tần suất lịch sử cạnh xác suất nền để tránh đọc nhầm may rủi thành tín hiệu.

## Dùng nhanh

1. Vào **Hôm nay**, chọn XSMB/XSMN, phạm vi và 2 hoặc 3 số.
2. Gõ số lớn ở đầu trang, ví dụ `68` hoặc `668`, rồi Enter để soi lịch sử xuất hiện.
3. Mở **Thống kê** khi cần bảng tần suất, gan, chu kỳ và mẫu; phần dài được thu gọn mặc định.
4. Dùng **2 Miền** để dò chéo; **Kiểm chứng** để xem backtest, không phải để biến thống kê thành lời hứa trúng thưởng.

## Website công khai: không cần database

Bản public dùng dữ liệu tĩnh trong `data/`. GitHub Actions chạy `update.py` hằng ngày, chỉ commit khi có kết quả mới; Vercel tự deploy commit đó. Mọi người cùng xem một kho dữ liệu, không có tài khoản, dữ liệu cá nhân hay database vận hành.

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
