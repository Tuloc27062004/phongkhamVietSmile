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
  if (!data) throw new Error("Chỉ quản trị viên mới được cấu hình gửi email");
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

/** Trạng thái cấu hình Resend — KHÔNG bao giờ trả API Key ra ngoài, chỉ trả đã cấu hình hay chưa. */
export const getResendConfigStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const organizationId = await getOrganizationId(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("clinic_resend_configs")
      .select("from_email, from_name, is_enabled, api_key_ciphertext, updated_at")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    return {
      fromEmail: data?.from_email ?? "",
      fromName: data?.from_name ?? "",
      isEnabled: data?.is_enabled ?? false,
      hasApiKey: Boolean(data?.api_key_ciphertext),
      updatedAt: data?.updated_at ?? null,
    };
  });

export const saveResendConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        apiKey: z.string().trim().max(500).optional(),
        fromEmail: z.string().trim().email("Email gửi đi không hợp lệ").max(200),
        fromName: z.string().trim().min(1, "Vui lòng nhập tên hiển thị người gửi").max(200),
        isEnabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const organizationId = await getOrganizationId(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("clinic_resend_configs")
      .select("api_key_ciphertext")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (!data.apiKey && !existing?.api_key_ciphertext) {
      throw new Error("Vui lòng nhập API Key của Resend");
    }

    let apiKeyCiphertext = existing?.api_key_ciphertext ?? null;
    if (data.apiKey) {
      const { encryptSecret } = await import("@/integrations/resend/crypto.server");
      apiKeyCiphertext = await encryptSecret(data.apiKey);
    }

    const { error } = await supabaseAdmin.from("clinic_resend_configs").upsert(
      {
        organization_id: organizationId,
        api_key_ciphertext: apiKeyCiphertext,
        from_email: data.fromEmail,
        from_name: data.fromName,
        is_enabled: data.isEnabled,
        updated_by: context.userId,
      },
      { onConflict: "organization_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const sendResendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        to: z.string().trim().email("Email nhận không hợp lệ"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const organizationId = await getOrganizationId(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("clinic_profiles")
      .select("name, address, hotline, footer_info, logo_url")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();
    if (orgError) throw new Error(orgError.message);

    const { testEmail } = await import("@/integrations/resend/templates.server");
    const { sendClinicEmail } = await import("@/integrations/resend/send.server");

    const brand = {
      name: profile?.name || org.name,
      logoUrl: profile?.logo_url ?? null,
      address: profile?.address ?? null,
      hotline: profile?.hotline ?? null,
      footerNote: profile?.footer_info ?? null,
    };
    const { subject, html } = testEmail(brand);

    const result = await sendClinicEmail({
      organizationId,
      to: data.to,
      subject,
      html,
      category: "test",
    });

    if (!result.ok) {
      const message =
        result.reason === "not_configured"
          ? "Chưa lưu cấu hình hoặc chưa bật tích hợp Resend. Hãy lưu và bật trước khi gửi thử."
          : `Gửi email thất bại: ${result.error}`;
      throw new Error(message);
    }

    return { ok: true };
  });
