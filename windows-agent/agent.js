// GZV Clinic Platform — Windows Agent cho máy chấm công ZKTeco (TCP/IP).
//
// Chạy trên MỘT máy tính trong cùng mạng LAN với máy chấm công (vì máy chấm công dùng IP nội
// bộ, ví dụ 192.168.1.202 — máy chủ trên Internet không kết nối trực tiếp tới được). Agent giữ
// một kết nối TCP thường trực tới máy chấm công (cổng 4370), lắng nghe log quét vân tay/khuôn
// mặt theo thời gian thực, và đẩy lên GZV Clinic Platform qua API công khai.
//
// LƯU Ý QUAN TRỌNG: đoạn code này viết đúng theo giao thức ZKTeco chuẩn (thư viện node-zklib,
// cổng 4370) nhưng CHƯA được kiểm thử với máy vật lý thật (môi trường phát triển không truy cập
// được mạng LAN của phòng khám). Trước khi chạy file này, hãy chạy `node test-connection.js`
// trước — nó chỉ thử kết nối và đọc thử dữ liệu, không đẩy gì lên hệ thống, an toàn để thử.

require("dotenv").config();
const ZKLib = require("node-zklib");

const DEVICE_IP = process.env.DEVICE_IP;
const DEVICE_PORT = Number(process.env.DEVICE_PORT || 4370);
const DEVICE_SERIAL = process.env.DEVICE_SERIAL;
const DEVICE_NAME = process.env.DEVICE_NAME || DEVICE_SERIAL;
const API_ENDPOINT = process.env.API_ENDPOINT;
const API_KEY = process.env.API_KEY;
const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || 10000);
const BATCH_FLUSH_MS = Number(process.env.BATCH_FLUSH_MS || 3000);
// Chủ động ngắt và kết nối lại định kỳ dù không thấy lỗi gì — phòng trường hợp kết nối "treo
// âm thầm" (không có sự kiện close/error nào cả) mà không cần chủ động dò hỏi máy trong lúc
// đang ở chế độ realtime (có thể làm gián đoạn luồng sự kiện đang nhận).
const MAX_CONNECTION_LIFETIME_MS = Number(process.env.MAX_CONNECTION_LIFETIME_MS || 6 * 60 * 60 * 1000);

if (!DEVICE_IP || !DEVICE_SERIAL || !API_ENDPOINT || !API_KEY) {
  console.error(
    "[agent] Thiếu cấu hình bắt buộc trong .env (DEVICE_IP, DEVICE_SERIAL, API_ENDPOINT, API_KEY). Xem .env.example.",
  );
  process.exit(1);
}
if (API_ENDPOINT.includes("ten-mien-that-cua-ban") || API_ENDPOINT.includes("localhost")) {
  console.warn(
    "[agent] CẢNH BÁO: API_ENDPOINT có vẻ chưa được điền đúng domain thật đang triển khai — kiểm tra lại .env.",
  );
}

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// Đã đọc trực tiếp mã nguồn node-zklib (node_modules/node-zklib/zklibtcp.js,
// decodeRecordRealTimeLog52): callback realtime CHỈ trả về đúng 2 trường { userId, attTime },
// KHÔNG có trường xác định chế độ vân tay/khuôn mặt/thẻ. Không đoán — dùng "fingerprint" cố
// định cho đúng thực tế của thư viện này (thiết bị đang dùng là máy vân tay).
const VERIFY_MODE = "fingerprint";

function extractUserId(data) {
  const userId = data?.userId;
  if (userId === undefined || userId === null || userId === "") return null;
  return String(userId);
}

function extractEventTime(data) {
  // attTime là đối tượng Date thật, dựng từ đồng hồ trên máy chấm công (decodeRecordRealTimeLog52
  // trong node-zklib) — không phải chuỗi. new Date(Date) sao chép đúng giá trị nếu đã là Date.
  const attTime = data?.attTime;
  if (attTime) {
    const parsed = new Date(attTime);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  // Dự phòng nếu phiên bản thư viện khác trả về khác — dùng giờ nhận được tại Agent.
  return new Date().toISOString();
}

let sendQueue = [];
let flushTimer = null;

function queueEvent(evt) {
  sendQueue.push(evt);
  if (!flushTimer) flushTimer = setTimeout(flushQueue, BATCH_FLUSH_MS);
}

async function flushQueue() {
  flushTimer = null;
  if (sendQueue.length === 0) return;
  const events = sendQueue;
  sendQueue = [];

  try {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ device_serial: DEVICE_SERIAL, device_name: DEVICE_NAME, events }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      log("Gửi lên máy chủ thất bại, sẽ thử lại ở lần đẩy tiếp theo:", res.status, JSON.stringify(body));
      sendQueue = events.concat(sendQueue);
      return;
    }
    log(
      `Đã gửi ${events.length} bản ghi — nhận: ${body.received}, đã nhập: ${body.imported}, bỏ qua: ${body.skipped}, lỗi: ${body.failed}`,
    );
    if ((body.unmapped_device_users ?? []).length > 0) {
      log(
        "Mã người dùng trên máy CHƯA được ánh xạ với nhân viên (vào Trạng thái đồng bộ để gán):",
        body.unmapped_device_users.join(", "),
      );
    }
  } catch (err) {
    log("Lỗi kết nối tới máy chủ, sẽ thử lại ở lần đẩy tiếp theo:", err.message);
    sendQueue = events.concat(sendQueue);
  }
}

