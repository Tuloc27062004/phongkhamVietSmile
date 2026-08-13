# Hướng Dẫn Kết Nối Máy Chấm Công (Vân Tay / Khuôn Mặt) Cho Phòng Khám Nha Khoa CT
## Hệ thống Platform Multi-Tenant (Phòng Khám Nha Khoa CT)

Hệ thống **Clinic Platform** hỗ trợ kiến trúc Multi-Tenancy (Multi-Clinic). Mỗi phòng khám được định danh bằng một **`organization_id`** riêng biệt để cách ly hoàn toàn dữ liệu nhân sự, lịch làm việc và dữ liệu chấm công.

---

### 📷 Phân Tích Thông Số Chi Tiết Từ Máy Chấm Công Của "Nha Khoa CT" (Theo Hình Ảnh)

Dựa trên hình ảnh giao diện cấu hình phần mềm máy chấm công thực tế của phòng khám **Nha Khoa CT**:

- **Mã máy**: `MCC0001`
- **ID máy**: `1`
- **Tên máy**: `Máy MCC0001`
- **Seri (Serial Number)**: `8116243500205`
- **Số đăng ký**: `110707`
- **Địa chỉ IP nội bộ**: `192.168.1.202`
- **Cổng Port**: `4370` (Port chuẩn truyền dữ liệu SDK qua TCP/IP)
- **Kiểu kết nối**: `TCP/IP`

---

### 🛠️ 2 Phương Thức Kết Nối Máy Chấm Công `MCC0001` Vào Platform

---

#### 🔹 PHƯƠNG THỨC 1: Kết nối trực tiếp qua API Endpoint của Platform (Khuyên Dùng)

Nếu máy chấm công hỗ trợ tính năng **Sử dụng địa chỉ Web (Web / ADMS / Push Server)**:

1. **Trên giao diện máy chấm công** (như trong ảnh):
   - Tích chọn ô: **[x] Sử dụng địa chỉ web**.
   - Tại ô **Địa chỉ Web**, thay `google.com.vn` bằng URL endpoint API của Platform:
     ```text
     https://kuvuvufzqtvdcyygkaym.supabase.co/functions/v1/device-events
     hoặc: https://<domain-platform>/api/public/device/events
     ```
2. **Khai báo API Key của Phòng Khám Nha Khoa CT**:
   - Mỗi phòng khám sẽ có 1 `API Key` gắn liền với `organization_id` của Nha Khoa CT.
   - Thêm Header: `x-api-key: <API_KEY_NHA_KHOA_CT>`

---

#### 🔹 PHƯƠNG THỨC 2: Kết nối qua Agent Trung Gian (Windows Service Client Agent)

Đối với các dòng máy chấm công truyền thống kết nối qua mạng LAN IP `192.168.1.202:4370` (như hình trên):

1. **Cài đặt VietSmile Agent** trên 1 máy tính nằm cùng mạng LAN với máy chấm công `192.168.1.202`.
2. **Cấu hình file `agent.config.json` trên máy tính đó**:
   ```json
   {
     "organization_name": "Nha Khoa CT",
     "api_endpoint": "https://kuvuvufzqtvdcyygkaym.supabase.co/rest/v1",
     "api_key": "<API_KEY_NHA_KHOA_CT>",
     "devices": [
       {
         "device_name": "Máy MCC0001 - Nha Khoa CT",
         "ip_address": "192.168.1.202",
         "port": 4370,
         "serial_number": "8116243500205",
         "device_id": 1
       }
     ]
   }
   ```
3. Agent sẽ tự động lắng nghe dữ liệu quét vân tay từ port `4370` của máy `192.168.1.202` và đồng bộ tức thì lên Cloud Platform cho **Nha Khoa CT**.

---

### 📋 Các Bước Khai Báo Trên Web Admin Của "Nha Khoa CT"

1. **Truy cập Trang Quản Lý Thiết Bị**: `/biometric/devices`
2. **Thêm mới thiết bị**:
   - **Tên thiết bị**: `Máy MCC0001 - Nha Khoa CT`
   - **Serial Number**: `8116243500205`
   - **IP Address**: `192.168.1.202`
   - **Loại thiết bị**: `Vân tay / Khuôn mặt`
3. **Đồng bộ Mã ID Nhân Viên**:
   - Khi tạo nhân viên thuộc phòng khám **Nha Khoa CT** tại `/staff/profiles`, điền ô **Mã máy chấm công (Device User ID)** trùng với Mã Nhân Viên cài đặt trên máy `MCC0001`.
4. **Kiểm tra Realtime**:
   - Khi nhân viên quét vân tay/khuôn mặt trên máy `MCC0001`, dữ liệu sẽ tự động đẩy về hệ thống của phòng khám **Nha Khoa CT** và hiển thị tại trang **Chấm công thực tế** (`/attendance/checkin`).
