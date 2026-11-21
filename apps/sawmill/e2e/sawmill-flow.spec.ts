import { expect, test } from "@playwright/test";

test.describe("Sawmill to'liq biznes oqimi va S6 yakuniy sinov", () => {
  test("kirish -> bosh sahifa -> barcha bo'limlar -> audit -> hisobotlar -> rus tili", async ({ page }) => {
    // 1. Tizimga kirish sahifasi
    await page.goto("/login");
    await expect(page).toHaveTitle(/Pilorama/);

    // Boshlang'ich tilni UZ ga qo'yish
    const initialUzBtn = page.locator("button", { hasText: "UZ" }).first();
    if (await initialUzBtn.isVisible()) {
      await initialUzBtn.click();
    }

    // Telefon va parolni kiritish
    const phoneInput = page.locator("input#phone");
    await phoneInput.fill("901234567");

    const passwordInput = page.locator("input#password");
    await passwordInput.fill("Password123!");

    // Kirish tugmasini bosish
    const submitBtn = page.locator("button[type='submit']");
    await submitBtn.click();

    // 2. Bosh sahifaga yo'naltirilishini kutish
    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("select#dashboard-terak")).toBeVisible();

    // 3. Teraklar ro'yxatiga o'tish
    await page.goto("/teraks");
    await page.waitForURL("/teraks");
    await expect(page.locator("h1")).toContainText(/Terak|Партии/i);

    // 4. Materiallar katalogiga o'tish
    await page.goto("/materials");
    await page.waitForURL("/materials");
    await expect(page.locator("h1")).toContainText(/Material|Материал/i);

    // 5. Kunlik ishlar sahifasiga o'tish
    await page.goto("/work");
    await page.waitForURL("/work");
    await expect(page.locator("h1")).toContainText(/ishlar|работ/i);

    // 6. Yuk chiqarish (sotuv) sahifasiga o'tish
    await page.goto("/dispatch");
    await page.waitForURL("/dispatch");
    await expect(page.locator("h1")).toContainText(/Yuk chiqarish|Отгрузка/i);

    // 7. Zakazlar sahifasiga o'tish
    await page.goto("/orders");
    await page.waitForURL("/orders");
    await expect(page.locator("h1")).toContainText(/Zakaz|Заказ/i);

    // 8. Yuk mashinalari sahifasiga o'tish
    await page.goto("/trucks");
    await page.waitForURL("/trucks");
    await expect(page.locator("h1")).toContainText(/mashina|Грузовик/i);

    // 9. Ishchilar sahifasiga o'tish
    await page.goto("/workers");
    await page.waitForURL("/workers");
    await expect(page.locator("h1")).toContainText(/Ishchilar|Рабочие/i);

    // 10. Umumiy xarajatlar sahifasiga o'tish (K14)
    await page.goto("/expenses");
    await page.waitForURL("/expenses");
    await expect(page.locator("h1")).toContainText(/xarajat|расход/i);

    // 11. Faoliyat jurnaliga o'tish va xesh zanjirini tekshirish
    await page.goto("/audit");
    await page.waitForURL("/audit");
    await expect(page.locator("h1")).toContainText(/Faoliyat jurnali|Журнал действий/i);

    const verifyBtn = page.getByRole("button", { name: /Zanjir butunligini|Проверить целостность/i });
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      await expect(page.locator("text=Zanjir butun").or(page.locator("text=Цепочка цела")).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    // 12. Hisobotlar sahifasiga o'tish
    await page.goto("/reports");
    await page.waitForURL("/reports");
    await expect(page.locator("h1")).toContainText(/Hisobotlar|Отчеты/i);
    await expect(page.getByRole("link", { name: /Excel/i })).toBeVisible();

    // 13. Xodimlar va rollar sahifasiga o'tish
    await page.goto("/users");
    await page.waitForURL("/users");
    await expect(page.locator("h1")).toContainText(/Foydalanuvchilar|Пользователи/i);

    // 14. Sozlamalar sahifasiga o'tish
    await page.goto("/settings");
    await page.waitForURL("/settings");
    await expect(page.locator("h1")).toContainText(/Sozlamalar|Настройки/i);

    // 15. Tilni Rus tiliga almashtirish va interfeys tarjimasini tekshirish
    const ruBtn = page.locator("button", { hasText: "RU" }).first();
    if (await ruBtn.isVisible()) {
      await ruBtn.click();
      await expect(
        page
          .locator("text=Настройки")
          .or(page.locator("text=Отчеты"))
          .or(page.locator("text=Партии"))
          .or(page.locator("text=Склад"))
          .first(),
      ).toBeVisible({ timeout: 10_000 });
    }

    // Tilni qaytarib O'zbek tiliga o'tkazish
    const uzBtn = page.locator("button", { hasText: "UZ" }).first();
    if (await uzBtn.isVisible()) {
      await uzBtn.click();
      await expect(
        page.locator("text=Sozlamalar").or(page.locator("text=Hisobotlar")).or(page.locator("text=Teraklar")).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
