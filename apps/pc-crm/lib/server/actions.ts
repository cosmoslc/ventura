"use server";

import { revalidatePath } from "next/cache";
import { createDbOrder, updateDbOrderStatus, getDbOrders, getDbUserOrders, type CreateOrderInput } from "./orders";
import { AuthorizationError, getServerSession, requireAdmin, requireUser } from "./auth";
import { createDbProduct, updateDbProduct, deleteDbProduct, getDbProducts } from "./products";
import { createDbPurchase, voidDbPurchase, getDbPurchases } from "./purchases";
import { createDbSale, voidDbSale, getDbSales } from "./sales";
import { createDbPcOrder, getDbPcBuilds, getDbPcOrders, getDbConfiguratorParts, saveDbPcBuild, sellDbPcBuild, updateDbPcOrderStatus } from "./pcs";
import { getDbUsers, toggleDbUserActive } from "./users";
import { getDbSettings, getDbShippingRates, saveDbShippingRates, updateDbSetting } from "./settings";
import type { OrderStatus, PurchaseType, SaleSource, SaleType, PcOrderStatus } from "@ventura/db/schema/pc-crm";
import { PC_COMPONENT_ROLES } from "@ventura/db/schema/pc-crm";
import { z } from "zod";
import { calcFinalPrice } from "../calc/formulas";

const idSchema = z.string().uuid();
const orderInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(9).max(24),
  region: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(500),
  paymentMethod: z.enum(["cod_operator"]),
  note: z.string().trim().max(1000).optional(),
  items: z.array(z.object({ productId: idSchema, qty: z.number().int().min(1).max(100) })).min(1).max(100),
});

function actionError(err: unknown, fallback: string) {
  return err instanceof AuthorizationError ? err.message : fallback;
}

export async function createOrderAction(input: CreateOrderInput) {
  try {
    const session = await getServerSession();
    const parsed = orderInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Buyurtma ma'lumotlari noto'g'ri" };
    const userId = session?.user?.id;
    const res = await createDbOrder({ ...parsed.data, userId });
    revalidatePath("/admin/orders");
    revalidatePath("/admin/sales");
    revalidatePath("/profile/orders");
    revalidatePath("/profile");
    revalidatePath("/products");
    return { success: true, orderId: res.orderId };
  } catch (err) {
    console.error("createOrderAction error:", err);
    return { success: false, error: actionError(err, "Buyurtma saqlanmadi. Qayta urinib ko'ring.") };
  }
}

export async function getMyOrdersAction() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: true, orders: [] };
    }
    const userOrders = await getDbUserOrders(session.user.id);
    return { success: true, orders: userOrders };
  } catch (err) {
    console.error("getMyOrdersAction error:", err);
    return { success: false, error: "Buyurtmalarni yuklab bo'lmadi", orders: [] };
  }
}

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  try {
    await requireAdmin();
    if (!idSchema.safeParse(orderId).success || !["new", "confirmed", "shipping", "delivered", "cancelled"].includes(status)) {
      return { success: false, error: "Buyurtma ma'lumotlari noto'g'ri" };
    }
    await updateDbOrderStatus(orderId, status);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    revalidatePath("/products");
    revalidatePath("/profile/orders");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Buyurtma holatini o'zgartirib bo'lmadi") };
  }
}

