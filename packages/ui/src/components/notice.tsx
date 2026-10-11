import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

/* Sahifa ichidagi doimiy xabar (toast emas): holat ranglarida, chapda ikonka. */

const TONE = {
  info: { box: "border-(--info-border) bg-(--info-bg) text-(--info-fg)", icon: Info },
  success: { box: "border-(--success-border) bg-(--success-bg) text-(--success-fg)", icon: CircleCheck },
  warning: { box: "border-(--warning-border) bg-(--warning-bg) text-(--warning-fg)", icon: TriangleAlert },
  danger: { box: "border-(--danger-border) bg-(--danger-bg) text-(--danger-fg)", icon: CircleAlert },
} as const;

export interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof TONE;
}

export function Notice({ tone = "info", className, children, ...props }: NoticeProps) {
  const Icon = TONE[tone].icon;
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-card border px-4 py-3 text-body", TONE[tone].box, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
