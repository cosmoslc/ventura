import { z } from "zod";
import { DB_STRATEGIES, DEPLOY_MODES, TARGET_KINDS } from "@ventura/db/schema/panel";
import { uz } from "./uz";

/* Loyiha qoidalari — Yangi loyiha formasi (client) va server action bir xil tekshiradi. */

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const HOST_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
export const RESERVED_SLUGS = new Set(["admin", "api", "www", "panel", "mail", "app", "static", "cdn"]);
export const BASE_DOMAIN = "ventura.uz";

/** Nomdan slug: "Bilim Akademiyasi" → "bilim-akademiyasi" (o', g' tutuqlari tashlanadi). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[ʻʼ'’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function slugProblem(slug: string): string | null {
  if (!SLUG_RE.test(slug)) return uz.projects.slugInvalid;
  if (RESERVED_SLUGS.has(slug)) return uz.projects.slugTaken;
  return null;
}

/* ---------- Rang kontrasti (SPEC 8: o'qilmaydigan rang tanlansa ogohlantirish) ---------- */

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Oq matn bilan kontrast nisbati (WCAG). Tugma va aktiv band matni oq. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

export const BRAND_PRESETS = ["#3f6df6", "#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777"];

/* ---------- Server tomonidagi to'liq sxema ---------- */

export const projectInputSchema = z
  .object({
    templateKey: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim(),
    clientId: z.string().uuid().nullable(),
    newClient: z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim() }).nullable(),
    domainKind: z.enum(["subdomain", "custom"]),
    customDomain: z.string().trim().toLowerCase(),
    brand: z.object({
      primary: z.string().regex(/^#[0-9a-f]{6}$/i),
      appearance: z.enum(["light", "dark", "system"]),
    }),
    ownerLogin: z
      .string()
      .trim()
      .regex(/^[a-z0-9._-]{3,32}$/i),
    ownerPassword: z.string().min(8).max(128),
    features: z.array(z.string()),
    mode: z.enum(DEPLOY_MODES),
    target: z.enum(TARGET_KINDS),
    dbStrategy: z.enum(DB_STRATEGIES),
    telegramToken: z.string().trim(),
    githubRepo: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const sp = slugProblem(v.slug);
    if (sp) ctx.addIssue({ code: "custom", path: ["slug"], message: sp });
    if (v.domainKind === "custom" && !HOST_RE.test(v.customDomain))
      ctx.addIssue({ code: "custom", path: ["customDomain"], message: uz.projects.hostInvalid });
    if (!v.clientId && !v.newClient)
      ctx.addIssue({ code: "custom", path: ["clientId"], message: uz.wizard.pickClient });
  });

export type ProjectInput = z.infer<typeof projectInputSchema>;
