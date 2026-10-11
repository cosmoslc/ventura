import { findUserByPhone, formatPhone, normalizeUzPhone, notifySuperAdmins, resetTelegram } from "@ventura/auth";
import { escapeHtml } from "@ventura/integrations";
import { audit } from "@ventura/security";
import { ask, confirm, context, done, fail } from "./lib";

/*
 * pnpm admin:reset-2fa — Telegram ishlamay qolganda (telefon yo'qolgan va h.k.) yagona zaxira yo'l.
 * Telegram bog'lanishi o'chiriladi, barcha sessiyalar yopiladi; keyingi kirishda Telegram qayta ulanadi.
 */

const { db, telegram } = context();

const phone = normalizeUzPhone(await ask("Telefon raqam (+998 ...): "));
if (!phone) fail("Telefon raqam noto'g'ri");
const user = await findUserByPhone(db, phone);
if (!user) fail("Bunday foydalanuvchi yo'q");

if (!(await confirm(`${user.name} (${formatPhone(phone)}) uchun Telegram 2FA qayta o'rnatilsinmi?`)))
  fail("Bekor qilindi");

await resetTelegram(db, user.id);
await audit.record(db, {
  actor: { type: "cli", name: "pnpm admin:reset-2fa" },
  action: "user.reset_2fa",
  target: { type: "user", id: user.id },
});
await notifySuperAdmins(
  { db, telegram },
  `🛠 <b>2FA qayta o'rnatildi</b> (terminal orqali): ${escapeHtml(user.name)} (${formatPhone(phone)})`,
);

done("Tayyor. Keyingi kirishda parol so'raladi, so'ng Telegram qayta ulanadi.");
