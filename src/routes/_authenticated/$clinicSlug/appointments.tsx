import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  CalendarClock,
  Filter,
  Plus,
  Search,
  Trash2,
  User,
  Edit2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

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
import { useClinicPath } from "@/hooks/use-clinic-path";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug/appointments")({
  head: () => ({
    meta: [
      { title: "Danh sách lịch hẹn — GZV Clinic Platform" },
      {
        name: "description",
        content: "Quản lý toàn bộ lịch hẹn, thanh toán và tái khám của phòng khám.",
      },
    ],
  }),
  component: AppointmentsPage,
});

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  patient_name: string;
  patient_phone: string;
  service_name: string;
  doctor_name: string;
  status: "scheduled" | "confirmed" | "cancelled" | "no_show" | "completed";
  payment_status: "unpaid" | "partial" | "paid";
  payment_method: string | null;
  total_amount: number;
  paid_amount: number;
  follow_up_date: string | null;
  notes: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Chưa xác nhận", color: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Đã xác nhận", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Hủy", color: "bg-red-100 text-red-800" },
  no_show: { label: "Không đến", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Hoàn tất", color: "bg-slate-100 text-slate-800" },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unpaid: { label: "Chưa TT", color: "bg-red-100 text-red-800" },
  partial: { label: "Đặt cọc", color: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Đã TT", color: "bg-green-100 text-green-800" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Quẹt thẻ",
  momo: "MoMo",
  zalopay: "ZaloPay",
  other: "Khác",
};

type EditForm = {
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: string;
  paid_amount: string;
  follow_up_date: string;
  notes: string;
};

function AppointmentsPage() {
  const buildPath = useClinicPath();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);

  const appointments = useQuery({
    queryKey: ["appointments", statusFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select(
          "id, appointment_date, start_time, patient:patients(full_name, phone), services(name), employees:assigned_dentist_id(full_name), status, payment_status, payment_method, total_amount, paid_amount, follow_up_date, notes",
        )
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: true });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const today = new Date().toISOString().split("T")[0] ?? "";
      if (dateFilter === "today") {
        query = query.eq("appointment_date", today);
      } else if (dateFilter === "upcoming") {
        query = query.gte("appointment_date", today);
      } else if (dateFilter === "past") {
        query = query.lt("appointment_date", today);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map(
        (item: any): Appointment => ({
          id: item.id,
          appointment_date: item.appointment_date,
          start_time: item.start_time,
          patient_name: item.patient?.full_name || "—",
          patient_phone: item.patient?.phone || "—",
          service_name: item.services?.name || "—",
          doctor_name: item.employees?.full_name || "Chưa gán bác sĩ",
          status: item.status,
          payment_status: item.payment_status ?? "unpaid",
          payment_method: item.payment_method,
          total_amount: item.total_amount ?? 0,
          paid_amount: item.paid_amount ?? 0,
          follow_up_date: item.follow_up_date,
          notes: item.notes,
        }),
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: EditForm) => {
      if (!editing) throw new Error("Chưa chọn lịch hẹn");
      const { error } = await supabase
        .from("appointments")
        .update({
          status: values.status,
          payment_status: values.payment_status,
          payment_method: values.payment_method || null,
          total_amount: Number(values.total_amount) || 0,
          paid_amount: Number(values.paid_amount) || 0,
          follow_up_date: values.follow_up_date || null,
          notes: values.notes || null,
          paid_at: values.payment_status !== "unpaid" ? new Date().toISOString() : null,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật lịch hẹn");
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã xóa lịch hẹn");
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openEdit = (appointment: Appointment) => {
    setEditing(appointment);
    setForm({
      status: appointment.status,
      payment_status: appointment.payment_status,
      payment_method: appointment.payment_method ?? "",
      total_amount: String(appointment.total_amount),
      paid_amount: String(appointment.paid_amount),
      follow_up_date: appointment.follow_up_date ?? "",
      notes: appointment.notes ?? "",
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Bạn chắc chắn muốn xóa lịch hẹn này?")) return;
    deleteMutation.mutate(id);
  };

  const filtered = (appointments.data ?? []).filter((record) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      record.patient_name.toLowerCase().includes(term) ||
      record.patient_phone.includes(term)
    );
  });

  const formatDateTime = (date: string, time: string) => {
    const dateObj = new Date(`${date}T${time}`);
    return dateObj.toLocaleString("vi-VN", {
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isUpcoming = (date: string) => {
    const appointmentDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointmentDate >= today;
  };

  return (
    <div>
      <PageHeader
        title="Danh sách hẹn"
        description="Quản lý tất cả các lịch hẹn, thanh toán, tái khám."
        actions={
          <Button asChild>
            <Link to={buildPath("/appointments/booking")}>
              <Plus className="mr-2 size-4" />
              Tạo hẹn mới
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Tìm kiếm</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc số điện thoại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Lọc ngày</label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <Calendar className="mr-2 size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả thời gian</SelectItem>
              <SelectItem value="today">Hôm nay</SelectItem>
              <SelectItem value="upcoming">Sắp tới</SelectItem>
              <SelectItem value="past">Đã qua</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium">Lọc trạng thái</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tất cả trạng thái</SelectItem>
              <SelectItem value="scheduled">Chưa xác nhận</SelectItem>
              <SelectItem value="confirmed">Đã xác nhận</SelectItem>
              <SelectItem value="completed">Hoàn tất</SelectItem>
              <SelectItem value="cancelled">Hủy</SelectItem>
              <SelectItem value="no_show">Không đến</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {appointments.isLoading ? (
        <LoadingState rows={8} />
      ) : appointments.isError ? (
        <ErrorState description={(appointments.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Không có lịch hẹn" description="Không có lịch hẹn phù hợp với bộ lọc." />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Bệnh nhân</TableHead>
                <TableHead>Bác sĩ</TableHead>
                <TableHead>Dịch vụ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thanh toán</TableHead>
                <TableHead>Tái khám</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((appointment) => (
                <TableRow key={appointment.id} className={!isUpcoming(appointment.appointment_date) ? "opacity-60" : ""}>
                  <TableCell className="font-medium">
                    {formatDateTime(appointment.appointment_date, appointment.start_time)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                        <User className="size-4 text-primary" />
                      </div>
                      <div>
                        <div>{appointment.patient_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{appointment.patient_phone}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{appointment.doctor_name}</TableCell>
                  <TableCell>{appointment.service_name}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_LABELS[appointment.status]?.color}>
                      {STATUS_LABELS[appointment.status]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={PAYMENT_STATUS_LABELS[appointment.payment_status]?.color}>
                        {PAYMENT_STATUS_LABELS[appointment.payment_status]?.label}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Wallet className="size-3" />
                        {appointment.paid_amount.toLocaleString("vi-VN")}đ/{appointment.total_amount.toLocaleString("vi-VN")}đ
                        {appointment.payment_method && ` · ${PAYMENT_METHOD_LABELS[appointment.payment_method] ?? appointment.payment_method}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {appointment.follow_up_date ? (
                      <span className="flex items-center gap-1 text-amber-600">
                        <CalendarClock className="size-3.5" />
                        {new Date(appointment.follow_up_date).toLocaleDateString("vi-VN")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(appointment)}>
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => handleDelete(appointment.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(editing && form)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa lịch hẹn — {editing?.patient_name}</DialogTitle>
            <DialogDescription>Cập nhật trạng thái, thanh toán và lịch tái khám.</DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Trạng thái hẹn</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Chưa xác nhận</SelectItem>
                    <SelectItem value="confirmed">Đã xác nhận</SelectItem>
                    <SelectItem value="completed">Hoàn tất</SelectItem>
                    <SelectItem value="cancelled">Hủy</SelectItem>
                    <SelectItem value="no_show">Không đến</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Trạng thái thanh toán</Label>
                <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Chưa thanh toán</SelectItem>
                    <SelectItem value="partial">Đã đặt cọc</SelectItem>
                    <SelectItem value="paid">Đã thanh toán đủ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Hình thức thanh toán</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn hình thức..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Tiền mặt</SelectItem>
                    <SelectItem value="bank_transfer">Chuyển khoản</SelectItem>
                    <SelectItem value="card">Quẹt thẻ</SelectItem>
                    <SelectItem value="momo">MoMo</SelectItem>
                    <SelectItem value="zalopay">ZaloPay</SelectItem>
                    <SelectItem value="other">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Ngày tái khám</Label>
                <Input
                  type="date"
                  value={form.follow_up_date}
                  onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tổng chi phí (đ)</Label>
                <Input
                  type="number"
                  value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Đã thanh toán (đ)</Label>
                <Input
                  type="number"
                  value={form.paid_amount}
                  onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Ghi chú</Label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                  rows={2}
                />
              </div>

              <Button
                className="sm:col-span-2"
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
