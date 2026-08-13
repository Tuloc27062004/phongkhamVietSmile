import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export type ClinicProfile = {
  id: string;
  organization_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

export type SessionProfile = {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  organizationId: string;
  roles: AppRole[];
  approvalStatus: "pending" | "approved" | "rejected";
  isActive: boolean;
};

/** Raw Supabase session, kept in sync with auth state changes. */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, ready };
}

async function loadProfile(userId: string): Promise<SessionProfile> {
  const { error: bootstrapError } = await supabase.rpc("ensure_user_profile");
  if (bootstrapError) throw bootstrapError;

  const [{ data: profile, error: profileError }, { data: roleRows, error: rolesError }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("id, full_name, email, avatar_url, organization_id, approval_status, is_active")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

  if (profileError) throw profileError;
  if (rolesError) throw rolesError;
  if (!profile) throw new Error("Không tìm thấy hồ sơ người dùng.");

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name || profile.email || "Người dùng",
    avatarUrl: profile.avatar_url,
    organizationId: profile.organization_id,
    roles: roleRows.map((row) => row.role as AppRole),
    approvalStatus: (profile.approval_status as SessionProfile["approvalStatus"]) ?? "pending",
    isActive: profile.is_active,
  };
}

export function useSessionProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["session-profile", userId],
    enabled: Boolean(userId),
    queryFn: () => loadProfile(userId as string),
    staleTime: 60_000,
  });
}

/** The employees row linked to the current auth user, if any (doctors/staff). */
export function useCurrentEmployee(userId: string | undefined) {
  return useQuery({
    queryKey: ["current-employee", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code")
        .eq("user_id", userId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

export function useClinicProfile(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["clinic-profile", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_profiles")
        .select("*")
        .eq("organization_id", organizationId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.assign("/auth");
  };
}
