import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ClinicBrand } from "@/integrations/resend/templates.server";

type AuthedContext = { supabase: any; userId: string };

function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatTimeLabel(time: string): string {
  return time.slice(0, 5);
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

async function getClinicBrand(organizationId: string): Promise<ClinicBrand> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

type AppointmentDetail = {
  id: string;
  organization_id: string;
  appointment_date: string;
  start_time: string;
  notes: string | null;
  patient: { full_name: string; email: string | null } | null;
  doctor: { id: string; full_name: string; email: string | null } | null;
  service: { name: string } | null;
  room: { name: string } | null;
};

async function loadAppointment(context: AuthedContext, appointmentId: string): Promise<AppointmentDetail> {
  const { data, error } = await context.supabase
    .from("appointments")
    .select(
      `
      id,
      organization_id,
      appointment_date,
      start_time,
      notes,
      patient:patients!patient_id ( full_name, email ),
      doctor:employees!assigned_dentist_id ( id, full_name, email ),
      service:services ( name ),
      room:treatment_rooms ( name )
    `,
    )
    .eq("id", appointmentId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as AppointmentDetail;
}

const appointmentInput = (input: unknown) =>
  z.object({ appointmentId: z.string().uuid() }).parse(input);

/** Gửi email xác nhận lịch hẹn cho bệnh nhân — gọi ngay sau khi tạo lịch hẹn. */
export const sendAppointmentConfirmationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(appointmentInput)
  .handler(async ({ data, context }) => {
    const appointment = await loadAppointment(context, data.appointmentId);
    if (!appointment.patient?.email) {
      return { ok: false as const, reason: "no_patient_email" as const };
    }

    const brand = await getClinicBrand(appointment.organization_id);
    const { appointmentConfirmationEmail } = await import("@/integrations/resend/templates.server");
    const { sendClinicEmail } = await import("@/integrations/resend/send.server");

    const { subject, html } = appointmentConfirmationEmail({
      brand,
      patientName: appointment.patient.full_name,
      doctorName: appointment.doctor?.full_name ?? "Đang cập nhật",
      serviceName: appointment.service?.name ?? "Khám bệnh",
      dateLabel: formatDateLabel(appointment.appointment_date),
      timeLabel: formatTimeLabel(appointment.start_time),
      roomName: appointment.room?.name ?? null,
      notes: appointment.notes,
    });

    const result = await sendClinicEmail({
      organizationId: appointment.organization_id,
      to: appointment.patient.email,
      subject,
      html,
      category: "appointment_confirmation",
      relatedAppointmentId: appointment.id,
    });

    return result.ok
      ? { ok: true as const }
      : { ok: false as const, reason: result.reason, error: "error" in result ? result.error : undefined };
  });

/** Gửi email nhắc lịch hẹn cho bệnh nhân, đồng thời đánh dấu reminder_sent trên lịch hẹn. */
export const sendAppointmentReminderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(appointmentInput)
  .handler(async ({ data, context }) => {
    const appointment = await loadAppointment(context, data.appointmentId);
    if (!appointment.patient?.email) {
      return { ok: false as const, reason: "no_patient_email" as const };
    }

    const brand = await getClinicBrand(appointment.organization_id);
    const { appointmentReminderEmail } = await import("@/integrations/resend/templates.server");
    const { sendClinicEmail } = await import("@/integrations/resend/send.server");

    const { subject, html } = appointmentReminderEmail({
      brand,
      patientName: appointment.patient.full_name,
      doctorName: appointment.doctor?.full_name ?? "Đang cập nhật",
      serviceName: appointment.service?.name ?? "Khám bệnh",
      dateLabel: formatDateLabel(appointment.appointment_date),
      timeLabel: formatTimeLabel(appointment.start_time),
      roomName: appointment.room?.name ?? null,
      notes: appointment.notes,
    });

    const result = await sendClinicEmail({
      organizationId: appointment.organization_id,
      to: appointment.patient.email,
      subject,
      html,
      category: "appointment_reminder",
      relatedAppointmentId: appointment.id,
    });

    if (result.ok) {
      await context.supabase
        .from("appointments")
        .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
        .eq("id", appointment.id);
      return { ok: true as const };
    }
    return { ok: false as const, reason: result.reason, error: "error" in result ? result.error : undefined };
  });

/** Gửi lịch khám trong ngày cho bác sĩ qua email — bác sĩ tự gửi cho chính mình, hoặc admin/manager gửi thay. */
export const sendDoctorScheduleEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        employeeId: z.string().uuid(),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: employee, error: employeeError } = await context.supabase
      .from("employees")
      .select("id, user_id, full_name, email, organization_id")
      .eq("id", data.employeeId)
      .single();
    if (employeeError) throw new Error(employeeError.message);

    const isSelf = employee.user_id === context.userId;
    if (!isSelf) {
      const { data: isStaff, error: roleError } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "administrator",
      });
      if (roleError) throw new Error(roleError.message);
      const { data: isManager } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "manager",
      });
      if (!isStaff && !isManager) {
        throw new Error("Bạn không có quyền gửi lịch khám của nhân viên này");
      }
    }

    if (!employee.email) {
      return { ok: false as const, reason: "no_doctor_email" as const };
    }

    const targetDate = data.date ?? (new Date().toISOString().split("T")[0] as string);

    const { data: appointments, error: apptError } = await context.supabase
      .from("appointments")
      .select(
        `
        start_time,
        notes,
        patient:patients!patient_id ( full_name, phone ),
        service:services ( name )
      `,
      )
      .eq("assigned_dentist_id", data.employeeId)
      .eq("appointment_date", targetDate)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });
    if (apptError) throw new Error(apptError.message);

    const brand = await getClinicBrand(employee.organization_id);
    const { doctorDailyScheduleEmail } = await import("@/integrations/resend/templates.server");
    const { sendClinicEmail } = await import("@/integrations/resend/send.server");

    const { subject, html } = doctorDailyScheduleEmail({
      brand,
      doctorName: employee.full_name,
      dateLabel: formatDateLabel(targetDate),
      appointments: (appointments ?? []).map((apt: any) => ({
        timeLabel: formatTimeLabel(apt.start_time),
        patientName: apt.patient?.full_name ?? "N/A",
        patientPhone: apt.patient?.phone ?? null,
        serviceName: apt.service?.name ?? "Khám bệnh",
        notes: apt.notes,
      })),
    });

    const result = await sendClinicEmail({
      organizationId: employee.organization_id,
      to: employee.email,
      subject,
      html,
      category: "doctor_daily_schedule",
      relatedEmployeeId: employee.id,
    });

    return result.ok
      ? { ok: true as const, appointmentCount: (appointments ?? []).length }
      : { ok: false as const, reason: result.reason, error: "error" in result ? result.error : undefined };
  });
