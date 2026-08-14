# Database Schema — Trạng Thái Thật (đã đối chiếu trực tiếp với DB production)

> Khác với tài liệu cũ, file này chỉ liệt kê những gì đã xác minh trực tiếp qua `psql \d` trên DB thật (14/08/2026), không suy diễn từ tên file migration — vì nhiều migration trong `supabase/migrations/` chưa từng được áp dụng (xem §5).

## Nguyên tắc RLS chung

Hầu hết bảng nghiệp vụ đều có `organization_id uuid NOT NULL REFERENCES organizations(id)` và 2 policy dạng:
```sql
CREATE POLICY "<x> read" ON <table> FOR SELECT TO authenticated
  USING (organization_id = current_org_id());
CREATE POLICY "<x> write" ON <table> TO authenticated
  USING (organization_id = current_org_id() AND is_staff_manager())
  WITH CHECK (organization_id = current_org_id() AND is_staff_manager());
```
`current_org_id()` là điểm cách ly dữ liệu multi-tenant duy nhất — xem [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md#2-mô-hình-đa-tenant-multi-tenant).

## Bảng đã xác minh đầy đủ (cột thật, ràng buộc thật)

### `organizations`
```
id uuid PK, name text NOT NULL, slug text NOT NULL UNIQUE, is_default boolean,
code text UNIQUE (nullable), is_active boolean DEFAULT true,
clinic_category text DEFAULT 'general' CHECK (IN dental/general/obgyn/pediatrics/
  dermatology/ophthalmology/ent/aesthetics/rehab/hospital),
max_employees int DEFAULT 50, max_doctors int DEFAULT 20, max_devices int DEFAULT 10,
feature_flags jsonb, created_at, updated_at
```

### `employees`
```
id uuid PK, organization_id uuid NOT NULL, user_id uuid (FK auth.users, nullable),
employee_code text NOT NULL, UNIQUE(organization_id, employee_code),
device_user_id text, full_name text NOT NULL, preferred_name, gender, date_of_birth,
phone, email, address, avatar_url, emergency_contact_{name,relationship,phone},
department_id uuid (FK departments), position_id uuid (FK positions),
employment_type employment_type NOT NULL DEFAULT 'full_time'   -- enum: full_time|part_time|contract|intern
employment_status employment_status NOT NULL DEFAULT 'active'  -- enum: probation|active|on_leave|suspended|terminated
start_date, probation_end_date, contract_{start,end}_date,
default_shift_id uuid (FK shifts), work_location, manager_id uuid (self-FK),
professional_title, license_number, license_{issue,expiry}_date, specialization,
years_of_experience, qualifications, treatment_room,
can_receive_appointments boolean NOT NULL DEFAULT false, appointment_display_name,
hire_date DEFAULT CURRENT_DATE, status text DEFAULT 'active', profile_photo_url,
created_at, updated_at, deleted_at (soft delete)
```

### `attendance_records`
```
id, organization_id, employee_id, work_date date NOT NULL,
UNIQUE(organization_id, employee_id, work_date),
shift_id (FK shifts, nullable), check_in_time, check_out_time,
device_check_in_time, device_check_out_time (timestamptz),
late_minutes, early_leave_minutes, overtime_minutes, paid_break_minutes,
unpaid_break_minutes, worked_minutes (int),
attendance_status text DEFAULT 'present'  -- không có CHECK constraint, quy ước dùng:
  -- present | late | absent | early_leave | leave | sick | holiday | half_day
is_approved boolean DEFAULT false, approval_notes, created_at, updated_at, deleted_at
```
⚠️ `/hr/payroll` tính live: coi mọi status khác `absent`/`leave`/`sick`/`holiday` là ngày công (kể cả `late`/`early_leave`), chỉ trừ lương đi trễ khi `late_minutes > 15`.

### `attendance_summaries` (bảng phẳng, KHÔNG tự tính)
```
id, organization_id, employee_id, full_name, employee_code,
date date NOT NULL, UNIQUE(employee_id, date),
total_days, present_days, absent_days, late_days, early_leave_days int DEFAULT 0,
overtime_hours numeric DEFAULT 0, created_at
```
Trang `/attendance/monthly` đọc trực tiếp bảng này — phải tự `INSERT`/`UPDATE` tổng hợp từ `attendance_records` mỗi khi cần dữ liệu mới (không có trigger).

### `attendance_adjustments`
```
id, organization_id, employee_id, attendance_id (FK attendance_records, nullable),
adjustment_type text NOT NULL, reason text NOT NULL, adjusted_value text (nullable),
requested_by / approved_by uuid (FK auth.users), status text DEFAULT 'pending',
created_at, updated_at, deleted_at
```
⚠️ KHÔNG có cột `adjustment_date` hay `notes` — nếu thấy code/tài liệu cũ nhắc 2 cột này là sai (đã sửa ở `attendance.adjustments.tsx`, 14/08/2026).

### `overtime_records`
```
id, organization_id, employee_id, overtime_date date NOT NULL,
duration_hours numeric DEFAULT 0, rate_multiplier numeric DEFAULT 1,
status text DEFAULT 'pending' CHECK (IN pending/approved/paid),
reason, notes, created_at, updated_at
```

### `salary_config`
```
id, organization_id, employee_id uuid UNIQUE NOT NULL,
base_salary, allowance, bonus, late_deduction, absence_deduction,
insurance_deduction numeric DEFAULT 0, created_at, updated_at
```

### `payroll_records`
```
id, organization_id, employee_id, month int CHECK(1-12), year int,
UNIQUE(employee_id, month, year),
worked_days, late_days, absent_days int DEFAULT 0,
base_salary, late_deduction, absence_deduction, insurance, net_salary numeric DEFAULT 0,
status text DEFAULT 'pending' CHECK (IN pending/calculated/approved/paid),
approved_at, created_at
```

### `super_admin_sessions`
```
user_id uuid PK (FK auth.users), active_organization_id uuid NOT NULL (FK organizations),
updated_at
```

### `clinic_profiles`
```
id, organization_id uuid UNIQUE NOT NULL, name text NOT NULL,
short_name, legal_name, logo_url, cover_url, address/ward/district/city,
phone/hotline/appointment_phone, website/facebook/zalo, working_hours/lunch_break,
weekly_days_off, tax_code, timezone/language/date_format/time_format,
grace_period_minutes, các cột chính sách (attendance_policy, overtime_policy, ...),
description, footer_info, created_at, updated_at
```
Chỉ `organization_id` và `name` là bắt buộc — mọi trường khác có default/nullable.

## Bảng khác đang tồn tại (chưa audit đầy đủ cột — xem trực tiếp migration hoặc `psql \d`)

`user_profiles`, `user_roles`, `departments`, `positions`, `shifts`, `devices`, `device_logs`, `device_configs`, `device_sync_logs`, `device_sync_mappings`, `appointments`, `patients`, `services`, `appointment_reminders`, `reports`, `error_reports`, `audit_logs`, `app_settings`.

## Dữ liệu thật đang có (14/08/2026)

- 2 `organizations`: `viet-smile` (VIETSMILE, dental) và `gzv` (GZV_PLATFORM, hub Super Admin, không có dữ liệu khám bệnh).
- Việt Smile: 4 `departments`, 5 `positions`, 4 `shifts`, 8 `employees` (EMP001–EMP008, dữ liệu mẫu — xem migration `20260814100000_seed_viet_smile_demo_data.sql`), 1 tháng `attendance_records`/`attendance_summaries`/`overtime_records`/`salary_config`/`payroll_records` demo.

## Về các file migration trong repo

Không có bảng `supabase_migrations.schema_migrations` — dự án này áp dụng migration thủ công (dán SQL hoặc chạy trực tiếp qua `psql`), **không dùng `supabase db push`**. Hệ quả: nhiều file `.sql` trong `supabase/migrations/` có thể **chưa từng chạy** trên DB thật (ví dụ: toàn bộ chain `20260813100000` → `20260813140000` bị phát hiện chưa áp dụng ngày 14/08/2026, chỉ tồn tại dưới dạng file). Khi cần biết schema thật, luôn kiểm tra trực tiếp bằng `psql \d <table>`, không tin tuyệt đối vào tên file migration.
