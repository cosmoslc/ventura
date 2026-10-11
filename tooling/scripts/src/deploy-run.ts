import { asc, eq, gt, and } from "drizzle-orm";
import { deploymentLogs, deployments, projects } from "@ventura/db/schema/panel";
import { requestDeployment, startQueue } from "@ventura/deploy";
import { context, done, fail } from "./lib";

/*
 * pnpm deploy:run -- --project <slug>
 * Loyihani navbatga qo'yadi va tugaguncha logini terminalga chiqaradi (paneldagi "Deploy qilish" tugmasi
 * bilan bir xil yo'l). Ishchi jarayon (`pnpm worker`) ishlab turgan bo'lishi kerak.
 */

const i = process.argv.indexOf("--project");
const slug = i > -1 ? (process.argv[i + 1] ?? "") : "";
if (!slug) fail("--project berilmagan");

const { db } = context();
const [project] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
if (!project) fail(`"${slug}" loyihasi topilmadi`);

const queue = await startQueue();
const result = await requestDeployment(db, queue, {
  projectId: project.id,
  actor: { type: "cli", name: "pnpm deploy:run" },
});
if (!result.ok) fail(`Navbatga qo'yib bo'lmadi: ${result.reason}`);
console.log(`\nDeploy #${result.number} navbatga qo'yildi (${project.name})\n`);

const MARK = { cmd: "$ ", out: "  ", err: "! ", info: "· " } as const;
let cursor = 0;
let lastStep = "";
const deadline = Date.now() + 30 * 60_000;
for (;;) {
  const lines = await db
    .select()
    .from(deploymentLogs)
    .where(and(eq(deploymentLogs.deploymentId, result.id), gt(deploymentLogs.id, cursor)))
    .orderBy(asc(deploymentLogs.id));
  for (const line of lines) {
    if (line.step !== lastStep) console.log(`\n[${(lastStep = line.step)}]`);
    console.log(MARK[line.stream] + line.line);
    cursor = line.id;
  }
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, result.id)).limit(1);
  if (dep && (dep.status === "ready" || dep.status === "failed") && !lines.length) {
    await queue.stop({ graceful: false }).catch(() => {});
    if (dep.status === "failed") fail(`Deploy yiqildi: ${dep.error ?? "noma'lum sabab"}`);
    done(`Deploy tayyor (commit ${dep.commitSha?.slice(0, 7) ?? "?"})`);
  }
  if (Date.now() > deadline) fail("30 daqiqada tugamadi");
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
