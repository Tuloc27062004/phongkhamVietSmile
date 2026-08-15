// Bộ tính toán chấm công theo ca làm việc — dùng chung cho mọi nguồn ghi nhận chấm công
// (máy vân tay/Agent, tự chấm công, chấm công thủ công). Module thuần tính toán, không I/O,
// dùng được cả ở client lẫn server. Giờ ca làm việc (shifts.start_time/end_time) là giờ địa
// phương Việt Nam — quy đổi cố định +07:00 (Việt Nam không có giờ mùa hè nên an toàn).

export type ShiftWindow = {
  startTime: string; // "HH:MM:SS" hoặc "HH:MM"
  endTime: string;
  gracePeriodMinutes: number;
  lateThresholdMinutes: number;
  earlyLeaveThresholdMinutes: number;
  crossesMidnight: boolean;
};

export type WorkedAttendanceStatus = "present" | "late" | "early_leave" | "half_day";

export type ComputedAttendance = {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number | null;
  status: WorkedAttendanceStatus;
};

function shiftBoundaryIso(workDate: string, time: string, addDays = 0): string {
  const hhmmss = time.length === 5 ? `${time}:00` : time;
  if (addDays === 0) return `${workDate}T${hhmmss}+07:00`;
  const date = new Date(`${workDate}T00:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() + addDays);
  const shiftedDate = date.toISOString().split("T")[0];
  return `${shiftedDate}T${hhmmss}+07:00`;
}

/**
 * Tính số phút đi trễ/về sớm/tổng giờ làm dựa trên giờ vào/ra thực tế so với ca làm việc
 * được gán cho nhân viên. Trả về status "present"/"late"/"early_leave"/"half_day" — KHÔNG xử
 * lý "absent"/"leave"/"sick"/"holiday" (những trạng thái đó là lựa chọn thủ công, không suy ra
 * từ giờ vào/ra).
 */
export function computeAttendanceFromShift(params: {
  workDate: string;
  checkInIso: string | null;
  checkOutIso: string | null;
  shift: ShiftWindow | null;
}): ComputedAttendance {
  const { workDate, checkInIso, checkOutIso, shift } = params;

  const workedMinutes =
    checkInIso && checkOutIso
      ? Math.max(0, Math.round((Date.parse(checkOutIso) - Date.parse(checkInIso)) / 60000))
      : null;

  if (!shift || !checkInIso) {
    return { lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes, status: "present" };
  }

  const shiftStartMs = Date.parse(shiftBoundaryIso(workDate, shift.startTime));
  const shiftEndMs = Date.parse(shiftBoundaryIso(workDate, shift.endTime, shift.crossesMidnight ? 1 : 0));

  const graceMs = shift.gracePeriodMinutes * 60000;
  const checkInMs = Date.parse(checkInIso);
  const lateMinutes = Math.max(0, Math.round((checkInMs - shiftStartMs - graceMs) / 60000));

  let earlyLeaveMinutes = 0;
  if (checkOutIso) {
    const checkOutMs = Date.parse(checkOutIso);
    earlyLeaveMinutes = Math.max(0, Math.round((shiftEndMs - checkOutMs) / 60000));
  }

  let status: WorkedAttendanceStatus = "present";
  if (lateMinutes > shift.lateThresholdMinutes) {
    status = "late";
  } else if (checkOutIso && earlyLeaveMinutes > shift.earlyLeaveThresholdMinutes) {
    status = "early_leave";
  }

  return { lateMinutes, earlyLeaveMinutes, workedMinutes, status };
}

/** Định dạng "08:00–17:30" từ một ca làm việc để hiển thị cho người dùng. */
export function formatShiftWindow(shift: { start_time: string; end_time: string } | null): string {
  if (!shift) return "Chưa gán ca";
  return `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`;
}
