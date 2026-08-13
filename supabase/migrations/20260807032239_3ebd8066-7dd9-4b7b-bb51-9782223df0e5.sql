CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_user_id uuid, new_role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid := public.current_org_id();
BEGIN
  IF NOT public.has_role(auth.uid(), 'administrator') THEN
    RAISE EXCEPTION 'Chỉ quản trị viên mới được đổi vai trò người dùng';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = target_user_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'Người dùng không thuộc phòng khám này';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = target_user_id AND organization_id = v_org;
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (target_user_id, v_org, new_role);
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) TO authenticated;