import { PgBoss } from "pg-boss";

/*
 * Vazifalar navbati (pg-boss, CLAUDE.md: deploy faqat fon vazifasi sifatida). Navbat panel bazasining
 * `pgboss` sxemasida turadi. Panel faqat vazifa qo'shadi; bajarish — alohida ishchi jarayonda (apps/worker).
 */

export const DEPLOY_QUEUE = "deploy";
export const QUEUE_SCHEMA = "pgboss";
/** Ishchi jarayon `settings` jadvaliga yozib turadigan "tirikman" belgisi */
export const WORKER_HEARTBEAT_KEY = "worker.heartbeat";
/** Belgi shundan eski bo'lsa, ishchi jarayon ishlamayapti deb hisoblanadi */
export const WORKER_STALE_MS = 60_000;

export interface DeployJobData {
  deploymentId: string;
}

export type Queue = PgBoss;

export interface QueueOptions {
  url?: string;
  /** Ishchi jarayon: navbatni kuzatadi va texnik xizmat (eskirgan vazifalarni tozalash) ishlarini bajaradi */
  worker?: boolean;
}

export async function startQueue({
  url = process.env.PANEL_DATABASE_URL,
  worker = false,
}: QueueOptions = {}): Promise<Queue> {
  if (!url) throw new Error("PANEL_DATABASE_URL berilmagan");
  const boss = new PgBoss({
    connectionString: url,
    schema: QUEUE_SCHEMA,
    application_name: worker ? "ventura-worker" : "ventura-panel",
    max: worker ? 4 : 2,
    supervise: worker,
    schedule: false,
  });
  // Ulanish uzilsa jarayon yiqilmasin; pg-boss o'zi qayta ulanadi
  boss.on("error", (e) => console.error("[navbat]", e.message));
  try {
    await boss.start();
  } catch (e) {
    const message = (e as Error).message;
    if (/permission denied/i.test(message)) {
      throw new Error("Navbat sxemasini yaratishga ruxsat yo'q. Avval migratsiyalarni qo'llang: pnpm db:migrate", {
        cause: e,
      });
    }
    throw e;
  }
  if (!(await boss.getQueue(DEPLOY_QUEUE))) {
    // Deploy avtomatik qayta urinilmaydi: yarim bajarilgan deploy'ni takrorlash xavfli
    await boss.createQueue(DEPLOY_QUEUE, { retryLimit: 0, expireInSeconds: 60 * 60 });
  }
  return boss;
}

export async function enqueueDeploy(queue: Queue, deploymentId: string): Promise<void> {
  const data: DeployJobData = { deploymentId };
  const id = await queue.send(DEPLOY_QUEUE, data, { singletonKey: deploymentId });
  if (!id) throw new Error("Vazifa navbatga qo'shilmadi");
}
