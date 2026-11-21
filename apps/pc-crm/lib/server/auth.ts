import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { users } from "@ventura/db/schema/pc-crm";
import { getDb } from "@/lib/db";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getServerSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user?.id) return null;
    const [activeUser] = await getDb()
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    return activeUser?.isActive ? session : null;
  } catch (err) {
    console.error("getServerSession error:", err);
    return null;
  }
}

export async function requireUser() {
  const session = await getServerSession();
  if (!session?.user?.id) throw new AuthorizationError("Tizimga kiring");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const [account] = await getDb().select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);
  if (account?.role !== "admin") {
    throw new AuthorizationError("Bu amal uchun admin huquqi kerak");
  }
  return user;
}
