import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  Heart,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/patient/profile")({
  head: () => ({
    meta: [
      { title: "Hồ sơ bệnh nhân — Việt Smile Clinic" },
      { name: "description", content: "Thông tin và lịch khám của bệnh nhân" },
    ],
  }),
  component: PatientProfile,
});

interface PatientInfo {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  allergy_info: string;
  medical_conditions: string;
  emergency_contact: string;
  insurance_number: string;
}

interface AppointmentRecord {
  id: string;
  appointment_date: string;
  start_time: string;
  doctor_name: string;
  service: string;
  status: string;
  notes: string;
}

function PatientProfile() {
  const { session } = useAuthSession();

  const patientQuery = useQuery({
    queryKey: ["patient-info", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      if (!session) throw new Error("Missing session");
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("email", session.user.email ?? "")
        .maybeSingle();

      if (error) throw error;

      return {
        id: data?.id as string | undefined,
        full_name: data?.full_name || session.user.email?.split("@")[0] || "Bệnh nhân",
        email: data?.email || session.user.email || "",
        phone: data?.phone || "Chưa cập nhật",
        date_of_birth: data?.date_of_birth || "",
        gender: data?.gender || "Khác",
        address: data?.address || "Chưa cập nhật",
        allergy_info: data?.allergies || "Không có dị ứng đã biết",
        medical_conditions: data?.medical_notes || "Không có",
        emergency_contact: "Chưa cập nhật",
        insurance_number: data?.insurance_number || "Chưa có",
      };
    },
  });

  const patientId = patientQuery.data?.id;

  const appointmentsQuery = useQuery({
    queryKey: ["patient-appointments", patientId],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id,
          appointment_date,
          start_time,
          doctor:employees!assigned_dentist_id(full_name),
          service:services(name),
          status,
          notes
        `
        )
        .eq("patient_id", patientId as string)
        .order("appointment_date", { ascending: false })
        .limit(5);

      if (error) throw error;

      return (data || []).map((apt) => ({
        id: apt.id,
        appointment_date: apt.appointment_date,
        start_time: apt.start_time,
        doctor_name: apt.doctor?.full_name || "N/A",
        service: apt.service?.name || "N/A",
        status: apt.status,
        notes: apt.notes || "",
      }));
    },
  });

  if (patientQuery.isError) {
    return <ErrorState description={patientQuery.error?.message} />;
  }

  const patient = patientQuery.data;

  if (!patient || patientQuery.isLoading || appointmentsQuery.isLoading) {
    return <LoadingState rows={3} />;
  }

  const appointments = appointmentsQuery.data || [];

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={patient.full_name}
        description="Quản lý hồ sơ sức khỏe của bạn"
      />

      {/* Profile Header */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-lg">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-cyan-600 text-2xl font-bold text-white">
                  {(patient.full_name.split(" ").slice(-1)[0] ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{patient.full_name}</h2>
                  <p className="text-gray-600">{age} tuổi • {patient.gender}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">Bệnh nhân tích cực</Badge>
                <Badge variant="secondary">Chương trình nha khoa</Badge>
              </div>
            </div>
            <Button variant="outline">Chỉnh sửa</Button>
          </div>
        </div>
      </Card>

      {/* Health Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Info */}
        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Thông tin liên hệ</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="size-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Email</p>
                  <p className="text-sm font-medium text-gray-900">{patient.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="size-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Số điện thoại</p>
                  <p className="text-sm font-medium text-gray-900">{patient.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Địa chỉ</p>
                  <p className="text-sm font-medium text-gray-900">{patient.address}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Medical Info */}
        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Thông tin y tế</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-1 size-5 text-orange-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Dị ứng</p>
                  <p className="text-sm font-medium text-gray-900">{patient.allergy_info}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Heart className="mt-1 size-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Bệnh lý nền</p>
                  <p className="text-sm font-medium text-gray-900">{patient.medical_conditions}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Insurance & Emergency */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md">
          <div className="p-4">
            <p className="text-xs font-medium text-gray-600">Mã bảo hiểm</p>
            <p className="mt-1 text-lg font-bold text-green-600">{patient.insurance_number}</p>
          </div>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md">
          <div className="p-4">
            <p className="text-xs font-medium text-gray-600">Liên hệ khẩn cấp</p>
            <p className="mt-1 text-lg font-bold text-purple-600">{patient.emergency_contact}</p>
          </div>
        </Card>
      </div>

      {/* Appointment History */}
      <Card className="border-0 shadow-md">
        <div className="space-y-4 p-6">
          <h3 className="font-semibold text-gray-900">Lịch khám gần đây</h3>
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-600">Chưa có lịch khám nào</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="font-medium text-gray-900">{apt.service}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(apt.appointment_date).toLocaleDateString("vi-VN")} lúc {apt.start_time?.slice(0, 5)}
                    </p>
                    <p className="text-xs text-gray-500">Bác sĩ: {apt.doctor_name}</p>
                  </div>
                  <Badge
                    variant={apt.status === "confirmed" ? "default" : apt.status === "completed" ? "secondary" : "outline"}
                  >
                    {apt.status === "confirmed" && "Xác nhận"}
                    {apt.status === "completed" && "Hoàn thành"}
                    {apt.status === "pending" && "Chờ xác nhận"}
                    {apt.status === "cancelled" && "Hủy"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Button className="h-12 text-base" asChild>
          <a href="/appointments/booking">
            <Calendar className="mr-2 size-4" />
            Đặt lịch khám
          </a>
        </Button>
        <Button variant="outline" className="h-12 text-base" asChild>
          <a href="/issues/report">
            <AlertCircle className="mr-2 size-4" />
            Báo cáo sự cố
          </a>
        </Button>
      </div>
    </div>
  );
}
