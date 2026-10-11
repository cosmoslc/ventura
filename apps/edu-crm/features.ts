import type { FeatureManifest, TemplateInfo } from "@ventura/tenants";

/** O'quv markaz CRM — bo'limlar manifesti (SPEC 8-bo'lim). */
export const template = {
  key: "edu-crm",
  name: "O'quv markaz CRM",
  category: "Ta'lim",
  description: "O'quvchilar, guruhlar, davomat, to'lovlar va hisobotlar",
  version: "0.1.0",
} satisfies TemplateInfo;

export const features = [
  // Asos
  { key: "students", name: "O'quvchilar", group: "Asos", type: "permanent", routes: ["/api/students"] },
  { key: "courses", name: "Kurslar", group: "Asos", type: "core", routes: ["/api/courses"] },
  { key: "teachers", name: "O'qituvchilar", group: "Asos", type: "core", routes: ["/api/teachers"] },
  {
    key: "groups",
    name: "Guruhlar",
    group: "Asos",
    type: "core",
    requires: ["students", "courses", "teachers"],
    routes: ["/api/groups"],
  },
  {
    key: "branches",
    name: "Ko'p filialli rejim",
    group: "Asos",
    type: "mode",
    description: "Loyiha sozlamasi boshqaradi",
  },

  // Davomat
  { key: "holidays", name: "Dam olish kunlari", group: "Davomat", type: "regular", routes: ["/api/holidays"] },
  {
    key: "attendance",
    name: "Davomat",
    group: "Davomat",
    type: "regular",
    requires: ["groups", "holidays"],
    routes: ["/api/attendance", "/api/attendance-settings"],
    nav: [{ label: "Davomat", href: "/attendance" }],
  },

  // Moliya
  {
    key: "payments",
    name: "To'lovlar",
    group: "Moliya",
    type: "core",
    requires: ["students"],
    routes: ["/api/payments"],
  },
  {
    key: "debtors",
    name: "Qarzdorlar",
    group: "Moliya",
    type: "regular",
    requires: ["payments"],
    routes: ["/api/debtors"],
  },
  { key: "expenses", name: "Xarajatlar", group: "Moliya", type: "regular", routes: ["/api/expenses"] },
  {
    key: "salaries",
    name: "Ish haqi",
    group: "Moliya",
    type: "regular",
    requires: ["teachers", "payments"],
    routes: ["/api/salaries"],
  },

  // O'quv jarayoni
  {
    key: "exams",
    name: "Imtihonlar",
    group: "O'quv jarayoni",
    type: "regular",
    requires: ["groups"],
    routes: ["/api/exams"],
  },
  {
    key: "coins",
    name: "Coinlar",
    group: "O'quv jarayoni",
    type: "regular",
    requires: ["students"],
    description: "O'quvchilarni rag'batlantirish",
    routes: ["/api/coins"],
  },

  // Sotuv va aloqa
  { key: "leads", name: "Lidlar", group: "Sotuv va aloqa", type: "regular", routes: ["/api/leads"] },
  { key: "sms", name: "SMS xabarnomalar", group: "Sotuv va aloqa", type: "regular", routes: ["/api/sms"] },
  { key: "telegram_bot", name: "Telegram bot", group: "Sotuv va aloqa", type: "regular", routes: ["/api/telegram"] },

  // Hisobotlar
  {
    key: "reports",
    name: "Hisobotlar",
    group: "Hisobotlar",
    type: "regular",
    requires: ["payments"],
    routes: ["/api/reports"],
  },
] satisfies FeatureManifest;
