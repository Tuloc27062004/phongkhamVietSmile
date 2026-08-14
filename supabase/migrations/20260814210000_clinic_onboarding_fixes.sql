-- Sửa 3 lỗ hổng phát hiện khi kiểm tra luồng "Tạo phòng khám mới":
--
-- 1) organizations.is_default trỏ NHẦM vào phòng khám demo thật (Nha khoa Việt Smile) thay vì
--    org trung lập "Hệ Thống GZV Platform" — mọi tài khoản đăng ký mới trên toàn nền tảng bị tự
--    động thêm vào làm nhân viên của phòng khám demo thật. Đã sửa trực tiếp trong phiên làm việc
--    (UPDATE), migration này chỉ để đảm bảo trạng thái đúng khi build lại DB từ đầu.
--
-- 2) ensure_user_profile() không set approval_status/is_active khi tạo hồ sơ mới — dựa vào default
--    cột ('approved'/true), nên mọi người đăng ký sau người đầu tiên đều tự động "approved" ngay,
--    hàng chờ duyệt ở /system/users KHÔNG BAO GIỜ có ai cả dù giao diện + RPC duyệt đã đầy đủ.
--
-- 3) super_admin_create_clinic chỉ tạo organizations + clinic_profiles rỗng — không có phòng ban/
--    chức danh/ca làm việc/phòng khám nào, và KHÔNG có cách nào để một tài khoản thật đăng nhập
--    vào phòng khám mới đó (đăng ký mới luôn rơi vào org mặc định). "Tạo nhanh, setup hiệu quả" chỉ
--    đúng ở khâu tạo bản ghi org, không đúng ở khâu vận hành được ngay.

UPDATE public.organizations SET is_default = false WHERE code = 'VIETSMILE';
UPDATE public.organizations SET is_default = true WHERE code = 'GZV_PLATFORM';

-- Lời mời quản trị viên đầu tiên cho phòng khám mới — không cần gửi email thật (chưa có SMTP/kênh
-- gửi nào trong hệ thống), người được mời chỉ cần tự đăng ký bằng đúng email này là tự động vào
-- đúng phòng khám với vai trò administrator, bỏ qua hàng chờ duyệt (vì Super Admin đã đích thân mời).
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'administrator',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  UNIQUE (organization_id, email)
);
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
-- Không cấp policy cho authenticated/anon — chỉ SECURITY DEFINER function bên dưới được đụng tới.

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_role public.app_role;
  v_profile public.user_profiles;
  v_email text;
  v_name text;
  v_has_admin boolean;
  v_invite public.organization_invites%ROWTYPE;
  v_approval text;
  v_active boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_uid;
  IF FOUND THEN RETURN v_profile; END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email,'@',1))
    INTO v_email, v_name FROM auth.users WHERE id = v_uid;

  -- Lời mời còn hiệu lực khớp email -> vào thẳng đúng phòng khám đó, bỏ qua hàng chờ duyệt.
  SELECT * INTO v_invite FROM public.organization_invites
    WHERE lower(email) = lower(v_email) AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    v_org := v_invite.organization_id;
    v_role := v_invite.role;
    v_approval := 'approved';
    v_active := true;
  ELSE
    SELECT id INTO v_org FROM public.organizations WHERE is_default LIMIT 1;
    SELECT EXISTS(
      SELECT 1 FROM public.user_roles WHERE role = 'administrator' AND organization_id = v_org
    ) INTO v_has_admin;

    IF v_has_admin THEN
      -- Không phải người đầu tiên của org mặc định -> chờ quản trị viên duyệt + phân vai trò thật.
      v_role := 'employee';
      v_approval := 'pending';
      v_active := false;
    ELSE
      v_role := 'administrator';
      v_approval := 'approved';
      v_active := true;
    END IF;
  END IF;

  INSERT INTO public.user_profiles (id, organization_id, full_name, email, approval_status, is_active)
  VALUES (v_uid, v_org, COALESCE(v_name,''), v_email, v_approval, v_active)
  RETURNING * INTO v_profile;

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_uid, v_org, v_role)
  ON CONFLICT DO NOTHING;

  IF v_invite.id IS NOT NULL THEN
    UPDATE public.organization_invites SET used_at = now() WHERE id = v_invite.id;
  END IF;

  RETURN v_profile;
END;
$$;

