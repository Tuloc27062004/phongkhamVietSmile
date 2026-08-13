import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSessionProfile, useAuthSession, useCurrentEmployee } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/doctor/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Bác sĩ — Việt Smile Clinic" },
      { name: "description", content: "Thông tin cá nhân, lịch khám, lương và chấm công" },
    ],
  }),
  component: DoctorDashboard,
});

interface DoctorStats {
  appointments_today: number;
  appointments_week: number;
  patients_total: number;
  work_frequency_percent: number;
  current_salary: number;
  attendance_status: string;
  late_count_month: number;
}

function DoctorDashboard() {
  const { session } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const employeeQuery = useCurrentEmployee(session?.user.id);
  const employeeId = employeeQuery.data?.id;

  const statsQuery = useQuery({
    queryKey: ["doctor-stats", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0] ?? "";
      const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "";

      if (!employeeId) throw new Error("Missing employee id");

      const [
        appointmentsToday,
        appointmentsWeek,
        patientsTotal,
        attendanceStats,
        salaryInfo,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact" })
          .eq("assigned_dentist_id", employeeId)
          .eq("appointment_date", today),
        supabase
          .from("appointments")
          .select("id", { count: "exact" })
          .eq("assigned_dentist_id", employeeId)
          .gte("appointment_date", weekStart),
        supabase
          .from("appointments")
          .select("patient_id", { count: "exact" })
          .eq("assigned_dentist_id", employeeId)
          .then((result) => ({
            ...result,
            count: new Set((result.data || []).map((a) => a.patient_id)).size,
          })),
        supabase
          .from("attendance_records")
          .select("late_minutes")
          .eq("employee_id", employeeId)
          .gte(
            "work_date",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? ""
          ),
        supabase
          .from("salary_config")
          .select("base_salary")
          .eq("employee_id", employeeId)
          .maybeSingle(),
      ]);

      const lateCount = (attendanceStats.data || []).filter((r) => (r.late_minutes ?? 0) > 15).length;
      const totalAttendance = (attendanceStats.data || []).length;
      const workFrequency = totalAttendance > 0 ? ((totalAttendance - lateCount) / totalAttendance) * 100 : 0;

      return {
        appointments_today: appointmentsToday.count || 0,
        appointments_week: appointmentsWeek.count || 0,
        patients_total: patientsTotal.count || 0,
        work_frequency_percent: Math.round(workFrequency),
        current_salary: salaryInfo.data?.base_salary || 0,
        late_count_month: lateCount,
      };
    },
  });

  if (profileQuery.isLoading || employeeQuery.isLoading || statsQuery.isLoading) {
    return <LoadingState rows={3} />;
  }

  if (profileQuery.isError || employeeQuery.isError || statsQuery.isError) {
    return (
      <ErrorState
        description={(profileQuery.error || employeeQuery.error || statsQuery.error)?.message}
      />
    );
  }

  if (!employeeQuery.data) {
    return (
      <ErrorState description="Tài khoản này chưa được liên kết với hồ sơ nhân viên. Liên hệ quản trị viên để gắn hồ sơ nhân viên (employees.user_id)." />
    );
  }

  const profile = profileQuery.data;
  const stats = statsQuery.data;

  if (!profile || !stats) {
    return <LoadingState rows={3} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Xin chào, ${profile.fullName}!`}
        description="Xem thông tin cá nhân, lịch khám và lương của bạn"
      />

      {/* Top Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Hôm nay"
          value={stats.appointments_today}
          suffix="lịch khám"
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Tuần này"
          value={stats.appointments_week}
          suffix="cuộc hẹn"
          color="purple"
        />
        <StatCard
          icon={TrendingUp}
          label="Tần suất"
          value={stats.work_frequency_percent}
          suffix="%"
          color="green"
        />
        <StatCard
          icon={DollarSign}
          label="Lương hiện tại"
          value={Math.round(stats.current_salary / 1000000)}
          suffix="triệu"
          color="emerald"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Profile & Attendance */}
        <div className="space-y-6 md:col-span-1">
          {/* Profile Card */}
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md">
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Thông tin cá nhân</h3>
                <p className="text-sm text-gray-600">{profile.email}</p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <a href="/doctor/profile">
                  Xem chi tiết <ChevronRight className="ml-2 size-4" />
                </a>
              </Button>
            </div>
          </Card>

          {/* Attendance Card */}
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-orange-50 to-red-50 shadow-md">
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Chấm công tháng</h3>
                <div className="flex items-center gap-2">
                  {stats.late_count_month === 0 ? (
                    <CheckCircle2 className="size-5 text-green-600" />
                  ) : (
                    <AlertCircle className="size-5 text-orange-600" />
                  )}
                  <span className="text-sm text-gray-600">
                    {stats.late_count_month === 0
                      ? "Không có lần đi trễ"
                      : `${stats.late_count_month} lần đi trễ`}
                  </span>
                </div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <a href="/attendance/daily">
                  Xem chi tiết <ChevronRight className="ml-2 size-4" />
                </a>
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column - Schedules & Salary */}
        <div className="space-y-6 md:col-span-2">
          {/* Schedule Card */}
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md">
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Lịch khám hôm nay</h3>
                <p className="text-sm text-gray-600">
                  {stats.appointments_today} cuộc hẹn
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-white/50 px-3 py-2">
                  <Clock className="size-4 text-green-600" />
                  <span className="text-sm text-gray-700">09:00 - 17:00</span>
                </div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <a href="/doctor/schedule">
                  Xem lịch chi tiết <ChevronRight className="ml-2 size-4" />
                </a>
              </Button>
            </div>
          </Card>

          {/* Salary Card */}
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md">
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Thông tin lương</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.current_salary.toLocaleString("vi-VN")} ₫
                </p>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>• Lương cơ bản: {Math.round(stats.current_salary * 0.85).toLocaleString("vi-VN")} ₫</p>
                <p>• Phụ cấp: {Math.round(stats.current_salary * 0.15).toLocaleString("vi-VN")} ₫</p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <a href="/hr/salary">
                  Chi tiết lương <ChevronRight className="ml-2 size-4" />
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <div className="space-y-2 p-4">
            <p className="text-sm text-gray-600">Tổng bệnh nhân</p>
            <p className="text-3xl font-bold text-blue-600">{stats.patients_total}</p>
          </div>
        </Card>
        <Card className="border-0 shadow-sm">
          <div className="space-y-2 p-4">
            <p className="text-sm text-gray-600">Khám tuần này</p>
            <p className="text-3xl font-bold text-purple-600">{stats.appointments_week}</p>
          </div>
        </Card>
        <Card className="border-0 shadow-sm">
          <div className="space-y-2 p-4">
            <p className="text-sm text-gray-600">Tần suất làm việc</p>
            <p className="text-3xl font-bold text-green-600">{stats.work_frequency_percent}%</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix: string;
  color: "blue" | "purple" | "green" | "emerald";
}

function StatCard({ icon: Icon, label, value, suffix, color }: StatCardProps) {
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
          <p className="text-3xl font-bold">{value}</p>
          <p className="text-xs text-gray-600">{suffix}</p>
        </div>
      </div>
    </Card>
  );
}
