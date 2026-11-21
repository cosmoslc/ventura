/**
 * Sawmill zakazlar va eslatmalar hisob-kitobi moduli.
 * SAWMILL-TAHLIL 10-bo'limi asosida.
 */

export type OrderStatus = "completed" | "ready" | "pending";

export interface OrderItem {
  id: string;
  terakId: string;
  materialId: string;
  quantity: number;
  customerName: string;
  phone?: string | null;
  address?: string | null;
  dueDate?: string | null; // YYYY-MM-DD
  completedAt?: Date | string | null;
  readyNotifiedAt?: Date | string | null;
  dueNotifiedAt?: Date | string | null;
}

/**
 * Zakaz holatini aniqlaydi.
 * - Bajarilgan: completedAt mavjud bo'lsa
 * - Tayyor: omborda yetarli qoldiq bo'lsa (terak qoldig'i >= zakaz miqdori)
 * - Kutilmoqda: omborda qoldiq yetarli bo'lmasa
 */
export function getOrderStatus(order: Pick<OrderItem, "quantity" | "completedAt">, currentStock: number): OrderStatus {
  if (order.completedAt) {
    return "completed";
  }
  if (currentStock >= order.quantity) {
    return "ready";
  }
  return "pending";
}

/**
 * Berilgan sana (YYYY-MM-DD) bugungi kundan necha kun uzoqlikda ekanini hisoblaydi.
 * Masalan, bugun 24-oktyabr, muddat 25-oktyabr bo'lsa: 1 kun.
 * O'tib ketgan bo'lsa: manfiy son (masalan -1).
 */
export function getDaysUntilDue(dueDateStr: string, today: Date = new Date()): number {
  const parts = dueDateStr.split("-").map(Number);
  if (parts.length < 3 || parts.some((p) => Number.isNaN(p))) return 0;
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const targetDate = new Date(y, m - 1, d);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = targetDate.getTime() - todayDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Zakaz muddati yaqinlashganmi (<= 2 kun, o'tib ketganlari ham).
 */
export function isOrderDueSoon(dueDateStr: string | null | undefined, today: Date = new Date()): boolean {
  if (!dueDateStr) return false;
  const days = getDaysUntilDue(dueDateStr, today);
  return days <= 2;
}

/**
 * Bosh sahifadagi "Diqqat talab zakazlar":
 * Bajarilmagan va (omborda tayyor yoki muddati yaqin/o'tgan).
 */
export function isOrderNeedsAttention(order: OrderItem, currentStock: number, today: Date = new Date()): boolean {
  if (order.completedAt) return false;
  const status = getOrderStatus(order, currentStock);
  const dueSoon = isOrderDueSoon(order.dueDate, today);
  return status === "ready" || dueSoon;
}

export interface OrderNotificationItem {
  orderId: string;
  type: "ready" | "due_soon";
  customerName: string;
  materialName?: string;
  dueDate?: string | null;
  messageUz: string;
  messageRu: string;
}

/**
 * Eslatma berilishi kerak bo'lgan zakazlarni topadi (har biriga bir martadan).
 * - "material tayyor" (readyNotifiedAt bo'lmasa)
 * - "muddat yaqin" (dueNotifiedAt bo'lmasa va 0-2 kun qolgan bo'lsa)
 */
export function findPendingOrderNotifications(
  orders: OrderItem[],
  stockByMaterialId: Record<string, number>,
  materialNames: Record<string, string> = {},
  today: Date = new Date(),
): OrderNotificationItem[] {
  const notifications: OrderNotificationItem[] = [];

  for (const order of orders) {
    if (order.completedAt) continue;

    const stock = stockByMaterialId[order.materialId] ?? 0;
    const status = getOrderStatus(order, stock);
    const matName = materialNames[order.materialId] ?? "Material";

    // 1. Material tayyor eslatmasi
    if (status === "ready" && !order.readyNotifiedAt) {
      notifications.push({
        orderId: order.id,
        type: "ready",
        customerName: order.customerName,
        materialName: matName,
        dueDate: order.dueDate,
        messageUz: `${order.customerName} uchun "${matName}" zakazi tayyor!`,
        messageRu: `Заказ "${matName}" для ${order.customerName} готов!`,
      });
    }

    // 2. Muddat yaqinlashmoqda eslatmasi (0-2 kun yoki muddati o'tgan)
    if (isOrderDueSoon(order.dueDate, today) && !order.dueNotifiedAt) {
      const days = order.dueDate ? getDaysUntilDue(order.dueDate, today) : 0;
      const daysTextUz = days < 0 ? `${Math.abs(days)} kun kechikdi` : `${days} kun qoldi`;
      const daysTextRu = days < 0 ? `просрочен на ${Math.abs(days)} дн.` : `осталось ${days} дн.`;

      notifications.push({
        orderId: order.id,
        type: "due_soon",
        customerName: order.customerName,
        materialName: matName,
        dueDate: order.dueDate,
        messageUz: `${order.customerName} zakazi muddati yaqin (${daysTextUz})!`,
        messageRu: `Срок заказа для ${order.customerName} приближается (${daysTextRu})!`,
      });
    }
  }

  return notifications;
}
