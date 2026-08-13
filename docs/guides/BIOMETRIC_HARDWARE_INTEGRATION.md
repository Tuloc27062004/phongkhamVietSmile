# Hướng Dẫn Kết Nối Máy Chấm Công Phần Cứng (Vân Tay, Khuôn Mặt, Thẻ Từ)
## Dự Án: Viet Smile Clinic Suite

Hệ thống đã được thiết kế sẵn sàng 100% về cả cơ sở dữ liệu (`devices`, `device_logs`), giao diện quản lý thiết bị (`/biometric/devices`) lẫn luồng cập nhật dữ liệu chấm công thời gian thực (`/attendance/checkin`).

---

### 1. Đăng ký thiết bị phần cứng trên Hệ thống Web

1. Đăng nhập hệ thống với tài khoản Quản trị / Quản lý nhân sự.
2. Truy cập menu **Thiết bị nhận dạng** (đường dẫn: `/biometric/devices`).
3. Nhấn nút **Thêm thiết bị** và điền đầy đủ các trường:
   - **Tên thiết bị**: *Ví dụ: Máy Vân tay Sảnh Tầng 1*
   - **Loại thiết bị**: Chọn *Vân tay (Fingerprint)*, *Khuôn mặt (Face)*, hoặc *Thẻ từ (Card)*.
   - **Mã Serial Number**: Nhập chính xác mã Serial printed ở đằng sau hoặc dưới đáy thiết bị (ví dụ: `ZKT-8839201`).
   - **Địa chỉ IP / Vị trí**: Nhập IP nội bộ phòng khám (ví dụ: `192.168.1.200`) và vị trí đặt máy.

---

### 2. Cấu hình đẩy dữ liệu tự động (ADMS / Push SDK / Cloud API) từ Máy Chấm Công

Hầu hết các máy chấm công vân tay & nhận diện khuôn mặt hiện nay (ZKTeco, Hikvision, Dahua, Ronald Jack...) đều hỗ trợ chế độ ADMS / Push Webhook.

#### Thao tác trên màn hình máy chấm công:
1. Nhấn **Menu/OK** -> Chọn **Thiết lập mạng (Network Settings)** -> **Cài đặt Server Cloud / ADMS**.
2. Kích hoạt tính năng **Đẩy dữ liệu tự động (Enable Push Server / ADMS)**.
3. Điền các tham số kết nối đến Supabase Backend:
   - **Địa chỉ Server (Server Domain / Webhook URL)**: `https://kuvuvufzqtvdcyygkaym.supabase.co/rest/v1/device_logs`
   - **Port**: `443` (HTTPS Protocol).
   - **Headers Authentications** (Cài đặt trong mục Custom Header của máy):
     - `apikey`: `sb_publishable_mi_7Ri91IRykRz0W_UKF6w_7V-2WYH9`
     - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dnV2dWZ6cXR2ZGN5eWdrYXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQzMzg5NywiZXhwIjoyMTAyMDA5ODk3fQ.Df8njL4F5G5zv_ItrQBNeW0RsHGmOjPXDMxvjkBsm9I`

---

### 3. Đồng bộ Mã Nhân Viên trên Máy Chấm Công & Hệ Thống Web

Để dữ liệu chấm công khớp chính xác với từng nhân viên:

1. **Trên Máy chấm công**: Khi lấy dấu vân tay hoặc chụp khuôn mặt cho nhân viên mới, máy sẽ gán 1 mã số định danh ID (ví dụ: `101`, `102`, `1001`).
2. **Trên Web Phòng khám**:
   - Truy cập **Hồ sơ nhân viên** (`/staff/profiles`).
   - Chọn nhân viên tương ứng và sửa thông tin **Mã máy chấm công (Device User ID)** điền đúng mã ID trên máy (`1001`).

---

### 4. Cơ chế Hoạt động Realtime trên Giao diện Web

- Ngay khi nhân viên quét vân tay hoặc khuôn mặt thành công tại máy phần cứng, máy sẽ tự động gọi HTTP POST đẩy bản ghi vào bảng `device_logs`.
- Hệ thống **Supabase Realtime (WebSockets)** sẽ tự động push tín hiệu về màn hình **Chấm công thực tế** (`/attendance/checkin`).
- Màn hình sẽ ngay lập tức ghi nhận ca làm, tính số phút muộn/về sớm và hiện thông báo trực tiếp trên màn hình của Quản lý mà không cần tải lại trang.
