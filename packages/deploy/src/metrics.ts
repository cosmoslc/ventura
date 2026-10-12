import type { ServerAlerts, ServerMetrics, ServerProcess } from "@ventura/db/schema/panel";

/*
 * Server metrikalari (SPEC 5: /servers — CPU, RAM, disk, holat). Bitta qat'iy buyruq: foydalanuvchi matni qo'shilmaydi.
 * PM2 ro'yxati serverning o'zida qisqartiriladi — jarayonlar muhit o'zgaruvchilari (sirlar) panelga kelmaydi.
 */

const PM2_FILTER =
  'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s.slice(s.search(/\\[\\s*[{\\]]/)));' +
  "console.log(JSON.stringify(a.map(p=>({name:p.name,status:p.pm2_env&&p.pm2_env.status,cpu:p.monit&&p.monit.cpu," +
  "memory:p.monit&&p.monit.memory,restarts:p.pm2_env&&p.pm2_env.restart_time,startedAt:p.pm2_env&&p.pm2_env.pm_uptime}))))" +
  '}catch(e){console.log("[]")}})';

/** `bash -lc` bilan bajariladi (PATH'da npm global dasturlari bo'lishi uchun) */
export const METRICS_SCRIPT = [
  `s1=$(awk '/^cpu /{print $2+$3+$4+$5+$6+$7+$8+$9, $5+$6}' /proc/stat)`,
  "sleep 1",
  `s2=$(awk '/^cpu /{print $2+$3+$4+$5+$6+$7+$8+$9, $5+$6}' /proc/stat)`,
  `echo "cpu=$s1 $s2"`,
  `echo "cpus=$(nproc)"`,
  `echo "load=$(cut -d' ' -f1-3 /proc/loadavg)"`,
  `echo "mem=$(awk '/^MemTotal:/{t=$2} /^MemAvailable:/{a=$2} END{print t, a}' /proc/meminfo)"`,
  `echo "disk=$(df -B1 --output=size,used / | tail -1)"`,
  `echo "uptime=$(cut -d' ' -f1 /proc/uptime)"`,
  `if command -v pm2 >/dev/null 2>&1; then echo "pm2=$(pm2 jlist 2>/dev/null | node -e '${PM2_FILTER}')"; else echo "pm2=[]"; fi`,
].join("\n");

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** METRICS_SCRIPT chiqishini o'qiydi. Kerakli qator bo'lmasa — xato (server mos emas). */
export function parseMetrics(stdout: string): ServerMetrics {
  const lines = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) lines.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
  }
  for (const key of ["cpu", "mem", "disk"]) {
    if (!lines.get(key)) throw new Error(`Metrika o'qilmadi: ${key}`);
  }

  const [t1, i1, t2, i2] = lines.get("cpu")!.split(/\s+/).map(num);
  const dTotal = (t2 ?? 0) - (t1 ?? 0);
  const dIdle = (i2 ?? 0) - (i1 ?? 0);
  const cpuPercent = dTotal > 0 ? round1(Math.min(100, Math.max(0, (1 - dIdle / dTotal) * 100))) : 0;

  const [memTotalKb, memAvailKb] = lines.get("mem")!.split(/\s+/).map(num);
  const [diskSize, diskUsed] = lines.get("disk")!.split(/\s+/).map(num);
  const load = (lines.get("load") ?? "").split(/\s+/).map(num);
  const GB = 1024 ** 3;

  return {
    cpuPercent,
    cpus: Math.max(1, num(lines.get("cpus"))),
    load: [round1(load[0] ?? 0), round1(load[1] ?? 0), round1(load[2] ?? 0)],
    memTotalMb: Math.round((memTotalKb ?? 0) / 1024),
    memUsedMb: Math.round(((memTotalKb ?? 0) - (memAvailKb ?? 0)) / 1024),
    diskTotalGb: round1((diskSize ?? 0) / GB),
    diskUsedGb: round1((diskUsed ?? 0) / GB),
    uptimeSec: Math.round(num(lines.get("uptime"))),
    processes: parseProcesses(lines.get("pm2") ?? "[]"),
  };
}

function parseProcesses(json: string): ServerProcess[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && typeof p.name === "string")
    .map((p) => ({
      name: String(p.name),
      status: typeof p.status === "string" ? p.status : "unknown",
      cpu: round1(num(String(p.cpu ?? 0))),
      memoryMb: Math.round(num(String(p.memory ?? 0)) / 1024 ** 2),
      restarts: num(String(p.restarts ?? 0)),
      startedAt: typeof p.startedAt === "number" ? p.startedAt : null,
    }));
}

/* ---------- Holat va ogohlantirishlar ---------- */

/** Shuncha vaqt ichida javob bergan server — onlayn */
export const ONLINE_WINDOW_MS = 3 * 60_000;
/** Ketma-ket shuncha so'rov yiqilsa — "server o'chdi" ogohlantirishi */
export const OFFLINE_AFTER_FAILURES = 3;
export const DISK_ALERT = 0.85;
export const MEMORY_ALERT = 0.9;

export type ServerState = "online" | "offline" | "unknown";

/** Ro'yxatda ko'rsatiladigan holat: oxirgi so'rov muvaffaqiyatli va yaqinda bo'lgan bo'lsa — onlayn */
export function serverState(
  server: { metricsAt: Date | null; probeAt: Date | null; probeError: string | null },
  now = new Date(),
): ServerState {
  if (!server.probeAt && !server.metricsAt) return "unknown";
  if (server.probeError) return "offline";
  if (!server.metricsAt || now.getTime() - server.metricsAt.getTime() > ONLINE_WINDOW_MS) return "offline";
  return "online";
}

export type AlertEvent = "offline" | "online" | "disk" | "memory";

/**
 * Yangi so'rov natijasidan keyingi ogohlantirish holati va yuborilishi kerak bo'lgan xabarlar.
 * Xabar faqat holat o'zgarganda (bir xil muammo har daqiqa takrorlanmaydi).
 */
export function nextAlerts(
  prev: ServerAlerts,
  result: { ok: true; metrics: ServerMetrics } | { ok: false },
): { alerts: ServerAlerts; events: AlertEvent[] } {
  const events: AlertEvent[] = [];
  if (!result.ok) {
    const failures = (prev.failures ?? 0) + 1;
    const offline = prev.offline || failures >= OFFLINE_AFTER_FAILURES;
    if (offline && !prev.offline) events.push("offline");
    return { alerts: { ...prev, failures, offline }, events };
  }
  const m = result.metrics;
  const disk = m.diskTotalGb > 0 && m.diskUsedGb / m.diskTotalGb >= DISK_ALERT;
  const memory = m.memTotalMb > 0 && m.memUsedMb / m.memTotalMb >= MEMORY_ALERT;
  if (prev.offline) events.push("online");
  if (disk && !prev.disk) events.push("disk");
  if (memory && !prev.memory) events.push("memory");
  return { alerts: { failures: 0, offline: false, disk, memory }, events };
}
