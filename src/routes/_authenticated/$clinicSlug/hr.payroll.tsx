import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle,
  Edit,
  Printer,
  Save,
  TrendingDown,
  TrendingUp,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug/hr/payroll")({
  head: () => ({
    meta: [
      { title: "Lương — GZV Clinic Platform" },
      { name: "description", content: "Cấu hình lương và tính lương tự động dựa trên chấm công." },
    ],
  }),
  component: SalaryPage,
});

function SalaryPage() {
  return (
    <div>
      <PageHeader
        title="Lương"
        description="Cấu hình lương cơ bản/phụ cấp và tính lương tự động dựa trên chấm công."
      />
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Cấu hình lương</TabsTrigger>
          <TabsTrigger value="payroll">Tính lương</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-6">
          <SalaryConfigTab />
        </TabsContent>
        <TabsContent value="payroll" className="mt-6">
          <PayrollTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

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

function SalaryConfigTab() {
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
        (sum, emp) => sum + emp.late_deduction + emp.absence_deduction + emp.insurance_deduction,
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 p-6">
          <p className="text-sm text-gray-600">Tổng Nhân Viên</p>
          <p className="text-3xl font-bold text-blue-600">{stats.totalEmployees}</p>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng Tính Lương</p>
              <p className="text-2xl font-bold text-green-600">
                {(stats.totalPayroll / 1000000).toFixed(1)}M
              </p>
            </div>
            <TrendingUp className="size-6 text-green-600" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng Trừ Lương</p>
              <p className="text-2xl font-bold text-red-600">
                {(stats.totalDeductions / 1000000).toFixed(1)}M
              </p>
            </div>
            <TrendingDown className="size-6 text-red-600" />
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-64 flex-1">
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

      {salaryQuery.isLoading ? (
        <LoadingState rows={5} />
      ) : salaryQuery.isError ? (
        <ErrorState description={(salaryQuery.error as Error).message} />
      ) : filteredData.length === 0 ? (
        <EmptyState title="Không tìm thấy nhân viên" />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
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
                            setEditData({ ...editData, base_salary: Number(e.target.value) })
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
                            setEditData({ ...editData, allowance: Number(e.target.value) })
                          }
                          className="w-20 text-right"
                        />
                      ) : (
                        <span className="font-medium text-green-600">
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
                            setEditData({ ...editData, bonus: Number(e.target.value) })
                          }
                          className="w-20 text-right"
                        />
                      ) : (
                        <span className="font-medium text-green-600">
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
                          className="w-24 bg-gray-100 text-right"
                        />
                      ) : (
                        <span className="font-medium text-red-600">
                          -
                          {(
                            salary.late_deduction +
                            salary.absence_deduction +
                            salary.insurance_deduction
                          ).toLocaleString("vi-VN")}
                          đ
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-blue-600">
                        {calculateTotal(
                          editingId === salary.id ? { ...salary, ...editData } : salary,
                        ).toLocaleString("vi-VN")}
                        đ
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
                                updateSalaryMutation.mutate({ ...salary, ...editData });
                              }}
                              disabled={updateSalaryMutation.isPending}
                            >
                              <Save className="size-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                              <X className="size-4" />
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
                            <Edit className="size-4" />
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

interface PayrollData {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  month: number;
  year: number;
  total_days: number;
  worked_days: number;
  late_days: number;
  absent_days: number;
  paid_days: number;
  base_salary: number;
  late_deduction: number;
  absence_deduction: number;
  insurance: number;
  net_salary: number;
  status: "pending" | "calculated" | "approved" | "paid";
  pay_date?: string;
}

function PayrollTab() {
  const { org } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [printTarget, setPrintTarget] = useState<PayrollData | null>(null);

  const printTable = () => {
    setPrintTarget(null);
    setTimeout(() => window.print(), 50);
  };

  const printPayslip = (payroll: PayrollData) => {
    setPrintTarget(payroll);
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 50);
  };

  const payrollQuery = useQuery({
    queryKey: ["payroll", selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance_records")
        .select(
          `id,
          employee_id,
          employees(id, employee_code, full_name, salary_config(base_salary)),
          attendance_status,
          late_minutes`,
        )
        .gte("work_date", startDate.toISOString().split("T")[0])
        .lte("work_date", endDate.toISOString().split("T")[0]);

      if (attendanceError) throw attendanceError;

      const payrollMap = new Map<string, PayrollData>();

      (attendanceData || []).forEach((record: any) => {
        const key = record.employee_id;
        if (!payrollMap.has(key)) {
          payrollMap.set(key, {
            id: key,
            employee_id: key,
            employee_code: record.employees?.employee_code || "",
            full_name: record.employees?.full_name || "",
            month: selectedMonth,
            year: selectedYear,
            total_days: 26,
            worked_days: 0,
            late_days: 0,
            absent_days: 0,
            paid_days: 0,
            base_salary: record.employees?.salary_config?.[0]?.base_salary || 0,
            late_deduction: 0,
            absence_deduction: 0,
            insurance: 0,
            net_salary: 0,
            status: "calculated",
          });
        }

        const payroll = payrollMap.get(key)!;

        if (record.attendance_status === "absent") {
          payroll.absent_days++;
          payroll.absence_deduction += payroll.base_salary / 26;
        } else if (
          record.attendance_status === "leave" ||
          record.attendance_status === "sick" ||
          record.attendance_status === "holiday"
        ) {
          payroll.paid_days++;
          payroll.worked_days++;
        } else {
          payroll.worked_days++;
          if ((record.late_minutes || 0) > 15) {
            payroll.late_days++;
            payroll.late_deduction += (payroll.base_salary / 26 / 8 / 60) * (record.late_minutes || 0);
          }
        }
      });

      payrollMap.forEach((payroll) => {
        payroll.insurance = (payroll.base_salary * 10) / 100;
        payroll.net_salary =
          payroll.base_salary - payroll.late_deduction - payroll.absence_deduction - payroll.insurance;
      });

      return Array.from(payrollMap.values());
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (payrollData: PayrollData) => {
      const { error } = await supabase.from("payroll_records").upsert(
        [
          {
            employee_id: payrollData.employee_id,
            month: payrollData.month,
            year: payrollData.year,
            worked_days: payrollData.worked_days,
            late_days: payrollData.late_days,
            absent_days: payrollData.absent_days,
            base_salary: payrollData.base_salary,
            late_deduction: payrollData.late_deduction,
            absence_deduction: payrollData.absence_deduction,
            insurance: payrollData.insurance,
            net_salary: payrollData.net_salary,
            status: "approved",
            approved_at: new Date().toISOString(),
          },
        ],
        { onConflict: "employee_id,month,year" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });

  const filteredPayroll = (payrollQuery.data || []).filter(
    (item) =>
      item.full_name.toLowerCase().includes(search.toLowerCase()) ||
      item.employee_code.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    totalEmployees: filteredPayroll.length,
    totalSalary: filteredPayroll.reduce((sum, p) => sum + p.base_salary, 0),
    totalDeductions: filteredPayroll.reduce(
      (sum, p) => sum + p.late_deduction + p.absence_deduction + p.insurance,
      0,
    ),
    totalNetSalary: filteredPayroll.reduce((sum, p) => sum + p.net_salary, 0),
  };

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex items-center gap-4">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-40 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={m.toString()}>
                  Tháng {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-40 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  Năm {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={printTable} disabled={filteredPayroll.length === 0}>
            <Printer className="mr-2 size-4" />
            In bảng lương
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 p-4">
            <p className="text-sm text-gray-600">Tổng Nhân Viên</p>
            <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 p-4">
            <p className="text-sm text-gray-600">Tổng Lương Cơ Bản</p>
            <p className="text-xl font-bold text-green-600">
              {(stats.totalSalary / 1000000).toFixed(1)}M
            </p>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 p-4">
            <p className="text-sm text-gray-600">Tổng Trừ Lương</p>
            <p className="text-xl font-bold text-red-600">
              {(stats.totalDeductions / 1000000).toFixed(2)}M
            </p>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 p-4">
            <p className="text-sm text-gray-600">Tổng Lương Thực</p>
            <p className="text-xl font-bold text-purple-600">
              {(stats.totalNetSalary / 1000000).toFixed(1)}M
            </p>
          </Card>
        </div>

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

        {payrollQuery.isLoading ? (
          <LoadingState rows={5} />
        ) : payrollQuery.isError ? (
          <ErrorState description={(payrollQuery.error as Error).message} />
        ) : filteredPayroll.length === 0 ? (
          <EmptyState title="Không có dữ liệu chấm công" />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Mã NV</TableHead>
                    <TableHead>Tên Nhân Viên</TableHead>
                    <TableHead className="text-center">Công Việc</TableHead>
                    <TableHead className="text-center">Đi Trễ</TableHead>
                    <TableHead className="text-center">Vắng Mặt</TableHead>
                    <TableHead className="text-right">Lương Cơ Bản</TableHead>
                    <TableHead className="text-right">Trừ Đi Trễ</TableHead>
                    <TableHead className="text-right">Trừ Vắng Mặt</TableHead>
                    <TableHead className="text-right">Bảo Hiểm</TableHead>
                    <TableHead className="text-right">Lương Thực</TableHead>
                    <TableHead className="w-24">Trạng Thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayroll.map((payroll) => (
                    <TableRow key={payroll.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm font-semibold">
                        {payroll.employee_code}
                      </TableCell>
                      <TableCell className="font-medium">{payroll.full_name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{payroll.worked_days} ngày</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.late_days > 0 ? (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            {payroll.late_days} lần
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.absent_days > 0 ? (
                          <Badge variant="destructive">{payroll.absent_days} ngày</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {payroll.base_salary.toLocaleString("vi-VN")}đ
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.late_deduction > 0 ? (
                          <span className="font-medium text-red-600">
                            -{payroll.late_deduction.toLocaleString("vi-VN")}đ
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {payroll.absence_deduction > 0 ? (
                          <span className="font-medium text-red-600">
                            -{payroll.absence_deduction.toLocaleString("vi-VN")}đ
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-red-600">
                          -{payroll.insurance.toLocaleString("vi-VN")}đ
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-blue-600">
                          {payroll.net_salary.toLocaleString("vi-VN")}đ
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveMutation.mutate(payroll)}
                            disabled={approveMutation.isPending || payroll.status === "approved"}
                          >
                            <CheckCircle className="mr-1 size-4" />
                            {payroll.status === "approved" ? "Đã duyệt" : "Duyệt"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="In phiếu lương"
                            onClick={() => printPayslip(payroll)}
                          >
                            <Printer className="size-4" />
                          </Button>
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

      <div className="hidden print:block">
        {printTarget ? (
          <PayslipPrint clinicName={org.name} payroll={printTarget} />
        ) : (
          <PayrollTablePrint
            clinicName={org.name}
            month={selectedMonth}
            year={selectedYear}
            rows={filteredPayroll}
          />
        )}
      </div>
    </>
  );
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("vi-VN")}đ`;
}

function PayrollTablePrint({
  clinicName,
  month,
  year,
  rows,
}: {
  clinicName: string;
  month: number;
  year: number;
  rows: PayrollData[];
}) {
  const totalNet = rows.reduce((sum, r) => sum + r.net_salary, 0);
  return (
    <div className="p-8 text-black">
      <h1 className="text-xl font-bold">{clinicName}</h1>
      <h2 className="mt-1 text-lg font-semibold">
        BẢNG LƯƠNG THÁNG {month}/{year}
      </h2>
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-1 text-left">Mã NV</th>
            <th className="py-1 text-left">Họ tên</th>
            <th className="py-1 text-right">Công</th>
            <th className="py-1 text-right">Trễ</th>
            <th className="py-1 text-right">Vắng</th>
            <th className="py-1 text-right">Lương CB</th>
            <th className="py-1 text-right">Trừ</th>
            <th className="py-1 text-right">Thực lãnh</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-300">
              <td className="py-1">{r.employee_code}</td>
              <td className="py-1">{r.full_name}</td>
              <td className="py-1 text-right">{r.worked_days}</td>
              <td className="py-1 text-right">{r.late_days}</td>
              <td className="py-1 text-right">{r.absent_days}</td>
              <td className="py-1 text-right">{money(r.base_salary)}</td>
              <td className="py-1 text-right">
                {money(r.late_deduction + r.absence_deduction + r.insurance)}
              </td>
              <td className="py-1 text-right font-semibold">{money(r.net_salary)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={7} className="py-2 text-right">
              Tổng thực lãnh
            </td>
            <td className="py-2 text-right">{money(totalNet)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-10 text-right text-sm">Ngày in: {new Date().toLocaleDateString("vi-VN")}</p>
    </div>
  );
}

function PayslipPrint({ clinicName, payroll }: { clinicName: string; payroll: PayrollData }) {
  return (
    <div className="p-8 text-black">
      <h1 className="text-xl font-bold">{clinicName}</h1>
      <h2 className="mt-1 text-lg font-semibold">
        PHIẾU LƯƠNG THÁNG {payroll.month}/{payroll.year}
      </h2>

      <div className="mt-6 space-y-1 text-sm">
        <p>
          <span className="font-medium">Mã nhân viên:</span> {payroll.employee_code}
        </p>
        <p>
          <span className="font-medium">Họ và tên:</span> {payroll.full_name}
        </p>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <tbody>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Số ngày công</td>
            <td className="py-1.5 text-right">{payroll.worked_days} ngày</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Số lần đi trễ</td>
            <td className="py-1.5 text-right">{payroll.late_days} lần</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Số ngày vắng mặt</td>
            <td className="py-1.5 text-right">{payroll.absent_days} ngày</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Lương cơ bản</td>
            <td className="py-1.5 text-right">{money(payroll.base_salary)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Trừ đi trễ</td>
            <td className="py-1.5 text-right">-{money(payroll.late_deduction)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Trừ vắng mặt</td>
            <td className="py-1.5 text-right">-{money(payroll.absence_deduction)}</td>
          </tr>
          <tr className="border-b border-gray-300">
            <td className="py-1.5">Bảo hiểm</td>
            <td className="py-1.5 text-right">-{money(payroll.insurance)}</td>
          </tr>
          <tr className="border-t-2 border-black font-bold">
            <td className="py-2">Thực lãnh</td>
            <td className="py-2 text-right">{money(payroll.net_salary)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <p className="font-medium">Người lập phiếu</p>
          <p className="mt-16 text-xs text-gray-500">(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-medium">Nhân viên nhận lương</p>
          <p className="mt-16 text-xs text-gray-500">(Ký, ghi rõ họ tên)</p>
        </div>
      </div>

      <p className="mt-10 text-right text-sm">Ngày in: {new Date().toLocaleDateString("vi-VN")}</p>
    </div>
  );
}
