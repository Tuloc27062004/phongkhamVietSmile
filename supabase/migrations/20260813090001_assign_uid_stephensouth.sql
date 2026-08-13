-- Migration: Link UID 8710ca82-32c2-4765-be14-9c92f1626f2f for stephensouth1307@gmail.com
-- Grant Super Admin / Full 6 Roles under 'Phòng Khám Bá Lộc (Test System)'

DO $$
DECLARE
  v_target_uid UUID := '8710ca82-32c2-4765-be14-9c92f1626f2f'::uuid;
  v_org_baloc_id UUID;
BEGIN
  -- 1. Get Organization 'BALOC_TEST'
  SELECT id INTO v_org_baloc_id FROM public.organizations WHERE code = 'BALOC_TEST';

  IF v_org_baloc_id IS NULL THEN
    INSERT INTO public.organizations (name, code, is_active)
    VALUES ('Phòng Khám Bá Lộc (Test System)', 'BALOC_TEST', true)
    RETURNING id INTO v_org_baloc_id;
  END IF;

  -- 2. Upsert User Profile
  INSERT INTO public.user_profiles (id, organization_id, full_name, email, approval_status, is_active, approved_at)
  VALUES (v_target_uid, v_org_baloc_id, 'Stephen South (Super Admin Bá Lộc)', 'stephensouth1307@gmail.com', 'approved', true, now())
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    approval_status = 'approved',
    is_active = true,
    approved_at = now();

  -- 3. Grant Full 6 Roles to UID 8710ca82-32c2-4765-be14-9c92f1626f2f
  DELETE FROM public.user_roles WHERE user_id = v_target_uid;
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES
    (v_target_uid, v_org_baloc_id, 'administrator'),
    (v_target_uid, v_org_baloc_id, 'manager'),
    (v_target_uid, v_org_baloc_id, 'doctor'),
    (v_target_uid, v_org_baloc_id, 'receptionist'),
    (v_target_uid, v_org_baloc_id, 'employee'),
    (v_target_uid, v_org_baloc_id, 'patient');

  -- 4. Upsert Employee record
  INSERT INTO public.employees (
    organization_id, user_id, full_name, email, employee_code, is_active, job_title
  )
  VALUES (
    v_org_baloc_id, v_target_uid, 'BS. Stephen South (Tổng Quản Lý)', 'stephensouth1307@gmail.com', 'EMP_BALOC_02', true, 'Giám Đốc Y Khoa / Super Admin'
  )
  ON CONFLICT DO NOTHING;

END $$;
