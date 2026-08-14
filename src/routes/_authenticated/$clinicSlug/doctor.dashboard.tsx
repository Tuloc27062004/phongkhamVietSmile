import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  UsersRound,
} from "lucide-react";

import { EmployeeProfilePanel } from "@/components/employee-profile-panel";
import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useClinicPath } from "@/hooks/use-clinic-path";
import { useSessionProfile, useAuthSession, useCurrentEmployee } from "@/hooks/use-session";
import { hasAnyRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/$clinicSlug/doctor/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Bác sĩ — GZV Clinic Platform" },
      { name: "description", content: "Thông tin cá nhân, lịch khám, lương và chấm công" },
    ],
  }),
  component: DoctorDashboard,
});

type RosterMember = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  profile_photo_url: string | null;
  professional_title: string | null;
  employment_status: string;
  positions: { name: string } | null;
  departments: { name: string } | null;
};

interface DoctorStats {
  appointments_today: number;
  appointments_week: number;
  patients_total: number;
  work_frequency_percent: number;
  current_salary: number;
  allowance: number;
  bonus: number;
  attendance_status: string;
  late_count_month: number;
}

function DoctorDashboard() {
  const { session } = useAuthSession();
  const { org } = Route.useRouteContext();
  const buildPath = useClinicPath();
  const profileQuery = useSessionProfile(session?.user.id);
  const employeeQuery = useCurrentEmployee(session?.user.id);
  const canPreview = hasAnyRole(profileQuery.data?.roles ?? [], ["administrator", "manager"]);
  const isPreviewing = canPreview && !employeeQuery.data;

  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(null);

  const doctorsQuery = useQuery({
    queryKey: ["doctor-dashboard-preview-list"],
    enabled: isPreviewing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, professional_title")
        .eq("can_receive_appointments", true)
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!isPreviewing || previewEmployeeId) return;
    const first = doctorsQuery.data?.[0]?.id;
    if (first) setPreviewEmployeeId(first);
  }, [isPreviewing, previewEmployeeId, doctorsQuery.data]);

  const employeeId = employeeQuery.data?.id ?? (isPreviewing ? previewEmployeeId ?? undefined : undefined);

  const activeEmployeeDetailQuery = useQuery({
    queryKey: ["doctor-dashboard-active-employee", employeeId],
    enabled: Boolean(employeeId) && isPreviewing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, email, professional_title")
        .eq("id", employeeId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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
          .select("base_salary, allowance, bonus")
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
        allowance: salaryInfo.data?.allowance || 0,
        bonus: salaryInfo.data?.bonus || 0,
        late_count_month: lateCount,
      };
    },
  });

  const canEditProfiles = hasAnyRole(profileQuery.data?.roles ?? [], ["administrator", "manager"]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const teamRosterQuery = useQuery({
    queryKey: ["clinic-team-roster"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, full_name, avatar_url, profile_photo_url, professional_title, employment_status, positions(name), departments(name)",
        )
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as RosterMember[];
    },
  });

  const rosterGroups = (teamRosterQuery.data ?? []).reduce<Record<string, RosterMember[]>>((acc, member) => {
    const category = member.positions?.name ?? member.professional_title ?? "Chưa phân loại";
    (acc[category] ??= []).push(member);
    return acc;
  }, {});

  if (profileQuery.isLoading || employeeQuery.isLoading) {
    return <LoadingState rows={3} />;
  }

  if (profileQuery.isError || employeeQuery.isError) {
    return <ErrorState description={(profileQuery.error || employeeQuery.error)?.message} />;
  }

  if (!employeeQuery.data && !canPreview) {
    return (
      <ErrorState description="Tài khoản này chưa được liên kết với hồ sơ nhân viên. Liên hệ quản trị viên để gắn hồ sơ nhân viên (employees.user_id)." />
    );
  }

  if (isPreviewing && doctorsQuery.isLoading) {
    return <LoadingState rows={3} />;
  }

  if (isPreviewing && doctorsQuery.isError) {
    return <ErrorState description={(doctorsQuery.error as Error).message} />;
  }

  if (isPreviewing && (doctorsQuery.data?.length ?? 0) === 0) {
    return (
      <ErrorState description="Tài khoản này không có hồ sơ nhân viên (Quản trị viên/Quản lý không phải là bác sĩ của phòng khám), và chưa có bác sĩ nào được đánh dấu 'nhận lịch hẹn' để xem trước. Vào Nhân sự > Danh sách Y Bác sĩ để cấu hình." />
    );
  }

  if (!employeeId || statsQuery.isLoading) {
    return <LoadingState rows={3} />;
  }

  if (statsQuery.isError) {
    return <ErrorState description={(statsQuery.error as Error).message} />;
  }

  const profile = profileQuery.data;
  const stats = statsQuery.data;

  if (!profile || !stats) {
    return <LoadingState rows={3} />;
  }

  const displayName = isPreviewing ? activeEmployeeDetailQuery.data?.full_name || "…" : profile.fullName;
  const displayEmail = isPreviewing ? activeEmployeeDetailQuery.data?.email || "—" : profile.email;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Xin chào, ${displayName}!`}
        description="Xem thông tin cá nhân, lịch khám và lương của bạn"
      />

      {isPreviewing && (
        <Card className="border border-warning/25 bg-warning/10 p-4 shadow-none">
          <div className="flex flex-wrap items-center gap-3">
            <Eye className="size-5 shrink-0 text-warning-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-warning-foreground">
                Chế độ xem trước (Quản trị viên/Quản lý không có hồ sơ nhân viên riêng)
              </p>
              <p className="text-xs text-muted-foreground">
                Đang xem dashboard của một bác sĩ trong phòng khám để kiểm tra dữ liệu.
              </p>
            </div>
            <Select value={employeeId ?? ""} onValueChange={setPreviewEmployeeId}>
              <SelectTrigger className="w-56 bg-card">
                <SelectValue placeholder="Chọn bác sĩ..." />
              </SelectTrigger>
              <SelectContent>
                {(doctorsQuery.data ?? []).map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.full_name} {doctor.employee_code ? `(${doctor.employee_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {/* Top Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Hôm nay"
          value={stats.appointments_today}
          suffix="lịch khám"
          tone="primary"
        />
        <StatCard
          icon={Users}
          label="Tuần này"
          value={stats.appointments_week}
          suffix="cuộc hẹn"
          tone="info"
        />
        <StatCard
          icon={TrendingUp}
          label="Tần suất"
          value={stats.work_frequency_percent}
          suffix="%"
          tone="success"
        />
        <StatCard
          icon={DollarSign}
          label="Lương hiện tại"
          value={Math.round(stats.current_salary / 1000000)}
          suffix="triệu"
          tone="warning"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Profile & Attendance */}
        <div className="space-y-6 md:col-span-1">
          {/* Profile Card */}
          <Card className="surface-card p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Thông tin cá nhân</h3>
                <p className="text-sm text-muted-foreground">{displayEmail}</p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to={buildPath("/doctor/profile")}>
                  Xem chi tiết <ChevronRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </Card>

          {/* Attendance Card */}
          <Card className="surface-card p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Chấm công tháng</h3>
                <div className="flex items-center gap-2">
                  {stats.late_count_month === 0 ? (
                    <CheckCircle2 className="size-5 text-success" />
                  ) : (
                    <AlertCircle className="size-5 text-warning" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {stats.late_count_month === 0
                      ? "Không có lần đi trễ"
                      : `${stats.late_count_month} lần đi trễ`}
                  </span>
                </div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to={buildPath("/attendance/daily")}>
                  Xem chi tiết <ChevronRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column - Schedules & Salary */}
        <div className="space-y-6 md:col-span-2">
          {/* Schedule Card */}
          <Card className="surface-card p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Lịch khám hôm nay</h3>
                <p className="text-sm text-muted-foreground">
                  {stats.appointments_today} cuộc hẹn
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                  <Clock className="size-4 text-primary" />
                  <span className="text-sm text-foreground">09:00 - 17:00</span>
                </div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to={buildPath("/doctor/schedule")}>
                  Xem lịch chi tiết <ChevronRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </Card>

          {/* Salary Card */}
          <Card className="surface-card p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Thông tin lương</h3>
                <p className="text-2xl font-bold text-primary">
                  {(stats.current_salary + stats.allowance + stats.bonus).toLocaleString("vi-VN")} ₫
                </p>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>• Lương cơ bản: {stats.current_salary.toLocaleString("vi-VN")} ₫</p>
                <p>• Phụ cấp: {stats.allowance.toLocaleString("vi-VN")} ₫</p>
                <p>• Thưởng: {stats.bonus.toLocaleString("vi-VN")} ₫</p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to={buildPath("/hr/payroll")}>
                  Chi tiết lương <ChevronRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="quiet-card p-4">
          <p className="text-sm text-muted-foreground">Tổng bệnh nhân</p>
          <p className="text-3xl font-bold text-foreground">{stats.patients_total}</p>
        </Card>
        <Card className="quiet-card p-4">
          <p className="text-sm text-muted-foreground">Khám tuần này</p>
          <p className="text-3xl font-bold text-foreground">{stats.appointments_week}</p>
        </Card>
        <Card className="quiet-card p-4">
          <p className="text-sm text-muted-foreground">Tần suất làm việc</p>
          <p className="text-3xl font-bold text-foreground">{stats.work_frequency_percent}%</p>
        </Card>
      </div>

      {/* Team Roster */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UsersRound className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Đội ngũ phòng khám</h2>
        </div>

        {teamRosterQuery.isLoading ? (
          <LoadingState rows={3} />
        ) : teamRosterQuery.isError ? (
          <ErrorState description={(teamRosterQuery.error as Error).message} />
        ) : (
          <div className="space-y-6">
            {Object.entries(rosterGroups).map(([category, members]) => (
              <div key={category} className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {category}
                  <Badge variant="outline" className="font-normal">
                    {members.length}
                  </Badge>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {members.map((member) => {
                    const avatar = member.avatar_url || member.profile_photo_url;
                    return (
                      <Card key={member.id} className="quiet-card min-w-0 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold text-muted-foreground">
                            {avatar ? (
                              <img src={avatar} alt={member.full_name} className="size-full object-cover" />
                            ) : (
                              (member.full_name.charAt(0) ?? "?").toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{member.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {member.departments?.name ?? "—"}
                            </p>
                          </div>
                          {member.employment_status !== "active" && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              Tạm dừng
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 w-full justify-center text-xs"
                          onClick={() => setSelectedProfileId(member.id)}
                        >
                          Xem chi tiết <ChevronRight className="ml-1 size-3.5" />
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(selectedProfileId)} onOpenChange={(open) => !open && setSelectedProfileId(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hồ sơ nhân viên</DialogTitle>
          </DialogHeader>
          {selectedProfileId && (
            <EmployeeProfilePanel employeeId={selectedProfileId} organizationId={org.id} editable={canEditProfiles} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix: string;
  tone: "primary" | "info" | "success" | "warning";
}

function StatCard({ icon: Icon, label, value, suffix, tone }: StatCardProps) {
  const toneClasses: Record<StatCardProps["tone"], string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };

  return (
    <Card className="surface-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground">
            {value} <span className="text-sm font-normal text-muted-foreground">{suffix}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
