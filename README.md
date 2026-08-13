# 🏥 GZV CLINIC PLATFORM — Nền Tảng Quản Trị Y Tế & Chấm Công Đa Phòng Khám

> **Hệ thống Quản Trị Đa Phòng Khám Đa Chuyên Khoa (Multi-Tenant Enterprise Healthcare SaaS Platform)**
> 
> *Phát triển và vận hành bởi Tập Đoàn / Công Ty GZV.*

---

## 🗺️ 1. TẦM NHÌN & ĐỊNH HƯỚNG TRIỂN KHAI NỀN TẢNG (PLATFORM ARCHITECTURE)

GZV Clinic Platform không phải là một phần mềm đơn lẻ cho 1 phòng khám, mà là một **Nền tảng Cloud SaaS phục vụ hàng trăm phòng khám, chuỗi phòng khám và bệnh viện lớn nhỏ** trên toàn quốc với kiến trúc phân tầng chuyên khoa:

```text
GZV CLINIC PLATFORM (Tầng Quản Trị Tối Cao - Super Admin Central Hub)
│
├── 🦷 NHA KHOA (`dental`)
│   ├── Nha Khoa CT (nha-khoa-ct) — Khách hàng thực tế (Máy chấm công MCC0001: 192.168.1.202)
│   ├── Nha Khoa Bá Lộc (nha-khoa-ba-loc)
│   └── Chuỗi Nha Khoa Quốc Tế ABC (nha-khoa-abc)
│
├── 🏥 PHÒNG KHÁM ĐA KHOA (`general`)
│   ├── Phòng Khám Đa Khoa Sài Gòn (da-khoa-sai-gon)
│   └── Phòng Khám Đa Khoa An Bình (da-khoa-an-binh)
│
├── 👶 SẢN - PHỤ KHOA (`obgyn`)
│   ├── Phòng Khám Sản Phụ Khoa An Đức (san-phu-khoa-an-duc)
│   └── Trung Tâm Sức Khỏe Mẹ & Bé (me-va-be)
│
├── 🧸 NHI KHOA (`pediatrics`)
├── ✨ DA LIỄU (`dermatology`)
├── 👁️ MẮT (`ophthalmology`)
├── 👂 TAI MŨI HỌNG (`ent`)
├── 💄 THẨM MỸ (`aesthetics`)
├── 🦾 VẬT LÝ TRỊ LIỆU (`rehab`)
│
└── 🏬 BỆNH VIỆN / CƠ SỞ Y TẾ LỚN (`hospital`)
    ├── Bệnh Viện Đa Khoa GZV Cơ Sở 1 (benh-vien-gzv-cs1)
    └── Bệnh Viện Quốc Tế GZV Cơ Sở 2 (benh-vien-gzv-cs2)
```

---

## 🌐 2. KIẾN TRÚC URL DYNAMIC SLUG (`/$clinicSlug/`)

Hệ thống điều hướng chuẩn Enterprise SaaS, tất cả người dùng và y bác sĩ truy cập phòng khám thông qua **URL Dynamic Slug**:

- **Nha Khoa CT**: `http://localhost:8080/nha-khoa-ct/dashboard`
- **Lịch khám Nha Khoa CT**: `http://localhost:8080/nha-khoa-ct/appointments`
- **Chấm công vân tay Nha Khoa CT**: `http://localhost:8080/nha-khoa-ct/attendance/checkin`
- **Trạm Quản Trị Tối Cao GZV Central**: `http://localhost:8080/gzv/admin/dashboard`

---

## 🔐 3. BẢO MẬT DỮ LIỆU ĐA PHÒNG KHÁM (MULTI-TENANT ROW LEVEL SECURITY)

1. **Phân Lập Dữ Liệu Tuyệt Đối (Data Isolation)**:
   - Tất cả các bảng dữ liệu (`employees`, `patients`, `appointments`, `attendance_records`, `devices`, `salary_config`...) đều bắt buộc chứa cột `organization_id`.
   - Hàm RLS Postgres `public.current_org_id()` tự động chặn tất cả các truy vấn từ bên ngoài, chỉ trả về dữ liệu đúng của `organization_id` thuộc Slug phòng khám đó.

