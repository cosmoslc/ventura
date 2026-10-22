import "server-only";
import { eq } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { students, teachers, users } from "@ventura/db/schema/tenant";
import { createTelegram, escapeHtml } from "@ventura/integrations";
import { formatMoney } from "@ventura/ui/lib/money";
import { getTelegramBotsConfig } from "./telegram-bots";

/** O'qituvchiga bildirishnoma yuborish */
export async function notifyTeacher(
  db: TenantDb,
  teacherId: string,
  event: "advance" | "salary" | "penalty" | "attendanceReminder" | "lessonStartReminder",
  payload: {
    amount?: number;
    month?: string;
    reason?: string;
    groupName?: string;
    lessonTime?: string;
  },
): Promise<boolean> {
  const config = await getTelegramBotsConfig(db);
  const bot = config.teacherBot;
  if (!bot.enabled || !bot.token || !bot.notifications[event]) return false;

  const [t] = await db
    .select({
      id: teachers.id,
      name: teachers.name,
      teacherChatId: teachers.telegramChatId,
      userChatId: users.telegramChatId,
    })
    .from(teachers)
    .leftJoin(users, eq(teachers.userId, users.id))
    .where(eq(teachers.id, teacherId))
    .limit(1);

  const chatId = t?.teacherChatId || t?.userChatId;
  if (!chatId) return false;

  let text = "";
  const name = escapeHtml(t.name);

  switch (event) {
    case "advance":
      text =
        `💰 <b>Avans to'lovi qabul qilindi</b>\n\n` +
        `Hurmatli <b>${name}</b>!\n` +
        `Sizga <b>${formatMoney(payload.amount ?? 0)} so'm</b> miqdorida avans to'landi.` +
        (payload.reason ? `\nIzoh: <i>${escapeHtml(payload.reason)}</i>` : "");
      break;
    case "salary":
      text =
        `💵 <b>Oylik ish haqi hisoblandi</b>\n\n` +
        `Hurmatli <b>${name}</b>!\n` +
        `Sizga ${payload.month ? `<b>${escapeHtml(payload.month)}</b> oyi uchun ` : ""}` +
        `<b>${formatMoney(payload.amount ?? 0)} so'm</b> oylik to'lovi hisoblandi.`;
      break;
    case "penalty":
      text =
        `⚠️ <b>Jarima belgilandi</b>\n\n` +
        `Hurmatli <b>${name}</b>!\n` +
        `Sizning hisobingizdan <b>${formatMoney(payload.amount ?? 0)} so'm</b> miqdorida jarima ushlandi.` +
        (payload.reason ? `\nSababi: <i>${escapeHtml(payload.reason)}</i>` : "");
      break;
    case "attendanceReminder":
      text =
        `📋 <b>Davomat eslatmasi</b>\n\n` +
        `Hurmatli <b>${name}</b>!\n` +
        `<b>${escapeHtml(payload.groupName ?? "Guruhingiz")}</b> darsi bo'yicha davomat hali to'ldirilmagan. ` +
        `Iltimos, o'quvchilar davomati va baholarini kabinet orqali belgilang.`;
      break;
    case "lessonStartReminder":
      text =
        `⏰ <b>Dars boshlanishi eslatmasi</b>\n\n` +
        `Hurmatli <b>${name}</b>!\n` +
        `<b>${escapeHtml(payload.groupName ?? "Guruhingiz")}</b> darsi ` +
        (payload.lessonTime ? `soat <b>${escapeHtml(payload.lessonTime)}</b> da ` : "yaqin daqiqalarda ") +
        `boshlanadi.`;
      break;
  }

  try {
    const tg = createTelegram(bot.token);
    await tg.sendMessage(chatId, text);
    return true;
  } catch (err) {
    console.error("[notifyTeacher] yuborishda xato:", err);
    return false;
  }
}

