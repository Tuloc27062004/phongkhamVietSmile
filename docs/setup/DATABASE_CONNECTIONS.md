# 🗄️ GZV CLINIC PLATFORM — CONFIG & DATABASE CONNECTION CREDENTIALS

> **Tài liệu cấu hình Chuỗi Kết Nối CSDL Supabase & Môi Trường Dành Cho Lập Trình Viên (Developer Credentials)**
> 
> *File này dành cho Developer khác khi clone project hoặc kết nối máy tính mới.*

---

## 1. 🔑 CHUỖI KẾT NỐI DATABASE (POSTGRESQL CONNECTION STRINGS)

### 🐘 Connection String Trực Tiếp (Direct Database URI):
```text
postgresql://postgres:Vietsmileclinic%40123@db.kuvuvufzqtvdcyygkaym.supabase.co:5432/postgres
```

### 🔌 Connection String Qua Connection Pooling (PgBouncer - Port 6543):
```text
postgresql://postgres.kuvuvufzqtvdcyygkaym:Vietsmileclinic%40123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

---

## 2. ⚡ THÔNG TIN NỀN TẢNG SUPABASE CLOUD (PROJECT CONFIG)

- **Project ID**: `kuvuvufzqtvdcyygkaym`
- **Supabase Project URL**: `https://kuvuvufzqtvdcyygkaym.supabase.co`

### 🔑 API Keys & JWT Tokens:

#### A. Publishable Anon Key (Client-side Frontend SDK):
```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dnV2dWZ6cXR2ZGN5eWdrYXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MzM4OTcsImV4cCI6MjEwMjAwOTg5N30.6rpp1j95f8TJc7Al8e4fYAxfLcz8Gh6UuBMlu5HQilw
```

#### B. Secret Service Role Key (Backend / Migration Admin):
```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dnV2dWZ6cXR2ZGN5eWdrYXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQzMzg5NywiZXhwIjoyMTAyMDA5ODk3fQ.Df8njL4F5G5zv_ItrQBNeW0RsHGmOjPXDMxvjkBsm9I
```

---

## 3. 📝 HƯỚNG DẪN CẤU HÌNH FILE `.env` CHO DEVELOPER MỚI

Developer mới clone source code chỉ cần tạo file `.env` tại thư mục gốc dự án và dán nội dung sau:

```env
VITE_SUPABASE_URL="https://kuvuvufzqtvdcyygkaym.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dnV2dWZ6cXR2ZGN5eWdrYXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MzM4OTcsImV4cCI6MjEwMjAwOTg5N30.6rpp1j95f8TJc7Al8e4fYAxfLcz8Gh6UuBMlu5HQilw"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1dnV2dWZ6cXR2ZGN5eWdrYXltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQzMzg5NywiZXhwIjoyMTAyMDA5ODk3fQ.Df8njL4F5G5zv_ItrQBNeW0RsHGmOjPXDMxvjkBsm9I"
DATABASE_URL="postgresql://postgres:Vietsmileclinic%40123@db.kuvuvufzqtvdcyygkaym.supabase.co:5432/postgres"
```

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
