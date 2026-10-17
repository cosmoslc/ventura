import { getTenantDb } from "@/lib/server/deps";
import { DEVICE_STATUSES, deviceOwners, listDevices } from "@/lib/server/devices";
import { currentDeviceId } from "@/lib/server/request";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { DevicesView } from "./devices-view";

export const metadata = { title: uz.devices.title };

interface Params {
  user?: string;
  status?: string;
  q?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Qurilmalar (E6g): faqat direktor — manzil lib/access.ts da yo'q, shuning uchun boshqaga yopiq */
export default async function DevicesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { tenant } = await requirePage("students", "/devices");
  const sp = await searchParams;
  const userId = sp.user && UUID.test(sp.user) ? sp.user : null;
  const status = DEVICE_STATUSES.find((s) => s === sp.status) ?? null;
  const q = (sp.q ?? "").slice(0, 100);
  const db = getTenantDb(tenant);
  const [list, owners] = await Promise.all([
    listDevices(db, { userId, status, q }, await currentDeviceId()),
    deviceOwners(db),
  ]);
  return (
    <DevicesView
      rows={list.rows}
      total={list.total}
      truncated={list.truncated}
      owners={owners}
      userId={userId ?? ""}
      status={status ?? ""}
      q={q}
    />
  );
}