export async function saveProductAction(input: {
  id?: string;
  slug?: string;
  nameUz: string;
  nameRu?: string;
  categorySlug: string;
  brandName?: string;
  sku?: string;
  costPrice: bigint;
  sellPrice: bigint;
  discountPercent?: number;
  stock?: number;
  minStock?: number;
  isNew?: boolean;
  isHit?: boolean;
  isActive?: boolean;
  imageUrl?: string;
  specs?: { key: string; title: string; value: string; helpText?: string }[];
}) {
  try {
    await requireAdmin();
    const specs = z.array(z.object({
      key: z.string().trim().min(1).max(100),
      title: z.string().trim().min(1).max(200),
      value: z.string().trim().max(1000),
      helpText: z.string().trim().max(1000).optional(),
    })).max(100).safeParse(input.specs ?? []);
    if (!specs.success) return { success: false, error: "Mahsulot xususiyatlari noto'g'ri" };
    if (input.id && !idSchema.safeParse(input.id).success) return { success: false, error: "Mahsulot ID noto'g'ri" };
    if (input.nameUz.trim().length < 2 || input.nameUz.length > 200 || (input.nameRu?.length ?? 0) > 200 ||
        input.categorySlug.trim().length < 1 || input.categorySlug.length > 120 || (input.brandName?.length ?? 0) > 120 ||
        (input.sku?.length ?? 0) > 120 || (input.imageUrl?.length ?? 0) > 2000 || input.costPrice < 0n || input.sellPrice < 0n ||
        !Number.isInteger(input.discountPercent ?? 0) || (input.discountPercent ?? 0) < 0 || (input.discountPercent ?? 0) > 100 ||
        !Number.isInteger(input.stock ?? 0) || (input.stock ?? 0) < 0 ||
        !Number.isInteger(input.minStock ?? 2) || (input.minStock ?? 2) < 0 ||
        (input.isActive !== undefined && typeof input.isActive !== "boolean")) {
      return { success: false, error: "Mahsulot ma'lumotlari noto'g'ri" };
    }
    if (input.id) {
      const updated = await updateDbProduct(input.id, {
        nameUz: input.nameUz,
        nameRu: input.nameRu,
        categorySlug: input.categorySlug,
        brandName: input.brandName,
        sku: input.sku,
        costPrice: input.costPrice,
        sellPrice: input.sellPrice,
        discountPercent: input.discountPercent,
        stock: input.stock,
        minStock: input.minStock,
        isNew: input.isNew,
        isHit: input.isHit,
        isActive: input.isActive,
        imageUrl: input.imageUrl,
        specs: specs.data,
      });
      if (!updated) return { success: false, error: "Mahsulot topilmadi" };
    } else {
      const slug =
        input.slug ||
        input.nameUz
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
      await createDbProduct({
        ...input,
        specs: specs.data,
        slug,
      });
    }
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Mahsulotni saqlab bo'lmadi") };
  }
}

export async function deleteProductAction(id: string) {
  try {
    await requireAdmin();
    if (!idSchema.safeParse(id).success) return { success: false, error: "Mahsulot ID noto'g'ri" };
    await deleteDbProduct(id);
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Mahsulotni o'chirib bo'lmadi") };
  }
}

export async function savePurchaseAction(input: {
  productId: string;
  type: PurchaseType;
  qty: number;
  totalCost: bigint;
  unitCost: bigint;
  supplier?: string;
  purchasedAt?: string;
  note?: string;
}) {
  try {
    await requireAdmin();
    if (!idSchema.safeParse(input.productId).success || !Number.isInteger(input.qty) || input.qty < 1 || input.qty > 100000 ||
        input.totalCost < 0n || input.unitCost < 0n) return { success: false, error: "Kirim ma'lumotlari noto'g'ri" };
    await createDbPurchase(input);
    revalidatePath("/admin/purchases");
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    revalidatePath("/products");
    revalidatePath("/computers/custom");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Kirimni saqlab bo'lmadi") };
  }
}

export async function voidPurchaseAction(id: string) {
  try {
    await requireAdmin();
    if (!idSchema.safeParse(id).success) return { success: false, error: "Kirim ID noto'g'ri" };
    await voidDbPurchase(id);
    revalidatePath("/admin/purchases");
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    revalidatePath("/products");
    revalidatePath("/computers/custom");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Kirimni bekor qilib bo'lmadi") };
  }
}

