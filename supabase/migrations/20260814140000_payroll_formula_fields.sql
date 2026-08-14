-- Bổ sung công thức lương đầy đủ: phụ cấp, thưởng, tăng ca, lương gộp
-- được lưu lại khi duyệt bảng lương (trước đây chỉ lưu lương cơ bản + các khoản trừ,
-- bỏ hẳn phụ cấp/thưởng/tăng ca dù đã có cấu hình và dữ liệu chấm công tăng ca).

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_pay numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_salary numeric NOT NULL DEFAULT 0;
