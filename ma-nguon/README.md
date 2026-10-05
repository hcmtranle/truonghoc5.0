# Trường học 5.0 – mã Apps Script đang chạy

Web app Google Apps Script (dự án `1CpYVmoYdm4u…`), dữ liệu trên Google Sheet. Link dùng chung (không đổi qua các lần nâng cấp):
`https://script.google.com/macros/s/AKfycbxXjH7Qsu4TxMnzryqURclEMRcud89vq3TV5wP-xotKiojMYvVkrjYPCB5AHQWUaFdF/exec`

- `…/exec` – đơn vị gốc Trường Tiểu học Trương Định (Tổ chuyên môn 4).
- `…/exec?truong=<mã>` – đơn vị đăng ký (trường hoặc một tổ chuyên môn).
- `…/exec?trang=cong-dong` – trang dự án tổng (giới thiệu, đăng ký, Admin dự án).

## Thư mục `ma-nguon/`

| Thư mục | Nội dung |
|---|---|
| `dang-chay/` | Mã đang chạy trên link thật: `Code.js`, `Index.html`, `CongDong.html`, `appsscript.json`. |
| `ban-goc-2026-10-01/` | Bản gốc tải về ngày 01/10/2026 (phiên bản 33), trước mọi nâng cấp. |
| `tu-kiem-tra/` | `Test.js` – điểm tự kiểm tra `?selftest=<khóa>` chỉ dùng cho bản thử tạm trên máy chủ thật. |

Bản băm mật khẩu Admin và khóa tự kiểm tra đã được thay bằng chữ giữ chỗ trước khi đưa lên GitHub.

## Cách làm việc (máy của Thầy/Cô)

Thư mục làm việc: `My Drive/Chat GPT/truonghoc5.0/`
- `nang-cap-2026-10-01/` – mã nguồn đang phát triển, có `.clasp.json` trỏ dự án thật (thư mục duy nhất được `clasp push`).
- `thu-may-chu/` – bản thử: mã + `Test.js`, `DV_PREFIX='THU_'`; push, tạo link tạm, mở `?selftest=<khóa>`, rồi gỡ link tạm và push lại bản sạch.
- `nang-cap-parts/` – các bản lưu trước mỗi lần sửa (`*.v50.*`, `*.v53.*`…).
- `dong-bo-github.sh` – chép mã đang chạy vào kho này (thư mục `ma-nguon/`).

Triển khai (sau khi Cô đồng ý, đã sao lưu Sheet và tự kiểm tra đạt):
```sh
cd nang-cap-2026-10-01 && clasp push -f && clasp deploy -i AKfycbxXjH7Qsu4TxMnzryqURclEMRcud89vq3TV5wP-xotKiojMYvVkrjYPCB5AHQWUaFdF -d "Release …"
```
Quay lại phiên bản cũ: `clasp deploy -i AKfycbxXjH7Q… -V <số phiên bản>`.

## Nhật ký phiên bản trên link thật

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 33 | trước 01/10/2026 | Bản gốc (Release 33.3). |
| 34 | 01/10/2026 | Đợt 1: tài khoản góc phải, hồ sơ/ảnh đại diện, nhiều tổ, thành viên, đầu văn bản + Quốc hiệu, lịch họp trực tiếp/trực tuyến + điểm danh. |
| 38–39 | 01/10/2026 | Đợt 2: trợ lý AI nhiều lượt (Nghiên cứu bài học), trợ lý văn bản, biên bản có danh sách thành viên ký; thử lại khi Gemini quá tải. |
| 42 | 01/10/2026 | Đợt 3: Bài giảng tương tác (trò chơi, trắc nghiệm, trình chiếu, phiếu học tập). |
| 47 | 01/10/2026 | Mỗi người dùng tự nhập khóa Gemini riêng. |
| 50 | 02/10/2026 | Dự án tổng: nhiều đơn vị đăng ký (trường / tổ), trang `?trang=cong-dong`, Admin dự án. |
| 53 | 02/10/2026 | Đăng ký bằng bản sao Sheet mẫu + mã email, không mật khẩu; tệp tạm 30 ngày cho đơn vị đăng ký. |
| 55 | 05/10/2026 | Trường đăng ký có nhiều tổ: bộ tổ mặc định (Tổ 1–5, Tổ Tiếng Anh – Tin học, Tổ Bộ môn) chọn/sửa khi đăng ký; giáo viên bắt buộc chọn tổ; Admin đổi tổ khi duyệt, chuyển tổ, sửa tên/ẩn tổ; trường cũ được thêm tổ còn thiếu. Tự kiểm tra 42/42. |
| 57 | 05/10/2026 | Sửa lỗi tạo lịch họp “The script does not have permission… calendar”: tài khoản hệ thống chưa cấp quyền Google Lịch. Lịch họp trực tiếp/dán link vẫn được lưu và gửi email mời; họp Google Meet báo cách xử lý rõ ràng. Thêm hàm `capQuyenLichGoogle` (chạy một lần trong Apps Script để cấp quyền Lịch) và hướng dẫn trong Cài đặt. Tự kiểm tra 43/43. |

## Sao lưu dữ liệu (Google Drive của Cô, thư mục gốc)

- `[SAO LUU 2026-10-01 truoc nang cap] Trường học 5.0 — Dữ liệu`
- `[SAO LUU 2026-10-02 truoc du an tong] Trường học 5.0 — Dữ liệu`
- `[SAO LUU 2026-10-05 truoc nhieu to] Trường học 5.0 — Dữ liệu`
