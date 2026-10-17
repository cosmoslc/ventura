"use client";

import { cn } from "@ventura/ui/lib/utils";
import { type NotificationItem, ago } from "@/lib/notifications";

/** Bitta bildirishnoma qatori (qo'ng'iroq ro'yxati va sahifa uchun umumiy): o'qilmagan — qalin sarlavha va nuqta. */
export function NotificationRow({
  item,
  onOpen,
  className,
  trailing,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-1", className)}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-btn px-3 py-2.5 text-left transition-colors hover:bg-secondary"
      >
        <span
          aria-hidden
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-body leading-snug",
              item.read ? "font-medium text-secondary-foreground" : "font-bold text-foreground",
            )}
          >
            {item.title}
          </span>
          {item.body ? (
            <span className="mt-0.5 block text-caption leading-snug text-muted-foreground">{item.body}</span>
          ) : null}
          <span className="mt-1 block text-caption text-placeholder">{ago(item.createdAt)}</span>
        </span>
      </button>
      {trailing}
    </div>
  );
}
