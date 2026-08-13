
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('administrator','manager','receptionist','employee');
CREATE TYPE public.employment_status AS ENUM ('probation','active','on_leave','suspended','terminated');
CREATE TYPE public.employment_type AS ENUM ('full_time','part_time','contract','intern');

-- helper: updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- USER PROFILES
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'administrator') OR public.has_role(auth.uid(),'manager');
$$;

CREATE POLICY "org readable by members" ON public.organizations
  FOR SELECT TO authenticated USING (id = public.current_org_id());

CREATE POLICY "read own profile or same org" ON public.user_profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR organization_id = public.current_org_id());
CREATE POLICY "update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "read roles in org" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR organization_id = public.current_org_id());

-- BOOTSTRAP: create profile + role on first sign-in
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.user_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  INSERT INTO public.user_profiles (id, organization_id, full_name, email)
  VALUES (v_uid, v_org, COALESCE(v_name,''), v_email)
  RETURNING * INTO v_profile;

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'administrator') INTO v_has_admin;
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_uid, v_org, CASE WHEN v_has_admin THEN 'employee'::public.app_role ELSE 'administrator'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN v_profile;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

-- CLINIC PROFILES
CREATE TABLE public.clinic_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text,
  legal_name text,
  logo_url text,
  favicon_url text,
  cover_url text,
  address text,
  ward text,
  district text,
  city text,
  maps_url text,
  phone text,
  hotline text,
  appointment_phone text,
  email text,
  website text,
  facebook text,
  zalo text,
  working_hours text,
  lunch_break text,
  weekly_days_off text,
  tax_code text,
  representative_name text,
  manager_name text,
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  language text NOT NULL DEFAULT 'vi',
  date_format text NOT NULL DEFAULT 'dd/MM/yyyy',
  time_format text NOT NULL DEFAULT 'HH:mm',
  reminder_policy text,
  attendance_policy text,
  overtime_policy text,
  grace_period_minutes integer NOT NULL DEFAULT 5,
  description text,
  footer_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clinic_profiles TO authenticated;
GRANT ALL ON public.clinic_profiles TO service_role;
ALTER TABLE public.clinic_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic readable in org" ON public.clinic_profiles
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "clinic editable by admin" ON public.clinic_profiles
  FOR UPDATE TO authenticated USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'administrator'))
  WITH CHECK (organization_id = public.current_org_id());
CREATE TRIGGER trg_clinic_updated BEFORE UPDATE ON public.clinic_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DEPARTMENTS
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dept read" ON public.departments FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "dept write" ON public.departments FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());
CREATE TRIGGER trg_dept_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- POSITIONS
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  can_receive_appointments boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos read" ON public.positions FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "pos write" ON public.positions FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());
CREATE TRIGGER trg_pos_updated BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SHIFTS
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  paid_break boolean NOT NULL DEFAULT false,
  grace_period_minutes integer NOT NULL DEFAULT 5,
  early_checkin_window_minutes integer NOT NULL DEFAULT 60,
  late_threshold_minutes integer NOT NULL DEFAULT 5,
  early_leave_threshold_minutes integer NOT NULL DEFAULT 5,
  overtime_threshold_minutes integer NOT NULL DEFAULT 30,
  min_overtime_minutes integer NOT NULL DEFAULT 30,
  crosses_midnight boolean NOT NULL DEFAULT false,
  working_days integer[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift read" ON public.shifts FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "shift write" ON public.shifts FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());
CREATE TRIGGER trg_shift_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EMPLOYEES
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code text NOT NULL,
  device_user_id text,
  full_name text NOT NULL,
  preferred_name text,
  gender text,
  date_of_birth date,
  phone text,
  email text,
  address text,
  avatar_url text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  employment_type public.employment_type NOT NULL DEFAULT 'full_time',
  employment_status public.employment_status NOT NULL DEFAULT 'active',
  start_date date,
  probation_end_date date,
  contract_start_date date,
  contract_end_date date,
  default_shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  work_location text,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  internal_notes text,
  professional_title text,
  license_number text,
  license_issue_date date,
  license_expiry_date date,
  specialization text,
  years_of_experience integer,
  qualifications text,
  treatment_room text,
  can_receive_appointments boolean NOT NULL DEFAULT false,
  appointment_display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, employee_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp read" ON public.employees FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "emp write" ON public.employees FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());
CREATE TRIGGER trg_emp_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- APP SETTINGS
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  setting_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, group_key, setting_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.app_settings FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "settings write" ON public.app_settings FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'administrator'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  previous_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager());
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

