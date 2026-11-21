import { z } from "zod";

export const TELEGRAM_BOTS_KEY = "telegram_bots";

export type BotRole = "teacher" | "student" | "parent";

export interface BotNotificationOption {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const TEACHER_NOTIFICATIONS: readonly BotNotificationOption[] = [
  {
    key: "advance",
    label: "Avans to'langanda",
    description: "O'qituvchiga avans berilganda va kassa yozuvi tasdiqlanganda",
    defaultEnabled: true,
  },
  {
    key: "salary",
    label: "Oylik / Ish haqi to'langanda",
    description: "Oylik hisob-kitobi amalga oshirilganda va to'lov berilganda",
    defaultEnabled: true,
  },
  {
    key: "penalty",
    label: "Jarima belgilanganda",
    description: "O'qituvchiga jarima yozilganda uning miqdori va sababi",
    defaultEnabled: true,
  },
  {
    key: "attendanceReminder",
    label: "Davomat eslatmasi",
    description: "Bugungi dars uchun davomat va baholar kiritilmaganda",
    defaultEnabled: true,
  },
  {
    key: "lessonStartReminder",
    label: "Dars boshlanishi eslatmasi",
    description: "Dars boshlanishidan oldin xona va guruh eslatmasi",
    defaultEnabled: true,
  },
];

export const STUDENT_NOTIFICATIONS: readonly BotNotificationOption[] = [
  {
    key: "attendance",
    label: "Dars davomati",
    description: "Darsga kelmaganligi yoki davomat belgilanganligi haqida",
    defaultEnabled: true,
  },
  {
    key: "grade",
    label: "Baho qo'yilganda",
    description: "Darsda olgan bahosi va o'qituvchi izohi",
    defaultEnabled: true,
  },
  {
    key: "payment",
    label: "To'lov va balans",
    description: "To'lov qabul qilinganda va qoldiq balans haqida",
    defaultEnabled: true,
  },
  {
    key: "homework",
    label: "Yangi uy vazifasi",
    description: "O'qituvchi yangi topshiriq va topshirish muddati berganda",
    defaultEnabled: true,
  },
];

export const PARENT_NOTIFICATIONS: readonly BotNotificationOption[] = [
  {
    key: "absence",
    label: "Dars qoldirilganda (kelmadi)",
    description: "Farzandi darsga kelmaganida zudlik bilan xabar berish",
    defaultEnabled: true,
  },
  {
    key: "grade",
    label: "Baho olinganda / past baho",
    description: "Farzandining baholari, ayniqsa past ball olganda ogohlantirish",
    defaultEnabled: true,
  },
  {
    key: "late",
    label: "Darsga kechikganda",
    description: "Farzandi darsga kechikib kelganda ota-onaga xabar berish",
    defaultEnabled: true,
  },
  {
    key: "payment",
    label: "To'lov eslatmasi",
    description: "Oylik to'lov muddati yaqinlashganda yoki qarzdorlikda",
    defaultEnabled: true,
  },
  {
    key: "homework",
    label: "Yangi uy vazifasi",
    description: "Farzandiga yangi uy vazifasi berilganda xabardor qilish",
    defaultEnabled: true,
  },
];

export interface SingleBotSettings {
  token: string;
  username: string;
  name: string;
  enabled: boolean;
  miniAppUrl: string;
  notifications: Record<string, boolean>;
  webhookSecret: string;
}

export interface TelegramBotsConfig {
  teacherBot: SingleBotSettings;
  studentBot: SingleBotSettings;
  parentBot: SingleBotSettings;
}

export interface BotUserStats {
  total: number;
  active: number; // nechta ishlatyapti
  inactive: number; // nechtasi hali ishlatmayapti
  percentage: number;
}

export interface TelegramBotsStats {
  teacher: BotUserStats;
  student: BotUserStats;
  parent: BotUserStats;
}

export function defaultNotifications(opts: readonly BotNotificationOption[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const o of opts) {
    map[o.key] = o.defaultEnabled;
  }
  return map;
}

export const DEFAULT_TELEGRAM_BOTS_CONFIG: TelegramBotsConfig = {
  teacherBot: {
    token: "",
    username: "",
    name: "O'qituvchi boti",
    enabled: false,
    miniAppUrl: "/kabinet",
    notifications: defaultNotifications(TEACHER_NOTIFICATIONS),
    webhookSecret: "",
  },
  studentBot: {
    token: "",
    username: "",
    name: "O'quvchi boti",
    enabled: false,
    miniAppUrl: "/portal",
    notifications: defaultNotifications(STUDENT_NOTIFICATIONS),
    webhookSecret: "",
  },
  parentBot: {
    token: "",
    username: "",
    name: "Ota-ona boti",
    enabled: false,
    miniAppUrl: "",
    notifications: defaultNotifications(PARENT_NOTIFICATIONS),
    webhookSecret: "",
  },
};

const singleBotSchema = z.object({
  token: z.string().default(""),
  username: z.string().default(""),
  name: z.string().default(""),
  enabled: z.boolean().default(false),
  miniAppUrl: z.string().default(""),
  notifications: z.record(z.string(), z.boolean()).default({}),
  webhookSecret: z
    .string()
    .regex(/^[a-zA-Z0-9_-]*$/, "Maxfiy kalit faqat harf, raqam, _ va - dan iborat bo'lishi kerak")
    .max(256)
    .default(""),
});

export const telegramBotsConfigSchema = z.object({
  teacherBot: singleBotSchema.default(DEFAULT_TELEGRAM_BOTS_CONFIG.teacherBot),
  studentBot: singleBotSchema.default(DEFAULT_TELEGRAM_BOTS_CONFIG.studentBot),
  parentBot: singleBotSchema.default(DEFAULT_TELEGRAM_BOTS_CONFIG.parentBot),
});

export function parseTelegramBotsConfig(raw: unknown): TelegramBotsConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_TELEGRAM_BOTS_CONFIG;
  const parsed = telegramBotsConfigSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_TELEGRAM_BOTS_CONFIG;

  return {
    teacherBot: {
      ...DEFAULT_TELEGRAM_BOTS_CONFIG.teacherBot,
      ...parsed.data.teacherBot,
      notifications: {
        ...DEFAULT_TELEGRAM_BOTS_CONFIG.teacherBot.notifications,
        ...parsed.data.teacherBot.notifications,
      },
    },
    studentBot: {
      ...DEFAULT_TELEGRAM_BOTS_CONFIG.studentBot,
      ...parsed.data.studentBot,
      notifications: {
        ...DEFAULT_TELEGRAM_BOTS_CONFIG.studentBot.notifications,
        ...parsed.data.studentBot.notifications,
      },
    },
    parentBot: {
      ...DEFAULT_TELEGRAM_BOTS_CONFIG.parentBot,
      ...parsed.data.parentBot,
      notifications: {
        ...DEFAULT_TELEGRAM_BOTS_CONFIG.parentBot.notifications,
        ...parsed.data.parentBot.notifications,
      },
    },
  };
}
