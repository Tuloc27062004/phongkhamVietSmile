import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  LogIn,
  Loader,
  Radio,
  ScanFace,
  Smartphone,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/attendance/checkin")({
  head: () => ({
    meta: [
      { title: "Chấm công thực tế — Việt Smile Clinic Suite" },
      {
        name: "description",
        content:
          "Theo dõi chấm công vân tay từ máy chấm công theo thời gian thực và chấm công dự phòng khi thiết bị lỗi.",
      },
      { property: "og:title", content: "Chấm công thực tế — Việt Smile Clinic Suite" },
      {
        property: "og:description",
        content: "Dữ liệu chấm công vân tay realtime từ máy chấm công của phòng khám.",
      },
    ],
  }),
  component: AttendanceCheckInPage,
});

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

function AttendanceCheckInPage() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();

  const { data: myEmployee } = useQuery({
    queryKey: ["checkin-employee", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, full_name, employee_code, avatar_url, organization_id, device_user_id, department:departments(name)",
        )
        .or(`user_id.eq.${session?.user.id},email.eq.${session?.user.email ?? ""}`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const employeeId = myEmployee?.id;

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

  // Realtime: cập nhật ngay khi máy chấm công đẩy dữ liệu lên
  useEffect(() => {
    const channel = supabase
      .channel("attendance-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_logs" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["device-feed"] });
          void queryClient.invalidateQueries({ queryKey: ["checkin-devices"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
        },
      )
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
        const { error } = await supabase.from("attendance_records").insert({
          organization_id: myEmployee.organization_id,
          employee_id: myEmployee.id,
          work_date: date,
          check_in_time: now,
          attendance_status: "present",
        });
        if (error) throw error;
        return "Đã ghi nhận giờ vào";
      }

      if (!existing.check_in_time) {
        const { error } = await supabase
          .from("attendance_records")
          .update({ check_in_time: now, attendance_status: "present" })
          .eq("id", existing.id);
        if (error) throw error;
        return "Đã ghi nhận giờ vào";
      }

      const worked = Math.round(
        (Date.parse(now) - Date.parse(existing.check_in_time)) / 60000,
      );
      const { error } = await supabase
        .from("attendance_records")
        .update({ check_out_time: now, worked_minutes: worked > 0 ? worked : 0 })
        .eq("id", existing.id);
      if (error) throw error;
      return "Đã ghi nhận giờ ra";
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
      <PageHeader
        title="Chấm công thực tế"
        description="Dữ liệu vân tay được máy chấm công đẩy lên hệ thống theo thời gian thực. Chấm công thủ công chỉ dùng khi thiết bị gặp sự cố và sẽ được ghi nhận riêng."
      />

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
            <Radio
              className={`size-4 ${onlineDevices > 0 ? "text-green-600" : "text-muted-foreground"}`}
            />
            <span className={onlineDevices > 0 ? "text-green-700" : "text-muted-foreground"}>
              {onlineDevices > 0
                ? `${onlineDevices} thiết bị đang kết nối`
                : "Chưa có thiết bị nào gửi dữ liệu"}
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
                  <CheckCircle2
                    className={`size-4 ${log.user_id ? "text-green-600" : "text-yellow-600"}`}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      Mã máy: {log.device_user_id ?? "—"} ·{" "}
                      {VERIFY_LABELS[log.verify_mode] ?? log.verify_mode}
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
