import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import {
  smsPackages,
  smsPurchaseRequests,
  smsRelayMessages,
  smsWalletEntries,
  smsWallets,
} from "@ventura/db/schema/panel";

/*
 * Loyihalarning SMS qismlari hisobi (S4, ADR 0056). Qoldiq faqat shu funksiyalar orqali va har safar jurnal yozuvi
 * bilan o'zgaradi (bitta tranzaksiyada). Yuborishdan oldin qismlar band qilinadi; Eskiz qabul qilmasa yoki xabar
 * yetkazilmasa — bir marta qaytariladi. Eskiz haqiqiy qism sonini aytsa farqi tuzatiladi.
 */

type Tx = Parameters<Parameters<PanelDb["transaction"]>[0]>[0];

async function move(
  tx: Tx,
  projectId: string,
  delta: number,
  entry: {
    kind: "purchase" | "send" | "refund" | "adjust";
    ref?: string | null;
    note?: string | null;
    actorId?: string | null;
  },
): Promise<boolean> {
  if (delta === 0) return true;
  // Hisob bo'lmasa — ochiladi; yechishda qoldiq yetmasa yangilanmaydi
  await tx.insert(smsWallets).values({ projectId, balance: 0 }).onConflictDoNothing();
  const updated = await tx
    .update(smsWallets)
    .set({ balance: sql`${smsWallets.balance} + ${delta}`, updatedAt: new Date() })
    .where(and(eq(smsWallets.projectId, projectId), delta < 0 ? gte(smsWallets.balance, -delta) : undefined))
    .returning({ balance: smsWallets.balance });
  if (!updated.length) return false;
  await tx.insert(smsWalletEntries).values({
    projectId,
    delta,
    kind: entry.kind,
    ref: entry.ref ?? null,
    note: entry.note ?? null,
    actorId: entry.actorId ?? null,
  });
  return true;
}

export async function walletBalance(db: PanelDb, projectId: string): Promise<number> {
  const [row] = await db
    .select({ balance: smsWallets.balance })
    .from(smsWallets)
    .where(eq(smsWallets.projectId, projectId));
  return row?.balance ?? 0;
}

/** Yuborishdan oldin: qism yetsa band qiladi (true) */
export function reserve(db: PanelDb, projectId: string, parts: number): Promise<boolean> {
  return db.transaction((tx) => move(tx, projectId, -parts, { kind: "send" }));
}

/** Eskiz qabul qilmadi — band qilingan qismlar qaytadi */
export function release(db: PanelDb, projectId: string, parts: number, note: string): Promise<boolean> {
  return db.transaction((tx) => move(tx, projectId, parts, { kind: "refund", note: note.slice(0, 200) }));
}

/** Eskiz qabul qildi — xabar yozib qo'yiladi (keyin natijasi bo'yicha hisob-kitob) */
export async function recordSent(db: PanelDb, projectId: string, providerId: string, parts: number) {
  await db.insert(smsRelayMessages).values({ providerId, projectId, parts }).onConflictDoNothing();
}

/**
 * Yetkazish natijasi: failed — band qilingan qismlar qaytadi; delivered — Eskiz aytgan qism soni bilan farqi
 * tuzatiladi. Bir xabar bir marta hisoblanadi (FOR UPDATE + holat sharti).
 */
export async function settle(
  db: PanelDb,
  projectId: string,
  providerId: string,
  state: "delivered" | "failed" | "pending",
  actualParts: number | null,
): Promise<void> {
  if (state === "pending") return;
  await db.transaction(async (tx) => {
    const [msg] = await tx
      .select()
      .from(smsRelayMessages)
      .where(and(eq(smsRelayMessages.providerId, providerId), eq(smsRelayMessages.projectId, projectId)))
      .for("update");
    if (!msg || msg.status !== "sent") return;
    if (state === "failed") {
      await move(tx, projectId, msg.parts, { kind: "refund", ref: providerId, note: "Yetkazilmadi" });
    } else if (actualParts && actualParts !== msg.parts) {
      // Ko'proq qism ketgan bo'lsa qoldiq yetmasa ham nolgacha yechiladi; kamroq bo'lsa farqi qaytadi
      const diff = msg.parts - actualParts;
      const ok = await move(tx, projectId, diff, {
        kind: diff > 0 ? "refund" : "send",
        ref: providerId,
        note: "Qismlar farqi",
      });
      if (!ok && diff < 0) {
        const bal = (await tx.select().from(smsWallets).where(eq(smsWallets.projectId, projectId)))[0]?.balance ?? 0;
        if (bal > 0) await move(tx, projectId, -bal, { kind: "send", ref: providerId, note: "Qismlar farqi" });
      }
    }
    await tx
      .update(smsRelayMessages)
      .set({ status: state, settledAt: new Date(), ...(actualParts ? { parts: actualParts } : {}) })
      .where(eq(smsRelayMessages.providerId, providerId));
  });
}

/** Markaz paket so'radi */
export async function requestPurchase(
  db: PanelDb,
  projectId: string,
  packageId: string,
  requestedBy: string,
): Promise<{ id: string } | null> {
  const [pkg] = await db
    .select()
    .from(smsPackages)
    .where(and(eq(smsPackages.id, packageId), eq(smsPackages.active, true)));
  if (!pkg) return null;
  const [row] = await db
    .insert(smsPurchaseRequests)
    .values({
      projectId,
      packageId,
      packageName: pkg.name,
      parts: pkg.parts,
      price: pkg.price,
      requestedBy: requestedBy.slice(0, 120) || null,
    })
    .returning({ id: smsPurchaseRequests.id });
  return row ?? null;
}

/** Admin: to'lov keldi — qismlar hisobga; yoki bekor. Faqat kutilayotgan so'rov. */
export async function decidePurchase(
  db: PanelDb,
  requestId: string,
  paid: boolean,
  actorId: string,
): Promise<{ projectId: string; parts: number } | null> {
  return db.transaction(async (tx) => {
    const [req] = await tx
      .select()
      .from(smsPurchaseRequests)
      .where(eq(smsPurchaseRequests.id, requestId))
      .for("update");
    if (!req || req.status !== "pending") return null;
    await tx
      .update(smsPurchaseRequests)
      .set({ status: paid ? "paid" : "cancelled", decidedAt: new Date(), decidedBy: actorId })
      .where(eq(smsPurchaseRequests.id, requestId));
    if (paid)
      await move(tx, req.projectId, req.parts, { kind: "purchase", ref: req.id, note: req.packageName, actorId });
    return { projectId: req.projectId, parts: req.parts };
  });
}

/** Admin: qo'lda qo'shish yoki yechish (sabab bilan) */
export function adjustWallet(db: PanelDb, projectId: string, delta: number, note: string, actorId: string) {
  return db.transaction((tx) => move(tx, projectId, delta, { kind: "adjust", note: note.slice(0, 200), actorId }));
}

export async function pendingPurchases(db: PanelDb, projectId: string) {
  return db
    .select()
    .from(smsPurchaseRequests)
    .where(and(eq(smsPurchaseRequests.projectId, projectId), eq(smsPurchaseRequests.status, "pending")))
    .orderBy(desc(smsPurchaseRequests.createdAt));
}

export async function activePackages(db: PanelDb) {
  return db.select().from(smsPackages).where(eq(smsPackages.active, true)).orderBy(smsPackages.parts);
}
