import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Edit,
  Filter,
  Fingerprint,
  LogIn,
  LogOut,
  Loader,
  Plus,
  Radio,
  ScanFace,
  Search,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-session";
import { hasAnyRole, type AppRole } from "@/lib/permissions";
import { computeAttendanceFromShift, formatShiftWindow, type ShiftWindow } from "@/lib/shift-attendance";

export const Route = createFileRoute("/_authenticated/$clinicSlug/attendance/checkin")({
  head: () => ({
    meta: [
      { title: "Chấm công — GZV Clinic Platform" },
      {
        name: "description",
        content:
          "Chấm công thực tế theo thời gian thực, chấm công thủ công và nhật ký máy chấm công.",
      },
      { property: "og:title", content: "Chấm công — GZV Clinic Platform" },
      {
        property: "og:description",
        content: "Dữ liệu chấm công vân tay realtime từ máy chấm công của phòng khám.",
      },
    ],
  }),
  component: AttendanceHubPage,
});

const STAFF_ROLES: AppRole[] = ["administrator", "manager"];

function AttendanceHubPage() {
  const { profile } = Route.useRouteContext();
  const isStaff = hasAnyRole(profile.roles, STAFF_ROLES);

  return (
    <div>
      <PageHeader
        title="Chấm công"
        description="Chấm công thực tế theo thời gian thực, chấm công thủ công khi thiết bị lỗi và nhật ký dữ liệu máy chấm công."
      />
      <Tabs defaultValue="checkin">
        <TabsList>
          <TabsTrigger value="checkin">Chấm công thực tế</TabsTrigger>
          {isStaff && <TabsTrigger value="manual">Chấm công thủ công</TabsTrigger>}
          {isStaff && <TabsTrigger value="logs">Nhật ký máy</TabsTrigger>}
        </TabsList>
        <TabsContent value="checkin" className="mt-6">
          <CheckInTab />
        </TabsContent>
        {isStaff && (
          <TabsContent value="manual" className="mt-6">
            <ManualAttendanceTab />
          </TabsContent>
        )}
        {isStaff && (
          <TabsContent value="logs" className="mt-6">
            <DeviceLogsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const VERIFY_LABELS: Record<string, string> = {
  fingerprint: "Vân tay",
  face: "Khuôn mặt",
  card: "Thẻ từ",
  password: "Mật khẩu",
  palm: "Vân bàn tay",
  unknown: "Không xác định",
};

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function CheckInTab() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();

  const { data: myEmployee } = useQuery({
    queryKey: ["checkin-employee", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, full_name, employee_code, avatar_url, organization_id, device_user_id, department:departments(name), shift:shifts!default_shift_id(id, start_time, end_time, grace_period_minutes, late_threshold_minutes, early_leave_threshold_minutes, crosses_midnight)",
        )
        .or(`user_id.eq.${session?.user.id},email.eq.${session?.user.email ?? ""}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const employeeId = myEmployee?.id;
  const myShift: ({ id: string } & ShiftWindow) | null = myEmployee?.shift
    ? {
        id: myEmployee.shift.id,
        startTime: myEmployee.shift.start_time,
        endTime: myEmployee.shift.end_time,
        gracePeriodMinutes: myEmployee.shift.grace_period_minutes,
        lateThresholdMinutes: myEmployee.shift.late_threshold_minutes,
        earlyLeaveThresholdMinutes: myEmployee.shift.early_leave_threshold_minutes,
        crossesMidnight: myEmployee.shift.crosses_midnight,
      }
    : null;

  const todayRecord = useQuery({
    queryKey: ["today-attendance", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, check_in_time, check_out_time, attendance_status, worked_minutes")
        .eq("employee_id", employeeId as string)
        .eq("work_date", todayISO())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const deviceFeed = useQuery({
    queryKey: ["device-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_logs")
        .select("id, event_time, event_type, verify_mode, device_user_id, user_id, process_note")
        .order("event_time", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const devices = useQuery({
    queryKey: ["checkin-devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_name, device_type, status, is_active, last_sync_time")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("attendance-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "device_logs" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["device-feed"] });
        void queryClient.invalidateQueries({ queryKey: ["checkin-devices"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const manualMutation = useMutation({
    mutationFn: async () => {
      if (!myEmployee?.id) throw new Error("Tài khoản chưa được liên kết với hồ sơ nhân viên");

      const now = new Date().toISOString();
      const date = todayISO();
      const existing = todayRecord.data;

      if (!existing) {
        const computed = computeAttendanceFromShift({
          workDate: date,
          checkInIso: now,
          checkOutIso: null,
          shift: myShift,
        });
        const { error } = await supabase.from("attendance_records").insert({
          organization_id: myEmployee.organization_id,
          employee_id: myEmployee.id,
          work_date: date,
          shift_id: myShift?.id ?? null,
          check_in_time: now,
          late_minutes: computed.lateMinutes,
          attendance_status: computed.status,
        });
        if (error) throw error;
        return computed.status === "late"
          ? `Đã ghi nhận giờ vào — đi trễ ${computed.lateMinutes} phút`
          : "Đã ghi nhận giờ vào — đúng giờ";
      }

      if (!existing.check_in_time) {
        const computed = computeAttendanceFromShift({
          workDate: date,
          checkInIso: now,
          checkOutIso: null,
          shift: myShift,
        });
        const { error } = await supabase
          .from("attendance_records")
          .update({ check_in_time: now, shift_id: myShift?.id ?? null, late_minutes: computed.lateMinutes, attendance_status: computed.status })
          .eq("id", existing.id);
        if (error) throw error;
        return computed.status === "late"
          ? `Đã ghi nhận giờ vào — đi trễ ${computed.lateMinutes} phút`
          : "Đã ghi nhận giờ vào — đúng giờ";
      }

      const computed = computeAttendanceFromShift({
        workDate: date,
        checkInIso: existing.check_in_time,
        checkOutIso: now,
        shift: myShift,
      });
      const { error } = await supabase
        .from("attendance_records")
        .update({
          check_out_time: now,
          worked_minutes: computed.workedMinutes ?? 0,
          early_leave_minutes: computed.earlyLeaveMinutes,
          attendance_status: computed.status,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return computed.status === "early_leave"
        ? `Đã ghi nhận giờ ra — về sớm ${computed.earlyLeaveMinutes} phút`
        : "Đã ghi nhận giờ ra";
    },
    onSuccess: (message) => {
      toast.success(message);
      void queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const record = todayRecord.data;
  const onlineDevices = (devices.data ?? []).filter((d) => d.status === "online").length;

  return (
    <div>
      {!myEmployee && (
        <Card className="surface-card mb-6 border-l-4 border-l-yellow-500 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên. Vui lòng liên hệ quản trị
              viên để gán mã nhân viên và mã vân tay trên máy chấm công.
            </p>
          </div>
        </Card>
      )}

      {myEmployee && (
        <Card className="surface-card mb-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {myEmployee.avatar_url ? (
                <img
                  src={myEmployee.avatar_url}
                  alt={myEmployee.full_name}
                  className="size-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                  <User className="size-8 text-primary" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold">{myEmployee.full_name}</h3>
                <p className="text-sm text-muted-foreground">{myEmployee.employee_code}</p>
                <p className="text-sm text-muted-foreground">
                  {myEmployee.department?.name ?? "Chưa gán phòng ban"} · Mã trên máy:{" "}
                  {myEmployee.device_user_id ?? "chưa ánh xạ"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ca làm việc:{" "}
                  <span className={myShift ? "font-medium text-foreground" : "font-medium text-warning-foreground"}>
                    {formatShiftWindow(myEmployee.shift)}
                  </span>
                  {!myShift && " — liên hệ quản lý để được gán ca"}
                </p>
              </div>
            </div>

            <div className="text-right">
              {record?.check_in_time && record?.check_out_time ? (
                <>
                  <Badge className="mb-2 bg-green-100 text-green-800">Đã hoàn thành</Badge>
                  <p className="text-sm text-muted-foreground">
                    Vào: {new Date(record.check_in_time).toLocaleTimeString("vi-VN")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ra: {new Date(record.check_out_time).toLocaleTimeString("vi-VN")}
                  </p>
                </>
              ) : record?.check_in_time ? (
                <>
                  <Badge className="mb-2 bg-blue-100 text-blue-800">Đang làm việc</Badge>
                  <p className="text-sm text-muted-foreground">
                    Vào: {new Date(record.check_in_time).toLocaleTimeString("vi-VN")}
                  </p>
                </>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800">Chưa chấm công hôm nay</Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="surface-card p-6">
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-blue-100">
            <Fingerprint className="size-6 text-blue-600" />
          </div>
          <h3 className="font-semibold">Vân tay trên máy chấm công</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Quét vân tay trực tiếp trên thiết bị. Bản ghi được Agent đẩy lên và hiển thị tại đây
            trong vài giây. Hệ thống không mô phỏng vân tay.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Radio className={`size-4 ${onlineDevices > 0 ? "text-green-600" : "text-muted-foreground"}`} />
            <span className={onlineDevices > 0 ? "text-green-700" : "text-muted-foreground"}>
              {onlineDevices > 0 ? `${onlineDevices} thiết bị đang kết nối` : "Chưa có thiết bị nào gửi dữ liệu"}
            </span>
          </div>
        </Card>

        <Card className="surface-card p-6">
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-purple-100">
            <ScanFace className="size-6 text-purple-600" />
          </div>
          <h3 className="font-semibold">Khuôn mặt</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Nếu thiết bị hỗ trợ nhận diện khuôn mặt, bản ghi sẽ được gửi kèm chế độ xác thực
            “Khuôn mặt”. Trình duyệt không thực hiện nhận diện thay thiết bị.
          </p>
        </Card>

        <Card className="surface-card p-6">
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-green-100">
            <Smartphone className="size-6 text-green-600" />
          </div>
          <h3 className="font-semibold">Chấm công dự phòng</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Chỉ dùng khi máy chấm công gặp sự cố. Mọi thao tác đều được lưu lại để quản lý đối
            chiếu.
          </p>
          <Button
            className="mt-4 w-full"
            variant="outline"
            disabled={!myEmployee || manualMutation.isPending}
            onClick={() => manualMutation.mutate()}
          >
            {manualMutation.isPending ? (
              <>
                <Loader className="mr-2 size-4 animate-spin" /> Đang xử lý...
              </>
            ) : (
              <>
                <LogIn className="mr-2 size-4" />
                {record?.check_in_time ? "Ghi nhận giờ ra" : "Ghi nhận giờ vào"}
              </>
            )}
          </Button>
        </Card>
      </div>

      <Card className="surface-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Dòng dữ liệu máy chấm công (realtime)</h3>
          <Badge className="bg-primary/10 text-primary">Tự động cập nhật</Badge>
        </div>

        {(deviceFeed.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có bản ghi nào từ máy chấm công. Hãy cấu hình Agent tại “Kết nối Agent chấm công”.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {(deviceFeed.data ?? []).map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`size-4 ${log.user_id ? "text-green-600" : "text-yellow-600"}`} />
                  <div>
                    <p className="text-sm font-medium">
                      Mã máy: {log.device_user_id ?? "—"} · {VERIFY_LABELS[log.verify_mode] ?? log.verify_mode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.user_id ? "Đã khớp nhân viên" : (log.process_note ?? "Chưa ánh xạ")}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(log.event_time).toLocaleString("vi-VN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

type ManualCheckIn = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  attendance_status: string;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  reason: string | null;
  employee: {
    full_name: string;
    employee_code: string;
  };
};

// "auto" = hệ thống tự tính đúng giờ/đi trễ/về sớm theo ca được gán cho nhân viên.
// Các lựa chọn còn lại là nghỉ cả ngày (hoặc nửa ngày) — không suy luận từ giờ vào/ra.
type StatusMode = "auto" | "half_day" | "absent" | "leave" | "sick" | "holiday";

type NewCheckIn = {
  employee_id: string;
  work_date: string;
  check_in_time: string;
  check_out_time: string;
  status_mode: StatusMode;
  reason: string;
};

const EMPTY_CHECKIN_FORM: NewCheckIn = {
  employee_id: "",
  work_date: "",
  check_in_time: "",
  check_out_time: "",
  status_mode: "auto",
  reason: "",
};

// Hiển thị MỌI trạng thái có thể có trong dữ liệu (kể cả các trạng thái do hệ thống tự suy ra).
const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Có mặt (đúng giờ)",
  late: "Đi trễ",
  early_leave: "Về sớm",
  half_day: "Nửa ngày",
  absent: "Vắng mặt (trừ lương theo công thức)",
  leave: "Nghỉ phép (có lương)",
  sick: "Nghỉ ốm (có lương)",
  holiday: "Nghỉ lễ (có lương)",
};

// Lựa chọn khi tạo/sửa bản ghi — chỉ "auto" và "half_day" cần giờ vào/ra.
const STATUS_MODE_LABELS: Record<StatusMode, string> = {
  auto: "Tự động (theo giờ vào/ra so với ca được gán)",
  half_day: "Nửa ngày",
  absent: "Vắng mặt (trừ lương theo công thức)",
  leave: "Nghỉ phép (có lương)",
  sick: "Nghỉ ốm (có lương)",
  holiday: "Nghỉ lễ (có lương)",
};

const MODES_WITHOUT_TIME = new Set<StatusMode>(["absent", "leave", "sick", "holiday"]);
const DERIVED_STATUSES = new Set(["present", "late", "early_leave"]);

function statusToMode(status: string): StatusMode {
  return DERIVED_STATUSES.has(status) ? "auto" : (status as StatusMode);
}

function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function ManualAttendanceTab() {
  const { org } = Route.useRouteContext();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0] ?? "");
  const [search, setSearch] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<NewCheckIn>({ ...EMPTY_CHECKIN_FORM, work_date: selectedDate });
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ["all-employees-with-shift"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select(
          "id, full_name, employee_code, shift:shifts!default_shift_id(id, start_time, end_time, grace_period_minutes, late_threshold_minutes, early_leave_threshold_minutes, crosses_midnight)",
        )
        .order("full_name");
      return data || [];
    },
  });

  const selectedEmployee = employees?.find((e) => e.id === formData.employee_id);
  const selectedShift: ({ id: string } & ShiftWindow) | null = selectedEmployee?.shift
    ? {
        id: selectedEmployee.shift.id,
        startTime: selectedEmployee.shift.start_time,
        endTime: selectedEmployee.shift.end_time,
        gracePeriodMinutes: selectedEmployee.shift.grace_period_minutes,
        lateThresholdMinutes: selectedEmployee.shift.late_threshold_minutes,
        earlyLeaveThresholdMinutes: selectedEmployee.shift.early_leave_threshold_minutes,
        crossesMidnight: selectedEmployee.shift.crosses_midnight,
      }
    : null;

  const preview =
    formData.status_mode === "auto" && formData.work_date && formData.check_in_time
      ? computeAttendanceFromShift({
          workDate: formData.work_date,
          checkInIso: `${formData.work_date}T${formData.check_in_time}:00+07:00`,
          checkOutIso: formData.check_out_time ? `${formData.work_date}T${formData.check_out_time}:00+07:00` : null,
          shift: selectedShift,
        })
      : null;

  const { data: manualAttendance, isLoading, isError, error } = useQuery({
    queryKey: ["manual-attendance", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select(
          "id, employee_id, work_date, check_in_time, check_out_time, attendance_status, late_minutes, early_leave_minutes, approval_notes, employee:employees(full_name, employee_code)",
        )
        .eq("work_date", selectedDate)
        .order("created_at", { ascending: false });

      return (data ?? []).map((r) => ({
        id: r.id,
        employee_id: r.employee_id,
        work_date: r.work_date,
        check_in_time: r.check_in_time,
        check_out_time: r.check_out_time,
        attendance_status: r.attendance_status,
        late_minutes: r.late_minutes,
        early_leave_minutes: r.early_leave_minutes,
        reason: r.approval_notes,
        employee: r.employee,
      })) as unknown as ManualCheckIn[];
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_CHECKIN_FORM, work_date: selectedDate });
    setOpenDialog(true);
  };

  const openEdit = (record: ManualCheckIn) => {
    setEditingId(record.id);
    setFormData({
      employee_id: record.employee_id,
      work_date: record.work_date,
      check_in_time: toTimeInput(record.check_in_time),
      check_out_time: toTimeInput(record.check_out_time),
      status_mode: statusToMode(record.attendance_status || "present"),
      reason: record.reason || "",
    });
    setOpenDialog(true);
  };

  const buildPayload = (data: NewCheckIn) => {
    const checkInIso = data.check_in_time ? `${data.work_date}T${data.check_in_time}:00+07:00` : null;
    const checkOutIso = data.check_out_time ? `${data.work_date}T${data.check_out_time}:00+07:00` : null;
    const base = {
      organization_id: org.id,
      employee_id: data.employee_id,
      work_date: data.work_date,
      approval_notes: data.reason || null,
      is_approved: true,
    };

    if (data.status_mode === "auto") {
      const computed = computeAttendanceFromShift({
        workDate: data.work_date,
        checkInIso,
        checkOutIso,
        shift: selectedShift,
      });
      return {
        ...base,
        shift_id: selectedShift?.id ?? null,
        check_in_time: checkInIso,
        check_out_time: checkOutIso,
        late_minutes: computed.lateMinutes,
        early_leave_minutes: computed.earlyLeaveMinutes,
        worked_minutes: computed.workedMinutes,
        attendance_status: computed.status,
      };
    }

    if (data.status_mode === "half_day") {
      const worked =
        checkInIso && checkOutIso
          ? Math.max(0, Math.round((Date.parse(checkOutIso) - Date.parse(checkInIso)) / 60000))
          : null;
      return {
        ...base,
        shift_id: selectedShift?.id ?? null,
        check_in_time: checkInIso,
        check_out_time: checkOutIso,
        late_minutes: 0,
        early_leave_minutes: 0,
        worked_minutes: worked,
        attendance_status: "half_day",
      };
    }

    // absent / leave / sick / holiday — nghỉ nguyên ngày, không có giờ vào/ra, không gán ca.
    return {
      ...base,
      shift_id: null,
      check_in_time: null,
      check_out_time: null,
      late_minutes: 0,
      early_leave_minutes: 0,
      worked_minutes: null,
      attendance_status: data.status_mode,
    };
  };

  const explainSaveError = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("duplicate key") || message.includes("23505")) {
      return "Nhân viên này đã có bản ghi chấm công cho ngày đã chọn. Hãy bấm \"Sửa\" trên bản ghi đó thay vì tạo mới.";
    }
    return message;
  };

  const createCheckInMutation = useMutation({
    mutationFn: async (data: NewCheckIn) => {
      if (!data.employee_id) throw new Error("Vui lòng chọn nhân viên");
      if (data.status_mode === "auto" && !data.check_in_time) {
        throw new Error("Vui lòng nhập giờ vào");
      }
      const { error } = await supabase.from("attendance_records").insert([buildPayload(data)]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm chấm công thủ công");
      void queryClient.invalidateQueries({ queryKey: ["manual-attendance"] });
      setOpenDialog(false);
      setFormData({ ...EMPTY_CHECKIN_FORM, work_date: selectedDate });
    },
    onError: (err) => toast.error(explainSaveError(err)),
  });

  const updateCheckInMutation = useMutation({
    mutationFn: async (data: NewCheckIn) => {
      if (!editingId) throw new Error("Không tìm thấy bản ghi cần sửa");
      if (data.status_mode === "auto" && !data.check_in_time) {
        throw new Error("Vui lòng nhập giờ vào");
      }
      const { error } = await supabase
        .from("attendance_records")
        .update(buildPayload(data))
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật bản ghi chấm công");
      void queryClient.invalidateQueries({ queryKey: ["manual-attendance"] });
      setOpenDialog(false);
      setEditingId(null);
      setFormData({ ...EMPTY_CHECKIN_FORM, work_date: selectedDate });
    },
    onError: (err) => toast.error(explainSaveError(err)),
  });

  const deleteCheckInMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase.from("attendance_records").delete().eq("id", recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["manual-attendance"] });
      toast.success("Đã xóa bản ghi chấm công");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (manualAttendance ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      record.employee.full_name.toLowerCase().includes(term) ||
      record.employee.employee_code.toLowerCase().includes(term)
    );
  });

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium">Chọn ngày</label>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên hoặc mã nhân viên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <Button className="mt-6 sm:mt-0" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Thêm chấm công thủ công
        </Button>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Sửa bản ghi chấm công" : "Thêm chấm công thủ công"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Chỉnh sửa trực tiếp bản ghi chấm công — thay đổi này sẽ được tính vào bảng lương ngay."
                  : "Nhập thông tin chấm công cho nhân viên."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Nhân viên *</label>
                <select
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  disabled={Boolean(editingId)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees?.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_code} - {emp.full_name}
                    </option>
                  ))}
                </select>
                {formData.employee_id && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ca được gán: <span className={selectedShift ? "font-medium text-foreground" : "font-medium text-warning-foreground"}>{formatShiftWindow(selectedEmployee?.shift ?? null)}</span>
                    {!selectedShift && " — không thể tự tính đi trễ/về sớm khi chưa gán ca (Nhân sự → Phân công công việc)"}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Ngày *</label>
                <input
                  type="date"
                  value={formData.work_date}
                  onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                  disabled={Boolean(editingId)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Trạng thái *</label>
                <select
                  value={formData.status_mode}
                  onChange={(e) => setFormData({ ...formData, status_mode: e.target.value as StatusMode })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(STATUS_MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {MODES_WITHOUT_TIME.has(formData.status_mode) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Trạng thái này không cần giờ vào/ra — nghỉ nguyên ngày.
                  </p>
                )}
              </div>

              {!MODES_WITHOUT_TIME.has(formData.status_mode) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Giờ vào *</label>
                    <input
                      type="time"
                      value={formData.check_in_time}
                      onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">Giờ ra</label>
                    <input
                      type="time"
                      value={formData.check_out_time}
                      onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {preview && (
                <div
                  className={`rounded-md border p-3 text-xs ${
                    preview.status === "present"
                      ? "border-success/25 bg-success/10 text-success"
                      : "border-warning/25 bg-warning/10 text-warning-foreground"
                  }`}
                >
                  {preview.status === "present" && "Đúng giờ theo ca đã gán."}
                  {preview.status === "late" && `Đi trễ ${preview.lateMinutes} phút so với ca ${formatShiftWindow(selectedEmployee?.shift ?? null)}.`}
                  {preview.status === "early_leave" && `Về sớm ${preview.earlyLeaveMinutes} phút so với ca ${formatShiftWindow(selectedEmployee?.shift ?? null)}.`}
                  {" "}Sẽ được lưu là "{ATTENDANCE_STATUS_LABELS[preview.status]}".
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium">Lý do</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Nhập lý do chấm công thủ công..."
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <Button
                onClick={() =>
                  editingId ? updateCheckInMutation.mutate(formData) : createCheckInMutation.mutate(formData)
                }
                disabled={createCheckInMutation.isPending || updateCheckInMutation.isPending}
                className="w-full"
              >
                {createCheckInMutation.isPending || updateCheckInMutation.isPending
                  ? "Đang lưu..."
                  : editingId
                    ? "Lưu thay đổi"
                    : "Lưu"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : isError ? (
        <ErrorState description={(error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có bản ghi chấm công thủ công"
          description="Hãy thêm chấm công thủ công cho nhân viên bằng nút trên."
        />
      ) : (
        <div className="surface-card overflow-x-auto rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã NV</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Giờ vào</TableHead>
                <TableHead>Giờ ra</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.employee.employee_code}</TableCell>
                  <TableCell>{record.employee.full_name}</TableCell>
                  <TableCell>{record.work_date}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={record.attendance_status === "absent" ? "destructive" : "secondary"}>
                      {ATTENDANCE_STATUS_LABELS[record.attendance_status] ?? record.attendance_status}
                      {record.attendance_status === "late" && record.late_minutes ? ` (${record.late_minutes}p)` : ""}
                      {record.attendance_status === "early_leave" && record.early_leave_minutes
                        ? ` (${record.early_leave_minutes}p)`
                        : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <LogIn className="size-3.5 text-green-600" />
                      {formatTime(record.check_in_time)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <LogOut className="size-3.5 text-red-600" />
                      {formatTime(record.check_out_time)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {record.reason || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(record)}>
                        <Edit className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Xóa bản ghi chấm công này? Không thể hoàn tác.")) {
                            deleteCheckInMutation.mutate(record.id);
                          }
                        }}
                        disabled={deleteCheckInMutation.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Card className="surface-card mt-6 border-l-4 border-l-orange-500 bg-orange-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="size-5 shrink-0 text-orange-600" />
          <div>
            <p className="font-medium text-orange-900">Ghi chú bảo mật:</p>
            <p className="mt-1 text-sm text-orange-800">
              Tất cả chấm công thủ công sẽ được ghi lại trong nhật ký kiểm toán. Chỉ quản lý và
              quản trị viên hệ thống mới có thể thêm, sửa hoặc xóa bản ghi chấm công thủ công.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

type DeviceLog = {
  id: string;
  device_id: string;
  user_id: string;
  event_type: "check_in" | "check_out" | "admin_access" | "error";
  event_time: string;
  temperature: number | null;
  mask_detected: boolean | null;
  raw_data: Record<string, unknown>;
  device: {
    device_name: string;
    serial_number: string;
  };
};

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  check_in: { label: "Vào", color: "bg-green-100 text-green-800" },
  check_out: { label: "Ra", color: "bg-red-100 text-red-800" },
  admin_access: { label: "Quản trị viên", color: "bg-blue-100 text-blue-800" },
  error: { label: "Lỗi", color: "bg-red-100 text-red-800" },
};

function DeviceLogsTab() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("");

  const logs = useQuery({
    queryKey: ["device-logs", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_logs")
        .select(
          "id, device_id, user_id, event_type, event_time, temperature, mask_detected, raw_data, device:devices(device_name, serial_number)",
        )
        .gte("event_time", `${selectedDate}T00:00:00`)
        .lt("event_time", `${selectedDate}T23:59:59`)
        .order("event_time", { ascending: false });

      if (error) throw error;
      return (data as unknown as DeviceLog[]) || [];
    },
  });

  const stats = useQuery({
    queryKey: ["device-logs-stats", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_logs")
        .select("event_type", { count: "exact" })
        .gte("event_time", `${selectedDate}T00:00:00`)
        .lt("event_time", `${selectedDate}T23:59:59`);

      if (error) throw error;

      const records = (data as Array<{ event_type: string }>) || [];
      return {
        total: records.length,
        check_in: records.filter((r) => r.event_type === "check_in").length,
        check_out: records.filter((r) => r.event_type === "check_out").length,
        errors: records.filter((r) => r.event_type === "error").length,
      };
    },
  });

  const filtered = (logs.data ?? []).filter((log) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      log.device.device_name.toLowerCase().includes(term) ||
      log.device.serial_number.toLowerCase().includes(term);
    const matchesEvent = !eventFilter || log.event_type === eventFilter;
    return matchesSearch && matchesEvent;
  });

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div>
      {stats.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="surface-card h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : stats.data ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <LogsStatCard icon={<Fingerprint className="size-5" />} label="Tổng cộng" value={stats.data.total} />
          <LogsStatCard icon={<LogIn className="size-5 text-green-600" />} label="Vào" value={stats.data.check_in} />
          <LogsStatCard icon={<LogOut className="size-5 text-red-600" />} label="Ra" value={stats.data.check_out} />
        </section>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Chọn ngày</label>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Tìm kiếm thiết bị</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Loại sự kiện</label>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger>
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="Tất cả sự kiện" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả sự kiện</SelectItem>
              <SelectItem value="check_in">Vào</SelectItem>
              <SelectItem value="check_out">Ra</SelectItem>
              <SelectItem value="admin_access">Quản trị viên</SelectItem>
              <SelectItem value="error">Lỗi</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {logs.isLoading ? (
        <LoadingState rows={8} />
      ) : logs.isError ? (
        <ErrorState description={(logs.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Không có dữ liệu từ máy" description="Chưa có dữ liệu từ máy chấm công cho ngày này." />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Loại sự kiện</TableHead>
                <TableHead>Nhiệt độ</TableHead>
                <TableHead>Khẩu trang</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{formatTime(log.event_time)}</TableCell>
                  <TableCell>{log.device.device_name}</TableCell>
                  <TableCell className="font-mono text-xs">{log.device.serial_number}</TableCell>
                  <TableCell>
                    <Badge className={EVENT_TYPE_LABELS[log.event_type]?.color}>
                      {EVENT_TYPE_LABELS[log.event_type]?.label || log.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.temperature ? `${log.temperature.toFixed(1)}°C` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.mask_detected === null ? "—" : log.mask_detected ? "Có" : "Không"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LogsStatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="surface-card flex items-center justify-between rounded-lg p-4">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </div>
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
    </div>
  );
}
