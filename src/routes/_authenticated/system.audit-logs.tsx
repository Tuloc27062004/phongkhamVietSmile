import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/system/audit-logs")({
  head: () => ({
    meta: [
      { title: "Nhật ký hoạt động — Việt Smile Clinic Suite" },
      { name: "description", content: "Xem lịch sử thay đổi dữ liệu trong hệ thống." },
    ],
  }),
  component: SystemAuditLogsPage,
});

function SystemAuditLogsPage() {
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
      <PageHeader
        title="Nhật ký hoạt động"
        description="Lịch sử thay đổi dữ liệu quan trọng trong hệ thống (100 bản ghi gần nhất)."
      />

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
