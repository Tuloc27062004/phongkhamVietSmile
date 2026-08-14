// Server-only — mẫu email HTML (inline CSS, an toàn với các trình đọc email) dùng chung cho
// mọi phòng khám. Màu sắc lấy tương đương hex của bộ theme oklch trong src/styles.css
// (email client không hỗ trợ oklch/CSS variables nên phải quy đổi cứng ra hex ở đây).
// Không bao giờ import file này từ code chạy trên trình duyệt.

const COLOR_NAVY = "#334155";
const COLOR_PRIMARY = "#3b82f6";
const COLOR_AQUA = "#14b8a6";
const COLOR_INK = "#1e293b";
const COLOR_MUTED = "#64748b";
const COLOR_BORDER = "#e2e8f0";
const COLOR_CANVAS = "#f1f5f9";
const COLOR_CARD_BG = "#f8fafc";

export type ClinicBrand = {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  hotline?: string | null;
  footerNote?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid ${COLOR_BORDER};font-size:13px;color:${COLOR_MUTED};white-space:nowrap;vertical-align:top;width:120px;">${escapeHtml(label)}</td>
      <td style="padding:9px 0;border-bottom:1px solid ${COLOR_BORDER};font-size:14px;color:${COLOR_INK};font-weight:600;text-align:right;">${escapeHtml(value)}</td>
    </tr>`;
}

function shell(brand: ClinicBrand, options: { eyebrow: string; heading: string; bodyHtml: string }): string {
  const { eyebrow, heading, bodyHtml } = options;
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(brand.name)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR_CANVAS};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR_CANVAS};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${COLOR_BORDER};">
          <tr>
            <td style="background-image:linear-gradient(135deg, ${COLOR_NAVY}, ${COLOR_PRIMARY} 70%, ${COLOR_AQUA});padding:28px 28px 24px;">
              ${
                brand.logoUrl
                  ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.name)}" width="40" height="40" style="border-radius:10px;display:block;margin-bottom:12px;object-fit:cover;background:#ffffff;" />`
                  : ""
              }
              <p style="margin:0;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.72);font-weight:600;">${escapeHtml(eyebrow)}</p>
              <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${escapeHtml(brand.name)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:${COLOR_INK};">${escapeHtml(heading)}</p>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background-color:${COLOR_CARD_BG};border-top:1px solid ${COLOR_BORDER};">
              <p style="margin:0;font-size:12px;color:${COLOR_MUTED};line-height:1.6;">
                ${escapeHtml(brand.name)}${brand.address ? ` · ${escapeHtml(brand.address)}` : ""}${brand.hotline ? ` · Hotline: ${escapeHtml(brand.hotline)}` : ""}
              </p>
              ${brand.footerNote ? `<p style="margin:6px 0 0;font-size:11px;color:${COLOR_MUTED};line-height:1.6;">${escapeHtml(brand.footerNote)}</p>` : ""}
              <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">Email tự động từ hệ thống quản lý phòng khám — vui lòng không trả lời email này.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type AppointmentEmailParams = {
  brand: ClinicBrand;
  patientName: string;
  doctorName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  roomName?: string | null;
  notes?: string | null;
};

export function appointmentConfirmationEmail(params: AppointmentEmailParams): { subject: string; html: string } {
  const rows = [
    infoRow("Bác sĩ", params.doctorName),
    infoRow("Dịch vụ", params.serviceName),
    infoRow("Ngày khám", params.dateLabel),
    infoRow("Giờ khám", params.timeLabel),
    params.roomName ? infoRow("Phòng khám", params.roomName) : "",
  ].join("");

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;color:${COLOR_MUTED};line-height:1.6;">
      Xin chào <strong style="color:${COLOR_INK};">${escapeHtml(params.patientName)}</strong>, lịch hẹn khám của bạn đã được xác nhận với thông tin sau:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR_CARD_BG};border:1px solid ${COLOR_BORDER};border-radius:12px;padding:4px 16px;margin-bottom:16px;">
      ${rows}
    </table>
    ${
      params.notes
        ? `<p style="margin:0 0 8px;font-size:13px;color:${COLOR_MUTED};line-height:1.6;"><strong style="color:${COLOR_INK};">Ghi chú:</strong> ${escapeHtml(params.notes)}</p>`
        : ""
    }
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR_MUTED};line-height:1.6;">
      Vui lòng đến trước giờ hẹn 10–15 phút. Nếu cần đổi lịch, liên hệ trực tiếp phòng khám qua hotline bên dưới.
    </p>`;

  return {
    subject: `Xác nhận lịch hẹn khám — ${params.dateLabel} lúc ${params.timeLabel}`,
    html: shell(params.brand, { eyebrow: "Xác nhận lịch hẹn", heading: "Lịch hẹn của bạn đã được xác nhận ✅", bodyHtml }),
  };
}

export function appointmentReminderEmail(params: AppointmentEmailParams): { subject: string; html: string } {
  const rows = [
    infoRow("Bác sĩ", params.doctorName),
    infoRow("Dịch vụ", params.serviceName),
    infoRow("Ngày khám", params.dateLabel),
    infoRow("Giờ khám", params.timeLabel),
    params.roomName ? infoRow("Phòng khám", params.roomName) : "",
  ].join("");

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;color:${COLOR_MUTED};line-height:1.6;">
      Xin chào <strong style="color:${COLOR_INK};">${escapeHtml(params.patientName)}</strong>, đây là lời nhắc bạn có lịch hẹn khám sắp tới:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR_CARD_BG};border:1px solid ${COLOR_BORDER};border-radius:12px;padding:4px 16px;margin-bottom:16px;">
      ${rows}
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR_MUTED};line-height:1.6;">
      Vui lòng đến trước giờ hẹn 10–15 phút. Nếu không thể đến đúng giờ, liên hệ phòng khám sớm để sắp xếp lại lịch hẹn.
    </p>`;

  return {
    subject: `Nhắc lịch hẹn khám — ${params.dateLabel} lúc ${params.timeLabel}`,
    html: shell(params.brand, { eyebrow: "Nhắc lịch hẹn", heading: "Sắp đến giờ hẹn khám của bạn ⏰", bodyHtml }),
  };
}

