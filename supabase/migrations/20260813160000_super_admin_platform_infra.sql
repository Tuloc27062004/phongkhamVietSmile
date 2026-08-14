-- Migration: Super Admin multi-tenant platform infrastructure (clean re-application)
--
-- Migrations 20260813100000 through 20260813140000 were authored in this repo but were
-- never actually applied to this project (no supabase_migrations tracking table exists,
-- and they reference organizations.code/is_active which never existed on this table).
-- This migration re-applies only the *infrastructure* pieces (functions, tables, columns)
-- from that unapplied chain, deliberately skipping:
--   - The fake seed tenants "Nha Khoa CT" / "Bá Lộc" test org (organizations/devices rows)
--   - Any auth.users INSERT/UPDATE (never touch real account passwords)
--   - The duplicate `clinic_type` column (superseded by `clinic_category` below — the two
--     unapplied migrations 20260813110000/20260813130000 had added overlapping columns
--     with different enums; only clinic_category is kept here)
--
-- The single real tenant already in this database is "Nha khoa Việt Smile" (slug viet-smile).

-- 1. Columns organizations needed but never had (is_super_admin() below depends on `code`)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clinic_category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS max_employees integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS max_doctors integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_devices integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{
    "module_appointments": true,
    "module_attendance": true,
    "module_payroll": true,
    "module_biometrics": true,
    "module_treatment_rooms": true,
    "module_reports": true
  }'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_code_key ON public.organizations (code) WHERE code IS NOT NULL;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_clinic_category_check,
  ADD CONSTRAINT organizations_clinic_category_check
  CHECK (clinic_category IN (
    'dental','general','obgyn','pediatrics','dermatology',
    'ophthalmology','ent','aesthetics','rehab','hospital'
  ));

-- 2. Tag the real tenant and create the empty GZV Platform hub org (Super Admin home)
UPDATE public.organizations SET code = 'VIETSMILE', clinic_category = 'dental'
WHERE slug = 'viet-smile' AND code IS NULL;

INSERT INTO public.organizations (name, code, slug, is_active, clinic_category)
VALUES ('Hệ Thống GZV Platform (Central Hub)', 'GZV_PLATFORM', 'gzv', true, 'general')
ON CONFLICT (slug) DO NOTHING;

-- 3. Move the 2 real Super Admin accounts to the GZV Platform hub org.
--    (has_role() checks user_roles.role regardless of organization_id, so their existing
--    'administrator' role rows do not need to move — only their home organization_id.)
UPDATE public.user_profiles
SET organization_id = (SELECT id FROM public.organizations WHERE code = 'GZV_PLATFORM')
WHERE email IN ('tuloc2706@gmail.com', 'stephensouth1307@gmail.com');

-- 4. Super Admin session table (which clinic workspace a super admin is currently viewing)
CREATE TABLE IF NOT EXISTS public.super_admin_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admin_sessions TO authenticated;
GRANT ALL ON public.super_admin_sessions TO service_role;
ALTER TABLE public.super_admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_session_policy" ON public.super_admin_sessions;
CREATE POLICY "super_admin_session_policy" ON public.super_admin_sessions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5. is_super_admin()
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

-- 6. current_org_id() — now switch-aware for Super Admins
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_switched_org uuid;
  v_default_org uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;

  IF public.is_super_admin(v_uid) THEN
    SELECT active_organization_id INTO v_switched_org
    FROM public.super_admin_sessions
    WHERE user_id = v_uid;

    IF v_switched_org IS NOT NULL THEN
      RETURN v_switched_org;
    END IF;
  END IF;

  SELECT organization_id INTO v_default_org FROM public.user_profiles WHERE id = v_uid;
  RETURN v_default_org;
END; $$;

-- 7. Switch active clinic workspace, by id or by slug
CREATE OR REPLACE FUNCTION public.super_admin_switch_clinic(target_org_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Chỉ Super Admin của GZV Platform mới có quyền chuyển đổi phòng khám quản lý!';
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

CREATE OR REPLACE FUNCTION public.get_organization_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  slug text,
  clinic_category text,
  is_active boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.code, o.slug, o.clinic_category, o.is_active
  FROM public.organizations o
  WHERE o.slug = LOWER(p_slug);
END; $$;

REVOKE ALL ON FUNCTION public.get_organization_by_slug(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_organization_by_slug(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_admin_switch_clinic_by_slug(p_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target_org_id uuid;
BEGIN
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Chỉ Super Admin GZV Platform mới có quyền chuyển đổi phòng khám theo Slug!';
  END IF;

  SELECT id INTO v_target_org_id
  FROM public.organizations
  WHERE slug = LOWER(p_slug) AND is_active = true;

  IF v_target_org_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy phòng khám với slug %!', p_slug;
  END IF;

  INSERT INTO public.super_admin_sessions (user_id, active_organization_id, updated_at)
  VALUES (v_uid, v_target_org_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    active_organization_id = EXCLUDED.active_organization_id,
    updated_at = now();

  RETURN v_target_org_id;
END; $$;

REVOKE ALL ON FUNCTION public.super_admin_switch_clinic_by_slug(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_switch_clinic_by_slug(text) TO authenticated;
