import { Construction } from "lucide-react";

import { PageHeader } from "@/components/page-state";
import { Badge } from "@/components/ui/badge";

export function PhasePlaceholder({
  title,
  description,
  phase,
  bullets,
}: {
  title: string;
  description: string;
  phase: string;
  bullets: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} actions={<Badge variant="secondary">{phase}</Badge>} />
      <div className="surface-card p-8">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Construction className="size-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Chức năng sẽ được xây dựng ở giai đoạn sau</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Giai đoạn 1 tập trung vào nền tảng: khung ứng dụng, đăng nhập, phân quyền, hệ thống thiết
          kế, cơ sở dữ liệu, hồ sơ phòng khám và dữ liệu mẫu. Nội dung dự kiến của trang này:
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
