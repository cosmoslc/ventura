import { formatDate } from "@/lib/format";

/* Qurilmalar va profil ko'rinishi uchun sof yordamchilar (E6g, ADR 0040). */

/** "2026-10-14T09:05:00Z" → "14.10.2026 14:05" (Toshkent vaqti) */
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
  return `${formatDate(day)} ${time}`;
}

export interface PermissionGroupInput {
  id: string;
  title: string;
  permissions: readonly { id: string; name: string }[];
}

export interface PermissionGroup {
  id: string;
  /** "10. Tizim Sozlamalari" → "Tizim Sozlamalari" (tartib raqami ro'yxatda kerak emas) */
  title: string;
  items: { id: string; name: string; approval: boolean }[];
}

/**
 * "Mening ruxsatlarim": katalogdagi tartibda, toifalar bo'yicha; xodimda bo'lmagan ruxsat va bo'sh toifa tushmaydi.
 * "Tasdiq bilan" ruxsatlar alohida belgilanadi (ular `granted` da yo'q, faqat `approvals` da).
 */
export function permissionGroups(
  catalog: readonly PermissionGroupInput[],
  granted: ReadonlySet<string>,
  approvals: ReadonlySet<string>,
): PermissionGroup[] {
  return catalog
    .map((c) => ({
      id: c.id,
      title: c.title.replace(/^\d+\.\s*/, ""),
      items: c.permissions
        .filter((p) => granted.has(p.id) || approvals.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, approval: !granted.has(p.id) })),
    }))
    .filter((g) => g.items.length > 0);
}
