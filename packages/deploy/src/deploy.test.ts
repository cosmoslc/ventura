import { describe, expect, it } from "vitest";
import type { DeployStatus, StepStatus } from "@ventura/db/schema/panel";
import { redact } from "./redact";
import { type DeployEvent, type DeployStore, type DeploymentJob, type LogLine, runDeployment } from "./runner";
import { type DeployDriver, STEPS, StepError, type StepKey } from "./types";

function memoryStore(job: Partial<DeploymentJob> = {}) {
  const state = {
    job: {
      id: "d1",
      number: 1,
      status: "queued" as DeployStatus,
      provider: "test",
      project: {
        id: "p1",
        slug: "bilim",
        name: "Bilim",
        templateKey: "edu-crm",
        appPath: "apps/edu-crm",
        mode: "shared",
        dbStrategy: "db_per_tenant",
      },
      secrets: [] as readonly string[],
      ...job,
    },
    steps: Object.fromEntries(STEPS.map((s) => [s, "pending"])) as Record<StepKey, StepStatus>,
    statuses: [] as DeployStatus[],
    logs: [] as LogLine[],
    result: null as null | { status: string; error?: string; commitSha?: string; releasePath?: string },
    activated: false,
  };
  const store: DeployStore = {
    load: async () => ({ ...state.job }),
    claim: async () => {
      if (state.job.status !== "queued") return false;
      state.job.status = "building";
      state.statuses.push("building");
      return true;
    },
    setStatus: async (_id, status) => {
      state.job.status = status;
      state.statuses.push(status);
    },
    setStep: async (_id, step, status) => {
      state.steps[step] = status;
    },
    appendLogs: async (_id, lines) => {
      state.logs.push(...lines);
    },
    finish: async (_id, result) => {
      state.result = result;
      state.job.status = result.status;
      state.statuses.push(result.status);
    },
    activateProject: async () => {
      state.activated = true;
    },
  };
  return { state, store };
}

function fakeDriver(options: { fail?: StepKey; rollbackFails?: boolean; say?: string } = {}) {
  const ran: string[] = [];
  const driver: DeployDriver = {
    kind: "test",
    async run(step, _ctx, log) {
      ran.push(step);
      log(`$ ${step}`, "cmd");
      if (options.say) log(options.say);
      if (step === options.fail) throw new StepError(`${step} yiqildi`, 7);
      if (step === "prepare") return { releasePath: "/releases/1" };
      if (step === "fetch") return { commitSha: "abc123" };
    },
    async rollback() {
      ran.push("rollback");
      if (options.rollbackFails) throw new Error("pm2 javob bermadi");
    },
  };
  return { driver, ran };
}

const run = (store: DeployStore, driver: DeployDriver, events: DeployEvent[] = []) =>
  runDeployment({ store, driver: () => driver, onEvent: async (e) => void events.push(e) }, "d1");

