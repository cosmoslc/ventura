import "server-only";
import { tenantDeps } from "../deps";
import { allTenants } from "../tenant";
import { flush, poll } from "./outbox";
import { senderFor } from "./sender";

/*
 * SMS fon vazifasi (docs/EDU-CRM-SMS.md, 4.4; ADR 0055): ilova jarayoni ichida har daqiqada — `sms` bo'limi yoqilgan
 * va bazasi sozlangan har mijoz uchun navbatni yuboradi va holatlarni so'raydi. Alohida PM2 jarayoni kerak emas:
 * har ilova nusxasi o'z mijozlariga xizmat qiladi; bir mijoz ikki nusxada bo'lsa ham SKIP LOCKED takror yubormaydi.
 * Server amali yuborgandan keyin `flushTenant` ni darhol chaqiradi (foydalanuvchi bir daqiqa kutmasin).
 */

const INTERVAL_MS = 60_000;
const g = globalThis as unknown as {
  __smsTimer?: ReturnType<typeof setInterval>;
  __smsBusy?: Set<string>;
  /** Taymer har safar eng so'nggi modul kodini chaqiradi (dev'da modul qayta yuklansa ham) */
  __smsTick?: () => Promise<void>;
};
const busy = (g.__smsBusy ??= new Set());

/** Bitta mijoz navbati; shu mijoz uchun boshqa aylanish ishlayotgan bo'lsa — o'tkazib yuboradi */
export async function flushTenant(tenant: Parameters<typeof tenantDeps>[0]): Promise<void> {
  if (!tenant.features.includes("sms") || busy.has(tenant.slug)) return;
  const deps = tenantDeps(tenant);
  if (!deps) return;
  busy.add(tenant.slug);
  try {
    const sender = await senderFor(deps.db, tenant, deps.secret);
    if (!sender) return;
    await flush(deps.db, sender);
    await poll(deps.db, sender);
  } catch (e) {
    // Xato matnida sir yo'q (Eskiz klienti); bitta mijoz xatosi boshqalarni to'xtatmaydi
    console.error(`[sms] ${tenant.slug}:`, (e as Error).message);
  } finally {
    busy.delete(tenant.slug);
  }
}

async function tick() {
  for (const tenant of allTenants()) await flushTenant(tenant);
}
g.__smsTick = tick;

export function startSmsScheduler() {
  if (g.__smsTimer) return;
  g.__smsTimer = setInterval(() => void g.__smsTick?.(), INTERVAL_MS);
  g.__smsTimer.unref?.();
  setTimeout(() => void g.__smsTick?.(), 5_000).unref?.();
}
