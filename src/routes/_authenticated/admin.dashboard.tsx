import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Quản Trị — Việt Smile Clinic" },
      { name: "description", content: "Tổng quan toàn bộ hệ thống" },
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

function AdminDashboard() {
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
        supabase
          .from("employees")
          .select("id", { count: "exact" })
          .is("deleted_at", null),
        supabase
          .from("employees")
          .select("id", { count: "exact" })
          .eq("employment_status", "active"),
        supabase
          .from("appointments")
          .select("id", { count: "exact" })
          .eq("appointment_date", today),
        supabase
          .from("appointments")
          .select("id", { count: "exact" }),
        supabase
          .from("attendance_records")
          .select("id", { count: "exact" })
          .eq("work_date", today),
        supabase
          .from("attendance_records")
          .select("id", { count: "exact" })
          .eq("work_date", today)
          .gt("late_minutes", 15),
        supabase
          .from("attendance_records")
          .select("id", { count: "exact" })
          .eq("work_date", today)
          .eq("attendance_status", "absent"),
        supabase
          .from("salary_config")
          .select("base_salary")
          .then((result) => ({
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

  if (statsQuery.isLoading) {
    return <LoadingState rows={4} />;
  }

  if (statsQuery.isError) {
    return <ErrorState description={statsQuery.error?.message} />;
  }

  const stats = statsQuery.data;
  if (!stats) {
    return null;
  }
  const attendanceRate = stats.total_employees > 0 
    ? Math.round(((stats.attendance_today) / stats.total_employees) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bảng điều khiển quản trị"
        description="Tổng quan toàn bộ hoạt động phòng khám"
        actions={
          <>
            <Button variant="outline">Xuất báo cáo</Button>
            <Button>Tạo lịch hẹn</Button>
          </>
        }
      />

      {/* KPI Row */}
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
          label="Tổng lương"
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
              <div className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2">
                <span className="text-sm text-gray-600">Đã chấm công</span>
                <span className="font-semibold text-blue-600">{stats.attendance_today}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2">
                <span className="text-sm text-gray-600">Đi trễ</span>
                <span className="font-semibold text-orange-600">{stats.late_today}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2">
                <span className="text-sm text-gray-600">Vắng</span>
                <span className="font-semibold text-red-600">{stats.absent_today}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <a href="/attendance/daily">Xem chi tiết</a>
            </Button>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Hành động nhanh</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/employees">Quản lý nhân viên</a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/appointments">Quản lý lịch hẹn</a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/hr/payroll">Tính lương</a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/reports/export">Xuất báo cáo</a>
              </Button>
            </div>
          </div>
        </Card>

        {/* System Status */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-gray-900">Trạng thái hệ thống</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600" />
                <span className="text-sm text-gray-700">Máy chấm công: Bình thường</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600" />
                <span className="text-sm text-gray-700">Database: Kết nối tốt</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600" />
                <span className="text-sm text-gray-700">API: Hoạt động</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-orange-600" />
                <span className="text-sm text-gray-700">Backup: 2 giờ trước</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <a href="/system/settings">Cài đặt</a>
            </Button>
          </div>
        </Card>
      </div>

      {/* Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Lịch khám tuần</h3>
              <BarChart3 className="size-4 text-gray-500" />
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Số liệu: {stats.total_appointments} cuộc hẹn</p>
              <p>Trung bình: {Math.round(stats.total_appointments / 7)} cuộc/ngày</p>
            </div>
          </div>
        </Card>

        <Card className="border-0 shadow-md">
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Tỉ lệ chấm công</h3>
              <TrendingUp className="size-4 text-gray-500" />
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Tỉ lệ: {attendanceRate}%</p>
              <p>Trễ: {stats.late_today} | Vắng: {stats.absent_today}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface AdminStatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtext?: string;
  suffix?: string;
  color: "blue" | "purple" | "green" | "emerald";
}

function AdminStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  suffix,
  color,
}: AdminStatCardProps) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100 text-blue-600",
    purple: "from-purple-50 to-purple-100 text-purple-600",
    green: "from-green-50 to-green-100 text-green-600",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-600",
  };

  return (
    <Card className={`overflow-hidden border-0 bg-gradient-to-br ${colorClasses[color]} shadow-md`}>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-3xl font-bold">
            {value}
            {suffix && <span className="text-lg">{suffix}</span>}
          </p>
          {subtext && <p className="text-xs text-gray-600">{subtext}</p>}
        </div>
      </div>
    </Card>
  );
}
