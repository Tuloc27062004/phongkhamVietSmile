import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Check, Edit2, Plus, Search, Trash2, X } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/attendance/adjustments")({
  head: () => ({
    meta: [
      { title: "Điều chỉnh công — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Điều chỉnh bản ghi chấm công cho nhân viên.",
      },
      {
        property: "og:title",
        content: "Điều chỉnh công — Việt Smile Clinic Suite",
      },
    ],
  }),
  component: AttendanceAdjustmentsPage,
});

type Adjustment = {
  id: string;
  employee_id: string;
  adjustment_date: string;
  adjustment_type: "add_day" | "remove_day" | "time_correction" | "status_change";
  reason: string;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  notes: string | null;
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

function AttendanceAdjustmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const adjustments = useQuery({
    queryKey: ["attendance-adjustments", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("attendance_adjustments")
        .select(
          "id, employee_id, adjustment_date, adjustment_type, reason, status, approved_by, notes, employee:employees(full_name, employee_code)",
        )
        .order("adjustment_date", { ascending: false });

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
      void queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    },
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
      void queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    },
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
      void queryClient.invalidateQueries({ queryKey: ["attendance-adjustments"] });
    },
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
                  <TableCell className="text-sm">{adjustment.reason}</TableCell>
                  <TableCell className="text-sm">
                    {new Date(adjustment.adjustment_date).toLocaleDateString("vi-VN")}
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
    </div>
  );
}
