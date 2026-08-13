import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileText,
  Filter,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";

import { PageHeader, ErrorState, LoadingState } from "@/components/page-state";
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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reports/export")({
  head: () => ({
    meta: [
      { title: "Xuất Báo Cáo — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Xuất báo cáo chấm công theo định dạng Excel, PDF, Docs với lọc ngày tháng năm.",
      },
    ],
  }),
  component: ExportReportsPage,
});

type ExportFormat = "excel" | "pdf" | "csv" | "docs";
type FilterType = "all" | "staff" | "department" | "date-range";

function ExportReportsPage() {
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
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance-export", { filterType, selectedStaff, selectedDepartment, startDate, endDate }],
    queryFn: async () => {
      let query = supabase
        .from("attendance_records")
        .select(`
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
      // Simulate export - in production, use a library like xlsx, pdfkit, or docx
      const fileName = `attendance-report-${new Date().toISOString().split("T")[0]}.${
        format === "excel" ? "xlsx" : format === "csv" ? "csv" : format === "docs" ? "docx" : "pdf"
      }`;

      // For demonstration, create CSV
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
    <div className="space-y-6">
      <PageHeader
        title="Xuất Báo Cáo"
        description="Xuất dữ liệu chấm công theo định dạng Excel, PDF, CSV hoặc Docs"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Filters Section */}
        <div className="lg:col-span-1">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Bộ lọc
              </h3>
            </div>

            {/* Filter Type Selection */}
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

            {/* Date Range Filter */}
            {filterType === "date-range" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Từ ngày</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Đến ngày</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Staff Filter */}
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

            {/* Department Filter */}
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

            {/* Export Format Selection */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="block font-semibold">Định dạng xuất</Label>
              <div className="space-y-2">
                {(["excel", "pdf", "csv", "docs"] as const).map((fmt) => (
                  <div
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      format === fmt
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          format === fmt ? "border-primary bg-primary" : "border-gray-400"
                        }`}
                      >
                        {format === fmt && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="capitalize font-medium">{fmt.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Button */}
            <Button
              onClick={handleExport}
              disabled={exporting || recordCount === 0}
              className="w-full h-10 text-base"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "Đang xuất..." : "Xuất báo cáo"}
            </Button>
          </Card>
        </div>

        {/* Preview Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Bản ghi tìm thấy</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{recordCount}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-200" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Định dạng xuất</p>
                  <p className="text-3xl font-bold text-green-600 mt-1 uppercase">{format}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-200" />
              </div>
            </Card>
          </div>

          {/* Data Preview */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Xem trước dữ liệu</h3>
            {attendanceQuery.isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Đang tải dữ liệu...</div>
            ) : attendanceQuery.data && attendanceQuery.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b">
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
                          <Badge
                            variant={record.attendance_status === "late" ? "destructive" : "default"}
                          >
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
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Không có dữ liệu. Vui lòng chọn bộ lọc khác.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
