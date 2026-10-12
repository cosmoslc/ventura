import { uz } from "@/lib/uz";

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

/** "3 daqiqa oldin" */
export function timeAgo(d: Date | string, now = new Date()): string {
  const ms = now.getTime() - (typeof d === "string" ? new Date(d) : d).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return uz.servers.ago.now;
  if (min < 60) return uz.servers.ago.minutes(min);
  const h = Math.floor(min / 60);
  if (h < 24) return uz.servers.ago.hours(h);
  return uz.servers.ago.days(Math.floor(h / 24));
}

/** Soniyalar → "2 kun 3 soat" */
export function formatDuration(sec: number): string {
  const min = Math.floor(sec / 60);
  if (min < 60) return uz.servers.duration.minutes(min);
  const h = Math.floor(min / 60);
  if (h < 24) return uz.servers.duration.hours(h, min % 60);
  return uz.servers.duration.days(Math.floor(h / 24), h % 24);
}

/** MB → "3.1 GB" yoki "512 MB" */
export function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}
