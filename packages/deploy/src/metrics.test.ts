import { describe, expect, it } from "vitest";
import { METRICS_SCRIPT, nextAlerts, parseMetrics, serverState } from "./metrics";

const SAMPLE = [
  "cpu=1000 800 1100 850",
  "cpus=4",
  "load=0.52 0.40 0.31",
  "mem=8000000 2000000",
  "disk=107374182400 96636764160",
  "uptime=86400.55",
  'pm2=[{"name":"edu-crm","status":"online","cpu":1.5,"memory":157286400,"restarts":2,"startedAt":1760000000000}]',
].join("\n");

describe("server metrikasi", () => {
  it("buyruq chiqishini o'qiydi: CPU farqdan, xotira va disk", () => {
    const m = parseMetrics(SAMPLE);
    // 100 birlikdan 50 tasi bo'sh — 50%
    expect(m.cpuPercent).toBe(50);
    expect(m.cpus).toBe(4);
    expect(m.load).toEqual([0.5, 0.4, 0.3]);
    expect(m.memTotalMb).toBe(7813);
    expect(m.memUsedMb).toBe(5859);
    expect(m.diskTotalGb).toBe(100);
    expect(m.diskUsedGb).toBe(90);
    expect(m.uptimeSec).toBe(86401);
    expect(m.processes).toEqual([
      { name: "edu-crm", status: "online", cpu: 1.5, memoryMb: 150, restarts: 2, startedAt: 1760000000000 },
    ]);
  });

  it("PM2 bo'lmasa yoki JSON buzuq bo'lsa jarayonlar bo'sh", () => {
    expect(parseMetrics(SAMPLE.replace(/pm2=.*/, "pm2=[]")).processes).toEqual([]);
    expect(parseMetrics(SAMPLE.replace(/pm2=.*/, "pm2=xato")).processes).toEqual([]);
  });

  it("kerakli qator yo'q bo'lsa — xato", () => {
    expect(() => parseMetrics("cpus=2")).toThrow(/cpu/);
  });

  it("buyruq qat'iy: PM2 muhit o'zgaruvchilari serverda tashlab yuboriladi", () => {
    expect(METRICS_SCRIPT).toContain("pm2 jlist");
    expect(METRICS_SCRIPT).not.toContain("pm2_env)");
    expect(METRICS_SCRIPT).toContain("name:p.name");
  });
});

describe("server holati", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("hali tekshirilmagan", () => {
    expect(serverState({ metricsAt: null, probeAt: null, probeError: null }, now)).toBe("unknown");
  });
  it("yaqinda javob bergan — onlayn", () => {
    expect(serverState({ metricsAt: ago(60_000), probeAt: ago(60_000), probeError: null }, now)).toBe("online");
  });
  it("oxirgi so'rov yiqilgan yoki javob eskirgan — oflayn", () => {
    expect(serverState({ metricsAt: ago(60_000), probeAt: ago(1000), probeError: "timeout" }, now)).toBe("offline");
    expect(serverState({ metricsAt: ago(10 * 60_000), probeAt: ago(10 * 60_000), probeError: null }, now)).toBe(
      "offline",
    );
  });
});

describe("ogohlantirishlar", () => {
  const healthy = parseMetrics(SAMPLE.replace("disk=107374182400 96636764160", "disk=107374182400 10737418240"));
  const fullDisk = parseMetrics(SAMPLE);

  it("server 3 marta ketma-ket javob bermasa — bitta xabar, keyin takrorlanmaydi", () => {
    let state = {};
    const sent: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = nextAlerts(state, { ok: false });
      state = r.alerts;
      sent.push(...r.events);
    }
    expect(sent).toEqual(["offline"]);
    const back = nextAlerts(state, { ok: true, metrics: healthy });
    expect(back.events).toEqual(["online"]);
    expect(back.alerts).toEqual({ failures: 0, offline: false, disk: false, memory: false });
  });

  it("disk 85% dan oshganda bir marta xabar", () => {
    const first = nextAlerts({}, { ok: true, metrics: fullDisk });
    expect(first.events).toEqual(["disk"]);
    expect(nextAlerts(first.alerts, { ok: true, metrics: fullDisk }).events).toEqual([]);
    // Bo'shagach yana to'lsa — yana xabar
    const freed = nextAlerts(first.alerts, { ok: true, metrics: healthy });
    expect(nextAlerts(freed.alerts, { ok: true, metrics: fullDisk }).events).toEqual(["disk"]);
  });
});
