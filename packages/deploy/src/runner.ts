import type { DeployStatus, StepStatus } from "@ventura/db/schema/panel";
import { clip, redact } from "./redact";
import {
  type DeployContext,
  type DriverFactory,
  type LogStream,
  OPTIONAL_STEPS,
  STEPS,
  STEP_PHASE,
  SWITCH_STEP,
  StepError,
  type StepKey,
} from "./types";

/*
 * Bitta deploy'ni boshidan oxirigacha yuritadi: qadamlar tartibi, holatlar, log, xatoda to'xtash
 * va (sayt almashtirilgan bo'lsa) orqaga qaytish. Baza va tashqi xizmatlar `RunnerDeps` orqali
 * beriladi, shuning uchun mantiq bazasiz test qilinadi.
 */

export interface DeploymentJob {
  id: string;
  number: number;
  status: DeployStatus;
  provider: string;
  project: DeployContext["project"];
  /** Logda yashirilishi kerak bo'lgan qiymatlar */
  secrets: readonly string[];
}

export interface LogLine {
  step: StepKey;
  stream: LogStream;
  line: string;
}

export interface DeployStore {
  load(id: string): Promise<DeploymentJob | null>;
  /** `queued` → `building`. Boshqa jarayon allaqachon boshlagan bo'lsa false qaytaradi. */
  claim(id: string): Promise<boolean>;
  setStatus(id: string, status: DeployStatus): Promise<void>;
  setStep(id: string, step: StepKey, status: StepStatus, exitCode?: number): Promise<void>;
  appendLogs(id: string, lines: LogLine[]): Promise<void>;
  finish(
    id: string,
    result: { status: "ready" | "failed"; error?: string; commitSha?: string; releasePath?: string },
  ): Promise<void>;
  /** Birinchi muvaffaqiyatli deploy loyihani `active` qiladi. */
  activateProject(projectId: string): Promise<void>;
}

export interface DeployEvent {
  type: "building" | "deploying" | "ready" | "failed";
  job: DeploymentJob;
  error?: string;
  failedStep?: StepKey;
  rolledBack?: boolean;
}

export interface RunnerDeps {
  store: DeployStore;
  driver: DriverFactory;
  /** Har holat o'zgarishi: audit jurnali, Telegram va h.k. Xatosi deploy'ni to'xtatmaydi. */
  onEvent?: (event: DeployEvent) => Promise<void>;
}

const FLUSH_MS = 250;
const FLUSH_LINES = 40;

export async function runDeployment(deps: RunnerDeps, deploymentId: string): Promise<DeployStatus | "skipped"> {
  const { store } = deps;
  const job = await store.load(deploymentId);
  // Navbat vazifani qayta yetkazsa yoki deploy bekor qilingan bo'lsa — ikkinchi marta bajarilmaydi
  if (!job || job.status !== "queued" || !(await store.claim(deploymentId))) return "skipped";

  const emit = async (event: Omit<DeployEvent, "job">) => {
    try {
      await deps.onEvent?.({ ...event, job });
    } catch (e) {
      console.error("[deploy] hodisa yuborilmadi:", (e as Error).message);
    }
  };

  // Log qatorlari to'planib, bo'lak-bo'lak yoziladi (har qator uchun alohida so'rov emas)
  let buffer: LogLine[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!buffer.length) return writing;
    const lines = buffer;
    buffer = [];
    writing = writing
      .then(() => store.appendLogs(deploymentId, lines))
      .catch((e) => console.error("[deploy] log yozilmadi:", (e as Error).message));
    return writing;
  };
  const logger =
    (step: StepKey) =>
    (line: string, stream: LogStream = "out") => {
      for (const part of line.split(/\r?\n/)) {
        if (!part && stream !== "info") continue;
        buffer.push({ step, stream, line: clip(redact(part, job.secrets)) });
      }
      if (buffer.length >= FLUSH_LINES) void flush();
      else timer ??= setTimeout(() => void flush(), FLUSH_MS);
    };

  const ctx: DeployContext = { deploymentId, number: job.number, project: job.project };
  const safe = (text: string) => clip(redact(text, job.secrets), 500);
  let driver;
  try {
    driver = deps.driver(job.provider);
  } catch (e) {
    const error = safe((e as Error).message);
    await store.finish(deploymentId, { status: "failed", error });
    await emit({ type: "failed", error });
    return "failed";
  }

  await emit({ type: "building" });
  let phase: DeployStatus = "building";
  let switched = false;

  for (const [index, step] of STEPS.entries()) {
    if (STEP_PHASE[step] !== phase) {
      phase = STEP_PHASE[step];
      await store.setStatus(deploymentId, phase);
      await emit({ type: "deploying" });
    }
    const log = logger(step);
    await store.setStep(deploymentId, step, "running");
    try {
      const result = await driver.run(step, ctx, log);
      if (result?.commitSha) ctx.commitSha = result.commitSha;
      if (result?.releasePath) ctx.releasePath = result.releasePath;
      await flush();
      await store.setStep(deploymentId, step, "ok", 0);
      if (step === SWITCH_STEP) switched = true;
    } catch (e) {
      const error = safe((e as Error).message || "Noma'lum xato");
      const exitCode = e instanceof StepError ? e.exitCode : 1;
      log(error, "err");
      await flush();
      await store.setStep(deploymentId, step, "failed", exitCode);

      if (OPTIONAL_STEPS.has(step)) {
        log("Bu qadam majburiy emas — deploy davom etadi.", "info");
        await flush();
        continue;
      }

      // Sayt yangi relizga o'tib bo'lgan: oldingi ishlagan versiyaga qaytariladi (SPEC 6, 7-qadam)
      let rolledBack = false;
      if (switched) {
        log("Oldingi relizga qaytarilmoqda…", "info");
        try {
          await driver.rollback(ctx, log);
          rolledBack = true;
          log("Oldingi reliz tiklandi.", "info");
        } catch (rollbackError) {
          log(`Qaytarib bo'lmadi: ${safe((rollbackError as Error).message)}`, "err");
        }
        await flush();
      }

      for (const rest of STEPS.slice(index + 1)) await store.setStep(deploymentId, rest, "skipped");
      await store.finish(deploymentId, {
        status: "failed",
        error,
        commitSha: ctx.commitSha,
        releasePath: ctx.releasePath,
      });
      await emit({ type: "failed", error, failedStep: step, rolledBack });
      return "failed";
    }
  }

  await flush();
  await store.finish(deploymentId, { status: "ready", commitSha: ctx.commitSha, releasePath: ctx.releasePath });
  await store.activateProject(job.project.id);
  await emit({ type: "ready" });
  return "ready";
}