export async function saveSaleAction(input: {
  source: SaleSource;
  type: SaleType;
  productId?: string;
  productName: string;
  buyerName: string;
  buyerPhone: string;
  qty: number;
  listPrice: bigint;
  soldPrice: bigint;
  costSnapshot: bigint;
  profit: bigint;
  soldAt?: string;
}) {
  try {
    await requireAdmin();
    if (input.productId && !idSchema.safeParse(input.productId).success) return { success: false, error: "Mahsulot ID noto'g'ri" };
    if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 100000 || input.listPrice < 0n || input.soldPrice < 0n || input.costSnapshot < 0n) {
      return { success: false, error: "Sotuv ma'lumotlari noto'g'ri" };
    }
    await createDbSale(input);
    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Sotuvni saqlab bo'lmadi") };
  }
}

export async function voidSaleAction(id: string) {
  try {
    await requireAdmin();
    if (!idSchema.safeParse(id).success) return { success: false, error: "Sotuv ID noto'g'ri" };
    await voidDbSale(id);
    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Sotuvni bekor qilib bo'lmadi") };
  }
}

export async function savePcOrderAction(input: {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  customerNote?: string;
  componentIds: { role: string; productId: string }[];
}) {
  try {
    const user = await requireUser();
    const schema = z.object({
      customerName: z.string().trim().min(2).max(120),
      customerPhone: z.string().trim().min(9).max(24),
      deliveryAddress: z.string().trim().min(5).max(500),
      customerNote: z.string().trim().max(1000).optional(),
      componentIds: z.array(z.object({ role: z.enum(PC_COMPONENT_ROLES), productId: idSchema })).min(1).max(8),
    }).safeParse(input);
    if (!schema.success) return { success: false, error: "PC buyurtmasi ma'lumotlari noto'g'ri" };
    const order = await createDbPcOrder({ ...schema.data, userId: user.id });
    revalidatePath("/admin/pc-orders");
    return { success: true, orderNumber: `PCO-${order.id.slice(0, 8).toUpperCase()}` };
  } catch (err) {
    return { success: false, error: actionError(err, "PC buyurtmasini saqlab bo'lmadi") };
  }
}

export async function updatePcOrderStatusAction(
  id: string,
  status: PcOrderStatus,
  quotedPrice?: bigint,
  operatorNote?: string
) {
  try {
    await requireAdmin();
    if (!idSchema.safeParse(id).success || !["new", "reviewing", "quoted", "confirmed", "assembling", "ready", "delivered", "cancelled"].includes(status)) {
      return { success: false, error: "PC buyurtmasi ma'lumotlari noto'g'ri" };
    }
    if ((quotedPrice !== undefined && (quotedPrice < 0n || quotedPrice > 1_000_000_000_000_000n)) ||
        (operatorNote !== undefined && (typeof operatorNote !== "string" || operatorNote.length > 2000))) {
      return { success: false, error: "Taklif narxi yoki operator izohi noto'g'ri" };
    }
    await updateDbPcOrderStatus(id, status, quotedPrice, operatorNote);
    revalidatePath("/admin/pc-orders");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    revalidatePath("/admin");
    revalidatePath("/products");
    revalidatePath("/computers");
    revalidatePath("/computers/custom");
    revalidatePath("/profile/orders");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "PC buyurtma holatini o'zgartirib bo'lmadi") };
  }
}

export async function toggleUserActiveAction(id: string) {
  try {
    const admin = await requireAdmin();
    if (!idSchema.safeParse(id).success) return { success: false, error: "Foydalanuvchi ID noto'g'ri" };
    if (id === admin.id) return { success: false, error: "O'z hisobingizni bloklay olmaysiz" };
    const updated = await toggleDbUserActive(id);
    if (!updated) return { success: false, error: "Foydalanuvchi topilmadi yoki mijoz hisobi emas" };
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Foydalanuvchi holatini o'zgartirib bo'lmadi") };
  }
}

export async function saveSettingAction(key: string, value: unknown) {
  try {
    await requireAdmin();
    if (!/^[a-z][a-z0-9_]{1,79}$/.test(key)) return { success: false, error: "Sozlama kaliti noto'g'ri" };
    await updateDbSetting(key, value);
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Sozlamani saqlab bo'lmadi") };
  }
}

