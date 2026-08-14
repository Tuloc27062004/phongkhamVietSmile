import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  User,
  Users,
  Phone,
  CheckCircle2,
  AlertCircle,
  Send,
  Repeat2,
  Bell,
} from "lucide-react";
import { useState } from "react";

import { PageHeader, ErrorState, LoadingState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/$clinicSlug/appointments/booking")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search['date'] === "string" ? (search['date'] as string) : undefined,
    time: typeof search['time'] === "string" ? (search['time'] as string) : undefined,
    room: typeof search['room'] === "string" ? (search['room'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Đặt hẹn khám — GZV Clinic Platform" },
      {
        name: "description",
        content: "Đặt hẹn khám bệnh nhân và gửi nhắc nhở tự động.",
      },
    ],
  }),
  component: AppointmentBookingPage,
});

interface Appointment {
  id: string;
  patient_id: string;
  assigned_dentist_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled" | "no-show";
  service_id?: string;
  notes?: string;
  reminder_sent?: boolean;
  payment_status?: string;
  patients?: { id: string; full_name: string; phone: string; email: string };
  employees?: { id: string; full_name: string };
  services?: { id: string; name: string; default_duration_minutes: number };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Quẹt thẻ",
  momo: "MoMo",
  zalopay: "ZaloPay",
  other: "Khác",
};

