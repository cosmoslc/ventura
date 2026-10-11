import { createSimDriver } from "./drivers/sim";
import type { DriverFactory } from "./types";

export * from "./types";
export { clip, redact } from "./redact";
export { runDeployment, type DeployEvent, type DeployStore, type DeploymentJob, type RunnerDeps } from "./runner";
export { createDeployStore, failInterrupted } from "./store";
export {
  DEPLOY_QUEUE,
  QUEUE_SCHEMA,
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
export { SshError, connect, fingerprint, generateKeyPair, sh, type SshSession, type SshTarget } from "./ssh";
export { addServer, checkServer, findServer, openSession, type CheckResult, type ServerRow } from "./servers";

/** Drayverni nomi bo'yicha beradi. Noma'lum nom — xato (deploy "yiqilgan" bo'lib yoziladi). */
export const drivers: DriverFactory = (kind) => {
  if (kind === "sim") return createSimDriver();
  throw new Error(`"${kind}" deploy drayveri hali qo'shilmagan`);
};
