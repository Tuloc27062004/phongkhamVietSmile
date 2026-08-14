-- Migration: Full demo dataset for "Nha khoa Việt Smile" (the one real tenant)
-- Employees, a realistic month of attendance (present/late/absent/overtime/early-leave mix),
-- attendance_summaries (nothing computes this automatically), overtime_records,
-- sample attendance_adjustments, salary_config, and an approved payroll cycle for the seeded month.
-- Idempotent: safe to re-run (relies on existing unique constraints / explicit guards).

DO $$
DECLARE
  v_org_id CONSTANT uuid := '11111111-1111-4111-8111-111111111111';
  v_dept_bs CONSTANT uuid := '22222222-0001-4111-8111-111111111111'; -- Bác sĩ
  v_dept_tt CONSTANT uuid := '22222222-0002-4111-8111-111111111111'; -- Trợ thủ nha khoa
  v_dept_lt CONSTANT uuid := '22222222-0003-4111-8111-111111111111'; -- Lễ tân
  v_dept_hc CONSTANT uuid := '22222222-0004-4111-8111-111111111111'; -- Hành chính
  v_pos_bs CONSTANT uuid := '33881080-d81d-4b21-ae23-e080c8a26c0a'; -- Bác sĩ điều trị
  v_pos_tt CONSTANT uuid := 'ffec0cc6-859c-4b8b-ab85-a608e3c60c08'; -- Trợ thủ
  v_pos_lt CONSTANT uuid := '5d38ec36-01f1-4b52-a8f6-625fbf818683'; -- Lễ tân
  v_pos_ql CONSTANT uuid := '0d03d85c-53da-468a-8eea-76af67422c7b'; -- Quản lý phòng khám
  v_pos_kt CONSTANT uuid := '3c696d12-fafd-4ce9-82ff-f610a0a89e35'; -- Kế toán
  v_shift_sang CONSTANT uuid := 'a6f70986-9fef-4e63-8a9a-325d6fa6c711'; -- Ca sáng 08:00-12:00
  v_shift_chieu CONSTANT uuid := 'ef4f0556-a2c4-4690-8b34-79601c04e12c'; -- Ca chiều 13:30-17:30
  v_shift_ngay CONSTANT uuid := '0b856347-737d-4908-b8b3-05d81f5b4d03'; -- Ca cả ngày 08:00-17:30
  v_period_start CONSTANT date := date_trunc('month', current_date)::date;
  v_period_end CONSTANT date := current_date - 1;
  emp RECORD;
  d date;
  v_emp_idx int := 0;
  v_day_idx int;
  v_pattern int;
  v_shift_start time;
  v_shift_end time;
  v_break_minutes int;
  v_shift_minutes int;
  v_late_minutes int;
  v_early_minutes int;
  v_ot_minutes int;
  v_status text;
  v_worked_minutes int;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_att_id uuid;
