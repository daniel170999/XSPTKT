# Kế hoạch phát triển và kiếm tiền cho Kết Số

## Nguyên tắc sản phẩm

Kết Số kiếm tiền từ **lượng người xem kết quả và tiện ích dữ liệu**, không từ việc bán lời hứa dự báo. Mọi vị trí thương mại phải tách rõ khỏi bảng kết quả, có nhãn minh bạch và không làm người dùng hiểu nhầm rằng nhà tài trợ ảnh hưởng đến số liệu.

## Cổng bắt buộc trước khi bật doanh thu

1. **Quyền dùng nguồn:** trang tạo mã nhúng của Minh Ngọc công bố công cụ nhúng miễn phí, nhưng điều khoản chung hạn chế tái sử dụng nội dung cho mục đích thương mại. Trước khi gắn quảng cáo, cần có xác nhận bằng văn bản từ Minh Ngọc hoặc chuyển sang nguồn dữ liệu có quyền sử dụng thương mại rõ ràng.
2. **Rà soát pháp lý:** nhờ đơn vị tư vấn tại Việt Nam kiểm tra mô hình trang tổng hợp thông tin, quảng cáo, quyền sở hữu nội dung, chính sách riêng tư và các nghĩa vụ thông báo/đăng ký áp dụng cho chủ thể vận hành thực tế.
3. **Quyền riêng tư:** chỉ bật analytics/quảng cáo sau khi cập nhật `privacy.html`, cơ chế đồng ý phù hợp và danh sách bên thứ ba.
4. **Biên tập:** không công bố số cho kỳ tiếp theo, không bán “tín hiệu”, không dùng nội dung hứa hẹn tăng khả năng trúng.

Nguồn cần đối chiếu trước khi thương mại hóa:

- Công cụ nhúng Minh Ngọc: https://www.minhngoc.net.vn/tao-ma-nhung/ket-qua-xo-so.html
- Điều khoản Minh Ngọc: https://www.minhngoc.net.vn/thong-tin/dieu-khoan-su-dung.html
- Văn bản kinh doanh xổ số: https://vanban.chinhphu.vn/?docid=163973&pageid=27160
- Quy định quản lý thông tin trên mạng: https://vanban.chinhphu.vn/?classid=1&docid=211654&orggroupid=2&pageid=27160

## Lộ trình 90 ngày

### Giai đoạn 1 — Chứng minh nhu cầu (0–30 ngày)

- Dùng domain riêng ngắn, dễ nhớ; kết nối Google Search Console và Bing Webmaster Tools.
- Theo dõi 4 chỉ số: người dùng/ngày, lượt quay lại 7 ngày, số trang mỗi phiên và tỉ lệ lỗi cập nhật.
- Tạo các trang nội dung có ích và bền: lịch mở thưởng, cách đọc bảng kết quả, lịch sử theo tỉnh, giải thích thống kê cơ bản.
- Chưa đặt quảng cáo. Mục tiêu là dữ liệu ổn định, Core Web Vitals tốt và có người quay lại tự nhiên.

**Mốc qua vòng:** tối thiểu 1.000 người dùng/tháng, cập nhật đúng ít nhất 30 ngày liên tiếp, không có khiếu nại nguồn.

### Giai đoạn 2 — Doanh thu nhẹ (31–60 ngày)

- Sau khi qua đủ các cổng ở trên, thử 1 vị trí quảng cáo dưới bảng kết quả và 1 vị trí cuối trang; tuyệt đối không che số hoặc tạo nút giả.
- Chỉ thử affiliate phổ thông phù hợp đại chúng, ví dụ thiết bị di động, ứng dụng tiện ích hoặc thương mại điện tử; loại bỏ đối tác có nội dung gây hiểu nhầm hay không phù hợp định hướng kết quả công khai.
- Bài tài trợ phải có nhãn **Nội dung tài trợ** và không trộn vào kết quả.

**Mốc qua vòng:** doanh thu trên mỗi 1.000 phiên dương, tốc độ trang không giảm quá 10%, tỉ lệ quay lại không giảm.

### Giai đoạn 3 — Sản phẩm có giá trị riêng (61–90 ngày)

- Xây trang kết quả theo tỉnh/ngày có URL thật thay vì chỉ hash, để người dùng và công cụ tìm kiếm truy cập trực tiếp.
- Cung cấp widget kết quả mang thương hiệu Kết Số cho báo địa phương/website cộng đồng sau khi quyền dữ liệu đã rõ.
- Nghiên cứu gói B2B read-only: lịch sử đã chuẩn hóa, trạng thái cập nhật và widget white-label. Không bán dự báo.
- Mở gói tài trợ cố định theo tháng cho thương hiệu phổ thông; công bố rõ vị trí, lượt xem và nhãn tài trợ.

## Mô hình doanh thu ưu tiên

| Thứ tự | Kênh | Khi nào bật | Rủi ro chính |
|---|---|---|---|
| 1 | Quảng cáo hiển thị nhẹ | Sau quyền nguồn + privacy + traffic thật | Làm chậm/tràn giao diện |
| 2 | Nội dung tài trợ có nhãn | Khi có độc giả quay lại | Mất niềm tin nếu trộn với kết quả |
| 3 | Affiliate tiện ích phổ thông | Sau khi duyệt từng đối tác | Nội dung đối tác không phù hợp |
| 4 | Widget/B2B dữ liệu | Khi có quyền dữ liệu rõ | Chi phí hỗ trợ và SLA |

## Dashboard chủ website cần theo dõi

- Độ mới dữ liệu XSMN/XSMB và số ngày cập nhật liên tiếp.
- Lượt xem trong khung 16:00–19:30, tỉ lệ quay lại 7/30 ngày.
- Search số, đổi ngày và đổi miền được dùng bao nhiêu lần.
- LCP, INP, CLS trên mobile; lỗi iframe và lỗi JavaScript origin app.
- Doanh thu/1.000 phiên, doanh thu/vị trí và tác động của quảng cáo lên tốc độ.

Không đặt mục tiêu doanh thu cố định khi chưa có traffic thật. Mỗi giai đoạn chỉ mở rộng sau khi số liệu vận hành đạt mốc và quyền sử dụng nguồn đã rõ.