export type DoctorScheduleEmailParams = {
  brand: ClinicBrand;
  doctorName: string;
  dateLabel: string;
  appointments: Array<{
    timeLabel: string;
    patientName: string;
    patientPhone?: string | null;
    serviceName: string;
    notes?: string | null;
  }>;
};

export function doctorDailyScheduleEmail(params: DoctorScheduleEmailParams): { subject: string; html: string } {
  const rowsHtml =
    params.appointments.length === 0
      ? `<p style="margin:0;font-size:14px;color:${COLOR_MUTED};">Không có lịch hẹn nào trong ngày này.</p>`
      : params.appointments
          .map(
            (apt, index) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR_CARD_BG};border:1px solid ${COLOR_BORDER};border-radius:12px;padding:14px 16px;margin-bottom:${index === params.appointments.length - 1 ? "0" : "10px"};">
        <tr>
          <td style="vertical-align:top;width:64px;">
            <span style="display:inline-block;background-color:${COLOR_PRIMARY};color:#ffffff;font-size:12px;font-weight:700;padding:4px 8px;border-radius:8px;">${escapeHtml(apt.timeLabel)}</span>
          </td>
          <td style="vertical-align:top;">
            <p style="margin:0;font-size:14px;font-weight:700;color:${COLOR_INK};">${escapeHtml(apt.patientName)}</p>
            <p style="margin:2px 0 0;font-size:13px;color:${COLOR_MUTED};">${escapeHtml(apt.serviceName)}${apt.patientPhone ? ` · ${escapeHtml(apt.patientPhone)}` : ""}</p>
            ${apt.notes ? `<p style="margin:4px 0 0;font-size:12px;color:${COLOR_MUTED};font-style:italic;">${escapeHtml(apt.notes)}</p>` : ""}
          </td>
        </tr>
      </table>`,
          )
          .join("");

  const bodyHtml = `
    <p style="margin:0 0 18px;font-size:14px;color:${COLOR_MUTED};line-height:1.6;">
      Xin chào <strong style="color:${COLOR_INK};">${escapeHtml(params.doctorName)}</strong>, đây là lịch khám của bạn ngày <strong style="color:${COLOR_INK};">${escapeHtml(params.dateLabel)}</strong> (${params.appointments.length} cuộc hẹn):
    </p>
    ${rowsHtml}`;

  return {
    subject: `Lịch khám ngày ${params.dateLabel} — ${params.appointments.length} cuộc hẹn`,
    html: shell(params.brand, { eyebrow: "Lịch khám trong ngày", heading: "Lịch khám của bạn hôm nay 📋", bodyHtml }),
  };
}

export function testEmail(brand: ClinicBrand): { subject: string; html: string } {
  const bodyHtml = `
    <p style="margin:0;font-size:14px;color:${COLOR_MUTED};line-height:1.6;">
      Đây là email thử nghiệm để xác nhận cấu hình Resend của <strong style="color:${COLOR_INK};">${escapeHtml(brand.name)}</strong> đã hoạt động chính xác.
      Nếu bạn nhận được email này, hệ thống gửi email đã sẵn sàng để gửi xác nhận lịch hẹn, nhắc lịch và lịch khám hằng ngày cho bác sĩ.
    </p>`;

  return {
    subject: `[Thử nghiệm] Cấu hình email của ${brand.name} đã hoạt động ✅`,
    html: shell(brand, { eyebrow: "Kiểm tra cấu hình", heading: "Email thử nghiệm thành công 🎉", bodyHtml }),
  };
}
