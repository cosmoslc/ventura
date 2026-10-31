import { expect, test } from "@playwright/test";

test.describe("Admin panel to'liq boshqaruv oqimi", () => {
  test("1. Admin Dashboard (/admin) va statistik kartalar", async ({ page }) => {
    await page.goto("/admin");

    // Sarlavha va sidebar
    await expect(page.locator("h1")).toContainText(/Boshqaruv paneli/i);
    await expect(page.locator("aside")).toBeVisible();

    // 4 ta StatCard
    await expect(page.getByText(/Jami tushum/i).first()).toBeVisible();
    await expect(page.getByText(/Sof daromad/i).first()).toBeVisible();
    await expect(page.getByText(/Ombor tannarx qiymati/i).first()).toBeVisible();
  });

  test("2. Admin Mahsulotlar (/admin/products) va mahsulot formasi", async ({ page }) => {
    await page.goto("/admin/products");

    await expect(page.locator("h1")).toContainText(/Mahsulotlar katalogi/i);

    // Jadval mavjudligi
    await expect(page.locator("table")).toBeVisible();
    await expect(page.getByText(/Intel Core i7/i).first()).toBeVisible();

    // Yangi mahsulot modalini ochish
    const addProductBtn = page.getByRole("button", { name: /Yangi mahsulot/i });
    await addProductBtn.click();

    await expect(page.getByText(/Yangi mahsulot qoʻshish/i)).toBeVisible();
    await expect(page.getByText(/Narxlar va Kutilayotgan Foyda/i)).toBeVisible();

    // Yopish
    await page.getByRole("button", { name: /Bekor qilish/i }).click();
  });

  test("3. Admin Kirimlar (/admin/purchases) va hisob-kitob", async ({ page }) => {
    await page.goto("/admin/purchases", { waitUntil: "networkidle" });

    await expect(page.locator("h1")).toContainText(/Omborga kirimlar/i);

    // Yangi kirim modalini ochish
    const addPurchaseBtn = page.getByRole("button", { name: /Yangi kirim/i });
    await addPurchaseBtn.click();

    await expect(page.getByRole("heading", { name: /Omborga yangi kirim qilish/i })).toBeVisible();
    await expect(page.getByText(/Dona hisobi/i)).toBeVisible();
    await expect(page.getByText(/Optom/i).first()).toBeVisible();

    await page.getByRole("button", { name: /Bekor qilish/i }).click();
  });

  test("4. Admin Sotuvlar (/admin/sales) va oflayn sotuv qayd qilish", async ({ page }) => {
    await page.goto("/admin/sales");

    await expect(page.locator("h1")).toContainText(/Sotuvlar/i);

    // Oflayn sotuv modali
    const offlineSaleBtn = page.getByRole("button", { name: /Oflayn sotuv kiritish/i });
    await expect(offlineSaleBtn).toBeVisible();
    await offlineSaleBtn.click();

    const saleModalHeading = page.getByRole("heading", { name: /Yangi oflayn sotuv kiritish/i });
    if (!(await saleModalHeading.isVisible({ timeout: 1500 }).catch(() => false))) {
      await offlineSaleBtn.click();
    }
    await expect(saleModalHeading).toBeVisible();
    await expect(page.getByText(/Ushbu sotuvdan sof daromad/i)).toBeVisible();

    await page.getByRole("button", { name: /Bekor qilish/i }).click();
  });

  test("5. Admin Tayyor PClar (/admin/pcs) va yig'ish kalkulyatori", async ({ page }) => {
    await page.goto("/admin/pcs");

    await expect(page.locator("h1")).toContainText(/Tayyor kompyuterlar/i);

    // PC yig'ish modalini ochish
    const assembleBtn = page.getByRole("button", { name: /Yangi PC yigʻish/i });
    await assembleBtn.click();

    await expect(page.getByRole("heading", { name: /Yangi kompyuter yigʻish/i })).toBeVisible();
    await expect(page.getByText(/PC Jami Tannarxi/i)).toBeVisible();
    await expect(page.getByText(/Sotuv narxi va Marja hisobi/i)).toBeVisible();

    await page.getByRole("button", { name: /Bekor qilish/i }).click();
  });

  test("6. Admin PC Zakazlar (/admin/pc-orders) va ko'rib chiqish", async ({ page }) => {
    await page.goto("/admin/pc-orders");

    await expect(page.locator("h1")).toContainText(/PC Zakazlar/i);
    await expect(page.locator("table")).toBeVisible();

    // Zakazni ko'rib chiqish modali
    const reviewBtn = page.getByRole("button", { name: /Koʻrib chiqish/i }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    const orderModalHeading = page.getByRole("heading", { name: /Zakaz: PCO/i });
    if (!(await orderModalHeading.isVisible({ timeout: 1500 }).catch(() => false))) {
      await reviewBtn.click();
    }
    await expect(orderModalHeading).toBeVisible();
    await expect(page.getByText(/Taklif qilinadigan narx/i)).toBeVisible();

    await page.getByRole("button", { name: /Bekor qilish/i }).click();
  });

  test("7. Admin Foydalanuvchilar (/admin/users) va Bloklash/Tiklash", async ({ page }) => {
    await page.goto("/admin/users");

    await expect(page.locator("h1")).toContainText(/Foydalanuvchilar boshqaruvi/i);
    await expect(page.locator("table")).toBeVisible();

    // Bloklash / Tiklash amali
    const toggleBtn = page.locator("button", { hasText: /Bloklash|Tiklash/i }).first();
    await expect(toggleBtn).toBeVisible();
  });

  test("8. Admin Sozlamalar (/admin/settings) va moliya parametrlari", async ({ page }) => {
    await page.goto("/admin/settings");

    await expect(page.locator("h1")).toContainText(/Tizim sozlamalari/i);

    // Moliya sozlamalari
    await expect(page.getByText(/1 USD kursi/i)).toBeVisible();
    await expect(page.getByText(/Soliq stavkasi/i)).toBeVisible();
    await expect(page.getByText(/Bepul yetkazib berish chegarasi/i)).toBeVisible();
  });
});
