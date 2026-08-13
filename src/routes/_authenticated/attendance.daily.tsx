import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  Clock,
  Filter,
  LogIn,
  LogOut,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/attendance/daily")({
  head: () => ({
    meta: [
      { title: "Chấm công theo ngày — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Xem và quản lý chấm công nhân viên từng ngày.",
      },
      {
        property: "og:title",
        content: "Chấm công theo ngày — Việt Smile Clinic Suite",
      },
    ],
  }),
  component: AttendanceDailyPage,
});

type AttendanceRecord = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  attendance_status: "present" | "absent" | "late" | "early_leave" | "half_day";
  worked_minutes: number | null;
  approval_notes: string | null;
  employee: {
    full_name: string;
    employee_code: string;
  };
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  present: { label: "Có mặt", color: "bg-green-100 text-green-800" },
  absent: { label: "Vắng mặt", color: "bg-red-100 text-red-800" },
  late: { label: "Đi trễ", color: "bg-yellow-100 text-yellow-800" },
  early_leave: { label: "Về sớm", color: "bg-orange-100 text-orange-800" },
  half_day: { label: "Nửa ngày", color: "bg-blue-100 text-blue-800" },
};

function AttendanceDailyPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const attendance = useQuery({
    queryKey: ["attendance-daily", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select(
          "id, employee_id, work_date, check_in_time, check_out_time, attendance_status, worked_minutes, approval_notes, employee:employees(full_name, employee_code)",
        )
        .eq("work_date", selectedDate)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as AttendanceRecord[]) || [];
    },
  });

  const stats = useQuery({
    queryKey: ["attendance-stats", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("attendance_status", { count: "exact" })
        .eq("work_date", selectedDate);

      if (error) throw error;

      const records = data || [];
      const counts = {
        present: records.filter((r) => r.attendance_status === "present").length,
        absent: records.filter((r) => r.attendance_status === "absent").length,
        late: records.filter((r) => r.attendance_status === "late").length,
        early_leave: records.filter((r) => r.attendance_status === "early_leave").length,
      };

      return {
        total: records.length,
        ...counts,
      };
    },
  });

  const filtered = (attendance.data ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      record.employee.full_name.toLowerCase().includes(term) ||
      record.employee.employee_code.toLowerCase().includes(term);
    const matchesStatus = !statusFilter || record.attendance_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatTime = (time: string | null) => {
    if (!time) return "—";
    const [hours, minutes] = time.split(":");
    return `${hours}:${minutes}`;
  };

  const calculateDuration = (
    checkIn: string | null,
    checkOut: string | null,
  ) => {
    if (!checkIn || !checkOut) return "—";
    const [inH, inM] = checkIn.split(":").map(Number);
    const [outH, outM] = checkOut.split(":").map(Number);
    if (inH === undefined || inM === undefined || outH === undefined || outM === undefined) return "—";
    const diff = (outH - inH) * 60 + (outM - inM);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div>
      <PageHeader
        title="Chấm công theo ngày"
        description="Xem chi tiết chấm công nhân viên từng ngày, bao gồm giờ vào, giờ ra và trạng thái."
      />

      {/* Stats Cards */}
      {stats.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="surface-card h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : stats.data ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={<Users className="size-5" />} label="Tổng cộng" value={stats.data.total} />
          <StatCard
            icon={<LogIn className="size-5 text-green-600" />}
            label="Có mặt"
            value={stats.data.present}
          />
          <StatCard
            icon={<Clock className="size-5 text-yellow-600" />}
            label="Đi trễ"
            value={stats.data.late}
          />
          <StatCard
            icon={<LogOut className="size-5 text-orange-600" />}
            label="Về sớm"
            value={stats.data.early_leave}
          />
          <StatCard
            icon={<TrendingDown className="size-5 text-red-600" />}
            label="Vắng mặt"
            value={stats.data.absent}
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

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Lọc trạng thái</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả trạng thái</SelectItem>
              <SelectItem value="present">Có mặt</SelectItem>
              <SelectItem value="late">Đi trễ</SelectItem>
              <SelectItem value="early_leave">Về sớm</SelectItem>
              <SelectItem value="absent">Vắng mặt</SelectItem>
              <SelectItem value="half_day">Nửa ngày</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {attendance.isLoading ? (
        <LoadingState rows={8} />
      ) : attendance.isError ? (
        <ErrorState description={(attendance.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có dữ liệu chấm công"
          description="Chưa có bản ghi chấm công cho ngày này."
        />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã NV</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Giờ vào</TableHead>
                <TableHead>Giờ ra</TableHead>
                <TableHead>Thời lượng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.employee.employee_code}</TableCell>
                  <TableCell>{record.employee.full_name}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <LogIn className="size-3.5 text-green-600" />
                      {formatTime(record.check_in_time)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <LogOut className="size-3.5 text-red-600" />
                      {formatTime(record.check_out_time)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {calculateDuration(record.check_in_time, record.check_out_time)}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_LABELS[record.attendance_status]?.color}>
                      {STATUS_LABELS[record.attendance_status]?.label || record.attendance_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {record.approval_notes || "—"}
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
    <Card className="surface-card flex items-center justify-between p-4">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </div>
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
    </Card>
  );
}
