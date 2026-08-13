-- PHASE 8: FRONTEND/SCHEMA ALIGNMENT
-- The routes below were built against table names that were never migrated:
--   devices, device_logs, attendance_summaries, overtime_records,
--   payroll_records, salary_config, error_reports, reports
-- This migration adds them with the exact columns those pages already query,
-- so no frontend code needs to change.

-- ============ DEVICES (biometric.devices.tsx + system.devices.tsx) ============

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  device_name text NOT NULL,
  device_type text NOT NULL, -- fingerprint, face, temperature, ...
  serial_number text NOT NULL,
  location text,
  ip_address text,

  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','error')),

  last_sync_time timestamptz,
  last_sync timestamptz,
  sync_count integer NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  users_synced integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, serial_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices read" ON public.devices
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "devices write" ON public.devices FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_devices_org ON public.devices(organization_id);


-- ============ DEVICE LOGS (attendance.logs.tsx) ============

CREATE TABLE public.device_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,

  event_type text NOT NULL CHECK (event_type IN ('check_in','check_out','admin_access','error')),
  event_time timestamptz NOT NULL DEFAULT now(),
  temperature numeric,
  mask_detected boolean,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.device_logs TO authenticated;
GRANT ALL ON public.device_logs TO service_role;
ALTER TABLE public.device_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_logs read" ON public.device_logs
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE POLICY "device_logs insert" ON public.device_logs
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_device_logs_org_time ON public.device_logs(organization_id, event_time);
CREATE INDEX idx_device_logs_device_time ON public.device_logs(device_id, event_time);


-- ============ ATTENDANCE SUMMARIES (attendance.monthly.tsx) ============
-- Distinct from public.attendance_summary (phase 3): this table stores one
-- denormalized row per employee per period, matching the flat columns the
-- monthly report page reads directly (no join).

CREATE TABLE public.attendance_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  employee_code text NOT NULL,
  date date NOT NULL,

  total_days integer NOT NULL DEFAULT 0,
  present_days integer NOT NULL DEFAULT 0,
  absent_days integer NOT NULL DEFAULT 0,
  late_days integer NOT NULL DEFAULT 0,
  early_leave_days integer NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (employee_id, date)
);

GRANT SELECT, INSERT, UPDATE ON public.attendance_summaries TO authenticated;
GRANT ALL ON public.attendance_summaries TO service_role;
ALTER TABLE public.attendance_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_summaries read" ON public.attendance_summaries
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "attendance_summaries write" ON public.attendance_summaries FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_attendance_summaries_org_date ON public.attendance_summaries(organization_id, date);


-- ============ OVERTIME RECORDS (attendance.overtime.tsx) ============

CREATE TABLE public.overtime_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  overtime_date date NOT NULL,
  duration_hours numeric NOT NULL DEFAULT 0,
  rate_multiplier numeric NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  reason text,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overtime_records TO authenticated;
GRANT ALL ON public.overtime_records TO service_role;
ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overtime read" ON public.overtime_records
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "overtime write" ON public.overtime_records FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_overtime_updated BEFORE UPDATE ON public.overtime_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_overtime_employee_date ON public.overtime_records(employee_id, overtime_date);
CREATE INDEX idx_overtime_org_date ON public.overtime_records(organization_id, overtime_date);


-- ============ SALARY CONFIG (hr.salary.tsx, hr.payroll.tsx, dashboards) ============

CREATE TABLE public.salary_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  employee_id uuid NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  base_salary numeric NOT NULL DEFAULT 0,
  allowance numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  late_deduction numeric NOT NULL DEFAULT 0,
  absence_deduction numeric NOT NULL DEFAULT 0,
  insurance_deduction numeric NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.salary_config TO authenticated;
GRANT ALL ON public.salary_config TO service_role;
ALTER TABLE public.salary_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_config read" ON public.salary_config
  FOR SELECT TO authenticated USING (
    organization_id = public.current_org_id()
    AND (
      public.is_staff_manager()
      OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = salary_config.employee_id AND e.user_id = auth.uid())
    )
  );

CREATE POLICY "salary_config write" ON public.salary_config FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_salary_config_updated BEFORE UPDATE ON public.salary_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_salary_config_org ON public.salary_config(organization_id);


-- ============ PAYROLL RECORDS (hr.payroll.tsx) ============

CREATE TABLE public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,

  worked_days integer NOT NULL DEFAULT 0,
  late_days integer NOT NULL DEFAULT 0,
  absent_days integer NOT NULL DEFAULT 0,
  base_salary numeric NOT NULL DEFAULT 0,
  late_deduction numeric NOT NULL DEFAULT 0,
  absence_deduction numeric NOT NULL DEFAULT 0,
  insurance numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','calculated','approved','paid')),
  approved_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (employee_id, month, year)
);

GRANT SELECT, INSERT, UPDATE ON public.payroll_records TO authenticated;
GRANT ALL ON public.payroll_records TO service_role;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_records read" ON public.payroll_records
  FOR SELECT TO authenticated USING (
    organization_id = public.current_org_id()
    AND (
      public.is_staff_manager()
      OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payroll_records.employee_id AND e.user_id = auth.uid())
    )
  );

CREATE POLICY "payroll_records write" ON public.payroll_records FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_payroll_employee_period ON public.payroll_records(employee_id, year, month);
CREATE INDEX idx_payroll_org_period ON public.payroll_records(organization_id, year, month);


-- ============ ERROR REPORTS (issues.report.tsx, issues.my-reports.tsx, admin.issues.tsx) ============

CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('bug','feature','feedback','other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  title text NOT NULL,
  description text NOT NULL,
  steps_to_reproduce text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wont_fix')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.error_reports TO authenticated;
GRANT ALL ON public.error_reports TO service_role;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "error_reports read" ON public.error_reports
  FOR SELECT TO authenticated USING (
    organization_id = public.current_org_id() AND (public.is_staff_manager() OR user_id = auth.uid())
  );

CREATE POLICY "error_reports insert" ON public.error_reports
  FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY "error_reports update" ON public.error_reports
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_error_reports_updated BEFORE UPDATE ON public.error_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_error_reports_org_status ON public.error_reports(organization_id, status);
CREATE INDEX idx_error_reports_user ON public.error_reports(user_id);


-- ============ REPORTS (reports.attendance.tsx) ============
-- Distinct from public.generated_reports (phase 6): flat shape matching what
-- the attendance reports page reads directly.

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,

  report_name text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('daily','weekly','monthly')),
  report_category text NOT NULL DEFAULT 'attendance',
  generated_date timestamptz NOT NULL DEFAULT now(),
  file_format text NOT NULL DEFAULT 'excel' CHECK (file_format IN ('excel','csv','pdf')),
  file_size integer NOT NULL DEFAULT 0,
  file_url text,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('completed','processing')),

  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports read" ON public.reports
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE POLICY "reports write" ON public.reports FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_reports_org_category_date ON public.reports(organization_id, report_category, generated_date);
