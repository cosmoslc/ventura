import { createAdminUser, findUserByPhone, formatPhone, normalizeUzPhone, passwordProblem } from "@ventura/auth";
import { escapeHtml } from "@ventura/integrations";
import { audit } from "@ventura/security";
import { ask, askHidden, confirm, context, done, fail } from "./lib";

/*
 * pnpm admin:create — super admin yaratish (birinchi admin va favqulodda holatlar uchun).
 * Telegram chat ID botga /start yuborilganda avtomatik aniqlanadi; 2FA darhol yoqiladi.
 */

const { db, telegram, auth } = context();

console.log("\nVentura — super admin yaratish\n");

const phone = normalizeUzPhone(await ask("Telefon raqam (+998 ...): "));
if (!phone) fail("Telefon raqam noto'g'ri. Masalan: 90 123 45 67");
if (await findUserByPhone(db, phone)) fail(`${formatPhone(phone)} raqamli foydalanuvchi allaqachon bor`);

const name = await ask("Ism familiya: ");
if (name.length < 2) fail("Ism kiritilmadi");

const password = await askHidden("Parol (ko'rinmaydi): ");
const problem = passwordProblem(password);
if (problem) fail(problem);
if ((await askHidden("Parolni takrorlang: ")) !== password) fail("Parollar mos kelmadi");

// ---------- Telegram ----------
const me = await telegram.getMe().catch((e: Error) => fail(`Telegram bot javob bermadi: ${e.message}`));
const webhook = await telegram.getWebhookInfo();
let chatId: string;

if (webhook.url) {
  console.log(`\n@${me.username} webhook'ga ulangan — chat ID avtomatik aniqlanmaydi.`);
  chatId = await ask("Telegram chat ID (masalan @userinfobot orqali bilib oling): ");
  if (!/^-?\d+$/.test(chatId)) fail("Chat ID raqam bo'lishi kerak");
} else {
  // Eski xabarlarni o'tkazib yuborish: oxirgi update'dan keyingisini kutamiz
  const pending = await telegram.getUpdates();
  let offset = pending.length ? pending[pending.length - 1]!.update_id + 1 : undefined;
  console.log(`\nTelegram'da @${me.username} botini oching va /start yuboring (2 daqiqa kutaman)...`);
  const deadline = Date.now() + 120_000;
  let found: { id: number; who: string } | null = null;
  while (!found && Date.now() < deadline) {
    const updates = await telegram.getUpdates(offset, 25);
    for (const u of updates) {
      offset = u.update_id + 1;
      const m = u.message;
      if (m?.text?.startsWith("/start") && m.chat.type === "private") {
        found = {
          id: m.chat.id,
          who: `${m.from?.first_name ?? ""}${m.from?.username ? ` (@${m.from.username})` : ""}`,
        };
      }
    }
  }
  // Ko'rilgan update'larni tasdiqlab qo'yamiz
  if (offset) await telegram.getUpdates(offset);
  if (!found) fail("2 daqiqa ichida /start kelmadi. Qaytadan urinib ko'ring.");
  if (!(await confirm(`\n/start yuborgan: ${found.who}. Shu sizmisiz?`))) fail("Bekor qilindi");
  chatId = String(found.id);
}

try {
  await telegram.sendMessage(chatId, `🔐 <b>Ventura</b>: shu chat 2FA kodlari va ogohlantirishlar uchun ulanmoqda.`);
} catch (e) {
  fail(`Shu chatga xabar yuborib bo'lmadi: ${(e as Error).message}`);
}

const user = await createAdminUser(auth, {
  phone,
  name,
  password,
  role: "super_admin",
  telegramChatId: chatId,
  twoFactorEnabled: true,
});

await audit.record(db, {
  actor: { type: "cli", name: "pnpm admin:create" },
  action: "user.create",
  target: { type: "user", id: user.id },
  metadata: { role: "super_admin", phone: formatPhone(phone), via: "cli" },
});

await telegram.sendMessage(
  chatId,
  `✅ <b>Super admin yaratildi</b>: ${escapeHtml(name)} (${formatPhone(phone)})\nEndi har kirishda kod shu yerga keladi.`,
);

done(`Super admin yaratildi: ${name}, ${formatPhone(phone)}. Panelga kirishingiz mumkin.`);
