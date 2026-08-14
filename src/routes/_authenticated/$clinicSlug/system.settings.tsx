import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/$clinicSlug/system/settings")({
  head: () => ({
    meta: [
      { title: "Cài đặt & Nhật ký hoạt động — GZV Clinic Platform" },
      { name: "description", content: "Quản lý thiết lập chung và xem lịch sử thay đổi dữ liệu." },
    ],
  }),
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Cài đặt & Nhật ký hoạt động"
        description="Các thiết lập dùng chung cho phòng khám và lịch sử thay đổi dữ liệu quan trọng."
      />
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Cài đặt</TabsTrigger>
          <TabsTrigger value="audit-logs">Nhật ký hoạt động</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="mt-6">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="audit-logs" className="mt-6">
          <AuditLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type SettingRow = {
  id: string;
  group_key: string;
  setting_key: string;
  value: unknown;
};

function stringifyValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function SettingsTab() {
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
      <div className="mb-4 flex justify-end">
        {canEdit && (
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
        )}
      </div>

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

function AuditLogsTab() {
  const [search, setSearch] = useState("");

  const logsQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, actor_name, action, entity_type, entity_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (logsQuery.data ?? []).filter((log) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      (log.actor_name || "").toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.entity_type.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Lịch sử thay đổi dữ liệu quan trọng trong hệ thống (100 bản ghi gần nhất).
      </p>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo người thực hiện, hành động, đối tượng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {logsQuery.isLoading ? (
        <LoadingState rows={8} />
      ) : logsQuery.isError ? (
        <ErrorState description={(logsQuery.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Chưa có nhật ký"
          description="Chưa có hoạt động nào được ghi nhận."
        />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Đối tượng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell className="font-medium">{log.actor_name || "Hệ thống"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.entity_type}
                    {log.entity_id ? ` #${log.entity_id.slice(0, 8)}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
