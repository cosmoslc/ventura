import { expect, test } from "@playwright/test";
import { uz } from "../lib/uz";
import { TEST_USER } from "./env";
import { botMessages, expectSignedIn, lastMessageId, login, submitPassword, waitForCode } from "./helpers";

/* SPEC 13, 1-bosqich qabuli: 2FA'siz kirib bo'lmaydi; har o'zgarish audit jurnalida ko'rinadi. */

test("kirilmagan holda panel sahifalari yopiq", async ({ page }) => {
  for (const path of ["/", "/projects", "/audit", "/settings/admins"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("noto'g'ri parol rad etiladi", async ({ page }) => {
  await submitPassword(page, "notogri-parol");
  await expect(page.getByText(uz.auth.wrongCredentials).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("parol to'g'ri, lekin kodsiz panelga kirib bo'lmaydi", async ({ page }) => {
  await submitPassword(page);
  await expect(page).toHaveURL(/\/login\/verify$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login$/);
});

test("noto'g'ri kod rad etiladi, to'g'ri kod bilan panel ochiladi", async ({ page }) => {
  const before = await lastMessageId();
  await submitPassword(page);
  await expect(page).toHaveURL(/\/login\/verify$/);
  const code = await waitForCode(before);

  const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  await page.getByLabel(uz.auth.code, { exact: true }).fill(wrong);
  await page.getByRole("button", { name: uz.auth.verify }).click();
  await expect(page.getByText(uz.auth.codeInvalid).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login\/verify$/);

  await page.getByLabel(uz.auth.code, { exact: true }).fill(code);
  await page.getByRole("button", { name: uz.auth.verify }).click();
  await expectSignedIn(page);
});

test("kirish audit jurnaliga yoziladi va Telegram'ga xabar boradi, chiqqach panel yopiladi", async ({ page }) => {
  const before = await lastMessageId();
  await login(page);

  await page.goto("/audit");
  await expect(page.getByText(uz.audit.actions["auth.login"]!).first()).toBeVisible();
  await expect(page.getByText(/Xesh zanjiri butun/)).toBeVisible();

  // Kod xabaridan tashqari kirish haqida ogohlantirish ham kelgan (yangi brauzer — yangi qurilma)
  const alerts = (await botMessages()).filter((m) => m.id > before && m.text.includes("Yangi qurilmadan kirildi"));
  expect(alerts).toHaveLength(1);

  await page
    .getByRole("banner")
    .getByRole("button", { name: new RegExp(TEST_USER.name) })
    .click();
  await page.getByRole("menuitem", { name: uz.nav.logout }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
