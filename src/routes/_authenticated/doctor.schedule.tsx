import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Stethoscope,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useCurrentEmployee } from "@/hooks/use-session";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/doctor/schedule")({
  head: () => ({
    meta: [
      { title: "Lịch khám — Việt Smile Clinic" },
      { name: "description", content: "Lịch khám của bác sĩ" },
    ],
  }),
  component: DoctorSchedule,
});

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  patient_name: string;
  patient_phone: string;
  service: string;
  status: string;
  notes: string;
}

function DoctorSchedule() {
  const { session } = useAuthSession();
  const employeeQuery = useCurrentEmployee(session?.user.id);
  const employeeId = employeeQuery.data?.id;
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0] ?? "");

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
          patient:patients(full_name, phone),
          service:services(name),
          status,
          notes
        `
        )
        .eq("assigned_dentist_id", employeeId)
        .eq("appointment_date", selectedDate)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data || []).map((apt) => ({
        id: apt.id,
        appointment_date: apt.appointment_date,
        start_time: apt.start_time,
        patient_name: apt.patient?.full_name || "N/A",
        patient_phone: apt.patient?.phone || "N/A",
        service: apt.service?.name || "N/A",
        status: apt.status,
        notes: apt.notes || "",
      }));
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
      />

      {/* Date Navigation */}
      <Card className="border-0 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md">
        <div className="flex items-center justify-between p-6">
          <Button variant="ghost" size="sm" onClick={handlePrevDay}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-gray-600">Ngày khám</p>
            <p className="text-2xl font-bold text-blue-600 capitalize">{dateStr}</p>
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
          <Card className="border-0 shadow-sm">
            <div className="flex flex-col items-center justify-center py-12">
              <Calendar className="mb-2 size-12 text-gray-300" />
              <p className="text-gray-600">Không có lịch hẹn hôm nay</p>
            </div>
          </Card>
        ) : (
          appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))
        )}
      </div>
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
  const colorClasses = {
    blue: "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600",
    green: "bg-gradient-to-br from-green-50 to-green-100 text-green-600",
    orange: "bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600",
  };

  return (
    <Card className={`border-0 shadow-sm ${colorClasses[color]}`}>
      <div className="p-4">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-3xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const statusColors = {
    confirmed: { bg: "bg-green-100", text: "text-green-800", label: "Xác nhận" },
    pending: { bg: "bg-orange-100", text: "text-orange-800", label: "Chờ xác nhận" },
    completed: { bg: "bg-blue-100", text: "text-blue-800", label: "Hoàn thành" },
    cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Hủy" },
  };

  const status = statusColors[appointment.status as keyof typeof statusColors] || statusColors.pending;

  return (
    <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100">
          <User className="size-6 text-purple-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{appointment.patient_name}</h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                <Clock className="size-4" />
                {appointment.start_time?.slice(0, 5)} • {appointment.service}
              </div>
            </div>
            <Badge className={`${status.bg} ${status.text} border-0`}>
              {status.label}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1 text-gray-600">
              <Phone className="size-4" />
              {appointment.patient_phone}
            </div>
            {appointment.notes && (
              <div className="flex items-center gap-1 text-gray-600">
                <AlertCircle className="size-4" />
                {appointment.notes.substring(0, 50)}...
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm">
          Chi tiết
        </Button>
      </div>
    </Card>
  );
}
