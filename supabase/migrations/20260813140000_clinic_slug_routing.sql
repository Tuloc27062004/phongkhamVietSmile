-- Migration: Dynamic Clinic Slug System & Multi-Tenant Routing Security
-- Enables URL Slug Routing (/nha-khoa-ct/dashboard, /gzv/admin/dashboard, etc.)

-- 1. Ensure slug column exists and is UNIQUE on public.organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Populate default slugs for existing organizations if missing
UPDATE public.organizations SET slug = 'nha-khoa-ct' WHERE code = 'NHAKHOACT' AND (slug IS NULL OR slug = '');
UPDATE public.organizations SET slug = 'gzv' WHERE code = 'GZV_PLATFORM' AND (slug IS NULL OR slug = '');

-- Fallback for any other orgs
UPDATE public.organizations 
SET slug = LOWER(REPLACE(REPLACE(code, '_', '-'), ' ', '-')) 
WHERE slug IS NULL OR slug = '';

ALTER TABLE public.organizations ALTER COLUMN slug SET NOT NULL;

-- 2. RPC: Resolve organization details by slug
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

-- 3. RPC: Switch Super Admin session workspace by target slug
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
