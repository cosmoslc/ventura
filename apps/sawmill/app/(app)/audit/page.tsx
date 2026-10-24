import { redirect } from "next/navigation";
import { can } from "@/lib/auth/roles";
import { requireUser } from "@/lib/server/session";
import { getAuditEventsAction } from "./actions";
import { AuditClient } from "./audit-client";

export default async function AuditPage() {
  const { user } = await requireUser();
  if (!can(user.role, "audit.view")) {
    redirect("/");
  }

  const initialEvents = await getAuditEventsAction(150);

  return <AuditClient initialEvents={initialEvents} locale={user.locale} />;
}
