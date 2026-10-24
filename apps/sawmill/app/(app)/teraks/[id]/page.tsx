import { notFound } from "next/navigation";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getTerakDetail } from "../actions";
import { TerakDetailClient } from "./terak-detail-client";

export default async function TerakDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return null;

  const data = await getTerakDetail(deps.db, id);
  if (!data) notFound();

  const canManage = can(user.role, "teraks.manage");
  const locale = user.locale ?? "uz";

  return (
    <TerakDetailClient
      terak={data.terak}
      stock={data.stock}
      costs={data.costs}
      totalCostsAmount={data.totalCostsAmount}
      totalRes={data.totalRes}
      sartirofkaSoni={data.sartirofkaSoni}
      remainingRes={data.remainingRes}
      works={data.works}
      totalWorkAmount={data.totalWorkAmount}
      canManage={canManage}
      locale={locale}
    />
  );
}
