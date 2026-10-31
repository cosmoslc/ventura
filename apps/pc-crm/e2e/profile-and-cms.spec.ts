import { expect, test } from "@playwright/test";

test.describe("Foydalanuvchi profili va CMS sahifalari", () => {
  test("1. Profil umumiy ko'rinishi (/profile)", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.locator("h1")).toContainText(/Xush kelibsiz/i);
    await expect(page.getByText(/Jami buyurtmalar/i)).toBeVisible();
    await expect(page.getByText(/PC Zakazlari/i)).toBeVisible();
    await expect(page.getByText(/Saralanganlar/i).first()).toBeVisible();
  });

  test("2. Mening buyurtmalarim (/profile/orders) va tablar", async ({ page }) => {
    await page.goto("/profile/orders");

    await expect(page.locator("h1")).toContainText(/Mening buyurtmalarim/i);

    // Tablar: Jarayonda, Yetkazib berilgan, PC Zakazlarim
    const inProgressTab = page.getByRole("button", { name: /Jarayonda/i });
    const deliveredTab = page.getByRole("button", { name: /Yetkazib berilgan/i });
    const pcTab = page.getByRole("button", { name: /PC Zakazlarim/i });

    await expect(inProgressTab).toBeVisible();
    await expect(deliveredTab).toBeVisible();
    await expect(pcTab).toBeVisible();

    // PC Zakazlarim tabiga o'tish
    await pcTab.click();
    await expect(page.getByText(/Operator koʻrib chiqmoqda/i).first()).toBeVisible();

    // Yetkazib berilgan tabiga o'tish
    await deliveredTab.click();
    await expect(page.getByText(/ORD-2026-031/i)).toBeVisible();
  });

  test("3. Profil sozlamalari (/profile/settings) va parol modali", async ({ page }) => {
    await page.goto("/profile/settings");

    await expect(page.locator("h1")).toContainText(/Profil sozlamalari/i);

    // Shaxsiy ma'lumotlar inputlari
    await expect(page.locator("input:not([type='file'])").first()).toBeVisible();

    // Xarita iframe
    await expect(page.locator("iframe")).toBeVisible();

    // Parolni o'zgartirish modali
    const changePwdBtn = page.getByRole("button", { name: /Parolni oʻzgartirish/i });
    await changePwdBtn.click();

    await expect(page.getByRole("heading", { name: /Parolni oʻzgartirish/i })).toBeVisible();
    await page.getByRole("button", { name: /Bekor qilish/i }).click();
  });

  test("4. Saralanganlar (/profile/liked)", async ({ page }) => {
    // 1. Avval bosh sahifada biror mahsulotga like bosish
    await page.goto("/");
    const likeBtn = page.locator("button[aria-label=\"Sevimlilarga qo'shish\"]").first();
    await expect(likeBtn).toBeVisible();
    await likeBtn.click();

    // 2. /profile/liked sahifasiga o'tish
    await page.goto("/profile/liked");
    await expect(page.locator("h1")).toContainText(/Saralanganlar/i);
    await expect(page.getByText(/(Tayyor kompyuterlar|Komponentlar va ehtiyot qismlar)/i).first()).toBeVisible();
  });

  test("5. FAQ (/faq) savol-javoblar akordeoni", async ({ page }) => {
    await page.goto("/faq");

    await expect(page.locator("h1")).toContainText(/Savollaringiz bormi/i);

    // Kategoriya tugmalari
    await expect(page.getByRole("button", { name: /Yetkazib berish/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Kafolat va Servis/i }).first()).toBeVisible();

    // Kafolat kategoriyasiga o'tish
    await page.getByRole("button", { name: /Kafolat va Servis/i }).first().click();
    await expect(page.getByText(/Tayyor kompyuterlarga qancha muddat kafolat beriladi/i)).toBeVisible();

    // Savolni bosib ochish
    const questionBtn = page.getByRole("button", { name: /Tayyor kompyuterlarga qancha muddat kafolat beriladi/i });
    await questionBtn.click();
    await expect(page.getByText(/12 oydan 24 oygacha toʻliq rasmiy kafolat/i)).toBeVisible();
  });

  test("6. Biz haqimizda (/about) va filiallar", async ({ page }) => {
    await page.goto("/about");

    await expect(page.locator("h1")).toContainText(/kompyuter madaniyatini/i);

    // Statistikalar
    await expect(page.getByText(/5\+ yil/i)).toBeVisible();
    await expect(page.getByText(/12 000\+/i)).toBeVisible();

    // Jamoa bo'limi
    await expect(page.getByText(/Bizning asosiy jamoamiz/i)).toBeVisible();

    // Filiallar
    await expect(page.getByText(/Toshkent shahri/i).first()).toBeVisible();
    await expect(page.getByText(/Samarqand filiali/i).first()).toBeVisible();
  });

  test("7. OAuth va Tizimga kirish modali (Google, Email)", async ({ page }) => {
    await page.goto("/");

    // Profil tugmasini bosish (kirilmagan holatda auth modal ochiladi)
    const profileBtn = page.getByRole("button", { name: "Profil" });
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    // Auth modal elementlari
    await expect(page.getByRole("heading", { name: "Tizimga kirish" })).toBeVisible();
    await expect(page.getByText(/Google orqali kirish/i)).toBeVisible();
    await expect(page.getByText(/GitHub orqali kirish/i)).not.toBeVisible();
    await expect(page.getByText(/Tezkor test hisob bilan kirish/i)).toBeVisible();

    // Tezkor test hisobi bilan kirishni bosish va javobni kutish
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/sign-in/email") && r.status() === 200),
      page.getByRole("button", { name: /Tezkor test hisob bilan kirish/i }).click(),
    ]);
    expect(response.ok()).toBeTruthy();

    // Sahifa qayta yuklanishini kutish
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    // Endi foydalanuvchi tizimga kirgan, menyuni ochish
    const userBtn = page.locator("header").getByRole("button", { name: "Profil" });
    await expect(userBtn).toBeVisible();
    await userBtn.click();

    // Ochiluvchi menyuda foydalanuvchi ma'lumotlari va Chiqish tugmasi
    const logoutBtn = page.getByRole("button", { name: /Tizimdan chiqish/i });
    await expect(logoutBtn).toBeVisible();

    // Chiqishni bosish
    await logoutBtn.click();
    await page.waitForLoadState("networkidle");
  });
});
