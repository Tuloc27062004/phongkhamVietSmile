import { createFileRoute } from "@tanstack/react-router";

/**
 * Gửi hàng loạt: nhắc lịch hẹn ngày mai cho bệnh nhân + lịch khám hôm nay cho bác sĩ,
 * cho MỌI phòng khám đã bật tích hợp Resend. Thiết kế để một scheduler bên ngoài
 * (Supabase pg_cron + pg_net, GitHub Actions cron, Vercel Cron...) gọi định kỳ (vd. mỗi giờ).
 * Không bắt buộc phải dùng — gửi thủ công qua UI (nút "Gửi nhắc nhở" / "Gửi lịch qua email")
 * vẫn hoạt động đầy đủ mà không cần endpoint này.
 *
 * POST /api/public/notifications/dispatch
 * Headers: Authorization: Bearer <NOTIFICATIONS_DISPATCH_SECRET>
 */

const TZ = "Asia/Ho_Chi_Minh";

function todayInTz(offsetDays = 0): string {
  const base = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatTimeLabel(time: string): string {
  return time.slice(0, 5);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/notifications/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedSecret = process.env["NOTIFICATIONS_DISPATCH_SECRET"];
        if (!expectedSecret) {
          return json({ error: "NOTIFICATIONS_DISPATCH_SECRET chưa được cấu hình trên server" }, 500);
        }
        const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!provided || provided !== expectedSecret) {
          return json({ error: "Unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { appointmentReminderEmail, doctorDailyScheduleEmail } = await import(
          "@/integrations/resend/templates.server"
        );
        const { sendClinicEmail } = await import("@/integrations/resend/send.server");

        const { data: enabledConfigs, error: configError } = await supabaseAdmin
          .from("clinic_resend_configs")
          .select("organization_id")
          .eq("is_enabled", true);
        if (configError) return json({ error: configError.message }, 500);

        const enabledOrgIds = (enabledConfigs ?? []).map((c) => c.organization_id);
        if (enabledOrgIds.length === 0) {
          return json({ ok: true, remindersSent: 0, remindersFailed: 0, digestsSent: 0, digestsFailed: 0, note: "Chưa có phòng khám nào bật tích hợp Resend" });
        }

        const brandCache = new Map<string, Awaited<ReturnType<typeof loadBrand>>>();
        async function loadBrand(organizationId: string) {
          const [{ data: profile }, { data: org }] = await Promise.all([
            supabaseAdmin
              .from("clinic_profiles")
              .select("name, address, hotline, footer_info, logo_url")
              .eq("organization_id", organizationId)
              .maybeSingle(),
            supabaseAdmin.from("organizations").select("name").eq("id", organizationId).single(),
          ]);
          return {
            name: profile?.name || org?.name || "Phòng khám",
            logoUrl: profile?.logo_url ?? null,
            address: profile?.address ?? null,
            hotline: profile?.hotline ?? null,
            footerNote: profile?.footer_info ?? null,
          };
        }
        async function brandFor(organizationId: string) {
          if (!brandCache.has(organizationId)) brandCache.set(organizationId, await loadBrand(organizationId));
          return brandCache.get(organizationId)!;
        }

        let remindersSent = 0;
        let remindersFailed = 0;
        let digestsSent = 0;
        let digestsFailed = 0;

        // 1) Nhắc lịch hẹn ngày mai cho bệnh nhân (chưa nhắc, chưa huỷ).
        const tomorrow = todayInTz(1);
        const { data: dueReminders, error: reminderError } = await supabaseAdmin
          .from("appointments")
          .select(
            `
            id, organization_id, appointment_date, start_time, notes,
            patient:patients!patient_id ( full_name, email ),
            doctor:employees!assigned_dentist_id ( full_name ),
            service:services ( name ),
            room:treatment_rooms ( name )
          `,
          )
          .in("organization_id", enabledOrgIds)
          .eq("appointment_date", tomorrow)
          .eq("status", "scheduled")
          .eq("reminder_sent", false);
        if (reminderError) return json({ error: reminderError.message }, 500);

        for (const apt of dueReminders ?? []) {
          const patient = apt.patient as unknown as { full_name: string; email: string | null } | null;
          if (!patient?.email) continue;

          const brand = await brandFor(apt.organization_id);
          const { subject, html } = appointmentReminderEmail({
            brand,
            patientName: patient.full_name,
            doctorName: (apt.doctor as unknown as { full_name: string } | null)?.full_name ?? "Đang cập nhật",
            serviceName: (apt.service as unknown as { name: string } | null)?.name ?? "Khám bệnh",
            dateLabel: formatDateLabel(apt.appointment_date),
            timeLabel: formatTimeLabel(apt.start_time),
            roomName: (apt.room as unknown as { name: string } | null)?.name ?? null,
            notes: apt.notes,
          });

          const result = await sendClinicEmail({
            organizationId: apt.organization_id,
            to: patient.email,
            subject,
            html,
            category: "appointment_reminder",
            relatedAppointmentId: apt.id,
          });

          if (result.ok) {
            remindersSent += 1;
            await supabaseAdmin
              .from("appointments")
              .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
              .eq("id", apt.id);
          } else {
            remindersFailed += 1;
          }
        }

        // 2) Lịch khám hôm nay cho từng bác sĩ có lịch hẹn — mỗi bác sĩ tối đa 1 email/ngày.
        const today = todayInTz(0);
        const { data: todaysAppointments, error: apptError } = await supabaseAdmin
          .from("appointments")
          .select(
            `
            organization_id, assigned_dentist_id, start_time, notes,
            patient:patients!patient_id ( full_name, phone ),
            service:services ( name ),
            doctor:employees!assigned_dentist_id ( id, full_name, email )
          `,
          )
          .in("organization_id", enabledOrgIds)
          .eq("appointment_date", today)
          .neq("status", "cancelled")
          .not("assigned_dentist_id", "is", null);
        if (apptError) return json({ error: apptError.message }, 500);

        const byDoctor = new Map<string, typeof todaysAppointments>();
        for (const apt of todaysAppointments ?? []) {
          if (!apt.assigned_dentist_id) continue;
          const list = byDoctor.get(apt.assigned_dentist_id) ?? [];
          list.push(apt);
          byDoctor.set(apt.assigned_dentist_id, list);
        }

        const dayStart = new Date(`${today}T00:00:00+07:00`).toISOString();
        for (const [employeeId, apts] of byDoctor) {
          const first = apts![0]!;
          const doctor = first.doctor as unknown as { id: string; full_name: string; email: string | null } | null;
          if (!doctor?.email) continue;

          const { data: alreadySent } = await supabaseAdmin
            .from("clinic_email_events")
            .select("id")
            .eq("category", "doctor_daily_schedule")
            .eq("related_employee_id", employeeId)
            .gte("created_at", dayStart)
            .limit(1)
            .maybeSingle();
          if (alreadySent) continue;

          const brand = await brandFor(first.organization_id);
          const { subject, html } = doctorDailyScheduleEmail({
            brand,
            doctorName: doctor.full_name,
            dateLabel: formatDateLabel(today),
            appointments: apts!
              .slice()
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((apt) => ({
                timeLabel: formatTimeLabel(apt.start_time),
                patientName: (apt.patient as unknown as { full_name: string } | null)?.full_name ?? "N/A",
                patientPhone: (apt.patient as unknown as { phone: string } | null)?.phone ?? null,
                serviceName: (apt.service as unknown as { name: string } | null)?.name ?? "Khám bệnh",
                notes: apt.notes,
              })),
          });

          const result = await sendClinicEmail({
            organizationId: first.organization_id,
            to: doctor.email,
            subject,
            html,
            category: "doctor_daily_schedule",
            relatedEmployeeId: employeeId,
          });

          if (result.ok) digestsSent += 1;
          else digestsFailed += 1;
        }

        return json({ ok: true, remindersSent, remindersFailed, digestsSent, digestsFailed });
      },
    },
  },
});
