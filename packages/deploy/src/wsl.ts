import { execFile, spawn } from "node:child_process";
import { createConnection } from "node:net";

/*
 * Uydagi WSL serverni yoqish va o'chirish (ADR 0025). Ishchi jarayon shu Windows kompyuterida ishlaganda `wsl.exe`
 * orqali bajariladi. Buyruq qat'iy: distributiv va foydalanuvchi nomi qolipdan o'tadi, argumentlar shell'siz uzatiladi —
 * foydalanuvchi matni buyruqqa qo'shilmaydi.
 *
 * Yoqish: distributivda root nomidan SSH, nginx, PostgreSQL va PM2 xizmati (`pm2-<foydalanuvchi>`) ishga tushiriladi,
 * keyin jarayon `sleep infinity` bo'lib qoladi. Windows WSL'ni oxirgi jarayon tugagach o'zi to'xtatadi — shu jarayon
 * uni yoniq ushlab turadi (ishchi qayta ishga tushsa ham yashaydi). O'chirish: `wsl.exe --terminate <distributiv>`.
 */

export const WSL_DISTRO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const UNIX_USER = /^[a-z_][a-z0-9_-]{0,31}$/;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export interface WslTarget {
  kind: "home" | "online";
  host: string;
  sshPort: number;
  sshUser: string;
  wslDistro: string | null;
}

/** Shu kompyuterdan boshqarib bo'lmasa — sababi; bo'lsa null */
export function wslControlError(t: WslTarget, platform: NodeJS.Platform = process.platform): string | null {
  if (t.kind !== "home") return "Faqat uydagi (WSL) serverni yoqish va o'chirish mumkin";
  if (!t.wslDistro || !WSL_DISTRO.test(t.wslDistro)) return "Serverda WSL distributivi ko'rsatilmagan";
  if (!LOCAL_HOSTS.has(t.host)) return "Server manzili shu kompyuter emas (127.0.0.1 bo'lishi kerak)";
  if (!UNIX_USER.test(t.sshUser)) return "Server foydalanuvchisi nomi noto'g'ri";
  if (platform !== "win32") return "Ishchi jarayon Windows'da ishlamayapti — WSL'ni boshqarib bo'lmaydi";
  return null;
}

/** Yoqishda distributiv ichida bajariladigan skript (root nomidan) */
export function bootScript(user: string): string {
  if (!UNIX_USER.test(user)) throw new Error("bad user");
  return [
    "systemctl start ssh nginx postgresql >/dev/null 2>&1",
    `systemctl start pm2-${user} >/dev/null 2>&1`,
    "exec sleep infinity",
  ].join("; ");
}

export function wslStart(t: WslTarget): void {
  const child = spawn("wsl.exe", ["-d", t.wslDistro!, "-u", "root", "--", "sh", "-c", bootScript(t.sshUser)], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

export function wslStop(t: WslTarget): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("wsl.exe", ["--terminate", t.wslDistro!], { timeout: 30_000, windowsHide: true }, (err) =>
      err ? reject(new Error(`WSL to'xtatilmadi: ${err.message}`)) : resolve(),
    );
  });
}

/** Port javob berguncha kutadi (SSH yonganini bilish uchun) */
export async function waitForPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = createConnection({ host, port });
      const done = (v: boolean) => {
        socket.destroy();
        resolve(v);
      };
      socket.setTimeout(2_000, () => done(false));
      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 1_500));
  }
  return false;
}