let currentZk = null;
let reconnecting = false;
let lifetimeTimer = null;

function scheduleReconnect(reason) {
  if (reconnecting) return;
  reconnecting = true;
  if (lifetimeTimer) {
    clearTimeout(lifetimeTimer);
    lifetimeTimer = null;
  }
  const zkToClose = currentZk;
  currentZk = null;
  Promise.resolve()
    .then(() => zkToClose?.disconnect?.())
    .catch(() => {})
    .finally(() => {
      log(`${reason} — thử kết nối lại sau ${RECONNECT_DELAY_MS / 1000}s...`);
      setTimeout(() => {
        reconnecting = false;
        connectAndListen();
      }, RECONNECT_DELAY_MS);
    });
}

async function connectAndListen() {
  const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);
  currentZk = zk;
  try {
    // node-zklib báo lỗi/đóng kết nối qua 2 callback này (KHÔNG có zk.socket ở object cấp cao
    // nhất — đã kiểm tra trực tiếp trong mã nguồn thư viện, không đoán).
    await zk.createSocket(
      (err) => log("Lỗi socket khi đang kết nối:", err?.message ?? err),
      () => scheduleReconnect("Mất kết nối máy chấm công (socket đóng)"),
    );
    log(`Đã mở kết nối TCP tới máy chấm công ${DEVICE_IP}:${DEVICE_PORT}`);

    // Mở được cổng TCP không có nghĩa là máy chấm công thật sự phản hồi đúng giao thức ZKTeco —
    // xác nhận bằng một lệnh đọc thật (một lần, TRƯỚC khi vào chế độ realtime).
    try {
      const existing = await zk.getAttendances();
      log(`Xác nhận giao thức ZKTeco hoạt động — máy đang lưu ${existing?.data?.length ?? 0} bản ghi chấm công.`);
    } catch (probeErr) {
      log(
        "CẢNH BÁO: mở được cổng TCP nhưng lệnh đọc theo giao thức ZKTeco thất bại — có thể sai IP/port, hoặc máy đang bị phần mềm khác chiếm kết nối:",
        probeErr.message,
      );
    }

    zk.getRealTimeLogs((data) => {
      log("Dữ liệu thô nhận từ máy (để đối chiếu nếu cần chỉnh sửa cách đọc):", JSON.stringify(data));
      const deviceUserId = extractUserId(data ?? {});
      if (!deviceUserId) {
        log("Bỏ qua — không đọc được mã người dùng từ dữ liệu ở dòng trên.");
        return;
      }
      queueEvent({
        device_user_id: deviceUserId,
        event_time: extractEventTime(data ?? {}),
        event_type: "auto",
        verify_mode: VERIFY_MODE,
      });
      log("Ghi nhận quét mới — mã người dùng trên máy:", deviceUserId);
    });

    log(`Đang lắng nghe realtime. Sẽ chủ động làm mới kết nối mỗi ${MAX_CONNECTION_LIFETIME_MS / 3600000} giờ.`);
    lifetimeTimer = setTimeout(() => scheduleReconnect("Làm mới kết nối định kỳ"), MAX_CONNECTION_LIFETIME_MS);
  } catch (err) {
    scheduleReconnect(`Không kết nối được máy chấm công (kiểm tra IP/port/dây mạng/tường lửa): ${err.message}`);
  }
}

log("Khởi động GZV Clinic Platform — Windows Agent");
log(`Thiết bị: ${DEVICE_SERIAL} (${DEVICE_NAME}) @ ${DEVICE_IP}:${DEVICE_PORT}`);
log(`Đẩy dữ liệu tới: ${API_ENDPOINT}`);

connectAndListen();

process.on("SIGINT", () => {
  log("Đang dừng Agent...");
  process.exit(0);
});
process.on("unhandledRejection", (err) => {
  log("Lỗi không mong muốn (agent vẫn tiếp tục chạy):", err);
});