-- Nạp dữ liệu vận hành tối thiểu cho phòng khám mới: phòng ban, chức danh, ca làm việc, 1 phòng
-- điều trị với đủ khung giờ cả tuần, và vài dịch vụ khởi điểm (dental có bộ dịch vụ riêng, các
-- chuyên khoa khác dùng bộ chung "Khám & tư vấn" — chưa có bộ riêng cho từng chuyên khoa, sẽ bổ
-- sung sau nếu cần).
CREATE OR REPLACE FUNCTION public.seed_clinic_baseline(p_org_id uuid, p_category text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dept_chuyenmon uuid;
  v_dept_hotro uuid;
  v_dept_letan uuid;
  v_dept_hanhchinh uuid;
  v_room_id uuid;
  v_weekday int;
BEGIN
  INSERT INTO public.departments (organization_id, name, code, display_order)
  VALUES (p_org_id, 'Chuyên môn', 'CM', 1) RETURNING id INTO v_dept_chuyenmon;
  INSERT INTO public.departments (organization_id, name, code, display_order)
  VALUES (p_org_id, 'Hỗ trợ điều trị', 'HT', 2) RETURNING id INTO v_dept_hotro;
  INSERT INTO public.departments (organization_id, name, code, display_order)
  VALUES (p_org_id, 'Lễ tân', 'LT', 3) RETURNING id INTO v_dept_letan;
  INSERT INTO public.departments (organization_id, name, code, display_order)
  VALUES (p_org_id, 'Hành chính', 'HC', 4) RETURNING id INTO v_dept_hanhchinh;

  INSERT INTO public.positions (organization_id, department_id, name, can_receive_appointments, display_order)
  VALUES
    (p_org_id, v_dept_chuyenmon, 'Bác sĩ điều trị', true, 1),
    (p_org_id, v_dept_hotro, 'Trợ thủ', false, 2),
    (p_org_id, v_dept_letan, 'Lễ tân', false, 3),
    (p_org_id, v_dept_hanhchinh, 'Quản lý phòng khám', false, 4),
    (p_org_id, v_dept_hanhchinh, 'Kế toán', false, 5);

  INSERT INTO public.shifts (organization_id, name, code, start_time, end_time, is_active)
  VALUES
    (p_org_id, 'Ca cả ngày', 'FULL', '08:00', '17:30', true),
    (p_org_id, 'Ca sáng', 'AM', '08:00', '12:00', true),
    (p_org_id, 'Ca chiều', 'PM', '13:30', '17:30', true);

  INSERT INTO public.treatment_rooms (organization_id, name, code, room_type, is_active, display_order)
  VALUES (p_org_id, 'Phòng 1', 'P1', 'general', true, 1)
  RETURNING id INTO v_room_id;

  FOREACH v_weekday IN ARRAY ARRAY[1,2,3,4,5,6]
  LOOP
    INSERT INTO public.room_time_slots (organization_id, room_id, weekday, start_time, end_time, slot_minutes)
    VALUES (p_org_id, v_room_id, v_weekday, '08:00', '17:30', 30);
  END LOOP;

  IF p_category = 'dental' THEN
    INSERT INTO public.services (organization_id, name, code, category, default_duration_minutes, can_reserve_slot, display_order)
    VALUES
      (p_org_id, 'Khám tổng quát & tư vấn', 'KTQ', 'kham', 30, true, 1),
      (p_org_id, 'Cạo vôi răng', 'CVR', 've_sinh', 45, true, 2),
      (p_org_id, 'Trám răng composite', 'TRC', 'dieu_tri', 45, true, 3),
      (p_org_id, 'Nhổ răng khôn', 'NRK', 'phau_thuat', 60, true, 4),
      (p_org_id, 'Tẩy trắng răng', 'TTR', 'tham_my', 90, true, 5);
  ELSE
    INSERT INTO public.services (organization_id, name, code, category, default_duration_minutes, can_reserve_slot, display_order)
    VALUES
      (p_org_id, 'Khám tổng quát & tư vấn', 'KTQ', 'kham', 30, true, 1),
      (p_org_id, 'Tái khám', 'TK', 'kham', 20, true, 2);
  END IF;
END;
$$;

-- CREATE OR REPLACE không thay thế được hàm cũ vì thêm tham số mới đổi chữ ký (signature) —
-- Postgres coi đây là overload khác, để lại cả 2 bản cùng tồn tại và làm PostgREST không biết
-- chọn bản nào khi gọi RPC. Phải DROP tường minh bản 4 tham số cũ trước.
DROP FUNCTION IF EXISTS public.super_admin_create_clinic(text, text, text, text);

CREATE OR REPLACE FUNCTION public.super_admin_create_clinic(
  p_name text,
  p_slug text,
  p_code text DEFAULT NULL::text,
  p_clinic_category text DEFAULT 'general'::text,
  p_admin_email text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  PERFORM public.seed_clinic_baseline(v_org_id, COALESCE(NULLIF(p_clinic_category, ''), 'general'));

  IF p_admin_email IS NOT NULL AND trim(p_admin_email) <> '' THEN
    INSERT INTO public.organization_invites (organization_id, email, role, invited_by)
    VALUES (v_org_id, trim(p_admin_email), 'administrator', v_uid)
    ON CONFLICT (organization_id, email) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_org_id, v_slug;
END;
$$;
