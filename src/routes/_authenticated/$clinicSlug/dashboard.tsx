import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  UserPlus,
  Users,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { useClinicPath } from "@/hooks/use-clinic-path";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug/dashboard")({
  head: () => ({
    meta: [
      { title: "Bảng điều khiển — GZV Clinic Platform" },
      {
        name: "description",
        content: "Tổng quan hoạt động phòng khám: nhân sự, ca làm việc và cấu hình hệ thống.",
      },
      { property: "og:title", content: "Bảng điều khiển — GZV Clinic Platform" },
      { property: "og:description", content: "Tổng quan hoạt động phòng khám nha khoa." },
    ],
  }),
  component: DashboardPage,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

const dateLabel = () =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

function DashboardPage() {
  const buildPath = useClinicPath();
  const overview = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0] ?? "";
      const [employees, departments, shifts, clinic, todayAttendance] = await Promise.all([
        supabase.from("employees").select("id, employment_status", { count: "exact" }).is("deleted_at", null),
        supabase.from("departments").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("shifts").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("clinic_profiles").select("name, working_hours, weekly_days_off").maybeSingle(),
        supabase
          .from("attendance_records")
          .select("attendance_status", { count: "exact" })
          .eq("work_date", today),
      ]);

      if (employees.error) throw employees.error;
      if (departments.error) throw departments.error;
      if (shifts.error) throw shifts.error;
      if (clinic.error) throw clinic.error;
      if (todayAttendance.error) throw todayAttendance.error;

      const active = (employees.data ?? []).filter((row) => row.employment_status === "active").length;
      const presentToday = (todayAttendance.data ?? []).filter(
        (row) => row.attendance_status !== "absent",
      ).length;

      return {
        employeeCount: employees.count ?? 0,
        activeEmployees: active,
        departmentCount: departments.count ?? 0,
        shiftCount: shifts.count ?? 0,
        clinic: clinic.data,
        attendanceToday: todayAttendance.count ?? 0,
        presentToday,
      };
    },
  });

  return (
    <div>
      <PageHeader
        title={`${greeting()}!`}
        description={`${dateLabel()} • ${overview.data?.clinic?.name ?? "Phòng khám"}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={buildPath("/appointments/booking")}>
                <CalendarClock className="mr-2 size-4" />
                Tạo lịch hẹn
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={buildPath("/employees")}>
                <UserPlus className="mr-2 size-4" />
                Thêm nhân viên
              </Link>
            </Button>
          </>
        }
      />

      {overview.isLoading ? (
        <LoadingState rows={2} />
      ) : overview.isError || !overview.data ? (
        <ErrorState description={(overview.error as Error | null)?.message} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Users className="size-5" />}
              label="Nhân viên"
              value={overview.data.employeeCount}
              hint={`${overview.data.activeEmployees} đang làm việc`}
            />
            <StatCard
              icon={<Building2 className="size-5" />}
              label="Phòng ban"
              value={overview.data.departmentCount}
              hint="Cơ cấu tổ chức phòng khám"
            />
            <StatCard
              icon={<Clock className="size-5" />}
              label="Ca làm việc"
              value={overview.data.shiftCount}
              hint={overview.data.clinic?.working_hours ?? "Chưa cấu hình giờ làm"}
            />
            <StatCard
              icon={<CalendarClock className="size-5" />}
              label="Ngày nghỉ tuần"
              value={overview.data.clinic?.weekly_days_off ?? "—"}
              hint="Theo hồ sơ phòng khám"
            />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="surface-card p-6 lg:col-span-2">
              <h2 className="text-base font-semibold">Truy cập nhanh</h2>
              <p className="mt-1 text-sm text-muted-foreground">Các tác vụ thường dùng hằng ngày.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button variant="outline" className="justify-start" asChild>
                  <Link to={buildPath("/appointments/calendar")}>
                    <CalendarClock className="mr-2 size-4" />
                    Lịch khám hôm nay
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link to={buildPath("/patients")}>
                    <Users className="mr-2 size-4" />
                    Quản lý bệnh nhân
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link to={buildPath("/employees")}>
                    <Building2 className="mr-2 size-4" />
                    Danh bạ nhân viên
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start" asChild>
                  <Link to={buildPath("/hr/payroll")}>
                    <Clock className="mr-2 size-4" />
                    Tính lương
                  </Link>
                </Button>
              </div>
            </div>

            <div className="surface-card p-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <CheckCircle2 className="size-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold">Chấm công hôm nay</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {overview.data && overview.data.attendanceToday > 0
                  ? `${overview.data.presentToday}/${overview.data.attendanceToday} nhân viên đã có mặt hôm nay.`
                  : "Chưa có bản ghi chấm công cho hôm nay."}
              </p>
              <Button variant="outline" size="sm" className="mt-4" asChild>
                <Link to={buildPath("/attendance/daily")}>Xem chi tiết chấm công</Link>
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <article className="surface-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}