export async function getAdminProductsAction() {
  try {
    await requireAdmin();
    return { success: true, products: await getDbProducts({ includeInactive: true }) };
  } catch (err) {
    return { success: false, error: actionError(err, "Mahsulotlarni yuklab bo'lmadi"), products: [] };
  }
}

export async function getAdminPurchasesAction() {
  try {
    await requireAdmin();
    return { success: true, purchases: await getDbPurchases() };
  } catch (err) {
    return { success: false, error: actionError(err, "Kirimlarni yuklab bo'lmadi"), purchases: [] };
  }
}

export async function getAdminSalesAction() {
  try {
    await requireAdmin();
    return { success: true, sales: await getDbSales() };
  } catch (err) {
    return { success: false, error: actionError(err, "Sotuvlarni yuklab bo'lmadi"), sales: [] };
  }
}

export async function getAdminOrdersAction() {
  try {
    await requireAdmin();
    return { success: true, orders: await getDbOrders() };
  } catch (err) {
    return { success: false, error: actionError(err, "Buyurtmalarni yuklab bo'lmadi"), orders: [] };
  }
}

export async function getAdminPcOrdersAction() {
  try {
    await requireAdmin();
    return { success: true, orders: await getDbPcOrders() };
  } catch (err) {
    return { success: false, error: actionError(err, "PC buyurtmalarini yuklab bo'lmadi"), orders: [] };
  }
}

export async function getAdminPcBuildsAction() {
  try {
    await requireAdmin();
    return { success: true, builds: await getDbPcBuilds() };
  } catch (err) {
    return { success: false, error: actionError(err, "PC buildlarni yuklab bo'lmadi"), builds: [] };
  }
}

export async function getAdminConfiguratorPartsAction() {
  try {
    await requireAdmin();
    return { success: true, parts: await getDbConfiguratorParts() };
  } catch (err) {
    return { success: false, error: actionError(err, "Komponentlarni yuklab bo'lmadi"), parts: [] };
  }
}

export async function savePcBuildAction(input: {
  id?: string;
  slug: string;
  name: string;
  images: string[];
  sellPrice: bigint;
  discountPercent: number;
  status: "available" | "hidden";
  components: { role: (typeof PC_COMPONENT_ROLES)[number]; productId: string; qty: number }[];
  specs: { key: string; title: string; value: string; filterable?: boolean; helpTitle?: string; helpText?: string }[];
}) {
  try {
    await requireAdmin();
    const schema = z.object({
      id: idSchema.optional(),
      slug: z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      name: z.string().trim().min(2).max(200),
      images: z.array(z.string().trim().min(1).max(2000)).max(10),
      sellPrice: z.bigint().min(0n).max(1_000_000_000_000_000n),
      discountPercent: z.number().int().min(0).max(100),
      status: z.enum(["available", "hidden"]),
      components: z.array(z.object({ role: z.enum(PC_COMPONENT_ROLES), productId: idSchema, qty: z.number().int().min(1).max(100) })).min(1).max(40),
      specs: z.array(z.object({ key: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(200), value: z.string().trim().max(1000), filterable: z.boolean().optional(), helpTitle: z.string().max(200).optional(), helpText: z.string().max(1000).optional() })).max(100),
    }).safeParse(input);
    if (!schema.success) return { success: false, error: "PC build ma'lumotlari noto'g'ri" };
    await saveDbPcBuild(schema.data);
    revalidatePath("/admin/pcs");
    revalidatePath("/admin/products");
    revalidatePath("/computers");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "PC buildni saqlab bo'lmadi") };
  }
}

export async function sellPcBuildAction(input: { id: string; buyerName: string; buyerPhone: string; soldAt: string }) {
  try {
    await requireAdmin();
    const schema = z.object({
      id: idSchema,
      buyerName: z.string().trim().min(2).max(120),
      buyerPhone: z.string().trim().min(9).max(24),
      soldAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).safeParse(input);
    if (!schema.success) return { success: false, error: "PC sotuv ma'lumotlari noto'g'ri" };
    await sellDbPcBuild(schema.data);
    revalidatePath("/admin/pcs");
    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    revalidatePath("/computers");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "PC sotuvini saqlab bo'lmadi") };
  }
}

