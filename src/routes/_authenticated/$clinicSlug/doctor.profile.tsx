import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, ChevronRight, FileText } from "lucide-react";

import { EmployeeProfilePanel } from "@/components/employee-profile-panel";
import { ErrorState, LoadingState, PageHeader } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useClinicPath } from "@/hooks/use-clinic-path";
import { useAuthSession, useCurrentEmployee, useSessionProfile } from "@/hooks/use-session";
import { hasAnyRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/$clinicSlug/doctor/profile")({
  head: () => ({
    meta: [
      { title: "Hồ sơ cá nhân — GZV Clinic Platform" },
      { name: "description", content: "Thông tin chi tiết bác sĩ" },
    ],
  }),
  component: DoctorProfile,
});

function DoctorProfile() {
  const { session } = useAuthSession();
  const { org } = Route.useRouteContext();
  const buildPath = useClinicPath();
  const profileQuery = useSessionProfile(session?.user.id);
  const employeeQuery = useCurrentEmployee(session?.user.id);
  const canEdit = hasAnyRole(profileQuery.data?.roles ?? [], ["administrator", "manager"]);

  if (profileQuery.isLoading || employeeQuery.isLoading) {
    return <LoadingState rows={3} />;
  }

  if (profileQuery.isError || employeeQuery.isError) {
    return <ErrorState description={(profileQuery.error || employeeQuery.error)?.message} />;
  }

  if (!employeeQuery.data) {
    return (
      <ErrorState description="Tài khoản này chưa được liên kết với hồ sơ nhân viên. Liên hệ quản trị viên để gắn hồ sơ nhân viên (employees.user_id)." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Hồ sơ cá nhân" description="Thông tin chi tiết của bạn tại phòng khám" />

      <Card className="border-0 shadow-lg">
        <div className="p-6">
          <EmployeeProfilePanel employeeId={employeeQuery.data.id} organizationId={org.id} editable={canEdit} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Button className="h-14 text-base" variant="outline" asChild>
          <Link to={buildPath("/doctor/schedule")}>
            <Calendar className="mr-2 size-4" />
            Xem lịch khám
            <ChevronRight className="ml-2 size-4" />
          </Link>
        </Button>
        <Button className="h-14 text-base" variant="outline" asChild>
          <Link to={buildPath("/hr/payroll")}>
            <FileText className="mr-2 size-4" />
            Xem lương
            <ChevronRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
