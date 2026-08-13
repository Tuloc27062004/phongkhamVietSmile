import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  Clock,
  Info,
  UserPlus,
  Users,
} from "lucide-react";

import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Bảng điều khiển — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Tổng quan hoạt động phòng khám: nhân sự, ca làm việc và cấu hình hệ thống.",
      },
      { property: "og:title", content: "Bảng điều khiển — Việt Smile Clinic Suite" },
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
  const overview = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const [employees, departments, shifts, clinic] = await Promise.all([
        supabase.from("employees").select("id, employment_status", { count: "exact" }).is("deleted_at", null),
        supabase.from("departments").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("shifts").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("clinic_profiles").select("name, working_hours, weekly_days_off").maybeSingle(),
      ]);

      if (employees.error) throw employees.error;
      if (departments.error) throw departments.error;
      if (shifts.error) throw shifts.error;
      if (clinic.error) throw clinic.error;

      const active = (employees.data ?? []).filter((row) => row.employment_status === "active").length;

      return {
        employeeCount: employees.count ?? 0,
        activeEmployees: active,
        departmentCount: departments.count ?? 0,
        shiftCount: shifts.count ?? 0,
        clinic: clinic.data,
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
            <Button variant="outline" disabled>
              <CalendarClock className="mr-2 size-4" />
              Tạo lịch hẹn
            </Button>
            <Button disabled>
              <UserPlus className="mr-2 size-4" />
              Thêm nhân viên
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
              <h2 className="text-base font-semibold">Lộ trình triển khai</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Giai đoạn 1 đã hoàn tất. Các số liệu vận hành hằng ngày sẽ xuất hiện tại đây khi các
                giai đoạn tiếp theo được bật.
              </p>
              <ol className="mt-4 space-y-3 text-sm">
                {[
                  ["Giai đoạn 1", "Nền tảng, đăng nhập, phân quyền, hồ sơ phòng khám", true],
                  ["Giai đoạn 2", "Quản lý nhân viên, phòng ban, chức danh, ca làm việc", false],
                  ["Giai đoạn 3", "Chấm công, bảng công tháng, điều chỉnh công, Excel", false],
                  ["Giai đoạn 4", "Agent đồng bộ máy chấm công trên Windows", false],
                  ["Giai đoạn 5-7", "Lịch hẹn, nhắc lịch, báo cáo và hoàn thiện", false],
                ].map(([phase, text, done]) => (
                  <li key={phase as string} className="flex items-start gap-3">
                    <Badge variant={done ? "default" : "secondary"}>{phase as string}</Badge>
                    <span className="text-muted-foreground">{text as string}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="surface-card p-6">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Info className="size-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold">Chưa có dữ liệu chấm công</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Máy chấm công chưa được kết nối. Dữ liệu đi trễ, về sớm và tăng ca sẽ hiển thị sau
                khi hoàn tất giai đoạn 3 và 4.
              </p>
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
