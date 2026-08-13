import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  DollarSign,
  Search,
  Filter,
  Download,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Edit,
  Save,
  X,
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

export const Route = createFileRoute("/_authenticated/hr/salary")({
  head: () => ({
    meta: [
      { title: "Quản lý lương — Việt Smile Clinic Suite" },
      { name: "description", content: "Quản lý lương, phụ cấp, trừ lương cho nhân viên." },
    ],
  }),
  component: SalaryManagementPage,
});

interface EmployeeSalary {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  department_name: string;
  position_name: string;
  base_salary: number;
  allowance: number;
  bonus: number;
  late_deduction: number;
  absence_deduction: number;
  insurance_deduction: number;
  total_salary: number;
  is_active: boolean;
  employment_status: string;
  last_updated: string;
}

function SalaryManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<EmployeeSalary>>({});

  const salaryQuery = useQuery({
    queryKey: ["employee-salary", filterDept, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select(
          `id, 
          employee_code, 
          full_name, 
          email, 
          departments(name),
          positions(name),
          employment_status,
          salary_config(
            id, 
            base_salary, 
            allowance, 
            bonus, 
            late_deduction, 
            absence_deduction, 
            insurance_deduction
          )`,
        )
        .is("deleted_at", null);

      if (filterStatus !== "all") {
        query = query.eq(
          "employment_status",
          filterStatus as "active" | "on_leave" | "probation" | "suspended" | "terminated",
        );
      }

      const { data: employees, error } = await query.order("full_name");
      if (error) throw error;

      return (employees || []).map((emp: any) => ({
        id: emp.id,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        email: emp.email,
        department_name: emp.departments?.name || "N/A",
        position_name: emp.positions?.name || "N/A",
        base_salary: emp.salary_config?.[0]?.base_salary || 0,
        allowance: emp.salary_config?.[0]?.allowance || 0,
        bonus: emp.salary_config?.[0]?.bonus || 0,
        late_deduction: emp.salary_config?.[0]?.late_deduction || 0,
        absence_deduction: emp.salary_config?.[0]?.absence_deduction || 0,
        insurance_deduction: emp.salary_config?.[0]?.insurance_deduction || 0,
        is_active: emp.employment_status === "active",
        employment_status: emp.employment_status,
        last_updated: new Date().toLocaleDateString("vi-VN"),
        total_salary:
          (emp.salary_config?.[0]?.base_salary || 0) +
          (emp.salary_config?.[0]?.allowance || 0) +
          (emp.salary_config?.[0]?.bonus || 0) -
          (emp.salary_config?.[0]?.late_deduction || 0) -
          (emp.salary_config?.[0]?.absence_deduction || 0) -
          (emp.salary_config?.[0]?.insurance_deduction || 0),
      }));
    },
  });

  const updateSalaryMutation = useMutation({
    mutationFn: async (salary: EmployeeSalary) => {
      const { error } = await supabase
        .from("salary_config")
        .update({
          base_salary: salary.base_salary,
          allowance: salary.allowance,
          bonus: salary.bonus,
          late_deduction: salary.late_deduction,
          absence_deduction: salary.absence_deduction,
          insurance_deduction: salary.insurance_deduction,
          updated_at: new Date().toISOString(),
        })
        .eq("employee_id", salary.employee_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-salary"] });
      setEditingId(null);
    },
  });

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const filteredData = (salaryQuery.data || []).filter((item) => {
    const matchesSearch =
      item.full_name.toLowerCase().includes(search.toLowerCase()) ||
      item.employee_code.toLowerCase().includes(search.toLowerCase());
    const matchesDept = !filterDept || item.department_name === filterDept;
    return matchesSearch && matchesDept;
  });

  const stats = {
    totalEmployees: salaryQuery.data?.length || 0,
    totalPayroll:
      (salaryQuery.data || []).reduce(
        (sum, emp) =>
          sum +
          emp.base_salary +
          emp.allowance +
          emp.bonus -
          emp.late_deduction -
          emp.absence_deduction -
          emp.insurance_deduction,
        0,
      ) || 0,
    totalDeductions:
      (salaryQuery.data || []).reduce(
        (sum, emp) =>
          sum +
          emp.late_deduction +
          emp.absence_deduction +
          emp.insurance_deduction,
        0,
      ) || 0,
  };

  const calculateTotal = (salary: EmployeeSalary) => {
    return (
      salary.base_salary +
      salary.allowance +
      salary.bonus -
      salary.late_deduction -
      salary.absence_deduction -
      salary.insurance_deduction
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Lương"
        description="Quản lý lương cơ bản, phụ cấp, thưởng và các khoản trừ lương tự động."
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng Nhân Viên</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalEmployees}</p>
            </div>
            <div className="bg-blue-200 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng Tính Lương</p>
              <p className="text-2xl font-bold text-green-600">
                {(stats.totalPayroll / 1000000).toFixed(1)}M
              </p>
            </div>
            <div className="bg-green-200 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng Trừ Lương</p>
              <p className="text-2xl font-bold text-red-600">
                {(stats.totalDeductions / 1000000).toFixed(1)}M
              </p>
            </div>
            <div className="bg-red-200 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="Tìm theo tên hoặc mã nhân viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white"
          />
        </div>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="Chọn phòng ban" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tất cả phòng ban</SelectItem>
            {(departments.data || []).map((dept) => (
              <SelectItem key={dept.id} value={dept.name}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="active">Đang làm việc</SelectItem>
            <SelectItem value="probation">Thử việc</SelectItem>
            <SelectItem value="suspended">Tạm ngưng</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      {salaryQuery.isLoading ? (
        <LoadingState rows={5} />
      ) : salaryQuery.isError ? (
        <ErrorState description={(salaryQuery.error as Error).message} />
      ) : filteredData.length === 0 ? (
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
                  <TableHead className="text-right">Lương Cơ Bản</TableHead>
                  <TableHead className="text-right">Phụ Cấp</TableHead>
                  <TableHead className="text-right">Thưởng</TableHead>
                  <TableHead className="text-right">Trừ Lương</TableHead>
                  <TableHead className="text-right">Tính Thực</TableHead>
                  <TableHead className="w-24">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((salary) => (
                  <TableRow key={salary.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-sm font-semibold">
                      {salary.employee_code}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{salary.full_name}</p>
                        <p className="text-sm text-gray-500">{salary.position_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{salary.department_name}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === salary.id ? (
                        <Input
                          type="number"
                          value={editData.base_salary || salary.base_salary}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              base_salary: Number(e.target.value),
                            })
                          }
                          className="w-24 text-right"
                        />
                      ) : (
                        <span className="font-semibold">
                          {salary.base_salary.toLocaleString("vi-VN")}đ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === salary.id ? (
                        <Input
                          type="number"
                          value={editData.allowance || salary.allowance}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              allowance: Number(e.target.value),
                            })
                          }
                          className="w-20 text-right"
                        />
                      ) : (
                        <span className="text-green-600 font-medium">
                          +{salary.allowance.toLocaleString("vi-VN")}đ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === salary.id ? (
                        <Input
                          type="number"
                          value={editData.bonus || salary.bonus}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              bonus: Number(e.target.value),
                            })
                          }
                          className="w-20 text-right"
                        />
                      ) : (
                        <span className="text-green-600 font-medium">
                          +{salary.bonus.toLocaleString("vi-VN")}đ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === salary.id ? (
                        <Input
                          type="number"
                          value={
                            (editData.late_deduction || 0) +
                            (editData.absence_deduction || 0) +
                            (editData.insurance_deduction || 0)
                          }
                          disabled
                          className="w-24 text-right bg-gray-100"
                        />
                      ) : (
                        <span className="text-red-600 font-medium">
                          -{(salary.late_deduction + salary.absence_deduction + salary.insurance_deduction).toLocaleString("vi-VN")}đ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-blue-600">
                        {calculateTotal(editingId === salary.id ? { ...salary, ...editData } : salary).toLocaleString("vi-VN")}đ
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingId === salary.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                updateSalaryMutation.mutate({
                                  ...salary,
                                  ...editData,
                                });
                              }}
                              disabled={updateSalaryMutation.isPending}
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
                              setEditingId(salary.id);
                              setEditData(salary);
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
