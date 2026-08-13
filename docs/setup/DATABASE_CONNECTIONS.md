# 🗄️ GZV CLINIC PLATFORM — CONFIG & DATABASE CONNECTION GUIDE

> **Tài liệu hướng dẫn cấu hình Chuỗi Kết Nối CSDL Supabase & Môi Trường Dành Cho Lập Trình Viên**
> 
> *File này dành cho Developer khác khi clone project hoặc kết nối máy tính mới.*

> ⚠️ **KHÔNG BAO GIỜ commit secrets thật (mật khẩu DB, service role key, API key) vào file này hay bất kỳ file nào được git track.** File này chỉ chứa **placeholder** — secrets thật chỉ được lưu trong `.env` cục bộ (đã có trong `.gitignore`) hoặc trong secret manager (GitHub Actions Secrets, Vercel/Cloudflare env vars...).

---

## 1. 🔑 CHUỖI KẾT NỐI DATABASE (POSTGRESQL CONNECTION STRINGS)

### 🐘 Connection String Trực Tiếp (Direct Database URI):
```text
postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
```

### 🔌 Connection String Qua Connection Pooling (PgBouncer - Port 6543):
```text
postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Lấy `<PROJECT_REF>` và `<DB_PASSWORD>` thật tại **Supabase Dashboard → Project Settings → Database**. Không dán giá trị thật vào đây.

---

## 2. ⚡ THÔNG TIN NỀN TẢNG SUPABASE CLOUD (PROJECT CONFIG)

- **Project ID**: xem tại Supabase Dashboard → Project Settings → General (không commit vào repo public nếu không cần thiết)
- **Supabase Project URL**: `https://<PROJECT_REF>.supabase.co`

### 🔑 API Keys & JWT Tokens:

Lấy các key sau tại **Supabase Dashboard → Project Settings → API**:

#### A. Publishable Anon Key (Client-side Frontend SDK):
Public theo thiết kế (an toàn để dùng ở client), nhưng vẫn nên lưu qua biến môi trường thay vì hardcode trong repo.

#### B. Secret Service Role Key (Backend / Migration Admin):
**TUYỆT ĐỐI KHÔNG** đưa vào bất kỳ file git-tracked nào — key này bypass toàn bộ Row Level Security và có quyền đọc/ghi/xoá không giới hạn trên toàn bộ database. Chỉ lưu trong `.env` local hoặc secret manager của CI/CD.

---

## 3. 📝 HƯỚNG DẪN CẤU HÌNH FILE `.env` CHO DEVELOPER MỚI

Developer mới clone source code cần tạo file `.env` tại thư mục gốc dự án (đã bị `.gitignore`, sẽ không bị commit) và điền các giá trị thật lấy từ Supabase Dashboard theo mẫu `.env.example` đi kèm repo:

```env
VITE_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<lấy từ Supabase Dashboard>"
SUPABASE_SERVICE_ROLE_KEY="<lấy từ Supabase Dashboard, KHÔNG commit>"
DATABASE_URL="postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"
```

Liên hệ quản trị viên nền tảng (qua kênh nội bộ, không qua git) để nhận giá trị thật.

---

## 💻 4. LỆNH ĐỒNG BỘ DỮ LIỆU & RUN MIGRATIONS

```bash
# Đăng nhập Supabase CLI bằng Token Service Role
npx supabase login

# Link dự án local tới Supabase Cloud
npx supabase link --project-ref kuvuvufzqtvdcyygkaym

# Đẩy tất cả các file migration SQL mới nhất lên Database Cloud
npx supabase db push
```

© 2026 **GZV Clinic Platform** — File lưu hành nội bộ bộ phận kỹ thuật GZV.
