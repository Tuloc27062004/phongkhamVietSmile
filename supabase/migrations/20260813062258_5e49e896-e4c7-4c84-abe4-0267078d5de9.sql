CREATE TABLE public.treatment_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  room_type text NOT NULL DEFAULT 'general',
  equipment text,
  capacity integer NOT NULL DEFAULT 1,
  description text,
  color text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_rooms TO authenticated;
GRANT ALL ON public.treatment_rooms TO service_role;
ALTER TABLE public.treatment_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select_org" ON public.treatment_rooms
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "rooms_write_managers" ON public.treatment_rooms
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.treatment_rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.room_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.treatment_rooms(id) ON DELETE CASCADE,
  weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_minutes integer NOT NULL DEFAULT 30,
  max_parallel integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_time_slots TO authenticated;
GRANT ALL ON public.room_time_slots TO service_role;
ALTER TABLE public.room_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_slots_select_org" ON public.room_time_slots
  FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "room_slots_write_managers" ON public.room_time_slots
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_staff_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_staff_manager());

CREATE TRIGGER trg_room_slots_updated BEFORE UPDATE ON public.room_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments
  ADD COLUMN room_id uuid REFERENCES public.treatment_rooms(id) ON DELETE SET NULL;

CREATE INDEX idx_appointments_room_date ON public.appointments(room_id, appointment_date);

INSERT INTO public.treatment_rooms (organization_id, name, code, room_type, equipment, display_order, color)
SELECT o.id, r.name, r.code, r.room_type, r.equipment, r.ord, r.color
FROM public.organizations o
CROSS JOIN (VALUES
  ('Phòng 1 - Tổng quát', 'P1', 'general', 'Ghế nha khoa, đèn LED', 1, 'sky'),
  ('Phòng 2 - Tổng quát', 'P2', 'general', 'Ghế nha khoa, máy cạo vôi', 2, 'emerald'),
  ('Phòng 3 - Tiểu phẫu', 'P3', 'surgery', 'Ghế phẫu thuật, máy X-quang', 3, 'amber'),
  ('Phòng 4 - Chỉnh nha', 'P4', 'ortho', 'Ghế nha khoa, máy scan 3D', 4, 'violet')
) AS r(name, code, room_type, equipment, ord, color)
WHERE o.is_default;

INSERT INTO public.room_time_slots (organization_id, room_id, weekday, start_time, end_time, slot_minutes, max_parallel)
SELECT tr.organization_id, tr.id, d.weekday, '08:00'::time, '17:30'::time, 30, 1
FROM public.treatment_rooms tr
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) AS d(weekday);