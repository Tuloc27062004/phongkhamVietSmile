import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  Cpu,
  FileSpreadsheet,
  Fingerprint,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Việt Smile Clinic Suite — Chấm công & lịch hẹn nha khoa" },
      {
        name: "description",
        content:
          "Phần mềm nội bộ cho phòng khám nha khoa: chấm công vân tay realtime, hồ sơ nhân sự, lịch hẹn và nhắc lịch khách hàng, báo cáo Excel.",
      },
      { property: "og:title", content: "Việt Smile Clinic Suite — Chấm công & lịch hẹn nha khoa" },
      {
        property: "og:description",
        content:
          "Hướng dẫn chi tiết từng luồng: kết nối máy chấm công, duyệt tài khoản, phân quyền, lịch hẹn và báo cáo tháng.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Fingerprint,
    title: "Chấm công vân tay realtime",
    text: "Agent Windows đẩy log máy chấm công lên hệ thống ngay khi nhân viên quét vân tay.",
    points: [
      "Nhận diện đúng vân tay theo mã người dùng trên thiết bị",
      "Tự tính giờ vào/ra, đi trễ, về sớm, tăng ca",
      "Không mô phỏng — chỉ hiển thị dữ liệu thật từ thiết bị",
    ],
  },
  {
    icon: Users,
    title: "Hồ sơ nhân sự",
    text: "Quản lý nhân viên theo phòng ban, chức danh và ca làm việc chuẩn của phòng khám.",
    points: [
      "Thông tin cá nhân, hợp đồng, chứng chỉ hành nghề",
      "Gán ca làm việc và phòng ban theo từng người",
      "Trạng thái làm việc, nghỉ việc, tạm khoá",
    ],
  },
  {
    icon: CalendarCheck,
    title: "Lịch hẹn & nhắc lịch",
    text: "Lễ tân đặt lịch, xác nhận và theo dõi trạng thái từng cuộc hẹn trong ngày.",
    points: [
      "Xem lịch theo ngày, lọc theo bác sĩ và dịch vụ",
      "Nhắc lịch trước hẹn, ghi nhận đã nhắc / đã xác nhận",
      "Lịch sử khám và ghi chú cho từng khách hàng",
    ],
  },
  {
    icon: FileSpreadsheet,
    title: "Báo cáo & xuất Excel",
    text: "Bảng công tháng và báo cáo tăng ca sẵn sàng gửi cho kế toán.",
    points: [
      "Tổng hợp công theo tháng cho từng nhân viên",
      "Báo cáo tăng ca, đi trễ, vắng mặt",
      "Xuất Excel/CSV theo mẫu phòng khám",
    ],
  },
];

const FLOW = [
  {
    icon: UserCheck,
    step: "Bước 1",
    title: "Đăng ký & chờ duyệt",
    text: "Nhân viên tự đăng ký tài khoản bằng email. Tài khoản ở trạng thái “Chờ duyệt” và chưa thấy dữ liệu phòng khám.",
  },
  {
    icon: ShieldCheck,
    step: "Bước 2",
    title: "Quản trị duyệt & phân quyền",
    text: "Admin vào Hệ thống → Người dùng, duyệt yêu cầu và gán vai trò: quản trị, quản lý, lễ tân, bác sĩ hoặc nhân viên.",
  },
  {
    icon: Cpu,
    step: "Bước 3",
    title: "Kết nối máy chấm công",
    text: "Tạo khoá API trong Hệ thống → Kết nối Agent, cấu hình Agent Windows tại phòng khám để đẩy log vân tay lên realtime.",
  },
  {
    icon: LayoutDashboard,
    step: "Bước 4",
    title: "Vận hành hằng ngày",
    text: "Màn hình chấm công hiển thị lượt quét ngay khi phát sinh; lễ tân đặt lịch hẹn và xác nhận khách trong ngày.",
  },
  {
    icon: BellRing,
    step: "Bước 5",
    title: "Nhắc lịch khách hàng",
    text: "Hệ thống liệt kê các cuộc hẹn cần nhắc; lễ tân gọi/nhắn và đánh dấu trạng thái để không bỏ sót khách.",
  },
  {
    icon: FileSpreadsheet,
    step: "Bước 6",
    title: "Chốt công cuối tháng",
    text: "Quản lý rà soát điều chỉnh công, duyệt tăng ca rồi xuất bảng công tháng ra Excel gửi kế toán.",
  },
];

