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

  const infraQuery = useQuery({
    queryKey: ["admin-infra-status"],
    queryFn: async () => {
      const [devices, lastSync] = await Promise.all([
        supabase.from("devices").select("id, is_active, status"),
        supabase
          .from("device_sync_logs")
          .select("status, started_at")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (devices.error) throw devices.error;
      if (lastSync.error) throw lastSync.error;

      const rows = devices.data ?? [];
      return {
        deviceTotal: rows.length,
        deviceOnline: rows.filter((d) => d.is_active && d.status === "online").length,
        lastSyncAt: lastSync.data?.started_at ?? null,
        lastSyncStatus: lastSync.data?.status ?? null,
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
        <Card className="brand-gradient border-0 p-4 text-primary-foreground shadow-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 text-primary-foreground backdrop-blur-md">
                <Building2 className="size-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary-foreground/70">
                    GZV CLINIC PLATFORM — CONTROL CENTER
                  </span>
                  <Badge variant="outline" className="border-white/25 text-primary-foreground/90 text-[10px]">
                    Super Admin Center
                  </Badge>
                </div>
                <h2 className="text-lg font-bold text-primary-foreground flex items-center gap-2">
                  <span>{CATEGORY_ICONS[currentWorkspace?.clinic_category || "general"]}</span>
                  <span>Đang quản lý: {currentWorkspace?.name || "GZV Central Hub"}</span>
                  <span className="text-xs font-normal text-primary-foreground/60">({currentWorkspace?.clinic_category_label})</span>
                </h2>
              </div>
            </div>

            {clinicsQuery.data.length > 1 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-primary-foreground/70 whitespace-nowrap">Chọn Chi Nhánh / Chuyên Khoa:</span>
                <Select
                  value={currentWorkspace?.slug ?? ""}
                  onValueChange={(slug) => switchClinic.mutate({ slug, subpath: "/admin/dashboard" })}
                  disabled={switchClinic.isPending}
                >
                  <SelectTrigger className="w-[300px] border-white/20 bg-black/15 text-primary-foreground font-medium">
                    <SelectValue placeholder="Chọn phòng khám..." />
                  </SelectTrigger>
                  <SelectContent className="bg-navy border-white/10 text-navy-foreground max-h-[400px]">
                    {Object.entries(groupedClinics).map(([categoryLabel, clinics]) => (
                      <div key={categoryLabel} className="px-2 py-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-navy-foreground/60 mb-1 border-b border-white/10 pb-1">
                          {categoryLabel}
                        </div>
                        {clinics.map((clinic) => (
                          <SelectItem
                            key={clinic.id}
                            value={clinic.slug}
                            className="focus:bg-primary focus:text-primary-foreground cursor-pointer py-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span>{clinic.name}</span>
                              <span className="text-[10px] text-navy-foreground/60">({clinic.code})</span>
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
        <Card className="surface-card md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-foreground">Chấm công hôm nay</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-sm text-muted-foreground">Đã chấm công</span>
                <span className="font-semibold text-primary">{stats.attendance_today}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-sm text-muted-foreground">Đi trễ</span>
                <span className="font-semibold text-warning-foreground">{stats.late_today}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span className="text-sm text-muted-foreground">Vắng</span>
                <span className="font-semibold text-destructive">{stats.absent_today}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to={buildPath("/attendance/daily")}>Chi tiết chấm công</Link>
            </Button>
          </div>
        </Card>

        {/* Quick Management Actions */}
        <Card className="surface-card md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-foreground">Quản trị chuyên môn</h3>
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

        {/* Device connectivity — real data, not decorative status */}
        <Card className="surface-card md:col-span-1">
          <div className="space-y-4 p-6">
            <h3 className="font-semibold text-foreground">Máy chấm công phần cứng</h3>
            {infraQuery.isLoading ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {(infraQuery.data?.deviceOnline ?? 0) > 0 ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <ShieldAlert className="size-4 text-warning" />
                  )}
                  <span className="text-sm text-foreground">
                    {infraQuery.data?.deviceOnline ?? 0}/{infraQuery.data?.deviceTotal ?? 0} thiết bị đang trực tuyến
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="text-sm text-foreground">
                    Đồng bộ gần nhất:{" "}
                    {infraQuery.data?.lastSyncAt
                      ? `${new Date(infraQuery.data.lastSyncAt).toLocaleString("vi-VN")} (${infraQuery.data.lastSyncStatus})`
                      : "Chưa có lần đồng bộ nào"}
                  </span>
                </div>
              </div>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link to={buildPath("/system/sync")}>Xem chi tiết đồng bộ</Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Super Admin Detailed Clinic Management Table */}
      <Card className="quiet-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              <span>Danh Sách & Quản Lý Chi Tiết Tất Cả Các Phòng Khám</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Super Admin GZV Platform: Theo dõi giới hạn nhân sự, bác sĩ, thiết bị máy chấm công và vai trò các phòng khám khách hàng.
            </p>
          </div>
          <CreateClinicDialog />
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
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
            <tbody className="divide-y divide-border">
              {(clinicsQuery.data || []).map((clinic) => (
                <tr key={clinic.id} className={clinic.is_active_workspace ? "bg-primary/5 font-medium" : "hover:bg-muted/50"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{CATEGORY_ICONS[clinic.clinic_category || "general"]}</span>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{clinic.name}</span>
                          {clinic.is_active_workspace && (
                            <Badge className="bg-primary text-[10px] py-0 px-1.5">Đang làm việc</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                      {clinic.code}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {clinic.clinic_category_label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-foreground">{clinic.employee_count}</span> / <span className="text-muted-foreground">{clinic.max_employees || 50}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-foreground">{clinic.doctor_count}</span> / <span className="text-muted-foreground">{clinic.max_doctors || 20}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-foreground">{clinic.device_count}</span> / <span className="text-muted-foreground">{clinic.max_devices || 10}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {clinic.is_active_workspace ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success font-semibold">
                        <span className="size-2 rounded-full bg-success"></span> Đang hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="size-2 rounded-full bg-muted-foreground/40"></span> Sẵn sàng
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!clinic.is_active_workspace && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-primary border-primary/25 hover:bg-primary/5"
                          onClick={() =>
                            switchClinic.mutate({ slug: clinic.slug, subpath: "/admin/dashboard" })
                          }
                          disabled={switchClinic.isPending}
                        >
                          Vào Kiểm Tra Dữ Liệu
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" asChild>
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
  const toneClasses: Record<string, string> = {
    blue: "bg-primary/10 text-primary",
    purple: "bg-info/10 text-info",
    green: "bg-success/10 text-success",
    emerald: "bg-warning/10 text-warning",
  };

  return (
    <Card className="lift-card p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {value}
            </span>
            {suffix && <span className="text-lg font-semibold text-muted-foreground">{suffix}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>
        <div className={`rounded-xl p-3 ${toneClasses[color]}`}>
          <Icon className="size-6" />
        </div>
      </div>
    </Card>
  );
}
