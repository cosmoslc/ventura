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
  return <GroupProfile {...props} />;
}
