import { expect, test } from "@playwright/test";
import { uz } from "../lib/uz";
import { login } from "./helpers";

/*
 * Serverlar sahifasi: server qo'shish (panel kalit yaratadi va o'rnatish ko'rsatmasini beradi) va o'chirish.
 * Haqiqiy SSH ulanish yo'q — server "tekshirilmagan" holatda qoladi.
 */

test("server qo'shiladi, o'rnatish ko'rsatmasi chiqadi va nomini yozib o'chiriladi", async ({ page }) => {
  const name = `e2e-${Date.now().toString(36)}`;
  await login(page);
  await page.goto("/servers");
  await expect(page.getByRole("heading", { level: 1, name: uz.servers.title })).toBeVisible();

  await page.getByRole("button", { name: uz.servers.add }).first().click();
  await page.locator("#server-name").fill(name);
  await page.locator("#server-host").fill("127.0.0.1");
  await page.locator("#server-port").fill("1");
  await page.getByRole("button", { name: uz.servers.create }).click();

  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText(uz.servers.setupTitle)).toBeVisible();
  await expect(page.getByText(new RegExp(`^ssh-ed25519 \\S+ ventura-panel:${name}$`))).toBeVisible();
  await expect(page.getByRole("button", { name: uz.servers.copyCommand })).toBeVisible();

  // Tahrirlash: root taqiqlangan; sig'im va izoh saqlanadi
  await page.getByRole("button", { name: uz.servers.edit }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#se-user").fill("root");
  await dialog.getByRole("button", { name: uz.common.save }).click();
  await expect(dialog.getByText(uz.servers.rootUser)).toBeVisible();
  await dialog.locator("#se-user").fill("deploy");
  await dialog.locator("#se-capacity").fill("5");
  await dialog.locator("#se-note").fill("E2E izoh: sinov serveri");
  await dialog.getByRole("button", { name: uz.common.save }).click();
  await expect(page.getByRole("main").getByText("E2E izoh: sinov serveri")).toBeVisible();

  // Ro'yxatda ko'rinadi (xabarnoma va sahifa e'lonida ham nom bor — faqat asosiy qism)
  await page.getByRole("link", { name: uz.servers.back }).click();
  const main = page.getByRole("main");
  const card = main.locator("div.rounded-card", { has: page.getByText(name, { exact: true }) });
  await expect(card).toBeVisible();
  await expect(card.getByText(uz.servers.capacityOf(0, 5))).toBeVisible();

  // O'chirish: nomini yozmaguncha tasdiqlash tugmasi o'chiq
  await card.getByRole("link", { name: uz.servers.details }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByRole("button", { name: uz.servers.delete }).click();
  const confirm = page.getByRole("button", { name: uz.common.delete, exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByRole("dialog").getByRole("textbox").fill(name);
  await confirm.click();
  await expect(page).toHaveURL(/\/servers$/);
  await expect(main.getByText(name, { exact: true })).toHaveCount(0);
});
