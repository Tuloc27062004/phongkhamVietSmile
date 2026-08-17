import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmployeeProfilePanel } from "@/components/employee-profile-panel";
import { ExportButton } from "@/components/export-button";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";
import { hasAnyRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/$clinicSlug/employees")({
  head: () => ({
    meta: [
      { title: "Nhân viên — GZV Clinic Platform" },
      { name: "description", content: "Danh bạ nhân viên phòng khám nha khoa." },
      { property: "og:title", content: "Nhân viên — GZV Clinic Platform" },
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

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  contract: "Hợp đồng",
  intern: "Thực tập",
};

function genEmployeeCode() {
  return `NV${Math.floor(1000 + Math.random() * 9000)}`;
}

type NewEmployeeForm = {
  full_name: string;
  phone: string;
  email: string;
  department_id: string;
  position_id: string;
  employment_type: string;
  start_date: string;
};

const EMPTY_NEW_EMPLOYEE: NewEmployeeForm = {
  full_name: "",
  phone: "",
  email: "",
  department_id: "",
  position_id: "",
  employment_type: "full_time",
  start_date: new Date().toISOString().split("T")[0] ?? "",
};

function EmployeesPage() {
  const { session } = useAuthSession();
  const { org } = Route.useRouteContext();
  const profileQuery = useSessionProfile(session?.user.id);
  const canEdit = hasAnyRole(profileQuery.data?.roles ?? [], ["administrator", "manager"]);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState<NewEmployeeForm>(EMPTY_NEW_EMPLOYEE);

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, employee_code, full_name, phone, email, device_user_id, employment_status, start_date, avatar_url, profile_photo_url, departments(name), positions(name), shifts(name)",
        )
        .is("deleted_at", null)
        .order("employee_code");
      if (error) throw error;
      return data;
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments-for-new-employee"],
    enabled: showAddForm,
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

  const positionsQuery = useQuery({
    queryKey: ["positions-for-new-employee"],
    enabled: showAddForm,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("id, name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (values: NewEmployeeForm) => {
      if (!values.full_name.trim()) throw new Error("Vui lòng nhập họ tên");
      const { error } = await supabase.from("employees").insert({
        organization_id: org.id,
        employee_code: genEmployeeCode(),
        full_name: values.full_name.trim(),
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        department_id: values.department_id || null,
        position_id: values.position_id || null,
        employment_type: values.employment_type as "full_time" | "part_time" | "contract" | "intern",
        start_date: values.start_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm nhân viên mới");
      setShowAddForm(false);
      setNewEmployee(EMPTY_NEW_EMPLOYEE);
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error: Error) => toast.error(error.message),
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
        description="Danh bạ nhân sự phòng khám. Nhấn vào một dòng để xem/sửa hồ sơ chi tiết."
        actions={
          <div className="flex gap-2">
            <ExportButton
              data={filtered.map((e) => ({
                ...e,
                position: e.positions?.name ?? "",
                department: e.departments?.name ?? "",
                status_label: STATUS_LABELS[e.employment_status] ?? e.employment_status,
              }))}
              columns={[
                { header: "Mã NV", key: "employee_code", width: 15 },
                { header: "Họ và tên", key: "full_name", width: 25 },
                { header: "Chức vụ", key: "position", width: 20 },
                { header: "Phòng ban", key: "department", width: 20 },
                { header: "Điện thoại", key: "phone", width: 15 },
                { header: "Trạng thái", key: "status_label", width: 15 },
              ]}
              filename="Danh_sach_nhan_vien"
              title="Danh Sách Nhân Viên"
            />
            {canEdit && (
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 size-4" />
                Thêm nhân viên
              </Button>
            )}
          </div>
        }
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
          description="Thử đổi từ khóa tìm kiếm hoặc thêm nhân viên mới."
        />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Mã NV</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Chức danh</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead>Ca mặc định</TableHead>
                <TableHead>Mã máy chấm công</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((employee) => {
                const avatar = employee.avatar_url || employee.profile_photo_url;
                return (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedEmployeeId(employee.id)}
                  >
                    <TableCell>
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground">
                        {avatar ? (
                          <img src={avatar} alt={employee.full_name} className="size-full object-cover" />
                        ) : (
                          (employee.full_name.charAt(0) ?? "?").toUpperCase()
                        )}
                      </div>
                    </TableCell>
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEmployeeId(employee.id);
                        }}
                      >
                        Xem hồ sơ
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(selectedEmployeeId)} onOpenChange={(open) => !open && setSelectedEmployeeId(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hồ sơ nhân viên</DialogTitle>
          </DialogHeader>
          {selectedEmployeeId && (
            <EmployeeProfilePanel employeeId={selectedEmployeeId} organizationId={org.id} editable={canEdit} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm nhân viên mới</DialogTitle>
            <DialogDescription>Mã nhân viên sẽ được tự động tạo. Có thể bổ sung ảnh/hồ sơ chi tiết sau.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Họ và tên *</Label>
              <Input
                value={newEmployee.full_name}
                onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phòng ban</Label>
              <Select
                value={newEmployee.department_id}
                onValueChange={(value) => setNewEmployee({ ...newEmployee, department_id: value })}
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
            <div className="space-y-1.5">
              <Label>Chức danh</Label>
              <Select
                value={newEmployee.position_id}
                onValueChange={(value) => setNewEmployee({ ...newEmployee, position_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn chức danh" />
                </SelectTrigger>
                <SelectContent>
                  {(positionsQuery.data ?? []).map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Loại hợp đồng</Label>
              <Select
                value={newEmployee.employment_type}
                onValueChange={(value) => setNewEmployee({ ...newEmployee, employment_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ngày bắt đầu</Label>
              <Input
                type="date"
                value={newEmployee.start_date}
                onChange={(e) => setNewEmployee({ ...newEmployee, start_date: e.target.value })}
              />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => createEmployeeMutation.mutate(newEmployee)}
            disabled={createEmployeeMutation.isPending}
          >
            {createEmployeeMutation.isPending ? "Đang lưu..." : "Thêm nhân viên"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
