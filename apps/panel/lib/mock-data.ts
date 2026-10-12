import { Activity, Bell, Blocks, FolderKanban, LayoutDashboard, Plug, Server, Settings, Users } from "lucide-react";
import type { NavSection } from "@ventura/ui/sidebar";

// Soxta ma'lumotlar — faqat vizual sinov uchun. Baza va login yo'q.

export const navSections: NavSection[] = [
  {
    title: "Asosiy",
    items: [
      { id: "home", label: "Bosh sahifa", icon: LayoutDashboard, color: "#006aff" },
      {
        id: "projects",
        label: "Loyihalar",
        icon: FolderKanban,
        color: "#8b5cf6",
        children: [
          { id: "projects-all", label: "Barcha loyihalar" },
          { id: "projects-new", label: "Yangi loyiha" },
          { id: "projects-trash", label: "Savat" },
        ],
      },
      { id: "templates", label: "Shablonlar", icon: Blocks, color: "#27ae60" },
      { id: "servers", label: "Serverlar", icon: Server, color: "#0ea5e9", count: 5 },
      { id: "clients", label: "Mijozlar", icon: Users, color: "#f59e0b" },
    ],
  },
  {
    title: "Nazorat",
    items: [
      { id: "audit", label: "Audit jurnali", icon: Activity, color: "#ec4899" },
      { id: "alerts", label: "Ogohlantirishlar", icon: Bell, color: "#f0506e", count: 3 },
    ],
  },
  {
    title: "Tizim",
    items: [
      { id: "integrations", label: "Integratsiyalar", icon: Plug, color: "#14b8a6" },
      {
        id: "settings",
        label: "Sozlamalar",
        icon: Settings,
        color: "#64748b",
        children: [
          { id: "settings-security", label: "Xavfsizlik" },
          { id: "settings-admins", label: "Adminlar va rollar" },
          { id: "settings-danger", label: "Xavfli hudud" },
        ],
      },
    ],
  },
];

export type ProjectStatus = "active" | "building" | "failed" | "paused" | "trial";

export interface ProjectRow {
  id: string;
  name: string;
  client: string;
  domain: string;
  template: "edu-crm" | "sawmill";
  target: "Uydagi server" | "Online VPS" | "Vercel";
  mode: "shared" | "dedicated" | "fork";
  status: ProjectStatus;
  lastDeploy: string;
  phone: string;
}

export const statusMeta: Record<
  ProjectStatus,
  { label: string; tone: "success" | "info" | "danger" | "warning" | "neutral" }
> = {
  active: { label: "Ishlayapti", tone: "success" },
  building: { label: "Build", tone: "info" },
  failed: { label: "Yiqildi", tone: "danger" },
  paused: { label: "To'xtatilgan", tone: "warning" },
  trial: { label: "Sinov", tone: "neutral" },
};

const names = [
  ["Bilim akademiyasi", "Aziza Karimova"],
  ["Zukko o'quv markazi", "Javohir Tursunov"],
  ["Samarqand Yog'och", "Rustam Aliyev"],
  ["Ilm ziyo", "Madina Rahimova"],
  ["Future Kids", "Sardor Yusupov"],
  ["Navoiy Taxta", "Botir Qodirov"],
  ["English Hub", "Nilufar Ismoilova"],
  ["Matematika plus", "Otabek Nazarov"],
  ["Pilorama Chirchiq", "Ulug'bek Hamidov"],
  ["IT Park junior", "Dilnoza Sobirova"],
  ["Al-Xorazmiy", "Shohruh Ergashev"],
  ["Smart Academy", "Gulnora Mirzayeva"],
  ["Kamalak", "Abdulla Saidov"],
  ["Lider ta'lim", "Feruza Xolmatova"],
  ["Farg'ona Les", "Jamshid Usmonov"],
  ["Cambridge Tashkent", "Kamola Abdullayeva"],
  ["Yosh dasturchi", "Bekzod Rahmonov"],
  ["Iqtidor", "Shahnoza Valiyeva"],
  ["Andijon Mebel", "Anvar Mahmudov"],
] as const;

const statuses: ProjectStatus[] = [
  "active",
  "active",
  "active",
  "building",
  "active",
  "failed",
  "active",
  "paused",
  "trial",
  "active",
];
const targets: ProjectRow["target"][] = ["Uydagi server", "Online VPS", "Uydagi server", "Vercel"];
const modes: ProjectRow["mode"][] = ["shared", "shared", "dedicated", "shared", "fork"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/['ʻ’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 2)
    .join("");
}

export const projects: ProjectRow[] = Array.from({ length: 37 }, (_, i) => {
  const [name, client] = names[i % names.length]!;
  const isSaw = /Yog'och|Taxta|Pilorama|Les|Mebel/.test(name);
  const suffix = i >= names.length ? `-${Math.floor(i / names.length) + 1}` : "";
  const day = 10 - (i % 9);
  const hh = String(8 + ((i * 7) % 12)).padStart(2, "0");
  const mm = String((i * 13) % 60).padStart(2, "0");
  return {
    id: `p${i + 1}`,
    name: suffix ? `${name} ${Math.floor(i / names.length) + 1}` : name,
    client,
    domain: i % 6 === 4 ? `crm.${slugify(name)}.uz` : `${slugify(name)}${suffix}.ventura.uz`,
    template: isSaw ? "sawmill" : "edu-crm",
    target: targets[i % targets.length]!,
    mode: modes[i % modes.length]!,
    status: statuses[i % statuses.length]!,
    lastDeploy: `${String(day).padStart(2, "0")}.10.2026 ${hh}:${mm}`,
    phone: `9${(i * 3) % 10} ${String(100 + ((i * 37) % 900))} ${String(10 + ((i * 11) % 90))} ${String(10 + ((i * 7) % 90))}`,
  };
});

export const stats = [
  { label: "Faol loyihalar", value: "24", tone: 1, trend: { value: "3", up: true } },
  { label: "Bugungi deploylar", value: "12", tone: 2, trend: { value: "18%", up: true } },
  { label: "Yiqilgan buildlar", value: "2", tone: 3, trend: { value: "1", up: false } },
  { label: "Ulangan serverlar", value: "5", tone: 4 },
] as const;

/** Rang tanlash namunasi (kurs/filial ranglari — ma'lumot, token emas) */
export const demoColors = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#10b981", label: "Yashil" },
  { value: "#f59e0b", label: "Sariq" },
  { value: "#f43f5e", label: "Qizil" },
  { value: "#06b6d4", label: "Moviy" },
  { value: "#475569", label: "Kulrang" },
];

/** Grafik namunasi: 24 soat, har 30 daqiqa (barqaror — har chizishda bir xil) */
const T0 = Date.UTC(2026, 9, 12, 0, 0);
export const demoMetrics = {
  times: Array.from({ length: 48 }, (_, i) => T0 + i * 30 * 60_000),
  cpu: Array.from({ length: 48 }, (_, i) => Math.round(30 + 22 * Math.sin(i / 5) + (i % 7))),
  mem: Array.from({ length: 48 }, (_, i) => Math.round(55 + 8 * Math.sin(i / 11))),
};
