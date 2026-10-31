"use server";

import { revalidatePath } from "next/cache";
import { createDbOrder, updateDbOrderStatus, type CreateOrderInput } from "./orders";
import { createDbProduct, updateDbProduct, deleteDbProduct } from "./products";
import { createDbPurchase, voidDbPurchase } from "./purchases";
import { createDbSale, voidDbSale } from "./sales";
import { createDbPcOrder, updateDbPcOrderStatus } from "./pcs";
import { toggleDbUserActive } from "./users";
import { updateDbSetting } from "./settings";
import type { OrderStatus, PaymentProvider, PurchaseType, SaleSource, SaleType, PcOrderStatus } from "@ventura/db/schema/pc-crm";

export async function createOrderAction(input: CreateOrderInput) {
  try {
    const res = await createDbOrder(input);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/sales");
    revalidatePath("/products");
    return { success: true, orderId: res.orderId };
  } catch (err) {
    console.error("createOrderAction error:", err);
    return { success: false, error: String(err) };
  }
}

export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  try {
    await updateDbOrderStatus(orderId, status);
    revalidatePath("/admin/orders");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
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
  imageUrl?: string;
}) {
  try {
    if (input.id) {
      await updateDbProduct(input.id, {
        nameUz: input.nameUz,
        costPrice: input.costPrice,
        sellPrice: input.sellPrice,
        discountPercent: input.discountPercent,
        stock: input.stock,
        minStock: input.minStock,
        isNew: input.isNew,
        isHit: input.isHit,
      });
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
        slug,
      });
    }
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function deleteProductAction(id: string) {
  try {
    await deleteDbProduct(id);
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
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
    await createDbPurchase(input);
    revalidatePath("/admin/purchases");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function voidPurchaseAction(id: string) {
  try {
    await voidDbPurchase(id);
    revalidatePath("/admin/purchases");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
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
    await createDbSale(input);
    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function voidSaleAction(id: string) {
  try {
    await voidDbSale(id);
    revalidatePath("/admin/sales");
    revalidatePath("/admin/products");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
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
    await createDbPcOrder(input);
    revalidatePath("/admin/pc-orders");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function updatePcOrderStatusAction(
  id: string,
  status: PcOrderStatus,
  quotedPrice?: bigint,
  operatorNote?: string
) {
  try {
    await updateDbPcOrderStatus(id, status, quotedPrice, operatorNote);
    revalidatePath("/admin/pc-orders");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function toggleUserActiveAction(id: string) {
  try {
    await toggleDbUserActive(id);
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function saveSettingAction(key: string, value: unknown) {
  try {
    await updateDbSetting(key, value);
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
