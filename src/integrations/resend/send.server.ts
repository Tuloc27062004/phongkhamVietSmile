// Server-only — gửi email qua Resend cho một phòng khám cụ thể, và ghi lại nhật ký gửi.
// Không bao giờ throw ra ngoài: lỗi gửi email không được phép làm hỏng luồng nghiệp vụ chính
// (đặt lịch, xác nhận...) — chỉ ghi log 'failed' và trả về { ok: false }.
// Không bao giờ import file này từ code chạy trên trình duyệt.

export type EmailCategory = "appointment_confirmation" | "appointment_reminder" | "doctor_daily_schedule" | "test";

export type SendClinicEmailInput = {
  organizationId: string;
  to: string;
  subject: string;
  html: string;
  category: EmailCategory;
  relatedAppointmentId?: string | null;
  relatedEmployeeId?: string | null;
};

export type SendClinicEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; reason: "not_configured" | "send_failed"; error?: string };

export async function sendClinicEmail(input: SendClinicEmailInput): Promise<SendClinicEmailResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getResendConfigForOrg } = await import("@/integrations/resend/client.server");

  const config = await getResendConfigForOrg(input.organizationId);
  if (!config) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(config.apiKey);

    const { data, error } = await resend.emails.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (error) {
      await supabaseAdmin.from("clinic_email_events").insert({
        organization_id: input.organizationId,
        category: input.category,
        to_email: input.to,
        subject: input.subject,
        related_appointment_id: input.relatedAppointmentId ?? null,
        related_employee_id: input.relatedEmployeeId ?? null,
        status: "failed",
        error_message: error.message,
      });
      return { ok: false, reason: "send_failed", error: error.message };
    }

    await supabaseAdmin.from("clinic_email_events").insert({
      organization_id: input.organizationId,
      category: input.category,
      to_email: input.to,
      subject: input.subject,
      related_appointment_id: input.relatedAppointmentId ?? null,
      related_employee_id: input.relatedEmployeeId ?? null,
      status: "sent",
      provider_message_id: data?.id ?? null,
    });
    return { ok: true, messageId: data?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin.from("clinic_email_events").insert({
      organization_id: input.organizationId,
      category: input.category,
      to_email: input.to,
      subject: input.subject,
      related_appointment_id: input.relatedAppointmentId ?? null,
      related_employee_id: input.relatedEmployeeId ?? null,
      status: "failed",
      error_message: message,
    });
    return { ok: false, reason: "send_failed", error: message };
  }
}
