import { type Page, expect, test } from "@playwright/test";
import { uz } from "../lib/uz";
import { login } from "./helpers";

/* "Yangi loyiha" ustozi: 8 qadam, loyiha qoralama sifatida saqlanadi (deploysiz). */

const steps = uz.wizard.steps;

async function expectStep(page: Page, index: number) {
  await expect(page.locator('[aria-current="step"]')).toContainText(steps[index]!);
}

async function next(page: Page, to: number) {
  await page.getByRole("button", { name: uz.common.next }).click();
  await expectStep(page, to);
}

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.goto("/projects/new");
  await expectStep(page, 0);
});

test("noto'g'ri subdomen bilan keyingi qadamga o'tilmaydi", async ({ page }) => {
  await next(page, 1);
  await page.locator("#w-name").fill("E2E sinov");
  await page.locator("#w-slug").fill("a");
  await page.getByRole("button", { name: uz.common.next }).click();
  await expect(page.locator('#w-slug[aria-invalid="true"]')).toBeVisible();
  await expectStep(page, 1);

  // Band qilingan nom ham o'tmaydi
  await page.locator("#w-slug").fill("admin");
  await page.getByRole("button", { name: uz.common.next }).click();
  await expect(page.getByText(uz.projects.slugTaken).first()).toBeVisible();
  await expectStep(page, 1);
});

test("ustoz loyihani yaratadi, u ro'yxatda va audit jurnalida ko'rinadi", async ({ page }) => {
  const id = Date.now().toString(36);
  const name = `E2E loyiha ${id}`;
  const slug = `e2e-${id}`;

  await next(page, 1);
  await page.locator("#w-name").fill(name);
  await page.locator("#w-slug").fill(slug);
  // Mijoz yo'q bo'lsa, yangi mijoz maydonlari ochiq turadi
  const newClient = page.locator("#w-cname");
  if (await newClient.isVisible()) await newClient.fill(`E2E mijoz ${id}`);

  for (let i = 2; i < steps.length; i++) await next(page, i);

  // Ko'rib chiqish: kiritilganlar ko'rinadi
  await expect(page.getByText(name).first()).toBeVisible();
  await expect(page.getByText(`${slug}.`).first()).toBeVisible();

  await page.getByRole("button", { name: uz.wizard.createAndSave }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  await page.goto("/projects");
  await expect(page.getByText(name).first()).toBeVisible();

  await page.goto("/audit");
  await expect(page.getByText(uz.audit.actions["project.create"]!).first()).toBeVisible();
  await expect(page.getByText(/Xesh zanjiri butun/)).toBeVisible();

  // Shu subdomen endi band
  await page.goto("/projects/new");
  await next(page, 1);
  await page.locator("#w-name").fill(name);
  await page.locator("#w-slug").fill(slug);
  await page.getByRole("button", { name: uz.common.next }).click();
  await expect(page.getByText(uz.projects.slugTaken).first()).toBeVisible();
});
