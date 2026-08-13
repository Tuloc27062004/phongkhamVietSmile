-- PHASE 9: role enum completion + admin role-management RPC
-- src/lib/permissions.ts defines 6 portal roles (administrator, manager,
-- receptionist, employee, doctor, patient) but public.app_role only had 4 —
-- 'doctor' and 'patient' could never actually be assigned to a real user.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'patient';

-- ============ ADMIN ROLE MANAGEMENT ============
-- user_roles only grants SELECT to authenticated (see phase 1 migration) —
-- role changes must go through this SECURITY DEFINER RPC so only an
-- administrator of the same org can reassign someone's role, and a user
-- always ends up with exactly one role row (replaces, not appends).

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
