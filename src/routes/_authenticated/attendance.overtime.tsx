import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  Clock,
  DollarSign,
  Filter,
  Gauge,
  Search,
  TrendingUp,
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

export const Route = createFileRoute("/_authenticated/attendance/overtime")({
  head: () => ({
    meta: [
      { title: "Tăng ca — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Xem và quản lý tăng ca cho nhân viên.",
      },
      {
        property: "og:title",
        content: "Tăng ca — Việt Smile Clinic Suite",
      },
    ],
  }),
  component: AttendanceOvertimePage,
});

type OvertimeRecord = {
  id: string;
  employee_id: string;
  overtime_date: string;
  duration_hours: number;
  rate_multiplier: number;
  status: "pending" | "approved" | "paid";
  reason: string | null;
  notes: string | null;
  employee: {
    full_name: string;
    employee_code: string;
  };
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Đã phê duyệt", color: "bg-blue-100 text-blue-800" },
  paid: { label: "Đã thanh toán", color: "bg-green-100 text-green-800" },
};

function AttendanceOvertimePage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const overtimes = useQuery({
    queryKey: ["overtime-records", month],
    queryFn: async () => {
      const [year, monthNum] = month.split("-");
      const startDate = `${year}-${monthNum}-01`;
      const endDate = `${year}-${monthNum}-31`;

      const { data, error } = await supabase
        .from("overtime_records")
        .select(
          "id, employee_id, overtime_date, duration_hours, rate_multiplier, status, reason, notes, employee:employees(full_name, employee_code)",
        )
        .gte("overtime_date", startDate)
        .lte("overtime_date", endDate)
        .order("overtime_date", { ascending: false });

      if (error) throw error;
      return (data as unknown as OvertimeRecord[]) || [];
    },
  });

  const stats = useQuery({
    queryKey: ["overtime-stats", month],
    queryFn: async () => {
      const [year, monthNum] = month.split("-");
      const startDate = `${year}-${monthNum}-01`;
      const endDate = `${year}-${monthNum}-31`;

      const { data, error } = await supabase
        .from("overtime_records")
        .select("duration_hours, status")
        .gte("overtime_date", startDate)
        .lte("overtime_date", endDate);

      if (error) throw error;

      const records = (data as Array<{ duration_hours: number; status: string }>) || [];
      const totals = records.reduce(
        (acc, r) => ({
          total: acc.total + r.duration_hours,
          approved: acc.approved + (r.status === "approved" ? r.duration_hours : 0),
          paid: acc.paid + (r.status === "paid" ? r.duration_hours : 0),
        }),
        { total: 0, approved: 0, paid: 0 },
      );

      return {
        count: records.length,
        ...totals,
      };
    },
  });

  const filtered = (overtimes.data ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      record.employee.full_name.toLowerCase().includes(term) ||
      record.employee.employee_code.toLowerCase().includes(term);
    const matchesStatus = !statusFilter || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalHours = filtered.reduce((sum, r) => sum + r.duration_hours, 0);
  const estimatedCost = filtered.reduce(
    (sum, r) => sum + (r.duration_hours * 150000 * r.rate_multiplier),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Tăng ca"
        description="Xem và quản lý các buổi tăng ca của nhân viên, bao gồm số giờ, tỷ lệ và trạng thái thanh toán."
      />

      {/* Stats */}
      {stats.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : stats.data ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Gauge className="size-5" />}
            label="Tổng buổi"
            value={stats.data.count}
          />
          <StatCard
            icon={<Clock className="size-5 text-blue-600" />}
            label="Tổng giờ"
            value={`${stats.data.total.toFixed(1)}h`}
          />
          <StatCard
            icon={<TrendingUp className="size-5 text-green-600" />}
            label="Đã phê duyệt"
            value={`${stats.data.approved.toFixed(1)}h`}
            color="green"
          />
          <StatCard
            icon={<DollarSign className="size-5 text-yellow-600" />}
            label="Dự tính chi"
            value={`${(estimatedCost / 1000000).toFixed(1)}M`}
          />
        </section>
      ) : null}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Chọn tháng</label>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
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
              <SelectItem value="pending">Chờ xử lý</SelectItem>
              <SelectItem value="approved">Đã phê duyệt</SelectItem>
              <SelectItem value="paid">Đã thanh toán</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {overtimes.isLoading ? (
        <LoadingState rows={8} />
      ) : overtimes.isError ? (
        <ErrorState description={(overtimes.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có bản ghi tăng ca"
          description="Chưa có tăng ca cho tháng này."
        />
      ) : (
        <div className="space-y-4">
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã NV</TableHead>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Ngày tăng ca</TableHead>
                  <TableHead className="text-right">Số giờ</TableHead>
                  <TableHead className="text-right">Tỷ lệ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Chi phí dự tính</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.employee.employee_code}</TableCell>
                    <TableCell>{record.employee.full_name}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(record.overtime_date).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {record.duration_hours.toFixed(1)}h
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">x{record.rate_multiplier}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_LABELS[record.status]?.color}>
                        {STATUS_LABELS[record.status]?.label || record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(record.duration_hours * 150000 * record.rate_multiplier / 1000000).toFixed(2)}M
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <Card className="surface-card p-4">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Tổng giờ tăng ca</p>
                <p className="mt-1 text-2xl font-bold">{totalHours.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">giờ</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Số buổi</p>
                <p className="mt-1 text-2xl font-bold">{filtered.length}</p>
                <p className="text-xs text-muted-foreground">buổi</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Chi phí dự tính</p>
                <p className="mt-1 text-2xl font-bold">
                  {(estimatedCost / 1000000).toFixed(1)}M
                </p>
                <p className="text-xs text-muted-foreground">VNĐ</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color = "gray",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: "gray" | "green";
}) {
  const colorClasses = {
    gray: "bg-slate-50 text-slate-600",
    green: "bg-green-50 text-green-600",
  };

  return (
    <Card className="surface-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
