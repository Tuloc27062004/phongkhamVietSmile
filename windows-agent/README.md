# GZV Clinic Platform — Windows Agent (máy chấm công ZKTeco)

Chương trình nhỏ chạy trên **một máy tính trong cùng mạng LAN với máy chấm công** (máy lễ tân,
máy chủ nội bộ...). Máy chấm công dùng địa chỉ IP nội bộ (vd. `192.168.1.202`) nên máy chủ trên
Internet **không thể** kết nối trực tiếp tới nó — Agent đóng vai trò cầu nối: giữ kết nối tới máy
chấm công qua cổng `4370`, và đẩy dữ liệu quét vân tay lên GZV Clinic Platform qua Internet.

## ⚠️ Đọc trước — máy đang có phần mềm quản lý khác

Nếu máy chấm công **hiện đang được một phần mềm Windows khác quản lý qua LAN** (phần mềm đi kèm
máy ZKTeco, hoặc phần mềm chấm công cũ), cần biết: **nhiều dòng máy ZKTeco chỉ cho phép MỘT kết
nối TCP tại một thời điểm.** Nếu phần mềm cũ đang giữ kết nối, Agent mới có thể kết nối thất bại
hoặc chập chờn, và ngược lại.

**Cách xử lý:** trước khi cài Agent, tạm **tắt/thoát phần mềm Windows đang quản lý máy đó**, sau
đó chạy thử `node test-connection.js` (xem bên dưới). Nếu chạy được, quyết định cùng phòng khám:
chuyển hẳn sang GZV Clinic Platform (khuyến nghị, tránh trùng lặp/chồng chéo dữ liệu vào 2 hệ
thống khác nhau), hoặc tìm hiểu xem model máy có hỗ trợ nhiều kết nối đồng thời không.

## Có cần mở máy 24/7 không?

**Có.** Máy tính chạy Agent cần bật và Agent cần đang chạy (dù bạn không dùng máy) trong suốt giờ
hoạt động của phòng khám để dữ liệu chấm công lên hệ thống theo thời gian thực. Nếu tắt máy hoặc
tắt Agent, dữ liệu chấm công vẫn được lưu trên chính máy ZKTeco (không mất) nhưng sẽ không lên hệ
thống cho tới khi Agent chạy lại.

Không cần một máy tính "phục vụ" riêng — máy lễ tân dùng hằng ngày là đủ, miễn là bật máy trong
giờ làm việc. Bên dưới có hướng dẫn cài Agent chạy nền dạng **Windows Service** — khi đó Agent tự
khởi động cùng máy, không cần mở terminal, không cần đăng nhập Windows, và tự khởi động lại nếu bị
crash.

## Bước 1 — Cấu hình máy chấm công (thực hiện ngay trên màn hình máy ZKTeco)

Vào menu trên máy chấm công (thường: nút **Menu** → **Comm** / **Kết nối mạng**):

1. **Comm → Ethernet**: xác nhận đúng địa chỉ IP đang dùng khớp với `192.168.1.202` (nếu khác,
   ghi lại IP thật để điền vào `.env` ở Bước 3). Xác nhận Subnet Mask và Gateway hợp lý với mạng
   LAN của phòng khám.
2. **Comm → Cloud Server Setting** (nếu máy có mục này): nếu đang **Enable**, máy sẽ cố kết nối
   ra một máy chủ đám mây riêng của hãng — nên **tắt (Disable)** nếu không dùng dịch vụ đó, để
   tránh xung đột kết nối với Agent.
3. **Comm → Comm Key / Mật khẩu kết nối**: theo thông tin bạn cung cấp là `0` — nghĩa là **không
   có mật khẩu kết nối**, không cần điền `device_username`/mật khẩu gì đặc biệt ở Agent.
4. Xác nhận cổng đang dùng là **4370** (mặc định, thường không cần đổi).
5. Ghi lại **Serial Number** hiển thị trong menu (mục Thông tin máy) — cần cho `.env`, khớp với
   `8116243500205` đã đăng ký sẵn trên hệ thống.

## Bước 2 — Cài Node.js và tải Agent

1. **Cài Node.js** (bản 18 trở lên) trên máy tính đó: tải tại https://nodejs.org (chọn bản LTS).
2. Copy toàn bộ thư mục `windows-agent` này vào máy tính đó (ví dụ `C:\GZV-Agent`).
3. Mở PowerShell/CMD tại thư mục đó, chạy:
   ```
   npm install
   ```
4. Copy file `.env.example` thành `.env`, mở bằng Notepad và điền:
   - `DEVICE_IP`, `DEVICE_PORT`, `DEVICE_SERIAL`, `DEVICE_NAME`: thông tin máy chấm công thật
     (xác nhận lại ở Bước 1).
   - `API_ENDPOINT`: lấy đúng địa chỉ tại trang **Hệ thống → Kết nối Agent chấm công** trong GZV
     Clinic Platform (mục "Cấu hình Agent") — **không dùng địa chỉ localhost hoặc link xem thử**.
   - `API_KEY`: tạo tại cùng trang đó (nút "Tạo khóa") — khóa chỉ hiển thị một lần lúc tạo, sao
     chép ngay.

