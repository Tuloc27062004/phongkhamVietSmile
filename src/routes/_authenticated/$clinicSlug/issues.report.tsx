import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
} from "lucide-react";

import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/$clinicSlug/issues/report")({
  head: () => ({
    meta: [
      { title: "Báo cáo sự cố — GZV Clinic Platform" },
      { name: "description", content: "Báo cáo lỗi hoặc sự cố hệ thống, xem lại các báo cáo đã gửi." },
    ],
  }),
  component: IssuesPage,
});

function IssuesPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Báo cáo sự cố"
        description="Giúp chúng tôi cải thiện hệ thống bằng cách báo cáo lỗi hoặc đề xuất, và theo dõi lại các báo cáo đã gửi."
      />
      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">Gửi báo cáo mới</TabsTrigger>
          <TabsTrigger value="mine">Báo cáo của tôi</TabsTrigger>
        </TabsList>
        <TabsContent value="new" className="mt-6">
          <ReportForm />
        </TabsContent>
        <TabsContent value="mine" className="mt-6">
          <MyReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type IssueCategory = "bug" | "feature" | "feedback" | "other";
type IssuePriority = "low" | "medium" | "high" | "urgent";

function ReportForm() {
  const { session } = useAuthSession();
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    category: "bug" as IssueCategory,
    priority: "medium" as IssuePriority,
    title: "",
    description: "",
    steps: "",
  });

  const reportMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("error_reports").insert({
        user_id: session?.user.id ?? "",
        user_email: session?.user.email ?? "",
        category: data.category,
        priority: data.priority,
        title: data.title,
        description: data.description,
        steps_to_reproduce: data.steps,
        status: "open",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Vui lòng mô tả chi tiết sự cố");
      return;
    }

    try {
      await reportMutation.mutateAsync(formData);
      setSubmitted(true);
      setFormData({
        category: "bug",
        priority: "medium",
        title: "",
        description: "",
        steps: "",
      });

      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không gửi được báo cáo, vui lòng thử lại");
    }
  };

  const categories = [
    { value: "bug" as IssueCategory, label: "🐛 Lỗi (Bug)", desc: "Hệ thống không hoạt động đúng" },
    { value: "feature" as IssueCategory, label: "✨ Tính năng", desc: "Đề xuất tính năng mới" },
    { value: "feedback" as IssueCategory, label: "💬 Phản hồi", desc: "Ý kiến cải thiện" },
    { value: "other" as IssueCategory, label: "📝 Khác", desc: "Vấn đề khác" },
  ];

  const priorities = [
    { value: "low" as IssuePriority, label: "Thấp", tone: "bg-info/15 text-info" },
    { value: "medium" as IssuePriority, label: "Trung bình", tone: "bg-warning/15 text-warning-foreground" },
    { value: "high" as IssuePriority, label: "Cao", tone: "bg-warning/25 text-warning-foreground" },
    { value: "urgent" as IssuePriority, label: "Khẩn cấp", tone: "bg-destructive/15 text-destructive" },
  ];

  return (
    <div className="space-y-6">
      {submitted && (
        <Card className="border border-success/25 bg-success/10 shadow-none">
          <div className="flex items-center gap-4 p-4">
            <CheckCircle2 className="size-6 shrink-0 text-success" />
            <div>
              <p className="font-semibold text-foreground">Báo cáo đã được gửi!</p>
              <p className="text-sm text-muted-foreground">Cảm ơn bạn đã giúp chúng tôi cải thiện hệ thống.</p>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="quiet-card p-6">
          <div className="space-y-4">
            <label className="block">
              <p className="mb-3 font-semibold text-foreground">Loại báo cáo</p>
              <div className="grid gap-3 md:grid-cols-2">
                {categories.map((cat) => (
                  <label
                    key={cat.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      formData.category === cat.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={cat.value}
                      checked={formData.category === cat.value}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value as IssueCategory })
                      }
                      className="size-4 accent-primary"
                    />
                    <div>
                      <p className="font-medium text-foreground">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">{cat.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </label>
          </div>
        </Card>

        <Card className="quiet-card p-6">
          <div className="space-y-4">
            <div>
              <label className="block">
                <p className="mb-2 font-semibold text-foreground">Mức độ ưu tiên</p>
                <div className="flex flex-wrap gap-2">
                  {priorities.map((pri) => (
                    <button
                      key={pri.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: pri.value })}
                      className={`rounded-lg px-3 py-2 font-medium transition ${
                        formData.priority === pri.value
                          ? pri.tone
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {pri.label}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <div>
              <label className="block">
                <p className="mb-2 font-semibold text-foreground">Tiêu đề *</p>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Mô tả ngắn gọn vấn đề của bạn"
                  maxLength={200}
                />
                <p className="mt-1 text-xs text-muted-foreground">{formData.title.length}/200</p>
              </label>
            </div>
          </div>
        </Card>

        <Card className="quiet-card p-6">
          <div className="space-y-4">
            <label className="block">
              <p className="mb-2 font-semibold text-foreground">Mô tả chi tiết *</p>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Vui lòng mô tả chi tiết về sự cố, những gì bạn mong đợi, và những gì thực sự xảy ra..."
                rows={5}
                maxLength={2000}
                className="resize-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">{formData.description.length}/2000</p>
            </label>
          </div>
        </Card>

        {formData.category === "bug" && (
          <Card className="quiet-card p-6">
            <div className="space-y-4">
              <label className="block">
                <p className="mb-2 font-semibold text-foreground">Các bước để tái hiện</p>
                <Textarea
                  value={formData.steps}
                  onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                  placeholder={"1. Bước đầu tiên...\n2. Bước thứ hai...\n3. Bước thứ ba..."}
                  rows={4}
                  className="resize-none"
                />
              </label>
            </div>
          </Card>
        )}

        <Button type="submit" disabled={reportMutation.isPending} className="h-12 w-full text-base">
          <Send className="mr-2 size-4" />
          {reportMutation.isPending ? "Đang gửi..." : "Gửi báo cáo"}
        </Button>
      </form>

      <Card className="border border-primary/20 bg-primary/5 shadow-none">
        <div className="space-y-3 p-4">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold text-foreground">💡 Mẹo báo cáo hiệu quả</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Cung cấp mô tả rõ ràng và cụ thể</li>
                <li>• Bao gồm các bước tái hiện chính xác</li>
                <li>• Nêu rõ hành vi mong đợi vs thực tế</li>
                <li>• Chỉ định mức độ ưu tiên của bạn</li>
                <li>• Đội ngũ sẽ liên hệ qua email trong 24 giờ</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

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
        return <AlertCircle className="size-4 text-warning" />;
      case "in_progress":
        return <Clock className="size-4 text-info" />;
      case "resolved":
        return <CheckCircle2 className="size-4 text-success" />;
      case "wont_fix":
        return <AlertTriangle className="size-4 text-muted-foreground" />;
      default:
        return <MessageSquare className="size-4 text-muted-foreground" />;
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
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Tổng cộng" value={stats.total} tone="primary" />
        <StatCard label="Mở" value={stats.open} tone="warning" />
        <StatCard label="Đang xử lý" value={stats.in_progress} tone="info" />
        <StatCard label="Đã giải quyết" value={stats.resolved} tone="success" />
      </div>

      <div className="space-y-4">
        {reports.length === 0 ? (
          <Card className="quiet-card">
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="mb-2 size-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">Bạn chưa gửi báo cáo nào</p>
            </div>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id} className="lift-card overflow-hidden">
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-lg">{getCategoryIcon(report.category)}</span>
                      <h3 className="font-semibold text-foreground">{report.title}</h3>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{report.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">{getStatusIcon(report.status)}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{getCategoryLabel(report.category)}</Badge>
                  <Badge className={`${getPriorityColor(report.priority)} border-0`}>
                    {getPriorityLabel(report.priority)}
                  </Badge>
                  <Badge variant="secondary">{getStatusLabel(report.status)}</Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" />
                    {new Date(report.created_at).toLocaleDateString("vi-VN")}
                  </span>
                  {report.updated_at !== report.created_at && (
                    <span>Cập nhật: {new Date(report.updated_at).toLocaleDateString("vi-VN")}</span>
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
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "warning" | "info" | "success";
}) {
  const textTone: Record<string, string> = {
    primary: "text-primary",
    warning: "text-warning",
    info: "text-info",
    success: "text-success",
  };

  return (
    <Card className="surface-card p-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={`text-3xl font-bold ${textTone[tone]}`}>{value}</p>
      </div>
    </Card>
  );
}
