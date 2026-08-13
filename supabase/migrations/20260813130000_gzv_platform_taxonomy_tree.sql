-- Migration: Complete Category Taxonomy & Multi-Tenant Management Schema
-- Taxonomy for GZV CLINIC PLATFORM:
--   - dental (Nha khoa)
--   - general (Phòng khám đa khoa)
--   - obgyn (Sản - Phụ khoa)
--   - pediatrics (Nhi khoa)
--   - dermatology (Da liễu)
--   - ophthalmology (Mắt)
--   - ent (Tai Mũi Họng)
--   - aesthetics (Thẩm mỹ)
--   - rehab (Vật lý trị liệu)
--   - hospital (Bệnh viện / Cơ sở y tế lớn)

-- 1. Drop existing constraint if any and re-add comprehensive clinic_category check
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_clinic_type_check,
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

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_clinic_category_check 
  CHECK (clinic_category IN (
    'dental',
    'general',
    'obgyn',
    'pediatrics',
    'dermatology',
    'ophthalmology',
    'ent',
    'aesthetics',
    'rehab',
    'hospital'
  ));

-- 2. Enhanced Super Admin RPC to fetch tree taxonomy of all clinics grouped by category
CREATE OR REPLACE FUNCTION public.super_admin_list_clinics_taxonomy()
RETURNS TABLE (
  id uuid,
  name text,
  code text,
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
