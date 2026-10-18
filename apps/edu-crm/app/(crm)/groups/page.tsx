import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { groupFormOptions, listGroups } from "./data";
import { GroupsView } from "./groups-view";
import { groupPerms } from "./perms";

export const metadata = { title: uz.groups.title };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ kurs?: string }> }) {
  const { tenant, staff } = await requirePage("groups", "/groups");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const [rows, options] = await Promise.all([listGroups(db, branch.filter), groupFormOptions(db, branch.filter)]);
  // Kurs kartasidagi "Ko'rish" (?kurs=<id>): shu kurs guruhlari filtrlangan holda ochiladi
  const { kurs } = await searchParams;
  const initialCourse = kurs && options.courses.some((c) => c.id === kurs) ? kurs : "all";
  return (
    <GroupsView
      rows={rows}
      courses={options.courses}
      initialCourse={initialCourse}
      teachers={options.teachers}
      rooms={options.rooms}
      branches={branch.options}
      selectedBranch={branch.selected}
      perms={groupPerms(staff.access)}
    />
  );
}
