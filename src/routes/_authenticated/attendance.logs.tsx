import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Filter, Fingerprint, LogIn, LogOut, Search } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/attendance/logs")({
  head: () => ({
    meta: [
      { title: "Dữ liệu máy chấm công — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Xem và quản lý dữ liệu thô từ máy chấm công.",
      },
      {
        property: "og:title",
        content: "Dữ liệu máy chấm công — Việt Smile Clinic Suite",
      },
    ],
  }),
  component: AttendanceLogsPage,
});

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

function AttendanceLogsPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
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
      const counts = {
        check_in: records.filter((r) => r.event_type === "check_in").length,
        check_out: records.filter((r) => r.event_type === "check_out").length,
        errors: records.filter((r) => r.event_type === "error").length,
      };

      return {
        total: records.length,
        ...counts,
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
    const date = new Date(time);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div>
      <PageHeader
        title="Dữ liệu máy chấm công"
        description="Xem chi tiết dữ liệu thô từ máy chấm công, bao gồm giờ vào/ra, nhiệt độ và tình trạng đeo khẩu trang."
      />

      {/* Stats */}
      {stats.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="surface-card h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : stats.data ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Fingerprint className="size-5" />} label="Tổng cộng" value={stats.data.total} />
          <StatCard
            icon={<LogIn className="size-5 text-green-600" />}
            label="Vào"
            value={stats.data.check_in}
          />
          <StatCard
            icon={<LogOut className="size-5 text-red-600" />}
            label="Ra"
            value={stats.data.check_out}
          />
        </section>
      ) : null}

      {/* Filters */}
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

      {/* Table */}
      {logs.isLoading ? (
        <LoadingState rows={8} />
      ) : logs.isError ? (
        <ErrorState description={(logs.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có dữ liệu từ máy"
          description="Chưa có dữ liệu từ máy chấm công cho ngày này."
        />
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
                    {log.mask_detected === null
                      ? "—"
                      : log.mask_detected
                        ? "Có"
                        : "Không"}
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="surface-card flex items-center justify-between rounded-lg p-4">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </div>
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
    </div>
  );
}