2. **Chế Độ Super Admin Workspace Switcher**:
   - Hai tài khoản Super Admin tối cao của GZV Platform (`tuloc2706@gmail.com` và `stephensouth1307@gmail.com`) có quyền chuyển đổi không gian làm việc đến bất kỳ phòng khám nào trên cây danh mục ngay tại thanh **GZV Platform Control Center Bar**.

---

## 🗄️ 4. CHUỖI KẾT NỐI DATABASE CHO DEVELOPER MỚI

Hướng dẫn cấu hình chuỗi kết nối Database Postgres và API Keys (không chứa secrets thật) tại file:
👉 [docs/setup/DATABASE_CONNECTIONS.md](docs/setup/DATABASE_CONNECTIONS.md)

> ⚠️ Secrets thật (mật khẩu DB, service role key) **không** được lưu trong repo. Liên hệ quản trị viên nền tảng qua kênh nội bộ để nhận giá trị thật, rồi điền vào file `.env` cục bộ (đã gitignore).

---

## 💳 5. LỘ TRÌNH CHI PHÍ VẬN HÀNH & NÂNG CẤP HẠ TẦNG (DATABASE & INFRASTRUCTURE EXPANSION)

Để mở rộng từ mô hình Test/Mẫu lên quy mô thương mại kinh doanh cho hàng trăm phòng khám, hệ thống cần lộ trình nâng cấp hạ tầng Cloud & Database sau:

### 💼 A. Cơ Sở Dữ Liệu Database (Supabase Enterprise Plan)
- **Giai đoạn hiện tại (Đã kết nối)**:
  - Database PostgreSQL Supabase Cloud (`kuvuvufzqtvdcyygkaym.supabase.co`).
- **Giai đoạn Thương mại Hóa (Scale Up)**:
  - **Nâng gói Supabase Pro / Enterprise**: Chi phí từ **$25 - $500+/tháng** tùy thuộc vào dung lượng lưu trữ vân tay, ảnh bệnh nhân và số lượng kết nối realtime đồng thời.
  - **Mua Dedicated Compute Instance**: Nâng cấp Compute Add-on (Small -> 16XL) đảm bảo CPU/RAM xử lý hàng triệu log chấm công mỗi ngày từ hàng ngàn máy vân tay gửi về.

### 🌐 B. Tên Miền & Hạ Tầng Mạng (Custom Subdomains / Multi-Tenant Domain)
- Đăng ký tên miền gốc công ty: `gzv.vn` hoặc `gzvhealth.com`.
- Cấu hình Subdomain tự động: `nhakhoact.gzv.vn`, `dakhoa.gzv.vn` dẫn trực tiếp về slug tương ứng.

### 📟 C. Phần Cứng Chấm Công Vân Tay / Khuôn Mặt (Biometric Hardware & Agent)
- Chi phí máy chấm công vân tay/FaceID chính hãng ZKTeco (Ví dụ: `MCC0001` Serial `8116243500205` IP `192.168.1.202:4370`).
- Triển khai **GZV Biometric Agent Service** chạy trên máy tính Windows nội bộ của từng phòng khám để lấy dữ liệu realtime đẩy lên Server GZV.

---

## 🔑 5. TÀI KHOẢN SUPER ADMIN GZV PLATFORM

| Email Super Admin | Quyền Hạn | Phạm Vi Quản Lý |
| :--- | :--- | :--- |
| `tuloc2706@gmail.com` | **Super Admin (6 Roles)** | Toàn bộ 10 Chuyên khoa & Đa phòng khám GZV |
| `stephensouth1307@gmail.com` | **Super Admin (6 Roles)** | Toàn bộ 10 Chuyên khoa & Đa phòng khám GZV |

> ⚠️ Mật khẩu không được lưu trong repo. Đổi mật khẩu qua Supabase Auth Dashboard hoặc màn hình "Quên mật khẩu" của ứng dụng.

---

## 🛠️ 6. LỆNH KHỞI CHẠY HỆ THỐNG

```bash
# 1. Cài đặt thư viện dependencies
npm install

# 2. Khởi chạy Server Development tại địa phương
npm run dev

# 3. Kiểm tra Build Production
npm run build
```

© 2026 **GZV Clinic Platform** — Phát triển & Sở Hữu bởi Công Ty / Tập Đoàn GZV.
