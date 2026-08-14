-- Zalo OAuth — Giai đoạn A: hạ tầng lưu trữ App ID/Secret an toàn theo từng phòng khám.
-- Bảng KHÔNG cấp policy nào cho authenticated/anon — mặc định từ chối hết, chỉ service_role
-- (supabaseAdmin, dùng trong server functions sau khi đã tự kiểm tra role administrator) đọc/ghi được.
-- App Secret không bao giờ lưu plaintext — chỉ lưu ciphertext (mã hoá AES-256-GCM ở tầng server).

CREATE TABLE IF NOT EXISTS public.clinic_zalo_configs (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  app_id text,
  app_secret_ciphertext text,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.clinic_zalo_configs ENABLE ROW LEVEL SECURITY;
-- Cố tình không tạo policy nào cho 'authenticated'/'anon' — xem ghi chú ở trên.

CREATE TRIGGER trg_clinic_zalo_configs_updated
  BEFORE UPDATE ON public.clinic_zalo_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
