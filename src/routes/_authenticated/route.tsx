import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Hourglass, Loader2, ShieldX } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ErrorState, PermissionDenied } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import {
  useAuthSession,
  useClinicProfile,
  useSessionProfile,
  useSignOut,
} from "@/hooks/use-session";
import { hasAnyRole, routeRoles } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-5 animate-spin text-primary" />
    </div>
  );
}

function AuthenticatedLayout() {
  const { session, ready } = useAuthSession();
  const profileQuery = useSessionProfile(session?.user.id);
  const clinicQuery = useClinicProfile(profileQuery.data?.organizationId);
  const pathname = useRouterState({ select: (router) => router.location.pathname });

  if (!ready || profileQuery.isLoading) return <FullPageLoader />;

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-lg">
          <ErrorState
            title="Không tải được hồ sơ người dùng"
            description={
              profileQuery.error instanceof Error
                ? profileQuery.error.message
                : "Vui lòng tải lại trang hoặc đăng nhập lại."
            }
          />
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;

  if (profile.approvalStatus !== "approved" || !profile.isActive) {
    return <AccountPendingScreen status={profile.approvalStatus} active={profile.isActive} />;
  }

  const allowed = routeRoles(pathname);
  const permitted = allowed === null || hasAnyRole(profile.roles, allowed);

  return (
    <AppShell
      profile={profile}
      clinicName={clinicQuery.data?.short_name ?? clinicQuery.data?.name ?? "Phòng khám"}
      logoUrl={clinicQuery.data?.logo_url ?? null}
    >
      {permitted ? <Outlet /> : <PermissionDenied />}
    </AppShell>
  );
}

function AccountPendingScreen({
  status,
  active,
}: {
  status: "pending" | "approved" | "rejected";
  active: boolean;
}) {
  const signOut = useSignOut();
  const rejected = status === "rejected";
  const locked = status === "approved" && !active;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="surface-card w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          {rejected || locked ? (
            <ShieldX className="size-7 text-destructive" />
          ) : (
            <Hourglass className="size-7 text-primary" />
          )}
        </div>
        <h1 className="mt-4 text-xl font-semibold">
          {rejected
            ? "Yêu cầu truy cập đã bị từ chối"
            : locked
              ? "Tài khoản đang bị tạm khóa"
              : "Tài khoản đang chờ duyệt"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rejected
            ? "Quản trị viên đã từ chối tài khoản này. Vui lòng liên hệ quản lý phòng khám nếu bạn cho rằng đây là nhầm lẫn."
            : locked
              ? "Vui lòng liên hệ quản trị viên để mở lại quyền truy cập."
              : "Quản trị viên cần duyệt tài khoản và phân vai trò trước khi bạn có thể sử dụng hệ thống. Vui lòng đăng nhập lại sau khi được duyệt."}
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => void signOut()}>
          Đăng xuất
        </Button>
      </div>
    </div>
  );
}