describe("runDeployment", () => {
  it("hamma qadam o'tsa: ready, loyiha faollashadi, commit va reliz yoziladi", async () => {
    const { state, store } = memoryStore();
    const { driver, ran } = fakeDriver();
    const events: DeployEvent[] = [];
    expect(await run(store, driver, events)).toBe("ready");
    expect(ran).toEqual([...STEPS]);
    expect(Object.values(state.steps).every((s) => s === "ok")).toBe(true);
    expect(state.statuses).toEqual(["building", "deploying", "ready"]);
    expect(state.result).toMatchObject({ status: "ready", commitSha: "abc123", releasePath: "/releases/1" });
    expect(state.activated).toBe(true);
    expect(events.map((e) => e.type)).toEqual(["building", "deploying", "ready"]);
  });

  it("build yiqilsa: keyingi qadamlar bajarilmaydi, sayt almashtirilmagan — rollback yo'q", async () => {
    const { state, store } = memoryStore();
    const { driver, ran } = fakeDriver({ fail: "build" });
    const events: DeployEvent[] = [];
    expect(await run(store, driver, events)).toBe("failed");
    expect(ran).toEqual(["prepare", "fetch", "env", "build"]);
    expect(state.steps.build).toBe("failed");
    expect(state.steps.migrate).toBe("skipped");
    expect(state.steps.release).toBe("skipped");
    expect(state.result).toMatchObject({ status: "failed", error: "build yiqildi" });
    expect(state.activated).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: "failed", failedStep: "build", rolledBack: false });
  });

  it("health yiqilsa: sayt almashtirilgan bo'ladi — oldingi relizga qaytariladi", async () => {
    const { state, store } = memoryStore();
    const { driver, ran } = fakeDriver({ fail: "health" });
    const events: DeployEvent[] = [];
    expect(await run(store, driver, events)).toBe("failed");
    expect(ran.at(-1)).toBe("rollback");
    expect(state.steps.cleanup).toBe("skipped");
    expect(state.activated).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: "failed", failedStep: "health", rolledBack: true });
  });

  it("rollback ham yiqilsa: deploy failed, rolledBack=false va sabab logda", async () => {
    const { state, store } = memoryStore();
    const { driver } = fakeDriver({ fail: "health", rollbackFails: true });
    const events: DeployEvent[] = [];
    expect(await run(store, driver, events)).toBe("failed");
    expect(events.at(-1)).toMatchObject({ rolledBack: false });
    expect(state.logs.some((l) => l.stream === "err" && l.line.includes("pm2 javob bermadi"))).toBe(true);
  });

  it("cleanup yiqilsa ham deploy muvaffaqiyatli: sayt allaqachon yangi versiyada", async () => {
    const { state, store } = memoryStore();
    const { driver } = fakeDriver({ fail: "cleanup" });
    expect(await run(store, driver)).toBe("ready");
    expect(state.steps.cleanup).toBe("failed");
    expect(state.activated).toBe(true);
  });

  it("navbatda turmagan deploy ikkinchi marta bajarilmaydi", async () => {
    const { store } = memoryStore({ status: "ready" });
    const { driver, ran } = fakeDriver();
    expect(await run(store, driver)).toBe("skipped");
    expect(ran).toEqual([]);
  });

  it("noma'lum drayver: deploy yiqilgan deb yoziladi", async () => {
    const { state, store } = memoryStore();
    const status = await runDeployment(
      {
        store,
        driver: () => {
          throw new Error("drayver yo'q");
        },
      },
      "d1",
    );
    expect(status).toBe("failed");
    expect(state.result).toMatchObject({ status: "failed", error: "drayver yo'q" });
  });

  it("sirlar logga ham, xato matniga ham tushmaydi", async () => {
    const { state, store } = memoryStore({ secrets: ["juda-maxfiy-parol"] });
    const { driver } = fakeDriver({ say: "ulanish: juda-maxfiy-parol bilan", fail: "migrate" });
    driver.run = async (step, _ctx, log) => {
      log("ulanish: juda-maxfiy-parol bilan");
      if (step === "migrate") throw new Error("auth failed for juda-maxfiy-parol");
    };
    await run(store, driver);
    expect(JSON.stringify(state.logs)).not.toContain("juda-maxfiy-parol");
    expect(state.result?.error).not.toContain("juda-maxfiy-parol");
  });

  it("hodisa yuborish xatosi deploy'ni to'xtatmaydi", async () => {
    const { store } = memoryStore();
    const { driver } = fakeDriver();
    const status = await runDeployment(
      {
        store,
        driver: () => driver,
        onEvent: async () => {
          throw new Error("telegram ishlamayapti");
        },
      },
      "d1",
    );
    expect(status).toBe("ready");
  });
});

describe("redact", () => {
  it("berilgan sir qiymatlarini yashiradi", () => {
    expect(redact("token=abc12345 ishlatildi", ["abc12345"])).not.toContain("abc12345");
  });
  it("ulanish satridagi parolni yashiradi", () => {
    const out = redact("postgres://ventura_app:Sup3rParol@localhost:5432/db");
    expect(out).not.toContain("Sup3rParol");
    expect(out).toContain("ventura_app");
    expect(out).toContain("localhost:5432/db");
  });
  it("GitHub tokeni, Bearer va KEY=... ko'rinishlarini yashiradi", () => {
    expect(redact("git clone https://x-access-token:ghs_abcdefghijklmnopqrstuvwx@github.com/a/b")).not.toContain(
      "abcdefghijklmnopqrstuvwx",
    );
    expect(redact("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def")).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(redact("BETTER_AUTH_SECRET=qwertyuiop123456 PORT=3000")).toBe("BETTER_AUTH_SECRET=•••••• PORT=3000");
  });
  it("oddiy qatorlarga tegmaydi", () => {
    expect(redact("✓ Compiled successfully in 3.3s")).toBe("✓ Compiled successfully in 3.3s");
  });
});
