import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Check, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useClinicPath } from "@/hooks/use-clinic-path";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/$clinicSlug/attendance/adjustments")({
  head: () => ({
    meta: [
      { title: "Điều chỉnh công — GZV Clinic Platform" },
      {
        name: "description",
        content: "Điều chỉnh bản ghi chấm công cho nhân viên.",
      },
      {
        property: "og:title",
        content: "Điều chỉnh công — GZV Clinic Platform",
      },
    ],
  }),
  component: AttendanceAdjustmentsPage,
});

type Adjustment = {
  id: string;
  employee_id: string;
  created_at: string;
  adjustment_type: "add_day" | "remove_day" | "time_correction" | "status_change";
  reason: string;
  adjusted_value: string | null;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  employee: {
    full_name: string;
    employee_code: string;
  };
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Đã phê duyệt", color: "bg-green-100 text-green-800" },
  rejected: { label: "Từ chối", color: "bg-red-100 text-red-800" },
};

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  add_day: "Thêm ngày công",
  remove_day: "Bớt ngày công",
  time_correction: "Sửa giờ công",
  status_change: "Thay đổi trạng thái",
};

type NewAdjustmentForm = {
  employee_id: string;
  adjustment_type: Adjustment["adjustment_type"];
  reason: string;
  adjusted_value: string;
};

const EMPTY_NEW_ADJUSTMENT: NewAdjustmentForm = {
  employee_id: "",
  adjustment_type: "time_correction",
  reason: "",
  adjusted_value: "",
};

