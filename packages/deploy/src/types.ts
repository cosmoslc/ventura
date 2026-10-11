import type { DeployStatus } from "@ventura/db/schema/panel";

/*
 * Deploy qadamlari (SPEC 6-bo'lim, "SSH drayveri: bitta deploy qadamlari").
 * Drayver har qadamni alohida bajaradi; tartib, holatlar, log va xatoda orqaga qaytish — runner'da.
 */

export const STEPS = ["prepare", "fetch", "env", "build", "migrate", "release", "health", "cleanup"] as const;
export type StepKey = (typeof STEPS)[number];

/** Qadam boshlanganda deploy qaysi holatga o'tadi. */
export const STEP_PHASE: Record<StepKey, Extract<DeployStatus, "building" | "deploying">> = {
  prepare: "building",
  fetch: "building",
  env: "building",
  build: "building",
  migrate: "building",
  release: "deploying",
  health: "deploying",
  cleanup: "deploying",
};

/** Yiqilsa ham deploy muvaffaqiyatli hisoblanadigan qadamlar (sayt allaqachon yangi versiyada ishlayapti). */
export const OPTIONAL_STEPS: ReadonlySet<StepKey> = new Set(["cleanup"]);

/** Shu qadamdan keyin sayt yangi relizga o'tgan bo'ladi: keyingi xato rollback talab qiladi. */
export const SWITCH_STEP: StepKey = "release";

export type LogStream = "cmd" | "out" | "err" | "info";
export type StepLog = (line: string, stream?: LogStream) => void;

/** Drayverga beriladigan ma'lumot. Sirlar faqat shu yerda; logga tushishidan oldin `secrets` bo'yicha yashiriladi. */
export interface DeployContext {
  deploymentId: string;
  number: number;
  project: {
    id: string;
    slug: string;
    name: string;
    templateKey: string;
    appPath: string;
    mode: string;
    dbStrategy: string;
  };
  /** Qadamlar davomida to'ldiriladi */
  commitSha?: string;
  releasePath?: string;
}

export interface StepResult {
  commitSha?: string;
  releasePath?: string;
}

export interface DeployDriver {
  readonly kind: string;
  /** Bitta qadamni bajaradi. Xato bo'lsa `StepError` (yoki istalgan xato) tashlaydi. */
  run(step: StepKey, ctx: DeployContext, log: StepLog): Promise<StepResult | void>;
  /** `release` dan keyingi qadam yiqilganda: saytni oldingi relizga qaytaradi. */
  rollback(ctx: DeployContext, log: StepLog): Promise<void>;
}

export class StepError extends Error {
  constructor(
    message: string,
    readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "StepError";
  }
}

export type DriverFactory = (kind: string) => DeployDriver;
