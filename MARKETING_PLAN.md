# Kế hoạch tăng trưởng Kết Số

## Mục tiêu

Xây Kết Số thành một điểm đến dễ đọc để xem XSMN/XSMB, tra cứu kỳ đã công bố và hiểu dữ liệu lịch sử. Tăng trưởng phải dựa vào độ tươi, trải nghiệm đọc nhanh và tính minh bạch của dữ liệu; không đặt kỳ vọng vào việc mô tả quá khứ như một kết luận cho kỳ sau.

## Ba giai đoạn

### 1. Nền tảng vận hành

- Giữ lịch cập nhật ổn định sau mỗi giờ quay; theo dõi tỷ lệ run GitHub Actions thành công, thời gian chậm dữ liệu và lỗi parser.
- Giữ HTML kết quả thật cho trang chủ, XSMN, XSMB, ngày gần đây và 21 đài.
- Đăng ký Google Search Console và Bing Webmaster Tools sau khi có domain riêng; gửi sitemap bằng giao diện quản trị, không dùng endpoint cũ.
- Cung cấp đầu mối liên hệ chính thức trước khi chạy truyền thông rộng rãi.

### 2. SEO và nội dung hữu ích

| Nhóm | Trang/dạng nội dung |
|---|---|
| Nhu cầu xem kết quả | `xsmb`, `xsmn`, `kqxs`, kết quả hôm nay, kết quả theo ngày |
| Nhu cầu theo địa phương | trang 21 đài, lịch quay, cách đọc từng giải |
| Nhu cầu hiểu dữ liệu | tần suất 2 số cuối, khoảng cách giữa các lần xuất hiện, cách đọc bản đồ nhiệt |

- Ưu tiên trang ngày và trang đài có số liệu thật, tiêu đề rõ ngày/miền và liên kết tới các kỳ gần đây.
- Viết bài hướng dẫn ngắn, có nguồn và ngày cập nhật: cấu trúc bảng giải, lịch quay, cách tra cứu lịch sử, giới hạn của tần suất.
- Không tạo URL theo tổ hợp số tự do, không nhân bản nội dung trên domain khác, không dùng nội dung tự động thiếu giá trị đọc.

### 3. Phát triển bền vững

Chỉ cân nhắc vị trí quảng cáo hiển thị nhẹ khi có đủ ba điều kiện: dữ liệu cập nhật ổn định tối thiểu 30 ngày, chính sách quyền riêng tư phù hợp với dịch vụ thực tế, và trải nghiệm mobile không bị che nội dung kết quả. Các `.ad-slot` đã giữ chỗ có chiều cao cố định để không làm nhảy bố cục khi chưa bật dịch vụ nào.

## Chỉ số theo dõi

- Tỷ lệ workflow thành công và số phút chậm sau giờ quay.
- Số trang có HTML kết quả mới nhất và số lỗi parser bị chặn.
- Người dùng/ngày, tỷ lệ quay lại 7 ngày, số trang mỗi phiên.
- LCP, INP, CLS trên mobile và tỷ lệ lỗi JavaScript từ origin app.
- Lượt truy vấn tìm kiếm dẫn tới XSMN, XSMB, ngày quay và trang đài.

## Việc chủ dự án cần quyết

1. Chọn và kết nối domain riêng.
2. Cung cấp email hoặc đầu mối liên hệ công khai đã được phép dùng.
3. Đăng ký các công cụ quản trị tìm kiếm bằng tài khoản chủ dự án.
4. Xác nhận chính sách quyền riêng tư trước khi gắn bất kỳ dịch vụ đo lường hoặc hiển thị nào.

## Ranh giới nội dung

Kết Số tập trung vào kết quả đã công bố, tra cứu lịch sử và mô tả dữ liệu. Mọi bản truyền thông cần giữ câu giải thích rằng dữ liệu quá khứ không dự báo kết quả tương lai; không đưa người dùng tới dịch vụ ngoài phạm vi đó.
