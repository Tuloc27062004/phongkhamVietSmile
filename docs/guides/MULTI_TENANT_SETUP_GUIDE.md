# Hướng Dẫn Cấu Hình Multi-Tenancy: "Nha Khoa CT" (Chính Thức) & "Phòng Khám GZV System" (Test System 100%)

Hệ thống Clinic Platform được thiết kế với kiến trúc **Multi-Tenant (Đa phòng khám)**. Mỗi phòng khám có một không gian độc lập (`organization_id`), tách biệt 100% dữ liệu nhân sự, thiết bị và chấm công.

---

## 🏛️ 1. PHÒNG KHÁM NHA KHOA CT (Khách Hàng Thật)

- **Mã định danh (Code)**: `NHAKHOACT`
- **Mục đích**: Dùng cho môi trường vận hành thực tế tại phòng khám Nha Khoa CT.
- **Máy chấm công gắn kèm**:
  - **Mã máy**: `MCC0001` (ID: `1`)
  - **Tên máy**: `Máy MCC0001 - Nha Khoa CT`
  - **Số Serial**: `8116243500205`
  - **Địa chỉ IP nội bộ**: `192.168.1.202` (Port: `4370`)
- **Kết nối Cloud Endpoint**:
  ```text
  URL: https://kuvuvufzqtvdcyygkaym.supabase.co/rest/v1/device_logs
  API Key Org: <API_KEY_NHAKHOACT>
  ```

---

## 🧪 2. PHÒNG KHÁM BÁ LỘC (Môi Trường Test 100%)

- **Mã định danh (Code)**: `GZV_PLATFORM`
- **Mục đích**: Nơi thử nghiệm 100% các tính năng mới, giả lập chấm công, thử nghiệm tính năng kiểm soát ra vào, đẩy log giả lập mà không ảnh hưởng tới dữ liệu thật của khách hàng Nha Khoa CT.
- **Máy chấm công giả lập / Test device**:
  - **Mã máy**: `TEST_BALOC_01`
  - **Tên máy**: `Máy Test Vân Tay / FaceID - Bá Lộc`
  - **Số Serial Test**: `TEST_BALOC_9999`
  - **Địa chỉ IP Test**: `127.0.0.1` (hoặc IP máy Dev)
- **Kết nối Cloud Endpoint**:
  ```text
  URL: https://kuvuvufzqtvdcyygkaym.supabase.co/rest/v1/device_logs
  API Key Org: <API_KEY_GZV_PLATFORM>
  ```

---

## 🛠️ File Migration Tạo Dữ Liệu Sẵn Cho 2 Phòng Khám
Bản ghi khởi tạo đã được tạo tự động tại migration file:
[20260813080000_seed_ct_and_baloc_tenants.sql](file:///d:/PhongKhamPlatform/phongkhamVietSmile/supabase/migrations/20260813080000_seed_ct_and_baloc_tenants.sql)
