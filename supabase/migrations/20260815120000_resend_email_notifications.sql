-- Email (Resend) — hạ tầng lưu trữ API Key an toàn theo từng phòng khám + nhật ký gửi email.
-- clinic_resend_configs: KHÔNG cấp policy nào cho authenticated/anon — mặc định từ chối hết,
-- chỉ service_role (supabaseAdmin, dùng trong server functions sau khi đã tự kiểm tra role
-- administrator) đọc/ghi được. API Key không bao giờ lưu plaintext — chỉ lưu ciphertext
-- (mã hoá AES-256-GCM ở tầng server), cùng cơ chế với clinic_zalo_configs.

CREATE TABLE IF NOT EXISTS public.clinic_resend_configs (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key_ciphertext text,
  from_email text,
  from_name text,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.clinic_resend_configs ENABLE ROW LEVEL SECURITY;
-- Cố tình không tạo policy nào cho 'authenticated'/'anon' — xem ghi chú ở trên.

CREATE TRIGGER trg_clinic_resend_configs_updated
  BEFORE UPDATE ON public.clinic_resend_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Nhật ký các email đã gửi (hoặc thất bại) qua Resend — phục vụ hiển thị trạng thái cho
-- quản trị viên phòng khám và chống gửi trùng (ví dụ: lịch nhắc/lịch ngày cho bác sĩ chỉ gửi 1 lần/ngày).
CREATE TABLE IF NOT EXISTS public.clinic_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'appointment_confirmation', 'appointment_reminder', 'doctor_daily_schedule', 'test'
  )),
  to_email text NOT NULL,
  subject text NOT NULL,
  related_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  related_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_email_events_org_created
  ON public.clinic_email_events (organization_id, created_at DESC);

-- Chống gửi trùng lịch-ngày cho cùng 1 bác sĩ trong cùng 1 ngày (dispatch tự động có thể chạy nhiều lần/ngày).
CREATE INDEX IF NOT EXISTS idx_clinic_email_events_dedup
  ON public.clinic_email_events (organization_id, category, related_employee_id, created_at);

ALTER TABLE public.clinic_email_events ENABLE ROW LEVEL SECURITY;

-- Quản trị viên/quản lý trong phòng khám được xem lại nhật ký gửi email của chính phòng khám mình.
-- Ghi (insert) chỉ thực hiện qua service_role (supabaseAdmin) trong server functions.
CREATE POLICY "clinic_email_events read own org staff"
  ON public.clinic_email_events FOR SELECT
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.has_role(auth.uid(), 'administrator'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );
