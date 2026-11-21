import "server-only";
import { eq, desc, isNotNull } from "drizzle-orm";
import { accounts, orders, sessions, users } from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";

export interface UserView {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  provider: "google" | "email";
  ordersCount: number;
  totalSpent: bigint;
  createdAt: string;
  lastLoginAt?: string;
}

export async function getDbUsers(): Promise<UserView[]> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.role, "customer")).orderBy(desc(users.createdAt));
  const orderRows = await db
    .select({ userId: orders.userId, total: orders.total, status: orders.status })
    .from(orders)
    .where(isNotNull(orders.userId));
  const googleAccounts = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.providerId, "google"));
  const googleUserIds = new Set(googleAccounts.map((a) => a.userId));
  const ordersByUser = new Map<string, { count: number; spent: bigint }>();
  for (const order of orderRows) {
    if (!order.userId || order.status === "cancelled") continue;
    const aggregate = ordersByUser.get(order.userId) ?? { count: 0, spent: 0n };
    aggregate.count += 1;
    if (order.status === "delivered") aggregate.spent += order.total;
    ordersByUser.set(order.userId, aggregate);
  }
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    role: u.role,
    isActive: u.isActive,
    provider: googleUserIds.has(u.id) ? "google" : "email",
    ordersCount: ordersByUser.get(u.id)?.count ?? 0,
    totalSpent: ordersByUser.get(u.id)?.spent ?? 0n,
    createdAt: u.createdAt.toISOString().slice(0, 10),
    lastLoginAt: u.lastLoginAt?.toISOString().slice(0, 10),
  }));
}

export async function toggleDbUserActive(id: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, id)).for("update");
    if (!user || user.role !== "customer") return null;

    const isActive = !user.isActive;
    const [updated] = await tx.update(users).set({ isActive }).where(eq(users.id, id)).returning();
    if (!isActive) await tx.delete(sessions).where(eq(sessions.userId, id));
    return updated;
  });
}
