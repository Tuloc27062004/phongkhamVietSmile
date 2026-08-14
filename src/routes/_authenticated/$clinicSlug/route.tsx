import { createFileRoute, notFound, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { PermissionDenied } from "@/components/page-state";
import { loadProfile, useClinicProfile } from "@/hooks/use-session";
import { hasAnyRole, routeRoles } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/$clinicSlug")({
  beforeLoad: async ({ params, context, location }) => {
    const org = await context.queryClient.ensureQueryData({
      queryKey: ["org-by-slug", params.clinicSlug],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_organization_by_slug", {
          p_slug: params.clinicSlug,
        });
        if (error) throw error;
        return data?.[0] ?? null;
      },
      staleTime: 60_000,
    });

    if (!org || !org.is_active) throw notFound();

    const profile = await context.queryClient.ensureQueryData({
      queryKey: ["session-profile", context.user.id],
      queryFn: () => loadProfile(context.user.id),
      staleTime: 60_000,
    });

    const isSuperAdmin = await context.queryClient.ensureQueryData({
      queryKey: ["is-super-admin", context.user.id],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("is_super_admin");
        if (error) throw error;
        return Boolean(data);
      },
      staleTime: Infinity,
    });

    if (isSuperAdmin) {
      // Keep current_org_id() (RLS) in sync with whatever slug is in the URL, regardless
      // of how the user got here (typed URL, bookmark, or the workspace switcher).
      await context.queryClient.ensureQueryData({
        queryKey: ["super-admin-switch", context.user.id, params.clinicSlug],
        queryFn: async () => {
          const { error } = await supabase.rpc("super_admin_switch_clinic_by_slug", {
            p_slug: params.clinicSlug,
          });
          if (error) throw error;
          return true;
        },
        staleTime: Infinity,
      });
    } else if (profile.organizationId !== org.id) {
      const { data: homeOrg } = await supabase
        .from("organizations")
        .select("slug")
        .eq("id", profile.organizationId)
        .maybeSingle();

      if (!homeOrg?.slug) throw notFound();

      const suffix = location.pathname.slice(`/${params.clinicSlug}`.length) || "/dashboard";
      throw redirect({ href: `/${homeOrg.slug}${suffix}` });
    }

    return { org, profile, isSuperAdmin };
  },
  component: ClinicLayout,
});

function ClinicLayout() {
  const { org, profile, isSuperAdmin } = Route.useRouteContext();
  const clinicQuery = useClinicProfile(org.id);
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const relativePath = pathname.slice(`/${org.slug}`.length) || "/";

  const allowed = routeRoles(relativePath);
  const permitted = allowed === null || hasAnyRole(profile.roles, allowed);

  return (
    <AppShell
      profile={profile}
      clinicName={clinicQuery.data?.short_name ?? clinicQuery.data?.name ?? org.name}
      logoUrl={clinicQuery.data?.logo_url ?? null}
      isSuperAdmin={isSuperAdmin}
    >
      {permitted ? <Outlet /> : <PermissionDenied />}
    </AppShell>
  );
}
