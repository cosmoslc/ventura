import { can } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ArchiveView } from "./archive-view";
import { archiveData } from "./data";

export const metadata = { title: uz.archive.title };

export default async function ArchivePage() {
  const { tenant, staff } = await requirePage("students", "/archive");
  const branch = await getBranchContext();
  const data = await archiveData(getTenantDb(tenant), branch.filter, await hasFeature(tenant, "leads"));
  return (
    <ArchiveView
      data={data}
      branches={branch.options}
      canRestore={can(staff.access, "archive.restore")}
      canPurge={can(staff.access, "archive.permanent_delete")}
    />
  );
}
