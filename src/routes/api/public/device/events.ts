import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Endpoint nhận dữ liệu chấm công thật từ Windows Agent (ZKTeco/Hikvision...).
 * Agent đọc log vân tay/khuôn mặt từ máy chấm công rồi POST lên đây.
 *
 * POST /api/public/device/events
 * Headers: x-api-key: <khóa Agent>
 */

const eventSchema = z.object({
  device_user_id: z.string().min(1).max(64),
  event_time: z.string().datetime({ offset: true }),
  event_type: z.enum(["check_in", "check_out", "auto"]).default("auto"),
  verify_mode: z
    .enum(["fingerprint", "face", "card", "password", "palm", "unknown"])
    .default("fingerprint"),
  temperature: z.number().min(20).max(45).nullable().optional(),
  mask_detected: z.boolean().nullable().optional(),
});

const payloadSchema = z.object({
  device_serial: z.string().min(1).max(120),
  device_name: z.string().max(120).optional(),
  events: z.array(eventSchema).max(500).default([]),
});

const TZ = "Asia/Ho_Chi_Minh";

function workDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/device/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("x-api-key");
        if (!apiKey) return json({ error: "Missing x-api-key" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const keyHash = await sha256Hex(apiKey);
        const { data: keyRow } = await supabaseAdmin
          .from("api_keys")
          .select("id, organization_id, is_active, expires_at")
          .eq("key_hash", keyHash)
          .is("deleted_at", null)
          .maybeSingle();

        if (!keyRow || !keyRow.is_active) return json({ error: "Invalid API key" }, 401);
        if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
          return json({ error: "API key expired" }, 401);
        }

        let payload: z.infer<typeof payloadSchema>;
        try {
          payload = payloadSchema.parse(await request.json());
        } catch (error) {
          return json({ error: "Invalid payload", detail: String(error) }, 400);
        }

        const orgId = keyRow.organization_id;
        const startedAt = new Date().toISOString();

        await supabaseAdmin
          .from("api_keys")
          .update({ last_used_at: startedAt })
          .eq("id", keyRow.id);

        // Thiết bị: tự đăng ký nếu chưa có
        const { data: existingDevice } = await supabaseAdmin
          .from("devices")
          .select("id, sync_count")
          .eq("organization_id", orgId)
          .eq("serial_number", payload.device_serial)
          .maybeSingle();

        let deviceId = existingDevice?.id ?? null;
        if (!deviceId) {
          const { data: inserted } = await supabaseAdmin
            .from("devices")
            .insert({
              organization_id: orgId,
              device_name: payload.device_name ?? payload.device_serial,
              device_type: "fingerprint",
              serial_number: payload.device_serial,
              is_active: true,
              status: "online",
            })
            .select("id")
            .single();
          deviceId = inserted?.id ?? null;
        }

        let imported = 0;
        let skipped = 0;
        let failed = 0;
        const unmapped: string[] = [];

        // Ánh xạ mã người dùng trên máy -> nhân viên
        const deviceUserIds = [...new Set(payload.events.map((e) => e.device_user_id))];
        const employeeByDeviceUser = new Map<string, string>();

        if (deviceUserIds.length > 0) {
          const [{ data: mappings }, { data: employees }] = await Promise.all([
            supabaseAdmin
              .from("device_sync_mappings")
              .select("device_user_id, employee_id, is_active")
              .eq("organization_id", orgId)
              .in("device_user_id", deviceUserIds),
            supabaseAdmin
              .from("employees")
              .select("id, device_user_id")
              .eq("organization_id", orgId)
              .in("device_user_id", deviceUserIds),
          ]);

          for (const emp of employees ?? []) {
            if (emp.device_user_id) employeeByDeviceUser.set(emp.device_user_id, emp.id);
          }
          for (const map of mappings ?? []) {
            if (map.is_active && map.employee_id) {
              employeeByDeviceUser.set(map.device_user_id, map.employee_id);
            }
          }
        }

        for (const event of payload.events) {
          const employeeId = employeeByDeviceUser.get(event.device_user_id) ?? null;
          const date = workDate(event.event_time);

          const { data: record } = employeeId
            ? await supabaseAdmin
                .from("attendance_records")
                .select("id, check_in_time, check_out_time")
                .eq("employee_id", employeeId)
                .eq("work_date", date)
                .maybeSingle()
            : { data: null };

          // Máy chấm công thường chỉ gửi "một lần quét"; suy ra vào/ra theo bản ghi trong ngày
          const direction: "check_in" | "check_out" =
            event.event_type !== "auto"
              ? event.event_type
              : record?.check_in_time
                ? "check_out"
                : "check_in";

          const { error: logError } = await supabaseAdmin.from("device_logs").insert({
            organization_id: orgId,
            device_id: deviceId,
            user_id: employeeId,
            device_user_id: event.device_user_id,
            event_type: direction,
            verify_mode: event.verify_mode,
            event_time: event.event_time,
            temperature: event.temperature ?? null,
            mask_detected: event.mask_detected ?? null,
            processed: Boolean(employeeId),
            process_note: employeeId ? null : "Chưa ánh xạ nhân viên",
            raw_data: JSON.parse(JSON.stringify(event)),
          });

          if (logError) {
            // 23505 = bản ghi trùng (Agent gửi lại) -> bỏ qua
            if (logError.code === "23505") {
              skipped += 1;
              continue;
            }
            failed += 1;
            console.error("[device-ingest] log insert failed", logError);
            continue;
          }

          if (!employeeId) {
            unmapped.push(event.device_user_id);
            skipped += 1;
            continue;
          }

          const eventMs = new Date(event.event_time).getTime();

          if (!record) {
            const isCheckOut = direction === "check_out";
            const { error } = await supabaseAdmin.from("attendance_records").insert({
              organization_id: orgId,
              employee_id: employeeId,
              work_date: date,
              check_in_time: isCheckOut ? null : event.event_time,
              check_out_time: isCheckOut ? event.event_time : null,
              device_check_in_time: isCheckOut ? null : event.event_time,
              device_check_out_time: isCheckOut ? event.event_time : null,
              attendance_status: "present",
            });
            if (error) failed += 1;
            else imported += 1;
            continue;
          }

          const currentIn = record.check_in_time ? new Date(record.check_in_time).getTime() : null;
          const currentOut = record.check_out_time
            ? new Date(record.check_out_time).getTime()
            : null;

          const update: {
            attendance_status: string;
            check_in_time?: string;
            device_check_in_time?: string;
            check_out_time?: string;
            device_check_out_time?: string;
            worked_minutes?: number;
          } = { attendance_status: "present" };

          const treatAsCheckIn =
            direction === "check_in" && (currentIn === null || eventMs < currentIn);

          if (treatAsCheckIn && (currentIn === null || eventMs < currentIn)) {
            update.check_in_time = event.event_time;
            update.device_check_in_time = event.event_time;
          } else if (currentOut === null || eventMs > currentOut) {
            update.check_out_time = event.event_time;
            update.device_check_out_time = event.event_time;
          } else {
            skipped += 1;
            continue;
          }

          const finalIn = new Date(
            update.check_in_time ?? record.check_in_time ?? event.event_time,
          ).getTime();
          const finalOut = update.check_out_time
            ? new Date(update.check_out_time).getTime()
            : currentOut;
          if (finalOut && finalOut > finalIn) {
            update.worked_minutes = Math.round((finalOut - finalIn) / 60000);
          }

          const { error } = await supabaseAdmin
            .from("attendance_records")
            .update(update)
            .eq("id", record.id);
          if (error) failed += 1;
          else imported += 1;
        }

        const completedAt = new Date().toISOString();

        if (deviceId) {
          await supabaseAdmin
            .from("devices")
            .update({
              last_sync_time: completedAt,
              last_sync: completedAt,
              status: "online",
              sync_count: (existingDevice?.sync_count ?? 0) + 1,
            })
            .eq("id", deviceId);
        }

        await supabaseAdmin.from("device_sync_logs").insert({
          organization_id: orgId,
          sync_type: "agent_push",
          status: failed > 0 ? "partial" : "success",
          records_found: payload.events.length,
          records_imported: imported,
          records_skipped: skipped,
          records_failed: failed,
          started_at: startedAt,
          completed_at: completedAt,
          duration_seconds: Math.max(
            0,
            Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000),
          ),
          ...(unmapped.length > 0
            ? { error_message: `Chưa ánh xạ: ${[...new Set(unmapped)].join(", ")}` }
            : {}),
        });

        return json({
          ok: true,
          device_id: deviceId,
          received: payload.events.length,
          imported,
          skipped,
          failed,
          unmapped_device_users: [...new Set(unmapped)],
        });
      },
    },
  },
});
