import { z } from "zod";

/*
 * Shablon manifesti (SPEC 8-bo'lim): har shablon apps/<shablon>/features.ts da o'z bo'limlarini e'lon qiladi.
 * Panel manifestni `pnpm templates:sync` orqali bazaga yozadi va undan o'qiydi (ilovalar bir-birini import qilmaydi).
 */

export const FEATURE_TYPES = ["permanent", "core", "mode", "regular"] as const;
export type FeatureType = (typeof FEATURE_TYPES)[number];

export const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  permanent: "Doimiy",
  core: "O'zak",
  mode: "Rejim",
  regular: "Oddiy",
};

export const featureSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, "kalit: kichik harf, raqam va _"),
  name: z.string().min(1),
  group: z.string().min(1),
  type: z.enum(FEATURE_TYPES),
  description: z.string().optional(),
  /** ready — ishlaydi; soon — hali qurilmagan (yoqilsa "Tez kunda" sahifasi), panelda belgilanadi */
  status: z.enum(["ready", "soon"]).default("ready"),
  requires: z.array(z.string()).default([]),
  routes: z.array(z.string()).default([]),
  /** Menyu bandlari. `section` — menyudagi bo'lim sarlavhasi (berilmasa `group`): bitta bo'lim bandlari turli joyda bo'lishi mumkin. */
  nav: z.array(z.object({ label: z.string(), href: z.string(), section: z.string().min(1).optional() })).default([]),
});

export type Feature = z.infer<typeof featureSchema>;
export type FeatureManifest = z.input<typeof featureSchema>[];

export const templateSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  version: z.string().min(1),
});

export type TemplateInfo = z.infer<typeof templateSchema>;

export interface TemplateModule {
  template: TemplateInfo;
  features: FeatureManifest;
}

/** Manifestni tekshiradi: kalitlar takrorlanmaydi, `requires` mavjud bo'limlarga ishora qiladi, halqa yo'q. */
export function parseManifest(mod: TemplateModule): { template: TemplateInfo; features: Feature[] } {
  const template = templateSchema.parse(mod.template);
  const features = z.array(featureSchema).parse(mod.features);
  const keys = new Set<string>();
  for (const f of features) {
    if (keys.has(f.key)) throw new Error(`Bo'lim kaliti takrorlangan: ${f.key}`);
    keys.add(f.key);
  }
  for (const f of features) {
    for (const r of f.requires) if (!keys.has(r)) throw new Error(`${f.key} → noma'lum bo'lim: ${r}`);
  }
  // Halqa (a → b → a) bo'lmasligi kerak
  const byKey = new Map(features.map((f) => [f.key, f]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (k: string, path: string[]) => {
    if (done.has(k)) return;
    if (visiting.has(k)) throw new Error(`Bog'liqlik halqasi: ${[...path, k].join(" → ")}`);
    visiting.add(k);
    for (const r of byKey.get(k)?.requires ?? []) visit(r, [...path, k]);
    visiting.delete(k);
    done.add(k);
  };
  for (const f of features) visit(f.key, []);
  return { template, features };
}

/** Bo'lim yoqilganda unga kerakli barcha bo'limlar (tranzitiv). */
export function withRequirements(features: Feature[], selected: Iterable<string>): Set<string> {
  const byKey = new Map(features.map((f) => [f.key, f]));
  const out = new Set<string>();
  const add = (k: string) => {
    if (out.has(k)) return;
    out.add(k);
    for (const r of byKey.get(k)?.requires ?? []) add(r);
  };
  for (const k of selected) add(k);
  for (const f of features) if (f.type === "permanent") add(f.key);
  return out;
}

/** Bo'lim o'chirilganda unga tayanadigan bo'limlar ham o'chadi (avval ro'yxat ko'rsatiladi). */
export function dependentsOf(features: Feature[], key: string): string[] {
  const out = new Set<string>();
  const walk = (k: string) => {
    for (const f of features) {
      if (f.requires.includes(k) && !out.has(f.key)) {
        out.add(f.key);
        walk(f.key);
      }
    }
  };
  walk(key);
  return [...out];
}
