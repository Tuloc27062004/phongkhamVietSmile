-- Migration: Seed Clinic Profiles for GZV Platform Hub and Nha Khoa CT

DO $$
DECLARE
  v_org_ct_id UUID;
  v_org_gzv_id UUID;
BEGIN
  -- 1. Get/Insert Organization Nha Khoa CT & Seed Clinic Profile
  SELECT id INTO v_org_ct_id FROM public.organizations WHERE code = 'NHAKHOACT';

  IF v_org_ct_id IS NOT NULL THEN
    INSERT INTO public.clinic_profiles (
      organization_id, name, short_name, legal_name, address, city, phone, email, description, footer_info
    )
    VALUES (
      v_org_ct_id,
      'Phòng Khám Nha Khoa CT',
      'Nha Khoa CT',
      'Công ty TNHH Nha Khoa CT',
      'Địa chỉ Chi Nhánh Nha Khoa CT',
      'TP. Hồ Chí Minh',
      '0901234567',
      'lienhe@nhakhoact.vn',
      'Phòng khám chuyên khoa Nha Khoa CT chất lượng cao.',
      '© 2026 Phòng Khám Nha Khoa CT — GZV Clinic Platform Powered'
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      name = EXCLUDED.name,
      short_name = EXCLUDED.short_name,
      legal_name = EXCLUDED.legal_name,
      email = EXCLUDED.email,
      footer_info = EXCLUDED.footer_info;
  END IF;

  -- 2. Get/Insert Organization GZV Platform & Seed Clinic Profile
  SELECT id INTO v_org_gzv_id FROM public.organizations WHERE code = 'GZV_PLATFORM';

  IF v_org_gzv_id IS NOT NULL THEN
    INSERT INTO public.clinic_profiles (
      organization_id, name, short_name, legal_name, address, city, phone, email, description, footer_info
    )
    VALUES (
      v_org_gzv_id,
      'Hệ Thống GZV Platform (Central Hub)',
      'GZV Platform',
      'Công Ty TNHH GZV Platform',
      'Trung Tâm Điều Hành GZV Platform',
      'TP. Hồ Chí Minh',
      '1900 1234',
      'support@gzv.vn',
      'Nền tảng Quản trị Y tế & Chấm công Đa phòng khám GZV.',
      '© 2026 GZV Clinic Platform — Nền Tảng Quản Trị Y Tế Đa Phòng Khám'
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      name = EXCLUDED.name,
      short_name = EXCLUDED.short_name,
      legal_name = EXCLUDED.legal_name,
      email = EXCLUDED.email,
      footer_info = EXCLUDED.footer_info;
  END IF;

END $$;
