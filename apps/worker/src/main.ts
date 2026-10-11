import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPanelDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/panel";
import {
  DEPLOY_QUEUE,
  type DeployJobData,
  WORKER_ACTOR,
  WORKER_HEARTBEAT_KEY,
  createDeployStore,
  createEventHandler,
  drivers,
  failInterrupted,
  runDeployment,
  startQueue,
} from "@ventura/deploy";
import { createTelegram } from "@ventura/integrations";
import { audit } from "@ventura/security";

/*
 * Ishchi jarayon: navbatdagi fon vazifalarini bajaradi (hozircha — deploy). Panel'dan alohida ishlaydi,
 * shuning uchun panel qayta ishga tushsa ham boshlangan deploy uzilmaydi.
 *
 *   pnpm worker        — ishga tushirish
 *   pnpm dev           — panel bilan birga, fayl o'zgarsa qayta yuklanadi
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const envFile = resolve(ROOT, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.chdir(ROOT);

const HEARTBEAT_MS = 15_000;

const db = createPanelDb();
const telegram = createTelegram();
const store = createDeployStore(db);
const onEvent = createEventHandler({ db, telegram });

// Oldingi jarayon deploy o'rtasida o'chgan bo'lsa, o'sha deploylar "yiqilgan" deb yopiladi
const interrupted = await failInterrupted(db, "Ishchi jarayon deploy vaqtida to'xtab qoldi");
for (const dep of interrupted) {
  await audit.record(db, {
    actor: WORKER_ACTOR,
    action: "deploy.failed",
    target: { type: "project", id: dep.projectId },
    metadata: { deploymentId: dep.id, number: dep.number, error: "worker_interrupted" },
  });
}

const queue = await startQueue({ worker: true });

await queue.work<DeployJobData>(DEPLOY_QUEUE, { batchSize: 1, pollingIntervalSeconds: 1 }, async (jobs) => {
  for (const job of jobs) {
    const status = await runDeployment({ store, driver: drivers, onEvent }, job.data.deploymentId);
    console.log(`[deploy] ${job.data.deploymentId} → ${status}`);
  }
});

const beat = () =>
  db
    .insert(settings)
    .values({ key: WORKER_HEARTBEAT_KEY, value: { at: new Date().toISOString(), pid: process.pid } })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { at: new Date().toISOString(), pid: process.pid }, updatedAt: new Date() },
    })
    .catch((e: Error) => console.error("[worker] heartbeat:", e.message));
await beat();
const heartbeat = setInterval(beat, HEARTBEAT_MS);

console.log(
  `[worker] tayyor: "${DEPLOY_QUEUE}" navbati kuzatilmoqda${interrupted.length ? `, ${interrupted.length} ta uzilgan deploy yopildi` : ""}`,
);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] ${signal}: joriy vazifa tugashi kutilmoqda…`);
  clearInterval(heartbeat);
  // Boshlangan deploy oxirigacha bajariladi (eng ko'pi 15 daqiqa), yangi vazifa olinmaydi
  await queue.stop({ graceful: true, timeout: 15 * 60_000 }).catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
