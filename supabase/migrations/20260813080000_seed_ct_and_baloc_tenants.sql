-- Migration: Seed Organization Multi-Tenancy Data
-- 1. Phòng Khám Nha Khoa CT (Khách hàng chính thức)
-- 2. Phòng Khám Bá Lộc (Hệ thống Test 100%)

DO $$
DECLARE
  v_org_ct_id UUID;
  v_org_baloc_id UUID;
BEGIN
  -- Insert/Get Organization Nha Khoa CT
  INSERT INTO public.organizations (name, code, is_active)
  VALUES ('Phòng Khám Nha Khoa CT', 'NHAKHOACT', true)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_org_ct_id;

  -- Insert/Get Organization Phòng Khám Bá Lộc (Test System)
  INSERT INTO public.organizations (name, code, is_active)
  VALUES ('Phòng Khám Bá Lộc (Test System)', 'BALOC_TEST', true)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_org_baloc_id;

  -- Seed máy chấm công MCC0001 cho Nha Khoa CT
  IF v_org_ct_id IS NOT NULL THEN
    INSERT INTO public.devices (
      organization_id,
      device_name,
      device_type,
      serial_number,
      location,
      ip_address,
      is_active,
      status
    )
    VALUES (
      v_org_ct_id,
      'Máy MCC0001 - Nha Khoa CT',
      'fingerprint',
      '8116243500205',
      'Sảnh Lễ Tân - Nha Khoa CT',
      '192.168.1.202',
      true,
      'online'
    )
    ON CONFLICT (organization_id, serial_number) 
    DO UPDATE SET 
      device_name = EXCLUDED.device_name,
      ip_address = EXCLUDED.ip_address,
      status = EXCLUDED.status;
  END IF;

  -- Seed máy chấm công thử nghiệm cho Phòng Khám Bá Lộc
  IF v_org_baloc_id IS NOT NULL THEN
    INSERT INTO public.devices (
      organization_id,
      device_name,
      device_type,
      serial_number,
      location,
      ip_address,
      is_active,
      status
    )
    VALUES (
      v_org_baloc_id,
      'Máy Test Vân Tay / FaceID - Bá Lộc',
      'face',
      'TEST_BALOC_9999',
      'Phòng Lab Test - Bá Lộc',
      '127.0.0.1',
      true,
      'online'
    )
    ON CONFLICT (organization_id, serial_number) 
    DO UPDATE SET 
      device_name = EXCLUDED.device_name,
      status = EXCLUDED.status;
  END IF;

END $$;
