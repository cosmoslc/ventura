export const uz = {
  // Brand & Shell
  app_name: "Pilorama Boshqaruvi",
  app_tagline: "Yog'och tilish sexi hisob-kitob tizimi",

  // Navigatsiya
  nav_home: "Bosh sahifa",
  nav_teraks: "Teraklar",
  nav_workers: "Ishchilar",
  nav_work: "Kunlik ishlar",
  nav_stock: "Ombor",
  nav_materials: "Materiallar",
  nav_dispatch: "Yuk chiqarish",
  nav_trucks: "Yuk mashinalari",
  nav_expenses: "Umumiy xarajatlar",
  nav_orders: "Zakazlar",
  nav_reports: "Hisobotlar",
  nav_settings: "Sozlamalar",
  nav_staff: "Xodimlar",
  nav_activity: "Faoliyat jurnali",

  // Bo'lim guruhlari
  nav_group_main: "Asosiy",
  nav_group_operations: "Ombor va sotuv",
  nav_group_finance: "Moliya",
  nav_group_analytics: "Tahlil",
  nav_group_system: "Tizim",

  // Tezkor amallar
  quick_actions: "Tezkor amallar",
  quick_add_work: "Ish qo'shish",
  quick_add_dispatch: "Yuk chiqarish",
  quick_add_cost: "Xarajat qo'shish",
  quick_add_worker: "Ishchi qo'shish",
  quick_add_terak: "Terak qo'shish",

  // Rollar
  role_owner: "Egasi",
  role_accountant: "Hisobchi",
  role_viewer: "Ko'ruvchi",

  // Kirish (Auth)
  login_title: "Tizimga kirish",
  login_subtitle: "Pilorama boshqaruv paneliga kirish uchun telefon va parolingizni kiriting",
  login_phone_label: "Telefon raqami",
  login_password_label: "Parol",
  login_button: "Kirish",
  login_submitting: "Tekshirilmoqda...",
  login_error_invalid: "Telefon raqami yoki parol noto'g'ri",
  login_error_locked: "Hisob vaqtincha bloklangan",

  // Umumiy amallar va so'zlar
  action_save: "Saqlash",
  action_cancel: "Bekor qilish",
  action_delete: "O'chirish",
  action_edit: "Tahrirlash",
  action_add: "Qo'shish",
  action_search: "Qidirish",
  action_filter: "Filtr",
  action_close: "Yopish",
  action_logout: "Chiqish",
  action_refresh: "Yangilash",

  // Holatlar
  status_loading: "Yuklanmoqda...",
  status_empty: "Ma'lumot topilmadi",
  status_success: "Muvaffaqiyatli saqlandi",
  status_error: "Xatolik yuz berdi",

  // Bo'lim yopiq
  feature_disabled_title: "Bu bo'lim yoqilmagan",
  feature_disabled_desc: "Ushbu imkoniyatdan foydalanish uchun uni Ventura boshqaruv panelida faollashtiring.",
  feature_disabled_back: "Bosh sahifaga qaytish",

  // Til va mavzu
  language_uz: "O'zbekcha",
  language_ru: "Русский",
  theme_light: "Yorug'",
  theme_dark: "Qorong'i",
  theme_system: "Tizim",

  // Bosh sahifa
  home_welcome: "Pilorama Boshqaruviga xush kelibsiz",
  home_welcome_desc: "Terak xaridlari, ishchilar mehnati, ombor harakati va daromadlarni bir joyda boshqaring.",
  home_select_terak: "Terakni tanlang",
  home_all_teraks: "Barcha teraklar",
} as const;

export type TranslationKey = keyof typeof uz;
