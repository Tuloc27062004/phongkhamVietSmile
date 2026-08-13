import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Download, Filter, Search, TrendingUp } from "lucide-react";

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

export const Route = createFileRoute("/_authenticated/attendance/monthly")({
  head: () => ({
    meta: [
      { title: "Bảng công tháng — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Xem tổng hợp chấm công và tính lương hàng tháng.",
      },
      {
        property: "og:title",
        content: "Bảng công tháng — Việt Smile Clinic Suite",
      },
    ],
  }),
  component: AttendanceMonthlyPage,
});

type MonthlySummary = {
  employee_id: string;
  full_name: string;
  employee_code: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  early_leave_days: number;
  overtime_hours: number;
};

function AttendanceMonthlyPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [search, setSearch] = useState("");

  const monthlySummary = useQuery({
    queryKey: ["attendance-monthly", month],
    queryFn: async () => {
      const [year, monthNum] = month.split("-");
      const startDate = `${year}-${monthNum}-01`;
      const endDate = `${year}-${monthNum}-31`;

      const { data, error } = await supabase
        .from("attendance_summaries")
        .select(
          "employee_id, full_name, employee_code, total_days, present_days, absent_days, late_days, early_leave_days, overtime_hours",
        )
        .gte("date", startDate)
        .lte("date", endDate)
        .order("employee_code");

      if (error) throw error;
      return (data as unknown as MonthlySummary[]) || [];
    },
  });

  const filtered = (monthlySummary.data ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      record.full_name.toLowerCase().includes(term) ||
      record.employee_code.toLowerCase().includes(term)
    );
  });

  const totals = filtered.reduce(
    (acc, record) => ({
      total_days: acc.total_days + record.total_days,
      present_days: acc.present_days + record.present_days,
      absent_days: acc.absent_days + record.absent_days,
      late_days: acc.late_days + record.late_days,
      early_leave_days: acc.early_leave_days + record.early_leave_days,
      overtime_hours: acc.overtime_hours + record.overtime_hours,
    }),
    {
      total_days: 0,
      present_days: 0,
      absent_days: 0,
      late_days: 0,
      early_leave_days: 0,
      overtime_hours: 0,
    },
  );

  const handleExport = () => {
    // Generate CSV
    const headers = [
      "Mã NV",
      "Họ và tên",
      "Tổng ngày",
      "Có mặt",
      "Vắng mặt",
      "Đi trễ",
      "Về sớm",
      "Tăng ca (giờ)",
    ];
    const rows = filtered.map((r) => [
      r.employee_code,
      r.full_name,
      r.total_days,
      r.present_days,
      r.absent_days,
      r.late_days,
      r.early_leave_days,
      r.overtime_hours.toFixed(1),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bang-cong-${month}.csv`;
    a.click();
  };

  return (
    <div>
      <PageHeader
        title="Bảng công tháng"
        description="Tổng hợp chấm công và tính toán lương tháng cho tất cả nhân viên."
        actions={
          <Button onClick={handleExport} disabled={!filtered.length}>
            <Download className="mr-2 size-4" />
            Xuất Excel
          </Button>
        }
      />

      {/* Summary Stats */}
      {monthlySummary.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="surface-card h-24 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            label="Tổng ngày công"
            value={totals.total_days}
            unit="ngày"
            trend="up"
          />
          <SummaryCard
            label="Có mặt"
            value={totals.present_days}
            unit="ngày"
            trend="up"
            color="green"
          />
          <SummaryCard
            label="Tăng ca"
            value={totals.overtime_hours.toFixed(1)}
            unit="giờ"
            trend="up"
            color="blue"
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
      </div>

      {/* Table */}
      {monthlySummary.isLoading ? (
        <LoadingState rows={8} />
      ) : monthlySummary.isError ? (
        <ErrorState description={(monthlySummary.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có dữ liệu chấm công"
          description="Chưa có bản ghi chấm công cho tháng này."
        />
      ) : (
        <div className="space-y-4">
          <div className="surface-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã NV</TableHead>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead className="text-right">Tổng ngày</TableHead>
                  <TableHead className="text-right">Có mặt</TableHead>
                  <TableHead className="text-right">Vắng mặt</TableHead>
                  <TableHead className="text-right">Đi trễ</TableHead>
                  <TableHead className="text-right">Về sớm</TableHead>
                  <TableHead className="text-right">Tăng ca (h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((record) => (
                  <TableRow key={record.employee_id}>
                    <TableCell className="font-medium">{record.employee_code}</TableCell>
                    <TableCell>{record.full_name}</TableCell>
                    <TableCell className="text-right">{record.total_days}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-green-50">
                        {record.present_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-red-50">
                        {record.absent_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-yellow-50">
                        {record.late_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="bg-orange-50">
                        {record.early_leave_days}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {record.overtime_hours.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals Row */}
          <Card className="surface-card p-4">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Tổng ngày</p>
                <p className="mt-1 text-lg font-bold">{totals.total_days}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Có mặt</p>
                <p className="mt-1 text-lg font-bold text-green-600">{totals.present_days}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Vắng mặt</p>
                <p className="mt-1 text-lg font-bold text-red-600">{totals.absent_days}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Đi trễ</p>
                <p className="mt-1 text-lg font-bold text-yellow-600">{totals.late_days}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Về sớm</p>
                <p className="mt-1 text-lg font-bold text-orange-600">
                  {totals.early_leave_days}
                </p>
              </div>
              <div className="sm:col-span-2 md:col-span-2 lg:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Tăng ca</p>
                <p className="mt-1 text-lg font-bold text-blue-600">
                  {totals.overtime_hours.toFixed(1)} giờ
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  trend,
  color = "gray",
}: {
  label: string;
  value: string | number;
  unit: string;
  trend: "up" | "down";
  color?: "green" | "blue" | "gray";
}) {
  const colorClasses = {
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    gray: "bg-slate-50 text-slate-600",
  };

  return (
    <Card className="surface-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold">
            {value}
            <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>
          </p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-lg ${colorClasses[color]}`}>
          {trend === "up" ? (
            <TrendingUp className="size-5" />
          ) : (
            <TrendingUp className="size-5 rotate-180" />
          )}
        </div>
      </div>
    </Card>
  );
}
