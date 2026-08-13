-- Migration: Dynamic Multi-Tenant License & Feature Entitlement Schema
-- Allows Super Admin (Bá Lộc Central) to set clinic type, max user limits, and feature permissions per clinic.

-- Add Clinic Category / Type, Max User Quota, and Feature Flags to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS clinic_type text NOT NULL DEFAULT 'general' CHECK (clinic_type IN ('general','dental','cardiology','dermatology','pediatrics','hospital')),
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

-- Super Admin RPC: Create / Manage Clinic Tenants & Quotas
CREATE OR REPLACE FUNCTION public.super_admin_upsert_clinic(
  p_org_id uuid,
  p_name text,
  p_code text,
  p_clinic_type text,
  p_max_employees integer,
  p_max_doctors integer,
  p_max_devices integer,
  p_feature_flags jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res_id uuid;
BEGIN
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Chỉ Super Admin GZV Platform mới có quyền quản lý thông số phòng khám khách hàng!';
  END IF;

  IF p_org_id IS NULL THEN
    INSERT INTO public.organizations (name, code, clinic_type, max_employees, max_doctors, max_devices, feature_flags, is_active)
    VALUES (p_name, p_code, p_clinic_type, p_max_employees, p_max_doctors, p_max_devices, p_feature_flags, true)
    RETURNING id INTO v_res_id;
  ELSE
    UPDATE public.organizations
    SET name = p_name,
        code = p_code,
        clinic_type = p_clinic_type,
        max_employees = p_max_employees,
        max_doctors = p_max_doctors,
        max_devices = p_max_devices,
        feature_flags = p_feature_flags,
        updated_at = now()
    WHERE id = p_org_id
    RETURNING id INTO v_res_id;
  END IF;

  RETURN v_res_id;
END; $$;

REVOKE ALL ON FUNCTION public.super_admin_upsert_clinic(uuid, text, text, text, integer, integer, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_upsert_clinic(uuid, text, text, text, integer, integer, integer, jsonb) TO authenticated;
