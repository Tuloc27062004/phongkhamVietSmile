-- patient.profile.tsx hiển thị thẻ "Liên hệ khẩn cấp" nhưng patients chưa có cột nào lưu việc
-- này (khác với employees đã có sẵn emergency_contact_*) — thêm để dữ liệu thật thay vì luôn
-- hiện "Chưa cập nhật" không thể sửa được.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
