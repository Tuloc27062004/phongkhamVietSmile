# Hướng Dẫn Sử Dụng GZV Clinic Platform

## 1. Khởi chạy dự án (developer)

```bash
npm install
npm run dev      # http://localhost:8080
npm run build    # kiểm tra build production
npx tsc --noEmit # kiểm tra type
```

Cấu hình biến môi trường: copy `.env.example` → `.env`, điền giá trị thật lấy từ Supabase Dashboard (xem [docs/setup/DATABASE_CONNECTIONS.md](../setup/DATABASE_CONNECTIONS.md)). Không commit `.env`.

## 2. Đăng nhập

Truy cập `/auth`, đăng nhập bằng tài khoản đã được quản trị viên phòng khám duyệt. Sau khi đăng nhập:
- Nhân viên/quản lý phòng khám → landing tại `/$slug/dashboard` (slug của org nhà).
- Super Admin (`tuloc2706@gmail.com`, `stephensouth1307@gmail.com`) → landing tại `/gzv/admin/dashboard`.

Tài khoản mới đăng ký cần được quản trị viên phòng khám duyệt (`approval_status`) trước khi dùng được hệ thống — trong lúc chờ duyệt sẽ thấy màn hình "Tài khoản đang chờ duyệt".

## 3. Với nhân viên (`employee`, `doctor`, `receptionist`)

- **Chấm công**: `/$slug/attendance/checkin` — chấm công thực tế qua thiết bị hoặc web; xem lịch sử tại `/attendance/daily`.
- **Hồ sơ cá nhân**: bác sĩ xem tại `/doctor/profile`, lịch khám tại `/doctor/schedule`, lương tại `/hr/salary`.
- **Báo lỗi/sự cố**: `/issues/report`, xem lại các báo cáo đã gửi tại `/issues/my-reports`.

## 4. Với quản lý/quản trị viên phòng khám (`manager`, `administrator`)

### Nhân sự
`/employees`, `/departments`, `/positions`, `/shifts` — hiện là **trang xem danh sách**, chưa có form Thêm/Sửa trên UI. Thêm nhân sự mới cần thao tác trực tiếp trên database (liên hệ đội kỹ thuật).

### Chấm công
- `/attendance/daily`, `/attendance/monthly` — xem theo ngày/tháng.
- `/attendance/manual` — nhập chấm công thủ công cho nhân viên (dùng khi máy chấm công lỗi).
- `/attendance/adjustments` — duyệt/từ chối yêu cầu điều chỉnh công (đi trễ có lý do, sửa giờ vào/ra...).
- `/attendance/overtime` — quản lý tăng ca, duyệt theo trạng thái `pending → approved → paid`.

### Tính lương
`/hr/payroll`:
1. Chọn tháng/năm — hệ thống **tự tính lương trực tiếp** từ chấm công tháng đó (không cần bấm "tính"): số ngày công, số lần đi trễ (chỉ tính khi trễ > 15 phút), số ngày vắng, trừ lương tương ứng, bảo hiểm 10%, ra lương thực lãnh.
2. Bấm **"Duyệt"** từng dòng để lưu chính thức vào lịch sử lương (`payroll_records`).
3. Bấm **"In bảng lương"** để in toàn bộ bảng tháng đó, hoặc bấm icon máy in ở từng dòng để **in phiếu lương riêng** cho một nhân viên (mở hộp thoại in của trình duyệt).

### Báo cáo
`/reports/attendance`, `/reports/appointments` — xem/lọc dữ liệu. `/reports/export` — xuất **CSV hoạt động thật**; các nút Excel/PDF/Docs hiện chỉ là placeholder (chưa có thư viện xuất file tương ứng).

## 5. Với Super Admin (quản trị toàn nền tảng)

Tại `/gzv/admin/dashboard`:
- **Xem tất cả phòng khám**: bảng chi tiết theo chuyên khoa, số nhân viên/bác sĩ/thiết bị so với hạn mức.
- **Chuyển đổi không gian làm việc**: chọn phòng khám trong danh sách (hoặc dùng nút chuyển đổi ở header mọi trang) — URL sẽ đổi sang `/$slug-phòng-khám-đó/...`, mọi trang tiếp theo hiển thị đúng dữ liệu phòng khám đang chọn.
- **Tạo phòng khám mới**: xem [MULTI_TENANT_SETUP_GUIDE.md](./MULTI_TENANT_SETUP_GUIDE.md).

Khi đang ở trong một phòng khám bất kỳ (kể cả không phải org nhà), Super Admin dùng được toàn bộ tính năng của phòng khám đó y như quản trị viên của phòng khám — kể cả cấu hình hồ sơ phòng khám tại `/system/clinic-profile`.

## 6. Vai trò & quyền

Xem chi tiết tại [docs/architecture/ROLE_BASED_SYSTEM.md](../architecture/ROLE_BASED_SYSTEM.md).

## 7. Sự cố thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Vào `/$slug/...` bị chuyển hướng ngược lại slug khác | Bạn không phải Super Admin và không thuộc phòng khám đó — hệ thống tự đưa bạn về slug đúng |
| Vào slug không tồn tại → trang 404 | Kiểm tra lại đường dẫn hoặc hỏi Super Admin đã tạo phòng khám chưa |
| Trang chấm công/lương không thấy dữ liệu | Kiểm tra đã chọn đúng tháng/năm; dữ liệu chấm công phải tồn tại trước (không có tính toán "hồi tố" tự động) |
| Nút "Tải Xuống" ở báo cáo Excel/PDF không phản hồi | Tính năng chưa được xây (chỉ CSV ở `/reports/export` hoạt động) |
