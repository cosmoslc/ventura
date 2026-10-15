import type { NotificationKind } from "@ventura/db/schema/tenant";
import { uz } from "@/lib/uz";

/*
 * Bildirishnomalar (E6d, ADR 0039): mijozga ketadigan ko'rinish va matnlar. Toza mantiq — bazasiz, testlanadi.
 * Matnlar yozilganda tayyorlanadi (o'qishda qayta hisoblanmaydi): keyin yozuv o'zgarsa ham xabar o'zgarmaydi.
 */

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  /** ISO */
  createdAt: string;
  read: boolean;
}

export interface NotificationDraft {
  kind: NotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
}

const t = uz.notifications;

/** Qo'ng'iroq ro'yxati va sahifa shu sondan ortiq so'ramaydi */
export const BELL_LIMIT = 10;
export const PAGE_LIMIT = 100;
/** Qo'ng'iroq o'qilmaganlar sonini shuncha vaqtda qayta so'raydi */
export const POLL_MS = 60_000;

export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function applyDraft(lead: { id: string; name: string; phone: string }, repeat: boolean): NotificationDraft {
  return {
    kind: "lead_apply",
    title: repeat ? t.applyRepeat : t.apply,
    body: clip(`${lead.name} · ${lead.phone}`, 500),
    href: `/leads/${lead.id}`,
  };
}

export function assignedDraft(leads: readonly { id: string; name: string }[]): NotificationDraft {
  const [first] = leads;
  if (leads.length === 1 && first)
    return { kind: "lead_assigned", title: t.assigned, body: clip(first.name, 500), href: `/leads/${first.id}` };
  return {
    kind: "lead_assigned",
    title: t.assignedMany(leads.length),
    body: clip(leads.map((l) => l.name).join(", "), 500),
    href: "/leads",
  };
}

export function approvalRequestDraft(requester: string, title: string): NotificationDraft {
  return {
    kind: "approval_request",
    title: t.approvalRequest,
    body: clip(`${requester}: ${title}`, 500),
    href: "/approvals",
  };
}

export function approvalDecidedDraft(
  approved: boolean,
  title: string,
  decider: string,
  note?: string | null,
): NotificationDraft {
  const parts = [title, note ? `${decider}: ${note}` : decider];
  return {
    kind: "approval_decided",
    title: approved ? t.approvalApproved : t.approvalRejected,
    body: clip(parts.join(" · "), 500),
    href: "/approvals",
  };
}

/** "Hozir", "5 daqiqa oldin", "3 soat oldin", "kecha", keyin — sana. */
export function ago(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t.agoNow;
  if (min < 60) return t.agoMinutes(min);
  const hours = Math.floor(min / 60);
  if (hours < 24) return t.agoHours(hours);
  const days = Math.floor(hours / 24);
  if (days === 1) return t.agoYesterday;
  if (days < 7) return t.agoDays(days);
  return new Date(iso).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });
}
