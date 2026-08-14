-- Kho lưu trữ logo/favicon/ảnh bìa phòng khám + khóa cứng việc đổi tên phòng khám
-- (tên ảnh hưởng slug/định danh toàn hệ thống) — chỉ Quản trị viên nền tảng GZV
-- (is_super_admin()) mới được đổi, dù UI có bị qua mặt cũng bị chặn ở DB.

insert into storage.buckets (id, name, public)
values ('clinic-assets', 'clinic-assets', true)
on conflict (id) do nothing;

drop policy if exists "clinic assets public read" on storage.objects;
create policy "clinic assets public read"
  on storage.objects for select
  to public
  using (bucket_id = 'clinic-assets');

drop policy if exists "clinic assets staff insert" on storage.objects;
create policy "clinic assets staff insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'clinic-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_staff_manager()
  );

drop policy if exists "clinic assets staff update" on storage.objects;
create policy "clinic assets staff update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'clinic-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_staff_manager()
  )
  with check (
    bucket_id = 'clinic-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_staff_manager()
  );

drop policy if exists "clinic assets staff delete" on storage.objects;
create policy "clinic assets staff delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'clinic-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
    and public.is_staff_manager()
  );

-- Chặn đổi clinic_profiles.name trừ khi người thực hiện là Quản trị viên nền tảng GZV.
create or replace function public.guard_clinic_profile_name()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE' and new.name is distinct from old.name and not public.is_super_admin() then
    raise exception 'Chỉ Quản trị viên nền tảng GZV mới được đổi tên phòng khám (ảnh hưởng đến đường dẫn truy cập toàn hệ thống).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_clinic_profile_name on public.clinic_profiles;
create trigger trg_guard_clinic_profile_name
  before update on public.clinic_profiles
  for each row
  execute function public.guard_clinic_profile_name();
