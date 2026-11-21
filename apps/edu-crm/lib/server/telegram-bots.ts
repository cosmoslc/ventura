import "server-only";
import { createHmac } from "node:crypto";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { verifyStaffPassword } from "@ventura/auth/staff";
import type { TenantDb } from "@ventura/db";
import { settings, students, teachers, users, verifications } from "@ventura/db/schema/tenant";
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
import { tenantDeps } from "./deps";

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

/** Botning Telegram webhook maxfiy kalitini qaytaradi (sozlangan yoki deterministik hosil qilingan) */
export function getBotWebhookSecret(bot: SingleBotSettings, secretKey: string, role: BotRole): string {
  if (bot.webhookSecret && bot.webhookSecret.trim().length > 0) {
    return bot.webhookSecret.trim();
  }
  return createHmac("sha256", secretKey)
    .update(`tg-webhook:${role}:${bot.token}`)
    .digest("hex");
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
  const rawText = msg.text?.trim() ?? "";

  // Helper: Better-Auth orqali parolni tekshirish
  async function checkPassword(userId: string, pass: string): Promise<boolean> {
    const deps = tenantDeps(tenant);
    if (!deps) return false;
    const auth = deps.auth(originUrl);
    return verifyStaffPassword(auth, userId, pass);
  }

  // Helper: O'qituvchi ulanishi muvaffaqiyatli yakunlanganda
  async function finishTeacherConnect(t: { id: string; name: string; userId?: string | null }) {
    await db
      .update(teachers)
      .set({ telegramChatId: String(chatId) })
      .where(eq(teachers.id, t.id));

    if (t.userId) {
      await db
        .update(users)
        .set({ telegramChatId: String(chatId) })
        .where(eq(users.id, t.userId));
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
      `✅ Assalomu alaykum, <b>${escapeHtml(t.name)}</b>!\n\n` +
        `Sizning akkauntingiz muvaffaqiyatli ulandi.\n\n` +
        `Endi sizga markaz bo'yicha quyidagi xabarnomalar kelib turadi:\n` +
        `• 💰 Avans to'langanda\n` +
        `• 💵 Oylik ish haqi hisoblanganda\n` +
        `• ⚠️ Jarimalar tushganda\n` +
        `• 📋 Guruh darslarida davomat qilinmaganda eslatmalar\n` +
        `• ⏰ Dars boshlanishi oldidan eslatmalar`,
      { reply_markup: replyMarkup },
    );
  }

  // Helper: O'quvchi ulanishi muvaffaqiyatli yakunlanganda
  async function finishStudentConnect(s: { id: string; name: string; userId?: string | null }) {
    if (s.userId) {
      await db
        .update(users)
        .set({ telegramChatId: String(chatId) })
        .where(eq(users.id, s.userId));
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
      `✅ Assalomu alaykum, <b>${escapeHtml(s.name)}</b>!\n\n` +
        `O'quvchi profilingiz muvaffaqiyatli ulandi.\n\n` +
        `Endi sizga quyidagi bildirishnomalar yuboriladi:\n` +
        `• 📅 Dars qoldirilganda yoki davomat olinganda\n` +
        `• ⭐ Darslarda olgan baholaringiz\n` +
        `• 💳 Oylik to'lovlar va hisob balansi\n` +
        `• 📚 Yangi berilgan uy vazifalari`,
      { reply_markup: replyMarkup },
    );
  }

  // Helper: Ota-onani tasdiqlash tugmalari
  async function promptParentConfirmation(child: { id: string; name: string }) {
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

  // 2. /start komandasi
  if (rawText.startsWith("/start")) {
    await db.delete(verifications).where(eq(verifications.identifier, `tg_login:${chatId}`));

    let welcomeText = "";
    if (role === "teacher") {
      welcomeText =
        `Assalomu alaykum, hurmatli o'qituvchi!\n\n` +
        `<b>${escapeHtml(tenant.name)}</b> o'qituvchilar botiga xush kelibsiz.\n\n` +
        `Tizim bilan bog'lanish uchun quyidagi usullardan birini tanlang:\n\n` +
        `1️⃣ <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing <i>(agar Telegram raqamingiz tizimdagi raqamingiz bilan bir xil bo'lsa)</i>.\n\n` +
        `2️⃣ <b>Web-sayt login kaliti bilan kirish:</b>\n` +
        `Agar Telegram raqamingiz boshqa bo'lsa, tizimga kirish telefon raqamingiz va parolingizni yuboring:\n` +
        `Format: <code>/login [telefon] [parol]</code>\n` +
        `Misol: <code>/login 901234567 parolingiz</code>\n` +
        `<i>(Yoki shunchaki telefon raqamingizni yozib yuboring).</i>`;
    } else if (role === "student") {
      welcomeText =
        `Assalomu alaykum!\n\n` +
        `<b>${escapeHtml(tenant.name)}</b> o'quvchilar botiga xush kelibsiz.\n\n` +
        `O'quvchi profilingizni ulash uchun quyidagi usullardan birini tanlang:\n\n` +
        `1️⃣ <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing <i>(agar Telegram raqamingiz markazdagi raqamingiz bilan bir xil bo'lsa)</i>.\n\n` +
        `2️⃣ <b>Portal login kaliti bilan kirish:</b>\n` +
        `Agar Telegram raqamingiz boshqa bo'lsa, portalga kirish telefon raqamingiz va parolingizni yuboring:\n` +
        `Format: <code>/login [telefon] [parol]</code>\n` +
        `Misol: <code>/login 901234567 parolingiz</code>\n` +
        `<i>(Yoki shunchaki telefon raqamingizni yozib yuboring).</i>`;
    } else {
      welcomeText =
        `Assalomu alaykum, hurmatli ota-ona!\n\n` +
        `<b>${escapeHtml(tenant.name)}</b> ota-onalar xabarnoma botiga xush kelibsiz.\n\n` +
        `Farzandingizning darslari, davomati va baholaridan xabardor bo'lish uchun:\n` +
        `1️⃣ <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing;\n` +
        `2️⃣ Yoki telefon raqamingizni yozib yuboring (masalan: <code>901234567</code>).`;
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

  // 3. /cancel yoki /bekor
  if (rawText === "/cancel" || rawText === "/bekor") {
    await db.delete(verifications).where(eq(verifications.identifier, `tg_login:${chatId}`));
    await tg.sendMessage(chatId, "Amal bekor qilindi. Qaytadan boshlash uchun /start bosing.");
    return { ok: true };
  }

  // 4. /logout yoki /chiqish
  if (rawText === "/logout" || rawText === "/chiqish") {
    await db.delete(verifications).where(eq(verifications.identifier, `tg_login:${chatId}`));
    if (role === "teacher") {
      await db.update(teachers).set({ telegramChatId: null }).where(eq(teachers.telegramChatId, String(chatId)));
      await db.update(users).set({ telegramChatId: null }).where(eq(users.telegramChatId, String(chatId)));
    } else if (role === "student") {
      await db.update(users).set({ telegramChatId: null }).where(eq(users.telegramChatId, String(chatId)));
    } else {
      await db
        .update(students)
        .set({ parentTelegramChatId: null })
        .where(eq(students.parentTelegramChatId, String(chatId)));
    }
    await tg.sendMessage(chatId, "Akkauntingiz botdan uzildi. Qayta ulanish uchun /start bosing.");
    return { ok: true };
  }

  // 5. Telefon raqam (kontakt) yuborilganda
  if (msg.contact && msg.contact.phone_number) {
    const rawPhone = msg.contact.phone_number;
    const phone9 = last9Digits(rawPhone);

    if (role === "teacher") {
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
            `Iltimos, markaz ma'muriyatiga telefon raqamingiz to'g'ri kiritilganligini tekshirishni so'rab murojaat qiling yoki web-sayt login kaliti orqali ulaning: <code>/login [telefon] [parol]</code>`,
        );
        return { ok: true };
      }

      await finishTeacherConnect(matched);
      return { ok: true };
    }

    if (role === "student") {
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
            `Iltimos, markaz ma'muriyatiga murojaat qiling yoki web-portal login kaliti orqali ulaning: <code>/login [telefon] [parol]</code>`,
        );
        return { ok: true };
      }

      await finishStudentConnect(matched);
      return { ok: true };
    }

    if (role === "parent") {
      const studentRows = await db
        .select({
          id: students.id,
          name: students.name,
          parentName: students.parentName,
          parentPhone: students.parentPhone,
        })
        .from(students)
        .where(and(isNull(students.archivedAt), isNotNull(students.parentPhone)));

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

      for (const child of matchedChildren) {
        await promptParentConfirmation(child);
      }
      return { ok: true };
    }
  }

  // 6. Qadamma-qadam parol kiritilayotgan bo'lsa (Pending verification)
  const [pending] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.identifier, `tg_login:${chatId}`),
        gt(verifications.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (pending && rawText) {
    let sessionData: { role: BotRole; targetId: string; userId: string; name: string } | null = null;
    try {
      sessionData = JSON.parse(pending.value);
    } catch {
      sessionData = null;
    }

    if (sessionData && sessionData.userId) {
      const isValid = await checkPassword(sessionData.userId, rawText);
      if (!isValid) {
        await tg.sendMessage(
          chatId,
          `❌ Kiritilgan parol noto'g'ri.\n\n` +
            `Iltimos, web-saytga kirish parolingizni tekshirib, qaytadan yuboring:\n` +
            `<i>(Bekor qilish uchun /cancel yuboring)</i>`,
        );
        return { ok: true };
      }

      await db.delete(verifications).where(eq(verifications.identifier, `tg_login:${chatId}`));

      if (sessionData.role === "teacher") {
        await finishTeacherConnect({ id: sessionData.targetId, name: sessionData.name, userId: sessionData.userId });
      } else {
        await finishStudentConnect({ id: sessionData.targetId, name: sessionData.name, userId: sessionData.userId });
      }
      return { ok: true };
    }
  }

  // 7. Bitta qatorda kirish: /login <telefon> <parol> yoki <telefon> <parol>
  const loginMatch = rawText.match(/^(?:\/login\s+)?(\+?\d[\d\s-]{7,})\s+(.+)$/i);
  if (loginMatch) {
    const rawPhone = loginMatch[1]!;
    const password = loginMatch[2]!.trim();
    const phone9 = last9Digits(rawPhone);

    if (role === "teacher") {
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
          `❌ Kechirasiz, <b>${escapeHtml(rawPhone)}</b> telefon raqamli o'qituvchi topilmadi.`,
        );
        return { ok: true };
      }

      if (!matched.userId) {
        await tg.sendMessage(
          chatId,
          `⚠️ Hurmatli <b>${escapeHtml(matched.name)}</b>!\n\n` +
            `Sizga hali web-kabinetga kirish (parol) belgilanmagan.\n` +
            `Iltimos, markaz ma'muriyatiga parolingizni so'rab murojaat qiling yoki «📱 Telefon raqamni yuborish» tugmasidan foydalaning.`,
        );
        return { ok: true };
      }

      const isValid = await checkPassword(matched.userId, password);
      if (!isValid) {
        await tg.sendMessage(
          chatId,
          `❌ Kiritilgan parol noto'g'ri. Iltimos, web-kabinetga kirish parolingizni tekshirib qaytadan urinib ko'ring.`,
        );
        return { ok: true };
      }

      await db.delete(verifications).where(eq(verifications.identifier, `tg_login:${chatId}`));
      await finishTeacherConnect(matched);
      return { ok: true };
    }

    if (role === "student") {
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
          `❌ Kechirasiz, <b>${escapeHtml(rawPhone)}</b> telefon raqamli o'quvchi topilmadi.`,
        );
        return { ok: true };
      }

      if (!matched.userId) {
        await tg.sendMessage(
          chatId,
          `⚠️ Hurmatli <b>${escapeHtml(matched.name)}</b>!\n\n` +
            `Sizga hali o'quvchi portaliga kirish (parol) belgilanmagan.\n` +
            `Iltimos, o'quv markazi ma'muriyatiga murojaat qiling.`,
        );
        return { ok: true };
      }

      const isValid = await checkPassword(matched.userId, password);
      if (!isValid) {
        await tg.sendMessage(
          chatId,
          `❌ Kiritilgan parol noto'g'ri. Iltimos, o'quvchi portaliga kirish parolingizni tekshirib qaytadan urinib ko'ring.`,
        );
        return { ok: true };
      }

      await db.delete(verifications).where(eq(verifications.identifier, `tg_login:${chatId}`));
      await finishStudentConnect(matched);
      return { ok: true };
    }
  }

  // 8. Faqat telefon raqam yuborilganda (Qadamma-qadam 1-qadami)
  const digitsOnly = rawText.replace(/\D/g, "");
  const isPhoneOnly =
    (digitsOnly.length === 9 || (digitsOnly.length === 12 && digitsOnly.startsWith("998"))) &&
    /^(?:\/login\s+)?[\d\s+()-]+$/.test(rawText);

  if (isPhoneOnly) {
    const phone9 = digitsOnly.slice(-9);

    if (role === "teacher") {
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
          `❌ Kechirasiz, <b>${escapeHtml(rawText)}</b> telefon raqamli o'qituvchi bazadan topilmadi.`,
        );
        return { ok: true };
      }

      if (!matched.userId) {
        await tg.sendMessage(
          chatId,
          `⚠️ Hurmatli <b>${escapeHtml(matched.name)}</b>!\n\n` +
            `Sizga hali web-kabinetga kirish (parol) berilmagan.\n` +
            `Iltimos, markaz ma'muriyatiga parolingizni so'rab murojaat qiling yoki «📱 Telefon raqamni yuborish» tugmasidan foydalaning.`,
        );
        return { ok: true };
      }

      await db.delete(verifications).where(eq(verifications.identifier, `tg_login:${chatId}`));
      await db.insert(verifications).values({
        identifier: `tg_login:${chatId}`,
        value: JSON.stringify({
          role: "teacher",
          targetId: matched.id,
          userId: matched.userId,
          name: matched.name,
          phone: matched.phone,
        }),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      await tg.sendMessage(
        chatId,
        `🔑 Hurmatli <b>${escapeHtml(matched.name)}</b>, akkauntingiz topildi!\n\n` +
          `Endi web-kabinetga kiradigan <b>parolingizni (login kalitini)</b> yuboring:\n\n` +
          `<i>(Bekor qilish uchun /cancel yuboring)</i>`,
      );
      return { ok: true };
    }

    if (role === "student") {
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
          `❌ Kechirasiz, <b>${escapeHtml(rawText)}</b> telefon raqamli o'quvchi topilmadi.`,
        );
        return { ok: true };
      }

      if (!matched.userId) {
        await tg.sendMessage(
          chatId,
          `⚠️ Hurmatli <b>${escapeHtml(matched.name)}</b>!\n\n` +
            `Sizga hali o'quvchi portaliga kirish (parol) belgilanmagan.\n` +
            `Iltimos, o'quv markazi ma'muriyatiga murojaat qiling yoki «📱 Telefon raqamni yuborish» tugmasidan foydalaning.`,
        );
        return { ok: true };
      }

      await db.delete(verifications).where(eq(verifications.identifier, `tg_login:${chatId}`));
      await db.insert(verifications).values({
        identifier: `tg_login:${chatId}`,
        value: JSON.stringify({
          role: "student",
          targetId: matched.id,
          userId: matched.userId,
          name: matched.name,
          phone: matched.phone,
        }),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      await tg.sendMessage(
        chatId,
        `🔑 Hurmatli <b>${escapeHtml(matched.name)}</b>, o'quvchi profilingiz topildi!\n\n` +
          `Endi o'quvchi portaliga kiradigan <b>parolingizni (login kalitini)</b> yuboring:\n\n` +
          `<i>(Bekor qilish uchun /cancel yuboring)</i>`,
      );
      return { ok: true };
    }

    if (role === "parent") {
      const studentRows = await db
        .select({
          id: students.id,
          name: students.name,
          parentName: students.parentName,
          parentPhone: students.parentPhone,
        })
        .from(students)
        .where(and(isNull(students.archivedAt), isNotNull(students.parentPhone)));

      const matchedChildren = studentRows.filter(
        (s) => s.parentPhone && last9Digits(s.parentPhone) === phone9,
      );

      if (!matchedChildren.length) {
        await tg.sendMessage(
          chatId,
          `❌ Kechirasiz, <b>${escapeHtml(rawText)}</b> telefon raqami o'quvchilarning ota-onalari bazasidan topilmadi.`,
        );
        return { ok: true };
      }

      for (const child of matchedChildren) {
        await promptParentConfirmation(child);
      }
      return { ok: true };
    }
  }

  // 9. Boshqa har qanday erkin matnli xabarga yo'l-yo'riq berish
  await tg.sendMessage(
    chatId,
    `Botdan foydalanish uchun quyidagi buyruqlardan foydalanishingiz mumkin:\n\n` +
      `• /start — Botni qayta ishga tushirish\n` +
      `• «📱 Telefon raqamni yuborish» — Telegram raqamingiz orqali ulanish\n` +
      `• <code>/login [telefon] [parol]</code> — Web-sayt login kaliti orqali ulanish\n` +
      `• /logout — Akkauntni botdan uzish`,
  );
  return { ok: true };
}