/** O'quvchiga bildirishnoma yuborish */
export async function notifyStudent(
  db: TenantDb,
  studentId: string,
  event: "attendance" | "grade" | "payment" | "homework",
  payload: {
    groupName?: string;
    lessonDate?: string;
    status?: string; // keldi, kelmadi, sababli
    score?: number;
    scale?: number;
    comment?: string;
    amount?: number;
    balance?: number;
    homeworkTitle?: string;
    dueDate?: string;
  },
): Promise<boolean> {
  const config = await getTelegramBotsConfig(db);
  const bot = config.studentBot;
  if (!bot.enabled || !bot.token || !bot.notifications[event]) return false;

  const [s] = await db
    .select({
      id: students.id,
      name: students.name,
      userChatId: users.telegramChatId,
    })
    .from(students)
    .leftJoin(users, eq(students.userId, users.id))
    .where(eq(students.id, studentId))
    .limit(1);

  const chatId = s?.userChatId;
  if (!chatId) return false;

  let text = "";
  const name = escapeHtml(s.name);

  switch (event) {
    case "attendance":
      text =
        `📅 <b>Dars davomati</b>\n\n` +
        `Salom, <b>${name}</b>!\n` +
        `${payload.lessonDate ? `<b>${escapeHtml(payload.lessonDate)}</b> kungi ` : ""}` +
        `<b>${escapeHtml(payload.groupName ?? "Guruhingiz")}</b> darsiga holatingiz: ` +
        `<b>${escapeHtml(payload.status ?? "Belgilandi")}</b>.`;
      break;
    case "grade":
      text =
        `⭐ <b>Yangi baho</b>\n\n` +
        `Salom, <b>${name}</b>!\n` +
        `Siz <b>${escapeHtml(payload.groupName ?? "darsda")}</b> ` +
        `<b>${payload.score}/${payload.scale ?? 100}</b> ball oldingiz.` +
        (payload.comment ? `\nO'qituvchi izohi: <i>${escapeHtml(payload.comment)}</i>` : "");
      break;
    case "payment":
      text =
        `💳 <b>To'lov qabul qilindi</b>\n\n` +
        `Salom, <b>${name}</b>!\n` +
        `Hisobingizga <b>${formatMoney(payload.amount ?? 0)} so'm</b> to'lov kiritildi.` +
        (payload.balance !== undefined ? `\nJoriy hisob balansingiz: <b>${formatMoney(payload.balance)} so'm</b>.` : "");
      break;
    case "homework":
      text =
        `📚 <b>Yangi uy vazifasi</b>\n\n` +
        `Salom, <b>${name}</b>!\n` +
        `<b>${escapeHtml(payload.groupName ?? "Guruhingiz")}</b> uchun yangi vazifa berildi:\n` +
        `<b>«${escapeHtml(payload.homeworkTitle ?? "Topshiriq")}»</b>` +
        (payload.dueDate ? `\nTopshirish muddati: <b>${escapeHtml(payload.dueDate)}</b> gacha.` : "");
      break;
  }

  try {
    const tg = createTelegram(bot.token);
    await tg.sendMessage(chatId, text);
    return true;
  } catch (err) {
    console.error("[notifyStudent] yuborishda xato:", err);
    return false;
  }
}

/** Ota-onaga bildirishnoma yuborish */
export async function notifyParent(
  db: TenantDb,
  studentId: string,
  event: "absence" | "grade" | "late" | "payment" | "homework",
  payload: {
    groupName?: string;
    lessonDate?: string;
    score?: number;
    scale?: number;
    comment?: string;
    amount?: number;
    dueDate?: string;
    homeworkTitle?: string;
  },
): Promise<boolean> {
  const config = await getTelegramBotsConfig(db);
  const bot = config.parentBot;
  if (!bot.enabled || !bot.token || !bot.notifications[event]) return false;

  const [s] = await db
    .select({
      id: students.id,
      name: students.name,
      parentChatId: students.parentTelegramChatId,
    })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  const chatId = s?.parentChatId;
  if (!chatId) return false;

  let text = "";
  const studentName = escapeHtml(s.name);

  switch (event) {
    case "absence":
      text =
        `⚠️ <b>Farzandingiz dars qoldirdi</b>\n\n` +
        `Hurmatli ota-ona!\n` +
        `Farzandingiz <b>${studentName}</b> bugun ` +
        (payload.groupName ? `<b>${escapeHtml(payload.groupName)}</b> ` : "") +
        `darsiga kelmadi. Iltimos, sababini markaz ma'muriyatiga ma'lum qiling.`;
      break;
    case "late":
      text =
        `⏰ <b>Darsga kechikish</b>\n\n` +
        `Hurmatli ota-ona!\n` +
        `Farzandingiz <b>${studentName}</b> bugun ` +
        (payload.groupName ? `<b>${escapeHtml(payload.groupName)}</b> ` : "") +
        `darsiga kechikib keldi.`;
      break;
    case "grade":
      text =
        `📊 <b>Farzandingiz baholandi</b>\n\n` +
        `Hurmatli ota-ona!\n` +
        `Farzandingiz <b>${studentName}</b> ` +
        (payload.groupName ? `<b>${escapeHtml(payload.groupName)}</b> fanidan ` : "") +
        `<b>${payload.score}/${payload.scale ?? 100}</b> ball oldi.` +
        (payload.comment ? `\nO'qituvchi izohi: <i>${escapeHtml(payload.comment)}</i>` : "");
      break;
    case "payment":
      text =
        `💳 <b>To'lov xabarnomasi</b>\n\n` +
        `Hurmatli ota-ona!\n` +
        `Farzandingiz <b>${studentName}</b> ning o'qish to'lovi uchun ` +
        `<b>${formatMoney(payload.amount ?? 0)} so'm</b> qabul qilindi. Rahmat!`;
      break;
    case "homework":
      text =
        `📚 <b>Yangi uy vazifasi berildi</b>\n\n` +
        `Hurmatli ota-ona!\n` +
        `Farzandingiz <b>${studentName}</b> ga ` +
        (payload.groupName ? `<b>${escapeHtml(payload.groupName)}</b> darsida ` : "") +
        `yangi topshiriq berildi:\n` +
        `<b>«${escapeHtml(payload.homeworkTitle ?? "Topshiriq")}»</b>` +
        (payload.dueDate ? `\nTopshirish muddati: <b>${escapeHtml(payload.dueDate)}</b> gacha.` : "");
      break;
  }

  try {
    const tg = createTelegram(bot.token);
    await tg.sendMessage(chatId, text);
    return true;
  } catch (err) {
    console.error("[notifyParent] yuborishda xato:", err);
    return false;
  }
}
