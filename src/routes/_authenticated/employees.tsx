import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "Nhân viên — Việt Smile Clinic Suite" },
      { name: "description", content: "Danh bạ nhân viên phòng khám nha khoa." },
      { property: "og:title", content: "Nhân viên — Việt Smile Clinic Suite" },
      { property: "og:description", content: "Danh bạ nhân viên phòng khám nha khoa." },
    ],
  }),
  component: EmployeesPage,
});

const STATUS_LABELS: Record<string, string> = {
  active: "Đang làm việc",
  probation: "Thử việc",
  on_leave: "Nghỉ phép",
  suspended: "Tạm ngưng",
  terminated: "Đã nghỉ",
};

function EmployeesPage() {
  const [search, setSearch] = useState("");

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, employee_code, full_name, phone, email, device_user_id, employment_status, start_date, departments(name), positions(name), shifts(name)",
        )
        .is("deleted_at", null)
        .order("employee_code");
      if (error) throw error;
      return data;
    },
  });

  const filtered = (employees.data ?? []).filter((employee) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      employee.full_name.toLowerCase().includes(term) ||
      employee.employee_code.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <PageHeader
        title="Nhân viên"
        description="Danh bạ nhân sự phòng khám. Thêm và chỉnh sửa chi tiết sẽ mở ở giai đoạn 2."
        actions={<Button disabled>Thêm nhân viên</Button>}
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Tìm theo tên hoặc mã nhân viên..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {employees.isLoading ? (
        <LoadingState rows={4} />
      ) : employees.isError ? (
        <ErrorState description={(employees.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Chưa có nhân viên phù hợp"
          description="Thử đổi từ khóa tìm kiếm hoặc thêm nhân viên mới ở giai đoạn 2."
        />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã NV</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Chức danh</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead>Ca mặc định</TableHead>
                <TableHead>Mã máy chấm công</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.employee_code}</TableCell>
                  <TableCell>{employee.full_name}</TableCell>
                  <TableCell>{employee.positions?.name ?? "—"}</TableCell>
                  <TableCell>{employee.departments?.name ?? "—"}</TableCell>
                  <TableCell>{employee.phone ?? "—"}</TableCell>
                  <TableCell>{employee.shifts?.name ?? "—"}</TableCell>
                  <TableCell>{employee.device_user_id ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={employee.employment_status === "active" ? "default" : "secondary"}>
                      {STATUS_LABELS[employee.employment_status] ?? employee.employment_status}
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
