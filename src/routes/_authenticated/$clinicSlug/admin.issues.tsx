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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug/admin/issues")({
  head: () => ({
    meta: [
      { title: "Quản lý báo cáo — GZV Clinic Platform" },
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
        return <AlertCircle className="size-4 text-warning" />;
      case "in_progress":
        return <Clock className="size-4 text-info" />;
      case "resolved":
        return <CheckCircle2 className="size-4 text-success" />;
      case "wont_fix":
        return <AlertTriangle className="size-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "bg-info/10 text-info";
      case "medium":
        return "bg-warning/10 text-warning-foreground";
      case "high":
        return "bg-warning/15 text-warning-foreground";
      case "urgent":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
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
        <KPICard label="Tổng báo cáo" value={stats.total} tone="primary" />
        <KPICard label="Mở" value={stats.open} tone="warning" />
        <KPICard label="Đang xử lý" value={stats.in_progress} tone="info" />
        <KPICard label="Đã giải quyết" value={stats.resolved} tone="success" />
        <KPICard label="Khẩn cấp" value={stats.urgent} tone="destructive" icon={<Zap className="size-4" />} />
      </div>

      {/* Search & Filter */}
      <Card className="quiet-card p-6">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm tiêu đề hoặc email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select
              value={filterStatus ?? "all"}
              onValueChange={(v) => setFilterStatus(v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="open">Mở</SelectItem>
                <SelectItem value="in_progress">Đang xử lý</SelectItem>
                <SelectItem value="resolved">Đã giải quyết</SelectItem>
                <SelectItem value="wont_fix">Không sửa</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterPriority ?? "all"}
              onValueChange={(v) => setFilterPriority(v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả mức độ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả mức độ</SelectItem>
                <SelectItem value="low">Thấp</SelectItem>
                <SelectItem value="medium">Trung bình</SelectItem>
                <SelectItem value="high">Cao</SelectItem>
                <SelectItem value="urgent">Khẩn cấp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-muted-foreground">
            Tìm thấy {filtered.length} báo cáo
          </p>
        </div>
      </Card>

      {/* Reports Table */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="quiet-card">
            <div className="flex flex-col items-center justify-center py-12">
              <Filter className="mb-2 size-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">Không tìm thấy báo cáo nào</p>
            </div>
          </Card>
        ) : (
          filtered.map((report) => (
            <Card key={report.id} className="lift-card overflow-hidden">
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getStatusIcon(report.status)}</div>
                      <div>
                        <h3 className="font-semibold text-foreground">{report.title}</h3>
                        <p className="text-sm text-muted-foreground">{report.description.substring(0, 100)}...</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Từ: <span className="font-medium text-foreground">{report.user_email}</span>
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

                <p className="text-xs text-muted-foreground">
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
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "primary" | "warning" | "info" | "success" | "destructive";
  icon?: React.ReactNode;
}) {
  const textTone: Record<string, string> = {
    primary: "text-primary",
    warning: "text-warning",
    info: "text-info",
    success: "text-success",
    destructive: "text-destructive",
  };
  const boxTone: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className="surface-card p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {icon && (
            <div className={`flex size-7 items-center justify-center rounded-md ${boxTone[tone]}`}>{icon}</div>
          )}
        </div>
        <p className={`text-3xl font-bold ${textTone[tone]}`}>{value}</p>
      </div>
    </Card>
  );
}
