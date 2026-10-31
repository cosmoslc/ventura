import { expect, test } from "@playwright/test";

test.describe("Storefront asosiy oqimi: Bosh sahifa -> Katalog -> Mahsulot -> Savat -> Checkout", () => {
  test("1. Bosh sahifa yuklanadi va asosiy bo'limlar ko'rinadi", async ({ page }) => {
    await page.goto("/");

    // Sarlavha va logo
    await expect(page).toHaveTitle(/Kompyuter|Ventura/i);
    await expect(page.locator("header")).toBeVisible();

    // Navigatsiya menyusi
    await expect(page.getByRole("link", { name: "Mahsulotlar" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Kompyuterlar" }).first()).toBeVisible();
    await expect(page.locator("header").getByRole("link", { name: /Konfigurator/i })).not.toBeVisible();

    // Hero bo'limi
    await expect(page.locator("h1")).toContainText(/Cheksiz quvvat|unumdorlik/i);
  });

  test("2. Qidiruv inputi bosilganda kengayadi, kategoriyalar va oxirgi qidiruvlar chiqadi", async ({ page }) => {
    await page.goto("/");

    // Qidiruv inputini topish va bosish
    const searchInput = page.locator("header").getByPlaceholder(/Kompyuter, videokarta/i);
    await expect(searchInput).toBeVisible();
    await searchInput.click();

    // Pastga ochiladigan panel: Oxirgi qidirilganlar va Ommabop kategoriyalar ko'rinishi
    await expect(page.getByText(/Oxirgi qidirilganlar/i)).toBeVisible();
    await expect(page.getByText(/Ommabop kategoriyalar/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Videokartalar" })).toBeVisible();

    // So'rov kiritish
    await searchInput.fill("4070");
    await expect(page.locator("header").getByText(/ASUS ROG Strix GeForce RTX 4070/i)).toBeVisible();

    // Escape bosilganda yopilishi
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Oxirgi qidirilganlar/i)).not.toBeVisible();
  });

  test("3. Mahsulotlar katalogi (/products) va filtrlar ishlaydi", async ({ page }) => {
    await page.goto("/products");
    await expect(page.locator("h1")).toContainText(/Mahsulotlar katalogi/i);

    // Mahsulot kartalari mavjudligi
    const productCards = page.locator("div.group.relative.flex.flex-col");
    await expect(productCards.first()).toBeVisible();

    // 1. Kategoriya bo'yicha filtrlash (Videokartalar)
    const gpuFilter = page.locator("aside").getByRole("button", { name: /Videokartalar/i });
    await gpuFilter.click();
    await expect(page.getByText(/RTX 4070/i).first()).toBeVisible();
    await expect(page.getByText(/Intel Core i7/i)).not.toBeVisible();

    // 2. Kategoriya bo'yicha filtrlash (Protsessorlar)
    const cpuFilter = page.locator("aside").getByRole("button", { name: /Protsessorlar/i });
    await cpuFilter.click();
    await expect(page.getByText(/Intel Core i7/i).first()).toBeVisible();
    await expect(page.getByText(/RTX 4070/i)).not.toBeVisible();

    // 3. Brend bo'yicha filtrlash (Headerdagi Brend filtri)
    const allCatFilter = page.locator("aside").getByRole("button", { name: /Barcha toifalar/i });
    await allCatFilter.click();
    const samsungFilter = page.getByRole("button", { name: "Samsung" });
    await samsungFilter.click();
    await expect(page.getByText(/Samsung 990 PRO/i).first()).toBeVisible();
  });

  test("4. Mahsulot batafsil sahifasi (/products/[slug]) va '?' texnik izoh modali", async ({ page }) => {
    await page.goto("/products/asus-rog-strix-geforce-rtx-4070-ti-super");

    // Nomi va narxi
    await expect(page.locator("h1")).toContainText(/ASUS ROG Strix/i);
    await expect(page.getByText(/so['ʻ]m/i).first()).toBeVisible();

    // Texnik xususiyatlar bo'limi
    await expect(page.getByRole("heading", { name: "Texnik xususiyatlar" })).toBeVisible();

    // '?' tugmasini bosib texnik ma'lumot modalini tekshirish
    const helpBtn = page.getByRole("button", { name: /Batafsil maʼlumot/i }).first();
    if (await helpBtn.isVisible()) {
      await helpBtn.click();
      await expect(page.getByRole("heading", { name: /nima\?/i })).toBeVisible();
      // Yopish
      await page.getByRole("button", { name: /Tushundim/i }).click();
    }
  });

  test("5. Savatga qo'shish, Savatcha drawer'i va Checkout jarayoni", async ({ page }) => {
    await page.goto("/products");

    // Birinchi mahsulotni savatga qo'shish
    const buyBtn = page.getByRole("button", { name: /^Savatga$/i }).first();
    await buyBtn.click();

    // Savatcha drawer'i ochilishi
    await expect(page.getByRole("heading", { name: /Xarid savatchasi/i })).toBeVisible();

    // Buyurtma berishga o'tish
    const checkoutLink = page.getByRole("link", { name: /Buyurtmaga/i }).first();
    await checkoutLink.click();

    // Checkout sahifasi
    await page.waitForURL("/checkout");
    await expect(page.locator("h1")).toContainText(/Buyurtmani rasmiylashtirish/i);

    // Formani to'ldirish
    await page.getByPlaceholder(/Masalan: Sardor/i).fill("Alisher");
    await page.getByPlaceholder(/Masalan: Alimov/i).fill("Vohidov");
    await page.getByPlaceholder(/\+998 90/i).fill("+998 90 123 45 67");
    await page.getByPlaceholder(/Yunusobod 4-mavze/i).fill("Yunusobod 4, 12-uy");

    // Xarita joylashuv tanlash bloki ko'rinishi
    await expect(page.getByText(/Xaritadan nuqtani tanlash/i)).toBeVisible();

    // Buyurtmani tasdiqlash
    await page.getByRole("button", { name: /Buyurtmani tasdiqlash/i }).click();

    // Muvaffaqiyat xabari
    await expect(page.getByText(/Buyurtmangiz qabul qilindi/i)).toBeVisible();
    await expect(page.getByText(/ORD-\d{4}/i)).toBeVisible();
    await expect(page.getByText(/Telegram orqali operatorga yozish/i)).toBeVisible();
  });

  test("6. Bildirishnomalar drawer'i to'liq ekranda (full-height) ochiladi va yopiladi", async ({ page }) => {
    await page.goto("/");

    // Bildirishnomalar tugmasini bosish
    const notifBtn = page.getByRole("button", { name: "Bildirishnomalar" });
    await expect(notifBtn).toBeVisible();
    await notifBtn.click();

    // Drawer sarlavhasi
    const notifHeading = page.getByRole("heading", { name: "Bildirishnomalar" });
    await expect(notifHeading).toBeVisible();

    // Panel to'liq balandlikda ekanligini tekshirish (navbar ichida siqilib qolmagan)
    const drawerPanel = page.locator("div.fixed.inset-0.z-50");
    await expect(drawerPanel).toBeVisible();

    const boundingBox = await page.locator("div.fixed.inset-0.z-50 > div.relative").boundingBox();
    expect(boundingBox).not.toBeNull();
    // Balandlik kamida 500px bo'lishi kerak (viewport balandligi)
    expect(boundingBox!.height).toBeGreaterThan(500);

    // Bildirishnomalar ro'yxatida xabarlar mavjudligi
    await expect(page.getByText(/Katta kuzgi chegirmalar!/i)).toBeVisible();

    // Yopish tugmasini bosish
    await page.getByRole("button", { name: "Yopish" }).click();
    await expect(notifHeading).not.toBeVisible();
  });
});
