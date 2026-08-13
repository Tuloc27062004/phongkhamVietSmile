import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/positions")({
  head: () => ({
    meta: [
      { title: "Chức danh — Việt Smile Clinic Suite" },
      { name: "description", content: "Danh mục chức danh nhân sự của phòng khám." },
      { property: "og:title", content: "Chức danh — Việt Smile Clinic Suite" },
      { property: "og:description", content: "Danh mục chức danh nhân sự của phòng khám." },
    ],
  }),
  component: PositionsPage,
});

function PositionsPage() {
  const query = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name, can_receive_appointments, description, is_active, display_order, departments(name)")
        .is("deleted_at", null)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Chức danh"
        description="Danh mục vị trí công việc dùng cho hồ sơ nhân viên và báo cáo."
      />
      {query.isLoading ? (
        <LoadingState rows={3} />
      ) : query.isError ? (
        <ErrorState description={(query.error as Error).message} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState title="Chưa có chức danh" />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chức danh</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Nhận lịch hẹn</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.departments?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.description ?? "—"}</TableCell>
                  <TableCell>{row.can_receive_appointments ? "Có" : "Không"}</TableCell>
                  <TableCell>
                    <Badge variant={row.is_active ? "default" : "secondary"}>
                      {row.is_active ? "Đang dùng" : "Ngưng"}
                    </Badge>
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
