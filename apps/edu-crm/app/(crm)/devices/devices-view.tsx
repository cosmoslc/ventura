"use client";

import { MonitorSmartphone } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { ConfirmModal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatWhen } from "@/lib/devices";
import type { DeviceRow } from "@/lib/server/devices";
import { uz } from "@/lib/uz";
import { setDeviceBlockedAction } from "./actions";

const t = uz.devices;
const ALL = "all";

export function DevicesView({
  rows,
  total,
  truncated,
  owners,
  userId,
  status,
  q,
}: {
  rows: DeviceRow[];
  total: number;
  truncated: boolean;
  owners: { id: string; name: string }[];
  userId: string;
  status: string;
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [query, setQuery] = React.useState(q);
  const [target, setTarget] = React.useState<{ row: DeviceRow; block: boolean } | null>(null);
  // Oyna yopilayotganda matn o'zgarib ketmasligi uchun target saqlanadi, faqat open o'chadi
  const [open, setOpen] = React.useState(false);
  const ask = (row: DeviceRow, block: boolean) => {
    setTarget({ row, block });
    setOpen(true);
  };

  const go = React.useCallback(
    (patch: Partial<{ user: string; status: string; q: string }>) => {
      const next = { user: userId, status, q, ...patch };
      const sp = new URLSearchParams();
      if (next.user) sp.set("user", next.user);
      if (next.status) sp.set("status", next.status);
      if (next.q.trim()) sp.set("q", next.q.trim());
      const qs = sp.toString();
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [userId, status, q, pathname, router],
  );

  // Qidiruv: yozishdan 0,35 s keyin so'rov
  React.useEffect(() => {
    if (query.trim() === q.trim()) return;
    const id = window.setTimeout(() => go({ q: query }), 350);
    return () => window.clearTimeout(id);
  }, [query, q, go]);

  async function apply({ row, block }: { row: DeviceRow; block: boolean }) {
    const res = await setDeviceBlockedAction({ id: row.id, blocked: block });
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: block ? t.blockedDone : t.unblockedDone, description: row.userName });
    router.refresh();
  }

  const filtered = !!(userId || status || q.trim());
  const deviceName = (r: DeviceRow) => r.name ?? t.unknown;

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={t.staff}
          value={userId || ALL}
          onValueChange={(v) => go({ user: v === ALL ? "" : v })}
          options={[{ value: ALL, label: t.allStaff }, ...owners.map((o) => ({ value: o.id, label: o.name }))]}
        />
        <FilterSelect
          label={t.status}
          value={status || ALL}
          onValueChange={(v) => go({ status: v === ALL ? "" : v })}
          options={[
            { value: ALL, label: t.allStatuses },
            { value: "active", label: t.active },
            { value: "blocked", label: t.blocked },
          ]}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{t.count(total)}</span>
        </FilterEnd>
      </FilterBar>

      {truncated ? <Notice tone="warning">{t.truncated(rows.length)}</Notice> : null}

      <Card className={`overflow-hidden transition-opacity duration-150 ${pending ? "opacity-60" : ""}`}>
        {rows.length ? (
          <TableWrap className="rounded-none border-0">
            <Table className="min-w-[760px]">
              <THead>
                <Tr>
                  <Th>{t.colDevice}</Th>
                  <Th>{t.colStaff}</Th>
                  <Th>{t.colIp}</Th>
                  <Th>{t.colLastLogin}</Th>
                  <Th className="text-right">{t.colLogins}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th className="w-px" />
                </Tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="text-body font-bold text-foreground">{deviceName(r)}</div>
                      <div className="text-caption text-muted-foreground">
                        {r.current ? `${t.current} · ` : ""}
                        {t.firstLogin(formatWhen(r.firstSeenAt))}
                      </div>
                    </Td>
                    <Td className="text-body text-foreground">{r.userName}</Td>
                    <Td className="font-mono text-caption whitespace-nowrap">{r.ip ?? "—"}</Td>
                    <Td className="font-mono text-caption whitespace-nowrap">{formatWhen(r.lastSeenAt)}</Td>
                    <Td className="text-right font-mono font-semibold text-foreground">{r.loginCount}</Td>
                    <Td>
                      {r.blockedAt ? (
                        <>
                          <div className="text-body font-bold text-destructive-text">{t.blocked}</div>
                          <div className="text-caption whitespace-nowrap text-muted-foreground">
                            {t.blockedAt(formatWhen(r.blockedAt), r.blockedByName)}
                          </div>
                        </>
                      ) : (
                        <span className="text-body text-foreground">{t.active}</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      {r.blockedAt ? (
                        <Button variant="ghost" size="sm" onClick={() => ask(r, false)}>
                          {t.unblock}
                        </Button>
                      ) : r.current ? null : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive-text"
                          onClick={() => ask(r, true)}
                        >
                          {t.block}
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            icon={<MonitorSmartphone />}
            title={filtered ? uz.common.nothingFound : t.empty}
            description={filtered ? undefined : t.emptyHint}
          />
        )}
      </Card>

      <ConfirmModal
        open={open}
        onOpenChange={setOpen}
        title={target?.block === false ? t.unblockTitle : t.blockTitle}
        message={
          target ? (target.block ? t.blockMessage : t.unblockMessage)(target.row.userName, deviceName(target.row)) : ""
        }
        confirmLabel={target?.block === false ? t.confirmUnblock : t.confirmBlock}
        cancelLabel={t.cancel}
        onConfirm={() => target && void apply(target)}
      />
    </div>
  );
}
