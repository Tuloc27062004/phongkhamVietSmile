import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DeviceEvent = {
  device_user_id: string;
  event_time: string;
  event_type: "check_in" | "check_out" | "auto";
  verify_mode: "fingerprint" | "face" | "card" | "password" | "palm" | "unknown";
  temperature?: number | null;
  mask_detected?: boolean | null;
};

type DeviceUser = {
  device_user_id: string;
  name?: string;
  email: string | null;
  role: "user" | "admin";
  fingerprints: number[];
  created_at: string | null;
};

type Payload = {
  device_serial: string;
  device_name?: string;
  events: DeviceEvent[];
  device_users: DeviceUser[];
};

const TZ = "Asia/Ho_Chi_Minh";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8" },
  });
}

function normalizeDeviceUserId(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text.length > 0 && text.length <= 64 ? text : null;
}

function normalizeEmail(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function parsePayload(input: unknown): Payload {
  if (!input || typeof input !== "object") throw new Error("Payload must be an object");
  const raw = input as Record<string, unknown>;

  const deviceSerial = typeof raw.device_serial === "string" ? raw.device_serial.trim() : "";
  if (!deviceSerial || deviceSerial.length > 120) throw new Error("device_serial is required");

  const deviceName = typeof raw.device_name === "string" ? raw.device_name.trim().slice(0, 120) : undefined;
  const rawEvents = Array.isArray(raw.events) ? raw.events : [];
  if (rawEvents.length > 500) throw new Error("events max length is 500");

  const events = rawEvents.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`events[${index}] must be an object`);
    const event = item as Record<string, unknown>;
    const deviceUserId = normalizeDeviceUserId(event.device_user_id ?? event.deviceUserId);
    if (!deviceUserId) throw new Error(`events[${index}].device_user_id is required`);

    const eventTime = typeof event.event_time === "string" ? event.event_time : "";
    if (!eventTime || Number.isNaN(Date.parse(eventTime))) {
      throw new Error(`events[${index}].event_time must be ISO datetime`);
    }

    const eventType = ["check_in", "check_out", "auto"].includes(String(event.event_type))
      ? String(event.event_type)
      : "auto";
    const verifyMode = ["fingerprint", "face", "card", "password", "palm", "unknown"].includes(
      String(event.verify_mode),
    )
      ? String(event.verify_mode)
      : "fingerprint";

    return {
      device_user_id: deviceUserId,
      event_time: eventTime,
      event_type: eventType as DeviceEvent["event_type"],
      verify_mode: verifyMode as DeviceEvent["verify_mode"],
      temperature: typeof event.temperature === "number" ? event.temperature : null,
      mask_detected: typeof event.mask_detected === "boolean" ? event.mask_detected : null,
    };
  });

  const rawUsers = [
    ...(Array.isArray(raw.device_users) ? raw.device_users : []),
    ...(Array.isArray(raw.users) ? raw.users : []),
  ];
  if (rawUsers.length > 500) throw new Error("device_users max length is 500");

  const deviceUsers = rawUsers.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`device_users[${index}] must be an object`);
    const user = item as Record<string, unknown>;
    const deviceUserId = normalizeDeviceUserId(user.device_user_id ?? user.deviceUserId);
    if (!deviceUserId) throw new Error(`device_users[${index}].deviceUserId is required`);

    const role = user.role === "admin" ? "admin" : "user";
    const fingerprints = Array.isArray(user.fingerprints)
      ? user.fingerprints.filter((value): value is number => Number.isInteger(value))
      : [];

    return {
      device_user_id: deviceUserId,
      name: typeof user.name === "string" ? user.name.trim().slice(0, 120) : undefined,
      email: normalizeEmail(user.email),
      role,
      fingerprints,
      created_at:
        typeof user.created_at === "string"
          ? user.created_at
          : typeof user.createdAt === "string"
            ? user.createdAt
            : null,
    };
  });

  return {
    device_serial: deviceSerial,
    device_name: deviceName,
    events,
    device_users: deviceUsers,
  };
}

function getDeviceSerialFromUrl(url: URL) {
  return (
    url.searchParams.get("SN") ??
    url.searchParams.get("sn") ??
    url.searchParams.get("device_serial") ??
    url.searchParams.get("serial_number") ??
    ""
  ).trim();
}

function localIclockTimeToIso(value: string) {
  const normalized = value.trim().replace(" ", "T");
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized)) return normalized;
  return `${normalized}+07:00`;
}

function verifyModeFromIclock(value: string | undefined): DeviceEvent["verify_mode"] {
  if (value === "1" || value === "3" || value === "4") return "fingerprint";
  if (value === "15") return "face";
  if (value === "2") return "password";
  return "unknown";
}

