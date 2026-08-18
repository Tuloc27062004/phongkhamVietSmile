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
  Eye,
  Clock,
  CheckCircle2,
  FileText,
  Stethoscope,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, ErrorState, LoadingState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession, useSessionProfile } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/$clinicSlug/patients")({
  head: () => ({
    meta: [
      { title: "Bệnh nhân — GZV Clinic Platform" },
      {
        name: "description",
        content: "Quản lý hồ sơ bệnh nhân, tính toán lịch khám và nhắc nhở đặt hẹn.",
      },
    ],
  }),
  component: PatientsPage,
});

interface Patient {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: string | null;
  identity_number: string | null;
  insurance_number: string | null;
  medical_history: string | null;
  medical_notes: string | null;
  allergies: string | null;
  dental_history: string | null;
  clinical_examination: string | null;
  treatment_progress: string | null;
  surgery_consent: string | null;
  treatment_result: string | null;
  xray_image: string | null;
  created_at: string;
  appointments_count?: number;
  last_visit?: string;
}

interface MedicalRecord {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  notes: string | null;
  treatment_notes: string | null;
  services?: { name: string } | null;
  employees?: { full_name: string } | null;
}

type PatientForm = {
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  gender: string;
  identity_number: string;
  address: string;
  insurance_number: string;
  medical_history: string;
  medical_notes: string;
  allergies: string;
  dental_history: string;
  clinical_examination: string;
  treatment_progress: string;
  surgery_consent: string;
  treatment_result: string;
  xray_image: string;
};

const emptyPatientForm: PatientForm = {
  full_name: "",
  phone: "",
  email: "",
  date_of_birth: "",
  gender: "",
  identity_number: "",
  address: "",
  insurance_number: "",
  medical_history: "",
  medical_notes: "",
  allergies: "",
  dental_history: "",
  clinical_examination: "",
  treatment_progress: "",
  surgery_consent: "",
  treatment_result: "",
  xray_image: "",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function createPatientCode() {
  return `BN-${Date.now().toString(36).toUpperCase()}`;
}

function patientToForm(patient: Patient): PatientForm {
  return {
    full_name: patient.full_name,
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    date_of_birth: patient.date_of_birth ?? "",
    gender: patient.gender ?? "",
    identity_number: patient.identity_number ?? "",
    address: patient.address ?? "",
    insurance_number: patient.insurance_number ?? "",
    medical_history: patient.medical_history ?? "",
    medical_notes: patient.medical_notes ?? "",
    allergies: patient.allergies ?? "",
    dental_history: patient.dental_history ?? "",
    clinical_examination: patient.clinical_examination ?? "",
    treatment_progress: patient.treatment_progress ?? "",
    surgery_consent: patient.surgery_consent ?? "",
    treatment_result: patient.treatment_result ?? "",
    xray_image: patient.xray_image ?? "",
  };
}

const PATIENT_SELECT_BASE = `
  id,
  full_name,
  phone,
  email,
  address,
  date_of_birth,
  gender,
  insurance_number,
  medical_notes,
  allergies,
  created_at
`;

const PATIENT_SELECT_WITH_MEDICAL_RECORD = `
  id,
  full_name,
  phone,
  email,
  address,
  date_of_birth,
  gender,
  identity_number,
  insurance_number,
  medical_history,
  medical_notes,
  allergies,
  dental_history,
  clinical_examination,
  treatment_progress,
  surgery_consent,
  treatment_result,
  xray_image,
  created_at
`;

const MEDICAL_RECORD_COLUMNS = [
  "identity_number",
  "medical_history",
  "dental_history",
  "clinical_examination",
  "treatment_progress",
  "surgery_consent",
  "treatment_result",
  "xray_image",
];

function isMissingMedicalRecordColumns(error: unknown) {
  const values = error && typeof error === "object" ? Object.values(error) : [error];
  const message = values.filter(Boolean).join(" ").toLowerCase();
  return MEDICAL_RECORD_COLUMNS.some((column) => message.includes(column));
}

function normalizePatient(patient: Partial<Patient>): Patient {
  return {
    identity_number: null,
    medical_history: null,
    dental_history: null,
    clinical_examination: null,
    treatment_progress: null,
    surgery_consent: null,
    treatment_result: null,
    xray_image: null,
    ...patient,
  } as Patient;
}

function withoutMedicalRecordColumns<T extends Record<string, unknown>>(payload: T) {
  const fallback = { ...payload };
  MEDICAL_RECORD_COLUMNS.forEach((column) => delete fallback[column]);
  return fallback;
}

function isImageUrl(value: string | null) {
  return Boolean(value?.match(/^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i));
}

async function uploadPatientImage(
  file: File,
  organizationId: string,
  folder: "xrays" | "surgery-consents",
  patientId?: string,
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Vui lòng chọn file ảnh");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Ảnh không được vượt quá 10MB");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safePatientId = patientId || "new";
  const path = `${organizationId}/${safePatientId}/${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${extension}`;

  const { error } = await supabase.storage.from("patient-xrays").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("patient-xrays").getPublicUrl(path);
  return data.publicUrl;
}

