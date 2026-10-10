import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export const badgeVariants = cva(
  "type-badge inline-flex items-center gap-1.5 whitespace-nowrap rounded-badge border px-2 py-0.5 leading-[1.5]",
  {
    variants: {
      tone: {
        success: "border-(--success-border) bg-(--success-bg) text-(--success-fg)",
        warning: "border-(--warning-border) bg-(--warning-bg) text-(--warning-fg)",
        danger: "border-(--danger-border) bg-(--danger-bg) text-(--danger-fg)",
        info: "border-(--info-border) bg-(--info-bg) text-(--info-fg)",
        neutral: "border-(--neutral-border) bg-(--neutral-bg) text-(--neutral-fg)",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
