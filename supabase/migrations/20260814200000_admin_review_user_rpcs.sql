-- system.users.tsx đã gọi 2 RPC không hề tồn tại trong DB: admin_review_user (duyệt/từ chối tài
-- khoản mới) và admin_set_user_active (khóa/mở khóa tài khoản). Vì user_profiles không có policy
-- UPDATE nào cho phép quản trị viên sửa hồ sơ người khác (chỉ "update own profile" cho chính chủ),
-- toàn bộ luồng duyệt tài khoản mới trước đây không thể hoạt động được — bấm "Duyệt"/"Khóa" chỉ
-- ra lỗi "function does not exist". Thêm 2 RPC còn thiếu, theo đúng khuôn mẫu admin_set_user_role
-- đã có sẵn (SECURITY DEFINER, tự kiểm tra role administrator + cùng tổ chức).

CREATE OR REPLACE FUNCTION public.admin_review_user(
  target_user_id uuid,
  decision text,
  new_role app_role DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.current_org_id();
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrator') THEN
    RAISE EXCEPTION 'Chỉ quản trị viên mới được duyệt tài khoản';
  END IF;

  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Quyết định không hợp lệ: %', decision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = target_user_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'Người dùng không thuộc phòng khám này';
  END IF;

  UPDATE public.user_profiles
  SET approval_status = decision,
      approved_at = now(),
      approved_by = auth.uid(),
      is_active = (decision = 'approved')
  WHERE id = target_user_id;

  IF decision = 'approved' AND new_role IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND organization_id = v_org;
    INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (target_user_id, v_org, new_role);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_active(
  target_user_id uuid,
  active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.current_org_id();
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrator') THEN
    RAISE EXCEPTION 'Chỉ quản trị viên mới được khóa/mở khóa tài khoản';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Không thể tự khóa tài khoản của chính mình';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = target_user_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'Người dùng không thuộc phòng khám này';
  END IF;

  UPDATE public.user_profiles SET is_active = active WHERE id = target_user_id;
END;
$$;
