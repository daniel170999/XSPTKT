# Đưa Kết Số lên Vercel

## Kiến trúc đã dùng

Không cần database cho bản public này.

`GitHub Actions` chạy `update.py` lúc 17:37 và 19:37 giờ Việt Nam mỗi ngày. Khi có dữ liệu mới, nó commit các file trong `data/`; Vercel nhận commit đó và tự redeploy website. Như vậy mọi người cùng xem một dữ liệu thống kê, không có dữ liệu cá nhân hay tài khoản cần lưu.

> GitHub Actions chạy theo UTC, nên hai lịch trong workflow là 10:37 và 12:37 UTC. Có nút chạy tay khi cần.

## Chỉ làm một lần

1. Tạo repository mới trên GitHub, ví dụ `soi-cau-xs`. Có thể để Private nếu chỉ dùng một mình; nếu muốn người khác xem source thì để Public.
2. Trong thư mục app, mở PowerShell và chạy:

   ```powershell
   git init
   git add .
   git commit -m "public app"
   git branch -M main
   git remote add origin https://github.com/TEN_GITHUB/soi-cau-xs.git
   git push -u origin main
   ```

3. Vào [Vercel](https://vercel.com/new), đăng nhập bằng GitHub, chọn repository vừa tạo.
4. Ở màn hình cấu hình chọn **Other** / không framework, giữ `Root Directory` là thư mục này, không điền Build Command, rồi bấm **Deploy**.
5. Copy URL dạng `https://soi-cau-xs.vercel.app` để dùng trên điện thoại hoặc gửi cho bạn bè.

Vercel tự deploy lại mỗi khi GitHub có commit mới. File `vercel.json` đã buộc trình duyệt lấy mới `data/*`, tránh mở lại mà thấy kết quả cũ.

## Kiểm tra auto-update

1. GitHub → repository → tab **Actions** → chọn workflow **Cập nhật dữ liệu xổ số**.
2. Bấm **Run workflow** để thử ngay lần đầu.
3. Chờ run xanh; nếu có dữ liệu mới, tab **Commits** có commit từ `xs-data-bot` và Vercel tự tạo deployment mới.

GitHub có thể làm lịch chạy chậm một chút khi hệ thống tải cao. Workflow đã tránh phút đầu giờ và có hai lần chạy mỗi ngày. Nếu repo public không có hoạt động trong 60 ngày, GitHub có thể tắt workflow lịch; vào Actions và bật lại workflow.

## Không dùng gì

- Không database, không Vercel Blob, không API key.
- Không Vercel Cron/Function để ghi file: filesystem của function không phải nơi lưu dữ liệu lâu dài, nên không phù hợp cho kho kết quả.
- Không service worker: tránh cache cũ đè dữ liệu xổ số mới.
