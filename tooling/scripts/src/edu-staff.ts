import { eq } from "drizzle-orm";
import { normalizeUzPhone, temporaryPassword } from "@ventura/auth";
import { createStaffUser, ensurePositions, findStaffByPhone } from "@ventura/auth/staff";
import { branches, positions, users } from "@ventura/db/schema/tenant";
import { tenantAudit } from "@ventura/security";
import { done, fail } from "./lib";
import { flag, tenantContext } from "./edu-lib";

/*
 * pnpm edu:staff -- --tenant bilim --phone "90 123 45 67" --name "Ali Valiyev"
 *   [--position branch_manager | --director] [--branch "Asosiy filial"] [--telegram-chat-id 123456789]
 *
 * Mijoz tizimiga xodim qo'shadi (birinchi direktor shu yo'l bilan yaratiladi). Vaqtinchalik parol bir marta
 * ekranga chiqadi; birinchi kirishda xodim uni almashtiradi va markaz botini ulaydi. --telegram-chat-id
 * berilsa, Telegram darhol ulanadi (chat ID ma'lum bo'lsa yoki sinovda).
 */

const slug = flag("tenant") ?? "";
const phone = normalizeUzPhone(flag("phone") ?? "");
if (!phone) fail("--phone noto'g'ri. Masalan: 90 123 45 67");
const name = (flag("name") ?? "").trim();
if (name.length < 2) fail("--name kerak");
// Lavozim ko'rsatilmasa — direktor (birinchi xodim shu yo'l bilan yaratiladi)
const positionCode = flag("position");
const director = process.argv.includes("--director") || !positionCode;
const chatId = flag("telegram-chat-id");
if (chatId && !/^-?\d+$/.test(chatId)) fail("--telegram-chat-id raqam bo'lishi kerak");

const { tenant, db, auth } = tenantContext(slug);
if (await findStaffByPhone(db, phone)) fail(`Bu raqamli xodim ${tenant.name} tizimida allaqachon bor`);

await ensurePositions(db);
let positionIds: string[] = [];
let positionName = "Direktor";
if (!director) {
  const [p] = await db
    .select({ id: positions.id, name: positions.name })
    .from(positions)
    .where(eq(positions.code, positionCode!));
  if (!p) fail(`Lavozim topilmadi: ${positionCode} (branch_manager, senior_admin, teacher, accountant, ...)`);
  positionIds = [p.id];
  positionName = p.name;
}

// Direktor hamma filialni ko'radi; qolganlarga filial biriktiriladi (berilmasa — birinchi filial)
let branchIds: string[] = [];
if (!director) {
  const branchName = flag("branch");
  const rows = branchName
    ? await db.select({ id: branches.id }).from(branches).where(eq(branches.name, branchName))
    : await db.select({ id: branches.id }).from(branches).limit(1);
  if (!rows.length) fail(`Filial topilmadi${branchName ? `: ${branchName}` : ""}`);
  branchIds = rows.map((r) => r.id);
}

const password = temporaryPassword();
const user = await createStaffUser(auth, db, {
  phone,
  name,
  password,
  role: director ? "director" : "staff",
  branchIds,
  positionIds,
  mustChangePassword: true,
});
if (chatId) await db.update(users).set({ telegramChatId: chatId, twoFactorEnabled: true }).where(eq(users.id, user.id));
await tenantAudit.record(db, {
  actor: { type: "cli" },
  action: "user.create",
  target: { type: "user", id: user.id },
  metadata: {
    role: director ? "director" : "staff",
    position: positionName,
    branches: branchIds.length,
    telegram: !!chatId,
  },
});
await db.close();

console.log(`\n${tenant.name} — ${positionName}: ${name}`);
console.log(`Kirish: ${tenant.hosts[0]}`);
console.log(`Vaqtinchalik parol (bir marta ko'rsatiladi): ${password}`);
done("Xodim qo'shildi. Birinchi kirishda parolni almashtiradi.");
