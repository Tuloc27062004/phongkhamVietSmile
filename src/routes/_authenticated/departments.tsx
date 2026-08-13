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

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Phòng ban — Việt Smile Clinic Suite" },
      { name: "description", content: "Cơ cấu phòng ban của phòng khám nha khoa." },
      { property: "og:title", content: "Phòng ban — Việt Smile Clinic Suite" },
      { property: "og:description", content: "Cơ cấu phòng ban của phòng khám nha khoa." },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const query = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, code, description, is_active, display_order")
        .is("deleted_at", null)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Phòng ban"
        description="Cơ cấu tổ chức của phòng khám. Thêm và sửa sẽ mở ở giai đoạn 2."
      />
      {query.isLoading ? (
        <LoadingState rows={3} />
      ) : query.isError ? (
        <ErrorState description={(query.error as Error).message} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState title="Chưa có phòng ban" />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên phòng ban</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code ?? "—"}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.description ?? "—"}</TableCell>
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
