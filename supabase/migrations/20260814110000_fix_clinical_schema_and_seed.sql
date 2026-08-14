-- Migration: Fix real bugs found while testing the clinical/booking modules for Việt Smile:
--   1. treatment_rooms has NO organization_id column and only a permissive "read: true" RLS
--      policy with zero write policies — rooms.tsx's "Thêm phòng" (create room) silently fails
--      (RLS denies the INSERT) and the table isn't actually tenant-isolated.
--   2. room_time_slots table referenced by rooms.tsx and appointments.calendar.tsx does not
--      exist at all — calendar page errors out entirely ("chẳng test được gì cả").
--   3. appointments has no room_id column, but appointments.calendar.tsx/booking.tsx both
--      select/insert it — booking a new appointment always fails.
--   4. No demo data exists at all for treatment_rooms/room_time_slots/services/patients/
--      appointments — every clinical page renders empty even once the bugs above are fixed.
-- (patients.tsx's separate `insurance_id` vs real `insurance_number` column bug is fixed in
--  the frontend code, not here.)

-- 1. Fix treatment_rooms: add tenant column, replace the global-read policy with real RLS.
ALTER TABLE public.treatment_rooms
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.treatment_rooms SET organization_id = '11111111-1111-4111-8111-111111111111'
WHERE organization_id IS NULL;

ALTER TABLE public.treatment_rooms
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN organization_id SET DEFAULT current_org_id();

DROP POLICY IF EXISTS "Allow authenticated users to read treatment_rooms" ON public.treatment_rooms;
DROP POLICY IF EXISTS "treatment_rooms read" ON public.treatment_rooms;
DROP POLICY IF EXISTS "treatment_rooms write" ON public.treatment_rooms;

CREATE POLICY "treatment_rooms read" ON public.treatment_rooms FOR SELECT
  TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "treatment_rooms write" ON public.treatment_rooms
  TO authenticated
  USING (organization_id = current_org_id() AND is_staff_manager())
  WITH CHECK (organization_id = current_org_id() AND is_staff_manager());

