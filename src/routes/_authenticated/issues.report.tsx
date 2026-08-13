import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  Bug,
  MessageSquare,
  Send,
  CheckCircle2,
} from "lucide-react";

import { PageHeader } from "@/components/page-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/issues/report")({
  head: () => ({
    meta: [
      { title: "Báo cáo sự cố — Việt Smile Clinic" },
      { name: "description", content: "Báo cáo lỗi hoặc sự cố hệ thống" },
    ],
  }),
  component: IssueReport,
});

type IssueCategory = "bug" | "feature" | "feedback" | "other";
type IssuePriority = "low" | "medium" | "high" | "urgent";

function IssueReport() {
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
      const { error } = await supabase
        .from("error_reports")
        .insert({
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
      alert("Vui lòng nhập tiêu đề");
      return;
    }

    if (!formData.description.trim()) {
      alert("Vui lòng mô tả chi tiết sự cố");
      return;
    }

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
  };

  const categories = [
    { value: "bug" as IssueCategory, label: "🐛 Lỗi (Bug)", desc: "Hệ thống không hoạt động đúng" },
    { value: "feature" as IssueCategory, label: "✨ Tính năng", desc: "Đề xuất tính năng mới" },
    { value: "feedback" as IssueCategory, label: "💬 Phản hồi", desc: "Ý kiến cải thiện" },
    { value: "other" as IssueCategory, label: "📝 Khác", desc: "Vấn đề khác" },
  ];

  const priorities = [
    { value: "low" as IssuePriority, label: "Thấp", color: "bg-blue-100 text-blue-800" },
    { value: "medium" as IssuePriority, label: "Trung bình", color: "bg-yellow-100 text-yellow-800" },
    { value: "high" as IssuePriority, label: "Cao", color: "bg-orange-100 text-orange-800" },
    { value: "urgent" as IssuePriority, label: "Khẩn cấp", color: "bg-red-100 text-red-800" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Báo cáo sự cố"
        description="Giúp chúng tôi cải thiện hệ thống bằng cách báo cáo lỗi hoặc đề xuất"
      />

      {submitted && (
        <Card className="border-0 bg-gradient-to-r from-green-50 to-emerald-50 shadow-md">
          <div className="flex items-center gap-4 p-4">
            <CheckCircle2 className="size-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900">Báo cáo đã được gửi!</p>
              <p className="text-sm text-green-700">Cảm ơn bạn đã giúp chúng tôi cải thiện hệ thống.</p>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Selection */}
        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <label className="block">
              <p className="mb-3 font-semibold text-gray-900">Loại báo cáo</p>
              <div className="grid gap-3 md:grid-cols-2">
                {categories.map((cat) => (
                  <label key={cat.value} className="flex items-center gap-3 rounded-lg border-2 border-gray-200 p-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition" style={{
                    borderColor: formData.category === cat.value ? "rgb(59, 130, 246)" : undefined,
                    backgroundColor: formData.category === cat.value ? "rgb(239, 246, 255)" : undefined,
                  }}>
                    <input
                      type="radio"
                      name="category"
                      value={cat.value}
                      checked={formData.category === cat.value}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as IssueCategory })}
                      className="size-4"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{cat.label}</p>
                      <p className="text-xs text-gray-600">{cat.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </label>
          </div>
        </Card>

        {/* Priority & Title */}
        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <div>
              <label className="block">
                <p className="mb-2 font-semibold text-gray-900">Mức độ ưu tiên</p>
                <div className="flex gap-2 flex-wrap">
                  {priorities.map((pri) => (
                    <button
                      key={pri.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: pri.value })}
                      className={`px-3 py-2 rounded-lg font-medium transition ${
                        formData.priority === pri.value
                          ? pri.color
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                <p className="mb-2 font-semibold text-gray-900">Tiêu đề *</p>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Mô tả ngắn gọn vấn đề của bạn"
                  maxLength={200}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">{formData.title.length}/200</p>
              </label>
            </div>
          </div>
        </Card>

        {/* Description */}
        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <label className="block">
              <p className="mb-2 font-semibold text-gray-900">Mô tả chi tiết *</p>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Vui lòng mô tả chi tiết về sự cố, những gì bạn mong đợi, và những gì thực sự xảy ra..."
                rows={5}
                maxLength={2000}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none font-normal resize-none"
              />
              <p className="mt-1 text-xs text-gray-500">{formData.description.length}/2000</p>
            </label>
          </div>
        </Card>

        {/* Steps to Reproduce */}
        {formData.category === "bug" && (
          <Card className="border-0 shadow-md">
            <div className="space-y-4 p-6">
              <label className="block">
                <p className="mb-2 font-semibold text-gray-900">Các bước để tái hiện</p>
                <textarea
                  value={formData.steps}
                  onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                  placeholder="1. Bước đầu tiên...
2. Bước thứ hai...
3. Bước thứ ba..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none font-normal resize-none"
                />
              </label>
            </div>
          </Card>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={reportMutation.isPending}
          className="w-full h-12 text-base"
        >
          <Send className="mr-2 size-4" />
          {reportMutation.isPending ? "Đang gửi..." : "Gửi báo cáo"}
        </Button>
      </form>

      {/* Info Box */}
      <Card className="border-0 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md">
        <div className="space-y-3 p-4">
          <div className="flex gap-3">
            <AlertCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">💡 Mẹo báo cáo hiệu quả</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
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
