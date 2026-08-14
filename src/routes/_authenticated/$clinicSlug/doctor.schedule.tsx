import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  Clock,
  User,
  Phone,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Send,
  Wallet,
  CalendarClock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useCurrentEmployee } from "@/hooks/use-session";
import { sendDoctorScheduleEmail } from "@/lib/notifications.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/$clinicSlug/doctor/schedule")({
  head: () => ({
    meta: [
      { title: "Lịch khám — GZV Clinic Platform" },
      { name: "description", content: "Lịch khám của bác sĩ" },
    ],
  }),
  component: DoctorSchedule,
});

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  service: string;
  status: string;
  notes: string;
  payment_status: string;
  payment_method: string | null;
  total_amount: number;
  paid_amount: number;
  follow_up_date: string | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Quẹt thẻ",
  momo: "MoMo",
  zalopay: "ZaloPay",
  other: "Khác",
};

const PAYMENT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  paid: { label: "Đã thanh toán", className: "bg-success/10 text-success" },
  partial: { label: "Đã đặt cọc", className: "bg-warning/10 text-warning-foreground" },
  unpaid: { label: "Chưa thanh toán", className: "bg-destructive/10 text-destructive" },
};

function DoctorSchedule() {
  const { session } = useAuthSession();
  const employeeQuery = useCurrentEmployee(session?.user.id);
  const employeeId = employeeQuery.data?.id;
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0] ?? "");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const sendScheduleEmail = useServerFn(sendDoctorScheduleEmail);

  const emailScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Missing employee id");
      const result = await sendScheduleEmail({ data: { employeeId, date: selectedDate } });
      if (!result.ok) {
        if (result.reason === "not_configured") {
          throw new Error("Phòng khám chưa cấu hình gửi email. Vào Hồ sơ phòng khám → Tích hợp Email để bật.");
        }
        if (result.reason === "no_doctor_email") {
          throw new Error("Tài khoản của bạn chưa có email trong hồ sơ nhân viên.");
        }
        throw new Error(result.error || "Gửi email thất bại");
      }
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Đã gửi lịch khám (${result.appointmentCount} cuộc hẹn) qua email!`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const appointmentsQuery = useQuery({
    queryKey: ["doctor-appointments", employeeId, selectedDate],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      if (!employeeId) throw new Error("Missing employee id");
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id,
          appointment_date,
          start_time,
          end_time,
          patient:patients(full_name, phone, email),
          service:services(name),
          status,
          notes,
          payment_status,
          payment_method,
          total_amount,
          paid_amount,
          follow_up_date
        `
        )
        .eq("assigned_dentist_id", employeeId)
        .eq("appointment_date", selectedDate)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data || []).map(
        (apt): Appointment => ({
          id: apt.id,
          appointment_date: apt.appointment_date,
          start_time: apt.start_time,
          end_time: apt.end_time,
          patient_name: apt.patient?.full_name || "N/A",
          patient_phone: apt.patient?.phone || "N/A",
          patient_email: apt.patient?.email || "",
          service: apt.service?.name || "N/A",
          status: apt.status,
          notes: apt.notes || "",
          payment_status: apt.payment_status ?? "unpaid",
          payment_method: apt.payment_method,
          total_amount: apt.total_amount ?? 0,
          paid_amount: apt.paid_amount ?? 0,
          follow_up_date: apt.follow_up_date,
        }),
      );
    },
  });

  const handlePrevDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split("T")[0] ?? "");
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split("T")[0] ?? "");
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0] ?? "");
  };

  if (employeeQuery.isLoading || appointmentsQuery.isLoading) {
    return <LoadingState rows={3} />;
  }

  if (appointmentsQuery.isError) {
    return <ErrorState description={(appointmentsQuery.error as Error).message} />;
  }

  if (!employeeQuery.data) {
    return (
      <ErrorState description="Tài khoản này chưa được liên kết với hồ sơ nhân viên." />
    );
  }

  const appointments = appointmentsQuery.data || [];
  const displayDate = new Date(selectedDate + "T00:00:00");
  const dateStr = displayDate.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch khám"
        description="Quản lý lịch khám của bác sĩ"
        actions={
          <Button
            variant="outline"
            onClick={() => emailScheduleMutation.mutate()}
            disabled={!employeeId || emailScheduleMutation.isPending}
          >
            {emailScheduleMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Gửi lịch ngày này qua email
          </Button>
        }
      />

      {/* Date Navigation */}
      <Card className="surface-card">
        <div className="flex items-center justify-between p-6">
          <Button variant="ghost" size="sm" onClick={handlePrevDay}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Ngày khám</p>
            <p className="text-2xl font-bold text-primary capitalize">{dateStr}</p>
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              Hôm nay
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNextDay}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatBox
          label="Tổng lịch hẹn"
          value={appointments.length}
          color="blue"
        />
        <StatBox
          label="Đã xác nhận"
          value={appointments.filter((a) => a.status === "confirmed").length}
          color="green"
        />
        <StatBox
          label="Chưa xác nhận"
          value={appointments.filter((a) => a.status === "pending").length}
          color="orange"
        />
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <Card className="quiet-card">
            <div className="flex flex-col items-center justify-center py-12">
              <Calendar className="mb-2 size-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">Không có lịch hẹn hôm nay</p>
            </div>
          </Card>
        ) : (
          appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onViewDetail={() => setSelectedAppointment(appointment)}
            />
          ))
        )}
      </div>

      <Dialog open={Boolean(selectedAppointment)} onOpenChange={(open) => !open && setSelectedAppointment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Chi tiết lịch hẹn</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-lg font-semibold text-foreground">{selectedAppointment.patient_name}</p>
                <p className="text-muted-foreground">{selectedAppointment.service}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-foreground">
                  <Clock className="size-4 text-muted-foreground" />
                  {selectedAppointment.start_time?.slice(0, 5)}
                  {selectedAppointment.end_time && `–${selectedAppointment.end_time.slice(0, 5)}`}
                </div>
                <div className="flex items-center gap-2 text-foreground">
                  <Phone className="size-4 text-muted-foreground" />
                  {selectedAppointment.patient_phone}
                </div>
                {selectedAppointment.patient_email && (
                  <div className="col-span-2 flex items-center gap-2 text-foreground">
                    <Mail className="size-4 text-muted-foreground" />
                    {selectedAppointment.patient_email}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4 text-muted-foreground" />
                  <span>
                    {selectedAppointment.paid_amount.toLocaleString("vi-VN")}đ /{" "}
                    {selectedAppointment.total_amount.toLocaleString("vi-VN")}đ
                    {selectedAppointment.payment_method &&
                      ` · ${PAYMENT_METHOD_LABELS[selectedAppointment.payment_method] ?? selectedAppointment.payment_method}`}
                  </span>
                </div>
                <Badge
                  className={`${
                    PAYMENT_STATUS_BADGE[selectedAppointment.payment_status]?.className ??
                    PAYMENT_STATUS_BADGE["unpaid"]!.className
                  } border-0`}
                >
                  {PAYMENT_STATUS_BADGE[selectedAppointment.payment_status]?.label ?? selectedAppointment.payment_status}
                </Badge>
              </div>
              {selectedAppointment.follow_up_date && (
                <div className="flex items-center gap-2 text-warning-foreground">
                  <CalendarClock className="size-4" />
                  Tái khám: {new Date(selectedAppointment.follow_up_date).toLocaleDateString("vi-VN")}
                </div>
              )}
              {selectedAppointment.notes && (
                <div className="flex items-start gap-2 text-foreground">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p>{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "orange";
}) {
  const textTone = {
    blue: "text-primary",
    green: "text-success",
    orange: "text-warning",
  };

  return (
    <Card className="quiet-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold ${textTone[color]}`}>{value}</p>
    </Card>
  );
}

function AppointmentCard({
  appointment,
  onViewDetail,
}: {
  appointment: Appointment;
  onViewDetail: () => void;
}) {
  const statusColors = {
    confirmed: { className: "bg-success/10 text-success", label: "Xác nhận" },
    pending: { className: "bg-warning/10 text-warning-foreground", label: "Chờ xác nhận" },
    completed: { className: "bg-primary/10 text-primary", label: "Hoàn thành" },
    cancelled: { className: "bg-destructive/10 text-destructive", label: "Hủy" },
  };

  const status = statusColors[appointment.status as keyof typeof statusColors] || statusColors.pending;

  return (
    <Card className="lift-card overflow-hidden">
      <div className="flex items-start gap-4 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <User className="size-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{appointment.patient_name}</h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" />
                {appointment.start_time?.slice(0, 5)} • {appointment.service}
              </div>
            </div>
            <Badge className={`${status.className} border-0`}>
              {status.label}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Phone className="size-4" />
              {appointment.patient_phone}
            </div>
            {appointment.notes && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle className="size-4" />
                {appointment.notes.substring(0, 50)}...
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onViewDetail}>
          Chi tiết
        </Button>
      </div>
    </Card>
  );
}
