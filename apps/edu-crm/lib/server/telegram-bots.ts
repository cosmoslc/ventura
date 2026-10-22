import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { settings, students, teachers, users } from "@ventura/db/schema/tenant";
import { createTelegram, escapeHtml, type Telegram, type TelegramUpdate } from "@ventura/integrations";
import type { Tenant } from "@ventura/tenants";
import {
  type BotRole,
  parseTelegramBotsConfig,
  type SingleBotSettings,
  type TelegramBotsConfig,
  type TelegramBotsStats,
  TELEGRAM_BOTS_KEY,
} from "@/lib/telegram-bots";
import { putSetting } from "./center";

/** Markazdagi Telegram botlar sozlamalarini yuklaydi */
export async function getTelegramBotsConfig(db: TenantDb): Promise<TelegramBotsConfig> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, TELEGRAM_BOTS_KEY));
  return parseTelegramBotsConfig(row?.value);
}

/** Sozlamalarni saqlaydi va audit uchun eski qiymatni qaytaradi */
export async function saveTelegramBotsConfig(
  db: TenantDb,
  config: TelegramBotsConfig,
  staffId: string,
): Promise<unknown> {
  return putSetting(db, TELEGRAM_BOTS_KEY, config, staffId);
}

/** Har bir bot bo'yicha "Ishlatyapti" va "Hali ishlatmayapti" statistikasini hisoblaydi */
export async function getTelegramBotsStats(db: TenantDb): Promise<TelegramBotsStats> {
  // 1. O'qituvchilar statistikasi
  const allTeachers = await db
    .select({
      id: teachers.id,
      teacherChatId: teachers.telegramChatId,
      userChatId: users.telegramChatId,
    })
    .from(teachers)
    .leftJoin(users, eq(teachers.userId, users.id))
    .where(isNull(teachers.archivedAt));

  const teacherTotal = allTeachers.length;
  const teacherActive = allTeachers.filter((t) => !!(t.teacherChatId || t.userChatId)).length;
  const teacherInactive = Math.max(0, teacherTotal - teacherActive);

  // 2. O'quvchilar statistikasi (faol o'quvchilar)
  const allStudents = await db
    .select({
      id: students.id,
      userChatId: users.telegramChatId,
      parentPhone: students.parentPhone,
      parentChatId: students.parentTelegramChatId,
    })
    .from(students)
    .leftJoin(users, eq(students.userId, users.id))
    .where(
      and(
        isNull(students.archivedAt),
        sql`${students.status} in ('trial', 'active', 'paused', 'returned')`,
      ),
    );

  const studentTotal = allStudents.length;
  const studentActive = allStudents.filter((s) => !!s.userChatId).length;
  const studentInactive = Math.max(0, studentTotal - studentActive);

  // 3. Ota-onalar statistikasi (ota-ona telefoni kiritilgan o'quvchilar)
  const studentsWithParents = allStudents.filter((s) => !!s.parentPhone?.trim());
  const parentTotal = studentsWithParents.length;
  const parentActive = studentsWithParents.filter((s) => !!s.parentChatId).length;
  const parentInactive = Math.max(0, parentTotal - parentActive);

  const calcPct = (act: number, tot: number) => (tot > 0 ? Math.round((act / tot) * 100) : 0);

  return {
    teacher: {
      total: teacherTotal,
      active: teacherActive,
      inactive: teacherInactive,
      percentage: calcPct(teacherActive, teacherTotal),
    },
    student: {
      total: studentTotal,
      active: studentActive,
      inactive: studentInactive,
      percentage: calcPct(studentActive, studentTotal),
    },
    parent: {
      total: parentTotal,
      active: parentActive,
      inactive: parentInactive,
      percentage: calcPct(parentActive, parentTotal),
    },
  };
}

/** Telefon raqamni solishtirish uchun tozalaydi (oxirgi 9 ta raqam: 901234567) */
function last9Digits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

/** Berilgan bot uchun Telegram klientini yaratadi */
export function botClient(token: string): Telegram {
  return createTelegram(token);
}

