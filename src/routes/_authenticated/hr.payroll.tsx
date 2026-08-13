import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Download,
  Filter,
  Search,
  TrendingDown,
  Zap,
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

export const Route = createFileRoute("/_authenticated/hr/payroll")({
  head: () => ({
    meta: [
      { title: "Tính Lương — Việt Smile Clinic Suite" },
      { name: "description", content: "Tính lương, trừ lương đi trễ, vắng mặt tự động." },
    ],
  }),
  component: PayrollPage,
});

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

function PayrollPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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

      // Calculate payroll data
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

        if (record.attendance_status === "present") {
          payroll.worked_days++;
          if ((record.late_minutes || 0) > 15) {
            payroll.late_days++;
            payroll.late_deduction += (payroll.base_salary / 26 / 8 / 60) * (record.late_minutes || 0);
          }
        } else if (record.attendance_status === "absent") {
          payroll.absent_days++;
          payroll.absence_deduction += payroll.base_salary / 26;
        } else if (record.attendance_status === "leave") {
          payroll.paid_days++;
        }
      });

      // Calculate insurance and net salary
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
      const { error } = await supabase
        .from("payroll_records")
        .upsert(
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
    <div className="space-y-6">
      <PageHeader
        title="Tính Lương"
        description="Tính lương tự động dựa trên chấm công, trừ lương đi trễ, vắng mặt, bảo hiểm."
      />

      {/* Month/Year Selection */}
      <div className="flex gap-4 items-center">
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

        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Tải Xuống
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
          <p className="text-sm text-gray-600">Tổng Nhân Viên</p>
          <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
          <p className="text-sm text-gray-600">Tổng Lương Cơ Bản</p>
          <p className="text-xl font-bold text-green-600">
            {(stats.totalSalary / 1000000).toFixed(1)}M
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100">
          <p className="text-sm text-gray-600">Tổng Trừ Lương</p>
          <p className="text-xl font-bold text-red-600">
            {(stats.totalDeductions / 1000000).toFixed(2)}M
          </p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100">
          <p className="text-sm text-gray-600">Tổng Lương Thực</p>
          <p className="text-xl font-bold text-purple-600">
            {(stats.totalNetSalary / 1000000).toFixed(1)}M
          </p>
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
      {payrollQuery.isLoading ? (
        <LoadingState rows={5} />
      ) : payrollQuery.isError ? (
        <ErrorState description={(payrollQuery.error as Error).message} />
      ) : filteredPayroll.length === 0 ? (
        <EmptyState title="Không có dữ liệu chấm công" />
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
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
                        <span className="text-red-600 font-medium">
                          -{payroll.late_deduction.toLocaleString("vi-VN")}đ
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {payroll.absence_deduction > 0 ? (
                        <span className="text-red-600 font-medium">
                          -{payroll.absence_deduction.toLocaleString("vi-VN")}đ
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600 font-medium">
                        -{payroll.insurance.toLocaleString("vi-VN")}đ
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-blue-600">
                        {payroll.net_salary.toLocaleString("vi-VN")}đ
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveMutation.mutate(payroll)}
                        disabled={approveMutation.isPending || payroll.status === "approved"}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {payroll.status === "approved" ? "Đã duyệt" : "Duyệt"}
                      </Button>
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
