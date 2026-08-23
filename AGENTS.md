# Dự án: Kết Số (XSMB / XSMN — 2 số đuôi & 3 số đuôi)

**BẮT BUỘC đọc 3 file này trước khi sửa bất cứ thứ gì:**

- **[BLUEPRINT.md](BLUEPRINT.md)** — đặc tả thiết kế, thuật toán, bảng sự thật đã đo (nguồn chuẩn duy nhất)
- **[RULES.md](RULES.md)** — luật code, luật thống kê, luật dữ liệu, checklist trước khi báo xong
- **[ROADMAP.md](ROADMAP.md)** — bản đồ file, trạng thái hiện tại, việc tiếp theo, các sự thật đã đo

## Tóm tắt 30 giây

App phân tích **2 số đuôi (00–99)** và **3 số đuôi (000–999)** của XSMB/XSMN để chọn dàn số cho kỳ quay sắp tới.
Thuần HTML/CSS/JS + Python chuẩn — **không framework, không npm, không pip, không CDN**.

- `app.js` = toán học (không đụng DOM) · `ui.js` = giao diện (không tự chế công thức) · `index.html` = khung + CSS
- `update.py` = crawler · `serve.py` = server LIVE tự cập nhật

## Ba luật quan trọng nhất

1. App **chỉ** làm 2 số đuôi và 3 số đuôi.
2. Dữ liệu thật đã chứng minh xổ số **không có trí nhớ** (lặp lại kỳ trước ≈ nền, hazard phẳng, backtest ngoài mẫu uplift ≈ 0).
   Mọi con số ra UI phải kèm mức nền / khoảng tin cậy. **Cấm** hứa hẹn trúng thưởng.
3. Chưa đo thì không được khẳng định. Đổi công thức → phải chạy lại backtest ≥300 kỳ và cập nhật ROADMAP.

## Trước khi báo "xong"

```bash
node --check app.js && node --check ui.js
```
Rồi mở app, kiểm tra 6 tab × 2 miền × 2 chế độ số, console không lỗi. Checklist đầy đủ ở RULES.md §R5.