export async function getAdminUsersAction() {
  try {
    await requireAdmin();
    return { success: true, users: await getDbUsers() };
  } catch (err) {
    return { success: false, error: actionError(err, "Foydalanuvchilarni yuklab bo'lmadi"), users: [] };
  }
}

export async function getAdminSettingsAction() {
  try {
    await requireAdmin();
    const [settings, shippingRates] = await Promise.all([getDbSettings(), getDbShippingRates(true)]);
    return { success: true, settings, shippingRates };
  } catch (err) {
    return { success: false, error: actionError(err, "Sozlamalarni yuklab bo'lmadi"), settings: {}, shippingRates: [] };
  }
}

export async function saveShippingRatesAction(rates: { region: string; price: bigint; enabled: boolean; estimatedDays?: string }[]) {
  try {
    await requireAdmin();
    const schema = z.array(z.object({
      region: z.string().trim().min(2).max(120),
      price: z.bigint().min(0n).max(1_000_000_000_000n),
      enabled: z.boolean(),
      estimatedDays: z.string().trim().max(60).optional(),
    })).max(200);
    const parsed = schema.safeParse(rates);
    if (!parsed.success) return { success: false, error: "Yetkazib berish tariflari noto'g'ri" };
    await saveDbShippingRates(parsed.data);
    revalidatePath("/admin/settings");
    revalidatePath("/checkout");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionError(err, "Yetkazib berish tariflarini saqlab bo'lmadi") };
  }
}

export async function getStorefrontProductsAction() {
  try {
    const list = await getDbProducts();
    return {
      success: true,
      products: list.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        brandName: p.brandName,
        categorySlug: p.categorySlug,
        imageUrl: p.imageUrl,
        price: Number(calcFinalPrice(p.sellPrice, p.discountPercent)),
        originalPrice: p.discountPercent > 0 ? Number(p.sellPrice) : undefined,
        discountPercent: p.discountPercent,
        stock: p.availableStock,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        isNew: p.isNew,
        isHit: p.isHit,
        variants: [],
      })),
    };
  } catch (err) {
    console.error("getStorefrontProductsAction error:", err);
    return { success: false, error: "Mahsulotlarni yuklab bo'lmadi", products: [] };
  }
}

export async function getStorefrontPcBuildsAction() {
  try {
    const builds = await getDbPcBuilds({ status: "available" });
    return {
      success: true,
      builds: builds.map(({ id, slug, name, images, sellPrice, discountPercent, status, ratingAvg, ratingCount, cpu, gpu, ram, storage }) => ({
        id, slug, name, images, sellPrice, discountPercent, status, ratingAvg, ratingCount, cpu, gpu, ram, storage,
      })),
    };
  } catch (err) {
    console.error("getStorefrontPcBuildsAction error:", err);
    return { success: false, error: "Kompyuterlarni yuklab bo'lmadi", builds: [] };
  }
}

export async function getStorefrontConfiguratorPartsAction() {
  try {
    const parts = await getDbConfiguratorParts();
    return {
      success: true,
      parts: parts.filter((part) => part.stock > 0).map(({ id, role, roleLabel, name, brand, price, stock, imageUrl, specsSummary, tdpWatts }) => ({
        id, role, roleLabel, name, brand, price, stock, imageUrl, specsSummary, tdpWatts,
      })),
    };
  } catch (err) {
    console.error("getStorefrontConfiguratorPartsAction error:", err);
    return { success: false, error: "Konfigurator qismlarini yuklab bo'lmadi", parts: [] };
  }
}

export async function getStoreBrandingAction() {
  try {
    const { getStoreBranding } = await import("./branding");
    return { success: true, branding: await getStoreBranding() };
  } catch (err) {
    console.error("getStoreBrandingAction error:", err);
    return { success: false, error: "Branding yuklab bo'lmadi" };
  }
}