function PatientsPage() {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [newPatient, setNewPatient] = useState<PatientForm>(emptyPatientForm);
  const [editPatient, setEditPatient] = useState<PatientForm>(emptyPatientForm);
  const [newXrayFile, setNewXrayFile] = useState<File | null>(null);
  const [editXrayFile, setEditXrayFile] = useState<File | null>(null);
  const [newSurgeryConsentFile, setNewSurgeryConsentFile] = useState<File | null>(null);
  const [editSurgeryConsentFile, setEditSurgeryConsentFile] = useState<File | null>(null);

  const patientsQuery = useQuery({
    queryKey: ["patients-list", searchTerm],
    queryFn: async () => {
      const buildQuery = (select: string) => {
        let query = supabase.from("patients").select(select);

        if (searchTerm) {
          query = query.or(
            `full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
          );
        }

        return query.order("created_at", { ascending: false });
      };

      const { data, error } = await buildQuery(PATIENT_SELECT_WITH_MEDICAL_RECORD);
      if (!error) return (data || []).map(normalizePatient);

      if (!isMissingMedicalRecordColumns(error)) throw error;

      const fallback = await buildQuery(PATIENT_SELECT_BASE);
      if (fallback.error) throw fallback.error;
      return (fallback.data || []).map(normalizePatient);
    },
  });

  const appointmentsStats = useQuery({
    queryKey: ["appointments-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("patient_id, appointment_date");
      if (error) throw error;

      const stats: Record<string, any> = {};
      (data || []).forEach((apt) => {
        if (!stats[apt.patient_id]) {
          stats[apt.patient_id] = {
            count: 0,
            lastVisit: null,
          };
        }
        stats[apt.patient_id].count++;
        if (
          !stats[apt.patient_id].lastVisit ||
          new Date(apt.appointment_date) > new Date(stats[apt.patient_id].lastVisit)
        ) {
          stats[apt.patient_id].lastVisit = apt.appointment_date;
        }
      });

      return stats;
    },
  });

  const medicalRecordsQuery = useQuery({
    queryKey: ["patient-medical-records", selectedPatient?.id],
    enabled: Boolean(selectedPatient?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          start_time,
          status,
          notes,
          treatment_notes,
          services:service_id (
            name
          ),
          employees:assigned_dentist_id (
            full_name
          )
        `)
        .eq("patient_id", selectedPatient!.id)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (error) throw error;
      return data as MedicalRecord[] | [];
    },
  });

  const handleDelete = async (id: string) => {
    if (confirm("Bạn chắc chắn muốn xóa bệnh nhân này?")) {
      try {
        const { error } = await supabase.from("patients").delete().eq("id", id);
        if (error) throw error;
        // Refetch data
        patientsQuery.refetch();
        setSelectedPatient(null);
      } catch (error) {
        console.error("Delete error:", error);
        alert("Lỗi khi xóa bệnh nhân");
      }
    }
  };

  const createPatient = useMutation({
    mutationFn: async () => {
      const organizationId = profileQuery.data?.organizationId;
      if (!organizationId) throw new Error("Không xác định được phòng khám");
      if (!newPatient.full_name.trim()) throw new Error("Vui lòng nhập họ tên bệnh nhân");

      const uploadedXrayUrl = newXrayFile
        ? await uploadPatientImage(newXrayFile, organizationId, "xrays")
        : optionalText(newPatient.xray_image);

      const uploadedSurgeryConsentUrl = newSurgeryConsentFile
        ? await uploadPatientImage(newSurgeryConsentFile, organizationId, "surgery-consents")
        : optionalText(newPatient.surgery_consent);

      const payload = {
          organization_id: organizationId,
          patient_code: createPatientCode(),
          full_name: newPatient.full_name.trim(),
          phone: optionalText(newPatient.phone),
          email: optionalText(newPatient.email),
          date_of_birth: optionalText(newPatient.date_of_birth),
          gender: optionalText(newPatient.gender),
          identity_number: optionalText(newPatient.identity_number),
          address: optionalText(newPatient.address),
          insurance_number: optionalText(newPatient.insurance_number),
          medical_history: optionalText(newPatient.medical_history),
          medical_notes: optionalText(newPatient.medical_notes),
          allergies: optionalText(newPatient.allergies),
          dental_history: optionalText(newPatient.dental_history),
          clinical_examination: optionalText(newPatient.clinical_examination),
        treatment_progress: optionalText(newPatient.treatment_progress),
        surgery_consent: uploadedSurgeryConsentUrl,
        treatment_result: optionalText(newPatient.treatment_result),
        xray_image: uploadedXrayUrl,
        };

      const { data, error } = await supabase
        .from("patients")
        .insert(payload)
        .select(PATIENT_SELECT_WITH_MEDICAL_RECORD)
        .single();

      if (!error) return normalizePatient(data);
      if (!isMissingMedicalRecordColumns(error)) throw error;

      const fallback = await supabase
        .from("patients")
        .insert(withoutMedicalRecordColumns(payload) as any)
        .select(PATIENT_SELECT_BASE)
        .single();

      if (fallback.error) throw fallback.error;
      toast.warning("DB chưa có cột hồ sơ bệnh án, chỉ lưu thông tin cơ bản. Cần chạy migration Supabase.");
      return normalizePatient(fallback.data);
    },
    onSuccess: (patient) => {
      toast.success("Đã thêm bệnh nhân");
      setNewPatient(emptyPatientForm);
      setNewXrayFile(null);
      setNewSurgeryConsentFile(null);
      setShowAddForm(false);
      setSelectedPatient(patient);
      void queryClient.invalidateQueries({ queryKey: ["patients-list"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updatePatient = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error("Chưa chọn bệnh nhân");
      if (!editPatient.full_name.trim()) throw new Error("Vui lòng nhập họ tên bệnh nhân");

      const organizationId = profileQuery.data?.organizationId;
      if (!organizationId) throw new Error("Không xác định được phòng khám");

      const uploadedXrayUrl = editXrayFile
        ? await uploadPatientImage(editXrayFile, organizationId, "xrays", selectedPatient.id)
        : optionalText(editPatient.xray_image);

      const uploadedSurgeryConsentUrl = editSurgeryConsentFile
        ? await uploadPatientImage(editSurgeryConsentFile, organizationId, "surgery-consents", selectedPatient.id)
        : optionalText(editPatient.surgery_consent);

      const payload = {
          full_name: editPatient.full_name.trim(),
          phone: optionalText(editPatient.phone),
          email: optionalText(editPatient.email),
          date_of_birth: optionalText(editPatient.date_of_birth),
          gender: optionalText(editPatient.gender),
          identity_number: optionalText(editPatient.identity_number),
          address: optionalText(editPatient.address),
          insurance_number: optionalText(editPatient.insurance_number),
          medical_history: optionalText(editPatient.medical_history),
          medical_notes: optionalText(editPatient.medical_notes),
          allergies: optionalText(editPatient.allergies),
          dental_history: optionalText(editPatient.dental_history),
          clinical_examination: optionalText(editPatient.clinical_examination),
          treatment_progress: optionalText(editPatient.treatment_progress),
          surgery_consent: uploadedSurgeryConsentUrl,
          treatment_result: optionalText(editPatient.treatment_result),
          xray_image: uploadedXrayUrl,
        };

      const { data, error } = await supabase
        .from("patients")
        .update(payload)
        .eq("id", selectedPatient.id)
        .select(PATIENT_SELECT_WITH_MEDICAL_RECORD)
        .single();

      if (!error) return normalizePatient(data);
      if (!isMissingMedicalRecordColumns(error)) throw error;

      const fallback = await supabase
        .from("patients")
        .update(withoutMedicalRecordColumns(payload) as any)
        .eq("id", selectedPatient.id)
        .select(PATIENT_SELECT_BASE)
        .single();

      if (fallback.error) throw fallback.error;
      toast.warning("DB chưa có cột hồ sơ bệnh án, chỉ lưu thông tin cơ bản. Cần chạy migration Supabase.");
      return normalizePatient(fallback.data);
    },
    onSuccess: (patient) => {
      toast.success("Đã cập nhật bệnh nhân");
      setSelectedPatient(patient);
      setEditPatient(emptyPatientForm);
      setEditXrayFile(null);
      setEditSurgeryConsentFile(null);
      setShowEditForm(false);
      void queryClient.invalidateQueries({ queryKey: ["patients-list"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (patientsQuery.isLoading || appointmentsStats.isLoading || profileQuery.isLoading) {
    return <LoadingState />;
  }

  if (patientsQuery.error || appointmentsStats.error || profileQuery.error) {
    return <ErrorState description="Lỗi tải dữ liệu bệnh nhân" />;
  }

  const patients = patientsQuery.data || [];
  const stats = appointmentsStats.data || {};
  const medicalRecords = medicalRecordsQuery.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý bệnh nhân"
        description="Xem, chỉnh sửa hồ sơ bệnh nhân và theo dõi lịch khám"
        actions={
          <Button
            onClick={() => {
              setNewXrayFile(null);
              setNewSurgeryConsentFile(null);
              setShowAddForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Thêm bệnh nhân
          </Button>
        }
      />

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thêm bệnh nhân</DialogTitle>
            <DialogDescription>Nhập thông tin hồ sơ bệnh nhân mới.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-full-name">Họ tên</Label>
              <Input
                id="patient-full-name"
                value={newPatient.full_name}
                onChange={(event) => setNewPatient({ ...newPatient, full_name: event.target.value })}
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-phone">Số điện thoại</Label>
              <Input
                id="patient-phone"
                value={newPatient.phone}
                onChange={(event) => setNewPatient({ ...newPatient, phone: event.target.value })}
                placeholder="090..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-email">Email</Label>
              <Input
                id="patient-email"
                type="email"
                value={newPatient.email}
                onChange={(event) => setNewPatient({ ...newPatient, email: event.target.value })}
                placeholder="benhnhan@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-identity-number">Số chứng minh/CCCD</Label>
              <Input
                id="patient-identity-number"
                value={newPatient.identity_number}
                onChange={(event) => setNewPatient({ ...newPatient, identity_number: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-date-of-birth">Ngày sinh</Label>
              <Input
                id="patient-date-of-birth"
                type="date"
                value={newPatient.date_of_birth}
                onChange={(event) => setNewPatient({ ...newPatient, date_of_birth: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-gender">Giới tính</Label>
              <Input
                id="patient-gender"
                value={newPatient.gender}
                onChange={(event) => setNewPatient({ ...newPatient, gender: event.target.value })}
                placeholder="Nam/Nữ/Khác"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-insurance-number">Mã bảo hiểm</Label>
              <Input
                id="patient-insurance-number"
                value={newPatient.insurance_number}
                onChange={(event) => setNewPatient({ ...newPatient, insurance_number: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-address">Địa chỉ</Label>
              <Textarea
                id="patient-address"
                rows={2}
                value={newPatient.address}
                onChange={(event) => setNewPatient({ ...newPatient, address: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-allergies">Dị ứng</Label>
              <Textarea
                id="patient-allergies"
                rows={3}
                value={newPatient.allergies}
                onChange={(event) => setNewPatient({ ...newPatient, allergies: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-medical-notes">Ghi chú y tế</Label>
              <Textarea
                id="patient-medical-notes"
                rows={3}
                value={newPatient.medical_notes}
                onChange={(event) => setNewPatient({ ...newPatient, medical_notes: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-medical-history">Tiền sử bệnh</Label>
              <Textarea
                id="patient-medical-history"
                rows={4}
                value={newPatient.medical_history}
                onChange={(event) => setNewPatient({ ...newPatient, medical_history: event.target.value })}
                placeholder="Bao gồm kháng sinh gần đây, phòng ngừa viêm nội tâm mạc bán cấp, thuốc ngừa thai, hội chứng bệnh lý nếu cần"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-dental-history">Tiền sử răng miệng</Label>
              <Textarea
                id="patient-dental-history"
                rows={3}
                value={newPatient.dental_history}
                onChange={(event) => setNewPatient({ ...newPatient, dental_history: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-clinical-examination">Xét nghiệm lâm sàng</Label>
              <Textarea
                id="patient-clinical-examination"
                rows={3}
                value={newPatient.clinical_examination}
                onChange={(event) => setNewPatient({ ...newPatient, clinical_examination: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-xray-image">Ảnh chụp X quang</Label>
              <Input
                id="patient-xray-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setNewXrayFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {newXrayFile ? `Đã chọn: ${newXrayFile.name}` : "Chọn ảnh PNG, JPG, WEBP hoặc GIF, tối đa 10MB"}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-treatment-progress">Ghi nhận tiến trình điều trị</Label>
              <Textarea
                id="patient-treatment-progress"
                rows={3}
                value={newPatient.treatment_progress}
                onChange={(event) => setNewPatient({ ...newPatient, treatment_progress: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-surgery-consent">Giấy thỏa thuận tiến hành phẫu thuật</Label>
              <Input
                id="patient-surgery-consent"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setNewSurgeryConsentFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {newSurgeryConsentFile
                  ? `Đã chọn: ${newSurgeryConsentFile.name}`
                  : "Chọn ảnh giấy thỏa thuận PNG, JPG, WEBP hoặc GIF, tối đa 10MB"}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-treatment-result">Ghi nhận kết quả điều trị hoàn tất</Label>
              <Textarea
                id="patient-treatment-result"
                rows={3}
                value={newPatient.treatment_result}
                onChange={(event) => setNewPatient({ ...newPatient, treatment_result: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddForm(false)}>
              Hủy
            </Button>
            <Button onClick={() => createPatient.mutate()} disabled={createPatient.isPending}>
              {createPatient.isPending ? "Đang lưu..." : "Lưu bệnh nhân"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa bệnh nhân</DialogTitle>
            <DialogDescription>Cập nhật thông tin hồ sơ bệnh nhân.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-full-name">Họ tên</Label>
              <Input
                id="edit-patient-full-name"
                value={editPatient.full_name}
                onChange={(event) => setEditPatient({ ...editPatient, full_name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-patient-phone">Số điện thoại</Label>
              <Input
                id="edit-patient-phone"
                value={editPatient.phone}
                onChange={(event) => setEditPatient({ ...editPatient, phone: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-patient-email">Email</Label>
              <Input
                id="edit-patient-email"
                type="email"
                value={editPatient.email}
                onChange={(event) => setEditPatient({ ...editPatient, email: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-patient-identity-number">Số chứng minh/CCCD</Label>
              <Input
                id="edit-patient-identity-number"
                value={editPatient.identity_number}
                onChange={(event) => setEditPatient({ ...editPatient, identity_number: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-patient-date-of-birth">Ngày sinh</Label>
              <Input
                id="edit-patient-date-of-birth"
                type="date"
                value={editPatient.date_of_birth}
                onChange={(event) => setEditPatient({ ...editPatient, date_of_birth: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-patient-gender">Giới tính</Label>
              <Input
                id="edit-patient-gender"
                value={editPatient.gender}
                onChange={(event) => setEditPatient({ ...editPatient, gender: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-patient-insurance-number">Mã bảo hiểm</Label>
              <Input
                id="edit-patient-insurance-number"
                value={editPatient.insurance_number}
                onChange={(event) => setEditPatient({ ...editPatient, insurance_number: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-address">Địa chỉ</Label>
              <Textarea
                id="edit-patient-address"
                rows={2}
                value={editPatient.address}
                onChange={(event) => setEditPatient({ ...editPatient, address: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-patient-allergies">Dị ứng</Label>
              <Textarea
                id="edit-patient-allergies"
                rows={3}
                value={editPatient.allergies}
                onChange={(event) => setEditPatient({ ...editPatient, allergies: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-patient-medical-notes">Ghi chú y tế</Label>
              <Textarea
                id="edit-patient-medical-notes"
                rows={3}
                value={editPatient.medical_notes}
                onChange={(event) => setEditPatient({ ...editPatient, medical_notes: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-medical-history">Tiền sử bệnh</Label>
              <Textarea
                id="edit-patient-medical-history"
                rows={4}
                value={editPatient.medical_history}
                onChange={(event) => setEditPatient({ ...editPatient, medical_history: event.target.value })}
                placeholder="Bao gồm kháng sinh gần đây, phòng ngừa viêm nội tâm mạc bán cấp, thuốc ngừa thai, hội chứng bệnh lý nếu cần"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-dental-history">Tiền sử răng miệng</Label>
              <Textarea
                id="edit-patient-dental-history"
                rows={3}
                value={editPatient.dental_history}
                onChange={(event) => setEditPatient({ ...editPatient, dental_history: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-clinical-examination">Xét nghiệm lâm sàng</Label>
              <Textarea
                id="edit-patient-clinical-examination"
                rows={3}
                value={editPatient.clinical_examination}
                onChange={(event) => setEditPatient({ ...editPatient, clinical_examination: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-xray-image">Ảnh chụp X quang</Label>
              <Input
                id="edit-patient-xray-image"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setEditXrayFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {editXrayFile
                  ? `Đã chọn: ${editXrayFile.name}`
                  : editPatient.xray_image
                    ? "Đã có ảnh X quang. Chọn file mới nếu muốn thay ảnh."
                    : "Chọn ảnh PNG, JPG, WEBP hoặc GIF, tối đa 10MB"}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-treatment-progress">Ghi nhận tiến trình điều trị</Label>
              <Textarea
                id="edit-patient-treatment-progress"
                rows={3}
                value={editPatient.treatment_progress}
                onChange={(event) => setEditPatient({ ...editPatient, treatment_progress: event.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-surgery-consent">Giấy thỏa thuận tiến hành phẫu thuật</Label>
              <Input
                id="edit-patient-surgery-consent"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setEditSurgeryConsentFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {editSurgeryConsentFile
                  ? `Đã chọn: ${editSurgeryConsentFile.name}`
                  : editPatient.surgery_consent
                    ? "Đã có ảnh giấy thỏa thuận. Chọn file mới nếu muốn thay ảnh."
                    : "Chọn ảnh giấy thỏa thuận PNG, JPG, WEBP hoặc GIF, tối đa 10MB"}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-patient-treatment-result">Ghi nhận kết quả điều trị hoàn tất</Label>
              <Textarea
                id="edit-patient-treatment-result"
                rows={3}
                value={editPatient.treatment_result}
                onChange={(event) => setEditPatient({ ...editPatient, treatment_result: event.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditForm(false)}>
              Hủy
            </Button>
            <Button onClick={() => updatePatient.mutate()} disabled={updatePatient.isPending}>
              {updatePatient.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient List */}
        <div className="lg:col-span-1">
          <Card className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm bệnh nhân..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {patients.length > 0 ? (
                patients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      selectedPatient?.id === patient.id
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-sm">{patient.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{patient.phone || "—"}</div>
                    {stats[patient.id] && (
                      <div className="text-xs text-blue-600 mt-1">
                        {stats[patient.id].count} lần khám
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">Không tìm thấy bệnh nhân</div>
              )}
            </div>
          </Card>
        </div>

        {/* Patient Details */}
        <div className="lg:col-span-2">
          {selectedPatient ? (
            <Card className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b">
                <div>
                  <h2 className="text-2xl font-bold">{selectedPatient.full_name}</h2>
                  <p className="text-muted-foreground mt-1">
                    ID: {selectedPatient.id.slice(0, 8)}...
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditPatient(patientToForm(selectedPatient));
                      setEditXrayFile(null);
                      setEditSurgeryConsentFile(null);
                      setShowEditForm(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(selectedPatient.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm">Điện thoại</span>
                  </div>
                  <p className="font-medium">{selectedPatient.phone || "—"}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">Email</span>
                  </div>
                  <p className="font-medium">{selectedPatient.email || "—"}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
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
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Bảo hiểm</span>
                  </div>
                  <p className="font-medium">{selectedPatient.insurance_number || "—"}</p>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1 pt-4 border-t">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Địa chỉ</span>
                </div>
                <p className="font-medium">{selectedPatient.address || "—"}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium">Tổng lần khám</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {stats[selectedPatient.id]?.count || 0}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium">Lần khám gần nhất</p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {stats[selectedPatient.id]?.lastVisit
                      ? new Date(stats[selectedPatient.id].lastVisit).toLocaleDateString("vi-VN")
                      : "—"}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium">Khách hàng từ</p>
                  <p className="text-lg font-bold text-purple-600 mt-1">
                    {new Date(selectedPatient.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Hồ sơ bệnh án</h3>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">
                      Họ và tên - Địa chỉ liên hệ
                    </div>
                    <div className="space-y-1 text-sm font-medium">
                      <p>{selectedPatient.full_name}</p>
                      <p>{selectedPatient.phone || "Chưa có số điện thoại"}</p>
                      <p>{selectedPatient.email || "Chưa có email"}</p>
                      <p className="whitespace-pre-wrap">{selectedPatient.address || "Chưa có địa chỉ"}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">
                      Số chứng minh/CCCD
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {selectedPatient.identity_number || "Chưa ghi nhận"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <AlertCircle className="w-4 h-4" />
                      Dị ứng
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {selectedPatient.allergies || "Chưa ghi nhận dị ứng"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Stethoscope className="w-4 h-4" />
                      Ghi chú y tế
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {selectedPatient.medical_notes || "Chưa có ghi chú y tế"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Tiền sử bệnh</div>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {selectedPatient.medical_history || "Chưa ghi nhận tiền sử bệnh"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Tiền sử răng miệng</div>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {selectedPatient.dental_history || "Chưa ghi nhận tiền sử răng miệng"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Xét nghiệm lâm sàng</div>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {selectedPatient.clinical_examination || "Chưa ghi nhận xét nghiệm lâm sàng"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Ảnh chụp X quang</div>
                    {isImageUrl(selectedPatient.xray_image) ? (
                      <img
                        src={selectedPatient.xray_image!}
                        alt="Ảnh chụp X quang"
                        className="max-h-80 w-full rounded border object-contain"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm font-medium">
                        {selectedPatient.xray_image || "Chưa ghi nhận ảnh chụp X quang"}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Ghi nhận tiến trình điều trị</div>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {selectedPatient.treatment_progress || "Chưa ghi nhận tiến trình điều trị"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">
                      Giấy thỏa thuận tiến hành phẫu thuật
                    </div>
                    {isImageUrl(selectedPatient.surgery_consent) ? (
                      <img
                        src={selectedPatient.surgery_consent!}
                        alt="Giấy thỏa thuận tiến hành phẫu thuật"
                        className="max-h-80 w-full rounded border object-contain"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm font-medium">
                        {selectedPatient.surgery_consent || "Chưa ghi nhận giấy thỏa thuận"}
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">
                      Ghi nhận kết quả điều trị hoàn tất
                    </div>
                    <p className="whitespace-pre-wrap text-sm font-medium">
                      {selectedPatient.treatment_result || "Chưa ghi nhận kết quả điều trị"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Lịch sử khám</p>
                    <Badge variant="secondary">{medicalRecords.length} hồ sơ</Badge>
                  </div>

                  {medicalRecordsQuery.isLoading ? (
                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                      Đang tải hồ sơ bệnh án...
                    </div>
                  ) : medicalRecordsQuery.error ? (
                    <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                      Lỗi tải hồ sơ bệnh án
                    </div>
                  ) : medicalRecords.length > 0 ? (
                    <div className="space-y-3">
                      {medicalRecords.map((record) => (
                        <div key={record.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold">
                                {new Date(record.appointment_date).toLocaleDateString("vi-VN")} ·{" "}
                                {record.start_time?.slice(0, 5)}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {record.services?.name || "Chưa có dịch vụ"} ·{" "}
                                {record.employees?.full_name || "Chưa gán bác sĩ"}
                              </p>
                            </div>
                            <Badge variant={record.status === "completed" ? "secondary" : "outline"}>
                              {record.status}
                            </Badge>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Ghi chú hẹn</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm">
                                {record.notes || "Không có ghi chú"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Ghi chú điều trị</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm">
                                {record.treatment_notes || "Chưa có ghi chú điều trị"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                      Bệnh nhân chưa có lịch sử khám.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Chọn một bệnh nhân để xem chi tiết</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
