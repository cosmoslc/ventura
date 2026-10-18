/*
 * Ilova jarayoni ishga tushganda (Next instrumentation): SMS navbati fon vazifasi (ADR 0055). Faqat Node muhitida;
 * `SMS_SCHEDULER=off` — o'chirish (masalan e2e testlarda).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.SMS_SCHEDULER === "off") return;
  const { startSmsScheduler } = await import("./lib/server/sms/scheduler");
  startSmsScheduler();
}