-- ============ DEMO SEED ============
INSERT INTO public.organizations (id, name, slug, is_default) VALUES
  ('11111111-1111-4111-8111-111111111111','Nha khoa Việt Smile','viet-smile', true);

INSERT INTO public.clinic_profiles (organization_id, name, short_name, legal_name, address, ward, district, city, maps_url, phone, hotline, appointment_phone, email, website, facebook, zalo, working_hours, lunch_break, weekly_days_off, tax_code, representative_name, manager_name, reminder_policy, attendance_policy, overtime_policy, grace_period_minutes, description, footer_info)
VALUES ('11111111-1111-4111-8111-111111111111','Nha khoa Việt Smile','Việt Smile','Công ty TNHH Nha khoa Việt Smile','128 Nguyễn Văn Cừ','Phường 2','Quận 5','TP. Hồ Chí Minh','https://maps.google.com/?q=128+Nguyen+Van+Cu','028 3838 1234','1900 1234','0901 234 567','lienhe@vietsmile.vn','https://vietsmile.vn','https://facebook.com/vietsmile','0901234567','08:00 - 20:30','12:00 - 13:30','Chủ nhật','0312345678','Nguyễn Thị Hồng Vân','Trần Minh Quân','Nhắc lịch trước 24 giờ và 3 giờ','Chấm công bằng vân tay, cho phép trễ 5 phút','Tính tăng ca sau giờ kết thúc ca, tối thiểu 30 phút',5,'Phòng khám nha khoa hiện đại, tận tâm với nụ cười Việt.','© 2026 Nha khoa Việt Smile — 128 Nguyễn Văn Cừ, Quận 5, TP.HCM');

INSERT INTO public.departments (id, organization_id, name, code, description, display_order) VALUES
  ('22222222-0001-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Bác sĩ','BS','Đội ngũ bác sĩ nha khoa',1),
  ('22222222-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Trợ thủ nha khoa','TT','Hỗ trợ bác sĩ trong điều trị',2),
  ('22222222-0003-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Lễ tân','LT','Tiếp đón và đặt lịch hẹn',3),
  ('22222222-0004-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Hành chính','HC','Quản lý và kế toán',4);

INSERT INTO public.positions (organization_id, department_id, name, description, can_receive_appointments, display_order) VALUES
  ('11111111-1111-4111-8111-111111111111','22222222-0001-4111-8111-111111111111','Bác sĩ điều trị','Khám và điều trị nha khoa', true, 1),
  ('11111111-1111-4111-8111-111111111111','22222222-0002-4111-8111-111111111111','Trợ thủ','Hỗ trợ ghế điều trị', false, 2),
  ('11111111-1111-4111-8111-111111111111','22222222-0003-4111-8111-111111111111','Lễ tân','Tiếp đón khách hàng', false, 3),
  ('11111111-1111-4111-8111-111111111111','22222222-0004-4111-8111-111111111111','Quản lý phòng khám','Điều hành hoạt động phòng khám', false, 4),
  ('11111111-1111-4111-8111-111111111111','22222222-0004-4111-8111-111111111111','Kế toán','Kế toán nội bộ', false, 5);

INSERT INTO public.shifts (organization_id, name, code, start_time, end_time, break_start, break_end, notes) VALUES
  ('11111111-1111-4111-8111-111111111111','Ca sáng','CS','08:00','12:00',NULL,NULL,'Ca làm việc buổi sáng'),
  ('11111111-1111-4111-8111-111111111111','Ca chiều','CC','13:30','17:30',NULL,NULL,'Ca làm việc buổi chiều'),
  ('11111111-1111-4111-8111-111111111111','Ca tối','CT','17:30','20:30',NULL,NULL,'Ca làm việc buổi tối'),
  ('11111111-1111-4111-8111-111111111111','Ca cả ngày','CN','08:00','17:30','12:00','13:30','Ca hành chính cả ngày');

INSERT INTO public.app_settings (organization_id, group_key, setting_key, value) VALUES
  ('11111111-1111-4111-8111-111111111111','attendance','defaults','{"grace_period_minutes":5,"overtime_threshold_minutes":30,"min_overtime_minutes":30,"overtime_rounding_minutes":15,"weekend_days":[0]}'::jsonb),
  ('11111111-1111-4111-8111-111111111111','appointment','defaults','{"default_duration_minutes":30,"interval_minutes":15,"reminder_hours_before":[24,3],"require_confirmation":true}'::jsonb),
  ('11111111-1111-4111-8111-111111111111','display','defaults','{"date_format":"dd/MM/yyyy","time_format":"HH:mm","timezone":"Asia/Ho_Chi_Minh","language":"vi","page_size":25}'::jsonb);
