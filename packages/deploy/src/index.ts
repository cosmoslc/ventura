import { createSimDriver } from "./drivers/sim";
import { type SshDriverDeps, createSshDriver } from "./drivers/ssh";
import type { DriverFactory } from "./types";

export * from "./types";
export { clip, redact } from "./redact";
export { runDeployment, type DeployEvent, type DeployStore, type DeploymentJob, type RunnerDeps } from "./runner";
export { createDeployStore, failInterrupted } from "./store";
export {
  DEPLOY_QUEUE,
  QUEUE_SCHEMA,
  SERVER_QUEUE,
  WORKER_HEARTBEAT_KEY,
  WORKER_STALE_MS,
  enqueueDeploy,
  startQueue,
  type DeployJobData,
  type Queue,
} from "./queue";
export {
  WORKER_ACTOR,
  createEventHandler,
  providerFor,
  recentDeployments,
  requestDeployment,
  type RequestResult,
} from "./service";
export { createSimDriver } from "./drivers/sim";
export { WSL_DISTRO, wslControlError } from "./wsl";
export { createSshDriver } from "./drivers/ssh";
export { SshError, connect, fingerprint, generateKeyPair, sh, type SshSession, type SshTarget } from "./ssh";
export {
  addServer,
  checkServer,
  findServer,
  openSession,
  updateServer,
  type CheckResult,
  type ServerPatch,
  type ServerRow,
  type UpdateServerResult,
} from "./servers";
export {
  DISK_ALERT,
  MEMORY_ALERT,
  ONLINE_WINDOW_MS,
  type AlertEvent,
  type ServerState,
  nextAlerts,
  parseMetrics,
  serverState,
} from "./metrics";
export {
  METRICS_RETENTION_DAYS,
  type DeleteServerResult,
  type Notify,
  type ServerJobData,
  createDatabase,
  createServerNotifier,
  deleteServer,
  enqueueServerJob,
  monitorServers,
  probeServer,
  recordProbe,
  runServerJob,
} from "./monitor";

export {
  DB_NAME_RE,
  DB_SIZE_ALERT_BYTES,
  SYSTEM_DATABASES,
  dbNameFor,
  dbPasswordOwner,
  nextDbAlerts,
  parseDbList,
  projectUsage,
  quotaBytesOf,
} from "./databases";

export { activeProjectsOn, dropDatabase, purgeProject, trashedProject } from "./purge";
export { moveProjectDb } from "./move";
export { moveProjectToSupabase, type MoveToSupabaseOptions } from "./move-supabase";
export {
  SUPABASE_API_BASE,
  buildSupabaseDatabaseUrl,
  createSupabaseProject,
  executeSupabaseSql,
  getSupabaseApiKeys,
  getSupabaseDatabaseUsage,
  getSupabasePoolerConfig,
  getSupabaseProject,
  listSupabaseOrganizations,
  listSupabaseProjects,
  testSupabaseConnection,
  updateSupabaseProjectName,
  type SupabaseApiKey,
  type SupabaseDatabaseUsage,
  type SupabaseOrg,
  type SupabasePoolerConfig,
  type SupabaseProject,
} from "./supabase";

/** Har deploy uchun yangi drayver beradi. Noma'lum nom — xato (deploy "yiqilgan" bo'lib yoziladi). */
export function createDrivers(deps: SshDriverDeps): DriverFactory {
  return (kind) => {
    if (kind === "sim") return createSimDriver();
    if (kind === "ssh") return createSshDriver(deps);
    throw new Error(`"${kind}" deploy drayveri hali qo'shilmagan`);
  };
}
