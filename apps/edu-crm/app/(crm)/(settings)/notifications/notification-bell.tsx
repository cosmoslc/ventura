"use client";

import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@ventura/ui/dropdown-menu";
import { type NotificationItem, POLL_MS } from "@/lib/notifications";
import { uz } from "@/lib/uz";
import {
  latestNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  unreadCountAction,
} from "./actions";
import { NotificationRow } from "./notification-row";

const t = uz.notifications;

/**
 * Yuqori paneldagi qo'ng'iroq (E6d): o'qilmaganlar soni har 60 soniyada serverdan so'raladi (websocket yo'q),
 * ochilganda oxirgi 10 ta bildirishnoma yuklanadi. Bosilsa o'qilgan bo'ladi va havolaga o'tadi.
 */
export function NotificationBell({ initial }: { initial: number }) {
  const router = useRouter();
  const [count, setCount] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[] | null>(null);

  // Server qayta chizilganda (masalan tasdiqdan keyin) boshlang'ich son yangilanadi
  const [seenInitial, setSeenInitial] = React.useState(initial);
  if (initial !== seenInitial) {
    setSeenInitial(initial);
    setCount(initial);
  }

  React.useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await unreadCountAction().catch(() => null);
      if (alive && res?.ok) setCount(res.count);
    };
    const timer = setInterval(() => void poll(), POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    void latestNotificationsAction()
      .then((res) => {
        if (!res.ok) return;
        setItems(res.items);
        setCount(res.count);
      })
      .catch(() => setItems([]));
  }

  function openItem(item: NotificationItem) {
    setOpen(false);
    if (!item.read) {
      setItems((list) => list?.map((i) => (i.id === item.id ? { ...i, read: true } : i)) ?? null);
      setCount((n) => Math.max(0, n - 1));
      void markNotificationReadAction(item.id).then((res) => res.ok && setCount(res.count));
    }
    router.push(item.href ?? "/notifications");
  }

  function markAll() {
    setItems((list) => list?.map((i) => ({ ...i, read: true })) ?? null);
    setCount(0);
    void markAllNotificationsReadAction().then(() => router.refresh());
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="icon" size="icon" className="relative" aria-label={count ? t.bellUnread(count) : t.bell}>
          <Bell />
          {count ? (
            <span className="absolute -top-1 -right-1 grid min-w-4.5 place-items-center rounded-full bg-(--danger-fg) px-1 text-2xs leading-4.5 font-bold text-white tabular-nums">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-1rem))]">
        <div className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-1.5">
          <div className="text-body font-bold text-foreground">{t.title}</div>
          {count ? (
            <button
              type="button"
              onClick={markAll}
              className="cursor-pointer text-caption font-semibold text-primary-text hover:underline"
            >
              {t.markAll}
            </button>
          ) : null}
        </div>
        <div className="max-h-[min(26rem,70vh)] overflow-y-auto px-1 py-1">
          {items === null ? (
            <p className="px-3 py-6 text-center text-caption text-muted-foreground">{t.loading}</p>
          ) : items.length ? (
            items.map((item) => <NotificationRow key={item.id} item={item} onOpen={openItem} />)
          ) : (
            <p className="px-3 py-6 text-center text-caption text-muted-foreground">{t.empty}</p>
          )}
        </div>
        <div className="border-t border-border-soft p-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
            className="w-full cursor-pointer rounded-btn px-3 py-2 text-center text-caption font-semibold text-primary-text transition-colors hover:bg-secondary"
          >
            {t.viewAll}
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