## Bước 3 — Kiểm tra kết nối TRƯỚC (quan trọng, làm bước này trước khi cài chạy nền)

```
node test-connection.js
```

Script này **chỉ thử kết nối và đọc thử dữ liệu, không đẩy gì lên hệ thống** — an toàn để chạy
nhiều lần khi đang dò lỗi. Kết quả mong đợi:

```
✅ Mở kết nối TCP thành công.
✅ Đọc thành công — máy hiện đang lưu N bản ghi chấm công.
```

Nếu báo lỗi, script sẽ tự liệt kê các nguyên nhân thường gặp (sai IP, Firewall, phần mềm cũ đang
chiếm kết nối, Cloud Server Setting chưa tắt...). Xử lý hết lỗi ở bước này rồi mới sang Bước 4.

## Bước 4 — Chạy thử Agent chính thức

```
npm start
```

Thấy dòng `Đã mở kết nối TCP...` và `Xác nhận giao thức ZKTeco hoạt động...` là tốt. Thử quét vân
tay/thẻ trên máy chấm công — nếu thấy dòng `Ghi nhận quét mới` xuất hiện ngay sau đó kèm dòng
`Đã gửi 1 bản ghi — nhận: 1, đã nhập: 1...`, toàn bộ chuỗi đã hoạt động đúng đầu-cuối. Nhấn
`Ctrl+C` để dừng thử nghiệm trước khi sang bước cài chạy nền.

## Bước 5 — Chạy nền 24/7 (khuyến nghị dùng NSSM)

[NSSM](https://nssm.cc/download) (Non-Sucking Service Manager) biến bất kỳ chương trình nào thành
Windows Service — tự chạy khi khởi động máy, tự khởi động lại nếu bị lỗi, không cần đăng nhập.

1. Tải NSSM, giải nén, lấy file `nssm.exe` phù hợp (win64) bỏ vào `C:\GZV-Agent`.
2. Mở PowerShell **với quyền Administrator**, chạy:
   ```
   cd C:\GZV-Agent
   .\nssm.exe install GZVClinicAgent
   ```
3. Cửa sổ NSSM hiện ra:
   - **Path**: đường dẫn tới `node.exe` (thường `C:\Program Files\nodejs\node.exe`)
   - **Startup directory**: `C:\GZV-Agent`
   - **Arguments**: `agent.js`
   - Bấm **Install service**.
4. Khởi động service:
   ```
   .\nssm.exe start GZVClinicAgent
   ```
5. Kiểm tra: mở **Services** (services.msc) trong Windows, tìm "GZVClinicAgent" — trạng thái phải
   là "Running", và **Startup type = Automatic** (để tự chạy lại sau khi khởi động lại máy).

Xem log khi chạy qua NSSM (không tự ghi file log trừ khi cấu hình thêm):

```
.\nssm.exe set GZVClinicAgent AppStdout C:\GZV-Agent\agent.log
.\nssm.exe set GZVClinicAgent AppStderr C:\GZV-Agent\agent.log
.\nssm.exe restart GZVClinicAgent
```

Sau đó mở `C:\GZV-Agent\agent.log` bất cứ lúc nào để xem Agent đang hoạt động ra sao.

## Nếu vẫn không thấy dữ liệu lên hệ thống

- Chạy lại `node test-connection.js` trước — nếu bước này lỗi thì `agent.js`/Windows Service chắc
  chắn cũng lỗi, xử lý ở đây trước.
- Kiểm tra máy tính chạy Agent và máy chấm công **cùng một mạng LAN**, ping được `192.168.1.202`.
- Kiểm tra cổng `4370` không bị Firewall Windows chặn (thêm ngoại lệ cho `node.exe` nếu cần).
- Vào **Hệ thống → Trạng thái đồng bộ** trên GZV Clinic Platform để xem nhật ký đồng bộ và lỗi cụ
  thể (nếu Agent gửi được nhưng dữ liệu bị đánh dấu "chưa ánh xạ", cần vào đó gán mã người dùng
  trên máy với đúng nhân viên).
- Đoạn code này dùng chế độ **real-time** của giao thức ZKTeco qua thư viện `node-zklib` (đã đọc
  trực tiếp mã nguồn thư viện để xác nhận, không đoán): mỗi lần quét trả về đúng 2 trường
  `{ userId, attTime }`. Agent vẫn in ra **dữ liệu thô** của mỗi lần quét vào log (dòng "Dữ liệu
  thô nhận từ máy") để đối chiếu — nếu thấy dòng "Bỏ qua — không đọc được mã người dùng" dù đã
  quét thật, đó là dấu hiệu bất thường (khác với những gì mã nguồn thư viện quy định) — copy đúng
  dòng dữ liệu thô đó gửi lại để xử lý ngay.
- Nếu `test-connection.js` báo lỗi ở bước "Thử đọc dữ liệu thật" (mở được TCP nhưng đọc lệnh giao
  thức thất bại), nguyên nhân phổ biến nhất là **phần mềm Windows quản lý cũ vẫn đang chạy và giữ
  kết nối độc quyền tới máy** — xem mục cảnh báo ở đầu file này.
