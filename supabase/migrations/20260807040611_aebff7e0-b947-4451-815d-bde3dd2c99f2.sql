-- ============ 1. USER APPROVAL ============
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

DO $$ BEGIN
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_approval_status_check
    CHECK (approval_status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing accounts stay usable
UPDATE public.user_profiles SET approval_status = 'approved', approved_at = COALESCE(approved_at, now())
WHERE approval_status <> 'approved';

-- Approved-only org scoping: pending users see nothing
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT organization_id FROM public.user_profiles
  WHERE id = auth.uid() AND approval_status = 'approved' AND is_active;
$$;

REVOKE ALL ON FUNCTION public.current_org_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;

-- New signups are pending with no role; first ever user becomes approved administrator
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.user_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_profile public.user_profiles;
  v_email text;
  v_name text;
  v_has_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_uid;
  IF FOUND THEN RETURN v_profile; END IF;

  SELECT id INTO v_org FROM public.organizations WHERE is_default LIMIT 1;
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email,'@',1))
    INTO v_email, v_name FROM auth.users WHERE id = v_uid;

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'administrator') INTO v_has_admin;

  INSERT INTO public.user_profiles (id, organization_id, full_name, email, approval_status, approved_at)
  VALUES (
    v_uid, v_org, COALESCE(v_name,''), v_email,
    CASE WHEN v_has_admin THEN 'pending' ELSE 'approved' END,
    CASE WHEN v_has_admin THEN NULL ELSE now() END
  )
  RETURNING * INTO v_profile;

  IF NOT v_has_admin THEN
    INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (v_uid, v_org, 'administrator') ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_profile;
END; $$;

REVOKE ALL ON FUNCTION public.ensure_user_profile() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated, service_role;

-- Admin: approve a pending user and assign role
CREATE OR REPLACE FUNCTION public.admin_review_user(
  target_user_id uuid, decision text, new_role app_role DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.current_org_id();
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrator') THEN
    RAISE EXCEPTION 'Chỉ quản trị viên mới được duyệt tài khoản';
  END IF;
  IF decision NOT IN ('approved','rejected','pending') THEN
    RAISE EXCEPTION 'Quyết định không hợp lệ';
  END IF;
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Không thể tự duyệt tài khoản của chính mình';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = target_user_id AND organization_id = v_org) THEN
    RAISE EXCEPTION 'Người dùng không thuộc phòng khám này';
  END IF;

  UPDATE public.user_profiles
     SET approval_status = decision,
         approved_at = CASE WHEN decision = 'approved' THEN now() ELSE NULL END,
         approved_by = CASE WHEN decision = 'approved' THEN auth.uid() ELSE NULL END,
         is_active = (decision = 'approved'),
         updated_at = now()
   WHERE id = target_user_id;

  IF decision = 'approved' THEN
    IF new_role IS NULL THEN RAISE EXCEPTION 'Cần chọn vai trò khi duyệt tài khoản'; END IF;
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND organization_id = v_org;
    INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (target_user_id, v_org, new_role);
  ELSE
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND organization_id = v_org;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.admin_review_user(uuid, text, app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_user(uuid, text, app_role) TO authenticated;

-- Admin: enable/disable an approved account
CREATE OR REPLACE FUNCTION public.admin_set_user_active(target_user_id uuid, active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.current_org_id();
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrator') THEN
    RAISE EXCEPTION 'Chỉ quản trị viên mới được khóa/mở tài khoản';
  END IF;
  IF target_user_id = auth.uid() THEN RAISE EXCEPTION 'Không thể tự khóa tài khoản của chính mình'; END IF;
  UPDATE public.user_profiles SET is_active = active, updated_at = now()
   WHERE id = target_user_id AND organization_id = v_org;
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_user_active(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean) TO authenticated;

-- Admins must be able to list pending users (whose org scoping is off)
DROP POLICY IF EXISTS "read own profile or same org" ON public.user_profiles;
CREATE POLICY "read own profile or same org" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR organization_id = public.current_org_id()
    OR public.has_role(auth.uid(), 'administrator')
  );

DROP POLICY IF EXISTS "read roles in org" ON public.user_roles;
CREATE POLICY "read roles in org" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id = public.current_org_id()
    OR public.has_role(auth.uid(), 'administrator')
  );

-- ============ 2. DEVICE / BIOMETRIC REALTIME ============
ALTER TABLE public.device_logs
  ADD COLUMN IF NOT EXISTS verify_mode text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS device_user_id text,
  ADD COLUMN IF NOT EXISTS processed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS process_note text;

CREATE INDEX IF NOT EXISTS idx_device_logs_org_time ON public.device_logs (organization_id, event_time DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_device_logs_event
  ON public.device_logs (organization_id, device_user_id, event_time)
  WHERE device_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_emp_date
  ON public.attendance_records (employee_id, work_date);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_devices_serial ON public.devices (organization_id, serial_number);

-- Staff may see unmapped punches too; keep write to managers
DROP POLICY IF EXISTS "device_logs read" ON public.device_logs;
CREATE POLICY "device_logs read" ON public.device_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.device_logs REPLICA IDENTITY FULL;
ALTER TABLE public.devices REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.device_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;