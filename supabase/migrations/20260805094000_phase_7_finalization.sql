-- PHASE 7: FINALIZATION & SYSTEM ENHANCEMENTS

-- ============ NOTIFICATION SYSTEM ============

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  notification_type text NOT NULL, -- attendance_alert, appointment_reminder, report_ready, system_alert
  title text NOT NULL,
  message text NOT NULL,
  data jsonb, -- Additional context data
  
  -- Read status
  read_at timestamptz,
  is_read boolean NOT NULL DEFAULT false,
  
  -- Action
  action_url text,
  action_text text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif read" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notif update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif delete" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR organization_id = public.current_org_id());

CREATE INDEX idx_notif_user_read ON public.notifications(user_id, is_read, created_at);
CREATE INDEX idx_notif_org_date ON public.notifications(organization_id, created_at);


-- ============ BACKUP & MAINTENANCE ============

CREATE TABLE public.system_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  backup_type text NOT NULL, -- full, incremental, selective
  backup_scope text, -- all, attendance, appointments, settings
  
  file_url text,
  file_size_bytes integer,
  
  backup_status text NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed
  error_message text,
  
  triggered_by text, -- manual, scheduled, auto
  backup_date date NOT NULL,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  next_backup_date date
);

GRANT SELECT, INSERT, UPDATE ON public.system_backups TO authenticated;
GRANT ALL ON public.system_backups TO service_role;
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup read" ON public.system_backups
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'administrator'));

CREATE INDEX idx_backup_date ON public.system_backups(organization_id, backup_date);


-- ============ SYSTEM EVENTS ============

CREATE TABLE public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  event_type text NOT NULL, -- login, logout, setting_change, data_import, data_export
  event_category text, -- auth, system, data, integration
  severity text NOT NULL DEFAULT 'info', -- info, warning, error, critical
  
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  
  subject text NOT NULL,
  description text,
  
  affected_records jsonb, -- IDs of affected records
  changes jsonb, -- What changed (for update events)
  
  source_ip text,
  user_agent text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event read" ON public.system_events
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_event_type ON public.system_events(organization_id, event_type, created_at);
CREATE INDEX idx_event_severity ON public.system_events(organization_id, severity, created_at);


-- ============ TEMPLATES & WORKFLOWS ============

CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  template_name text NOT NULL,
  template_type text NOT NULL, -- sms, email, whatsapp
  
  trigger_event text NOT NULL, -- appointment_confirmed, reminder_24h, late_alert, etc.
  
  subject text, -- for email
  body text NOT NULL,
  
  variables jsonb DEFAULT '[]'::jsonb, -- {name: "", type: ""}
  is_active boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template read" ON public.notification_templates
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE POLICY "template write" ON public.notification_templates FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'administrator'))
  WITH CHECK (organization_id = public.current_org_id() AND public.has_role(auth.uid(), 'administrator'));

CREATE TRIGGER trg_template_updated BEFORE UPDATE ON public.notification_templates 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============ MULTI-ORGANIZATION DEFAULTS ============

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS is_system_default boolean NOT NULL DEFAULT false;


-- ============ SESSION & API KEYS ============

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  key_name text NOT NULL,
  key_hash text NOT NULL UNIQUE, -- Store hashed API key
  
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  last_used_at timestamptz,
  expires_at timestamptz,
  
  scopes text[] DEFAULT '{}', -- read:attendance, write:appointments, etc.
  is_active boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apikey read" ON public.api_keys
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND created_by = auth.uid());

CREATE POLICY "apikey write" ON public.api_keys FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND created_by = auth.uid())
  WITH CHECK (organization_id = public.current_org_id() AND created_by = auth.uid());

CREATE INDEX idx_apikey_org ON public.api_keys(organization_id, is_active);


-- ============ INTEGRATION LOGS ============

CREATE TABLE public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  integration_name text NOT NULL, -- payroll_system, hrm_system, accounting, sms_gateway
  integration_type text NOT NULL, -- inbound, outbound, bidirectional
  
  action text NOT NULL,
  status text NOT NULL, -- success, pending, failed
  
  request_data jsonb,
  response_data jsonb,
  error_message text,
  
  execution_time_ms integer,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.integration_logs TO authenticated;
GRANT ALL ON public.integration_logs TO service_role;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integ_log read" ON public.integration_logs
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE INDEX idx_integ_log_date ON public.integration_logs(organization_id, created_at);
CREATE INDEX idx_integ_log_status ON public.integration_logs(organization_id, status);
