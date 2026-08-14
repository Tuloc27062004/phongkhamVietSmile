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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug/departments")({
  head: () => ({
    meta: [
      { title: "Cơ cấu tổ chức — GZV Clinic Platform" },
      { name: "description", content: "Phòng ban, chức danh và ca làm việc của phòng khám." },
      { property: "og:title", content: "Cơ cấu tổ chức — GZV Clinic Platform" },
      { property: "og:description", content: "Phòng ban, chức danh và ca làm việc của phòng khám." },
    ],
  }),
  component: OrgStructurePage,
});

function OrgStructurePage() {
  return (
    <div>
      <PageHeader
        title="Cơ cấu tổ chức"
        description="Phòng ban, chức danh và ca làm việc dùng chung cho hồ sơ nhân sự và tính công."
      />
      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Phòng ban</TabsTrigger>
          <TabsTrigger value="positions">Chức danh</TabsTrigger>
          <TabsTrigger value="shifts">Ca làm việc</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-6">
          <DepartmentsTab />
        </TabsContent>
        <TabsContent value="positions" className="mt-6">
          <PositionsTab />
        </TabsContent>
        <TabsContent value="shifts" className="mt-6">
          <ShiftsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DepartmentsTab() {
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

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState description={(query.error as Error).message} />;
  if ((query.data ?? []).length === 0) return <EmptyState title="Chưa có phòng ban" />;

  return (
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
  );
}

function PositionsTab() {
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

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState description={(query.error as Error).message} />;
  if ((query.data ?? []).length === 0) return <EmptyState title="Chưa có chức danh" />;

  return (
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
  );
}

function ShiftsTab() {
  const query = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState description={(query.error as Error).message} />;
  if ((query.data ?? []).length === 0) return <EmptyState title="Chưa có ca làm việc" />;

  return (
    <div className="surface-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ca</TableHead>
            <TableHead>Bắt đầu</TableHead>
            <TableHead>Kết thúc</TableHead>
            <TableHead>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(query.data ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.start_time}</TableCell>
              <TableCell>{row.end_time}</TableCell>
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
  );
}
