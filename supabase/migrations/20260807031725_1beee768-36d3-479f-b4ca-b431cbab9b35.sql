CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  check_in_time timestamptz,
  check_out_time timestamptz,
  device_check_in_time timestamptz,
  device_check_out_time timestamptz,
  late_minutes integer,
  early_leave_minutes integer,
  overtime_minutes integer,
  paid_break_minutes integer,
  unpaid_break_minutes integer,
  worked_minutes integer,
  attendance_status text NOT NULL DEFAULT 'present',
  is_approved boolean NOT NULL DEFAULT false,
  approval_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, employee_id, work_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "att read" ON public.attendance_records
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "att write" ON public.attendance_records FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_attendance_employee_date ON public.attendance_records(employee_id, work_date);
CREATE INDEX idx_attendance_org_date ON public.attendance_records(organization_id, work_date);

CREATE TABLE public.attendance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_id uuid REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  reason text NOT NULL,
  adjusted_value text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_adjustments TO authenticated;
GRANT ALL ON public.attendance_adjustments TO service_role;
ALTER TABLE public.attendance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adj read" ON public.attendance_adjustments
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "adj write" ON public.attendance_adjustments FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_adjustment_updated BEFORE UPDATE ON public.attendance_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.attendance_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  total_working_days integer NOT NULL DEFAULT 0,
  present_days integer NOT NULL DEFAULT 0,
  absent_days integer NOT NULL DEFAULT 0,
  leave_days integer NOT NULL DEFAULT 0,
  holiday_days integer NOT NULL DEFAULT 0,
  sick_days integer NOT NULL DEFAULT 0,
  late_count integer NOT NULL DEFAULT 0,
  early_leave_count integer NOT NULL DEFAULT 0,
  total_overtime_minutes integer NOT NULL DEFAULT 0,
  total_worked_minutes integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_summary TO authenticated;
GRANT ALL ON public.attendance_summary TO service_role;
ALTER TABLE public.attendance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "summary read" ON public.attendance_summary
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "summary write" ON public.attendance_summary FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_summary_updated BEFORE UPDATE ON public.attendance_summary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_summary_employee_month ON public.attendance_summary(employee_id, year, month);