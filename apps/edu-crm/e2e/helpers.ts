import { type Page, expect } from "@playwright/test";
import { uz } from "../lib/uz";
import { TELEGRAM_URL, TEST_USER } from "./env";

interface BotMessage {
  id: number;
  chat_id: string;
  text: string;
}

/** Soxta Telegram'ga test direktori chatiga kelgan xabarlar */
async function botMessages(): Promise<BotMessage[]> {
  const res = await fetch(`${TELEGRAM_URL}/messages?chat_id=${TEST_USER.chatId}`);
  return (await res.json()) as BotMessage[];
}

async function lastMessageId(): Promise<number> {
  return (await botMessages()).at(-1)?.id ?? 0;
}

/** `afterId` dan keyin kelgan kirish kodini kutadi */
async function waitForCode(afterId: number): Promise<string> {
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

/** To'liq kirish: telefon va parol, Telegram kodi, bosh sahifa */
export async function login(page: Page) {
  const before = await lastMessageId();
  await page.goto("/login");
  await page.locator("#phone").pressSequentially(TEST_USER.phone);
  await page.locator("#password").fill(TEST_USER.password);
  await page.getByRole("button", { name: uz.auth.submit }).click();
  await expect(page).toHaveURL(/\/login\/verify$/);
  await page.getByLabel(uz.auth.code, { exact: true }).fill(await waitForCode(before));
  await page.getByRole("button", { name: uz.auth.verify }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
}

/** Har ishga tushishda yangi telefon (test bazasi tozalanmaydi — takror lid bo'lmasin) */
export function uniquePhone(): string {
  return `97${String(Date.now()).slice(-7)}`;
}
