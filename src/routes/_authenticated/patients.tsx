import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { useState } from "react";

import { PageHeader, ErrorState, LoadingState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({
    meta: [
      { title: "Bệnh nhân — Việt Smile Clinic Suite" },
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
  phone: string;
  email: string;
  address: string;
  date_of_birth: string;
  insurance_id: string;
  created_at: string;
  appointments_count?: number;
  last_visit?: string;
}

function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const patientsQuery = useQuery({
    queryKey: ["patients-list", searchTerm],
    queryFn: async () => {
      let query = supabase.from("patients").select(`
        id,
        full_name,
        phone,
        email,
        address,
        date_of_birth,
        insurance_id,
        created_at
      `);

      if (searchTerm) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as Patient[] | [];
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
        description="Xem, chỉnh sửa hồ sơ bệnh nhân và theo dõi lịch khám"
        actions={
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Thêm bệnh nhân
          </Button>
        }
      />

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
                    <div className="text-xs text-muted-foreground mt-1">{patient.phone}</div>
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
                  <Button variant="outline" size="sm">
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
                  <p className="font-medium">{selectedPatient.phone}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">Email</span>
                  </div>
                  <p className="font-medium">{selectedPatient.email}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Ngày sinh</span>
                  </div>
                  <p className="font-medium">
                    {new Date(selectedPatient.date_of_birth).toLocaleDateString("vi-VN")}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Bảo hiểm</span>
                  </div>
                  <p className="font-medium">{selectedPatient.insurance_id || "—"}</p>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1 pt-4 border-t">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Địa chỉ</span>
                </div>
                <p className="font-medium">{selectedPatient.address}</p>
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
