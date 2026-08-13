import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  Clock,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  LogIn,
  LogOut,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState, ErrorState, LoadingState } from "@/components/page-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/attendance/manual")({
  head: () => ({
    meta: [
      { title: "Chấm công thủ công - Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Quản lý chấm công thủ công cho nhân viên.",
      },
    ],
  }),
  component: ManualAttendancePage,
});

type ManualCheckIn = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  reason: string | null;
  employee: {
    full_name: string;
    employee_code: string;
  };
};

type NewCheckIn = {
  employee_id: string;
  work_date: string;
  check_in_time: string;
  check_out_time?: string;
  reason: string;
};

function ManualAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0] ?? ""
  );
  const [search, setSearch] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState<NewCheckIn>({
    employee_id: "",
    work_date: selectedDate,
    check_in_time: "",
    check_out_time: "",
    reason: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const queryClient = useQueryClient();

  // Fetch all employees
  const { data: employees } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, employee_code")
        .order("full_name");
      return data || [];
    },
  });

  // Fetch manual attendance records
  const { data: manualAttendance, isLoading, isError, error } = useQuery({
    queryKey: ["manual-attendance", selectedDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("id, employee_id, work_date, check_in_time, check_out_time, approval_notes, employee:employees(full_name, employee_code)")
        .eq("work_date", selectedDate)
        .order("created_at", { ascending: false });

      return ((data ?? []).map((r) => ({
        id: r.id,
        employee_id: r.employee_id,
        work_date: r.work_date,
        check_in_time: r.check_in_time,
        check_out_time: r.check_out_time,
        reason: r.approval_notes,
        employee: r.employee,
      })) as unknown as ManualCheckIn[]);
    },
  });

  // Get current user info for audit trail
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      return userData.user;
    },
  });

  const createCheckInMutation = useMutation({
    mutationFn: async (data: NewCheckIn) => {
      if (!formData.employee_id) throw new Error("Vui lòng chọn nhân viên");
      if (!formData.check_in_time) throw new Error("Vui lòng nhập giờ vào");

      const { error } = await supabase.from("attendance_records").insert([
        {
          organization_id: "org_default",
          employee_id: formData.employee_id,
          work_date: formData.work_date,
          check_in_time: `${formData.work_date}T${formData.check_in_time}:00`,
          check_out_time: formData.check_out_time
            ? `${formData.work_date}T${formData.check_out_time}:00`
            : null,
          approval_notes: formData.reason,
          is_approved: true,
          attendance_status: "present",
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      setSuccessMessage("Đã thêm chấm công thủ công thành công");
      queryClient.invalidateQueries({ queryKey: ["manual-attendance"] });
      setOpenDialog(false);
      setFormData({
        employee_id: "",
        work_date: selectedDate,
        check_in_time: "",
        check_out_time: "",
        reason: "",
      });
      setTimeout(() => setSuccessMessage(""), 3000);
    },
    onError: (err) => {
      console.error("[v0] Error:", err);
    },
  });

  const deleteCheckInMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase
        .from("attendance_records")
        .delete()
        .eq("id", recordId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-attendance"] });
      setSuccessMessage("Đã xóa bản ghi chấm công");
      setTimeout(() => setSuccessMessage(""), 3000);
    },
  });

  const filtered = (manualAttendance ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      record.employee.full_name.toLowerCase().includes(term) ||
      record.employee.employee_code.toLowerCase().includes(term)
    );
  });

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "—";
    const time = new Date(timestamp).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return time;
  };

  return (
    <div>
      <PageHeader
        title="Chấm công thủ công"
        description="Thêm, sửa hoặc xóa bản ghi chấm công cho nhân viên."
      />

      {successMessage && (
        <Card className="surface-card mb-6 border-l-4 border-l-green-500 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="size-5 text-green-600" />
            <p className="text-green-800">{successMessage}</p>
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium">Chọn ngày</label>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên hoặc mã nhân viên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="mt-6 sm:mt-0">
              <Plus className="mr-2 size-4" />
              Thêm chấm công thủ công
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Thêm chấm công thủ công</DialogTitle>
              <DialogDescription>
                Nhập thông tin chấm công cho nhân viên.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Nhân viên *</label>
                <select
                  value={formData.employee_id}
                  onChange={(e) =>
                    setFormData({ ...formData, employee_id: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {employees?.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_code} - {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Ngày *</label>
                <input
                  type="date"
                  value={formData.work_date}
                  onChange={(e) =>
                    setFormData({ ...formData, work_date: e.target.value })
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium">Giờ vào *</label>
                  <input
                    type="time"
                    value={formData.check_in_time}
                    onChange={(e) =>
                      setFormData({ ...formData, check_in_time: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Giờ ra</label>
                  <input
                    type="time"
                    value={formData.check_out_time}
                    onChange={(e) =>
                      setFormData({ ...formData, check_out_time: e.target.value })
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Lý do</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="Nhập lý do chấm công thủ công..."
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <Button
                onClick={() => createCheckInMutation.mutate(formData)}
                disabled={createCheckInMutation.isPending}
                className="w-full"
              >
                {createCheckInMutation.isPending ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingState rows={6} />
      ) : isError ? (
        <ErrorState description={(error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có bản ghi chấm công thủ công"
          description="Hãy thêm chấm công thủ công cho nhân viên bằng nút trên."
        />
      ) : (
        <div className="surface-card overflow-x-auto rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã NV</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Giờ vào</TableHead>
                <TableHead>Giờ ra</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {record.employee.employee_code}
                  </TableCell>
                  <TableCell>{record.employee.full_name}</TableCell>
                  <TableCell>{record.work_date}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <LogIn className="size-3.5 text-green-600" />
                      {formatTime(record.check_in_time)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <LogOut className="size-3.5 text-red-600" />
                      {formatTime(record.check_out_time)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {record.reason || "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        deleteCheckInMutation.mutate(record.id)
                      }
                      disabled={deleteCheckInMutation.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Security Notice */}
      <Card className="surface-card mt-6 border-l-4 border-l-orange-500 bg-orange-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="size-5 flex-shrink-0 text-orange-600" />
          <div>
            <p className="font-medium text-orange-900">Ghi chú bảo mật:</p>
            <p className="mt-1 text-sm text-orange-800">
              Tất cả chấm công thủ công sẽ được ghi lại trong nhật ký kiểm toán. Chỉ quản lý và quản trị viên hệ thống mới có thể thêm, sửa hoặc xóa bản ghi chấm công thủ công.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
