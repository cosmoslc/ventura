import { createPcCrmDb } from "@ventura/db";
import {
  brands,
  categories,
  orders,
  orderItems,
  pcBuilds,
  pcComponents,
  pcOrders,
  pcOrderItems,
  pcSpecs,
  products,
  productImages,
  productSpecs,
  productVariants,
  purchases,
  sales,
  saleItems,
  settings,
  shippingRates,
  users,
  faqCategories,
  faqs,
  heroSlides,
  homeSections,
} from "@ventura/db/schema/pc-crm";
import { done, fail } from "./lib";
import { flag } from "./edu-lib";

/*
 * pnpm pc:seed [--database-url postgres://...]
 *
 * Dedicated PostgreSQL bazasini boshlang'ich haqiqiy ma'lumotlar bilan to'ldiradi:
 * - Sozlamalar va Yetkazib berish tariflari
 * - Kategoriyalar va Brendlar
 * - Butlovchi qismlar (CPU, GPU, RAM, SSD, va h.k.)
 * - Tayyor yig'ilgan PClar (PC Builds) va ularning komponentlari
 * - Ombor kirimlari (purchases)
 * - Sotuvlar (sales - sayt va oflayn)
 * - Xaridor buyurtmalari (orders)
 * - Super admin va foydalanuvchilar
 * - FAQ kategoriyalari va savollar
 * - Hero Slides va Home Sections
 */

const databaseUrl =
  flag("database-url") ??
  process.env.DATABASE_URL ??
  process.env.PC_CRM_DATABASE_URL ??
  "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/pc_crm_dev";

console.log(`[pc-seed] Ulanish: ${databaseUrl.replace(/:[^:@]+@/, ":***@")}...`);
const db = createPcCrmDb(databaseUrl, { max: 1 });

