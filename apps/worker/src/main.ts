import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPanelDb } from "@ventura/db";
import { settings } from "@ventura/db/schema/panel";
import {
  DEPLOY_QUEUE,
  type DeployJobData,
  SERVER_QUEUE,
  type ServerJobData,
  createServerNotifier,
  monitorServers,
  runServerJob,
  WORKER_ACTOR,
  WORKER_HEARTBEAT_KEY,
  createDeployStore,
  createEventHandler,
  createDrivers,
  failInterrupted,
  runDeployment,
  startQueue,
} from "@ventura/deploy";
import { createTelegram } from "@ventura/integrations";
import { audit } from "@ventura/security";

/*
 * Ishchi jarayon: navbatdagi fon vazifalarini bajaradi — deploy, serverlar bo'yicha buyruqlar va har daqiqalik
 * server metrikalari. Panel'dan alohida ishlaydi, shuning uchun panel qayta ishga tushsa ham boshlangan ish uzilmaydi.
 *
 *   pnpm worker        — ishga tushirish
 *   pnpm dev           — panel bilan birga, fayl o'zgarsa qayta yuklanadi
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const envFile = resolve(ROOT, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.chdir(ROOT);

const HEARTBEAT_MS = 15_000;
const MONITOR_MS = 60_000;

const db = createPanelDb();
const telegram = createTelegram();
const store = createDeployStore(db);
const onEvent = createEventHandler({ db, telegram });
// Kod shu repozitoriydan (commit qilingan holatdan) olinadi
const drivers = createDrivers({ db, repoRoot: ROOT });

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

const notifyServers = createServerNotifier({ db, telegram });

await queue.work<ServerJobData>(SERVER_QUEUE, { batchSize: 1, pollingIntervalSeconds: 1 }, async (jobs) => {
  for (const job of jobs) {
    const result = await runServerJob(db, job.data, notifyServers);
    console.log(`[server] ${job.data.kind}${job.data.app ? ` ${job.data.app}` : ""} → ${result.status}`);
  }
});

// Serverlar metrikasi: har daqiqa, oldingisi tugamaguncha yangisi boshlanmaydi
let monitoring = false;
const monitor = async () => {
  if (monitoring) return;
  monitoring = true;
  try {
    await monitorServers(db, notifyServers);
  } catch (e) {
    console.error("[monitor]", (e as Error).message);
  } finally {
    monitoring = false;
  }
};
void monitor();
const monitorTimer = setInterval(() => void monitor(), MONITOR_MS);

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
  `[worker] tayyor: "${DEPLOY_QUEUE}" va "${SERVER_QUEUE}" navbatlari kuzatilmoqda, serverlar har daqiqa tekshiriladi${interrupted.length ? `, ${interrupted.length} ta uzilgan deploy yopildi` : ""}`,
);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] ${signal}: joriy vazifa tugashi kutilmoqda…`);
  clearInterval(heartbeat);
  clearInterval(monitorTimer);
  // Boshlangan deploy oxirigacha bajariladi (eng ko'pi 15 daqiqa), yangi vazifa olinmaydi
  await queue.stop({ graceful: true, timeout: 15 * 60_000 }).catch(() => {});
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
