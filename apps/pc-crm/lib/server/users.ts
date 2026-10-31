import "server-only";
import { eq, desc } from "drizzle-orm";
import { users } from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";

export interface UserView {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export async function getDbUsers(): Promise<UserView[]> {
  const db = getDb();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString().slice(0, 10),
    lastLoginAt: u.lastLoginAt?.toISOString().slice(0, 10),
  }));
}

export async function toggleDbUserActive(id: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return null;

  const [updated] = await db
    .update(users)
    .set({ isActive: !user.isActive })
    .where(eq(users.id, id))
    .returning();

  return updated;
}
