import { expect, test } from "@playwright/test";
import { uz } from "../lib/uz";
import { TEST_GROUP } from "./env";
import { login, uniquePhone } from "./helpers";

/*
 * EDU-CRM-PLAN E4 qabul sharti (ADR 0029): lid yaratilishidan o'quvchiga aylanishigacha.
 * Kirish (parol + Telegram kodi) → yangi lid → doskadagi kartadan "O'quvchiga aylantirish" → guruh tanlanadi →
 * o'quvchi profili ochiladi va guruhda turadi → lid "O'quvchi bo'ldi" bosqichida, o'quvchiga havola bilan.
 */

const t = uz.leads;

test("lid yaratilishidan o'quvchiga aylanishigacha", async ({ page }) => {
  const name = `E2E Lid ${Date.now().toString(36)}`;
  await login(page);

  // 1. Yangi lid
  await page.goto("/leads");
  await page.getByRole("button", { name: t.add }).click();
  const form = page.getByRole("dialog");
  await form.locator("#lead-name").fill(name);
  await form.locator("#lead-phone").pressSequentially(uniquePhone());
  await form.getByRole("button", { name: t.submitNew }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText(name).first()).toBeVisible();

  // 2. Doskadagi kartadan o'quvchiga aylantirish
  await page.getByRole("button", { name: `${name} — ${uz.common.actions}` }).click();
  await page.getByRole("menuitem", { name: t.convert }).click();
  const dialog = page.getByRole("dialog", { name: t.convertTitle(name) });
  await dialog.getByRole("combobox").click();
  await dialog.getByRole("option", { name: new RegExp(TEST_GROUP) }).click();
  await dialog.getByRole("button", { name: t.convert }).click();

  // 3. O'quvchi profili: shu guruhda
  await expect(page).toHaveURL(/\/students\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(TEST_GROUP).first()).toBeVisible();
  const studentUrl = page.url();

  // 4. Lid "O'quvchi bo'ldi" bosqichida va o'quvchiga bog'langan
  await page.goto("/leads");
  await page.getByRole("tab", { name: new RegExp(t.tabWon) }).click();
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}$/);
  await expect(page.getByText(t.becameStudent(name))).toBeVisible();
  await expect(page.getByRole("link", { name: t.openStudent })).toHaveAttribute("href", new URL(studentUrl).pathname);
});
