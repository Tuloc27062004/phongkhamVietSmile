import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Radar, Save, XCircle } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/system/sync")({
  head: () => ({
    meta: [
      { title: "Trạng thái đồng bộ — Việt Smile Clinic Suite" },
      { name: "description", content: "Cấu hình và theo dõi đồng bộ máy chấm công." },
    ],
  }),
  component: SystemSyncPage,
});

type DeviceConfigForm = {
  device_ip_address: string;
  device_port: string;
  device_type: string;
  connection_method: string;
  sync_interval_minutes: string;
  auto_sync_enabled: boolean;
};

const EMPTY_FORM: DeviceConfigForm = {
  device_ip_address: "",
  device_port: "",
  device_type: "zkteco",
  connection_method: "network",
  sync_interval_minutes: "30",
  auto_sync_enabled: true,
};

function SystemSyncPage() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const [form, setForm] = useState<DeviceConfigForm>(EMPTY_FORM);

  const configQuery = useQuery({
    queryKey: ["device-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("device_configs").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const logsQuery = useQuery({
    queryKey: ["device-sync-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_sync_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const mappingsQuery = useQuery({
    queryKey: ["device-sync-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_sync_mappings")
        .select("id, device_user_id, sync_status, is_active, last_sync_time, employees(full_name, employee_code)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!configQuery.data) return;
    setForm({
      device_ip_address: configQuery.data.device_ip_address || "",
      device_port: configQuery.data.device_port?.toString() || "",
      device_type: configQuery.data.device_type || "zkteco",
      connection_method: configQuery.data.connection_method || "network",
      sync_interval_minutes: configQuery.data.sync_interval_minutes?.toString() || "30",
      auto_sync_enabled: configQuery.data.auto_sync_enabled ?? true,
    });
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (values: DeviceConfigForm) => {
      const payload = {
        device_ip_address: values.device_ip_address || null,
        device_port: values.device_port ? Number(values.device_port) : null,
        device_type: values.device_type,
        connection_method: values.connection_method,
        sync_interval_minutes: Number(values.sync_interval_minutes) || 30,
        auto_sync_enabled: values.auto_sync_enabled,
      };

      if (configQuery.data?.id) {
        const { error } = await supabase
          .from("device_configs")
          .update(payload)
          .eq("id", configQuery.data.id);
        if (error) throw error;
      } else {
        const organizationId = profileQuery.data?.organizationId;
        if (!organizationId) throw new Error("Không xác định được phòng khám của tài khoản hiện tại");
        const { error } = await supabase
          .from("device_configs")
          .insert([{ ...payload, organization_id: organizationId }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Đã lưu cấu hình đồng bộ");
      queryClient.invalidateQueries({ queryKey: ["device-config"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (configQuery.isLoading) return <LoadingState rows={4} />;
  if (configQuery.isError) return <ErrorState description={(configQuery.error as Error).message} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trạng thái đồng bộ"
        description="Cấu hình kết nối máy chấm công và theo dõi lịch sử đồng bộ dữ liệu."
      />

      <Card className="surface-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Cấu hình kết nối</h3>
          <Badge
            className={
              configQuery.data?.is_connected
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }
          >
            {configQuery.data?.is_connected ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5" /> Đã kết nối
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="size-3.5" /> Chưa kết nối
              </span>
            )}
          </Badge>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Lưu ý: đây là nơi lưu cấu hình kết nối. Trạng thái "Đã kết nối" chỉ được cập nhật khi có
          một agent đồng bộ thực tế (chạy tại phòng khám, kết nối với máy chấm công) ghi dữ liệu về
          đây — hệ thống hiện chưa có agent như vậy nên trạng thái sẽ luôn là "Chưa kết nối".
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Địa chỉ IP máy chấm công</Label>
            <Input
              placeholder="192.168.1.100"
              value={form.device_ip_address}
              onChange={(e) => setForm({ ...form, device_ip_address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cổng (port)</Label>
            <Input
              type="number"
              placeholder="4370"
              value={form.device_port}
              onChange={(e) => setForm({ ...form, device_port: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Loại thiết bị</Label>
            <Select
              value={form.device_type}
              onValueChange={(value) => setForm({ ...form, device_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zkteco">ZKTeco</SelectItem>
                <SelectItem value="hikvision">Hikvision</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Phương thức kết nối</Label>
            <Select
              value={form.connection_method}
              onValueChange={(value) => setForm({ ...form, connection_method: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="network">Mạng LAN</SelectItem>
                <SelectItem value="usb">USB</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chu kỳ đồng bộ (phút)</Label>
            <Input
              type="number"
              value={form.sync_interval_minutes}
              onChange={(e) => setForm({ ...form, sync_interval_minutes: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3">
            <Label htmlFor="auto_sync">Tự động đồng bộ</Label>
            <Switch
              id="auto_sync"
              checked={form.auto_sync_enabled}
              onCheckedChange={(checked) => setForm({ ...form, auto_sync_enabled: checked })}
            />
          </div>
        </div>

        <Button
          className="mt-4"
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-2 size-4" />
          {saveMutation.isPending ? "Đang lưu..." : "Lưu cấu hình"}
        </Button>
      </Card>

      <Card className="surface-card p-6">
        <h3 className="mb-4 font-semibold">Lịch sử đồng bộ</h3>
        {logsQuery.isLoading ? (
          <LoadingState rows={3} />
        ) : !logsQuery.data || logsQuery.data.length === 0 ? (
          <EmptyState
            title="Chưa có lịch sử đồng bộ"
            description="Chưa có lần đồng bộ nào được ghi nhận."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Tìm thấy</TableHead>
                  <TableHead className="text-right">Đã nhập</TableHead>
                  <TableHead className="text-right">Lỗi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsQuery.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.started_at).toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell>{log.sync_type}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          log.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : log.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                        }
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{log.records_found}</TableCell>
                    <TableCell className="text-right">{log.records_imported}</TableCell>
                    <TableCell className="text-right">{log.records_failed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="surface-card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Radar className="size-4" /> Ánh xạ nhân viên trên máy chấm công
        </h3>
        {mappingsQuery.isLoading ? (
          <LoadingState rows={3} />
        ) : !mappingsQuery.data || mappingsQuery.data.length === 0 ? (
          <EmptyState
            title="Chưa có ánh xạ"
            description="Chưa có nhân viên nào được ánh xạ với ID trên máy chấm công."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID trên máy</TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Đồng bộ lần cuối</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappingsQuery.data.map((mapping: any) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-mono text-xs">{mapping.device_user_id}</TableCell>
                    <TableCell>{mapping.employees?.full_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{mapping.sync_status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {mapping.last_sync_time
                        ? new Date(mapping.last_sync_time).toLocaleString("vi-VN")
                        : "Chưa đồng bộ"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