function parseIclockAttlogPayload(url: URL, body: string): Payload {
  const deviceSerial = getDeviceSerialFromUrl(url);
  if (!deviceSerial) throw new Error("SN/device_serial is required for iclock ATTLOG");

  const events = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const columns = line.includes("\t") ? line.split(/\t+/) : line.split(/\s+/);
      const deviceUserId = normalizeDeviceUserId(columns[0]);
      if (!deviceUserId) throw new Error(`ATTLOG line ${index + 1}: missing user id`);

      const rawTime = line.includes("\t") ? columns[1] : `${columns[1] ?? ""} ${columns[2] ?? ""}`;
      const eventTime = localIclockTimeToIso(rawTime);
      if (Number.isNaN(Date.parse(eventTime))) {
        throw new Error(`ATTLOG line ${index + 1}: invalid event time`);
      }

      const verifyColumn = line.includes("\t") ? columns[3] : columns[4];
      return {
        device_user_id: deviceUserId,
        event_time: eventTime,
        event_type: "auto" as const,
        verify_mode: verifyModeFromIclock(verifyColumn),
        temperature: null,
        mask_detected: null,
      };
    });

  return {
    device_serial: deviceSerial,
    device_name: deviceSerial,
    events,
    device_users: [],
  };
}

function handleIclockGet(url: URL) {
  const pathname = url.pathname.toLowerCase();
  const serial = getDeviceSerialFromUrl(url) || "UNKNOWN";

  if (pathname.endsWith("/iclock/cdata") && url.searchParams.get("options") === "all") {
    return text(
      [
        `GET OPTION FROM: ${serial}`,
        `Stamp=${Math.floor(Date.now() / 1000)}`,
        "OpStamp=0",
        "ErrorDelay=30",
        "Delay=10",
        "TransTimes=00:00;14:00",
        "TransInterval=1",
        "TransFlag=1111000000",
        "TimeZone=7",
        "Realtime=1",
        "Encrypt=0",
        "",
      ].join("\n"),
    );
  }

  if (pathname.endsWith("/iclock/getrequest")) {
    return text("OK\n");
  }

  return text("OK\n");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function workDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function lateMinutes(eventTime: string, workDateText: string, shift: Record<string, unknown> | null) {
  if (!shift?.start_time) return 0;
  const startTime = String(shift.start_time).slice(0, 8);
  const grace = Number(shift.grace_period_minutes ?? shift.late_threshold_minutes ?? 0);
  const shiftStartMs = Date.parse(`${workDateText}T${startTime}+07:00`);
  const actualMs = Date.parse(eventTime);
  const minutes = Math.floor((actualMs - shiftStartMs) / 60000) - Math.max(0, grace);
  return minutes > 0 ? minutes : 0;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method === "GET") return handleIclockGet(url);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = request.headers.get("x-api-key") ?? url.searchParams.get("api_key") ?? url.searchParams.get("token");
  if (!apiKey) return json({ error: "Missing x-api-key" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing SUPABASE_URL or service role key" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow, error: keyError } = await supabase
    .from("api_keys")
    .select("id, organization_id, is_active, expires_at")
    .eq("key_hash", keyHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (keyError) return json({ error: "API key lookup failed", detail: keyError.message }, 500);
  if (!keyRow || !keyRow.is_active) return json({ error: "Invalid API key" }, 401);
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return json({ error: "API key expired" }, 401);
  }

  let payload: Payload;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const isIclockAttlog =
      url.pathname.toLowerCase().endsWith("/iclock/cdata") &&
      (url.searchParams.get("table") ?? "").toUpperCase() === "ATTLOG";

    if (isIclockAttlog && !contentType.includes("application/json")) {
      payload = parseIclockAttlogPayload(url, await request.text());
    } else {
      payload = parsePayload(await request.json());
    }
  } catch (error) {
    return json({ error: "Invalid payload", detail: error instanceof Error ? error.message : String(error) }, 400);
  }

  const orgId = keyRow.organization_id as string;
  const startedAt = new Date().toISOString();

  await supabase.from("api_keys").update({ last_used_at: startedAt }).eq("id", keyRow.id);

  const { data: existingDevice } = await supabase
    .from("devices")
    .select("id, sync_count")
    .eq("organization_id", orgId)
    .eq("serial_number", payload.device_serial)
    .maybeSingle();

  let deviceId = existingDevice?.id ?? null;
  if (!deviceId) {
    const { data: inserted, error } = await supabase
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
    if (error) return json({ error: "Device registration failed", detail: error.message }, 500);
    deviceId = inserted.id;
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let autoMapped = 0;
  const unmapped: string[] = [];
  const mappingConflicts: string[] = [];

  const deviceUserIds = [...new Set(payload.events.map((event) => event.device_user_id))];
  const employeeByDeviceUser = new Map<string, string>();
  const employeeShiftById = new Map<string, Record<string, unknown> | null>();

  const deviceUsersByEmail = new Map(
    payload.device_users
      .filter((user) => user.email)
      .map((user) => [user.email as string, user]),
  );

  if (deviceUsersByEmail.size > 0) {
    const emails = [...deviceUsersByEmail.keys()];
    const [{ data: employeesByEmail }, { data: profilesByEmail }] = await Promise.all([
      supabase
        .from("employees")
        .select("id, email, user_id, device_user_id")
        .eq("organization_id", orgId)
        .in("email", emails),
      supabase.from("user_profiles").select("id, email").in("email", emails),
    ]);

    const employeeByEmail = new Map<string, { id: string; device_user_id: string | null }>();
    for (const employee of employeesByEmail ?? []) {
      if (employee.email) {
        employeeByEmail.set(String(employee.email).toLowerCase(), {
          id: employee.id,
          device_user_id: employee.device_user_id,
        });
      }
    }

    const profileByEmail = new Map(
      (profilesByEmail ?? [])
        .filter((profile) => profile.email)
        .map((profile) => [String(profile.email).toLowerCase(), profile.id]),
    );
    const missingProfileUserIds = emails
      .filter((email) => !employeeByEmail.has(email) && profileByEmail.has(email))
      .map((email) => profileByEmail.get(email) as string);

    if (missingProfileUserIds.length > 0) {
      const { data: employeesByUserId } = await supabase
        .from("employees")
        .select("id, user_id, device_user_id")
        .eq("organization_id", orgId)
        .in("user_id", missingProfileUserIds);

      const employeeByUserId = new Map((employeesByUserId ?? []).map((employee) => [employee.user_id, employee]));
      for (const email of emails) {
        const userId = profileByEmail.get(email);
        const employee = userId ? employeeByUserId.get(userId) : null;
        if (employee) {
          employeeByEmail.set(email, {
            id: employee.id,
            device_user_id: employee.device_user_id,
          });
        }
      }
    }

    for (const [email, deviceUser] of deviceUsersByEmail) {
      const employee = employeeByEmail.get(email);
      const deviceUserId = deviceUser.device_user_id;

      if (!employee) {
        await supabase.from("device_sync_mappings").upsert(
          {
            organization_id: orgId,
            device_user_id: deviceUserId,
            employee_id: null,
            is_active: false,
            last_sync_time: startedAt,
            sync_status: "unmatched",
            sync_error: `No employee found for email ${email}`,
          },
          { onConflict: "organization_id,device_user_id" },
        );
        unmapped.push(deviceUserId);
        continue;
      }

      if (employee.device_user_id && employee.device_user_id !== deviceUserId) {
        mappingConflicts.push(deviceUserId);
        await supabase.from("device_sync_mappings").upsert(
          {
            organization_id: orgId,
            device_user_id: deviceUserId,
            employee_id: employee.id,
            is_active: false,
            last_sync_time: startedAt,
            sync_status: "conflict",
            sync_error: `Employee already has device user id ${employee.device_user_id}`,
          },
          { onConflict: "organization_id,device_user_id" },
        );
        continue;
      }

      await supabase.from("employees").update({ device_user_id: deviceUserId }).eq("id", employee.id);
      await supabase.from("device_sync_mappings").upsert(
        {
          organization_id: orgId,
          device_user_id: deviceUserId,
          employee_id: employee.id,
          is_active: true,
          last_sync_time: startedAt,
          sync_status: "auto_mapped",
          sync_error: null,
        },
        { onConflict: "organization_id,device_user_id" },
      );

      employeeByDeviceUser.set(deviceUserId, employee.id);
      autoMapped += 1;
    }
  }

  if (deviceUserIds.length > 0) {
    const [{ data: mappings }, { data: employees }] = await Promise.all([
      supabase
        .from("device_sync_mappings")
        .select("device_user_id, employee_id, is_active")
        .eq("organization_id", orgId)
        .in("device_user_id", deviceUserIds),
      supabase
        .from("employees")
        .select("id, device_user_id, default_shift_id, shifts:default_shift_id(start_time, grace_period_minutes, late_threshold_minutes)")
        .eq("organization_id", orgId)
        .in("device_user_id", deviceUserIds),
    ]);

    for (const employee of employees ?? []) {
      if (employee.device_user_id) {
        employeeByDeviceUser.set(employee.device_user_id, employee.id);
        employeeShiftById.set(employee.id, Array.isArray(employee.shifts) ? employee.shifts[0] ?? null : employee.shifts);
      }
    }
    for (const mapping of mappings ?? []) {
      if (mapping.is_active && mapping.employee_id) {
        employeeByDeviceUser.set(mapping.device_user_id, mapping.employee_id);
      }
    }
  }

  for (const event of payload.events) {
    const employeeId = employeeByDeviceUser.get(event.device_user_id) ?? null;
    const date = workDate(event.event_time);

    const { data: record } = employeeId
      ? await supabase
          .from("attendance_records")
          .select("id, check_in_time, check_out_time")
          .eq("employee_id", employeeId)
          .eq("work_date", date)
          .maybeSingle()
      : { data: null };

    const direction: "check_in" | "check_out" =
      event.event_type !== "auto" ? event.event_type : record?.check_in_time ? "check_out" : "check_in";

    const { error: logError } = await supabase.from("device_logs").insert({
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
      process_note: employeeId ? null : "Employee is not mapped",
      raw_data: event,
    });

    if (logError) {
      if (logError.code === "23505") {
        skipped += 1;
        continue;
      }
      failed += 1;
      console.error("[device-events] log insert failed", logError);
      continue;
    }

    if (!employeeId) {
      unmapped.push(event.device_user_id);
      skipped += 1;
      continue;
    }

    const eventMs = Date.parse(event.event_time);

    if (!record) {
      const isCheckOut = direction === "check_out";
      const late = isCheckOut ? 0 : lateMinutes(event.event_time, date, employeeShiftById.get(employeeId) ?? null);
      const { error } = await supabase.from("attendance_records").insert({
        organization_id: orgId,
        employee_id: employeeId,
        work_date: date,
        check_in_time: isCheckOut ? null : event.event_time,
        check_out_time: isCheckOut ? event.event_time : null,
        device_check_in_time: isCheckOut ? null : event.event_time,
        device_check_out_time: isCheckOut ? event.event_time : null,
        late_minutes: late,
        attendance_status: late > 0 ? "late" : "present",
      });
      if (error) failed += 1;
      else imported += 1;
      continue;
    }

    const currentIn = record.check_in_time ? Date.parse(record.check_in_time) : null;
    const currentOut = record.check_out_time ? Date.parse(record.check_out_time) : null;

    const update: Record<string, unknown> = { attendance_status: "present" };
    const treatAsCheckIn = direction === "check_in" && (currentIn === null || eventMs < currentIn);

    if (treatAsCheckIn) {
      const late = lateMinutes(event.event_time, date, employeeShiftById.get(employeeId) ?? null);
      update.check_in_time = event.event_time;
      update.device_check_in_time = event.event_time;
      update.late_minutes = late;
      update.attendance_status = late > 0 ? "late" : "present";
    } else if (currentOut === null || eventMs > currentOut) {
      update.check_out_time = event.event_time;
      update.device_check_out_time = event.event_time;
    } else {
      skipped += 1;
      continue;
    }

    const finalIn = Date.parse(String(update.check_in_time ?? record.check_in_time ?? event.event_time));
    const finalOut = update.check_out_time ? Date.parse(String(update.check_out_time)) : currentOut;
    if (finalOut && finalOut > finalIn) {
      update.worked_minutes = Math.round((finalOut - finalIn) / 60000);
    }

    const { error } = await supabase.from("attendance_records").update(update).eq("id", record.id);
    if (error) failed += 1;
    else imported += 1;
  }

  const completedAt = new Date().toISOString();

  if (deviceId) {
    await supabase
      .from("devices")
      .update({
        last_sync_time: completedAt,
        last_sync: completedAt,
        status: "online",
        sync_count: (existingDevice?.sync_count ?? 0) + 1,
        users_synced: autoMapped,
      })
      .eq("id", deviceId);
  }

  await supabase.from("device_sync_logs").insert({
    organization_id: orgId,
    sync_type: "agent_push",
    status: failed > 0 ? "partial" : "success",
    records_found: payload.events.length,
    records_imported: imported,
    records_skipped: skipped,
    records_failed: failed,
    started_at: startedAt,
    completed_at: completedAt,
    duration_seconds: Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000)),
    ...(unmapped.length > 0 ? { error_message: `Unmapped: ${[...new Set(unmapped)].join(", ")}` } : {}),
  });

  return json({
    ok: true,
    device_id: deviceId,
    received: payload.events.length,
    device_users_received: payload.device_users.length,
    auto_mapped: autoMapped,
    imported,
    skipped,
    failed,
    unmapped_device_users: [...new Set(unmapped)],
    mapping_conflicts: [...new Set(mappingConflicts)],
  });
});
