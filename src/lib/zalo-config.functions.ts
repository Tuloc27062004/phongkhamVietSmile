import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AuthedContext = { supabase: any; userId: string };

async function assertAdmin(context: AuthedContext) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "administrator",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Chỉ quản trị viên mới được cấu hình đăng nhập Zalo");
}

async function getOrganizationId(context: AuthedContext): Promise<string> {
  const { data, error } = await context.supabase
    .from("user_profiles")
    .select("organization_id")
    .eq("id", context.userId)
    .single();
  if (error) throw new Error(error.message);
  return data.organization_id as string;
}

/** Trạng thái cấu hình Zalo — KHÔNG bao giờ trả App Secret ra ngoài, chỉ trả đã cấu hình hay chưa. */
export const getZaloConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const organizationId = await getOrganizationId(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("clinic_zalo_configs")
      .select("app_id, is_enabled, app_secret_ciphertext, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return {
      appId: data?.app_id ?? "",
      isEnabled: data?.is_enabled ?? false,
      hasSecret: Boolean(data?.app_secret_ciphertext),
      updatedAt: data?.updated_at ?? null,
    };
  });

export const saveZaloConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        appId: z.string().trim().min(1, "Vui lòng nhập App ID").max(200),
        appSecret: z.string().trim().max(500).optional(),
        isEnabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const organizationId = await getOrganizationId(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("clinic_zalo_configs")
      .select("app_secret_ciphertext")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (!data.appSecret && !existing?.app_secret_ciphertext) {
      throw new Error("Vui lòng nhập App Secret");
    }

    let appSecretCiphertext = existing?.app_secret_ciphertext ?? null;
    if (data.appSecret) {
      const { encryptSecret } = await import("@/integrations/zalo/crypto.server");
      appSecretCiphertext = await encryptSecret(data.appSecret);
    }

    const { error } = await supabaseAdmin.from("clinic_zalo_configs").upsert(
      {
        organization_id: organizationId,
        app_id: data.appId,
        app_secret_ciphertext: appSecretCiphertext,
        is_enabled: data.isEnabled,
        updated_by: context.userId,
      },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  });
