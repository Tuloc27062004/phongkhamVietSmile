import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { createAgentKey, listAgentKeys, revokeAgentKey } from "@/lib/device-agent.functions";

export const Route = createFileRoute("/_authenticated/system/agent")({
  head: () => ({
    meta: [
      { title: "Kết nối Agent chấm công — Việt Smile Clinic Suite" },
      {
        name: "description",
        content:
          "Tạo khóa API cho Windows Agent để đẩy dữ liệu vân tay từ máy chấm công lên hệ thống theo thời gian thực.",
      },
      { property: "og:title", content: "Kết nối Agent chấm công — Việt Smile Clinic Suite" },
      {
        property: "og:description",
        content: "Cấu hình Agent Windows đọc log vân tay và đồng bộ realtime.",
      },
    ],
  }),
  component: SystemAgentPage,
});

const ENDPOINT = "https://project--106cf23f-86be-4167-aa18-ca234f4873f4.lovable.app/api/public/device/events";

const SAMPLE = `POST ${ENDPOINT}
Content-Type: application/json
x-api-key: <KHÓA_AGENT>

{
  "device_serial": "ZK-A1234567",
  "device_name": "Máy vân tay sảnh",
  "events": [
    {
      "device_user_id": "17",
      "event_time": "2026-08-07T08:01:22+07:00",
      "event_type": "auto",
      "verify_mode": "fingerprint"
    }
  ]
}`;

function SystemAgentPage() {
  const queryClient = useQueryClient();
  const list = useServerFn(listAgentKeys);
  const create = useServerFn(createAgentKey);
  const revoke = useServerFn(revokeAgentKey);
  const [name, setName] = useState("Windows Agent");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const keysQuery = useQuery({
    queryKey: ["agent-keys"],
    queryFn: () => list(),
  });

  const createMutation = useMutation({
    mutationFn: () => create({ data: { name } }),
    onSuccess: (result) => {
      setFreshKey(result.apiKey);
      toast.success("Đã tạo khóa Agent. Hãy sao chép ngay, khóa chỉ hiển thị một lần.");
      queryClient.invalidateQueries({ queryKey: ["agent-keys"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Đã thu hồi khóa");
      queryClient.invalidateQueries({ queryKey: ["agent-keys"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Đã sao chép");
  };

  return (
    <div>
      <PageHeader
        title="Kết nối Agent chấm công"
        description="Windows Agent đọc log vân tay/khuôn mặt trực tiếp từ máy chấm công (ZKTeco, Hikvision…) và đẩy lên hệ thống. Dữ liệu hiển thị realtime, không có dữ liệu giả lập."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="surface-card p-6 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4 text-primary" /> Khóa API cho Agent
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi máy tính chạy Agent nên dùng một khóa riêng. Khóa được lưu dưới dạng băm (hash),
            không thể xem lại sau khi tạo.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="grow space-y-2">
              <Label htmlFor="key-name">Tên khóa</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Agent máy lễ tân"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || name.trim().length < 2}
            >
              <Plus className="mr-2 size-4" /> Tạo khóa
            </Button>
          </div>

          {freshKey && (
            <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
              <p className="text-sm font-medium">Khóa mới (chỉ hiện một lần)</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="grow break-all rounded bg-background px-3 py-2 text-xs">
                  {freshKey}
                </code>
                <Button size="sm" variant="outline" onClick={() => copy(freshKey)}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6">
            {keysQuery.isLoading ? (
              <LoadingState rows={3} />
            ) : keysQuery.isError ? (
              <ErrorState description={(keysQuery.error as Error).message} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên khóa</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Lần dùng gần nhất</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(keysQuery.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">
                        Chưa có khóa nào.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (keysQuery.data ?? []).map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.key_name}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              key.is_active
                                ? "bg-green-100 text-green-800"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {key.is_active ? "Đang dùng" : "Đã thu hồi"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {key.last_used_at
                            ? new Date(key.last_used_at).toLocaleString("vi-VN")
                            : "Chưa dùng"}
                        </TableCell>
                        <TableCell className="text-right">
                          {key.is_active && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => revokeMutation.mutate(key.id)}
                              disabled={revokeMutation.isPending}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>

        <Card className="surface-card p-6">
          <h3 className="font-semibold">Cấu hình Agent</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Agent gọi endpoint dưới đây mỗi khi đọc được bản ghi mới trên máy chấm công.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="grow break-all rounded bg-muted px-3 py-2 text-xs">{ENDPOINT}</code>
            <Button size="sm" variant="outline" onClick={() => copy(ENDPOINT)}>
              <Copy className="size-4" />
            </Button>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
            {SAMPLE}
          </pre>
          <div className="mt-4 flex gap-2 rounded-lg border border-yellow-500/40 bg-yellow-50 p-3">
            <ShieldAlert className="size-4 shrink-0 text-yellow-600" />
            <p className="text-xs text-yellow-800">
              <strong>device_user_id</strong> là mã người dùng trên máy chấm công. Hãy ánh xạ mã này
              với nhân viên tại trang “Trạng thái đồng bộ”; bản ghi chưa ánh xạ sẽ được lưu nhưng
              không tính công.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
