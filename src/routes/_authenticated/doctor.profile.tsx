import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  FileText,
  Award,
  Briefcase,
  ChevronRight,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSessionProfile, useAuthSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/doctor/profile")({
  head: () => ({
    meta: [
      { title: "Hồ sơ cá nhân — Việt Smile Clinic" },
      { name: "description", content: "Thông tin chi tiết bác sĩ" },
    ],
  }),
  component: DoctorProfile,
});

interface DoctorInfo {
  full_name: string;
  email: string;
  phone: string;
  specialization: string;
  license_number: string;
  employment_status: string;
  department: string;
  start_date: string;
  qualification: string;
}

function DoctorProfile() {
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);

  const doctorQuery = useQuery({
    queryKey: ["doctor-info", session?.user.id],
    enabled: Boolean(session?.user.id),
    queryFn: async () => {
      if (!session) throw new Error("Missing session");
      const [employeeResult, departmentResult] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "id, full_name, email, phone, employment_status, start_date, created_at, department_id"
          )
          .eq("email", session.user.email ?? "")
          .maybeSingle(),
        supabase.from("departments").select("id, name"),
      ]);

      const employee = employeeResult.data;
      const department =
        departmentResult.data?.find((d) => d.id === employee?.department_id)?.name || "N/A";

      return {
        full_name: employee?.full_name || "Không xác định",
        email: employee?.email || "",
        phone: employee?.phone || "Chưa cập nhật",
        specialization: "Nha khoa",
        license_number: "SK-2024-001",
        employment_status: employee?.employment_status || "active",
        department: department,
        start_date: employee?.start_date || (new Date().toISOString().split("T")[0] ?? ""),
        qualification: "Bác sĩ nha khoa",
      };
    },
  });

  if (profileQuery.isError || doctorQuery.isError) {
    return (
      <ErrorState
        description={(profileQuery.error || doctorQuery.error)?.message}
      />
    );
  }

  const profile = profileQuery.data;
  const doctor = doctorQuery.data;

  if (!profile || !doctor || profileQuery.isLoading || doctorQuery.isLoading) {
    return <LoadingState rows={3} />;
  }

  const startDate = new Date(doctor.start_date);
  const yearsExp = Math.floor(
    (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={doctor.full_name}
        description={`${doctor.qualification} • ${doctor.department}`}
      />

      {/* Profile Header Card */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 text-xl font-bold text-white">
                  {(doctor.full_name.split(" ").slice(-1)[0] ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{doctor.full_name}</h2>
                  <p className="text-gray-600">{doctor.qualification}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">{doctor.specialization}</Badge>
                <Badge variant="outline">{doctor.employment_status === "active" ? "Đang hoạt động" : "Tạm dừng"}</Badge>
                {yearsExp > 0 && (
                  <Badge variant="secondary">{yearsExp} năm kinh nghiệm</Badge>
                )}
              </div>
            </div>
            <Button variant="outline">Chỉnh sửa</Button>
          </div>
        </div>
      </Card>

      {/* Contact Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Thông tin liên hệ</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="size-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Email</p>
                  <p className="text-sm font-medium text-gray-900">{doctor.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="size-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Số điện thoại</p>
                  <p className="text-sm font-medium text-gray-900">{doctor.phone}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Professional Information */}
        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Thông tin chuyên môn</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Award className="size-5 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-600">Giấy phép</p>
                  <p className="text-sm font-medium text-gray-900">{doctor.license_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Briefcase className="size-5 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-600">Chuyên khoa</p>
                  <p className="text-sm font-medium text-gray-900">{doctor.specialization}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Employment Details */}
      <Card className="border-0 shadow-md">
        <div className="space-y-4 p-6">
          <h3 className="font-semibold text-gray-900">Chi tiết công tác</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1 rounded-lg bg-blue-50 p-4">
              <p className="text-xs font-medium text-gray-600">Phòng ban</p>
              <p className="text-lg font-bold text-blue-600">{doctor.department}</p>
            </div>
            <div className="space-y-1 rounded-lg bg-purple-50 p-4">
              <p className="text-xs font-medium text-gray-600">Tình trạng công tác</p>
              <p className="text-lg font-bold text-purple-600 capitalize">
                {doctor.employment_status === "active" ? "Hoạt động" : "Tạm dừng"}
              </p>
            </div>
            <div className="space-y-1 rounded-lg bg-green-50 p-4">
              <p className="text-xs font-medium text-gray-600">Kinh nghiệm</p>
              <p className="text-lg font-bold text-green-600">{yearsExp} năm</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Button className="h-14 text-base" variant="outline" asChild>
          <a href="/doctor/schedule">
            <Calendar className="mr-2 size-4" />
            Xem lịch khám
            <ChevronRight className="ml-2 size-4" />
          </a>
        </Button>
        <Button className="h-14 text-base" variant="outline" asChild>
          <a href="/hr/salary">
            <FileText className="mr-2 size-4" />
            Xem lương
            <ChevronRight className="ml-2 size-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
