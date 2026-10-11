import { checkServer, findServer } from "@ventura/deploy";
import { context, done, fail } from "./lib";

/* pnpm server:check -- --name wsl — serverga ulanib, deploy uchun kerakli dasturlarni tekshiradi. */

const i = process.argv.indexOf("--name");
const name = i > -1 ? (process.argv[i + 1] ?? "") : "";
if (!name) fail("--name berilmagan");

const { db } = context();
const server = await findServer(db, name);
if (!server) fail(`"${name}" nomli server topilmadi`);

console.log(`\n${server.sshUser}@${server.host}:${server.sshPort} ga ulanilmoqda…`);
const result = await checkServer(db, server, { type: "cli", name: "pnpm server:check" });
if (result.error) fail(result.error);

const { info } = result;
const row = (label: string, value: string | number | undefined, unit = "") =>
  console.log(`  ${label.padEnd(12)} ${value === undefined ? "— yo'q" : `${value}${unit}`}`);
console.log("");
row("Tizim", info.os);
row("Node", info.node);
row("pnpm", info.pnpm);
row("PM2", info.pm2);
row("nginx", info.nginx);
row("PostgreSQL", info.postgres);
row("Xotira", info.memoryMb, " MB");
row("Bo'sh disk", info.diskFreeGb, " GB");
row("Protsessor", info.cpus, " yadro");
row("Kalit izi", result.hostKey);

if (!result.ok) fail(`Yetishmaydi: ${result.missing.join(", ")}. Serverda setup.sh ni ishga tushiring.`);
done("Server deploy uchun tayyor.");
