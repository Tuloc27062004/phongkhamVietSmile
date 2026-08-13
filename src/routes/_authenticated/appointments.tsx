import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Calendar,
  Filter,
  Plus,
  Search,
  Trash2,
  User,
  Edit2,
} from "lucide-react";

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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({
    meta: [
      { title: "Danh sách lịch hẹn — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Quản lý toàn bộ lịch hẹn của phòng khám.",
      },
      {
        property: "og:title",
        content: "Danh sách lịch hẹn — Việt Smile Clinic Suite",
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
  status: "scheduled" | "confirmed" | "cancelled" | "no_show" | "completed";
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Chưa xác nhận", color: "bg-blue-100 text-blue-800" },
  confirmed: { label: "Đã xác nhận", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Hủy", color: "bg-red-100 text-red-800" },
  no_show: { label: "Không đến", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Hoàn tất", color: "bg-slate-100 text-slate-800" },
};

function AppointmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const appointments = useQuery({
    queryKey: ["appointments", statusFilter, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select(
          "id, appointment_date, start_time, patient:patients(full_name, phone), services(name), status",
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

      return (
        data?.map((item: any) => ({
          ...item,
          patient_name: item.patient?.full_name || "—",
          patient_phone: item.patient?.phone || "—",
          service_name: item.services?.name || "—",
        })) || []
      );
    },
  });

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
        description="Quản lý tất cả các lịch hẹn, chỉnh sửa, hủy và xác nhận."
        actions={
          <Button>
            <Plus className="mr-2 size-4" />
            Tạo hẹn mới
          </Button>
        }
      />

      {/* Filters */}
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

      {/* Table */}
      {appointments.isLoading ? (
        <LoadingState rows={8} />
      ) : appointments.isError ? (
        <ErrorState description={(appointments.error as Error).message} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Không có lịch hẹn"
          description="Không có lịch hẹn phù hợp với bộ lọc."
        />
      ) : (
        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Bệnh nhân</TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead>Dịch vụ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((appointment) => (
                <TableRow
                  key={appointment.id}
                  className={
                    !isUpcoming(appointment.appointment_date)
                      ? "opacity-60"
                      : ""
                  }
                >
                  <TableCell className="font-medium">
                    {formatDateTime(
                      appointment.appointment_date,
                      appointment.start_time,
                    )}
                  </TableCell>
                  <TableCell className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="size-4 text-primary" />
                    </div>
                    {appointment.patient_name}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {appointment.patient_phone}
                  </TableCell>
                  <TableCell>{appointment.service_name}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_LABELS[appointment.status]?.color}>
                      {STATUS_LABELS[appointment.status]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600">
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
    </div>
  );
}
