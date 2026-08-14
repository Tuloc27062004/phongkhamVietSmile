-- Migration: Thanh toán (tiền mặt/chuyển khoản/...) + lịch hẹn tái khám cho appointments.
-- Backfill số liệu hợp lý cho các lịch hẹn demo đã seed trước đó.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'card', 'momo', 'zalopay', 'other')),
  ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_date date;

-- Backfill: lịch hẹn đã hoàn tất -> đã thanh toán đủ; đã xác nhận -> thanh toán 1 phần (đặt cọc);
-- còn lại giữ mặc định chưa thanh toán. Số tiền ước theo dịch vụ gắn kèm.
UPDATE public.appointments a
SET
  total_amount = COALESCE(s.default_duration_minutes, 30) * 3000,
  payment_status = CASE WHEN a.status = 'completed' THEN 'paid' WHEN a.status = 'confirmed' THEN 'partial' ELSE 'unpaid' END,
  payment_method = CASE
    WHEN a.status = 'completed' THEN (ARRAY['cash', 'bank_transfer', 'momo'])[1 + (abs(hashtext(a.id::text)) % 3)]
    WHEN a.status = 'confirmed' THEN 'cash'
    ELSE NULL
  END,
  paid_amount = CASE
    WHEN a.status = 'completed' THEN COALESCE(s.default_duration_minutes, 30) * 3000
    WHEN a.status = 'confirmed' THEN ROUND(COALESCE(s.default_duration_minutes, 30) * 3000 * 0.3)
    ELSE 0
  END,
  paid_at = CASE WHEN a.status IN ('completed', 'confirmed') THEN a.updated_at ELSE NULL END,
  follow_up_date = CASE WHEN a.status = 'completed' THEN (a.appointment_date + INTERVAL '14 days')::date ELSE NULL END
FROM public.services s
WHERE a.service_id = s.id
  AND a.organization_id = '11111111-1111-4111-8111-111111111111';
