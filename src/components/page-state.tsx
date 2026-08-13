import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, ShieldAlert } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
      <div className="min-w-0">
        <h1 className="text-xl tracking-tight md:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}


export function LoadingState({
  rows = 3,
  className,
}: {
  rows?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function InlineSpinner({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

function StateBlock({
  icon,
  title,
  description,
  action,
  tone = "muted",
}: {
  icon: ReactNode;
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
  tone?: "muted" | "danger" | undefined;
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary",
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-base font-semibold">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <StateBlock icon={<Inbox className="size-5" />} title={title} description={description} action={action} />
  );
}

export function ErrorState({
  title = "Không tải được dữ liệu",
  description,
  action,
}: {
  title?: string | undefined;
  description?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <StateBlock
      tone="danger"
      icon={<AlertTriangle className="size-5" />}
      title={title}
      description={description ?? "Đã có lỗi xảy ra. Vui lòng thử lại."}
      action={action}
    />
  );
}

export function PermissionDenied() {
  return (
    <StateBlock
      tone="danger"
      icon={<ShieldAlert className="size-5" />}
      title="Bạn không có quyền truy cập"
      description="Chức năng này chỉ dành cho một số vai trò nhất định. Vui lòng liên hệ quản trị viên của phòng khám."
    />
  );
}