-- 2. Create room_time_slots (rooms.tsx + appointments.calendar.tsx already assume this exists)
CREATE TABLE IF NOT EXISTS public.room_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.treatment_rooms(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_time_slots_room ON public.room_time_slots (room_id, weekday);

ALTER TABLE public.room_time_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "room_time_slots read" ON public.room_time_slots;
DROP POLICY IF EXISTS "room_time_slots write" ON public.room_time_slots;
CREATE POLICY "room_time_slots read" ON public.room_time_slots FOR SELECT
  TO authenticated USING (organization_id = current_org_id());
CREATE POLICY "room_time_slots write" ON public.room_time_slots
  TO authenticated
  USING (organization_id = current_org_id() AND is_staff_manager())
  WITH CHECK (organization_id = current_org_id() AND is_staff_manager());

CREATE TRIGGER trg_room_time_slots_updated BEFORE UPDATE ON public.room_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. appointments needs room_id (calendar/booking pages already select/insert it)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.treatment_rooms(id) ON DELETE SET NULL;

-- 4. Seed demo data for Việt Smile
DO $$
DECLARE
  v_org_id CONSTANT uuid := '11111111-1111-4111-8111-111111111111';
  v_room1 uuid;
  v_room2 uuid;
  v_room3 uuid;
  v_svc_kham uuid;
  v_svc_cao_voi uuid;
  v_svc_tram uuid;
  v_svc_nho_rang uuid;
  v_svc_tay_trang uuid;
  v_svc_nieng uuid;
  v_doc1 uuid; -- EMP001
  v_doc2 uuid; -- EMP004
  v_pat record;
  v_patient_ids uuid[] := ARRAY[]::uuid[];
  v_pid uuid;
  d date;
  i int;
BEGIN
  SELECT id INTO v_doc1 FROM public.employees WHERE organization_id = v_org_id AND employee_code = 'EMP001';
  SELECT id INTO v_doc2 FROM public.employees WHERE organization_id = v_org_id AND employee_code = 'EMP004';

  -- Phòng điều trị
  INSERT INTO public.treatment_rooms (organization_id, name, code, room_type, capacity, equipment, is_active, display_order)
  VALUES
    (v_org_id, 'Phòng 1 - Tổng quát', 'P1', 'general', 1, ARRAY['Ghế nha khoa', 'Đèn trám composite'], true, 1)
  RETURNING id INTO v_room1;

  INSERT INTO public.treatment_rooms (organization_id, name, code, room_type, capacity, equipment, is_active, display_order)
  VALUES
    (v_org_id, 'Phòng 2 - Chỉnh nha', 'P2', 'orthodontics', 1, ARRAY['Ghế nha khoa', 'Máy scan 3D'], true, 2)
  RETURNING id INTO v_room2;

  INSERT INTO public.treatment_rooms (organization_id, name, code, room_type, capacity, equipment, is_active, display_order)
  VALUES
    (v_org_id, 'Phòng 3 - Implant/Phẫu thuật', 'P3', 'surgery', 1, ARRAY['Ghế nha khoa', 'Máy X-quang', 'Máy tiệt trùng'], true, 3)
  RETURNING id INTO v_room3;

  -- Khung giờ nhận hẹn: Thứ 2 - Thứ 7 (bỏ Chủ Nhật), 08:00-17:30, slot 30 phút, mỗi phòng
  FOR i IN 1..6 LOOP
    INSERT INTO public.room_time_slots (organization_id, room_id, weekday, start_time, end_time, slot_minutes)
    VALUES
      (v_org_id, v_room1, i, '08:00', '17:30', 30),
      (v_org_id, v_room2, i, '08:00', '17:30', 30),
      (v_org_id, v_room3, i, '08:00', '17:30', 30);
  END LOOP;

  -- Dịch vụ
  INSERT INTO public.services (organization_id, name, code, category, default_duration_minutes, requires_professional, display_order)
  VALUES (v_org_id, 'Khám tổng quát & tư vấn', 'KHAM01', 'kham', 30, true, 1) RETURNING id INTO v_svc_kham;
  INSERT INTO public.services (organization_id, name, code, category, default_duration_minutes, requires_professional, display_order)
  VALUES (v_org_id, 'Cạo vôi răng', 'VS01', 've_sinh', 45, true, 2) RETURNING id INTO v_svc_cao_voi;
  INSERT INTO public.services (organization_id, name, code, category, default_duration_minutes, requires_professional, display_order)
  VALUES (v_org_id, 'Trám răng composite', 'TR01', 'dieu_tri', 45, true, 3) RETURNING id INTO v_svc_tram;
  INSERT INTO public.services (organization_id, name, code, category, default_duration_minutes, requires_professional, display_order)
  VALUES (v_org_id, 'Nhổ răng khôn', 'NR01', 'phau_thuat', 60, true, 4) RETURNING id INTO v_svc_nho_rang;
  INSERT INTO public.services (organization_id, name, code, category, default_duration_minutes, requires_professional, display_order)
  VALUES (v_org_id, 'Tẩy trắng răng', 'TT01', 'tham_my', 90, true, 5) RETURNING id INTO v_svc_tay_trang;
  INSERT INTO public.services (organization_id, name, code, category, default_duration_minutes, requires_professional, display_order)
  VALUES (v_org_id, 'Niềng răng - tư vấn & lấy dấu', 'NIENG01', 'chinh_nha', 45, true, 6) RETURNING id INTO v_svc_nieng;

  -- Bệnh nhân mẫu
  FOR v_pat IN
    SELECT * FROM (VALUES
      ('BN0001', 'Trần Thị Hồng', '0901111001', 'hong.tran@example.com', DATE '1990-03-12', 'female', '12 Nguyễn Trãi, Q1, TP.HCM', 'BH0011223301'),
      ('BN0002', 'Lê Văn Minh', '0901111002', 'minh.le@example.com', DATE '1985-07-22', 'male', '45 Lê Lợi, Q1, TP.HCM', 'BH0011223302'),
      ('BN0003', 'Phạm Thị Lan', '0901111003', 'lan.pham@example.com', DATE '1998-11-05', 'female', '78 Cách Mạng Tháng 8, Q3, TP.HCM', NULL),
      ('BN0004', 'Nguyễn Hoàng Phúc', '0901111004', 'phuc.nguyen@example.com', DATE '1978-01-30', 'male', '23 Điện Biên Phủ, Bình Thạnh, TP.HCM', 'BH0011223304'),
      ('BN0005', 'Vũ Thị Mai Anh', '0901111005', 'maianh.vu@example.com', DATE '2001-09-14', 'female', '9 Phan Xích Long, Phú Nhuận, TP.HCM', NULL),
      ('BN0006', 'Đặng Quốc Bảo', '0901111006', 'bao.dang@example.com', DATE '1993-05-02', 'male', '156 Nguyễn Văn Cừ, Q5, TP.HCM', 'BH0011223306'),
      ('BN0007', 'Bùi Thị Thu Hà', '0901111007', 'ha.bui@example.com', DATE '1988-12-19', 'female', '34 Trường Chinh, Tân Bình, TP.HCM', NULL),
      ('BN0008', 'Hồ Văn Tâm', '0901111008', 'tam.ho@example.com', DATE '1975-06-08', 'male', '67 Lý Thường Kiệt, Q10, TP.HCM', 'BH0011223308'),
      ('BN0009', 'Ngô Thị Kim Ngân', '0901111009', 'ngan.ngo@example.com', DATE '2005-02-27', 'female', '19 Hoàng Văn Thụ, Tân Bình, TP.HCM', NULL),
      ('BN0010', 'Trịnh Đức Anh', '0901111010', 'ducanh.trinh@example.com', DATE '1996-10-11', 'male', '5 Võ Văn Tần, Q3, TP.HCM', NULL)
    ) AS t(patient_code, full_name, phone, email, date_of_birth, gender, address, insurance_number)
  LOOP
    INSERT INTO public.patients (
      organization_id, patient_code, full_name, phone, email, date_of_birth, gender, address, insurance_number, is_active
    ) VALUES (
      v_org_id, v_pat.patient_code, v_pat.full_name, v_pat.phone, v_pat.email, v_pat.date_of_birth, v_pat.gender, v_pat.address, v_pat.insurance_number, true
    )
    ON CONFLICT (organization_id, patient_code) DO NOTHING
    RETURNING id INTO v_pid;

    IF v_pid IS NOT NULL THEN
      v_patient_ids := array_append(v_patient_ids, v_pid);
    END IF;
  END LOOP;

  -- Lịch hẹn rải trong tuần hiện tại (hôm qua -> 4 ngày tới), trộn trạng thái
  IF array_length(v_patient_ids, 1) IS NOT NULL THEN
    FOR i IN 0..array_length(v_patient_ids, 1) - 1 LOOP
      d := current_date + ((i % 6) - 1); -- trải từ hôm qua tới +4 ngày
      IF extract(dow from d) <> 0 THEN -- bỏ Chủ Nhật
        INSERT INTO public.appointments (
          organization_id, patient_id, assigned_dentist_id, service_id, room_id,
          appointment_date, start_time, end_time, duration_minutes, status, confirmation_status, notes
        ) VALUES (
          v_org_id,
          v_patient_ids[i + 1],
          CASE WHEN i % 2 = 0 THEN v_doc1 ELSE v_doc2 END,
          (ARRAY[v_svc_kham, v_svc_cao_voi, v_svc_tram, v_svc_nho_rang, v_svc_tay_trang, v_svc_nieng])[(i % 6) + 1],
          (ARRAY[v_room1, v_room2, v_room3])[(i % 3) + 1],
          d,
          (TIME '08:30' + ((i % 8) * interval '30 min'))::time,
          (TIME '09:00' + ((i % 8) * interval '30 min'))::time,
          30,
          CASE
            WHEN d < current_date THEN 'completed'
            WHEN i % 4 = 0 THEN 'cancelled'
            WHEN i % 3 = 0 THEN 'confirmed'
            ELSE 'scheduled'
          END,
          CASE WHEN i % 3 = 0 THEN 'confirmed' ELSE 'unconfirmed' END,
          'Lịch hẹn demo'
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;
