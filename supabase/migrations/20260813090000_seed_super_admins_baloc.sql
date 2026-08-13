-- Migration: Setup Super Admin accounts for 'tuloc2706@gmail.com' and 'stephensouth1307@gmail.com'
-- Assigned to 'BALOC_TEST' organization with full role-switching privileges across all 6 roles.

DO $$
DECLARE
  v_org_baloc_id UUID;
  v_user1_id UUID;
  v_user2_id UUID;
BEGIN
  -- 1. Ensure Organization 'Phòng Khám Bá Lộc (Test System)' exists
  SELECT id INTO v_org_baloc_id FROM public.organizations WHERE code = 'BALOC_TEST';

  IF v_org_baloc_id IS NULL THEN
    INSERT INTO public.organizations (name, code, is_active)
    VALUES ('Phòng Khám Bá Lộc (Test System)', 'BALOC_TEST', true)
    RETURNING id INTO v_org_baloc_id;
  END IF;

  -- 2. Upsert User 1: tuloc2706@gmail.com
  SELECT id INTO v_user1_id FROM auth.users WHERE email = 'tuloc2706@gmail.com';

  IF v_user1_id IS NULL THEN
    v_user1_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
      v_user1_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'tuloc2706@gmail.com',
      crypt('123456', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Tù Lộc (Super Admin)"}',
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = v_user1_id;
  END IF;

  -- Profile User 1
  INSERT INTO public.user_profiles (id, organization_id, full_name, email, approval_status, is_active, approved_at)
  VALUES (v_user1_id, v_org_baloc_id, 'Tù Lộc (Super Admin Bá Lộc)', 'tuloc2706@gmail.com', 'approved', true, now())
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    approval_status = 'approved',
    is_active = true;

  -- Full Roles User 1 (grant all 6 roles for complete role-switching capabilities)
  DELETE FROM public.user_roles WHERE user_id = v_user1_id;
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES
    (v_user1_id, v_org_baloc_id, 'administrator'),
    (v_user1_id, v_org_baloc_id, 'manager'),
    (v_user1_id, v_org_baloc_id, 'doctor'),
    (v_user1_id, v_org_baloc_id, 'receptionist'),
    (v_user1_id, v_org_baloc_id, 'employee'),
    (v_user1_id, v_org_baloc_id, 'patient');

  -- Also insert employee record for Doctor / HR views
  INSERT INTO public.employees (
    organization_id, user_id, full_name, email, employee_code, is_active, job_title, department_id
  )
  VALUES (
    v_org_baloc_id, v_user1_id, 'BS. Tù Lộc (Tổng Quản Lý)', 'tuloc2706@gmail.com', 'EMP_BALOC_01', true, 'Bác sĩ Trưởng Khoa / Super Admin', NULL
  )
  ON CONFLICT DO NOTHING;

  -- 3. Upsert User 2: stephensouth1307@gmail.com
  SELECT id INTO v_user2_id FROM auth.users WHERE email = 'stephensouth1307@gmail.com';

  IF v_user2_id IS NULL THEN
    v_user2_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
      v_user2_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'stephensouth1307@gmail.com',
      crypt('123456', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Stephen South (Super Admin)"}',
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('123456', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = v_user2_id;
  END IF;

  -- Profile User 2
  INSERT INTO public.user_profiles (id, organization_id, full_name, email, approval_status, is_active, approved_at)
  VALUES (v_user2_id, v_org_baloc_id, 'Stephen South (Super Admin Bá Lộc)', 'stephensouth1307@gmail.com', 'approved', true, now())
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    approval_status = 'approved',
    is_active = true;

  -- Full Roles User 2 (grant all 6 roles for complete role-switching capabilities)
  DELETE FROM public.user_roles WHERE user_id = v_user2_id;
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES
    (v_user2_id, v_org_baloc_id, 'administrator'),
    (v_user2_id, v_org_baloc_id, 'manager'),
    (v_user2_id, v_org_baloc_id, 'doctor'),
    (v_user2_id, v_org_baloc_id, 'receptionist'),
    (v_user2_id, v_org_baloc_id, 'employee'),
    (v_user2_id, v_org_baloc_id, 'patient');

  -- Also insert employee record for Doctor / HR views
  INSERT INTO public.employees (
    organization_id, user_id, full_name, email, employee_code, is_active, job_title, department_id
  )
  VALUES (
    v_org_baloc_id, v_user2_id, 'BS. Stephen South (Tổng Quản Lý)', 'stephensouth1307@gmail.com', 'EMP_BALOC_02', true, 'Giám Đốc Y Khoa / Super Admin', NULL
  )
  ON CONFLICT DO NOTHING;

END $$;
