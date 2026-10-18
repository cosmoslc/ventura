import { can } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getBranchContext } from "@/lib/server/branch";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { GroupProfile } from "../group-profile";
import { loadGroupProfile } from "../profile-data";

export const metadata = { title: uz.groups.title };

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { tenant, staff } = await requirePage("groups", "/groups");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const branch = await getBranchContext();
  const sp = await searchParams;
  // Ko'rinish xodimning filial cheklovi bo'yicha (tepadagi tanlovdan qat'i nazar)
  const props = await loadGroupProfile({
    tenant,
    access: staff.access,
    scope: staff.scope === "all" ? null : branch.options.map((b) => b.id),
    branches: branch.options,
    id: id.data,
    tab: sp.tab,
    month: sp.month,
  });
  if (!props) notFound();
  // Filial qatori — faqat tepada "Barcha filiallar" tanlanganda (bitta filial tanlansa ma'lumot ortiqcha)
  const showBranch = branch.enabled && branch.selected === "all" && branch.options.length > 1;
  // SMS (S3): bo'lim yoqilgan va "Shaxsiy SMS xabar yuborish" ruxsati bor
  const sms =
    (await hasFeature(tenant, "sms")) && can(staff.access, "students.sms_send") ? { centerName: tenant.name } : null;
  return <GroupProfile {...props} showBranch={showBranch} sms={sms} />;
}
