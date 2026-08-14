-- Fix: treatment_rooms thiếu cột deleted_at dù code (rooms.tsx, appointments.calendar.tsx)
-- đã dùng .is("deleted_at", null) và soft-delete từ trước -> gây lỗi 400 Bad Request
-- (PostgREST không tìm thấy cột) khi tải trang /rooms và /appointments/calendar.

ALTER TABLE public.treatment_rooms
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
