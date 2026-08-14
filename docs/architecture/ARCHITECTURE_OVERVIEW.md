# GZV Clinic Platform — Kiến Trúc Hệ Thống

> Tài liệu này mô tả đúng trạng thái code/DB thực tế tại thời điểm cập nhật (14/08/2026), không phải kế hoạch hay mô tả marketing.

## 1. Tech Stack

| Layer | Công nghệ |
|---|---|
| UI Framework | React 19 + TypeScript |
| App Framework | TanStack Start (SSR, `src/start.ts` + `src/server.ts`) |
| Routing | TanStack Router — file-based, typed, chạy trên Cloudflare (nitro target) |
| Data fetching | TanStack Query (React Query) |
| Database | Supabase (PostgreSQL + Auth + Row Level Security) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix UI primitives) |

## 2. Mô hình đa tenant (Multi-Tenant)

Một nền tảng phục vụ nhiều phòng khám/bệnh viện, cách ly dữ liệu bằng `organization_id` + Postgres RLS.

```
public.organizations
├── id, name, slug (unique), code (unique, nullable)
├── clinic_category (enum: dental/general/obgyn/pediatrics/dermatology/
│                     ophthalmology/ent/aesthetics/rehab/hospital)
├── is_active, max_employees, max_doctors, max_devices, feature_flags (jsonb)
```

**Hai tenant thật đang tồn tại:**
- `viet-smile` (code `VIETSMILE`) — "Nha khoa Việt Smile", tenant thật duy nhất có dữ liệu vận hành (nhân sự, chấm công, lương).
- `gzv` (code `GZV_PLATFORM`) — tổ chức rỗng, chỉ dùng làm "nhà" cho 2 tài khoản Super Admin, không có dữ liệu khám bệnh.

**Cơ chế RLS/switching:**
- `public.current_org_id()` — hàm trung tâm mọi RLS policy đều gọi. Với user thường: trả về `user_profiles.organization_id` (org nhà). Với Super Admin: trả về org đang "switch" tới (lưu ở `public.super_admin_sessions`), nếu chưa switch thì cũng trả về org nhà.
- `public.is_super_admin()` — true khi org nhà của user có `code = 'GZV_PLATFORM'` và user có role `administrator`.
- RPC `super_admin_switch_clinic_by_slug(slug)` — đổi org đang active; `get_organization_by_slug(slug)` — tra cứu org theo slug (dùng khi resolve route); `super_admin_create_clinic(name, slug, code, clinic_category)` — tạo tenant mới (org + `clinic_profiles`) trong 1 transaction.

## 3. Routing

```
src/routes/
  __root.tsx                              # root SSR shell
  index.tsx                               # trang landing (không cần đăng nhập)
  auth.tsx                                # đăng nhập/đăng ký, điều hướng theo org nhà sau login
  _authenticated/
    route.tsx                             # CHỈ kiểm tra đăng nhập (supabase.auth.getUser())
    $clinicSlug/
      route.tsx                           # resolve slug -> org, đồng bộ current_org_id(),
      │                                    #   redirect nhân viên lạc slug về org của họ,
      │                                    #   render AppShell (sidebar/breadcrumb/switcher)
      dashboard.tsx                       # -> /$slug/dashboard
      admin.dashboard.tsx                 # -> /$slug/admin/dashboard (Super Admin control center)
      employees.tsx, departments.tsx, positions.tsx, shifts.tsx
      attendance.{daily,monthly,manual,checkin,logs,adjustments,overtime}.tsx
      appointments.{calendar,booking}.tsx, appointments.tsx, rooms.tsx
      hr.{payroll,salary,assignments}.tsx
      reports.{attendance,appointments,export}.tsx
      system.{devices,clinic-profile,settings,users,audit-logs,agent,sync}.tsx
      doctor.{dashboard,profile,schedule}.tsx, patient.profile.tsx
      issues.{report,my-reports}.tsx
```

