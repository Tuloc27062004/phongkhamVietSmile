import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Heart,
  AlertCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Card } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { useClinicPath } from "@/hooks/use-clinic-path";
import { useAuthSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/$clinicSlug/patient/profile")({
  head: () => ({
    meta: [
      { title: "Hồ sơ bệnh nhân — GZV Clinic Platform" },
      { name: "description", content: "Thông tin và lịch khám của bệnh nhân" },
    ],
  }),
  component: PatientProfile,
});

interface PatientInfo {
  id: string | undefined;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  allergy_info: string;
  medical_conditions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
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
  const buildPath = useClinicPath();
  const queryClient = useQueryClient();
  const [showEditForm, setShowEditForm] = useState(false);
  const [editDraft, setEditDraft] = useState({
    phone: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const patientQuery = useQuery({
    queryKey: ["patient-info", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async (): Promise<PatientInfo> => {
      if (!session) throw new Error("Missing session");
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("email", session.user.email ?? "")
        .maybeSingle();

      if (error) throw error;

      return {
        id: data?.id,
        full_name: data?.full_name || session.user.email?.split("@")[0] || "Bệnh nhân",
        email: data?.email || session.user.email || "",
        phone: data?.phone || "Chưa cập nhật",
        date_of_birth: data?.date_of_birth || "",
        gender: data?.gender || "Khác",
        address: data?.address || "Chưa cập nhật",
        allergy_info: data?.allergies || "Không có dị ứng đã biết",
        medical_conditions: data?.medical_notes || "Không có",
        emergency_contact_name: data?.emergency_contact_name || "",
        emergency_contact_phone: data?.emergency_contact_phone || "",
        insurance_number: data?.insurance_number || "Chưa có",
      };
    },
  });

  const patientId = patientQuery.data?.id;

  const updatePatientMutation = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error("Không tìm thấy hồ sơ bệnh nhân");
      const { error } = await supabase
        .from("patients")
        .update({
          phone: editDraft.phone.trim() || null,
          address: editDraft.address.trim() || null,
          emergency_contact_name: editDraft.emergency_contact_name.trim() || null,
          emergency_contact_phone: editDraft.emergency_contact_phone.trim() || null,
        })
        .eq("id", patientId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật hồ sơ");
      setShowEditForm(false);
      void queryClient.invalidateQueries({ queryKey: ["patient-info"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openEdit = () => {
    if (!patientQuery.data) return;
    setEditDraft({
      phone: patientQuery.data.phone === "Chưa cập nhật" ? "" : patientQuery.data.phone,
      address: patientQuery.data.address === "Chưa cập nhật" ? "" : patientQuery.data.address,
      emergency_contact_name: patientQuery.data.emergency_contact_name,
      emergency_contact_phone: patientQuery.data.emergency_contact_phone,
    });
    setShowEditForm(true);
  };

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
      <Card className="surface-card overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-4">
                <div className="brand-gradient flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-primary-foreground">
                  {(patient.full_name.split(" ").slice(-1)[0] ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{patient.full_name}</h2>
                  <p className="text-muted-foreground">{age} tuổi • {patient.gender}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">Bệnh nhân tích cực</Badge>
                <Badge variant="secondary">Chương trình nha khoa</Badge>
              </div>
            </div>
            <Button variant="outline" onClick={openEdit} disabled={!patientId}>
              Chỉnh sửa
            </Button>
          </div>
        </div>
      </Card>

      {/* Health Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Info */}
        <Card className="quiet-card p-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Thông tin liên hệ</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="size-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{patient.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="size-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Số điện thoại</p>
                  <p className="text-sm font-medium text-foreground">{patient.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Địa chỉ</p>
                  <p className="text-sm font-medium text-foreground">{patient.address}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Medical Info */}
        <Card className="quiet-card p-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Thông tin y tế</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-1 size-5 shrink-0 text-warning" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Dị ứng</p>
                  <p className="text-sm font-medium text-foreground">{patient.allergy_info}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Heart className="mt-1 size-5 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Bệnh lý nền</p>
                  <p className="text-sm font-medium text-foreground">{patient.medical_conditions}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Insurance & Emergency */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="surface-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Mã bảo hiểm</p>
          <p className="mt-1 text-lg font-bold text-success">{patient.insurance_number}</p>
        </Card>
        <Card className="surface-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Liên hệ khẩn cấp</p>
          <p className="mt-1 text-lg font-bold text-primary">
            {patient.emergency_contact_name || patient.emergency_contact_phone
              ? `${patient.emergency_contact_name || "—"} · ${patient.emergency_contact_phone || "—"}`
              : "Chưa cập nhật"}
          </p>
        </Card>
      </div>

      {/* Appointment History */}
      <Card className="quiet-card p-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Lịch khám gần đây</h3>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có lịch khám nào</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium text-foreground">{apt.service}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(apt.appointment_date).toLocaleDateString("vi-VN")} lúc {apt.start_time?.slice(0, 5)}
                    </p>
                    <p className="text-xs text-muted-foreground">Bác sĩ: {apt.doctor_name}</p>
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
          <Link to={buildPath("/appointments/booking")}>
            <Calendar className="mr-2 size-4" />
            Đặt lịch khám
          </Link>
        </Button>
        <Button variant="outline" className="h-12 text-base" asChild>
          <Link to={buildPath("/issues/report")}>
            <AlertCircle className="mr-2 size-4" />
            Báo cáo sự cố
          </Link>
        </Button>
      </div>

      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cập nhật thông tin</DialogTitle>
            <DialogDescription>Số điện thoại, địa chỉ và liên hệ khẩn cấp của bạn.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Số điện thoại</Label>
              <Input
                value={editDraft.phone}
                onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Địa chỉ</Label>
              <Input
                value={editDraft.address}
                onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Liên hệ khẩn cấp - Họ tên</Label>
              <Input
                value={editDraft.emergency_contact_name}
                onChange={(e) => setEditDraft({ ...editDraft, emergency_contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Liên hệ khẩn cấp - Điện thoại</Label>
              <Input
                value={editDraft.emergency_contact_phone}
                onChange={(e) => setEditDraft({ ...editDraft, emergency_contact_phone: e.target.value })}
              />
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => updatePatientMutation.mutate()}
            disabled={updatePatientMutation.isPending}
          >
            <Save className="mr-2 size-4" />
            {updatePatientMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
