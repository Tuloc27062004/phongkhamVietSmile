// Công cụ kiểm tra nhanh — chỉ thử KẾT NỐI và ĐỌC THỬ dữ liệu từ máy chấm công, KHÔNG đẩy gì
// lên hệ thống, KHÔNG bật chế độ realtime. Chạy cái này TRƯỚC KHI cài Agent chính thức (agent.js)
// để xác nhận IP/port/mạng đều đúng, trước khi đi vào cấu hình chạy nền 24/7.
//
// Chạy:  node test-connection.js
//
// Không cần điền API_ENDPOINT/API_KEY trong .env để chạy file này — chỉ cần DEVICE_IP/DEVICE_PORT.

require("dotenv").config();
const ZKLib = require("node-zklib");

const DEVICE_IP = process.env.DEVICE_IP;
const DEVICE_PORT = Number(process.env.DEVICE_PORT || 4370);

function step(n, text) {
  console.log(`\n[Bước ${n}] ${text}`);
}

async function main() {
  console.log("=== GZV Clinic Platform — Kiểm tra kết nối máy chấm công ZKTeco ===");

  if (!DEVICE_IP) {
    console.error("\n❌ Chưa có DEVICE_IP trong .env. Copy .env.example thành .env và điền IP máy chấm công trước.");
    process.exitCode = 1;
    return;
  }

  console.log(`Địa chỉ máy chấm công: ${DEVICE_IP}:${DEVICE_PORT}`);

  step(1, `Thử mở kết nối TCP tới ${DEVICE_IP}:${DEVICE_PORT}...`);
  const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000);
  try {
    await zk.createSocket();
    console.log("✅ Mở kết nối TCP thành công.");
  } catch (err) {
    console.error("❌ KHÔNG mở được kết nối TCP:", err.message);
    console.error(
      [
        "",
        "Các nguyên nhân thường gặp:",
        `  - Máy tính này và máy chấm công KHÔNG cùng mạng LAN, hoặc sai IP (kiểm tra lại ${DEVICE_IP} đúng chưa — vào menu máy chấm công > Comm > Ethernet để xem IP thật).`,
        "  - Windows Firewall trên máy tính này chặn kết nối ra cổng 4370 (thêm ngoại lệ cho node.exe hoặc tắt thử Firewall để kiểm tra).",
        "  - Máy chấm công đang tắt chế độ TCP/IP, hoặc \"Cloud Server Setting\" trên máy đang bật và chiếm kết nối — vào menu máy > Comm > Cloud Server Setting, tắt (Disable) nếu có.",
        "  - Phần mềm quản lý Windows hiện tại (nếu đang chạy) có thể đang giữ kết nối độc quyền tới máy — thử TẮT phần mềm đó rồi chạy lại kiểm tra này.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  step(2, "Thử đọc dữ liệu thật qua giao thức ZKTeco (xác nhận không chỉ mở được cổng mà máy thật sự phản hồi đúng)...");
  try {
    const info = await zk.getAttendances();
    const count = info?.data?.length ?? 0;
    console.log(`✅ Đọc thành công — máy hiện đang lưu ${count} bản ghi chấm công.`);
    if (count > 0) {
      console.log("   Ví dụ 1 bản ghi (để đối chiếu tên trường dữ liệu thật):");
      console.log("  ", JSON.stringify(info.data[0]));
    }
  } catch (err) {
    console.error("❌ Mở được cổng TCP nhưng ĐỌC dữ liệu thất bại:", err.message);
    console.error(
      "   Rất có thể có phần mềm khác (phần mềm chấm công Windows hiện tại) đang giữ kết nối độc quyền tới máy — hãy tắt phần mềm đó và chạy lại kiểm tra này.",
    );
    process.exitCode = 1;
  } finally {
    try {
      await zk.disconnect();
    } catch {
      // bỏ qua lỗi khi đóng kết nối, không quan trọng ở bước kiểm tra
    }
  }

  console.log("\n=== Xong. Nếu cả 2 bước trên đều ✅, có thể chuyển sang chạy `npm start` / cài Windows Service. ===");
}

main();
