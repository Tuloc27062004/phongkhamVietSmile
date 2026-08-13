-- PHASE 6: REPORTING & ANALYTICS

-- ============ REPORT CONFIGURATIONS ============

CREATE TABLE public.report_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  report_name text NOT NULL,
  report_type text NOT NULL, -- attendance, payroll, appointment, revenue, etc.
  description text,
  
  -- Filter defaults
  filter_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Display columns
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Scheduling
  schedule_enabled boolean NOT NULL DEFAULT false,
  schedule_frequency text, -- daily, weekly, monthly
  schedule_day_of_week integer, -- 0-6 for weekly
  schedule_day_of_month integer, -- 1-31 for monthly
  schedule_hour integer,
  schedule_minute integer,
  
  -- Recipients
  email_recipients text[] DEFAULT '{}',
  
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_configs TO authenticated;
GRANT ALL ON public.report_configs TO service_role;
ALTER TABLE public.report_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_config read" ON public.report_configs
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE POLICY "report_config write" ON public.report_configs FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'administrator'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'administrator'));

CREATE TRIGGER trg_report_config_updated BEFORE UPDATE ON public.report_configs 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============ GENERATED REPORTS ============

CREATE TABLE public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_config_id uuid REFERENCES public.report_configs(id) ON DELETE SET NULL,
  
  report_name text NOT NULL,
  report_type text NOT NULL,
  
  -- Data
  data_rows integer NOT NULL DEFAULT 0,
  file_url text,
  file_format text DEFAULT 'xlsx', -- xlsx, csv, pdf, json
  
  -- Generation
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Filters applied
  filters_applied jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_reports TO authenticated;
GRANT ALL ON public.generated_reports TO service_role;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gen_report read" ON public.generated_reports
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE POLICY "gen_report delete" ON public.generated_reports FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'administrator'));

CREATE INDEX idx_gen_report_date ON public.generated_reports(organization_id, generated_at);


-- ============ EXPORT LOGS ============

CREATE TABLE public.export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  export_type text NOT NULL, -- attendance_excel, payroll_csv, etc.
  export_format text NOT NULL, -- xlsx, csv, pdf
  
  file_name text NOT NULL,
  file_size_bytes integer,
  file_url text,
  
  rows_exported integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  
  exported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  export_date_range jsonb, -- {start_date, end_date}
  
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.export_logs TO authenticated;
GRANT ALL ON public.export_logs TO service_role;
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "export_log read" ON public.export_logs
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_export_log_date ON public.export_logs(organization_id, created_at);


-- ============ KPI METRICS ============

CREATE TABLE public.kpi_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  metric_date date NOT NULL,
  metric_type text NOT NULL, -- attendance_rate, punctuality_rate, revenue_per_appointment, etc.
  
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  
  -- Values
  metric_value numeric,
  target_value numeric,
  variance numeric,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_kpi_metrics_unique ON public.kpi_metrics (
  organization_id,
  metric_date,
  metric_type,
  COALESCE(employee_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_metrics TO authenticated;
GRANT ALL ON public.kpi_metrics TO service_role;
ALTER TABLE public.kpi_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi read" ON public.kpi_metrics
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "kpi write" ON public.kpi_metrics FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_kpi_updated BEFORE UPDATE ON public.kpi_metrics 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_kpi_date ON public.kpi_metrics(organization_id, metric_date);
CREATE INDEX idx_kpi_type ON public.kpi_metrics(organization_id, metric_type);
