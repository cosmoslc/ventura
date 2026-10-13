import type { FeatureManifest, TemplateInfo } from "@ventura/tenants";

/**
 * O'quv markaz CRM — bo'limlar manifesti (SPEC 8-bo'lim). `group` — paneldagi bo'limlar tanlovi uchun,
 * `nav.section` — CRM menyusidagi joy (eski tizim menyusi: asosiy bandlar, Moliya, Hisobotlar, Ofis, O'quv).
 */
export const template = {
  key: "edu-crm",
  name: "O'quv markaz CRM",
  category: "Ta'lim",
  description: "O'quvchilar, guruhlar, davomat, to'lovlar va hisobotlar",
  version: "0.5.0",
} satisfies TemplateInfo;

export const features = [
  // Asos
  {
    key: "students",
    name: "O'quvchilar",
    group: "Asos",
    type: "permanent",
    routes: ["/api/students"],
    nav: [
      { label: "O'quvchilar", href: "/students" },
      { label: "Arxiv", href: "/archive", section: "Ofis" },
    ],
  },
  {
    key: "courses",
    name: "Kurslar",
    group: "Asos",
    type: "core",
    routes: ["/api/courses"],
    nav: [{ label: "Kurslar", href: "/courses", section: "O'quv" }],
  },
  {
    key: "teachers",
    name: "O'qituvchilar",
    group: "Asos",
    type: "core",
    routes: ["/api/teachers"],
    nav: [
      { label: "O'qituvchilar", href: "/teachers" },
      { label: "Lavozimlar", href: "/positions", section: "Ofis" },
      { label: "Xodimlar", href: "/staff", section: "Ofis" },
    ],
  },
  {
    key: "groups",
    name: "Guruhlar",
    group: "Asos",
    type: "core",
    requires: ["students", "courses", "teachers"],
    routes: ["/api/groups"],
    nav: [
      { label: "Guruhlar", href: "/groups" },
      { label: "Xonalar", href: "/rooms", section: "Ofis" },
    ],
  },
  {
    key: "branches",
    name: "Ko'p filialli rejim",
    group: "Asos",
    type: "mode",
    description: "Loyiha sozlamasi boshqaradi",
    nav: [{ label: "Filiallar", href: "/branches", section: "Ofis" }],
  },

  // Davomat
  {
    key: "holidays",
    name: "Dam olish kunlari",
    group: "Davomat",
    type: "regular",
    routes: ["/api/holidays"],
    nav: [{ label: "Dam olish kunlari", href: "/holidays", section: "Ofis" }],
  },
  {
    key: "attendance",
    name: "Davomat",
    group: "Davomat",
    type: "regular",
    requires: ["groups", "holidays"],
    routes: ["/api/attendance", "/api/attendance-settings"],
    nav: [
      { label: "Davomat", href: "/attendance", section: "Asos" },
      { label: "Xodimlar davomati", href: "/staff-attendance", section: "Ofis" },
    ],
  },

  // Moliya
  {
    key: "payments",
    name: "To'lovlar",
    group: "Moliya",
    type: "core",
    requires: ["students"],
    routes: ["/api/payments"],
    nav: [
      { label: "To'lovlar", href: "/payments" },
      { label: "To'lov sozlamalari", href: "/payment-settings", section: "Ofis" },
      { label: "Pul amallari tarixi", href: "/money-audit", section: "Ofis" },
    ],
  },
  {
    key: "debtors",
    name: "Qarzdorlar",
    group: "Moliya",
    type: "regular",
    requires: ["payments"],
    routes: ["/api/debtors"],
    nav: [{ label: "Qarzdorlar", href: "/debtors" }],
  },
  {
    key: "expenses",
    name: "Xarajatlar",
    group: "Moliya",
    type: "regular",
    routes: ["/api/expenses"],
    nav: [
      { label: "Xarajatlar", href: "/expenses" },
      { label: "Qo'shimcha daromadlar", href: "/additional-income" },
    ],
  },
  {
    key: "salaries",
    name: "Ish haqi",
    group: "Moliya",
    type: "regular",
    requires: ["teachers", "payments"],
    routes: ["/api/salaries"],
    nav: [{ label: "Ish haqi", href: "/salaries" }],
  },

  // O'quv jarayoni
  {
    key: "exams",
    name: "Imtihonlar",
    group: "O'quv jarayoni",
    type: "regular",
    requires: ["groups"],
    routes: ["/api/exams"],
    nav: [{ label: "Imtihonlar", href: "/exams", section: "O'quv" }],
  },
  {
    key: "coins",
    name: "Coinlar",
    group: "O'quv jarayoni",
    type: "regular",
    requires: ["students"],
    description: "O'quvchilarni rag'batlantirish",
    routes: ["/api/coins"],
    nav: [{ label: "Coinlar", href: "/coins", section: "O'quv" }],
  },

  // Sotuv va aloqa
  {
    key: "leads",
    name: "Lidlar",
    group: "Sotuv va aloqa",
    type: "regular",
    routes: ["/api/leads"],
    nav: [{ label: "Lidlar", href: "/leads", section: "Asos" }],
  },
  {
    key: "sms",
    name: "SMS xabarnomalar",
    group: "Sotuv va aloqa",
    type: "regular",
    routes: ["/api/sms"],
    nav: [{ label: "SMS xabarnomalar", href: "/sms" }],
  },
  { key: "telegram_bot", name: "Telegram bot", group: "Sotuv va aloqa", type: "regular", routes: ["/api/telegram"] },

  // Hisobotlar
  {
    key: "reports",
    name: "Hisobotlar",
    group: "Hisobotlar",
    type: "regular",
    requires: ["payments"],
    routes: ["/api/reports"],
    nav: [{ label: "Hisobotlar", href: "/reports" }],
  },
] satisfies FeatureManifest;
