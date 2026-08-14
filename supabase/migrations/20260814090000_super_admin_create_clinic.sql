-- Migration: Super Admin quick-create new clinic by specialty/category
-- Creates the organization row and a matching clinic_profiles row atomically,
-- so a freshly created clinic is never blank/broken when switched into.

CREATE OR REPLACE FUNCTION public.super_admin_create_clinic(
  p_name text,
  p_slug text,
  p_code text DEFAULT NULL,
  p_clinic_category text DEFAULT 'general'
)
RETURNS TABLE (id uuid, slug text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slug text := lower(trim(p_slug));
  v_org_id uuid;
BEGIN
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Chỉ Super Admin GZV Platform mới có quyền tạo phòng khám mới!';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Tên phòng khám không được để trống!';
  END IF;

  IF v_slug IS NULL OR v_slug = '' THEN
    RAISE EXCEPTION 'Slug phòng khám không được để trống!';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) THEN
    RAISE EXCEPTION 'Slug "%" đã được sử dụng, vui lòng chọn slug khác!', v_slug;
  END IF;

  INSERT INTO public.organizations (name, slug, code, clinic_category, is_active)
  VALUES (trim(p_name), v_slug, NULLIF(trim(p_code), ''), COALESCE(NULLIF(p_clinic_category, ''), 'general'), true)
  RETURNING organizations.id INTO v_org_id;

  INSERT INTO public.clinic_profiles (organization_id, name)
  VALUES (v_org_id, trim(p_name));

  RETURN QUERY SELECT v_org_id, v_slug;
END; $$;

REVOKE ALL ON FUNCTION public.super_admin_create_clinic(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_create_clinic(text, text, text, text) TO authenticated;
