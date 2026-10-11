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
