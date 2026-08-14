// Server-only — nạp cấu hình Resend (API Key đã giải mã, from email/name) cho một phòng khám.
// Không bao giờ import file này từ code chạy trên trình duyệt.

export type ResendOrgConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

/** Trả về cấu hình Resend đã sẵn sàng dùng cho phòng khám, hoặc null nếu chưa cấu hình/chưa bật. */
export async function getResendConfigForOrg(organizationId: string): Promise<ResendOrgConfig | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("clinic_resend_configs")
    .select("api_key_ciphertext, from_email, from_name, is_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!data || !data.is_enabled || !data.api_key_ciphertext || !data.from_email) return null;

  const { decryptSecret } = await import("@/integrations/resend/crypto.server");
  const apiKey = await decryptSecret(data.api_key_ciphertext);

  return {
    apiKey,
    fromEmail: data.from_email,
    fromName: data.from_name || "Phòng khám",
  };
}
