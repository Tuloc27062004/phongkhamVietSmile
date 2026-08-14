import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  Stethoscope,
  Wallet,
  CalendarClock,
} from "lucide-react";
import { useState } from "react";

import { PageHeader, ErrorState, LoadingState, EmptyState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/$clinicSlug/patients")({
  head: () => ({
    meta: [
      { title: "Bệnh nhân — GZV Clinic Platform" },
      {
        name: "description",
        content: "Quản lý hồ sơ bệnh nhân, lịch sử điều trị và thanh toán.",
      },
    ],
  }),
  component: PatientsPage,
});

interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: string | null;
  insurance_number: string | null;
  created_at: string;
}

type PatientFormState = {
  patient_code: string;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
  address: string;
  insurance_number: string;
};

const EMPTY_FORM: PatientFormState = {
  patient_code: "",
  full_name: "",
  phone: "",
  email: "",
  date_of_birth: "",
  gender: "",
  address: "",
  insurance_number: "",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Quẹt thẻ",
  momo: "MoMo",
  zalopay: "ZaloPay",
  other: "Khác",
};

const PAYMENT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  paid: { label: "Đã thanh toán", className: "bg-green-100 text-green-800" },
  partial: { label: "Đã đặt cọc", className: "bg-yellow-100 text-yellow-800" },
  unpaid: { label: "Chưa thanh toán", className: "bg-red-100 text-red-800" },
};

function genPatientCode() {
  return `BN${Math.floor(1000 + Math.random() * 9000)}`;
}