BEGIN
  -- 1. Assign phòng ban/chức danh/ca làm cho 3 nhân viên có sẵn
  UPDATE public.employees SET
    department_id = v_dept_bs, position_id = v_pos_bs, default_shift_id = v_shift_ngay,
    professional_title = 'Bác sĩ điều trị', can_receive_appointments = true,
    start_date = COALESCE(start_date, current_date - interval '2 years')
  WHERE organization_id = v_org_id AND employee_code = 'EMP001';

  UPDATE public.employees SET
    department_id = v_dept_tt, position_id = v_pos_tt, default_shift_id = v_shift_sang,
    start_date = COALESCE(start_date, current_date - interval '1 year')
  WHERE organization_id = v_org_id AND employee_code = 'EMP002';

  UPDATE public.employees SET
    department_id = v_dept_lt, position_id = v_pos_lt, default_shift_id = v_shift_ngay,
    start_date = COALESCE(start_date, current_date - interval '1 year')
  WHERE organization_id = v_org_id AND employee_code = 'EMP003';

  -- 2. Thêm 5 nhân viên nữa (đủ 8), rải đều phòng ban/chức danh/loại hợp đồng
  INSERT INTO public.employees (
    organization_id, employee_code, full_name, department_id, position_id, default_shift_id,
    employment_type, employment_status, professional_title, can_receive_appointments,
    device_user_id, start_date
  ) VALUES
    (v_org_id, 'EMP004', 'Phạm Minh Đức', v_dept_bs, v_pos_bs, v_shift_chieu, 'full_time', 'active', 'Bác sĩ điều trị', true, '1004', current_date - interval '8 months'),
    (v_org_id, 'EMP005', 'Hoàng Thị Mai', v_dept_tt, v_pos_tt, v_shift_chieu, 'full_time', 'active', NULL, false, '1005', current_date - interval '6 months'),
    (v_org_id, 'EMP006', 'Vũ Đình Nam', v_dept_hc, v_pos_ql, v_shift_ngay, 'full_time', 'active', NULL, false, '1006', current_date - interval '1 year'),
    (v_org_id, 'EMP007', 'Đặng Thu Hà', v_dept_hc, v_pos_kt, v_shift_sang, 'part_time', 'active', NULL, false, '1007', current_date - interval '3 months'),
    (v_org_id, 'EMP008', 'Bùi Văn Long', v_dept_lt, v_pos_lt, v_shift_sang, 'full_time', 'probation', NULL, false, '1008', current_date - interval '20 days')
  ON CONFLICT (organization_id, employee_code) DO NOTHING;

  -- 3. Sinh attendance_records cho tháng hiện tại, từ ngày 1 đến hôm qua (để hôm nay còn trống cho test check-in trực tiếp)
  FOR emp IN
    SELECT e.id, e.employee_code, e.default_shift_id, s.start_time, s.end_time
    FROM public.employees e
    LEFT JOIN public.shifts s ON s.id = e.default_shift_id
    WHERE e.organization_id = v_org_id AND e.deleted_at IS NULL
    ORDER BY e.employee_code
  LOOP
    v_emp_idx := v_emp_idx + 1;
    v_shift_start := COALESCE(emp.start_time, '08:00'::time);
    v_shift_end := COALESCE(emp.end_time, '17:30'::time);
    v_break_minutes := CASE WHEN emp.start_time = '08:00'::time AND emp.end_time = '17:30'::time THEN 90 ELSE 0 END;
    v_shift_minutes := EXTRACT(EPOCH FROM (v_shift_end - v_shift_start))::int / 60 - v_break_minutes;

    v_day_idx := 0;
    d := v_period_start;
    WHILE d <= v_period_end LOOP
      IF EXTRACT(DOW FROM d) <> 0 THEN -- bỏ Chủ Nhật
        v_day_idx := v_day_idx + 1;
        v_pattern := (v_day_idx + v_emp_idx) % 10;
        v_late_minutes := 0;
        v_early_minutes := 0;
        v_ot_minutes := 0;
        v_status := 'present';

        IF v_pattern = 0 THEN
          v_status := 'absent';
        ELSIF v_pattern IN (1, 2) THEN
          v_late_minutes := 18 + v_pattern * 8; -- 26 / 34 phút, luôn > 15
          v_status := 'late';
        ELSIF v_pattern = 3 THEN
          v_ot_minutes := 60 + (v_emp_idx % 3) * 30; -- 60/90/120 phút tăng ca
        ELSIF v_pattern = 8 THEN
          v_early_minutes := 15 + v_emp_idx * 3;
          v_status := 'early_leave';
        END IF;

        IF v_status = 'absent' THEN
          v_check_in := NULL;
          v_check_out := NULL;
          v_worked_minutes := 0;
        ELSE
          v_check_in := (d + v_shift_start + (v_late_minutes || ' minutes')::interval)::timestamptz;
          v_check_out := (d + v_shift_end - (v_early_minutes || ' minutes')::interval + (v_ot_minutes || ' minutes')::interval)::timestamptz;
          v_worked_minutes := GREATEST(v_shift_minutes - v_late_minutes - v_early_minutes, 0);
        END IF;

        INSERT INTO public.attendance_records (
          organization_id, employee_id, work_date, shift_id,
          check_in_time, check_out_time, device_check_in_time, device_check_out_time,
          late_minutes, early_leave_minutes, overtime_minutes, paid_break_minutes, worked_minutes,
          attendance_status, is_approved
        ) VALUES (
          v_org_id, emp.id, d, emp.default_shift_id,
          v_check_in, v_check_out, v_check_in, v_check_out,
          v_late_minutes, v_early_minutes, v_ot_minutes, v_break_minutes, v_worked_minutes,
          v_status, true
        )
        ON CONFLICT (organization_id, employee_id, work_date) DO NOTHING
        RETURNING id INTO v_att_id;

        IF v_ot_minutes > 0 AND v_att_id IS NOT NULL THEN
          INSERT INTO public.overtime_records (
            organization_id, employee_id, overtime_date, duration_hours, rate_multiplier, status, reason
          ) VALUES (
            v_org_id, emp.id, d, round(v_ot_minutes / 60.0, 2), 1.5,
            CASE WHEN v_day_idx % 3 = 0 THEN 'paid' WHEN v_day_idx % 3 = 1 THEN 'approved' ELSE 'pending' END,
            'Tăng ca hỗ trợ ca đông bệnh nhân'
          );
        END IF;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  -- 4. Tổng hợp attendance_summaries (bảng này không có gì tự tính)
  INSERT INTO public.attendance_summaries (
    organization_id, employee_id, full_name, employee_code, date,
    total_days, present_days, absent_days, late_days, early_leave_days, overtime_hours
  )
  SELECT
    v_org_id, e.id, e.full_name, e.employee_code, v_period_end,
    count(ar.*),
    count(ar.*) FILTER (WHERE ar.attendance_status IN ('present', 'late', 'early_leave')),
    count(ar.*) FILTER (WHERE ar.attendance_status = 'absent'),
    count(ar.*) FILTER (WHERE ar.attendance_status = 'late'),
    count(ar.*) FILTER (WHERE ar.attendance_status = 'early_leave'),
    COALESCE(SUM(ar.overtime_minutes), 0) / 60.0
  FROM public.employees e
  JOIN public.attendance_records ar
    ON ar.employee_id = e.id AND ar.work_date BETWEEN v_period_start AND v_period_end
  WHERE e.organization_id = v_org_id
  GROUP BY e.id, e.full_name, e.employee_code
  ON CONFLICT (employee_id, date) DO UPDATE SET
    total_days = EXCLUDED.total_days,
    present_days = EXCLUDED.present_days,
    absent_days = EXCLUDED.absent_days,
    late_days = EXCLUDED.late_days,
    early_leave_days = EXCLUDED.early_leave_days,
    overtime_hours = EXCLUDED.overtime_hours;

  -- 5. Vài case điều chỉnh công mẫu (minh hoạ luồng duyệt) — chỉ chạy nếu chưa có
  IF NOT EXISTS (SELECT 1 FROM public.attendance_adjustments WHERE organization_id = v_org_id) THEN
    INSERT INTO public.attendance_adjustments (organization_id, employee_id, attendance_id, adjustment_type, reason, adjusted_value, status)
    SELECT v_org_id, ar.employee_id, ar.id, 'time_correction',
           'Nhân viên xin điều chỉnh giờ vào do kẹt xe, có xác nhận camera an ninh', '08:05', 'pending'
    FROM public.attendance_records ar
    WHERE ar.organization_id = v_org_id AND ar.attendance_status = 'late'
    ORDER BY ar.work_date, ar.employee_id
    LIMIT 1;

    INSERT INTO public.attendance_adjustments (organization_id, employee_id, attendance_id, adjustment_type, reason, adjusted_value, status)
    SELECT v_org_id, ar.employee_id, ar.id, 'status_change',
           'Nghỉ có phép do việc gia đình đột xuất, đã bổ sung đơn xin nghỉ', 'leave', 'approved'
    FROM public.attendance_records ar
    WHERE ar.organization_id = v_org_id AND ar.attendance_status = 'absent'
    ORDER BY ar.work_date, ar.employee_id
    LIMIT 1;

    INSERT INTO public.attendance_adjustments (organization_id, employee_id, attendance_id, adjustment_type, reason, adjusted_value, status)
    SELECT v_org_id, ar.employee_id, ar.id, 'time_correction',
           'Máy chấm công lỗi tạm thời, nhân viên báo lễ tân xác nhận giờ ra thực tế', '17:30', 'approved'
    FROM public.attendance_records ar
    WHERE ar.organization_id = v_org_id AND ar.attendance_status = 'early_leave'
    ORDER BY ar.work_date, ar.employee_id
    LIMIT 1;
  END IF;

  -- 6. Cấu hình lương theo chức danh
  INSERT INTO public.salary_config (organization_id, employee_id, base_salary, allowance, bonus, late_deduction, absence_deduction, insurance_deduction)
  SELECT
    v_org_id, e.id,
    CASE p.name
      WHEN 'Bác sĩ điều trị' THEN 25000000
      WHEN 'Quản lý phòng khám' THEN 18000000
      WHEN 'Kế toán' THEN 12000000
      WHEN 'Trợ thủ' THEN 9000000
      WHEN 'Lễ tân' THEN 8000000
      ELSE 10000000
    END,
    800000, 0, 0, 0, 0
  FROM public.employees e
  LEFT JOIN public.positions p ON p.id = e.position_id
  WHERE e.organization_id = v_org_id
  ON CONFLICT (employee_id) DO NOTHING;

  -- 7. Bảng lương đã duyệt cho tháng đã seed — khớp đúng công thức tính lương hiện tại của /hr/payroll
  INSERT INTO public.payroll_records (
    organization_id, employee_id, month, year, worked_days, late_days, absent_days,
    base_salary, late_deduction, absence_deduction, insurance, net_salary, status, approved_at
  )
  SELECT
    v_org_id, e.id,
    EXTRACT(MONTH FROM v_period_start)::int, EXTRACT(YEAR FROM v_period_start)::int,
    count(ar.*) FILTER (WHERE ar.attendance_status <> 'absent'),
    count(ar.*) FILTER (WHERE ar.attendance_status = 'late' AND ar.late_minutes > 15),
    count(ar.*) FILTER (WHERE ar.attendance_status = 'absent'),
    sc.base_salary,
    COALESCE(SUM(CASE WHEN ar.attendance_status = 'late' AND ar.late_minutes > 15
                       THEN (sc.base_salary / 26.0 / 8 / 60) * ar.late_minutes ELSE 0 END), 0),
    count(ar.*) FILTER (WHERE ar.attendance_status = 'absent') * (sc.base_salary / 26.0),
    sc.base_salary * 0.10,
    sc.base_salary
      - COALESCE(SUM(CASE WHEN ar.attendance_status = 'late' AND ar.late_minutes > 15
                           THEN (sc.base_salary / 26.0 / 8 / 60) * ar.late_minutes ELSE 0 END), 0)
      - count(ar.*) FILTER (WHERE ar.attendance_status = 'absent') * (sc.base_salary / 26.0)
      - sc.base_salary * 0.10,
    'approved', now()
  FROM public.employees e
  JOIN public.salary_config sc ON sc.employee_id = e.id
  JOIN public.attendance_records ar
    ON ar.employee_id = e.id AND ar.work_date BETWEEN v_period_start AND v_period_end
  WHERE e.organization_id = v_org_id
  GROUP BY e.id, sc.base_salary
  ON CONFLICT (employee_id, month, year) DO NOTHING;

END $$;
