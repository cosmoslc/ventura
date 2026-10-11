import { addServer, findServer } from "@ventura/deploy";
import { context, done, fail } from "./lib";

/*
 * pnpm server:add -- --name wsl --host 127.0.0.1 --port 2222 [--kind home|online] [--user deploy]
 * Serverni ro'yxatga oladi va unga yangi SSH kalit jufti yaratadi. Yopiq kalit bazada shifrlangan holda
 * saqlanadi va hech qayerda ko'rsatilmaydi; ochiq kalit ekranga chiqadi — uni serverga qo'yish kerak.
 */

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const name = flag("name") ?? "";
const host = flag("host") ?? "";
const port = Number(flag("port") ?? 22);
const kind = flag("kind") ?? "online";
const user = flag("user") ?? "deploy";

if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(name))
  fail("--name: kichik lotin harflar, raqam va chiziqcha (3–32 belgi)");
if (!/^[a-z0-9.-]{1,253}$/i.test(host)) fail("--host: IP manzil yoki domen");
if (!Number.isInteger(port) || port < 1 || port > 65535) fail("--port noto'g'ri");
if (kind !== "home" && kind !== "online") fail("--kind: home yoki online");
if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(user)) fail("--user noto'g'ri");

const { db } = context();
if (await findServer(db, name)) fail(`"${name}" nomli server allaqachon bor`);

const server = await addServer(
  db,
  { name, kind, host, sshPort: port, sshUser: user },
  { type: "cli", name: "pnpm server:add" },
);

console.log(`\nServer qo'shildi: ${server.name} (${server.sshUser}@${server.host}:${server.sshPort})`);
console.log("\nOchiq kalit (serverga shu qo'yiladi):\n");
console.log(server.publicKey);
console.log("\nServerda (root nomidan) bir marta ishga tushiring:\n");
console.log(`  sudo bash setup.sh --key "${server.publicKey}"`);
done(`Keyin tekshiring: pnpm server:check -- --name ${server.name}`);
