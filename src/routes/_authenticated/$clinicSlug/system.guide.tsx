import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Building2,
  DollarSign,
  Fingerprint,
  ShieldCheck,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { hasAnyRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/$clinicSlug/system/guide")({
  head: () => ({
    meta: [
      { title: "Hướng dẫn sử dụng — GZV Clinic Platform" },
      { name: "description", content: "Hướng dẫn sử dụng hệ thống theo từng vai trò." },
    ],
  }),
  component: GuidePage,
});

type Section = {
  icon: typeof BookOpen;
  title: string;
  roles: Parameters<typeof hasAnyRole>[1];
  items: { title: string; body: string }[];
};

const SECTIONS: Section[] = [
  {
    icon: Fingerprint,
    title: "Chấm công hằng ngày",
    roles: ["administrator", "manager", "receptionist", "employee", "doctor"],
    items: [
      {
        title: "Chấm công thực tế",
        body: "Vào Chấm công thực tế để check-in/out qua thiết bị vân tay hoặc web. Xem lại lịch sử tại Bảng công tổng hợp tháng.",
      },
      {
        title: "Điều chỉnh công",
        body: "Nếu quên chấm công hoặc chấm công sai giờ, gửi yêu cầu điều chỉnh — quản lý sẽ duyệt tại trang Điều chỉnh công & Tăng ca.",
      },
    ],
  },
  {
    icon: Users,
    title: "Quản lý nhân sự & chấm công (quản lý/quản trị viên)",
    roles: ["administrator", "manager"],
    items: [
      {
        title: "Chấm công thủ công",
        body: "Dùng khi máy chấm công lỗi — nhập giờ vào/ra trực tiếp cho nhân viên tại Chấm công thủ công.",
      },
      {
        title: "Duyệt điều chỉnh & tăng ca",
        body: "Xem yêu cầu điều chỉnh công và tăng ca đang chờ (pending), bấm Duyệt hoặc Từ chối.",
      },
    ],
  },
  {
    icon: DollarSign,
    title: "Tính lương & in bảng lương",
    roles: ["administrator", "manager"],
    items: [
      {
        title: "Tính lương tự động",
        body: "Tại Quản lý Lương & Payroll, chọn tháng/năm — hệ thống tự tính từ dữ liệu chấm công (ngày công, đi trễ >15 phút, vắng mặt, bảo hiểm 10%).",
      },
      {
        title: "Duyệt & lưu lịch sử",
        body: "Bấm Duyệt từng dòng để lưu chính thức vào lịch sử lương của nhân viên đó.",
      },
      {
        title: "In lương",
        body: "Bấm \"In bảng lương\" để in cả bảng, hoặc bấm icon máy in ở từng dòng để in phiếu lương riêng cho một nhân viên.",
      },
    ],
  },
  {
    icon: Building2,
    title: "Quản trị nền tảng (Super Admin)",
    roles: ["administrator"],
    items: [
      {
        title: "Chuyển đổi phòng khám",
        body: "Dùng thanh chuyển đổi ở góc trên (hoặc bảng danh sách trong Dashboard Quản Trị) để vào không gian làm việc của bất kỳ phòng khám nào.",
      },
      {
        title: "Tạo phòng khám mới",
        body: "Tại Dashboard Quản Trị, bấm \"+ Thêm Phòng Khám Chi Nhánh Mới\" — nhập tên, chọn chuyên khoa, hệ thống tự tạo và chuyển bạn vào phòng khám mới.",
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Bảo mật & phân quyền",
    roles: ["administrator", "manager", "receptionist", "employee", "doctor", "patient"],
    items: [
      {
        title: "Dữ liệu được cách ly theo phòng khám",
        body: "Bạn chỉ thấy dữ liệu của phòng khám mình (trừ Super Admin). Mỗi tài khoản chỉ có đúng những quyền được quản trị viên cấp.",
      },
    ],
  },
];

function GuidePage() {
  const { profile } = Route.useRouteContext();
  const visibleSections = SECTIONS.filter((section) => hasAnyRole(profile.roles, section.roles));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hướng dẫn sử dụng"
        description="Tóm tắt các quy trình chính theo vai trò của bạn trong hệ thống."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {visibleSections.map((section) => (
          <Card key={section.title} className="p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <section.icon className="size-4" />
              </div>
              <h3 className="font-semibold">{section.title}</h3>
            </div>
            <div className="space-y-4">
              {section.items.map((item) => (
                <div key={item.title}>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {item.title}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Tài liệu đầy đủ dành cho developer/quản trị hệ thống: xem thư mục{" "}
        <code>docs/</code> trong mã nguồn dự án.
      </p>
    </div>
  );
}
