import { expect, test } from "@playwright/test";
import { STEPS } from "@ventura/deploy/steps";
import { uz } from "../lib/uz";
import { createProject, login } from "./helpers";

/*
 * Deploy navbati va jonli log (SPEC 13, 2-bosqich). Sinov drayveri ishlatiladi: hech qaysi serverga
 * ulanmaydi, lekin navbat → ishchi jarayon → qadamlar → log → audit zanjiri haqiqiy.
 */

test("deploy navbatga qo'yiladi, qadamlar jonli ko'rinadi, loyiha faollashadi va audit yoziladi", async ({ page }) => {
  await login(page);
  const { name } = await createProject(page);
  const badge = (text: string) => page.getByText(text, { exact: true });

  // Yangi loyiha — qoralama, hali deploy yo'q
  await page.getByRole("tab", { name: uz.projects.tabs.deploys }).click();
  await expect(page.getByText(uz.deploys.empty)).toBeVisible();
  await expect(page.getByText(uz.deploys.simNotice)).toBeVisible();
  await expect(page.getByText(uz.deploys.workerDown)).toHaveCount(0);

  const deploy = page.getByRole("button", { name: uz.deploys.start });
  await deploy.click();

  // Tugallanmaguncha ikkinchi deploy boshlab bo'lmaydi
  await expect(deploy).toBeDisabled();
  await expect(page.getByText("#1", { exact: true })).toBeVisible();

  // Hamma qadam o'tadi va deploy "Tayyor" bo'ladi
  const steps = page.getByRole("list", { name: uz.deploys.steps }).getByRole("listitem");
  await expect(steps).toHaveCount(STEPS.length);
  await expect(badge(uz.deploys.statusLabels.ready)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('li[data-status="ok"]')).toHaveCount(STEPS.length);

  // Log: bajarilgan buyruqlar ko'rinadi
  const log = page.getByRole("log");
  await expect(log).toContainText("pnpm install --frozen-lockfile");
  await expect(log).toContainText("pm2 reload");

  // Qadam bosilsa log shu qadamga filtrlanadi
  await page.getByRole("button", { name: new RegExp(uz.deploys.stepLabels.health) }).click();
  await expect(log).toContainText("200 OK");
  await expect(log).not.toContainText("pnpm install");

  // Birinchi muvaffaqiyatli deploy loyihani faollashtiradi; tugma yana ishlaydi
  await expect(badge(uz.projects.statusLabels.active).first()).toBeVisible();
  await expect(deploy).toBeEnabled();

  await page.goto("/audit");
  await expect(page.getByText(uz.audit.actions["deploy.queued"]!).first()).toBeVisible();
  await expect(page.getByText(uz.audit.actions["deploy.ready"]!).first()).toBeVisible();
  await expect(page.getByText(/Xesh zanjiri butun/)).toBeVisible();

  // Loyihalar ro'yxatida ham faol
  await page.goto("/projects");
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText(uz.projects.statusLabels.active);
});
