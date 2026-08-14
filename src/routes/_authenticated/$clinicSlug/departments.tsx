import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";
import { hasAnyRole } from "@/lib/permissions";

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

function useCanEditOrgStructure() {
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  return {
    canEdit: hasAnyRole(profileQuery.data?.roles ?? [], ["administrator", "manager"]),
    organizationId: profileQuery.data?.organizationId,
  };
}

function OrgStructurePage() {
  return (
    <div>
      <PageHeader
        title="Cơ cấu tổ chức"
        description="Phòng ban, chức danh và ca làm việc dùng chung cho hồ sơ nhân sự và tính công. Chức danh ở đây cũng là danh mục hiển thị trên trang Đội ngũ phòng khám."
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
  const queryClient = useQueryClient();
  const { canEdit, organizationId } = useCanEditOrgStructure();
  const [newDept, setNewDept] = useState({ name: "", code: "" });

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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("Không xác định được phòng khám");
      if (!newDept.name.trim()) throw new Error("Vui lòng nhập tên phòng ban");
      const { error } = await supabase.from("departments").insert({
        organization_id: organizationId,
        name: newDept.name.trim(),
        code: newDept.code.trim() || null,
        display_order: (query.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm phòng ban");
      setNewDept({ name: "", code: "" });
      void queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("departments").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["departments"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState description={(query.error as Error).message} />;

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card className="quiet-card min-w-0 p-4">
          <h2 className="mb-3 text-sm font-semibold">Thêm phòng ban</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tên phòng ban</Label>
              <Input
                value={newDept.name}
                onChange={(event) => setNewDept({ ...newDept, name: event.target.value })}
                placeholder="Khoa Nha tổng quát"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mã</Label>
              <Input
                value={newDept.code}
                onChange={(event) => setNewDept({ ...newDept, code: event.target.value })}
                placeholder="NTQ"
              />
            </div>
          </div>
          <Button className="mt-3" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus className="mr-2 size-4" />
            Thêm phòng ban
          </Button>
        </Card>
      )}

      {(query.data ?? []).length === 0 ? (
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
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: row.id, isActive: checked })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {row.is_active ? "Đang dùng" : "Ngưng"}
                        </span>
                      </div>
                    ) : (
                      <Badge variant={row.is_active ? "default" : "secondary"}>
                        {row.is_active ? "Đang dùng" : "Ngưng"}
                      </Badge>
                    )}
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

function PositionsTab() {
  const queryClient = useQueryClient();
  const { canEdit, organizationId } = useCanEditOrgStructure();
  const [newPosition, setNewPosition] = useState({ name: "", departmentId: "", canReceiveAppointments: false });

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

  const departmentsQuery = useQuery({
    queryKey: ["departments-for-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("Không xác định được phòng khám");
      if (!newPosition.name.trim()) throw new Error("Vui lòng nhập tên chức danh");
      const { error } = await supabase.from("positions").insert({
        organization_id: organizationId,
        name: newPosition.name.trim(),
        department_id: newPosition.departmentId || null,
        can_receive_appointments: newPosition.canReceiveAppointments,
        display_order: (query.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm chức danh — dùng làm danh mục ở trang Đội ngũ phòng khám");
      setNewPosition({ name: "", departmentId: "", canReceiveAppointments: false });
      void queryClient.invalidateQueries({ queryKey: ["positions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("positions").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["positions"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (query.isLoading) return <LoadingState rows={3} />;
  if (query.isError) return <ErrorState description={(query.error as Error).message} />;

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card className="quiet-card min-w-0 p-4">
          <h2 className="mb-3 text-sm font-semibold">Thêm chức danh (danh mục)</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tên chức danh</Label>
              <Input
                value={newPosition.name}
                onChange={(event) => setNewPosition({ ...newPosition, name: event.target.value })}
                placeholder="Bác sĩ chính, Phụ tá, Trưởng khoa..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phòng ban</Label>
              <Select
                value={newPosition.departmentId}
                onValueChange={(value) => setNewPosition({ ...newPosition, departmentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phòng ban" />
                </SelectTrigger>
                <SelectContent>
                  {(departmentsQuery.data ?? []).map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Switch
              checked={newPosition.canReceiveAppointments}
              onCheckedChange={(checked) => setNewPosition({ ...newPosition, canReceiveAppointments: checked })}
            />
            <span className="text-sm text-muted-foreground">Chức danh này có thể nhận lịch hẹn (bác sĩ)</span>
          </div>
          <Button className="mt-3" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            <Plus className="mr-2 size-4" />
            Thêm chức danh
          </Button>
        </Card>
      )}

      {(query.data ?? []).length === 0 ? (
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
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.is_active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: row.id, isActive: checked })}
                        />
                        <span className="text-xs text-muted-foreground">
                          {row.is_active ? "Đang dùng" : "Ngưng"}
                        </span>
                      </div>
                    ) : (
                      <Badge variant={row.is_active ? "default" : "secondary"}>
                        {row.is_active ? "Đang dùng" : "Ngưng"}
                      </Badge>
                    )}
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
