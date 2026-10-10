import { findUserByPhone, formatPhone, normalizeUzPhone, notifySuperAdmins, unlockUser } from "@ventura/auth";
import { escapeHtml } from "@ventura/integrations";
import { ask, context, done, fail } from "./lib";

/* pnpm admin:unlock — 5 ta xato urinishdan keyin bloklangan hisobni ochish (masalan, super adminning o'zi bloklansa). */

const { db, telegram } = context();

const phone = normalizeUzPhone(await ask("Telefon raqam (+998 ...): "));
if (!phone) fail("Telefon raqam noto'g'ri");
const user = await findUserByPhone(db, phone);
if (!user) fail("Bunday foydalanuvchi yo'q");
if (!user.lockedAt) done(`${user.name} bloklanmagan`);

await unlockUser({ db, telegram }, user.id, { type: "cli", name: "pnpm admin:unlock" });
await notifySuperAdmins(
  { db, telegram },
  `🔓 <b>Hisob ochildi</b> (terminal orqali): ${escapeHtml(user.name)} (${formatPhone(phone)})`,
);

done(`${user.name} hisobi ochildi`);
