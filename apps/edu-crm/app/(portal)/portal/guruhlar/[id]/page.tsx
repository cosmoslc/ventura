import { notFound } from "next/navigation";
import { z } from "zod";
import { getTenantDb } from "@/lib/server/deps";
import { portalStudentGroupDetail } from "@/lib/server/portal";
import { requireStudent, requireTenant } from "@/lib/server/session";
import { PortalGroupDetailView } from "./group-view";
import { uz } from "@/lib/uz";

export const metadata = { title: uz.portal.guruhTafsilotlariOquvchiPortali };

/**
 * Guruh tafsilotlari sahifasi (ADR 0063).
 * Muallif / Agent: Google Gemini
 */
export default async function PortalGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await requireTenant();
  const staff = await requireStudent();
  const idParsed = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!idParsed.success) notFound();

  const db = getTenantDb(tenant);
  const data = await portalStudentGroupDetail(db, staff.studentId, idParsed.data);
  if (!data) notFound();

  return <PortalGroupDetailView data={data} />;
}
