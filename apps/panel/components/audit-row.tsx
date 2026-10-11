import type { auditEvents } from "@ventura/db/schema/panel";
import { Badge } from "@ventura/ui/badge";
import { formatDateTime } from "@/lib/format";
import { uz } from "@/lib/uz";

type AuditEvent = typeof auditEvents.$inferSelect;

export function actionLabel(action: string): string {
  return uz.audit.actions[action] ?? action;
}

export function actionTone(action: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (action === "auth.locked" || action === "auth.failed" || action === "project.trash") return "danger";
  if (action === "deploy.failed") return "danger";
  if (action === "deploy.ready") return "success";
  if (action.startsWith("auth.")) return "neutral";
  if (action.startsWith("user.") || action.startsWith("settings.")) return "warning";
  if (action.endsWith(".create") || action === "project.restore") return "success";
  return "info";
}

export function actorLabel(e: Pick<AuditEvent, "actorType" | "actorName">): string {
  if (e.actorType === "system") return uz.audit.system;
  if (e.actorType === "cli") return e.actorName ? `${uz.audit.cli} · ${e.actorName}` : uz.audit.cli;
  return e.actorName ?? "—";
}

/** Bosh sahifadagi qisqa ko'rinish. */
export function AuditRow({ event }: { event: AuditEvent }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
      <Badge tone={actionTone(event.action)} dot>
        {actionLabel(event.action)}
      </Badge>
      <span className="text-body font-semibold text-foreground">{actorLabel(event)}</span>
      {event.targetType ? (
        <span className="font-mono text-caption text-muted-foreground">
          {event.targetType}
          {event.targetId ? ` · ${event.targetId.slice(0, 8)}` : ""}
        </span>
      ) : null}
      <span className="ml-auto font-mono text-xs text-muted-foreground">{formatDateTime(event.at)}</span>
    </li>
  );
}