Mọi URL trong ứng dụng (trừ `/`, `/auth`) đều có dạng `/$clinicSlug/...`, ví dụ `/viet-smile/dashboard`, `/gzv/admin/dashboard`. Nav links dùng hook `useClinicPath()`/`useClinicRelativePath()` (`src/hooks/use-clinic-path.ts`) để tự thêm/bỏ prefix slug — `src/lib/permissions.ts` (danh sách nav + phân quyền theo role) cố tình giữ **không** có slug để dùng chung cho mọi phòng khám.

## 4. Vai trò & phân quyền

`app_role`: `administrator`, `manager`, `receptionist`, `employee`, `doctor`, `patient` (định nghĩa tại `src/lib/permissions.ts`). Super Admin không phải một role riêng — là `administrator` của org `GZV_PLATFORM` (kiểm tra qua `is_super_admin()`).

## 5. Luồng dữ liệu Nhân sự → Chấm công → Lương

```
employees (department_id, position_id, default_shift_id)
    ↓
attendance_records (1 dòng/nhân viên/ngày, attendance_status:
    present | late | absent | early_leave | leave | sick | holiday | half_day)
    ↓ (KHÔNG có trigger tự động — phải tổng hợp thủ công)
attendance_summaries (cache theo kỳ, để hiển thị nhanh ở /attendance/monthly)
    ↓
salary_config (lương cơ bản/phụ cấp/bảo hiểm mỗi nhân viên)
    ↓
/hr/payroll: TÍNH TRỰC TIẾP (live) từ attendance_records + salary_config mỗi lần mở trang,
    KHÔNG đọc từ payroll_records — bấm "Duyệt" mới ghi (upsert) vào payroll_records.
```

**Quan trọng**: `attendance_summaries`/`payroll_records` không có gì tự động tính lại khi `attendance_records` thay đổi — mọi báo cáo lịch sử phải tự chạy lại tổng hợp (xem migration `20260814100000_seed_viet_smile_demo_data.sql` làm ví dụ).

## 6. Tình trạng các tính năng (trung thực, không phóng đại)

| Module | Trạng thái |
|---|---|
| Đăng nhập, RBAC, multi-tenant switching | Hoạt động đầy đủ |
| Nhân sự/Phòng ban/Chức danh/Ca làm (xem danh sách) | Hoạt động — **chưa có form Thêm/Sửa trên UI** (nút "Thêm" đang disable), phải seed qua SQL |
| Chấm công (daily/monthly/manual/checkin/logs/adjustments/overtime) | Hoạt động đầy đủ với schema thật |
| Tính lương `/hr/payroll` | Hoạt động, tính live theo chấm công; có "In bảng lương" / "In phiếu lương" qua `window.print()` |
| Xuất báo cáo `/reports/export` | **Chỉ CSV hoạt động thật** — nút Excel/PDF là `alert()` giả, chưa có thư viện xlsx/pdf |
| `/reports/attendance`, `/reports/appointments` | Xem danh sách được, nút "Tải" chưa nối hành động |
| Tạo phòng khám mới (Super Admin) | Hoạt động — Dialog trong `/gzv/admin/dashboard`, gọi RPC `super_admin_create_clinic` |
| Thiết bị vân tay/FaceID | Có bảng `devices`/`device_logs`, UI xem log — chưa tích hợp phần cứng thật |

## 7. Bảo mật

- RLS bật trên toàn bộ bảng nghiệp vụ, khoá theo `current_org_id()`.
- Secrets (mật khẩu DB, service role key) **không** được commit — xem [docs/setup/DATABASE_CONNECTIONS.md](../setup/DATABASE_CONNECTIONS.md) và `.env.example` ở gốc repo.
- Không có migration tracking tự động (`supabase_migrations` schema không tồn tại) — migration được áp dụng thủ công (SQL Editor hoặc `psql` trực tiếp), **không phải mọi file trong `supabase/migrations/` chắc chắn đã chạy trên DB thật** — luôn kiểm tra DB thật trước khi dựa vào giả định từ tên file migration.
