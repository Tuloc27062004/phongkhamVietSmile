import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export type SuperAdminClinic = {
  id: string;
  name: string;
  code: string | null;
  slug: string;
  clinic_category: string;
  clinic_category_label: string;
  max_employees: number;
  max_doctors: number;
  max_devices: number;
  employee_count: number;
  doctor_count: number;
  device_count: number;
  is_active_workspace: boolean;
};

/** All clinics visible to a Super Admin, grouped/labeled by specialty. Empty for non-super-admins. */
export function useSuperAdminClinics(enabled: boolean) {
  return useQuery({
    queryKey: ["super-admin-clinics-taxonomy"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_admin_list_clinics_taxonomy");
      if (error) throw error;
      return (data ?? []) as SuperAdminClinic[];
    },
  });
}

/** Switches the Super Admin's active clinic workspace and navigates the URL to match. */
export function useSwitchClinic() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ slug, subpath }: { slug: string; subpath: string }) => {
      const { error } = await supabase.rpc("super_admin_switch_clinic_by_slug", { p_slug: slug });
      if (error) throw error;
      return { slug, subpath };
    },
    onSuccess: ({ slug, subpath }) => {
      toast.success("Đã chuyển đổi không gian làm việc phòng khám thành công!");
      void queryClient.invalidateQueries();
      void navigate({ to: `/${slug}${subpath}` });
    },
    onError: (err: Error) => {
      toast.error(`Không thể chuyển phòng khám: ${err.message}`);
    },
  });
}
