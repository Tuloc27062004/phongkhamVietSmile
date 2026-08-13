import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  Zap,
  TrendingUp,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/issues")({
  head: () => ({
    meta: [
      { title: "Quản lý báo cáo — Việt Smile Clinic" },
      { name: "description", content: "Quản lý tất cả báo cáo sự cố từ người dùng" },
    ],
  }),
  component: AdminIssues,
});

interface Report {
  id: string;
  user_email: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  description: string;
  updated_at: string;
}

function AdminIssues() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  const reportsQuery = useQuery({
    queryKey: ["all-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("error_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((report) => ({
        id: report.id,
        user_email: report.user_email,
        title: report.title,
        category: report.category || "other",
        priority: report.priority || "medium",
        status: report.status || "open",
        created_at: report.created_at,
        description: report.description,
        updated_at: report.updated_at || report.created_at,
      }));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("error_reports")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-reports"] });
    },
  });

  if (reportsQuery.isLoading) {
    return <LoadingState rows={5} />;
  }

  if (reportsQuery.isError) {
    return <ErrorState description={reportsQuery.error?.message} />;
  }

  const reports = reportsQuery.data || [];
  const filtered = reports.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && 
        !r.user_email.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterPriority && r.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    total: reports.length,
    open: reports.filter((r) => r.status === "open").length,
    in_progress: reports.filter((r) => r.status === "in_progress").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    urgent: reports.filter((r) => r.priority === "urgent").length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="size-4 text-orange-600" />;
      case "in_progress":
        return <Clock className="size-4 text-blue-600" />;
      case "resolved":
        return <CheckCircle2 className="size-4 text-green-600" />;
      case "wont_fix":
        return <AlertTriangle className="size-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "bg-blue-100 text-blue-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "urgent":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý báo cáo"
        description="Xem và quản lý tất cả báo cáo sự cố từ người dùng"
      />

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-5">
        <KPICard label="Tổng báo cáo" value={stats.total} color="blue" />
        <KPICard label="Mở" value={stats.open} color="orange" />
        <KPICard label="Đang xử lý" value={stats.in_progress} color="purple" />
        <KPICard label="Đã giải quyết" value={stats.resolved} color="green" />
        <KPICard label="Khẩn cấp" value={stats.urgent} color="red" icon={<Zap className="size-4" />} />
      </div>

      {/* Search & Filter */}
      <Card className="border-0 shadow-md">
        <div className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm tiêu đề hoặc email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <select
              value={filterStatus || ""}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="open">Mở</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="resolved">Đã giải quyết</option>
              <option value="wont_fix">Không sửa</option>
            </select>

            <select
              value={filterPriority || ""}
              onChange={(e) => setFilterPriority(e.target.value || null)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Tất cả mức độ</option>
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
              <option value="urgent">Khẩn cấp</option>
            </select>
          </div>

          <p className="text-sm text-gray-600">
            Tìm thấy {filtered.length} báo cáo
          </p>
        </div>
      </Card>

      {/* Reports Table */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <div className="flex flex-col items-center justify-center py-12">
              <Filter className="mb-2 size-12 text-gray-300" />
              <p className="text-gray-600">Không tìm thấy báo cáo nào</p>
            </div>
          </Card>
        ) : (
          filtered.map((report) => (
            <Card key={report.id} className="overflow-hidden border-0 shadow-md hover:shadow-lg transition">
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getStatusIcon(report.status)}</div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{report.title}</h3>
                        <p className="text-sm text-gray-600">{report.description.substring(0, 100)}...</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Từ: <span className="font-medium text-gray-700">{report.user_email}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{report.category}</Badge>
                    <Badge className={`${getPriorityColor(report.priority)} border-0`}>
                      {report.priority}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    {report.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id: report.id,
                            status: report.status === "open" ? "in_progress" : "resolved",
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        {report.status === "open"
                          ? "Bắt đầu xử lý"
                          : "Đánh dấu hoàn thành"}
                      </Button>
                    )}
                    {report.status !== "wont_fix" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            id: report.id,
                            status: "wont_fix",
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        Không sửa
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Gửi: {new Date(report.created_at).toLocaleString("vi-VN")}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
}) {
  const colorClasses: Record<string, string> = {
    blue: "from-blue-50 to-blue-100 text-blue-600",
    orange: "from-orange-50 to-orange-100 text-orange-600",
    purple: "from-purple-50 to-purple-100 text-purple-600",
    green: "from-green-50 to-green-100 text-green-600",
    red: "from-red-50 to-red-100 text-red-600",
  };

  return (
    <Card className={`overflow-hidden border-0 bg-gradient-to-br ${colorClasses[color]} shadow-md`}>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          {icon}
        </div>
        <p className="text-3xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
