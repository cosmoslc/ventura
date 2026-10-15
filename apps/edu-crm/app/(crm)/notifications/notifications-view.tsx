"use client";

import { Bell, Check, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import type { NotificationItem } from "@/lib/notifications";
import { uz } from "@/lib/uz";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";
import { NotificationRow } from "./notification-row";

const t = uz.notifications;

export function NotificationsView({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"all" | "unread">("all");
  // Bosilgan zahoti o'qilgan ko'rinadi, server javobi keyin tasdiqlaydi
  const [readIds, setReadIds] = React.useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = React.useTransition();

  const rows = items.map((i) => (readIds.has(i.id) ? { ...i, read: true } : i));
  const unread = rows.filter((r) => !r.read).length;
  const list = tab === "unread" ? rows.filter((r) => !r.read) : rows;

  function markOne(item: NotificationItem) {
    if (item.read) return;
    setReadIds((s) => new Set(s).add(item.id));
    startTransition(async () => {
      const res = await markNotificationReadAction(item.id);
      if (!res.ok) toast({ tone: "danger", title: res.error });
      router.refresh();
    });
  }

  function open(item: NotificationItem) {
    markOne(item);
    if (item.href) router.push(item.href);
  }

  function markAll() {
    setReadIds(new Set(items.map((i) => i.id)));
    startTransition(async () => {
      const res = await markAllNotificationsReadAction();
      if (!res.ok) toast({ tone: "danger", title: res.error });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          unread ? (
            <Button variant="ghost" onClick={markAll}>
              <CheckCheck /> {t.markAll}
            </Button>
          ) : null
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">{t.tabAll}</TabsTrigger>
          <TabsTrigger value="unread">{t.tabUnread(unread)}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-2">
        {list.length ? (
          <ul className="divide-y divide-border-soft">
            {list.map((item) => (
              <li key={item.id}>
                <NotificationRow
                  item={item}
                  onOpen={open}
                  trailing={
                    item.read ? null : (
                      <Button
                        variant="icon"
                        size="icon-sm"
                        className="mt-2 mr-1 shrink-0"
                        aria-label={t.markRead}
                        title={t.markRead}
                        onClick={() => markOne(item)}
                      >
                        <Check />
                      </Button>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Bell />} title={tab === "unread" ? t.emptyUnread : t.empty} />
        )}
      </Card>
    </div>
  );
}
