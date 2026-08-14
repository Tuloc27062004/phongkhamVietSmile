import { useParams, useRouterState } from "@tanstack/react-router";

/** Prepends the current clinic's slug to a slug-agnostic app path, e.g. "/dashboard" -> "/nha-khoa-ct/dashboard". */
export function useClinicPath() {
  const { clinicSlug } = useParams({ from: "/_authenticated/$clinicSlug" });
  return (path: string) => `/${clinicSlug}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The current pathname with the clinic slug prefix stripped, for comparing against NAV_GROUPS' slug-agnostic `to` strings. */
export function useClinicRelativePath(): string {
  const { clinicSlug } = useParams({ from: "/_authenticated/$clinicSlug" });
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  return pathname.slice(`/${clinicSlug}`.length) || "/";
}
