import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  Calendar,
  Download,
  FileText,
  Filter,
  PieChart,
  Plus,
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

export const Route = createFileRoute("/_authenticated/reports/attendance")({
  head: () => ({
    meta: [
      { title: "Báo cáo chấm công — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Tạo và xuất báo cáo chấm công chi tiết.",
      },
      {
        property: "og:title",
        content: "Báo cáo chấm công — Việt Smile Clinic Suite",
      },
    ],
  }),
  component: AttendanceReportsPage,
});

type Report = {
  id: string;
  report_name: string;
  report_type: "daily" | "weekly" | "monthly";
  generated_date: string;
  file_format: "excel" | "csv" | "pdf";
  file_size: number;
  generated_by: string;
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

function AttendanceReportsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <PageHeader
        title="Báo cáo chấm công"
        description="Tạo, quản lý và tải xuống báo cáo chấm công theo ngày, tuần hoặc tháng."
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 size-4" />
            Tạo báo cáo
          </Button>
        }
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
            icon={<FileText className="size-5" />}
            label="Tổng báo cáo"
            value={stats.data.total}
          />
          <StatCard
            icon={<Calendar className="size-5 text-blue-600" />}
            label="Báo cáo ngày"
            value={stats.data.daily}
          />
          <StatCard
            icon={<BarChart3 className="size-5 text-green-600" />}
            label="Báo cáo tuần"
            value={stats.data.weekly}
            color="green"
          />
          <StatCard
            icon={<TrendingUp className="size-5 text-purple-600" />}
            label="Báo cáo tháng"
            value={stats.data.monthly}
            color="purple"
          />
        </section>
      ) : null}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Tìm kiếm</label>
          <div className="relative">
            <Input
              placeholder="Tìm theo tên báo cáo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
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

      {/* Reports List */}
      {reports.isLoading ? (
        <LoadingState rows={8} />
      ) : reports.isError ? (
        <ErrorState description={(reports.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có báo cáo"
          description="Tạo báo cáo mới để xem chi tiết chấm công."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card key={report.id} className="surface-card p-4">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {FILE_FORMAT_ICONS[report.file_format] || "📄"}
                    </div>
                    <div>
                      <p className="font-semibold">{report.report_name}</p>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span>
                          Loại: {REPORT_TYPE_LABELS[report.report_type]}
                        </span>
                        <span>•</span>
                        <span>{formatDate(report.generated_date)}</span>
                        <span>•</span>
                        <span>{formatFileSize(report.file_size)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      report.status === "completed"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {report.status === "completed"
                      ? "Hoàn tất"
                      : "Đang xử lý"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={report.status !== "completed"}
                  >
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

function StatCard({
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
