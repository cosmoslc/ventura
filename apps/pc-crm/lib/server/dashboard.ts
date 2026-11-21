import "server-only";
import { count, eq } from "drizzle-orm";
import { orders, pcOrders } from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";

export async function getDbNewOrderCount() {
  const db = getDb();
  const [siteRows, pcRows] = await Promise.all([
    db.select({ count: count() }).from(orders).where(eq(orders.status, "new")),
    db.select({ count: count() }).from(pcOrders).where(eq(pcOrders.status, "new")),
  ]);
  return Number(siteRows[0]?.count ?? 0) + Number(pcRows[0]?.count ?? 0);
}
