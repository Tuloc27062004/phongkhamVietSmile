import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Plus,
  TrendingUp,
} from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug/reports/attendance")({
  head: () => ({
    meta: [
      { title: "Báo cáo & Xuất dữ liệu — GZV Clinic Platform" },
      {
        name: "description",
        content: "Báo cáo chấm công, lịch hẹn và xuất dữ liệu.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Báo cáo & Xuất dữ liệu"
        description="Tạo, quản lý và xuất báo cáo chấm công, lịch hẹn của phòng khám."
      />
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Chấm công</TabsTrigger>
          <TabsTrigger value="appointments">Lịch hẹn</TabsTrigger>
          <TabsTrigger value="export">Xuất dữ liệu</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="mt-6">
          <AttendanceReportsTab />
        </TabsContent>
        <TabsContent value="appointments" className="mt-6">
          <AppointmentReportsTab />
        </TabsContent>
        <TabsContent value="export" className="mt-6">
          <ExportReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type Report = {
  id: string;
  report_name: string;
  report_type: "daily" | "weekly" | "monthly";
  generated_date: string;
  file_format: "excel" | "csv" | "pdf";
  file_size: number;
  generated_by?: string;
  status: "completed" | "processing";
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  daily: "Báo cáo ngày",
  weekly: "Báo cáo tuần",
  monthly: "Báo cáo tháng",
};

const FILE_FORMAT_ICONS: Record<string, string> = {
  excel: "📊",
  csv: "📄",
  pdf: "📕",
};

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReportStatCard({
  icon,
  label,
  value,
  color = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: "blue" | "green" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
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

function AttendanceReportsTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const reports = useQuery({
    queryKey: ["attendance-reports", typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("reports")
        .select(
          "id, report_name, report_type, generated_date, file_format, file_size, generated_by, status",
        )
        .eq("report_category", "attendance")
        .order("generated_date", { ascending: false })
        .limit(50);

      if (typeFilter) {
        query = query.eq("report_type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Report[]) || [];
    },
  });

  const stats = useQuery({
    queryKey: ["reports-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("report_type, status", { count: "exact" })
        .eq("report_category", "attendance");

      if (error) throw error;

      const records = (data as Array<{ report_type: string; status: string }>) || [];
      return {
        total: records.length,
        daily: records.filter((r) => r.report_type === "daily").length,
        weekly: records.filter((r) => r.report_type === "weekly").length,
        monthly: records.filter((r) => r.report_type === "monthly").length,
      };
    },
  });

  const filtered = (reports.data ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    return !term || record.report_name.toLowerCase().includes(term);
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button disabled title="Tính năng tạo báo cáo theo lịch sẽ có ở giai đoạn sau">
          <Plus className="mr-2 size-4" />
          Tạo báo cáo
        </Button>
      </div>

      {stats.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : stats.data ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReportStatCard icon={<FileText className="size-5" />} label="Tổng báo cáo" value={stats.data.total} />
          <ReportStatCard
            icon={<Calendar className="size-5 text-blue-600" />}
            label="Báo cáo ngày"
            value={stats.data.daily}
          />
          <ReportStatCard
            icon={<BarChart3 className="size-5 text-green-600" />}
            label="Báo cáo tuần"
            value={stats.data.weekly}
            color="green"
          />
          <ReportStatCard
            icon={<TrendingUp className="size-5 text-purple-600" />}
            label="Báo cáo tháng"
            value={stats.data.monthly}
            color="purple"
          />
        </section>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Tìm kiếm</label>
          <Input
            placeholder="Tìm theo tên báo cáo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Lọc loại báo cáo</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="Tất cả loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả loại</SelectItem>
              <SelectItem value="daily">Báo cáo ngày</SelectItem>
              <SelectItem value="weekly">Báo cáo tuần</SelectItem>
              <SelectItem value="monthly">Báo cáo tháng</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {reports.isLoading ? (
        <LoadingState rows={8} />
      ) : reports.isError ? (
        <ErrorState description={(reports.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Không có báo cáo" description="Tạo báo cáo mới để xem chi tiết chấm công." />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card key={report.id} className="surface-card p-4">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{FILE_FORMAT_ICONS[report.file_format] || "📄"}</div>
                    <div>
                      <p className="font-semibold">{report.report_name}</p>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Loại: {REPORT_TYPE_LABELS[report.report_type]}</span>
                        <span>•</span>
                        <span>{formatDate(report.generated_date)}</span>
                        <span>•</span>
                        <span>{formatFileSize(report.file_size)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={report.status === "completed" ? "default" : "secondary"}>
                    {report.status === "completed" ? "Hoàn tất" : "Đang xử lý"}
                  </Badge>
                  <Button size="sm" variant="outline" disabled={report.status !== "completed"}>
                    <Download className="mr-2 size-4" />
                    Tải
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AppointmentReportsTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const reports = useQuery({
    queryKey: ["appointment-reports", typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("reports")
        .select("id, report_name, report_type, generated_date, file_format, file_size, status")
        .eq("report_category", "appointments")
        .order("generated_date", { ascending: false })
        .limit(50);

      if (typeFilter) {
        query = query.eq("report_type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Report[]) || [];
    },
  });

  const stats = useQuery({
    queryKey: ["appointment-reports-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("report_type", { count: "exact" })
        .eq("report_category", "appointments");

      if (error) throw error;

      const records = (data as Array<{ report_type: string }>) || [];
      return {
        total: records.length,
        daily: records.filter((r) => r.report_type === "daily").length,
        weekly: records.filter((r) => r.report_type === "weekly").length,
        monthly: records.filter((r) => r.report_type === "monthly").length,
      };
    },
  });

  const filtered = (reports.data ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    return !term || record.report_name.toLowerCase().includes(term);
  });

  return (
    <div>
      {stats.isLoading ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : stats.data ? (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReportStatCard icon={<FileText className="size-5" />} label="Tổng báo cáo" value={stats.data.total} />
          <ReportStatCard
            icon={<Calendar className="size-5 text-blue-600" />}
            label="Báo cáo ngày"
            value={stats.data.daily}
          />
          <ReportStatCard
            icon={<BarChart3 className="size-5 text-green-600" />}
            label="Báo cáo tuần"
            value={stats.data.weekly}
            color="green"
          />
          <ReportStatCard
            icon={<TrendingUp className="size-5 text-purple-600" />}
            label="Báo cáo tháng"
            value={stats.data.monthly}
            color="purple"
          />
        </section>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Tìm kiếm</label>
          <Input
            placeholder="Tìm theo tên báo cáo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Lọc loại báo cáo</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="Tất cả loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả loại</SelectItem>
              <SelectItem value="daily">Báo cáo ngày</SelectItem>
              <SelectItem value="weekly">Báo cáo tuần</SelectItem>
              <SelectItem value="monthly">Báo cáo tháng</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {reports.isLoading ? (
        <LoadingState rows={8} />
      ) : reports.isError ? (
        <ErrorState description={(reports.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Không có báo cáo" description="Tạo báo cáo mới để xem chi tiết lịch hẹn." />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card key={report.id} className="surface-card p-4">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{FILE_FORMAT_ICONS[report.file_format] || "📄"}</div>
                    <div>
                      <p className="font-semibold">{report.report_name}</p>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Loại: {REPORT_TYPE_LABELS[report.report_type]}</span>
                        <span>•</span>
                        <span>{formatDate(report.generated_date)}</span>
                        <span>•</span>
                        <span>{formatFileSize(report.file_size)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={report.status === "completed" ? "default" : "secondary"}>
                    {report.status === "completed" ? "Hoàn tất" : "Đang xử lý"}
                  </Badge>
                  <Button size="sm" variant="outline" disabled={report.status !== "completed"}>
                    <Download className="mr-2 size-4" />
                    Tải
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type ExportFormat = "excel" | "pdf" | "csv" | "docs";
type FilterType = "all" | "staff" | "department" | "date-range";

function ExportReportsTab() {
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [filterType, setFilterType] = useState<FilterType>("date-range");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, department_id")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance-export", { filterType, selectedStaff, selectedDepartment, startDate, endDate }],
    queryFn: async () => {
      let query = supabase.from("attendance_records").select(`
          id,
          employee_id,
          check_in_time,
          check_out_time,
          worked_minutes,
          attendance_status,
          employees:employee_id (
            id,
            full_name,
            department_id,
            departments:department_id (
              id,
              name
            )
          )
        `);

      if (filterType === "staff" && selectedStaff) {
        query = query.eq("employee_id", selectedStaff);
      }

      if (filterType === "department" && selectedDepartment) {
        query = query.eq("employees.department_id", selectedDepartment);
      }

      if (filterType === "date-range") {
        if (startDate) query = query.gte("check_in_time", `${startDate}T00:00:00`);
        if (endDate) query = query.lte("check_in_time", `${endDate}T23:59:59`);
      }

      const { data, error } = await query.order("check_in_time", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: filterType !== "date-range" || Boolean(startDate && endDate),
  });

  const handleExport = async () => {
    if (!attendanceQuery.data || attendanceQuery.data.length === 0) {
      alert("Không có dữ liệu để xuất");
      return;
    }

    setExporting(true);

    try {
      const fileName = `attendance-report-${new Date().toISOString().split("T")[0]}.${
        format === "excel" ? "xlsx" : format === "csv" ? "csv" : format === "docs" ? "docx" : "pdf"
      }`;

      if (format === "csv") {
        const headers = ["Nhân viên", "Ngày/Giờ vào", "Giờ ra", "Thời gian (phút)", "Trạng thái"];
        const rows = attendanceQuery.data.map((record: any) => [
          record.employees?.full_name || "N/A",
          new Date(record.check_in_time).toLocaleString("vi-VN"),
          record.check_out_time ? new Date(record.check_out_time).toLocaleString("vi-VN") : "Chưa ra",
          record.worked_minutes || 0,
          record.attendance_status || "Có mặt",
        ]);

        const csv = [
          headers.join(","),
          ...rows.map((row: (string | number)[]) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(url);
      } else if (format === "excel") {
        alert(`Xuất Excel được kích hoạt.\nFileName: ${fileName}\n\nSử dụng thư viện xlsx trong production`);
      } else if (format === "pdf") {
        alert(`Xuất PDF được kích hoạt.\nFileName: ${fileName}\n\nSử dụng thư viện pdfkit trong production`);
      } else if (format === "docs") {
        alert(`Xuất Docs được kích hoạt.\nFileName: ${fileName}\n\nSử dụng thư viện docx trong production`);
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Lỗi khi xuất báo cáo");
    } finally {
      setExporting(false);
    }
  };

  if (staffQuery.isLoading || departmentsQuery.isLoading) {
    return <LoadingState />;
  }

  if (staffQuery.error || departmentsQuery.error) {
    return <ErrorState description="Lỗi tải dữ liệu" />;
  }

  const recordCount = attendanceQuery.data?.length || 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <Card className="space-y-6 p-6">
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Filter className="size-5" />
              Bộ lọc
            </h3>
          </div>

          <div className="space-y-2">
            <Label>Loại lọc</Label>
            <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-range">Theo ngày</SelectItem>
                <SelectItem value="staff">Theo nhân viên</SelectItem>
                <SelectItem value="department">Theo phòng ban</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterType === "date-range" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Từ ngày</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Đến ngày</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
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
              {(["excel", "pdf", "csv", "docs"] as const).map((fmt) => (
                <div
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`cursor-pointer rounded-lg border-2 p-3 transition ${
                    format === fmt ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex size-4 items-center justify-center rounded-full border-2 ${
                        format === fmt ? "border-primary bg-primary" : "border-gray-400"
                      }`}
                    >
                      {format === fmt && <div className="size-2 rounded-full bg-white" />}
                    </div>
                    <span className="font-medium uppercase">{fmt.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting || recordCount === 0}
            className="h-10 w-full text-base"
            size="lg"
          >
            <Download className="mr-2 size-4" />
            {exporting ? "Đang xuất..." : "Xuất báo cáo"}
          </Button>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bản ghi tìm thấy</p>
                <p className="mt-1 text-3xl font-bold text-blue-600">{recordCount}</p>
              </div>
              <FileText className="size-8 text-blue-200" />
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Định dạng xuất</p>
                <p className="mt-1 text-3xl font-bold uppercase text-green-600">{format}</p>
              </div>
              <CheckCircle2 className="size-8 text-green-200" />
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold">Xem trước dữ liệu</h3>
          {attendanceQuery.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>
          ) : attendanceQuery.data && attendanceQuery.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Nhân viên</th>
                    <th className="px-4 py-2 text-left font-semibold">Giờ vào</th>
                    <th className="px-4 py-2 text-left font-semibold">Giờ ra</th>
                    <th className="px-4 py-2 text-right font-semibold">Thời gian (phút)</th>
                    <th className="px-4 py-2 text-left font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceQuery.data.slice(0, 5).map((record: any) => (
                    <tr key={record.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-2">{record.employees?.full_name || "N/A"}</td>
                      <td className="px-4 py-2 text-xs">
                        {new Date(record.check_in_time).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {record.check_out_time
                          ? new Date(record.check_out_time).toLocaleString("vi-VN")
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">{record.worked_minutes || 0}</td>
                      <td className="px-4 py-2">
                        <Badge variant={record.attendance_status === "late" ? "destructive" : "default"}>
                          {record.attendance_status || "Có mặt"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {attendanceQuery.data.length > 5 && (
                <div className="mt-4 p-2 text-center text-sm text-muted-foreground">
                  ...và {attendanceQuery.data.length - 5} bản ghi khác
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
  );
}
