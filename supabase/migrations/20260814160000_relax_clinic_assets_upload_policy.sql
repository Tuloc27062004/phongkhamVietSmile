-- Ảnh bệnh nhân được lễ tân (role receptionist) tải lên, nhưng bucket clinic-assets trước đó
-- chỉ cho phép is_staff_manager() (administrator/manager) insert/update — khiến lễ tân sửa được
-- hồ sơ bệnh nhân (patients RLS mở cho mọi nhân viên trong tổ chức) nhưng không tải ảnh lên được.
-- Nới insert/update theo đúng mức của patients (mọi nhân viên trong tổ chức); giữ delete cho
-- staff_manager vì xóa file là hành động phá hủy hơn.

drop policy if exists "clinic assets staff insert" on storage.objects;
create policy "clinic assets org insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'clinic-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists "clinic assets staff update" on storage.objects;
create policy "clinic assets org update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'clinic-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  )
  with check (
    bucket_id = 'clinic-assets'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