function PatientsPage() {
  const { org } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [form, setForm] = useState<PatientFormState>(EMPTY_FORM);

  const patientsQuery = useQuery({
    queryKey: ["patients-list", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select(
          "id, patient_code, full_name, phone, email, address, date_of_birth, gender, insurance_number, created_at",
        )
        .is("deleted_at", null);

      if (searchTerm) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`,
        );
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Patient[];
    },
  });

  const appointmentsStats = useQuery({
    queryKey: ["appointments-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("patient_id, appointment_date");
      if (error) throw error;

      const stats: Record<string, { count: number; lastVisit: string | null }> = {};
      (data || []).forEach((apt) => {
        if (!stats[apt.patient_id]) stats[apt.patient_id] = { count: 0, lastVisit: null };
        const entry = stats[apt.patient_id]!;
        entry.count++;
        if (!entry.lastVisit || new Date(apt.appointment_date) > new Date(entry.lastVisit)) {
          entry.lastVisit = apt.appointment_date;
        }
      });

      return stats;
    },
  });

  const historyQuery = useQuery({
    queryKey: ["patient-treatment-history", selectedPatient?.id],
    enabled: Boolean(selectedPatient?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, appointment_date, start_time, status, payment_status, payment_method, total_amount, paid_amount, follow_up_date, employees:assigned_dentist_id(full_name), services(name)",
        )
        .eq("patient_id", selectedPatient!.id)
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        appointment_date: string;
        start_time: string;
        status: string;
        payment_status: string;
        payment_method: string | null;
        total_amount: number;
        paid_amount: number;
        follow_up_date: string | null;
        employees: { full_name: string } | null;
        services: { name: string } | null;
      }>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: PatientFormState) => {
      if (!values.full_name.trim()) throw new Error("Vui lòng nhập họ tên");
      const { error } = await supabase.from("patients").insert({
        organization_id: org.id,
        patient_code: values.patient_code.trim() || genPatientCode(),
        full_name: values.full_name.trim(),
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        date_of_birth: values.date_of_birth || null,
        gender: values.gender || null,
        address: values.address.trim() || null,
        insurance_number: values.insurance_number.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã thêm bệnh nhân mới");
      setShowAddForm(false);
      setForm(EMPTY_FORM);
      void queryClient.invalidateQueries({ queryKey: ["patients-list"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: PatientFormState) => {
      if (!selectedPatient) throw new Error("Chưa chọn bệnh nhân");
      if (!values.full_name.trim()) throw new Error("Vui lòng nhập họ tên");
      const { error } = await supabase
        .from("patients")
        .update({
          full_name: values.full_name.trim(),
          phone: values.phone.trim() || null,
          email: values.email.trim() || null,
          date_of_birth: values.date_of_birth || null,
          gender: values.gender || null,
          address: values.address.trim() || null,
          insurance_number: values.insurance_number.trim() || null,
        })
        .eq("id", selectedPatient.id);
      if (error) throw error;
    },
    onSuccess: (_data, values) => {
      toast.success("Đã cập nhật hồ sơ bệnh nhân");
      setShowEditForm(false);
      setSelectedPatient((prev) => (prev ? { ...prev, ...values } : prev));
      void queryClient.invalidateQueries({ queryKey: ["patients-list"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn chắc chắn muốn xóa bệnh nhân này? Hồ sơ sẽ được ẩn (xóa mềm), có thể khôi phục sau.")) return;
    try {
      const { error } = await supabase
        .from("patients")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Đã xóa bệnh nhân");
      setSelectedPatient(null);
      void queryClient.invalidateQueries({ queryKey: ["patients-list"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lỗi khi xóa bệnh nhân");
    }
  };

  const openEdit = () => {
    if (!selectedPatient) return;
    setForm({
      patient_code: selectedPatient.patient_code,
      full_name: selectedPatient.full_name,
      phone: selectedPatient.phone ?? "",
      email: selectedPatient.email ?? "",
      date_of_birth: selectedPatient.date_of_birth ?? "",
      gender: selectedPatient.gender ?? "",
      address: selectedPatient.address ?? "",
      insurance_number: selectedPatient.insurance_number ?? "",
    });
    setShowEditForm(true);
  };

  if (patientsQuery.isLoading || appointmentsStats.isLoading) {
    return <LoadingState />;
  }

  if (patientsQuery.error || appointmentsStats.error) {
    return <ErrorState description="Lỗi tải dữ liệu bệnh nhân" />;
  }

  const patients = patientsQuery.data || [];
  const stats = appointmentsStats.data || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý bệnh nhân"
        description="Xem, chỉnh sửa hồ sơ bệnh nhân, lịch sử điều trị và thanh toán."
        actions={
          <Button
            onClick={() => {
              setForm({ ...EMPTY_FORM, patient_code: genPatientCode() });
              setShowAddForm(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Thêm bệnh nhân
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient List */}
        <div className="lg:col-span-1">
          <Card className="space-y-4 p-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                placeholder="Tìm bệnh nhân..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto">
              {patients.length > 0 ? (
                patients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`cursor-pointer rounded-lg border-2 p-3 transition ${
                      selectedPatient?.id === patient.id
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{patient.full_name}</div>
                      <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                        {patient.patient_code}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{patient.phone ?? "—"}</div>
                    {stats[patient.id] && (
                      <div className="mt-1 text-xs text-blue-600">{stats[patient.id]!.count} lần khám</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground">Không tìm thấy bệnh nhân</div>
              )}
            </div>
          </Card>
        </div>

        {/* Patient Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPatient ? (
            <>
              <Card className="space-y-6 p-6">
                <div className="flex items-start justify-between border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedPatient.full_name}</h2>
                    <p className="mt-1 text-muted-foreground">
                      Mã BN: <span className="font-mono">{selectedPatient.patient_code}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={openEdit}>
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedPatient.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-4" />
                      <span className="text-sm">Điện thoại</span>
                    </div>
                    <p className="font-medium">{selectedPatient.phone || "—"}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="size-4" />
                      <span className="text-sm">Email</span>
                    </div>
                    <p className="font-medium">{selectedPatient.email || "—"}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-4" />
                      <span className="text-sm">Ngày sinh</span>
                    </div>
                    <p className="font-medium">
                      {selectedPatient.date_of_birth
                        ? new Date(selectedPatient.date_of_birth).toLocaleDateString("vi-VN")
                        : "—"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="size-4" />
                      <span className="text-sm">Bảo hiểm</span>
                    </div>
                    <p className="font-medium">{selectedPatient.insurance_number || "—"}</p>
                  </div>
                </div>

                <div className="space-y-1 border-t pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4" />
                    <span className="text-sm">Địa chỉ</span>
                  </div>
                  <p className="font-medium">{selectedPatient.address || "—"}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t pt-4">
                  <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Tổng lần khám</p>
                    <p className="mt-1 text-2xl font-bold text-blue-600">
                      {stats[selectedPatient.id]?.count || 0}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Lần khám gần nhất</p>
                    <p className="mt-1 text-lg font-bold text-green-600">
                      {stats[selectedPatient.id]?.lastVisit
                        ? new Date(stats[selectedPatient.id]!.lastVisit!).toLocaleDateString("vi-VN")
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 p-4">
                    <p className="text-xs font-medium text-muted-foreground">Khách hàng từ</p>
                    <p className="mt-1 text-lg font-bold text-purple-600">
                      {new Date(selectedPatient.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Treatment history */}
              <Card className="p-6">
                <h3 className="mb-4 flex items-center gap-2 font-semibold">
                  <Stethoscope className="size-4 text-primary" />
                  Lịch sử điều trị
                </h3>
                {historyQuery.isLoading ? (
                  <LoadingState rows={3} />
                ) : (historyQuery.data ?? []).length === 0 ? (
                  <EmptyState title="Chưa có lịch khám" description="Bệnh nhân chưa có lịch hẹn nào." />
                ) : (
                  <div className="space-y-3">
                    {(historyQuery.data ?? []).map((visit) => {
                      const payBadge = PAYMENT_STATUS_BADGE[visit.payment_status] ?? PAYMENT_STATUS_BADGE["unpaid"]!;
                      return (
                        <div key={visit.id} className="rounded-lg border border-border/70 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Calendar className="size-3.5 text-muted-foreground" />
                              {new Date(visit.appointment_date).toLocaleDateString("vi-VN")}
                              <Clock className="ml-2 size-3.5 text-muted-foreground" />
                              {visit.start_time?.slice(0, 5)}
                            </div>
                            <Badge className={payBadge.className}>{payBadge.label}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="size-3.5" />
                              {visit.employees?.full_name ?? "Chưa gán bác sĩ"}
                            </span>
                            <span>{visit.services?.name ?? "—"}</span>
                            <span className="flex items-center gap-1">
                              <Wallet className="size-3.5" />
                              {visit.paid_amount.toLocaleString("vi-VN")}đ / {visit.total_amount.toLocaleString("vi-VN")}đ
                              {visit.payment_method && ` · ${PAYMENT_METHOD_LABELS[visit.payment_method] ?? visit.payment_method}`}
                            </span>
                            {visit.follow_up_date && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <CalendarClock className="size-3.5" />
                                Tái khám: {new Date(visit.follow_up_date).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-12 text-center">
              <Users className="mx-auto mb-4 size-16 text-muted-foreground/30" />
              <p className="text-muted-foreground">Chọn một bệnh nhân để xem chi tiết</p>
            </Card>
          )}
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog
        open={showAddForm || showEditForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false);
            setShowEditForm(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{showEditForm ? "Sửa hồ sơ bệnh nhân" : "Thêm bệnh nhân mới"}</DialogTitle>
            <DialogDescription>Thông tin liên hệ và hồ sơ y tế cơ bản.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Mã bệnh nhân</Label>
              <Input value={form.patient_code} disabled={showEditForm} onChange={(e) => setForm({ ...form, patient_code: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Họ và tên *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Điện thoại</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ngày sinh</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Giới tính</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Nam</SelectItem>
                  <SelectItem value="female">Nữ</SelectItem>
                  <SelectItem value="other">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Địa chỉ</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Số bảo hiểm y tế</Label>
              <Input value={form.insurance_number} onChange={(e) => setForm({ ...form, insurance_number: e.target.value })} />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => (showEditForm ? updateMutation.mutate(form) : createMutation.mutate(form))}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Đang lưu..."
              : showEditForm
                ? "Lưu thay đổi"
                : "Thêm bệnh nhân"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
