import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Search,
  Phone,
  Mail,
  Building2,
  Briefcase,
  Edit,
  Trash2,
  Star,
  Calendar,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { PageHeader, ErrorState, LoadingState } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/staff/profiles")({
  head: () => ({
    meta: [
      { title: "Hồ sơ nhân viên — Việt Smile Clinic Suite" },
      { name: "description", content: "Xem và quản lý hồ sơ các bác sĩ và nhân viên phòng khám." },
    ],
  }),
  component: StaffProfilesPage,
});

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  position_id: string;
  department_id: string;
  hire_date: string;
  status: string;
  profile_photo_url: string | null;
  specialization?: string;
  license_number?: string;
  positions?: { id: string; name: string };
  departments?: { id: string; name: string };
}

function StaffProfilesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  const staffQuery = useQuery({
    queryKey: ["staff-profiles", searchTerm],
    queryFn: async () => {
      let query = supabase.from("employees").select(`
        id,
        full_name,
        email,
        phone,
        position_id,
        department_id,
        hire_date,
        status,
        profile_photo_url,
        specialization,
        license_number,
        positions:position_id (
          id,
          name
        ),
        departments:department_id (
          id,
          name
        )
      `);

      if (searchTerm) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query.order("full_name");
      if (error) throw error;
      return data as StaffMember[] | [];
    },
  });

  const appointmentsStats = useQuery({
    queryKey: ["staff-appointments-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("assigned_dentist_id, status");
      if (error) throw error;

      const stats: Record<string, any> = {};
      (data || []).forEach((apt) => {
        const doctorId = apt.assigned_dentist_id;
        if (!doctorId) return;
        if (!stats[doctorId]) {
          stats[doctorId] = {
            total: 0,
            completed: 0,
            cancelled: 0,
          };
        }
        stats[doctorId].total++;
        if (apt.status === "completed") stats[doctorId].completed++;
        if (apt.status === "cancelled") stats[doctorId].cancelled++;
      });

      return stats;
    },
  });

  const handleDelete = async (id: string) => {
    if (confirm("Bạn chắc chắn muốn xóa nhân viên này?")) {
      try {
        const { error } = await supabase.from("employees").delete().eq("id", id);
        if (error) throw error;
        staffQuery.refetch();
        setSelectedStaff(null);
      } catch (error) {
        console.error("Delete error:", error);
        alert("Lỗi khi xóa nhân viên");
      }
    }
  };

  if (staffQuery.isLoading || appointmentsStats.isLoading) {
    return <LoadingState />;
  }

  if (staffQuery.error || appointmentsStats.error) {
    return <ErrorState description="Lỗi tải dữ liệu nhân viên" />;
  }

  const staffList = staffQuery.data || [];
  const stats = appointmentsStats.data || {};

  const getDaysInPosition = (hireDate: string) => {
    const days = Math.floor(
      (new Date().getTime() - new Date(hireDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return "Hôm nay";
    if (days === 1) return "1 ngày";
    if (days < 30) return `${days} ngày`;
    if (days < 365) return `${Math.floor(days / 30)} tháng`;
    return `${Math.floor(days / 365)} năm`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ nhân viên"
        description="Xem và quản lý thông tin bác sĩ, nhân viên và hiệu suất làm việc"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Staff List */}
        <div className="lg:col-span-1">
          <Card className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm nhân viên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {staffList.length > 0 ? (
                staffList.map((staff) => (
                  <div
                    key={staff.id}
                    onClick={() => setSelectedStaff(staff)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                      selectedStaff?.id === staff.id
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {staff.profile_photo_url ? (
                        <img
                          src={staff.profile_photo_url}
                          alt={staff.full_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{staff.full_name}</div>
                        <div className="text-xs text-muted-foreground">{staff.email}</div>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {staff.status === "active" ? "Đang làm" : "Nghỉ việc"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">Không tìm thấy nhân viên</div>
              )}
            </div>
          </Card>
        </div>

        {/* Staff Details */}
        <div className="lg:col-span-2">
          {selectedStaff ? (
            <div className="space-y-4">
              {/* Profile Card */}
              <Card className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b">
                  <div className="flex items-start gap-4">
                    {selectedStaff.profile_photo_url ? (
                      <img
                        src={selectedStaff.profile_photo_url}
                        alt={selectedStaff.full_name}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="w-10 h-10 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold">{selectedStaff.full_name}</h2>
                      <p className="text-muted-foreground mt-1">
                        {selectedStaff.positions?.name || "Chuyên viên"}
                      </p>
                      <Badge className="mt-2" variant={selectedStaff.status === "active" ? "default" : "destructive"}>
                        {selectedStaff.status === "active" ? "Đang làm việc" : "Đã nghỉ"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(selectedStaff.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">Email</span>
                    </div>
                    <p className="font-medium">{selectedStaff.email}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span className="text-sm">Điện thoại</span>
                    </div>
                    <p className="font-medium">{selectedStaff.phone}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span className="text-sm">Phòng ban</span>
                    </div>
                    <p className="font-medium">{selectedStaff.departments?.name || "—"}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Ngày tuyển dụng</span>
                    </div>
                    <p className="font-medium">
                      {new Date(selectedStaff.hire_date).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                {(selectedStaff.specialization || selectedStaff.license_number) && (
                  <div className="pt-4 border-t">
                    {selectedStaff.specialization && (
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Star className="w-4 h-4" />
                          <span className="text-sm">Chuyên môn</span>
                        </div>
                        <p className="font-medium">{selectedStaff.specialization}</p>
                      </div>
                    )}
                    {selectedStaff.license_number && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Briefcase className="w-4 h-4" />
                          <span className="text-sm">Số giấy phép</span>
                        </div>
                        <p className="font-medium">{selectedStaff.license_number}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Performance Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Tổng cuộc hẹn</p>
                      <p className="text-3xl font-bold text-blue-600 mt-1">
                        {stats[selectedStaff.id]?.total || 0}
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 text-blue-200" />
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Hoàn thành</p>
                      <p className="text-3xl font-bold text-green-600 mt-1">
                        {stats[selectedStaff.id]?.completed || 0}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-200" />
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">Thời gian công</p>
                      <p className="text-2xl font-bold text-purple-600 mt-1">
                        {getDaysInPosition(selectedStaff.hire_date)}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-purple-200" />
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Chọn một nhân viên để xem chi tiết</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
