# Bản xem thử 0.1 — 26/09/2026
Đơn vị: Trường Tiểu học Trương Định · Tổ chuyên môn 4.

## Đã triển khai
- Apps Script, phiên bản 1, lúc 15:58 ngày 26/09/2026.
- URL: https://script.google.com/macros/s/AKfycby3TIQ_HhYP-w4KryP2KP7K5ygDlm_EzOMUeDSJ-8yoLMTwzL7vTEaN3j9WtnliB5xX/exec
- Quyền truy cập: Chỉ mình tôi (tài khoản chủ dự án).
- Giao diện có ngày giờ Việt Nam cập nhật mỗi giây, lời chào chạy từ trái sang phải, và footer ghi công theo yêu cầu.

## Đã kiểm tra
- 6 kiểm tra Node cho dữ liệu nhập Excel đều đạt.
- Kiểm tra trực tiếp trong trình duyệt: thêm thành viên, giữ dữ liệu sau tải lại, tạo lịch, điểm danh.
- File Excel thật: chặn email sai, sửa tại bảng xem trước, nhập thành công; giữ số 0 đầu điện thoại.
- Điều hướng màn hình nhỏ và kiểm tra không tràn ngang.
- GitHub Actions đã có cấu hình, nhưng chưa có lượt chạy được xác nhận; không coi đó là kiểm tra đã đạt.

## Giới hạn
Dữ liệu chỉ lưu trong trình duyệt. Chưa có xác thực ứng dụng, admin duyệt, phân quyền, Drive, Gemini, email/điện thoại hoặc tự động đồng bộ Apps Script.
Netlify đã có cấu hình build, chưa kết nối site hoặc triển khai.
Apps Script được cập nhật thủ công bằng cùng Index.html sinh từ src/. Không sửa trực tiếp bản sinh.
