import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
  Search,
  TrendingUp,
  CheckCircle,
  Clock,
  Save,
  FileClock,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { ExportButton } from "@/components/export-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug/attendance/monthly")({
  head: () => ({
    meta: [
      { title: "Chấm công tháng & Xuất dữ liệu — GZV Clinic Platform" },
      {
        name: "description",
        content: "Tổng hợp chấm công theo tháng và xuất dữ liệu chi tiết theo bộ lọc.",
      },
      {
        property: "og:title",
        content: "Chấm công tháng & Xuất dữ liệu — GZV Clinic Platform",
      },
    ],
  }),
  component: AttendanceMonthlyPage,
});

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  present: { label: "Có mặt", color: "bg-success/10 text-success" },
  absent: { label: "Vắng mặt", color: "bg-destructive/10 text-destructive" },
  late: { label: "Đi trễ", color: "bg-warning/10 text-warning-foreground" },
  early_leave: { label: "Về sớm", color: "bg-warning/15 text-warning-foreground" },
  half_day: { label: "Nửa ngày", color: "bg-info/10 text-info" },
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).toISOString().split("T")[0]!;
}

function MonthYearPicker({
  month,
  year,
  onMonth,
  onYear,
}: {
  month: number;
  year: number;
  onMonth: (m: number) => void;
  onYear: (y: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={String(month)} onValueChange={(v) => onMonth(Number(v))}>
        <SelectTrigger className="w-32 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m} value={String(m)}>
              Tháng {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => onYear(Number(v))}>
        <SelectTrigger className="w-28 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>
              Năm {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AttendanceMonthlyPage() {
  return (
    <div>
      <PageHeader
        title="Chấm công tháng & Xuất dữ liệu"
        description="Tổng hợp chấm công theo tháng và xuất dữ liệu chi tiết theo bộ lọc (nhân viên, phòng ban, ngày/tháng)."
      />
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Tổng hợp tháng</TabsTrigger>
          <TabsTrigger value="export">Xuất dữ liệu chi tiết</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-6">
          <MonthlySummaryTab />
        </TabsContent>
        <TabsContent value="export" className="mt-6">
          <ExportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Tổng hợp tháng — tính trực tiếp từ attendance_records (luôn đúng cho
// mọi tháng/mọi phòng khám, không phụ thuộc bảng snapshot tĩnh nào).
// ---------------------------------------------------------------------------

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

function MonthlySummaryTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");

  const monthlySummary = useQuery({
    queryKey: ["attendance-monthly", month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = lastDayOfMonth(year, month);

      const { data, error } = await supabase
        .from("attendance_records")
        .select(
          "employee_id, attendance_status, late_minutes, early_leave_minutes, overtime_minutes, employees:employee_id(full_name, employee_code)",
        )
        .gte("work_date", startDate)
        .lte("work_date", endDate)
        .is("deleted_at", null);

      if (error) throw error;

      const map = new Map<string, MonthlySummary>();
      (data ?? []).forEach((record: any) => {
        const key = record.employee_id;
        if (!map.has(key)) {
          map.set(key, {
            employee_id: key,
            full_name: record.employees?.full_name ?? "—",
            employee_code: record.employees?.employee_code ?? "—",
            total_days: 0,
            present_days: 0,
            absent_days: 0,
            late_days: 0,
            early_leave_days: 0,
            overtime_hours: 0,
          });
        }
        const row = map.get(key)!;
        row.total_days++;
        if (record.attendance_status === "absent") {
          row.absent_days++;
        } else {
          row.present_days++;
        }
        if (record.attendance_status === "late") row.late_days++;
        if (record.attendance_status === "early_leave") row.early_leave_days++;
        row.overtime_hours += (record.overtime_minutes || 0) / 60;
      });

      return Array.from(map.values()).sort((a, b) => a.employee_code.localeCompare(b.employee_code));
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
    { total_days: 0, present_days: 0, absent_days: 0, late_days: 0, early_leave_days: 0, overtime_hours: 0 },
  );



  return (
    <div>
      <div className="mb-4 flex justify-end">
        <ExportButton
          data={filtered.map((r) => ({
            ...r,
            overtime_hours_formatted: Math.round(r.overtime_hours * 10) / 10,
          }))}
          columns={[
            { header: "Mã NV", key: "employee_code", width: 15 },
            { header: "Họ và tên", key: "full_name", width: 25 },
            { header: "Tổng ngày", key: "total_days", width: 10 },
            { header: "Có mặt", key: "present_days", width: 10 },
            { header: "Vắng mặt", key: "absent_days", width: 10 },
            { header: "Đi trễ", key: "late_days", width: 10 },
            { header: "Về sớm", key: "early_leave_days", width: 10 },
            { header: "Tăng ca (giờ)", key: "overtime_hours_formatted", width: 15 },
          ]}
          filename={`Bang_cong_thang_${month}_${year}`}
          title={`Bảng Công Tháng ${month}/${year}`}
          disabled={!filtered.length}
        />
      </div>

      {monthlySummary.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="surface-card h-24 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard label="Tổng ngày công" value={totals.total_days} unit="ngày" />
          <SummaryCard label="Có mặt" value={totals.present_days} unit="ngày" color="green" />
          <SummaryCard label="Tăng ca" value={totals.overtime_hours.toFixed(1)} unit="giờ" color="blue" />
        </section>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label className="mb-2 block text-sm font-medium">Chọn tháng</label>
          <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
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

      {monthlySummary.isLoading ? (
        <LoadingState rows={8} />
      ) : monthlySummary.isError ? (
        <ErrorState description={(monthlySummary.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Không có dữ liệu chấm công" description="Chưa có bản ghi chấm công cho tháng này." />
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
                    <TableCell className="text-right font-medium">{record.overtime_hours.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

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
                <p className="mt-1 text-lg font-bold text-orange-600">{totals.early_leave_days}</p>
              </div>
              <div className="sm:col-span-2 md:col-span-2 lg:col-span-2">
                <p className="text-xs font-medium text-muted-foreground">Tăng ca</p>
                <p className="mt-1 text-lg font-bold text-blue-600">{totals.overtime_hours.toFixed(1)} giờ</p>
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
  color = "gray",
}: {
  label: string;
  value: string | number;
  unit: string;
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
          <TrendingUp className="size-5" />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab: Xuất dữ liệu chi tiết (gộp từ trang "Báo cáo & Xuất dữ liệu" cũ) —
// bộ lọc theo tháng/khoảng ngày/nhân viên/phòng ban, xuất Excel/CSV/PDF thật.
// ---------------------------------------------------------------------------

type ExportFormat = "excel" | "csv" | "pdf";
type FilterType = "month" | "date-range" | "staff" | "department";

type AttendanceExportRow = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  worked_minutes: number | null;
  late_minutes: number | null;
  overtime_minutes: number | null;
  attendance_status: string;
  employees: {
    full_name: string;
    employee_code: string;
    departments: { name: string } | null;
  } | null;
};

function ExportTab() {
  const { org } = Route.useRouteContext();
  const now = new Date();
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [filterType, setFilterType] = useState<FilterType>("month");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [exporting, setExporting] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["staff-list-export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, department_id")
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments-list-export"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const departmentEmployeeIdsQuery = useQuery({
    queryKey: ["department-employee-ids", selectedDepartment],
    enabled: filterType === "department" && Boolean(selectedDepartment),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id")
        .eq("department_id", selectedDepartment)
        .is("deleted_at", null);
      if (error) throw error;
      return (data || []).map((row) => row.id);
    },
  });

  const range = useMemo(() => {
    if (filterType === "month") {
      return { start: `${year}-${String(month).padStart(2, "0")}-01`, end: lastDayOfMonth(year, month) };
    }
    if (filterType === "date-range") {
      return { start: startDate || null, end: endDate || null };
    }
    return { start: null, end: null };
  }, [filterType, month, year, startDate, endDate]);

  const attendanceQuery = useQuery({
    queryKey: [
      "attendance-export",
      filterType,
      selectedStaff,
      selectedDepartment,
      range.start,
      range.end,
      departmentEmployeeIdsQuery.data,
    ],
    enabled:
      (filterType !== "date-range" || Boolean(range.start && range.end)) &&
      (filterType !== "staff" || Boolean(selectedStaff)) &&
      (filterType !== "department" || Boolean(departmentEmployeeIdsQuery.data)),
    queryFn: async () => {
      let query = supabase
        .from("attendance_records")
        .select(
          `id, employee_id, work_date, check_in_time, check_out_time, worked_minutes, late_minutes, overtime_minutes, attendance_status,
          employees:employee_id ( full_name, employee_code, departments:department_id ( name ) )`,
        )
        .is("deleted_at", null);

      if (filterType === "staff" && selectedStaff) {
        query = query.eq("employee_id", selectedStaff);
      }
      if (filterType === "department") {
        query = query.in("employee_id", departmentEmployeeIdsQuery.data ?? []);
      }
      if (range.start) query = query.gte("work_date", range.start);
      if (range.end) query = query.lte("work_date", range.end);

      const { data, error } = await query.order("work_date", { ascending: false });
      if (error) throw error;
      return (data as unknown as AttendanceExportRow[]) || [];
    },
  });

  const rows = attendanceQuery.data ?? [];

  const exportRows = () => {
    if (rows.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }
    setExporting(true);
    try {
      const fileLabel =
        filterType === "month"
          ? `thang-${month}-${year}`
          : `${range.start ?? "tat-ca"}_${range.end ?? "tat-ca"}`;

      const header = [
        "Mã NV",
        "Họ tên",
        "Phòng ban",
        "Ngày công",
        "Giờ vào",
        "Giờ ra",
        "Số phút làm",
        "Trễ (phút)",
        "Tăng ca (phút)",
        "Trạng thái",
      ];
      const body = rows.map((r) => [
        r.employees?.employee_code ?? "",
        r.employees?.full_name ?? "N/A",
        r.employees?.departments?.name ?? "—",
        r.work_date,
        r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString("vi-VN") : "—",
        r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString("vi-VN") : "—",
        r.worked_minutes ?? 0,
        r.late_minutes ?? 0,
        r.overtime_minutes ?? 0,
        STATUS_LABELS[r.attendance_status]?.label ?? r.attendance_status,
      ]);

      if (format === "csv") {
        const csv = [
          header.join(","),
          ...body.map((row) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `cham-cong-${fileLabel}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success("Đã xuất file CSV");
      } else if (format === "excel") {
        const sheetData: (string | number)[][] = [[org.name], ["BÁO CÁO CHẤM CÔNG CHI TIẾT"], [], header, ...body];
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        worksheet["!cols"] = header.map((h) => ({ wch: Math.max(12, h.length + 2) }));
        worksheet["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: header.length - 1 } },
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cham cong");
        XLSX.writeFile(workbook, `cham-cong-${fileLabel}.xlsx`);
        toast.success("Đã xuất file Excel");
      } else {
        window.print();
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3 print:hidden">
        <div className="lg:col-span-1">
          <Card className="space-y-6 p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Filter className="size-5" />
              Bộ lọc
            </h3>

            <div className="space-y-2">
              <Label>Loại lọc</Label>
              <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Theo tháng</SelectItem>
                  <SelectItem value="date-range">Theo khoảng ngày</SelectItem>
                  <SelectItem value="staff">Theo nhân viên</SelectItem>
                  <SelectItem value="department">Theo phòng ban</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterType === "month" && (
              <div className="space-y-2">
                <Label>Chọn tháng</Label>
                <MonthYearPicker month={month} year={year} onMonth={setMonth} onYear={setYear} />
              </div>
            )}

            {filterType === "date-range" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Từ ngày</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Đến ngày</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            )}

            {filterType === "staff" && (
              <div className="space-y-2">
                <Label>Chọn nhân viên</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhân viên..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffQuery.data?.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterType === "department" && (
              <div className="space-y-2">
                <Label>Chọn phòng ban</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn phòng ban..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentsQuery.data?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 border-t pt-4">
              <Label className="block font-semibold">Định dạng xuất</Label>
              <div className="space-y-2">
                {(["excel", "csv", "pdf"] as const).map((fmt) => (
                  <div
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={`cursor-pointer rounded-lg border-2 p-3 transition ${
                      format === fmt ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex size-4 items-center justify-center rounded-full border-2 ${
                          format === fmt ? "border-primary bg-primary" : "border-muted-foreground/40"
                        }`}
                      >
                        {format === fmt && <div className="size-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className="font-medium uppercase">{fmt.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={exportRows} disabled={exporting || rows.length === 0} className="h-10 w-full text-base" size="lg">
              {format === "pdf" ? <Printer className="mr-2 size-4" /> : <Download className="mr-2 size-4" />}
              {exporting ? "Đang xuất..." : "Xuất báo cáo"}
            </Button>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <Card className="surface-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Bản ghi tìm thấy</p>
                  <p className="mt-1 text-3xl font-bold text-primary">{rows.length}</p>
                </div>
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileSpreadsheet className="size-4" />
                </div>
              </div>
            </Card>

            <Card className="surface-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Định dạng xuất</p>
                  <p className="mt-1 text-3xl font-bold uppercase text-success">{format}</p>
                </div>
                <div className="flex size-8 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Download className="size-4" />
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold">Xem trước dữ liệu</h3>
            {attendanceQuery.isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>
            ) : rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Nhân viên</th>
                      <th className="px-4 py-2 text-left font-semibold">Ngày công</th>
                      <th className="px-4 py-2 text-left font-semibold">Giờ vào</th>
                      <th className="px-4 py-2 text-left font-semibold">Giờ ra</th>
                      <th className="px-4 py-2 text-right font-semibold">Trễ (phút)</th>
                      <th className="px-4 py-2 text-right font-semibold">Tăng ca (phút)</th>
                      <th className="px-4 py-2 text-left font-semibold">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((record) => {
                      const status = STATUS_LABELS[record.attendance_status];
                      return (
                        <tr key={record.id} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2">{record.employees?.full_name || "N/A"}</td>
                          <td className="px-4 py-2 text-xs">{record.work_date}</td>
                          <td className="px-4 py-2 text-xs">
                            {record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString("vi-VN") : "—"}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString("vi-VN") : "—"}
                          </td>
                          <td className="px-4 py-2 text-right">{record.late_minutes || 0}</td>
                          <td className="px-4 py-2 text-right">{record.overtime_minutes || 0}</td>
                          <td className="px-4 py-2">
                            <Badge className={`${status?.color ?? "bg-muted text-muted-foreground"} border-0`}>
                              {status?.label ?? record.attendance_status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > 8 && (
                  <div className="mt-4 p-2 text-center text-sm text-muted-foreground">
                    ...và {rows.length - 8} bản ghi khác
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <AlertCircle className="mx-auto mb-2 size-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">Không có dữ liệu. Vui lòng chọn bộ lọc khác.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="hidden p-8 text-black print:block">
        <h1 className="text-xl font-bold">{org.name}</h1>
        <h2 className="mt-1 text-lg font-semibold">BÁO CÁO CHẤM CÔNG CHI TIẾT</h2>
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-1 text-left">Mã NV</th>
              <th className="py-1 text-left">Họ tên</th>
              <th className="py-1 text-left">Ngày công</th>
              <th className="py-1 text-left">Giờ vào</th>
              <th className="py-1 text-left">Giờ ra</th>
              <th className="py-1 text-right">Trễ (phút)</th>
              <th className="py-1 text-right">Tăng ca (phút)</th>
              <th className="py-1 text-left">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-300">
                <td className="py-1">{r.employees?.employee_code ?? ""}</td>
                <td className="py-1">{r.employees?.full_name ?? "N/A"}</td>
                <td className="py-1">{r.work_date}</td>
                <td className="py-1">{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString("vi-VN") : "—"}</td>
                <td className="py-1">{r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString("vi-VN") : "—"}</td>
                <td className="py-1 text-right">{r.late_minutes || 0}</td>
                <td className="py-1 text-right">{r.overtime_minutes || 0}</td>
                <td className="py-1">{STATUS_LABELS[r.attendance_status]?.label ?? r.attendance_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-10 text-right text-sm">Ngày in: {new Date().toLocaleDateString("vi-VN")}</p>
      </div>
    </>
  );
}