try {
  // 1. Sozlamalar
  console.log("[pc-seed] 1. Tizim sozlamalari yozilmoqda...");
  await db
    .insert(settings)
    .values([
      { key: "store_branding", value: { storeName: "Ventura PC Store", slug: "ventura-pc" } },
      { key: "usd_rate", value: { rate: 12850 } },
      { key: "tax_percent", value: { percent: 0 } },
      { key: "free_shipping_from", value: { amount: "1000000" } },
      {
        key: "store_contacts",
        value: {
          phone: "+998 71 200 00 00",
          telegram: "@venturapc_operator",
          address: "Toshkent shahri, Yunusobod tumani",
          email: "info@venturapc.uz",
        },
      },
    ])
    .onConflictDoNothing();

  // Yetkazib berish
  await db
    .insert(shippingRates)
    .values([
      { region: "Toshkent shahri", price: 35_000n, estimatedDays: "1 kun", enabled: true },
      { region: "Toshkent viloyati", price: 45_000n, estimatedDays: "1-2 kun", enabled: true },
      { region: "Samarqand viloyati", price: 55_000n, estimatedDays: "2-3 kun", enabled: true },
      { region: "Fargʻona vodiysi", price: 60_000n, estimatedDays: "2-3 kun", enabled: true },
      { region: "Buxoro viloyati", price: 60_000n, estimatedDays: "2-3 kun", enabled: true },
      { region: "Qashqadaryo viloyati", price: 65_000n, estimatedDays: "2-4 kun", enabled: true },
      { region: "Boshqa viloyatlar", price: 70_000n, estimatedDays: "2-4 kun", enabled: true },
    ])
    .onConflictDoNothing();

  // 2. Foydalanuvchilar
  console.log("[pc-seed] 2. Admin va mijozlar yozilmoqda...");
  const [adminUser] = await db
    .insert(users)
    .values({
      firstName: "Super",
      lastName: "Admin",
      name: "Super Admin",
      email: "admin@venturapc.uz",
      phone: "+998 90 000 00 01",
      role: "admin",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { firstName: "Super", lastName: "Admin", name: "Super Admin", role: "admin" },
    })
    .returning();

  const [customerUser] = await db
    .insert(users)
    .values({
      firstName: "Jamshid",
      lastName: "Karimov",
      name: "Jamshid Karimov",
      email: "jamshid@example.uz",
      phone: "+998 90 123 45 67",
      role: "customer",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { firstName: "Jamshid", lastName: "Karimov", name: "Jamshid Karimov" },
    })
    .returning();

  // 3. Brendlar
  console.log("[pc-seed] 3. Brendlar yozilmoqda...");
  const brandList = [
    { name: "Intel", slug: "intel" },
    { name: "AMD", slug: "amd" },
    { name: "ASUS", slug: "asus" },
    { name: "MSI", slug: "msi" },
    { name: "Kingston", slug: "kingston" },
    { name: "Samsung", slug: "samsung" },
    { name: "Corsair", slug: "corsair" },
    { name: "DeepCool", slug: "deepcool" },
    { name: "NZXT", slug: "nzxt" },
    { name: "Palit", slug: "palit" },
    { name: "Gigabyte", slug: "gigabyte" },
  ];

  const brandMap = new Map<string, string>();
  for (const b of brandList) {
    const [row] = await db
      .insert(brands)
      .values(b)
      .onConflictDoUpdate({ target: brands.slug, set: { name: b.name } })
      .returning();
    if (row) brandMap.set(b.slug, row.id);
  }

  // 4. Kategoriyalar
  console.log("[pc-seed] 4. Kategoriyalar yozilmoqda...");
  const catList = [
    { slug: "protsessorlar", name: { uz: "Protsessorlar (CPU)", ru: "Процессоры", en: "CPUs" } },
    { slug: "videokartalar", name: { uz: "Videokartalar (GPU)", ru: "Видеокарты", en: "Graphics Cards" } },
    { slug: "ona-platalar", name: { uz: "Ona platalar", ru: "Материнские платы", en: "Motherboards" } },
    { slug: "operativ-xotira", name: { uz: "Operativ xotira (RAM)", ru: "Оперативная память", en: "RAM" } },
    { slug: "ssd-disklar", name: { uz: "SSD toʻplovchilar", ru: "SSD накопители", en: "SSDs" } },
    { slug: "blok-pitaniya", name: { uz: "Blok pitaniya (PSU)", ru: "Блоки питания", en: "Power Supplies" } },
    { slug: "sovutish-tizimi", name: { uz: "Sovutish tizimi", ru: "Системы охлаждения", en: "Cooling" } },
    { slug: "korpuslar", name: { uz: "Korpuslar (Cases)", ru: "Корпуса", en: "Cases" } },
    { slug: "monitorlar", name: { uz: "Monitorlar", ru: "Мониторы", en: "Monitors" } },
  ];

  const catMap = new Map<string, string>();
  for (const c of catList) {
    const [row] = await db
      .insert(categories)
      .values(c)
      .onConflictDoUpdate({ target: categories.slug, set: { name: c.name } })
      .returning();
    if (row) catMap.set(c.slug, row.id);
  }

  // 5. Mahsulotlar (Katalog)
  console.log("[pc-seed] 5. Butlovchi qismlar va tovarlar yozilmoqda...");
  const rawProducts = [
    {
      slug: "intel-core-i7-14700k",
      catSlug: "protsessorlar",
      brandSlug: "intel",
      sku: "BX8071514700K",
      name: { uz: "Intel Core i7-14700K 3.4GHz LGA1700 Protsessor" },
      desc: { uz: "20 yadro, 28 oqim, 5.6 GHz turbo chastota. O'yinlar va og'ir ishlar uchun ideal tanlov." },
      costPrice: 4_600_000n,
      sellPrice: 5_200_000n,
      discountPercent: 10,
      stock: 12,
      isNew: true,
      isHit: true,
      ratingAvg: "4.90",
      ratingCount: 14,
      image: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&q=80",
    },
    {
      slug: "intel-core-i9-14900k",
      catSlug: "protsessorlar",
      brandSlug: "intel",
      sku: "BX8071514900K",
      name: { uz: "Intel Core i9-14900K 3.2GHz LGA1700 Protsessor" },
      desc: { uz: "24 yadro, 32 oqim, 6.0 GHz gacha rekord chastota. Flagman quvvat." },
      costPrice: 6_800_000n,
      sellPrice: 7_800_000n,
      discountPercent: 0,
      stock: 6,
      isNew: true,
      isHit: true,
      ratingAvg: "5.00",
      ratingCount: 9,
      image: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=600&q=80",
    },
    {
      slug: "amd-ryzen-7-7800x3d",
      catSlug: "protsessorlar",
      brandSlug: "amd",
      sku: "100-100000910WOF",
      name: { uz: "AMD Ryzen 7 7800X3D 4.2GHz AM5 3D V-Cache Protsessor" },
      desc: { uz: "Dunyodagi eng yaxshi o'yin protsessori. 96MB 3D V-Cache." },
      costPrice: 5_100_000n,
      sellPrice: 5_950_000n,
      discountPercent: 5,
      stock: 10,
      isNew: true,
      isHit: true,
      ratingAvg: "4.95",
      ratingCount: 28,
      image: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&q=80",
    },
    {
      slug: "amd-ryzen-5-7600x",
      catSlug: "protsessorlar",
      brandSlug: "amd",
      sku: "100-100000593WOF",
      name: { uz: "AMD Ryzen 5 7600X 4.7GHz AM5 Protsessor" },
      desc: { uz: "6 yadro, 12 oqim, 5.3 GHz turbo. Byudjet o'yin kompyuterlari uchun a'lo daraja." },
      costPrice: 2_350_000n,
      sellPrice: 2_750_000n,
      discountPercent: 0,
      stock: 15,
      isNew: false,
      isHit: false,
      ratingAvg: "4.75",
      ratingCount: 16,
      image: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=600&q=80",
    },
    {
      slug: "asus-rog-strix-geforce-rtx-4070-ti-super",
      catSlug: "videokartalar",
      brandSlug: "asus",
      sku: "ROG-STRIX-RTX4070TIS-O16G",
      name: { uz: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB GDDR6X" },
      desc: { uz: "Ada Lovelace arxitekturasi, DLSS 3, 16GB VRAM, Axial-tech sovutish tizimi." },
      costPrice: 12_100_000n,
      sellPrice: 13_500_000n,
      discountPercent: 5,
      stock: 5,
      isNew: true,
      isHit: true,
      ratingAvg: "5.00",
      ratingCount: 22,
      image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&q=80",
    },
    {
      slug: "asus-dual-rtx-4070-super-12gb",
      catSlug: "videokartalar",
      brandSlug: "asus",
      sku: "DUAL-RTX4070S-O12G",
      name: { uz: "ASUS Dual GeForce RTX 4070 SUPER OC Edition 12GB" },
      desc: { uz: "2K o'yinlar uchun ideal. 12GB GDDR6X, ixcham 2 ventilyatorli korpus." },
      costPrice: 7_750_000n,
      sellPrice: 8_900_000n,
      discountPercent: 0,
      stock: 8,
      isNew: true,
      isHit: true,
      ratingAvg: "4.85",
      ratingCount: 19,
      image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&q=80",
    },
    {
      slug: "palit-geforce-rtx-4060-dual-8gb",
      catSlug: "videokartalar",
      brandSlug: "palit",
      sku: "NE64060019P1-1070D",
      name: { uz: "Palit GeForce RTX 4060 Dual 8GB GDDR6" },
      desc: { uz: "Full HD maksimal grafikada o'ynash uchun kam energiya sarflovchi yechim." },
      costPrice: 3_850_000n,
      sellPrice: 4_400_000n,
      discountPercent: 0,
      stock: 14,
      isNew: false,
      isHit: true,
      ratingAvg: "4.80",
      ratingCount: 31,
      image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&q=80",
    },
    {
      slug: "msi-mag-z790-tomahawk-wifi",
      catSlug: "ona-platalar",
      brandSlug: "msi",
      sku: "MAG-Z790-TOMAHAWK",
      name: { uz: "MSI MAG Z790 TOMAHAWK WIFI DDR5 LGA1700" },
      desc: { uz: "Kuchli 16+1+1 faza quvvat tizimi, Wi-Fi 6E, PCIe 5.0, 4 ta M.2 slot." },
      costPrice: 2_950_000n,
      sellPrice: 3_400_000n,
      discountPercent: 0,
      stock: 9,
      isNew: true,
      isHit: false,
      ratingAvg: "4.90",
      ratingCount: 11,
      image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80",
    },
    {
      slug: "kingston-fury-beast-rgb-32gb-ddr5",
      catSlug: "operativ-xotira",
      brandSlug: "kingston",
      sku: "KF560C36BBEAK2-32",
      name: { uz: "Kingston FURY Beast RGB 32GB (2x16GB) 6000MHz DDR5" },
      desc: { uz: "Intel XMP 3.0 va AMD EXPO qo'llab-quvvatlaydigan yorqin RGB xotira." },
      costPrice: 1_400_000n,
      sellPrice: 1_750_000n,
      discountPercent: 0,
      stock: 20,
      isNew: true,
      isHit: true,
      ratingAvg: "4.85",
      ratingCount: 15,
      image: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=600&q=80",
    },
    {
      slug: "samsung-990-pro-2tb-nvme-ssd",
      catSlug: "ssd-disklar",
      brandSlug: "samsung",
      sku: "MZ-V9P2T0BW",
      name: { uz: "Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2 SSD" },
      desc: { uz: "7450 MB/s o'qish, 6900 MB/s yozish tezligi. Eng yuqori tezlik va barqarorlik." },
      costPrice: 2_150_000n,
      sellPrice: 2_600_000n,
      discountPercent: 0,
      stock: 18,
      isNew: true,
      isHit: true,
      ratingAvg: "4.95",
      ratingCount: 24,
      image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&q=80",
    },
    {
      slug: "samsung-990-pro-1tb-nvme-ssd",
      catSlug: "ssd-disklar",
      brandSlug: "samsung",
      sku: "MZ-V9P1T0BW",
      name: { uz: "Samsung 990 PRO 1TB PCIe 4.0 NVMe M.2 SSD" },
      desc: { uz: "Tizim va o'yinlar bir zumda ochilishi uchun flagman NVMe SSD." },
      costPrice: 1_450_000n,
      sellPrice: 1_850_000n,
      discountPercent: 0,
      stock: 25,
      isNew: true,
      isHit: false,
      ratingAvg: "4.90",
      ratingCount: 18,
      image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&q=80",
    },
    {
      slug: "deepcool-lt720-360mm-aio",
      catSlug: "sovutish-tizimi",
      brandSlug: "deepcool",
      sku: "R-LT720-BKAMNF-G-1",
      name: { uz: "DeepCool LT720 360mm ARGB Suyuqlikli Sovutgich (AIO)" },
      desc: { uz: "4-avlod nasos, ko'zguli kub dizayni, 300W+ issiqlik tarqatish quvvati." },
      costPrice: 1_100_000n,
      sellPrice: 1_450_000n,
      discountPercent: 0,
      stock: 11,
      isNew: true,
      isHit: true,
      ratingAvg: "4.80",
      ratingCount: 13,
      image: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&q=80",
    },
    {
      slug: "corsair-rm850e-850w-gold",
      catSlug: "blok-pitaniya",
      brandSlug: "corsair",
      sku: "CP-9020263-EU",
      name: { uz: "Corsair RM850e 850W 80+ Gold To'liq Modulli Blok Pitaniya" },
      desc: { uz: "ATX 3.0 va PCIe 5.0 sertifikatlangan, 12VHPWR kabeli bilan." },
      costPrice: 1_350_000n,
      sellPrice: 1_650_000n,
      discountPercent: 0,
      stock: 16,
      isNew: false,
      isHit: true,
      ratingAvg: "4.90",
      ratingCount: 20,
      image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&q=80",
    },
    {
      slug: "nzxt-h7-flow-rgb-black",
      catSlug: "korpuslar",
      brandSlug: "nzxt",
      sku: "CM-H71FB-R1",
      name: { uz: "NZXT H7 Flow RGB Black Mid-Tower O'yin Korpusi" },
      desc: { uz: "Yuqori havo aylanishi (perforatsiya), oldindan o'rnatilgan 3 ta F140 RGB ventilyator." },
      costPrice: 1_400_000n,
      sellPrice: 1_750_000n,
      discountPercent: 0,
      stock: 8,
      isNew: true,
      isHit: false,
      ratingAvg: "4.90",
      ratingCount: 14,
      image: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&q=80",
    },
  ];

  const productMap = new Map<string, string>();
  for (const p of rawProducts) {
    const catId = catMap.get(p.catSlug);
    const brandId = brandMap.get(p.brandSlug);
    if (!catId) continue;

    const [row] = await db
      .insert(products)
      .values({
        slug: p.slug,
        categoryId: catId,
        brandId,
        sku: p.sku,
        name: p.name,
        desc: p.desc,
        costPrice: p.costPrice,
        sellPrice: p.sellPrice,
        discountPercent: p.discountPercent,
        stock: p.stock,
        isNew: p.isNew,
        isHit: p.isHit,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          costPrice: p.costPrice,
          sellPrice: p.sellPrice,
          stock: p.stock,
          ratingAvg: p.ratingAvg,
        },
      })
      .returning();

    if (row) {
      productMap.set(p.slug, row.id);

      // Asosiy rasm
      await db
        .insert(productImages)
        .values({
          productId: row.id,
          url: p.image,
          sort: 0,
        })
        .onConflictDoNothing();
    }
  }

  // 6. Tayyor PClar (pc_builds)
  console.log("[pc-seed] 6. Tayyor yig'ilgan kompyuterlar (PC Builds) yozilmoqda...");
  const rawBuilds = [
    {
      slug: "ventura-gaming-titan-i7-4070",
      name: { uz: "Ventura Gaming Titan: Core i7-14700K / RTX 4070 Ti Super" },
      images: [
        "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&q=80",
        "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=900&q=80",
      ],
      costPrice: 22_500_000n,
      sellPrice: 26_500_000n,
      discountPercent: 6,
      status: "available" as const,
      ratingAvg: "5.00",
      ratingCount: 14,
      components: [
        { role: "cpu" as const, productSlug: "intel-core-i7-14700k", cost: 4_600_000n },
        { role: "gpu" as const, productSlug: "asus-rog-strix-geforce-rtx-4070-ti-super", cost: 12_100_000n },
        { role: "motherboard" as const, productSlug: "msi-mag-z790-tomahawk-wifi", cost: 2_950_000n },
        { role: "ram" as const, productSlug: "kingston-fury-beast-rgb-32gb-ddr5", cost: 1_400_000n },
        { role: "ssd" as const, productSlug: "samsung-990-pro-2tb-nvme-ssd", cost: 2_150_000n },
        { role: "cooler" as const, productSlug: "deepcool-lt720-360mm-aio", cost: 1_100_000n },
        { role: "psu" as const, productSlug: "corsair-rm850e-850w-gold", cost: 1_350_000n },
        { role: "case" as const, productSlug: "nzxt-h7-flow-rgb-black", cost: 1_400_000n },
      ],
    },
    {
      slug: "ventura-streamer-pro-ryzen7-4060ti",
      name: { uz: "Ventura Streamer Pro: Ryzen 7 7800X3D / RTX 4060 Ti" },
      images: [
        "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=900&q=80",
      ],
      costPrice: 15_900_000n,
      sellPrice: 18_900_000n,
      discountPercent: 0,
      status: "available" as const,
      ratingAvg: "4.90",
      ratingCount: 18,
      components: [
        { role: "cpu" as const, productSlug: "amd-ryzen-7-7800x3d", cost: 5_100_000n },
        { role: "gpu" as const, productSlug: "asus-dual-rtx-4070-super-12gb", cost: 7_750_000n },
        { role: "ram" as const, productSlug: "kingston-fury-beast-rgb-32gb-ddr5", cost: 1_400_000n },
        { role: "ssd" as const, productSlug: "samsung-990-pro-1tb-nvme-ssd", cost: 1_450_000n },
        { role: "cooler" as const, productSlug: "deepcool-lt720-360mm-aio", cost: 1_100_000n },
        { role: "psu" as const, productSlug: "corsair-rm850e-850w-gold", cost: 1_350_000n },
        { role: "case" as const, productSlug: "nzxt-h7-flow-rgb-black", cost: 1_400_000n },
      ],
    },
    {
      slug: "ventura-cyber-beast-i9-4090",
      name: { uz: "Ventura Cyber Beast: Core i9-14900K / RTX 4090 24GB" },
      images: [
        "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=900&q=80",
      ],
      costPrice: 42_000_000n,
      sellPrice: 51_000_000n,
      discountPercent: 5,
      status: "available" as const,
      ratingAvg: "5.00",
      ratingCount: 7,
      components: [
        { role: "cpu" as const, productSlug: "intel-core-i9-14900k", cost: 6_800_000n },
        { role: "gpu" as const, productSlug: "asus-rog-strix-geforce-rtx-4070-ti-super", cost: 12_100_000n },
        { role: "motherboard" as const, productSlug: "msi-mag-z790-tomahawk-wifi", cost: 2_950_000n },
        { role: "ram" as const, productSlug: "kingston-fury-beast-rgb-32gb-ddr5", cost: 1_400_000n },
        { role: "ssd" as const, productSlug: "samsung-990-pro-2tb-nvme-ssd", cost: 2_150_000n },
        { role: "cooler" as const, productSlug: "deepcool-lt720-360mm-aio", cost: 1_100_000n },
        { role: "psu" as const, productSlug: "corsair-rm850e-850w-gold", cost: 1_350_000n },
        { role: "case" as const, productSlug: "nzxt-h7-flow-rgb-black", cost: 1_400_000n },
      ],
    },
    {
      slug: "ventura-creator-amd-rx7800xt",
      name: { uz: "Ventura Creator: Ryzen 5 7600X / Radeon RX 7800 XT" },
      images: [
        "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=900&q=80",
      ],
      costPrice: 14_100_000n,
      sellPrice: 16_800_000n,
      discountPercent: 0,
      status: "available" as const,
      ratingAvg: "4.80",
      ratingCount: 9,
      components: [
        { role: "cpu" as const, productSlug: "amd-ryzen-5-7600x", cost: 2_350_000n },
        { role: "gpu" as const, productSlug: "palit-geforce-rtx-4060-dual-8gb", cost: 3_850_000n },
        { role: "ram" as const, productSlug: "kingston-fury-beast-rgb-32gb-ddr5", cost: 1_400_000n },
        { role: "ssd" as const, productSlug: "samsung-990-pro-1tb-nvme-ssd", cost: 1_450_000n },
        { role: "cooler" as const, productSlug: "deepcool-lt720-360mm-aio", cost: 1_100_000n },
        { role: "psu" as const, productSlug: "corsair-rm850e-850w-gold", cost: 1_350_000n },
        { role: "case" as const, productSlug: "nzxt-h7-flow-rgb-black", cost: 1_400_000n },
      ],
    },
  ];

  for (const b of rawBuilds) {
    const [pcRow] = await db
      .insert(pcBuilds)
      .values({
        slug: b.slug,
        name: b.name,
        images: b.images,
        costPrice: b.costPrice,
        sellPrice: b.sellPrice,
        discountPercent: b.discountPercent,
        status: b.status,
        ratingAvg: b.ratingAvg,
        ratingCount: b.ratingCount,
      })
      .onConflictDoUpdate({
        target: pcBuilds.slug,
        set: { costPrice: b.costPrice, sellPrice: b.sellPrice, status: b.status },
      })
      .returning();

    if (pcRow) {
      for (const comp of b.components) {
        const prodId = productMap.get(comp.productSlug);
        if (!prodId) continue;
        await db
          .insert(pcComponents)
          .values({
            pcId: pcRow.id,
            role: comp.role,
            productId: prodId,
            qty: 1,
            costSnapshot: comp.cost,
          })
          .onConflictDoNothing();
      }
    }
  }

  // 7. Ombor kirimlari (purchases)
  console.log("[pc-seed] 7. Ombor kirimlari yozilmoqda...");
  const cpuId = productMap.get("intel-core-i7-14700k");
  const ramId = productMap.get("kingston-fury-beast-rgb-32gb-ddr5");
  const ssdId = productMap.get("samsung-990-pro-2tb-nvme-ssd");

  if (cpuId && ramId && ssdId) {
    await db
      .insert(purchases)
      .values([
        {
          productId: cpuId,
          type: "bulk",
          qty: 10,
          unitCost: 4_500_000n,
          totalCost: 45_000_000n,
          supplier: "Intel Distro Tashkent",
          note: "Yangi partiya xaridi",
          createdBy: adminUser?.id,
        },
        {
          productId: ramId,
          type: "piece",
          qty: 20,
          unitCost: 1_450_000n,
          totalCost: 29_000_000n,
          supplier: "Malika B-14",
          createdBy: adminUser?.id,
        },
        {
          productId: ssdId,
          type: "bulk",
          qty: 15,
          unitCost: 2_150_000n,
          totalCost: 32_250_000n,
          supplier: "Samsung Korea Import",
          createdBy: adminUser?.id,
        },
      ])
      .onConflictDoNothing();
  }

  // 8. Sotuvlar (sales)
  console.log("[pc-seed] 8. Sotuvlar jurnali yozilmoqda...");
  if (cpuId && ramId) {
    const [sale1] = await db
      .insert(sales)
      .values({
        source: "offline",
        type: "product",
        buyerName: "Farrux Zokirov",
        buyerPhone: "+998 90 999 88 77",
        total: 5_200_000n,
        costTotal: 4_600_000n,
        profit: 600_000n,
        createdBy: adminUser?.id,
      })
      .returning();

    if (sale1) {
      await db.insert(saleItems).values({
        saleId: sale1.id,
        productId: cpuId,
        nameSnapshot: "Intel Core i7-14700K 3.4GHz Protsessor",
        qty: 1,
        listPrice: 5_200_000n,
        soldPrice: 5_200_000n,
        costSnapshot: 4_600_000n,
        profit: 600_000n,
      });
    }
  }

  // 9. Xaridor buyurtmasi (orders)
  console.log("[pc-seed] 9. Buyurtmalar yozilmoqda...");
  const gpuId = productMap.get("asus-rog-strix-geforce-rtx-4070-ti-super");
  if (gpuId) {
    const [order1] = await db
      .insert(orders)
      .values({
        publicId: "ORD-2026-001",
        userId: customerUser?.id,
        status: "new",
        name: "Jamshid Karimov",
        phone: "+998 90 123 45 67",
        region: "Toshkent shahri",
        address: "Yunusobod 4-mavze, 12-uy, 45-xonadon",
        subtotal: 13_500_000n,
        shipping: 0n,
        discount: 0n,
        tax: 0n,
        total: 13_500_000n,
        paymentMethod: "cod_operator",
        note: "Kuryer kelishidan oldin qo'ng'iroq qilsin",
      })
      .onConflictDoNothing()
      .returning();

    if (order1) {
      await db.insert(orderItems).values({
        orderId: order1.id,
        productId: gpuId,
        nameSnapshot: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB",
        priceSnapshot: 13_500_000n,
        costSnapshot: 12_100_000n,
        qty: 1,
      });
    }
  }

  // 10. Konfigurator PC buyurtmalari (pc_orders)
  console.log("[pc-seed] 10. PC Konfigurator buyurtmalari yozilmoqda...");
  const [pcOrder1] = await db
    .insert(pcOrders)
    .values({
      name: "Sardorbek Rahimov",
      phone: "+998 90 123 45 67",
      address: "Toshkent sh., Chilonzor tumani, 9-mavze, 14-uy",
      status: "new",
      quotedPrice: 18_500_000n,
      note: "Telegram orqali bog'lanish ma'qul",
    })
    .returning();

  if (pcOrder1 && cpuId && gpuId) {
    await db.insert(pcOrderItems).values([
      { pcOrderId: pcOrder1.id, role: "cpu", productId: cpuId, qty: 1 },
      { pcOrderId: pcOrder1.id, role: "gpu", productId: gpuId, qty: 1 },
    ]);
  }

  // 11. Kontent (FAQ, Hero Slides, Home Sections)
  console.log("[pc-seed] 11. Kontent yozilmoqda...");

  // FAQ kategoriyalari
  const [faqCat1] = await db
    .insert(faqCategories)
    .values([
      { name: { uz: "Buyurtma va Yetkazib berish", ru: "Заказ и доставка", en: "Orders & Delivery" }, sort: 1 },
    ])
    .onConflictDoNothing()
    .returning();

  const [faqCat2] = await db
    .insert(faqCategories)
    .values([
      { name: { uz: "Toʻlov va Kafolat", ru: "Оплата и Гарантия", en: "Payment & Warranty" }, sort: 2 },
    ])
    .onConflictDoNothing()
    .returning();

  const [faqCat3] = await db
    .insert(faqCategories)
    .values([
      { name: { uz: "PC Konfigurator", ru: "PC Конфигуратор", en: "PC Configurator" }, sort: 3 },
    ])
    .onConflictDoNothing()
    .returning();

  if (faqCat1) {
    await db.insert(faqs).values([
      {
        categoryId: faqCat1.id,
        question: { uz: "Yetkazib berish qancha vaqt oladi?", ru: "Сколько времени занимает доставка?", en: "How long does delivery take?" },
        answer: { uz: "Toshkent shahri bo'yicha 1 kun, viloyatlarga 2-4 ish kuni ichida yetkazib beramiz.", ru: "По Ташкенту — 1 день, по регионам — 2-4 рабочих дня.", en: "Tashkent city — 1 day, regions — 2-4 business days." },
        sort: 1,
      },
      {
        categoryId: faqCat1.id,
        question: { uz: "Buyurtmani bekor qilish mumkinmi?", ru: "Можно ли отменить заказ?", en: "Can I cancel my order?" },
        answer: { uz: "Ha, buyurtma 'Tasdiqlangan' holatiga o'tmaguncha bekor qilish mumkin. Operator bilan bog'laning.", ru: "Да, до подтверждения заказа отменить можно. Свяжитесь с оператором.", en: "Yes, orders can be cancelled before confirmation. Contact our operator." },
        sort: 2,
      },
      {
        categoryId: faqCat1.id,
        question: { uz: "Buyurtma holatini qayerdan kuzataman?", ru: "Где отслеживать статус заказа?", en: "Where can I track my order?" },
        answer: { uz: "Profilingiz → 'Mening buyurtmalarim' bo'limida real vaqt holatini ko'ring.", ru: "В профиле → раздел 'Мои заказы' — статус обновляется в реальном времени.", en: "Profile → 'My Orders' section — status updates in real time." },
        sort: 3,
      },
    ]).onConflictDoNothing();
  }

  if (faqCat2) {
    await db.insert(faqs).values([
      {
        categoryId: faqCat2.id,
        question: { uz: "Qanday toʻlov usullari mavjud?", ru: "Какие способы оплаты доступны?", en: "What payment methods are available?" },
        answer: { uz: "Hozircha naqd pul kuryer orqali (COD). Tez orada Click va Payme ham qo'shiladi.", ru: "Сейчас — наличными курьеру (COD). Скоро добавим Click и Payme.", en: "Currently cash on delivery (COD). Click and Payme coming soon." },
        sort: 1,
      },
      {
        categoryId: faqCat2.id,
        question: { uz: "Kafolat muddati qancha?", ru: "Каков срок гарантии?", en: "What is the warranty period?" },
        answer: { uz: "Barcha mahsulotlarga 12 oylik rasmiy ishlab chiqaruvchi kafolati beriladi.", ru: "На все товары — 12 месяцев официальной гарантии производителя.", en: "All products come with 12 months official manufacturer warranty." },
        sort: 2,
      },
      {
        categoryId: faqCat2.id,
        question: { uz: "Mahsulotni qaytarish mumkinmi?", ru: "Можно ли вернуть товар?", en: "Can I return a product?" },
        answer: { uz: "Qabul qilingan kundan 14 kun ichida asl qadoqda qaytarib olish mumkin.", ru: "Возврат в течение 14 дней с момента получения в оригинальной упаковке.", en: "Returns accepted within 14 days of delivery in original packaging." },
        sort: 3,
      },
    ]).onConflictDoNothing();
  }

  if (faqCat3) {
    await db.insert(faqs).values([
      {
        categoryId: faqCat3.id,
        question: { uz: "PC konfigurator nima?", ru: "Что такое PC конфигуратор?", en: "What is the PC configurator?" },
        answer: { uz: "O'zingizga mos kompyuterni qismlarini tanlab yig'ib, buyurtma bering. Mutaxassislarimiz siz uchun yig'adi.", ru: "Выберите компоненты и оформите заказ — наши специалисты соберут ПК для вас.", en: "Choose your components and order — our specialists will assemble the PC for you." },
        sort: 1,
      },
      {
        categoryId: faqCat3.id,
        question: { uz: "Konfiguratorda tanlagan qismlar mos keladimi?", ru: "Совместимы ли выбранные компоненты?", en: "Are selected components compatible?" },
        answer: { uz: "Mutaxassislarimiz buyurtma kelgach moslikni tekshiradi va agar muammo bo'lsa siz bilan bog'lanadi.", ru: "Наши специалисты проверяют совместимость и свяжутся с вами при необходимости.", en: "Our specialists verify compatibility and will contact you if needed." },
        sort: 2,
      },
    ]).onConflictDoNothing();
  }

  // Hero Slides
  await db.insert(heroSlides).values([
    {
      imageUrl: "/banners/hero-gaming-pc.jpg",
      title: { uz: "Yangi avlod Gaming PClar", ru: "Gaming PC нового поколения", en: "Next-Gen Gaming PCs" },
      subtitle: { uz: "RTX 4070 Ti Super va i7-14700K bilan qurollantirilgan", ru: "На базе RTX 4070 Ti Super и i7-14700K", en: "Powered by RTX 4070 Ti Super & i7-14700K" },
      link: "/computers",
      sort: 1,
      position: "hero",
    },
    {
      imageUrl: "/banners/hero-components.jpg",
      title: { uz: "O'zing uchun PC yig'", ru: "Собери свой PC", en: "Build Your Own PC" },
      subtitle: { uz: "Konfigurator orqali ideal kompyuterni tuzib oling", ru: "Создай идеальный компьютер через конфигуратор", en: "Build your perfect PC with our configurator" },
      link: "/computers/custom",
      sort: 2,
      position: "hero",
    },
    {
      imageUrl: "/banners/banner-processors.jpg",
      title: { uz: "Intel & AMD Protsessorlar", ru: "Процессоры Intel & AMD", en: "Intel & AMD Processors" },
      subtitle: { uz: "Eng yangi 14-avlod protsessorlari stokda", ru: "Последнее поколение процессоров в наличии", en: "Latest gen processors in stock" },
      link: "/products?category=protsessorlar",
      sort: 1,
      position: "banner_1",
    },
  ]).onConflictDoNothing();

  // Home Sections
  await db.insert(homeSections).values([
    { key: "hero",          title: { uz: "Bosh Banner",        ru: "Главный баннер",   en: "Hero Banner"       }, enabled: true,  sort: 1 },
    { key: "categories",    title: { uz: "Toifalar",           ru: "Категории",        en: "Categories"        }, enabled: true,  sort: 2 },
    { key: "new_arrivals",  title: { uz: "Yangi kelganlar",    ru: "Новинки",          en: "New Arrivals"      }, enabled: true,  sort: 3 },
    { key: "best_sellers",  title: { uz: "Eng ko'p sotilgan", ru: "Бестселлеры",      en: "Best Sellers"      }, enabled: true,  sort: 4 },
    { key: "pc_builds",     title: { uz: "Tayyor PClar",       ru: "Готовые ПК",       en: "Ready-Made PCs"    }, enabled: true,  sort: 5 },
    { key: "banner_1",      title: { uz: "O'rta Banner",       ru: "Средний баннер",   en: "Middle Banner"     }, enabled: true,  sort: 6 },
    { key: "promo_products",title: { uz: "Aksiyalar",          ru: "Акции",            en: "Promotions"        }, enabled: false, sort: 7 },
  ]).onConflictDoNothing();

  console.log("[pc-seed] Muvaffaqiyatli yakunlandi!");
  done("PostgreSQL 'pc_crm_dev' bazasi real ma'lumotlar bilan to'ldirildi!");
} catch (err) {
  console.error(err);
  fail(`Seed paytida xatolik: ${String(err)}`);
} finally {
  await db.close();
}
