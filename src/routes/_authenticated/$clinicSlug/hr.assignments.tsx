import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users,
  Search,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/$clinicSlug/hr/assignments")({
  head: () => ({
    meta: [
      { title: "Gán Công Việc — GZV Clinic Platform" },
      { name: "description", content: "Gán phòng ban, ca làm việc cho nhân viên." },
    ],
  }),
  component: AssignmentPage,
});

interface EmployeeAssignment {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  department_id: string | null;
  default_shift_id: string | null;
  position_id: string | null;
  current_department: string;
  current_shift: string;
  current_position: string;
  start_date: string;
  employment_status: string;
}

type EditDraft = {
  department_id: string | null;
  shift_id: string | null;
  position_id: string | null;
};

function AssignmentPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditDraft>({ department_id: null, shift_id: null, position_id: null });

  const employeesQuery = useQuery({
    queryKey: ["employees-assignment"],
    queryFn: async () => {
      const { data: employees, error } = await supabase
        .from("employees")
        .select(
          `id,
          employee_code,
          full_name,
          email,
          employment_status,
          start_date,
          department_id,
          default_shift_id,
          position_id,
          departments(name),
          positions(name),
          shifts(name)`,
        )
        .is("deleted_at", null)
        .eq("employment_status", "active")
        .order("full_name");

      if (error) throw error;

      return (employees || []).map(
        (emp: any): EmployeeAssignment => ({
          id: emp.id,
          employee_code: emp.employee_code,
          full_name: emp.full_name,
          email: emp.email,
          department_id: emp.department_id,
          default_shift_id: emp.default_shift_id,
          position_id: emp.position_id,
          current_department: emp.departments?.name || "Chưa gán",
          current_shift: emp.shifts?.name || "Chưa gán",
          current_position: emp.positions?.name || "Chưa gán",
          start_date: emp.start_date,
          employment_status: emp.employment_status,
        }),
      );
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, name, start_time, end_time")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const positionsQuery = useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: EditDraft }) => {
      const { error } = await supabase
        .from("employees")
        .update({
          department_id: draft.department_id,
          default_shift_id: draft.shift_id,
          position_id: draft.position_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật phân công");
      queryClient.invalidateQueries({ queryKey: ["employees-assignment"] });
      setEditingId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredEmployees = (employeesQuery.data || []).filter((emp) =>
    emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
    emp.employee_code.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    totalEmployees: employeesQuery.data?.length || 0,
    assigned: (employeesQuery.data || []).filter(
      (emp) => emp.current_department !== "Chưa gán" && emp.current_shift !== "Chưa gán",
    ).length,
    unassigned: (employeesQuery.data || []).filter(
      (emp) => emp.current_department === "Chưa gán" || emp.current_shift === "Chưa gán",
    ).length,
  };

  const startEdit = (emp: EmployeeAssignment) => {
    setEditingId(emp.id);
    setEditData({
      department_id: emp.department_id,
      shift_id: emp.default_shift_id,
      position_id: emp.position_id,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gán Công Việc"
        description="Gán phòng ban, ca làm việc, chức danh cho nhân viên."
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="surface-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tổng Nhân Viên</p>
              <p className="text-3xl font-bold text-primary">{stats.totalEmployees}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="surface-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Đã Gán Công Việc</p>
              <p className="text-3xl font-bold text-success">{stats.assigned}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-success/10 text-success">
              <CheckCircle className="size-5" />
            </div>
          </div>
        </Card>

        <Card className="surface-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Chưa Gán Công Việc</p>
              <p className="text-3xl font-bold text-destructive">{stats.unassigned}</p>
            </div>
            <div className="flex size-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Tìm theo tên hoặc mã nhân viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white"
          />
        </div>
      </div>

      {/* Table */}
      {employeesQuery.isLoading ? (
        <LoadingState rows={5} />
      ) : employeesQuery.isError ? (
        <ErrorState description={(employeesQuery.error as Error).message} />
      ) : filteredEmployees.length === 0 ? (
        <EmptyState title="Không tìm thấy nhân viên" />
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Mã NV</TableHead>
                  <TableHead>Tên Nhân Viên</TableHead>
                  <TableHead>Phòng Ban</TableHead>
                  <TableHead>Ca Làm Việc</TableHead>
                  <TableHead>Chức Danh</TableHead>
                  <TableHead>Ngày Bắt Đầu</TableHead>
                  <TableHead className="w-24">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-sm font-semibold">
                      {emp.employee_code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{emp.full_name}</p>
                        <p className="text-sm text-muted-foreground">{emp.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingId === emp.id ? (
                        <Select
                          value={editData.department_id ?? ""}
                          onValueChange={(value) => setEditData({ ...editData, department_id: value })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Chọn phòng ban" />
                          </SelectTrigger>
                          <SelectContent>
                            {(departmentsQuery.data || []).map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={emp.current_department === "Chưa gán" ? "secondary" : "default"}>
                          {emp.current_department}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === emp.id ? (
                        <Select
                          value={editData.shift_id ?? ""}
                          onValueChange={(value) => setEditData({ ...editData, shift_id: value })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Chọn ca" />
                          </SelectTrigger>
                          <SelectContent>
                            {(shiftsQuery.data || []).map((shift) => (
                              <SelectItem key={shift.id} value={shift.id}>
                                {shift.name} ({shift.start_time} - {shift.end_time})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{emp.current_shift}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === emp.id ? (
                        <Select
                          value={editData.position_id ?? ""}
                          onValueChange={(value) => setEditData({ ...editData, position_id: value })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Chọn chức danh" />
                          </SelectTrigger>
                          <SelectContent>
                            {(positionsQuery.data || []).map((pos) => (
                              <SelectItem key={pos.id} value={pos.id}>
                                {pos.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{emp.current_position}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(emp.start_date).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingId === emp.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateAssignmentMutation.mutate({ id: emp.id, draft: editData })}
                              disabled={updateAssignmentMutation.isPending}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => startEdit(emp)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