/** Webhook orqali kelgan xabarlarni qayta ishlaydi */
export async function handleTelegramWebhook(
  db: TenantDb,
  tenant: Tenant,
  role: BotRole,
  update: TelegramUpdate,
  originUrl: string,
): Promise<{ ok: boolean; message?: string }> {
  const config = await getTelegramBotsConfig(db);
  const botSettings: SingleBotSettings =
    role === "teacher"
      ? config.teacherBot
      : role === "student"
        ? config.studentBot
        : config.parentBot;

  if (!botSettings.token) {
    return { ok: false, message: "Bot tokeni sozlanmagan" };
  }

  const tg = createTelegram(botSettings.token);

  // 1. Inline tugma bosilganda (Callback Query) - masalan ota-onani tasdiqlash
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat.id;
    const data = cq.data ?? "";

    if (!chatId) return { ok: true };

    if (data.startsWith("parent_yes:")) {
      const studentId = data.slice("parent_yes:".length);
      const [st] = await db
        .select({ id: students.id, name: students.name })
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);

      if (st) {
        await db
          .update(students)
          .set({ parentTelegramChatId: String(chatId) })
          .where(eq(students.id, st.id));

        await tg.answerCallbackQuery(cq.id, "Muvaffaqiyatli tasdiqlandi!");
        await tg.sendMessage(
          chatId,
          `✅ Rahmat! Siz <b>${escapeHtml(st.name)}</b> o'quvchining ota-onasi sifatida muvaffaqiyatli ro'yxatdan o'tdingiz.\n\n` +
            `Endi sizga farzandingizning:\n` +
            `• 📅 Darsga kelishi va qoldirgan darslari\n` +
            `• 📊 Olgan baholari va o'qituvchi izohlari\n` +
            `• ⏰ Darsga kechikishi\n` +
            `• 💳 Oylik to'lovlari va eslatmalari\n` +
            `haqida to'g'ridan-to'g'ri xabarlar yuboriladi.`,
        );
      } else {
        await tg.answerCallbackQuery(cq.id, "O'quvchi topilmadi");
      }
      return { ok: true };
    }

    if (data === "parent_no") {
      await tg.answerCallbackQuery(cq.id, "Bekor qilindi");
      await tg.sendMessage(
        chatId,
        "Tushunarli. Agar adashgan bo'lsangiz yoki ma'lumotlaringizni yangilamoqchi bo'lsangiz, o'quv markazi ma'muriyatiga murojaat qiling.",
      );
      return { ok: true };
    }

    return { ok: true };
  }

  const msg = update.message;
  if (!msg || !msg.chat) return { ok: true };
  const chatId = msg.chat.id;

  // 2. /start komandasi
  if (msg.text?.trim().startsWith("/start")) {
    let welcomeText = "";
    if (role === "teacher") {
      welcomeText =
        `Assalomu alaykum, hurmatli o'qituvchi!\n\n` +
        `<b>${escapeHtml(tenant.name)}</b> o'qituvchilar botiga xush kelibsiz.\n\n` +
        `Tizim bilan bog'lanish va shaxsiy ma'lumotlaringizni ochish uchun pastdagi <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing:`;
    } else if (role === "student") {
      welcomeText =
        `Assalomu alaykum!\n\n` +
        `<b>${escapeHtml(tenant.name)}</b> o'quvchilar botiga xush kelibsiz.\n\n` +
        `O'quvchi profilingizni ulash, baholaringiz, darslaringiz va yangi uy vazifalaringizni ko'rish uchun pastdagi <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing:`;
    } else {
      welcomeText =
        `Assalomu alaykum, hurmatli ota-ona!\n\n` +
        `<b>${escapeHtml(tenant.name)}</b> ota-onalar xabarnoma botiga xush kelibsiz.\n\n` +
        `Farzandingizning darslari, davomati va baholaridan doimiy xabardor bo'lib turish uchun pastdagi <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing:`;
    }

    const contactKeyboard = {
      keyboard: [
        [
          {
            text: "📱 Telefon raqamni yuborish",
            request_contact: true,
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    };

    await tg.sendMessage(chatId, welcomeText, { reply_markup: contactKeyboard });
    return { ok: true };
  }

  // 3. Telefon raqam (kontakt) yuborilganda
  if (msg.contact && msg.contact.phone_number) {
    const rawPhone = msg.contact.phone_number;
    const phone9 = last9Digits(rawPhone);

    if (role === "teacher") {
      // O'qituvchini qidiramiz
      const teacherRows = await db
        .select({
          id: teachers.id,
          name: teachers.name,
          phone: teachers.phone,
          userId: teachers.userId,
        })
        .from(teachers)
        .where(isNull(teachers.archivedAt));

      const matched = teacherRows.find((t) => last9Digits(t.phone) === phone9);

      if (!matched) {
        await tg.sendMessage(
          chatId,
          `❌ Kechirasiz, <b>${escapeHtml(rawPhone)}</b> telefon raqami markaz o'qituvchilari bazasidan topilmadi.\n\n` +
            `Iltimos, markaz ma'muriyatiga telefon raqamingiz to'g'ri kiritilganligini tekshirishni so'rab murojaat qiling.`,
        );
        return { ok: true };
      }

      // O'qituvchi chat ID sini saqlaymiz
      await db
        .update(teachers)
        .set({ telegramChatId: String(chatId) })
        .where(eq(teachers.id, matched.id));

      if (matched.userId) {
        await db
          .update(users)
          .set({ telegramChatId: String(chatId) })
          .where(eq(users.id, matched.userId));
      }

      const miniApp = botSettings.miniAppUrl?.trim();
      const miniAppFullUrl = miniApp ? (miniApp.startsWith("http") ? miniApp : `${originUrl}${miniApp}`) : null;

      const replyMarkup = miniAppFullUrl
        ? {
            inline_keyboard: [
              [
                {
                  text: "📱 O'qituvchi kabinetini ochish",
                  web_app: { url: miniAppFullUrl },
                },
              ],
            ],
          }
        : { remove_keyboard: true };

      await tg.sendMessage(
        chatId,
        `✅ Assalomu alaykum, <b>${escapeHtml(matched.name)}</b>!\n\n` +
          `Sizning akkauntingiz muvaffaqiyatli ulandi.\n\n` +
          `Endi sizga markaz bo'yicha quyidagi xabarnomalar kelib turadi:\n` +
          `• 💰 Avans to'langanda\n` +
          `• 💵 Oylik ish haqi hisoblanganda\n` +
          `• ⚠️ Jarimalar tushganda\n` +
          `• 📋 Guruh darslarida davomat qilinmaganda eslatmalar\n` +
          `• ⏰ Dars boshlanishi oldidan eslatmalar`,
        { reply_markup: replyMarkup },
      );
      return { ok: true };
    }

    if (role === "student") {
      // O'quvchini qidiramiz
      const studentRows = await db
        .select({
          id: students.id,
          name: students.name,
          phone: students.phone,
          userId: students.userId,
        })
        .from(students)
        .where(isNull(students.archivedAt));

      const matched = studentRows.find((s) => last9Digits(s.phone) === phone9);

      if (!matched) {
        await tg.sendMessage(
          chatId,
          `❌ Kechirasiz, <b>${escapeHtml(rawPhone)}</b> telefon raqami o'quvchilar ro'yxatidan topilmadi.\n\n` +
            `Iltimos, o'quv markaz ma'muriyatiga murojaat qiling.`,
        );
        return { ok: true };
      }

      if (matched.userId) {
        await db
          .update(users)
          .set({ telegramChatId: String(chatId) })
          .where(eq(users.id, matched.userId));
      }

      const miniApp = botSettings.miniAppUrl?.trim();
      const miniAppFullUrl = miniApp ? (miniApp.startsWith("http") ? miniApp : `${originUrl}${miniApp}`) : null;

      const replyMarkup = miniAppFullUrl
        ? {
            inline_keyboard: [
              [
                {
                  text: "🎓 O'quvchi portalini ochish",
                  web_app: { url: miniAppFullUrl },
                },
              ],
            ],
          }
        : { remove_keyboard: true };

      await tg.sendMessage(
        chatId,
        `✅ Assalomu alaykum, <b>${escapeHtml(matched.name)}</b>!\n\n` +
          `O'quvchi profilingiz muvaffaqiyatli ulandi.\n\n` +
          `Endi sizga quyidagi bildirishnomalar yuboriladi:\n` +
          `• 📅 Dars qoldirilganda yoki davomat olinganda\n` +
          `• ⭐ Darslarda olgan baholaringiz\n` +
          `• 💳 Oylik to'lovlar va hisob balansi\n` +
          `• 📚 Yangi berilgan uy vazifalari`,
        { reply_markup: replyMarkup },
      );
      return { ok: true };
    }

    if (role === "parent") {
      // Ota-ona telefoni bo'yicha o'quvchilarni topamiz
      const studentRows = await db
        .select({
          id: students.id,
          name: students.name,
          parentName: students.parentName,
          parentPhone: students.parentPhone,
        })
        .from(students)
        .where(
          and(
            isNull(students.archivedAt),
            isNotNull(students.parentPhone),
          ),
        );

      const matchedChildren = studentRows.filter(
        (s) => s.parentPhone && last9Digits(s.parentPhone) === phone9,
      );

      if (!matchedChildren.length) {
        await tg.sendMessage(
          chatId,
          `❌ Kechirasiz, <b>${escapeHtml(rawPhone)}</b> telefon raqami o'quvchilarning ota-onalari bazasidan topilmadi.\n\n` +
            `Iltimos, markaz ma'muriyatiga telefon raqamingizni o'quvchi anketasiga to'g'ri kiritishni so'rab murojaat qiling.`,
        );
        return { ok: true };
      }

      // Har bir farzandi bo'yicha tasdiqlash so'raymiz
      for (const child of matchedChildren) {
        const confirmKeyboard = {
          inline_keyboard: [
            [
              {
                text: "✅ Ha, tasdiqlayman",
                callback_data: `parent_yes:${child.id}`,
              },
              {
                text: "❌ Yo'q",
                callback_data: "parent_no",
              },
            ],
          ],
        };

        await tg.sendMessage(
          chatId,
          `Hurmatli foydalanuvchi!\n\nSiz <b>${escapeHtml(child.name)}</b> o'quvchining ota-onasisizmi?`,
          { reply_markup: confirmKeyboard },
        );
      }

      return { ok: true };
    }
  }

  // Boshqa har qanday erkin matnli xabarga yo'l-yo'riq berish
  await tg.sendMessage(
    chatId,
    `Botdan foydalanish uchun /start buyrug'ini yuboring va telefon raqamingizni tasdiqlang.`,
  );
  return { ok: true };
}
