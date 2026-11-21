import { notFound, redirect } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getWorkerProfileData } from "./actions";
import { WorkerProfileClient } from "./worker-profile-client";

interface WorkerProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkerProfilePage({ params }: WorkerProfilePageProps) {
  const { user, tenant } = await requireUser();
  if (!(await hasFeature(tenant, "workers"))) {
    redirect("/bolim-yopiq");
  }

  const { deps } = await currentDeps();
  if (!deps) return null;

  const { id } = await params;
  const data = await getWorkerProfileData(deps.db, id);

  if (!data) {
    notFound();
  }

  const canManage = can(user.role, "workers.manage");
  const locale = user.locale ?? "uz";

  return <WorkerProfileClient data={data} canManage={canManage} locale={locale} />;
}
