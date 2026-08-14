-- Migration: Expose organizations.slug on the Super Admin clinic-list RPCs
-- Needed so the frontend clinic switcher can navigate to /$slug/... after picking a clinic.

CREATE OR REPLACE FUNCTION public.super_admin_list_clinics()
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  slug text,
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
    o.slug,
    o.is_active,
    o.created_at,
    (o.id = v_current_org) AS is_active_workspace
  FROM public.organizations o
  ORDER BY o.created_at ASC;
END; $$;

REVOKE ALL ON FUNCTION public.super_admin_list_clinics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_list_clinics() TO authenticated;

CREATE OR REPLACE FUNCTION public.super_admin_list_clinics_taxonomy()
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  slug text,
  clinic_category text,
  clinic_category_label text,
  max_employees integer,
  max_doctors integer,
  max_devices integer,
  employee_count bigint,
  doctor_count bigint,
  device_count bigint,
  is_active boolean,
  created_at timestamptz,
  is_active_workspace boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current_org uuid := public.current_org_id();
BEGIN
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Chỉ Super Admin GZV Platform mới có quyền xem cây danh mục phòng khám!';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.code,
    o.slug,
    o.clinic_category,
    CASE o.clinic_category
      WHEN 'dental' THEN 'Nha Khoa'
      WHEN 'general' THEN 'Phòng Khám Đa Khoa'
      WHEN 'obgyn' THEN 'Sản - Phụ Khoa'
      WHEN 'pediatrics' THEN 'Nhi Khoa'
      WHEN 'dermatology' THEN 'Da Liễu'
      WHEN 'ophthalmology' THEN 'Mắt'
      WHEN 'ent' THEN 'Tai Mũi Họng'
      WHEN 'aesthetics' THEN 'Thẩm Mỹ'
      WHEN 'rehab' THEN 'Vật Lý Trị Liệu'
      WHEN 'hospital' THEN 'Bệnh Viện / Cơ Sở Y Tế'
      ELSE 'Khác'
    END AS clinic_category_label,
    o.max_employees,
    o.max_doctors,
    o.max_devices,
    (SELECT COUNT(*) FROM public.employees e WHERE e.organization_id = o.id AND e.deleted_at IS NULL) AS employee_count,
    (SELECT COUNT(*) FROM public.employees e JOIN public.user_roles ur ON e.user_id = ur.user_id WHERE e.organization_id = o.id AND ur.role = 'doctor') AS doctor_count,
    (SELECT COUNT(*) FROM public.devices d WHERE d.organization_id = o.id) AS device_count,
    o.is_active,
    o.created_at,
    (o.id = v_current_org) AS is_active_workspace
  FROM public.organizations o
  ORDER BY o.clinic_category ASC, o.name ASC;
END; $$;

REVOKE ALL ON FUNCTION public.super_admin_list_clinics_taxonomy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_list_clinics_taxonomy() TO authenticated;