const ROLES = [
  { role: "Quản trị", text: "Toàn quyền: duyệt tài khoản, phân quyền, cấu hình hệ thống và thiết bị." },
  { role: "Quản lý", text: "Nhân sự, ca làm việc, duyệt điều chỉnh công và xem toàn bộ báo cáo." },
  { role: "Lễ tân", text: "Lịch hẹn, nhắc lịch, hồ sơ khách hàng và tra cứu công của bản thân." },
  { role: "Bác sĩ", text: "Lịch làm việc, lịch hẹn được phân công và bảng công cá nhân." },
  { role: "Nhân viên", text: "Xem công của mình, gửi yêu cầu điều chỉnh và báo sự cố." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="brand-gradient flex size-9 items-center justify-center rounded-xl">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Việt Smile Clinic Suite</p>
              <p className="text-xs text-muted-foreground">Hệ thống quản lý phòng khám nha khoa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#huong-dan"
              className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Hướng dẫn sử dụng
            </a>
            <Button asChild size="sm">
              <Link to="/auth">Đăng nhập</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="pb-24">
        {/* Hero */}
        <section className="grid-canvas border-b border-border/70">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary" /> Dành cho nội bộ phòng khám
              </p>
              <h1 className="mt-5 max-w-2xl text-3xl leading-[1.15] md:text-[2.75rem]">
                Chấm công, nhân sự và lịch hẹn nha khoa
                <span className="text-primary"> trong một nơi duy nhất</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
                Dữ liệu vân tay từ máy chấm công được cập nhật realtime, tài khoản mới phải qua duyệt
                và phân quyền — đủ nhẹ để lễ tân dùng hằng ngày, đủ chặt cho quản lý.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/auth">
                    Bắt đầu sử dụng <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Tạo tài khoản
                  </Link>
                </Button>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
                {[
                  { k: "Realtime", v: "Log vân tay" },
                  { k: "5 vai trò", v: "Phân quyền rõ" },
                  { k: "Excel", v: "Bảng công tháng" },
                ].map((item) => (
                  <div key={item.k}>
                    <dt className="text-sm font-semibold text-foreground">{item.k}</dt>
                    <dd className="text-xs text-muted-foreground">{item.v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Preview panel */}
            <div className="surface-card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-sm font-medium">Dòng chấm công hôm nay</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" /> Thiết bị đang kết nối
                </span>
              </div>
              <ul className="divide-y divide-border">
                {[
                  { n: "Nguyễn Thu Hà", r: "Lễ tân", t: "07:58", s: "Vào ca", tone: "text-success" },
                  { n: "BS. Trần Minh", r: "Bác sĩ", t: "08:04", s: "Vào ca", tone: "text-success" },
                  { n: "Lê Quốc Khánh", r: "Phụ tá", t: "08:21", s: "Đi trễ", tone: "text-warning" },
                  { n: "Phạm Ngọc Anh", r: "Quản lý", t: "12:02", s: "Ra ca", tone: "text-muted-foreground" },
                ].map((row) => (
                  <li key={row.n} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Fingerprint className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.n}</p>
                      <p className="text-xs text-muted-foreground">{row.r}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{row.t}</p>
                      <p className={`text-xs ${row.tone}`}>{row.s}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
                Minh hoạ giao diện — dữ liệu thật lấy trực tiếp từ máy chấm công của phòng khám.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Tính năng
            </p>
            <h2 className="mt-2 text-2xl md:text-3xl">Bốn nhóm nghiệp vụ chính</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Mỗi nhóm là một khu vực riêng trên thanh điều hướng, hiển thị theo đúng vai trò của
              người đăng nhập.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="lift-card p-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <feature.icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {feature.text}
                    </p>
                  </div>
                </div>
                <ul className="mt-5 space-y-2 border-t border-border pt-4">
                  {feature.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary/70" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Flow */}
        <section id="huong-dan" className="border-y border-border/70 bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Hướng dẫn
              </p>
              <h2 className="mt-2 text-2xl md:text-3xl">Luồng sử dụng chi tiết, 6 bước</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Từ lúc tạo tài khoản đến khi xuất bảng công cuối tháng — làm đúng thứ tự là hệ thống
                chạy trơn.
              </p>
            </div>

            <ol className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
              {FLOW.map((item, index) => (
                <li
                  key={item.title}
                  className={index < FLOW.length - 1 ? "step-rail pl-0" : "pl-0"}
                >
                  <div className="flex gap-4">
                    <div className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary shadow-none">
                      <item.icon className="size-4" />
                    </div>
                    <div className="min-w-0 pb-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {item.step}
                      </p>
                      <h3 className="mt-1 text-base">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Phân quyền
              </p>
              <h2 className="mt-2 text-2xl md:text-3xl">Mỗi vai trò chỉ thấy phần việc của mình</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Tài khoản mới luôn ở trạng thái chờ duyệt. Quản trị viên gán vai trò khi duyệt, và có
                thể đổi hoặc khoá tài khoản bất kỳ lúc nào.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/auth">
                  Đăng nhập để bắt đầu <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="quiet-card divide-y divide-border overflow-hidden">
              {ROLES.map((item) => (
                <div key={item.role} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-6">
                  <p className="w-28 shrink-0 text-sm font-semibold">{item.role}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Việt Smile Clinic Suite — Hệ thống nội bộ</span>
          <span>Chấm công realtime · Lịch hẹn · Báo cáo Excel</span>
        </div>
      </footer>
    </div>
  );
}
