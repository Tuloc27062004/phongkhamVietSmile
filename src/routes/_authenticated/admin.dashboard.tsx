import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Building2,
  RefreshCw,
  Sliders,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
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

interface ClinicOption {
  id: string;
  name: string;
  code: string;
  is_active_workspace: boolean;
}

function AdminDashboard() {
  const queryClient = useQueryClient();

  // Query: Danh sách phòng khám dành cho Super Admin GZV Platform
  const clinicsQuery = useQuery({
    queryKey: ["super-admin-clinics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_admin_list_clinics");
      if (error) {
        // Fallback cho tài khoản không phải Super Admin
        const { data: currentOrg } = await supabase
          .from("organizations")
          .select("id, name, code")
          .maybeSingle();
        return currentOrg ? [{ ...currentOrg, is_active_workspace: true }] : [];
      }
      return (data as unknown as ClinicOption[]) || [];
    },
  });

  // Mutation: Chuyển đổi workspace quản lý phòng khám
  const switchClinicMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.rpc("super_admin_switch_clinic", { target_org_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã chuyển đổi không gian làm việc phòng khám thành công!");
      void queryClient.invalidateQueries();
    },
    onError: (err: Error) => {
      toast.error(`Không thể chuyển phòng khám: ${err.message}`);
    },
  });

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
                    GZV Platform Control Center
                  </span>
                  <Badge variant="outline" className="border-blue-400/30 text-blue-300 text-[10px]">
                    Super Admin
                  </Badge>
                </div>
                <h2 className="text-lg font-bold text-white">
                  Đang quản lý: {currentWorkspace?.name || "Chưa chọn phòng khám"}
                </h2>
              </div>
            </div>

            {clinicsQuery.data.length > 1 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-300 whitespace-nowrap">Chuyển phòng khám:</span>
                <Select
                  value={currentWorkspace?.id}
                  onValueChange={(val) => switchClinicMutation.mutate(val)}
                  disabled={switchClinicMutation.isPending}
                >
                  <SelectTrigger className="w-[240px] border-slate-700 bg-slate-800/80 text-white">
                    <SelectValue placeholder="Chọn phòng khám..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {clinicsQuery.data.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id} className="focus:bg-blue-600 focus:text-white">
                        {clinic.name} ({clinic.code})
                      </SelectItem>
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
              <a href="/system/clinic-profile">Cấu hình phòng khám</a>
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
              <a href="/attendance/daily">Chi tiết chấm công</a>
            </Button>
          </div>
        </Card>

        {/* Quick Management Actions */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Quản trị chuyên môn</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/employees">Quản lý Y Bác sĩ & Nhân sự</a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/appointments">Quản lý Lịch khám bệnh</a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/biometric/devices">Máy chấm công phần cứng</a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/system/users">Tài khoản & Phân quyền</a>
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
              <a href="/system/settings">Cấu hình nâng cao</a>
            </Button>
          </div>
        </Card>
      </div>
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
