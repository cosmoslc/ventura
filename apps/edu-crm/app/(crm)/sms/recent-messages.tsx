"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge, type BadgeProps } from "@ventura/ui/badge";
import { Card } from "@ventura/ui/card";
import { EmptyState } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { displayPhone } from "@/lib/format";
import type { SmsMessageRow } from "@/lib/server/sms/messages";
import { uz } from "@/lib/uz";

const t = uz.smsMessages;

const TONE: Record<SmsMessageRow["status"], BadgeProps["tone"]> = {
  queued: "neutral",
  sending: "info",
  sent: "info",
  delivered: "success",
  failed: "danger",
  cancelled: "neutral",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });

/**
 * So'nggi xabarlar: navbatdagilar ham, yuborilganlar ham. Navbatda yoki yo'lda xabar bo'lsa sahifa har 10 soniyada
 * o'zi yangilanadi (holat fon vazifasida o'zgaradi).
 */
export function RecentMessages({ rows }: { rows: SmsMessageRow[] }) {
  const router = useRouter();
  const live = rows.some((r) => r.status === "queued" || r.status === "sending" || r.status === "sent");
  React.useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [live, router]);

  return (
    <div className="space-y-3">
      <h2 className="type-heading text-base">{t.title}</h2>
      {rows.length ? (
        <TableWrap>
          <Table className="min-w-[860px]">
            <THead>
              <Tr>
                <Th className="w-28">{t.colTime}</Th>
                <Th className="w-52">{t.colTo}</Th>
                <Th>{t.colText}</Th>
                <Th className="w-56">{t.colStatus}</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="whitespace-nowrap text-muted-foreground">{when(r.createdAt)}</Td>
                  <Td>
                    {r.studentId && r.studentName ? (
                      <Link href={`/students/${r.studentId}`} className="font-semibold text-foreground hover:underline">
                        {r.studentName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground">{t.recipients[r.recipient]}</span>
                    )}
                    <div className="text-caption text-muted-foreground">
                      {[displayPhone(r.phone), r.studentId ? t.recipients[r.recipient] : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </Td>
                  <Td>
                    <span className="line-clamp-2" title={r.text}>
                      {r.text}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={TONE[r.status]} dot>
                      {t.statuses[r.status]}
                    </Badge>
                    {r.error && r.status !== "delivered" ? (
                      <div className="mt-1 line-clamp-2 text-caption text-(--danger-fg)" title={r.error}>
                        {r.error}
                      </div>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      ) : (
        <Card>
          <EmptyState icon={<Inbox />} title={t.empty} description={t.emptyHint} />
        </Card>
      )}
    </div>
  );
}
