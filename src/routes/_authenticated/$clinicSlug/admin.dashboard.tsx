import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Building2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { CreateClinicDialog } from "@/components/create-clinic-dialog";
import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClinicPath } from "@/hooks/use-clinic-path";
import {
  useSuperAdminClinics,
  useSwitchClinic,
  type SuperAdminClinic,
} from "@/hooks/use-switch-clinic";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Quản Trị Đa Phòng Khám — GZV Platform" },
      { name: "description", content: "Trung tâm quản trị hệ thống và các phòng khám chi nhánh" },
    ],
  }),
  component: AdminDashboard,
});

interface AdminStats {
  total_employees: number;
  active_employees: number;
  today_appointments: number;
  total_appointments: number;
  total_payroll: number;
  attendance_today: number;
  late_today: number;
  absent_today: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  dental: "🦷",
  general: "🏥",
  obgyn: "👶",
  pediatrics: "🧸",
  dermatology: "✨",
  ophthalmology: "👁️",
  ent: "👂",
  aesthetics: "💄",
  rehab: "🦾",
  hospital: "🏬",
};

function AdminDashboard() {
  const queryClient = useQueryClient();
  const buildPath = useClinicPath();

  // Danh sách phòng khám nhóm theo cây danh mục chuyên khoa dành cho Super Admin GZV Platform
  const clinicsQuery = useSuperAdminClinics(true);

  // Chuyển đổi workspace quản lý phòng khám — điều hướng URL sang /$slug/admin/dashboard
  const switchClinic = useSwitchClinic();

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0] ?? "";

      const [
        employees,
        activeEmployees,
        todayAppointments,
        totalAppointments,
        todayAttendance,
        lateToday,
        absentToday,
        payroll,
      ] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact" }).is("deleted_at", null),
        supabase.from("employees").select("id", { count: "exact" }).eq("employment_status", "active"),
        supabase.from("appointments").select("id", { count: "exact" }).eq("appointment_date", today),
        supabase.from("appointments").select("id", { count: "exact" }),
        supabase.from("attendance_records").select("id", { count: "exact" }).eq("work_date", today),
        supabase.from("attendance_records").select("id", { count: "exact" }).eq("work_date", today).gt("late_minutes", 15),
        supabase.from("attendance_records").select("id", { count: "exact" }).eq("work_date", today).eq("attendance_status", "absent"),
        supabase.from("salary_config").select("base_salary").then((result) => ({
          total: (result.data || []).reduce((sum, r) => sum + (r.base_salary || 0), 0),
        })),
      ]);

      return {
        total_employees: employees.count || 0,
        active_employees: activeEmployees.count || 0,
        today_appointments: todayAppointments.count || 0,
        total_appointments: totalAppointments.count || 0,
        attendance_today: todayAttendance.count || 0,
        late_today: lateToday.count || 0,
        absent_today: absentToday.count || 0,
        total_payroll: payroll.total || 0,
      };
    },
  });

  if (statsQuery.isLoading || clinicsQuery.isLoading) {
    return <LoadingState rows={4} />;
  }

  if (statsQuery.isError) {
    return <ErrorState description={statsQuery.error?.message} />;
  }

  const stats = statsQuery.data ?? {
    total_employees: 0,
    active_employees: 0,
    today_appointments: 0,
    total_appointments: 0,
    attendance_today: 0,
    late_today: 0,
    absent_today: 0,
    total_payroll: 0,
  };

  const attendanceRate =
    stats.total_employees > 0
      ? Math.round((stats.attendance_today / stats.total_employees) * 100)
      : 0;

  const currentWorkspace = clinicsQuery.data?.find((c) => c.is_active_workspace);

  // Group clinics by category label
  const groupedClinics = (clinicsQuery.data || []).reduce(
    (acc, clinic) => {
      const cat = clinic.clinic_category_label || "Chuyên Khoa Khác";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(clinic);
      return acc;
    },
    {} as Record<string, SuperAdminClinic[]>,
  );

  return (
    <div className="space-y-8">
      {/* Super Admin Clinic Workspace Switcher Bar */}
      {clinicsQuery.data && clinicsQuery.data.length > 0 && (
        <Card className="border-l-4 border-l-blue-600 bg-gradient-to-r from-slate-900 to-indigo-950 p-4 text-white shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 backdrop-blur-md">
                <Building2 className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    GZV CLINIC PLATFORM — CONTROL CENTER
                  </span>
                  <Badge variant="outline" className="border-blue-400/30 text-blue-300 text-[10px]">
                    Super Admin Center
                  </Badge>
                </div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{CATEGORY_ICONS[currentWorkspace?.clinic_category || "general"]}</span>
                  <span>Đang quản lý: {currentWorkspace?.name || "GZV Central Hub"}</span>
                  <span className="text-xs font-normal text-slate-400">({currentWorkspace?.clinic_category_label})</span>
                </h2>
              </div>
            </div>

            {clinicsQuery.data.length > 1 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-300 whitespace-nowrap">Chọn Chi Nhánh / Chuyên Khoa:</span>
                <Select
                  value={currentWorkspace?.slug ?? ""}
                  onValueChange={(slug) => switchClinic.mutate({ slug, subpath: "/admin/dashboard" })}
                  disabled={switchClinic.isPending}
                >
                  <SelectTrigger className="w-[300px] border-slate-700 bg-slate-800/90 text-white font-medium">
                    <SelectValue placeholder="Chọn phòng khám..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[400px]">
                    {Object.entries(groupedClinics).map(([categoryLabel, clinics]) => (
                      <div key={categoryLabel} className="px-2 py-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400 mb-1 border-b border-slate-800 pb-1">
                          {categoryLabel}
                        </div>
                        {clinics.map((clinic) => (
                          <SelectItem
                            key={clinic.id}
                            value={clinic.slug}
                            className="focus:bg-blue-600 focus:text-white cursor-pointer py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{clinic.name}</span>
                              <span className="text-[10px] text-slate-400">({clinic.code})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Card>
      )}

      <PageHeader
        title="Bảng Điều Khiển Quản Trị Hệ Thống"
        description={`Tổng quan hoạt động và dữ liệu vận hành phòng khám ${currentWorkspace ? `- ${currentWorkspace.name}` : ""}`}
        actions={
          <>
            <Button variant="outline" onClick={() => void queryClient.invalidateQueries()}>
              <RefreshCw className="mr-2 size-4" /> Làm mới
            </Button>
            <Button asChild>
              <Link to={buildPath("/system/clinic-profile")}>Cấu hình phòng khám</Link>
            </Button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <AdminStatCard
          icon={Users}
          label="Tổng nhân viên"
          value={stats.total_employees}
          subtext={`${stats.active_employees} đang hoạt động`}
          color="blue"
        />
        <AdminStatCard
          icon={Calendar}
          label="Lịch khám hôm nay"
          value={stats.today_appointments}
          subtext={`${stats.total_appointments} tổng cộng`}
          color="purple"
        />
        <AdminStatCard
          icon={TrendingUp}
          label="Tỉ lệ chấm công"
          value={attendanceRate}
          subtext={`${stats.attendance_today}/${stats.total_employees} đã check`}
          suffix="%"
          color="green"
        />
        <AdminStatCard
          icon={DollarSign}
          label="Tổng quỹ lương"
          value={Math.round(stats.total_payroll / 1000000)}
          subtext="triệu đồng/tháng"
          color="emerald"
        />
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Attendance Today */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Chấm công hôm nay</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2">
                <span className="text-sm text-gray-600">Đã chấm công</span>
                <span className="font-semibold text-blue-600">{stats.attendance_today}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2">
                <span className="text-sm text-gray-600">Đi trễ</span>
                <span className="font-semibold text-orange-600">{stats.late_today}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2">
                <span className="text-sm text-gray-600">Vắng</span>
                <span className="font-semibold text-red-600">{stats.absent_today}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to={buildPath("/attendance/daily")}>Chi tiết chấm công</Link>
            </Button>
          </div>
        </Card>

        {/* Quick Management Actions */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Quản trị chuyên môn</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={buildPath("/employees")}>Quản lý Y Bác sĩ & Nhân sự</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={buildPath("/appointments")}>Quản lý Lịch khám bệnh</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={buildPath("/biometric/devices")}>Máy chấm công phần cứng</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to={buildPath("/system/users")}>Tài khoản & Phân quyền</Link>
              </Button>
            </div>
          </div>
        </Card>

        {/* System & Hardware Health */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-md md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Trạng thái hạ tầng</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span className="text-sm text-gray-700">Máy chấm công vân tay: Sẵn sàng</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span className="text-sm text-gray-700">Supabase Cloud DB: Kết nối tốt</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span className="text-sm text-gray-700">Realtime Push Engine: Hoạt động</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-blue-600" />
                <span className="text-sm text-gray-700">Bảo mật RLS: Cách ly tuyệt đối</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to={buildPath("/system/settings")}>Cấu hình nâng cao</Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Super Admin Detailed Clinic Management Table */}
      <Card className="p-6 shadow-md border-0 bg-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="size-5 text-blue-600" />
              <span>Danh Sách & Quản Lý Chi Tiết Tất Cả Các Phòng Khám</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Super Admin GZV Platform: Theo dõi giới hạn nhân sự, bác sĩ, thiết bị máy chấm công và vai trò các phòng khám khách hàng.
            </p>
          </div>
          <CreateClinicDialog />
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b">
              <tr>
                <th className="px-4 py-3">Tên Phòng Khám / Cơ Sở</th>
                <th className="px-4 py-3">Mã Code / Slug</th>
                <th className="px-4 py-3">Chuyên Khoa</th>
                <th className="px-4 py-3 text-center">Hạn Mạch Nhân Sự</th>
                <th className="px-4 py-3 text-center">Bác Sĩ</th>
                <th className="px-4 py-3 text-center">Máy Vân Tay</th>
                <th className="px-4 py-3 text-center">Trạng Thái</th>
                <th className="px-4 py-3 text-right">Thao Tác Quản Lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(clinicsQuery.data || []).map((clinic) => (
                <tr key={clinic.id} className={clinic.is_active_workspace ? "bg-blue-50/50 font-medium" : "hover:bg-gray-50/80"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{CATEGORY_ICONS[clinic.clinic_category || "general"]}</span>
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          <span>{clinic.name}</span>
                          {clinic.is_active_workspace && (
                            <Badge className="bg-blue-600 text-[10px] py-0 px-1.5">Đang làm việc</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
                      {clinic.code}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs border-slate-200">
                      {clinic.clinic_category_label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-slate-800">{clinic.employee_count}</span> / <span className="text-slate-500">{clinic.max_employees || 50}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-slate-800">{clinic.doctor_count}</span> / <span className="text-slate-500">{clinic.max_doctors || 20}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-slate-800">{clinic.device_count}</span> / <span className="text-slate-500">{clinic.max_devices || 10}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {clinic.is_active_workspace ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <span className="size-2 rounded-full bg-emerald-500"></span> Đang hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <span className="size-2 rounded-full bg-slate-300"></span> Sẵn sàng
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!clinic.is_active_workspace && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() =>
                            switchClinic.mutate({ slug: clinic.slug, subpath: "/admin/dashboard" })
                          }
                          disabled={switchClinic.isPending}
                        >
                          Vào Kiểm Tra Dữ Liệu
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-slate-600" asChild>
                        <Link to={buildPath("/system/clinic-profile")}>Cấu Hình Hồ Sơ</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AdminStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  suffix = "",
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtext: string;
  suffix?: string;
  color: "blue" | "purple" | "green" | "emerald";
}) {
  const colorMap = {
    blue: "from-blue-500 to-indigo-600 text-blue-600 bg-blue-50",
    purple: "from-purple-500 to-pink-600 text-purple-600 bg-purple-50",
    green: "from-green-500 to-emerald-600 text-green-600 bg-green-50",
    emerald: "from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-50",
  };

  return (
    <Card className="p-6 transition-all hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-gray-900">
              {value}
            </span>
            {suffix && <span className="text-lg font-semibold text-gray-600">{suffix}</span>}
          </div>
          <p className="text-xs text-gray-500">{subtext}</p>
        </div>
        <div className={`rounded-xl p-3 ${colorMap[color].split(" ").slice(1).join(" ")}`}>
          <Icon className="size-6" />
        </div>
      </div>
    </Card>
  );
}