function AppointmentBookingPage() {
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const searchParams = useSearch({ from: "/_authenticated/$clinicSlug/appointments/booking" });
  const [selectedDate, setSelectedDate] = useState(
    searchParams.date ?? new Date().toISOString().split("T")[0] ?? "",
  );
  const [selectedRoom, setSelectedRoom] = useState(searchParams.room ?? "");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [time, setTime] = useState(searchParams.time ?? "09:00");
  const [notes, setNotes] = useState("");
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [followUpDate, setFollowUpDate] = useState("");

  // Fetch patients
  const patientsQuery = useQuery({
    queryKey: ["patients-for-booking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, phone, email")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch doctors
  const doctorsQuery = useQuery({
    queryKey: ["doctors-for-booking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("employment_status", "active")
        .eq("can_receive_appointments", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch services
  const servicesQuery = useQuery({
    queryKey: ["services-for-booking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, default_duration_minutes")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch treatment rooms (slot owners)
  const roomsQuery = useQuery({
    queryKey: ["rooms-for-booking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_rooms")
        .select("id, name, code")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch appointments for selected date
  const appointmentsQuery = useQuery({
    queryKey: ["appointments-by-date", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          patient_id,
          assigned_dentist_id,
          appointment_date,
          start_time,
          end_time,
          status,
          service_id,
          notes,
          reminder_sent,
          payment_status,
          patients:patient_id (
            id,
            full_name,
            phone,
            email
          ),
          employees:assigned_dentist_id (
            id,
            full_name
          ),
          services:service_id (
            id,
            name,
            default_duration_minutes
          )
        `)
        .eq("appointment_date", selectedDate)
        .order("start_time");
      if (error) throw error;
      return data as Appointment[] | [];
    },
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient || !selectedDoctor || !selectedService) {
        throw new Error("Vui lòng chọn bệnh nhân, bác sĩ và dịch vụ");
      }
      const organizationId = profileQuery.data?.organizationId;
      if (!organizationId) {
        throw new Error("Không xác định được phòng khám của tài khoản hiện tại");
      }

      const duration =
        servicesQuery.data?.find((s) => s.id === selectedService)?.default_duration_minutes || 30;
      const [hours = 0, minutes = 0] = time.split(":").map(Number);
      const endMinutes = hours * 60 + minutes + duration;
      const endTime = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

      const total = Number(totalAmount) || duration * 3000;
      const paid = Number(paidAmount) || 0;

      const { data, error } = await supabase
        .from("appointments")
        .insert({
          organization_id: organizationId,
          patient_id: selectedPatient,
          assigned_dentist_id: selectedDoctor,
          appointment_date: selectedDate,
          start_time: time,
          end_time: endTime,
          service_id: selectedService,
          notes,
          room_id: selectedRoom || null,
          status: "scheduled",
          reminder_sent: false,
          payment_method: paymentMethod || null,
          total_amount: total,
          paid_amount: paid,
          payment_status: paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial",
          paid_at: paid > 0 ? new Date().toISOString() : null,
          follow_up_date: followUpDate || null,
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đặt hẹn thành công!");
      setSelectedPatient("");
      setSelectedDoctor("");
      setSelectedService("");
      setTime("09:00");
      setSelectedRoom("");
      setNotes("");
      setPaymentMethod("");
      setTotalAmount("");
      setPaidAmount("0");
      setFollowUpDate("");
      appointmentsQuery.refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Lỗi khi đặt hẹn");
    },
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data, error } = await supabase
        .from("appointments")
        .update({ reminder_sent: true })
        .eq("id", appointmentId)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Gửi nhắc nhở thành công!");
      appointmentsQuery.refetch();
    },
    onError: (error: any) => {
      toast.error("Lỗi khi gửi nhắc nhở");
    },
  });

  if (
    patientsQuery.isLoading ||
    doctorsQuery.isLoading ||
    servicesQuery.isLoading ||
    appointmentsQuery.isLoading
  ) {
    return <LoadingState />;
  }

  if (
    patientsQuery.error ||
    doctorsQuery.error ||
    servicesQuery.error ||
    appointmentsQuery.error
  ) {
    return <ErrorState description="Lỗi tải dữ liệu" />;
  }

  const appointments = appointmentsQuery.data || [];
  const upcomingAppointments = appointments.filter((apt) => apt.status === "scheduled");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đặt hẹn khám bệnh nhân"
        description="Lên lịch khám, gửi nhắc nhở và theo dõi cuộc hẹn"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Booking Form */}
        <div className="lg:col-span-1">
          <Card className="p-6 space-y-4">
            <h3 className="font-semibold text-lg">Đặt hẹn mới</h3>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Ngày khám</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
            </div>

            {/* Time Selection */}
            <div className="space-y-2">
              <Label>Giờ khám</Label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            {/* Patient Selection */}
            <div className="space-y-2">
              <Label>Bệnh nhân</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn bệnh nhân..." />
                </SelectTrigger>
                <SelectContent>
                  {patientsQuery.data?.map((patient: any) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Doctor Selection */}
            <div className="space-y-2">
              <Label>Bác sĩ</Label>
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn bác sĩ..." />
                </SelectTrigger>
                <SelectContent>
                  {doctorsQuery.data?.map((doctor: any) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room Selection */}
            <div className="space-y-2">
              <Label>Phòng điều trị</Label>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn phòng / ghế..." />
                </SelectTrigger>
                <SelectContent>
                  {roomsQuery.data?.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Service Selection */}
            <div className="space-y-2">
              <Label>Dịch vụ</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn dịch vụ..." />
                </SelectTrigger>
                <SelectContent>
                  {servicesQuery.data?.map((service: any) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.default_duration_minutes} phút)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment */}
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2 font-semibold">Thanh toán</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-normal">Tổng chi phí (đ)</Label>
                  <Input
                    type="number"
                    placeholder="Tự tính theo dịch vụ"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-normal">Đã trả / đặt cọc (đ)</Label>
                  <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                </div>
              </div>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Hình thức thanh toán..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Follow-up */}
            <div className="space-y-2">
              <Label>Hẹn tái khám (tùy chọn)</Label>
              <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Ghi chú</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                rows={3}
                placeholder="Ghi chú thêm về cuộc hẹn..."
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={() => createAppointmentMutation.mutate()}
              disabled={createAppointmentMutation.isPending}
              className="w-full h-10 text-base"
            >
              <Calendar className="w-4 h-4 mr-2" />
              {createAppointmentMutation.isPending ? "Đang đặt..." : "Đặt hẹn"}
            </Button>
          </Card>
        </div>

        {/* Appointments List & Reminders */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Tổng hôm nay</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{appointments.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-200" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Cần nhắc nhở</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {upcomingAppointments.filter((apt) => !apt.reminder_sent).length}
                  </p>
                </div>
                <Bell className="w-8 h-8 text-green-200" />
              </div>
            </Card>
          </div>

          {/* Appointments List */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Lịch khám hôm {new Date(selectedDate).toLocaleDateString("vi-VN")}
            </h3>

            {appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{appointment.start_time?.slice(0, 5)}</span>
                          <Badge
                            variant={
                              appointment.status === "scheduled"
                                ? "default"
                                : appointment.status === "completed"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {appointment.status === "scheduled"
                              ? "Đã lên"
                              : appointment.status === "completed"
                                ? "Hoàn thành"
                                : appointment.status === "no-show"
                                  ? "Vắng mặt"
                                  : "Hủy"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              appointment.payment_status === "paid"
                                ? "border-green-300 text-green-700"
                                : appointment.payment_status === "partial"
                                  ? "border-yellow-300 text-yellow-700"
                                  : "border-red-300 text-red-700"
                            }
                          >
                            {appointment.payment_status === "paid"
                              ? "Đã TT"
                              : appointment.payment_status === "partial"
                                ? "Đặt cọc"
                                : "Chưa TT"}
                          </Badge>
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{appointment.patients?.full_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span>{appointment.employees?.full_name}</span>
                          </div>
                          {appointment.services && (
                            <div className="text-muted-foreground">
                              {appointment.services.name}
                            </div>
                          )}
                        </div>
                      </div>

                      {appointment.status === "scheduled" && (
                        <div className="flex gap-2">
                          {!appointment.reminder_sent ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                sendReminderMutation.mutate(appointment.id)
                              }
                              disabled={sendReminderMutation.isPending}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Đã gửi
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">Không có cuộc hẹn nào hôm nay</p>
              </div>
            )}
          </Card>

          {/* Reminder Settings */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Repeat2 className="w-5 h-5" />
              Cài đặt nhắc nhở
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 bg-muted rounded">
                <span>Nhắc nhở SMS</span>
                <Badge>Bật</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded">
                <span>Nhắc nhở Email</span>
                <Badge>Bật</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded">
                <span>Thời điểm (trước khám)</span>
                <span className="font-semibold">1 ngày</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
