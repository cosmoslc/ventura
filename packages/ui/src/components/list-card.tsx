import * as React from "react";
import { cn } from "../lib/utils";
import { Card } from "./card";

/*
 * ListCard — sarlavhali qisqa ro'yxat kartasi ("Bugungi ishlar" bloklari, ADR 0027): tepada sarlavha, soni va o'ngda
 * amal (odatda "Ochish" havolasi), ostida qatorlar (`ListCardRow`), oxirida ixtiyoriy pastki havola ("Yana N ta").
 * Ro'yxat bo'sh bo'lsa (`count` 0) — `empty` matni. Havolalar ilovadan beriladi (komponent Next'ga bog'lanmaydi).
 */

export type ListCardTone = "muted" | "primary" | "success" | "warning" | "danger";

const TONE: Record<ListCardTone, string> = {
  muted: "text-muted-foreground",
  primary: "text-primary-text",
  success: "text-(--success-fg)",
  warning: "text-(--warning-fg)",
  danger: "text-(--danger-fg)",
};

export interface ListCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: string;
  /** Sarlavha yonidagi son; 0 bo'lsa `empty` ko'rinadi */
  count: number;
  /** Sarlavha oldidagi kichik ikonka */
  icon?: React.ReactNode;
  /** O'ngdagi amal (havola yoki tugma) */
  action?: React.ReactNode;
  empty: string;
  /** Ro'yxat ostida (masalan "Yana 5 ta") */
  footer?: React.ReactNode;
}

export function ListCard({ title, count, icon, action, empty, footer, className, children, ...props }: ListCardProps) {
  return (
    <Card className={cn("flex min-w-0 flex-col p-4", className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-caption font-bold tracking-wide text-foreground uppercase [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
          {icon}
          <span className="truncate">{title}</span>
          <span className="font-semibold text-muted-foreground tabular-nums">{count}</span>
        </h2>
        {action ? (
          <div className="shrink-0 text-caption font-semibold text-primary-text [&_a:hover]:underline">{action}</div>
        ) : null}
      </div>
      {count ? (
        <ul className="mt-2 divide-y divide-border-soft">{children}</ul>
      ) : (
        <p className="grid min-h-24 flex-1 place-items-center text-center text-caption text-muted-foreground">
          {empty}
        </p>
      )}
      {footer ? (
        <div className="mt-2 text-center text-caption text-muted-foreground [&_a:hover]:text-primary-text">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}

export interface ListCardRowProps extends Omit<React.HTMLAttributes<HTMLLIElement>, "title"> {
  /** Asosiy matn (odatda havola) */
  title: React.ReactNode;
  /** Ikkinchi qator: telefon, guruh, izoh */
  sub?: React.ReactNode;
  /** O'ngdagi qiymat: holat, summa, vaqt */
  aside?: React.ReactNode;
  /** `aside` ostidagi kichik matn (masalan sana) */
  asideSub?: React.ReactNode;
  tone?: ListCardTone;
}

/** Qator; `children` — qator ostida (masalan progress chizig'i) */
export function ListCardRow({
  title,
  sub,
  aside,
  asideSub,
  tone = "muted",
  className,
  children,
  ...props
}: ListCardRowProps) {
  return (
    <li className={cn("py-2.5", className)} {...props}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-semibold text-foreground [&_a:hover]:text-primary-text">{title}</div>
          {sub ? (
            <div className="truncate text-caption text-muted-foreground [&_a:hover]:text-primary-text">{sub}</div>
          ) : null}
        </div>
        {aside || asideSub ? (
          <div className="shrink-0 text-right">
            {aside ? <div className={cn("text-caption font-semibold", TONE[tone])}>{aside}</div> : null}
            {asideSub ? <div className="text-2xs text-muted-foreground tabular-nums">{asideSub}</div> : null}
          </div>
        ) : null}
      </div>
      {children}
    </li>
  );
}

/** Qator ostidagi ingichka progress chizig'i, 0–100 */
export function ListCardProgress({ value, className }: { value: number; className?: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("mt-2 h-1 overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
    </div>
  );
}
