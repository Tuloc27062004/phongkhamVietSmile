-- Bổ sung hoa hồng bác sĩ (theo doanh thu lịch hẹn hoàn tất) và thuế TNCN lũy tiến
-- vào công thức lương — trước đây payroll_records không lưu được các khoản này.

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS commission_revenue numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_pay numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax numeric NOT NULL DEFAULT 0;
