# Xử lý lỗi thường gặp — Trường học 5.0

## Trang trống sau khi triển khai
**Dấu hiệu:** URL Apps Script chỉ hiện khung trống hoặc không hiện form đăng nhập.

**Nguyên nhân thường gặp**
1. Bản phát hành vẫn trỏ đến phiên bản cũ.
2. Tệp `Index.html` bị dán nối tiếp vào mã cũ thay vì thay thế toàn bộ.
3. JavaScript có lỗi cú pháp; mở Công cụ phát triển của trình duyệt sẽ thấy thông báo lỗi.

**Cách xử lý**
1. Vào **Triển khai → Quản lý các tùy chọn triển khai → Chỉnh sửa**.
2. Ở **Phiên bản**, chọn **Phiên bản mới**.
3. Kiểm tra hai tệp `Code.gs` và `Index.html`; dùng Ctrl+A trước khi dán toàn bộ nội dung thay thế.
4. Lưu dự án, bấm **Triển khai**, rồi tải lại trang bằng Ctrl+F5.
5. Nếu vẫn trống, kiểm tra Nhật ký thực thi và Console. Không dùng lại phiên bản có lỗi.

## Giáo viên không mở được ứng dụng
Trong cấu hình triển khai, chọn **Người có quyền truy cập: Bất cứ ai có Tài khoản Google**. Hệ thống vẫn chỉ cho tài khoản đã được quản trị viên duyệt vào sau khi xác thực email.

## Không nhận được mã xác thực
- Kiểm tra Thư rác/Spam.
- Chờ ít nhất 60 giây trước khi yêu cầu mã mới.
- Xác nhận email và số điện thoại đã nhập đúng.
- Kiểm tra dự án đã được cấp quyền Gmail.

## Chưa thấy Google Sheet hoặc Drive
Các liên kết này chỉ xuất hiện sau lần quản trị viên đầu tiên đăng nhập thành công. Khi đó ứng dụng tự tạo thư mục **Trường học 5.0** và Google Sheet dữ liệu trong Drive của tài khoản triển khai.

## Sổ họp không xuất được PDF
Kiểm tra quyền Drive/Google Docs của Apps Script. Nội dung, tên sổ và người chủ trì là bắt buộc. Ảnh chữ ký chỉ nhận PNG, JPG hoặc WebP, tối đa 1 MB.

## Quy trình phát hành an toàn
- Luôn cập nhật GitHub trước.
- Thay thế toàn bộ tệp trong Apps Script, không dán nối tiếp.
- Lưu, tạo **Phiên bản mới**, triển khai.
- Mở URL triển khai trong một tab mới và kiểm tra màn hình đăng nhập trước khi thông báo cho giáo viên.
