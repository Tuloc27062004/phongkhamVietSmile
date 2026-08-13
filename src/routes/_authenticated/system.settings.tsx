import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/system/settings")({
  head: () => ({
    meta: [
      { title: "Cài đặt hệ thống — Việt Smile Clinic Suite" },
      { name: "description", content: "Quản lý các thiết lập chung của phòng khám." },
    ],
  }),
  component: SystemSettingsPage,
});

type SettingRow = {
  id: string;
  group_key: string;
  setting_key: string;
  value: unknown;
};

function stringifyValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function SystemSettingsPage() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const canEdit = profileQuery.data?.roles.includes("administrator") ?? false;

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newSetting, setNewSetting] = useState({ group_key: "general", setting_key: "", value: "" });
  const [openDialog, setOpenDialog] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("id, group_key, setting_key, value")
        .order("group_key")
        .order("setting_key");
      if (error) throw error;
      return (data || []) as SettingRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      let parsed: unknown = value;
      try {
        parsed = JSON.parse(value);
      } catch {
        // keep as plain string if it isn't valid JSON
      }
      const { error } = await supabase.from("app_settings").update({ value: parsed as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã lưu thiết lập");
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newSetting.group_key.trim() || !newSetting.setting_key.trim()) {
        throw new Error("Vui lòng nhập nhóm và tên thiết lập");
      }
      let parsed: unknown = newSetting.value;
      try {
        parsed = JSON.parse(newSetting.value);
      } catch {
        // keep as plain string
      }
      const organizationId = profileQuery.data?.organizationId;
      if (!organizationId) throw new Error("Không xác định được phòng khám của tài khoản hiện tại");

      const { error } = await supabase.from("app_settings").insert({
        organization_id: organizationId,
        group_key: newSetting.group_key.trim(),
        setting_key: newSetting.setting_key.trim(),
        value: parsed as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm thiết lập mới");
      setOpenDialog(false);
      setNewSetting({ group_key: "general", setting_key: "", value: "" });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("app_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xóa thiết lập");
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (settingsQuery.isLoading) return <LoadingState rows={4} />;
  if (settingsQuery.isError) return <ErrorState description={(settingsQuery.error as Error).message} />;

  const settings = settingsQuery.data || [];
  const groups = Array.from(new Set(settings.map((s) => s.group_key)));

  return (
    <div>
      <PageHeader
        title="Cài đặt hệ thống"
        description="Các thiết lập dạng khóa/giá trị dùng chung cho toàn bộ phòng khám."
        actions={
          canEdit ? (
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 size-4" />
                  Thêm thiết lập
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Thêm thiết lập mới</DialogTitle>
                  <DialogDescription>
                    Giá trị có thể là văn bản thường hoặc JSON (số, true/false, mảng, object...).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nhóm</Label>
                    <Input
                      value={newSetting.group_key}
                      onChange={(e) => setNewSetting({ ...newSetting, group_key: e.target.value })}
                      placeholder="general"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tên thiết lập</Label>
                    <Input
                      value={newSetting.setting_key}
                      onChange={(e) => setNewSetting({ ...newSetting, setting_key: e.target.value })}
                      placeholder="notify_email_enabled"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Giá trị</Label>
                    <Textarea
                      rows={3}
                      value={newSetting.value}
                      onChange={(e) => setNewSetting({ ...newSetting, value: e.target.value })}
                      placeholder="true"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Đang lưu..." : "Lưu"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      {!canEdit && (
        <p className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Bạn chỉ có quyền xem. Chỉ quản trị viên mới được chỉnh sửa cài đặt hệ thống.
        </p>
      )}

      {settings.length === 0 ? (
        <EmptyState
          title="Chưa có thiết lập nào"
          description="Thêm thiết lập đầu tiên để bắt đầu."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group} className="surface-card p-6">
              <h3 className="mb-4 font-semibold capitalize">{group}</h3>
              <div className="space-y-4">
                {settings
                  .filter((s) => s.group_key === group)
                  .map((setting) => {
                    const currentEdit = editValues[setting.id] ?? stringifyValue(setting.value);
                    return (
                      <div key={setting.id} className="grid gap-2 sm:grid-cols-[200px_1fr_auto] sm:items-start">
                        <Label className="pt-2 font-mono text-sm">{setting.setting_key}</Label>
                        <Textarea
                          rows={1}
                          disabled={!canEdit}
                          value={currentEdit}
                          onChange={(e) =>
                            setEditValues({ ...editValues, [setting.id]: e.target.value })
                          }
                        />
                        {canEdit && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                saveMutation.mutate({ id: setting.id, value: currentEdit })
                              }
                              disabled={saveMutation.isPending}
                            >
                              <Save className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600"
                              onClick={() => deleteMutation.mutate(setting.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
