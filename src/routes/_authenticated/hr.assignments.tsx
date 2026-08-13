import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  Users,
  Clock,
  Search,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

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

export const Route = createFileRoute("/_authenticated/hr/assignments")({
  head: () => ({
    meta: [
      { title: "Gán Công Việc — Việt Smile Clinic Suite" },
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
  current_department: string;
  current_shift: string;
  current_position: string;
  start_date: string;
  employment_status: string;
}

function AssignmentPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<EmployeeAssignment>>({});

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
          shift_id,
          position_id,
          departments(name),
          positions(name),
          shifts(name)`,
        )
        .is("deleted_at", null)
        .eq("employment_status", "active")
        .order("full_name");

      if (error) throw error;

      return (employees || []).map((emp: any) => ({
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        email: emp.email,
        current_department: emp.departments?.name || "Chưa gán",
        current_shift: emp.shifts?.name || "Chưa gán",
        current_position: emp.positions?.name || "Chưa gán",
        start_date: emp.start_date,
        employment_status: emp.employment_status,
      }));
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
    mutationFn: async (assignment: any) => {
      const { error } = await supabase
        .from("employees")
        .update({
          department_id: assignment.department_id,
          default_shift_id: assignment.shift_id,
          position_id: assignment.position_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees-assignment"] });
      setEditingId(null);
    },
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gán Công Việc"
        description="Gán phòng ban, ca làm việc, chức danh cho nhân viên."
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng Nhân Viên</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalEmployees}</p>
            </div>
            <div className="bg-blue-200 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Đã Gán Công Việc</p>
              <p className="text-3xl font-bold text-green-600">{stats.assigned}</p>
            </div>
            <div className="bg-green-200 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Chưa Gán Công Việc</p>
              <p className="text-3xl font-bold text-red-600">{stats.unassigned}</p>
            </div>
            <div className="bg-red-200 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
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
                        <p className="text-sm text-gray-500">{emp.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingId === emp.id ? (
                        <Select
                          value={editData.current_department || emp.current_department}
                          onValueChange={(value) =>
                            setEditData({
                              ...editData,
                              current_department: value,
                            })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(departmentsQuery.data || []).map((dept: any) => (
                              <SelectItem key={dept.id} value={dept.name}>
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
                          value={editData.current_shift || emp.current_shift}
                          onValueChange={(value) =>
                            setEditData({
                              ...editData,
                              current_shift: value,
                            })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(shiftsQuery.data || []).map((shift: any) => (
                              <SelectItem key={shift.id} value={shift.name}>
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
                          value={editData.current_position || emp.current_position}
                          onValueChange={(value) =>
                            setEditData({
                              ...editData,
                              current_position: value,
                            })
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(positionsQuery.data || []).map((pos: any) => (
                              <SelectItem key={pos.id} value={pos.name}>
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
                              onClick={() => {
                                updateAssignmentMutation.mutate({
                                  id: emp.id,
                                  department_id: editData.current_department,
                                  shift_id: editData.current_shift,
                                  position_id: editData.current_position,
                                });
                              }}
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(emp.id);
                              setEditData(emp);
                            }}
                          >
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
