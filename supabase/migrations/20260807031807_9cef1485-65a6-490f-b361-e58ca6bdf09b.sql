CREATE TABLE public.device_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  device_ip_address text,
  device_port integer,
  device_username text,
  device_password_encrypted text,
  connection_method text NOT NULL DEFAULT 'network',
  device_type text NOT NULL DEFAULT 'zkteco',
  sync_interval_minutes integer NOT NULL DEFAULT 30,
  auto_sync_enabled boolean NOT NULL DEFAULT true,
  last_sync_time timestamptz,
  is_connected boolean NOT NULL DEFAULT false,
  last_test_time timestamptz,
  test_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.device_configs TO authenticated;
GRANT ALL ON public.device_configs TO service_role;
ALTER TABLE public.device_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_config read" ON public.device_configs
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "device_config write" ON public.device_configs FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'administrator'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'administrator'));

CREATE TRIGGER trg_device_config_updated BEFORE UPDATE ON public.device_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.device_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sync_type text NOT NULL,
  status text NOT NULL,
  error_message text,
  records_found integer NOT NULL DEFAULT 0,
  records_imported integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.device_sync_logs TO authenticated;
GRANT ALL ON public.device_sync_logs TO service_role;
ALTER TABLE public.device_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_logs read" ON public.device_sync_logs
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_sync_logs_org_date ON public.device_sync_logs(organization_id, created_at);

CREATE TABLE public.device_sync_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  device_user_id text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_time timestamptz,
  sync_status text NOT NULL DEFAULT 'pending',
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, device_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_sync_mappings TO authenticated;
GRANT ALL ON public.device_sync_mappings TO service_role;
ALTER TABLE public.device_sync_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_map read" ON public.device_sync_mappings
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "sync_map write" ON public.device_sync_mappings FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_sync_map_updated BEFORE UPDATE ON public.device_sync_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_sync_map_device_id ON public.device_sync_mappings(device_user_id);
CREATE INDEX idx_sync_map_employee_id ON public.device_sync_mappings(employee_id);