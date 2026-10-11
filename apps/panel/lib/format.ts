/** Toshkent vaqti bilan: 10.10.2026 14:32 */
export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace(",", "");
}

export function formatDate(d: Date | string): string {
  return formatDateTime(d).split(" ")[0] ?? "";
}

/** Savatdagi loyiha butunlay o'chishiga necha kun qoldi (30 kun). */
export function daysLeft(deletedAt: Date, now = new Date()): number {
  const ms = deletedAt.getTime() + 30 * 24 * 3_600_000 - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 3_600_000)));
}
