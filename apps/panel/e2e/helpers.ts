import { type Page, expect } from "@playwright/test";
import { uz } from "../lib/uz";
import { TELEGRAM_URL, TEST_USER } from "./env";

interface BotMessage {
  id: number;
  chat_id: string;
  text: string;
}

/** Soxta Telegram'ga test foydalanuvchisi chatiga kelgan xabarlar. */
export async function botMessages(): Promise<BotMessage[]> {
  const res = await fetch(`${TELEGRAM_URL}/messages?chat_id=${TEST_USER.chatId}`);
  return (await res.json()) as BotMessage[];
}

/** `afterId` dan keyin kelgan kirish kodini kutadi. */
export async function waitForCode(afterId: number): Promise<string> {
  let code = "";
  await expect
    .poll(
      async () => {
        const fresh = (await botMessages()).filter((m) => m.id > afterId);
        code =
          fresh
            .map((m) => /<code>(\d{6})<\/code>/.exec(m.text)?.[1])
            .filter(Boolean)
            .at(-1) ?? "";
        return code;
      },
      { message: "Telegram'ga kirish kodi kelmadi", timeout: 15_000 },
    )
    .toMatch(/^\d{6}$/);
  return code;
}

export async function lastMessageId(): Promise<number> {
  return (await botMessages()).at(-1)?.id ?? 0;
}

/** Panel ochilgan: topbar'da foydalanuvchi profili ko'rinadi. */
export async function expectSignedIn(page: Page) {
  await expect(page.getByRole("banner").getByRole("button", { name: new RegExp(TEST_USER.name) })).toBeVisible();
  await expect(page).toHaveURL(/:\d+\/$/);
}

/** 1-qadam: telefon + parol. Tasdiqlash sahifasida to'xtaydi. */
export async function submitPassword(page: Page, password: string = TEST_USER.password) {
  await page.goto("/login");
  await page.getByLabel(uz.auth.phone, { exact: true }).fill(TEST_USER.phone);
  await page.getByLabel(uz.auth.password, { exact: true }).fill(password);
  await page.getByRole("button", { name: uz.auth.submit }).click();
}

/** To'liq kirish: parol, Telegram kodi, bosh sahifa. */
export async function login(page: Page) {
  const before = await lastMessageId();
  await submitPassword(page);
  await expect(page).toHaveURL(/\/login\/verify$/);
  await page.getByLabel(uz.auth.code, { exact: true }).fill(await waitForCode(before));
  await page.getByRole("button", { name: uz.auth.verify }).click();
  await expectSignedIn(page);
}

/** Formaning "Ega" qadami: ism va telefon majburiy (birinchi deploy'da direktor bo'ladi). */
export async function fillOwner(page: Page, id: string) {
  await page.locator("#w-owner-name").fill(`E2E direktor ${id}`);
  await page.locator("#w-owner-phone").fill("901234567");
}

/** Yangi loyiha formasi orqali loyiha yaratadi va uning sahifasida to'xtaydi. */
export async function createProject(page: Page): Promise<{ name: string; slug: string }> {
  const id = Date.now().toString(36);
  const name = `E2E loyiha ${id}`;
  const slug = `e2e-${id}`;
  const steps = uz.wizard.steps;
  const current = page.locator('[aria-current="step"]');

  await page.goto("/projects/new");
  await expect(current).toContainText(steps[0]!);
  await page.getByRole("button", { name: uz.common.next }).click();
  await expect(current).toContainText(steps[1]!);
  await page.locator("#w-name").fill(name);
  await page.locator("#w-slug").fill(slug);
  // Mijoz yo'q bo'lsa, yangi mijoz maydonlari ochiq turadi
  const newClient = page.locator("#w-cname");
  if (await newClient.isVisible()) await newClient.fill(`E2E mijoz ${id}`);
  for (let i = 2; i < steps.length; i++) {
    if (i === 4) await fillOwner(page, id);
    await page.getByRole("button", { name: uz.common.next }).click();
    await expect(current).toContainText(steps[i]!);
  }
  await page.getByRole("button", { name: uz.wizard.createAndSave }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return { name, slug };
}
