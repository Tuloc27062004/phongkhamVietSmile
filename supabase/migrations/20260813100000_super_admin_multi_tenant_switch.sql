-- Migration: Platform Super Admin Multi-Tenant Control & Switcher Security
-- 1. Helper function is_super_admin()
-- 2. Enhanced current_org_id() supporting active organization switching for Super Admins
-- 3. Super Admin RPC to inspect and switch active clinic workspace

-- Active session workspace selection table for Super Admins
CREATE TABLE IF NOT EXISTS public.super_admin_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admin_sessions TO authenticated;
GRANT ALL ON public.super_admin_sessions TO service_role;
ALTER TABLE public.super_admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_session_policy" ON public.super_admin_sessions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Function: Check if user is Super Admin (GZV Super Admin users)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.organizations o ON up.organization_id = o.id
    WHERE up.id = _user_id 
      AND o.code = 'GZV_PLATFORM'
      AND public.has_role(_user_id, 'administrator')
  );
$$;

-- Enhanced current_org_id() to support active org switching for Super Admins
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_switched_org uuid;
  v_default_org uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  -- If user is Super Admin, check if they have switched active organization
  IF public.is_super_admin(v_uid) THEN
    SELECT active_organization_id INTO v_switched_org 
    FROM public.super_admin_sessions 
    WHERE user_id = v_uid;

    IF v_switched_org IS NOT NULL THEN
      RETURN v_switched_org;
    END IF;
  END IF;

  -- Default: Return user's home organization_id
  SELECT organization_id INTO v_default_org FROM public.user_profiles WHERE id = v_uid;
  RETURN v_default_org;
END; $$;

-- RPC: Switch active clinic workspace (Super Admin only)
CREATE OR REPLACE FUNCTION public.super_admin_switch_clinic(target_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Chỉ Super Admin của Phòng Khám GZV System mới có quyền chuyển đổi phòng khám quản lý!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = target_org_id AND is_active = true) THEN
    RAISE EXCEPTION 'Phòng khám mục tiêu không tồn tại hoặc đã bị khóa!';
  END IF;

  INSERT INTO public.super_admin_sessions (user_id, active_organization_id, updated_at)
  VALUES (v_uid, target_org_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    active_organization_id = EXCLUDED.active_organization_id,
    updated_at = now();
END; $$;

REVOKE ALL ON FUNCTION public.super_admin_switch_clinic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_switch_clinic(uuid) TO authenticated;

-- RPC: List all clinics for Super Admin inspection
CREATE OR REPLACE FUNCTION public.super_admin_list_clinics()
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  is_active boolean,
  created_at timestamptz,
  is_active_workspace boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current_org uuid := public.current_org_id();
BEGIN
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Quyền truy cập bị từ chối';
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.code,
    o.is_active,
    o.created_at,
    (o.id = v_current_org) AS is_active_workspace
  FROM public.organizations o
  ORDER BY o.created_at ASC;
END; $$;

REVOKE ALL ON FUNCTION public.super_admin_list_clinics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_list_clinics() TO authenticated;
