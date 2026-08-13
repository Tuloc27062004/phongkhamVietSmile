import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  CalendarDays,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/issues/my-reports")({
  head: () => ({
    meta: [
      { title: "Báo cáo của tôi — Việt Smile Clinic" },
      { name: "description", content: "Xem lịch sử các báo cáo sự cố của bạn" },
    ],
  }),
  component: MyReports,
});

interface Report {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  description: string;
  updated_at: string;
}

function MyReports() {
  const { session } = useAuthSession();

  const reportsQuery = useQuery({
    queryKey: ["my-reports", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("error_reports")
        .select("*")
        .eq("user_id", session?.user.id ?? "")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((report) => ({
        id: report.id,
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

  if (reportsQuery.isLoading) {
    return <LoadingState rows={4} />;
  }

  if (reportsQuery.isError) {
    return <ErrorState description={reportsQuery.error?.message} />;
  }

  const reports = reportsQuery.data || [];

  const stats = {
    total: reports.length,
    open: reports.filter((r) => r.status === "open").length,
    in_progress: reports.filter((r) => r.status === "in_progress").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "bug":
        return "🐛";
      case "feature":
        return "✨";
      case "feedback":
        return "💬";
      default:
        return "📝";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "bug":
        return "Lỗi";
      case "feature":
        return "Tính năng";
      case "feedback":
        return "Phản hồi";
      default:
        return "Khác";
    }
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
        return <MessageSquare className="size-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Mở";
      case "in_progress":
        return "Đang xử lý";
      case "resolved":
        return "Đã giải quyết";
      case "wont_fix":
        return "Không sửa";
      default:
        return "Khác";
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

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "low":
        return "Thấp";
      case "medium":
        return "Trung bình";
      case "high":
        return "Cao";
      case "urgent":
        return "Khẩn cấp";
      default:
        return "N/A";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo của tôi"
        description="Xem và theo dõi tất cả các báo cáo sự cố của bạn"
      />

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tổng cộng" value={stats.total} color="blue" />
        <StatCard label="Mở" value={stats.open} color="orange" />
        <StatCard label="Đang xử lý" value={stats.in_progress} color="purple" />
        <StatCard label="Đã giải quyết" value={stats.resolved} color="green" />
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {reports.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="mb-2 size-12 text-gray-300" />
              <p className="text-gray-600">Bạn chưa gửi báo cáo nào</p>
              <a href="/issues/report" className="mt-2 text-sm text-blue-600 hover:underline">
                Gửi báo cáo mới
              </a>
            </div>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="overflow-hidden border-0 shadow-md hover:shadow-lg transition">
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getCategoryIcon(report.category)}</span>
                      <h3 className="font-semibold text-gray-900">{report.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusIcon(report.status)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{getCategoryLabel(report.category)}</Badge>
                  <Badge className={`${getPriorityColor(report.priority)} border-0`}>
                    {getPriorityLabel(report.priority)}
                  </Badge>
                  <Badge variant="secondary">{getStatusLabel(report.status)}</Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {new Date(report.created_at).toLocaleDateString("vi-VN")}
                  </span>
                  {report.updated_at !== report.created_at && (
                    <span>
                      Cập nhật: {new Date(report.updated_at).toLocaleDateString("vi-VN")}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "orange" | "purple" | "green";
}) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 text-blue-600",
    orange: "from-orange-50 to-orange-100 text-orange-600",
    purple: "from-purple-50 to-purple-100 text-purple-600",
    green: "from-green-50 to-green-100 text-green-600",
  };

  return (
    <Card className={`overflow-hidden border-0 bg-gradient-to-br ${colorClasses[color]} shadow-md`}>
      <div className="space-y-2 p-4">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
