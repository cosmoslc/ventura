import { expect, test } from "@playwright/test";

test.describe("PC Modul: Tayyor kompyuterlar -> Batafsil -> Konfigurator", () => {
  test("1. Tayyor kompyuterlar ro'yxati (/computers) va filtrlash", async ({ page }) => {
    await page.goto("/computers");

    await expect(page.locator("h1")).toContainText(/Tayyor oʻyin va ishchi kompyuterlar/i);

    // Konfigurator banneri
    await expect(page.getByText(/Oʻz kompyuteringizni yigʻmoqchimisiz/i)).toBeVisible();

    // Kompyuter kartalari
    const pcCards = page.locator("div.group.relative.flex.flex-col");
    await expect(pcCards.first()).toBeVisible();

    // CPU filtri: Intel Core i7
    const cpuBtn = page.getByRole("button", { name: /Intel Core i7/i }).first();
    await cpuBtn.click();
    await expect(page.getByText(/Gaming Titan/i).first()).toBeVisible();

    // Videokarta filtri: RTX 4070
    const gpuBtn = page.getByRole("button", { name: /GeForce RTX 4070/i }).first();
    await gpuBtn.click();
    await expect(page.getByText(/RTX 4070/i).first()).toBeVisible();
  });

  test("2. Kompyuter batafsil sahifasi (/computers/[slug]) va komponentlar ro'yxati", async ({ page }) => {
    await page.goto("/computers/ventura-gaming-titan-i7-4070");

    // Sarlavha
    await expect(page.locator("h1")).toContainText(/Gaming Titan/i);

    // Afzalliklar bloklari
    await expect(page.getByText(/12 oy rasmiy kafolat/i)).toBeVisible();
    await expect(page.getByText(/24 soat stress-test/i)).toBeVisible();

    // Yig'ilgan komponentlar ro'yxati
    await expect(page.getByText(/Yigʻilgan komponentlar roʻyxati/i)).toBeVisible();
    await expect(page.getByText(/MSI MAG Z790/i).first()).toBeVisible();
    await expect(page.getByText(/Samsung 990 PRO/i).first()).toBeVisible();

    // Texnik xususiyatlar va '?' izoh
    await expect(page.getByText(/Batafsil texnik xususiyatlar/i)).toBeVisible();

    // Sharh qoldirish formasi
    await expect(page.getByRole("heading", { name: "Sharh qoldirish" })).toBeVisible();
    await page.getByPlaceholder(/Masalan: Jamshid/i).fill("Geymer Shahzod");
    await page.getByPlaceholder(/oʻyinlardagi FPS/i).fill("Kompyuter 4K da juda tez ishlayapti, sovutish ajoyib!");
    await page.getByRole("button", { name: /Sharhni yuborish/i }).click();

    await expect(page.getByText(/Sharhingiz qabul qilindi/i)).toBeVisible();
  });

  test("3. Shaxsiy PC Konfiguratori (/computers/custom) to'liq interaktiv oqimi", async ({ page }) => {
    await page.goto("/computers/custom");

    // Sarlavha
    await expect(page.locator("h1")).toContainText(/Oʻz orzuingizdagi shaxsiy kompyuterni yigʻing/i);

    // Kategoriya tablari (CPU, Ona plata, Videokarta...)
    await expect(page.getByRole("button", { name: /Protsessor/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Videokarta/i }).first()).toBeVisible();

    // Xulosa paneli
    await expect(page.getByText(/Konfiguratsiya xulosasi/i)).toBeVisible();
    await expect(page.getByText(/Tavsiya etilgan quvvat/i)).toBeVisible();

    // Videokarta bo'limiga o'tish
    const gpuTabBtn = page.locator("main").getByRole("button", { name: /Videokarta/i }).first();
    await expect(gpuTabBtn).toBeVisible();
    await gpuTabBtn.click();

    const gpuDesc = page.getByText(/Grafika, oʻyinlar va 3D render/i);
    if (!(await gpuDesc.isVisible({ timeout: 1500 }).catch(() => false))) {
      await gpuTabBtn.click();
    }
    await expect(gpuDesc).toBeVisible();

    // Boshqa videokartani tanlash (Palit RTX 4060)
    const chooseGpu = page.getByText(/Palit GeForce RTX 4060 Dual/i).first();
    await chooseGpu.click();

    // Buyurtma berish tugmasini bosish
    const submitOrderBtn = page.getByRole("button", { name: /Buyurtma berish/i }).first();
    await submitOrderBtn.click();

    // Buyurtma modali ochilishi
    await expect(page.getByRole("heading", { name: /Shaxsiy PC uchun buyurtma/i })).toBeVisible();

    // Formani to'ldirish
    await page.getByPlaceholder(/Masalan: Sardorbek/i).fill("Murodbek Omonov");
    await page.getByPlaceholder(/\+998 90/i).fill("+998 99 876 54 32");
    await page.getByPlaceholder(/Chilonzor tumani/i).fill("Toshkent, Sergeli 7");
    await page.getByPlaceholder(/Windows 11 oʻrnatish/i).fill("RGB oq bo'lsin, test hisoboti berilsin");

    // Tasdiqlash
    await page.getByRole("button", { name: /Tasdiqlash va yuborish/i }).click();

    // Muvaffaqiyat modali
    await expect(page.getByRole("heading", { name: /Buyurtmangiz qabul qilindi/i })).toBeVisible();
    await expect(page.getByText(/PCO-2026/i)).toBeVisible();
    await expect(page.getByText(/Telegram operator bilan bogʻlanish/i)).toBeVisible();
  });
});