function AttendanceAdjustmentsPage() {
  const { org } = Route.useRouteContext();
  const { session } = useAuthSession();
  const buildPath = useClinicPath();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [newAdjustment, setNewAdjustment] = useState<NewAdjustmentForm>(EMPTY_NEW_ADJUSTMENT);
  const queryClient = useQueryClient();

  const employeesQuery = useQuery({
    queryKey: ["employees-for-adjustment"],
    enabled: showForm,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code")
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const createAdjustment = useMutation({
    mutationFn: async (values: NewAdjustmentForm) => {
      if (!values.employee_id) throw new Error("Vui lòng chọn nhân viên");
      if (!values.reason.trim()) throw new Error("Vui lòng nhập lý do điều chỉnh");
      const { error } = await supabase.from("attendance_adjustments").insert({
        organization_id: org.id,
        employee_id: values.employee_id,
        adjustment_type: values.adjustment_type,
        reason: values.reason.trim(),
        adjusted_value: values.adjusted_value.trim() || null,
        requested_by: session?.user.id ?? null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã tạo yêu cầu điều chỉnh");
      setShowForm(false);
      setNewAdjustment(EMPTY_NEW_ADJUSTMENT);
      void queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjustments = useQuery({
    queryKey: ["attendance-adjustments", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("attendance_adjustments")
        .select(
          "id, employee_id, created_at, adjustment_type, reason, adjusted_value, status, approved_by, employee:employees(full_name, employee_code)",
        )
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as Adjustment[]) || [];
    },
  });

  const deleteAdjustment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("attendance_adjustments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xóa yêu cầu điều chỉnh");
      void queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approveAdjustment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("attendance_adjustments")
        .update({ status: "approved" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã phê duyệt điều chỉnh");
      void queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rejectAdjustment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("attendance_adjustments")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã từ chối yêu cầu điều chỉnh");
      void queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = (adjustments.data ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      record.employee.full_name.toLowerCase().includes(term) ||
      record.employee.employee_code.toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <PageHeader
        title="Điều chỉnh công"
        description="Quản lý các yêu cầu điều chỉnh bản ghi chấm công cho nhân viên."
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 size-4" />
            Tạo điều chỉnh
          </Button>
        }
      />

      <Card className="quiet-card mb-4 min-w-0 border-warning/25 bg-warning/10 p-4 text-sm">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-warning-foreground">
              Trang này chỉ là sổ yêu cầu/phê duyệt — "Phê duyệt" không tự sửa bản ghi chấm công
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sau khi phê duyệt một yêu cầu ở đây, bạn vẫn phải vào{" "}
              <Link to={buildPath("/attendance/checkin")} className="font-medium text-primary underline">
                Chấm công → Chấm công thủ công
              </Link>{" "}
              để sửa trực tiếp giờ vào/ra hoặc trạng thái của nhân viên — chỉ thay đổi ở đó mới được tính vào
              bảng lương.
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
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

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Lọc trạng thái</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả trạng thái</SelectItem>
              <SelectItem value="pending">Chờ xử lý</SelectItem>
              <SelectItem value="approved">Đã phê duyệt</SelectItem>
              <SelectItem value="rejected">Từ chối</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {adjustments.isLoading ? (
        <LoadingState rows={6} />
      ) : adjustments.isError ? (
        <ErrorState description={(adjustments.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có yêu cầu điều chỉnh"
          description="Tạo yêu cầu điều chỉnh mới để quản lý công cho nhân viên."
        />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã NV</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Loại điều chỉnh</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((adjustment) => (
                <TableRow key={adjustment.id}>
                  <TableCell className="font-medium">
                    {adjustment.employee.employee_code}
                  </TableCell>
                  <TableCell>{adjustment.employee.full_name}</TableCell>
                  <TableCell className="text-sm">
                    {ADJUSTMENT_TYPE_LABELS[adjustment.adjustment_type] ||
                      adjustment.adjustment_type}
                  </TableCell>
                  <TableCell className="text-sm">
                    {adjustment.reason}
                    {adjustment.adjusted_value && (
                      <span className="text-muted-foreground"> ({adjustment.adjusted_value})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(adjustment.created_at).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_LABELS[adjustment.status]?.color}>
                      {STATUS_LABELS[adjustment.status]?.label || adjustment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {adjustment.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void approveAdjustment.mutateAsync(adjustment.id)
                            }
                            disabled={approveAdjustment.isPending}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void rejectAdjustment.mutateAsync(adjustment.id)
                            }
                            disabled={rejectAdjustment.isPending}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-red-600">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogTitle>Xóa điều chỉnh</AlertDialogTitle>
                          <AlertDialogDescription>
                            Bạn chắc chắn muốn xóa yêu cầu điều chỉnh này? Hành động này không
                            thể hoàn tác.
                          </AlertDialogDescription>
                          <div className="flex justify-end gap-3">
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                void deleteAdjustment.mutateAsync(adjustment.id)
                              }
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Xóa
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo yêu cầu điều chỉnh công</DialogTitle>
            <DialogDescription>Yêu cầu sẽ ở trạng thái "Chờ xử lý" cho tới khi được phê duyệt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nhân viên *</Label>
              <Select
                value={newAdjustment.employee_id}
                onValueChange={(value) => setNewAdjustment({ ...newAdjustment, employee_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhân viên" />
                </SelectTrigger>
                <SelectContent>
                  {(employeesQuery.data ?? []).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Loại điều chỉnh</Label>
              <Select
                value={newAdjustment.adjustment_type}
                onValueChange={(value) =>
                  setNewAdjustment({ ...newAdjustment, adjustment_type: value as Adjustment["adjustment_type"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Giá trị điều chỉnh (tùy chọn)</Label>
              <Input
                placeholder="VD: 08:00-17:00, hoặc ngày 2026-08-14..."
                value={newAdjustment.adjusted_value}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, adjusted_value: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lý do *</Label>
              <Input
                placeholder="VD: Quên chấm công buổi sáng do lỗi máy"
                value={newAdjustment.reason}
                onChange={(e) => setNewAdjustment({ ...newAdjustment, reason: e.target.value })}
              />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => createAdjustment.mutate(newAdjustment)}
            disabled={createAdjustment.isPending}
          >
            {createAdjustment.isPending ? "Đang tạo..." : "Tạo yêu cầu"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
