import { describe, expect, it } from "vitest";
import {
  findPendingOrderNotifications,
  getDaysUntilDue,
  getOrderStatus,
  isOrderDueSoon,
  isOrderNeedsAttention,
  type OrderItem,
} from "./orders";

describe("orders calculation and reminders module (SAWMILL-TAHLIL 10-qism)", () => {
  describe("getOrderStatus", () => {
    it("bajarilgan zakaz har doim 'completed' qaytaradi", () => {
      const status = getOrderStatus({ quantity: 100, completedAt: new Date() }, 50);
      expect(status).toBe("completed");
    });

    it("omborda zakaz miqdoridan yetarli yoki ko'p bo'lsa 'ready' qaytaradi", () => {
      expect(getOrderStatus({ quantity: 100, completedAt: null }, 100)).toBe("ready");
      expect(getOrderStatus({ quantity: 100, completedAt: null }, 150)).toBe("ready");
    });

    it("omborda zakaz miqdoridan kam bo'lsa 'pending' qaytaradi", () => {
      expect(getOrderStatus({ quantity: 100, completedAt: null }, 99)).toBe("pending");
      expect(getOrderStatus({ quantity: 100, completedAt: null }, 0)).toBe("pending");
    });
  });

  describe("getDaysUntilDue and isOrderDueSoon", () => {
    const today = new Date("2026-10-24T10:00:00Z");

    it("muddatgacha kunlarni to'g'ri hisoblaydi", () => {
      expect(getDaysUntilDue("2026-10-24", today)).toBe(0);
      expect(getDaysUntilDue("2026-10-25", today)).toBe(1);
      expect(getDaysUntilDue("2026-10-26", today)).toBe(2);
      expect(getDaysUntilDue("2026-10-27", today)).toBe(3);
      expect(getDaysUntilDue("2026-10-23", today)).toBe(-1); // o'tib ketgan
    });

    it("2 kun yoki undan kam qolgan yoki o'tib ketgan zakazlarni yaqin deb belgilaydi", () => {
      expect(isOrderDueSoon("2026-10-26", today)).toBe(true); // 2 kun qoldi
      expect(isOrderDueSoon("2026-10-25", today)).toBe(true); // 1 kun qoldi
      expect(isOrderDueSoon("2026-10-24", today)).toBe(true); // bugun
      expect(isOrderDueSoon("2026-10-22", today)).toBe(true); // kechikkan
      expect(isOrderDueSoon("2026-10-27", today)).toBe(false); // 3 kun qoldi
      expect(isOrderDueSoon(null, today)).toBe(false);
    });
  });

  describe("isOrderNeedsAttention", () => {
    const today = new Date("2026-10-24T10:00:00Z");

    it("bajarilgan zakaz diqqat talab qilmaydi", () => {
      const order: OrderItem = {
        id: "1",
        terakId: "t1",
        materialId: "m1",
        quantity: 100,
        customerName: "Ali",
        completedAt: new Date(),
        dueDate: "2026-10-24",
      };
      expect(isOrderNeedsAttention(order, 200, today)).toBe(false);
    });

    it("tayyor zakaz diqqat ro'yxatiga kiradi", () => {
      const order: OrderItem = {
        id: "1",
        terakId: "t1",
        materialId: "m1",
        quantity: 100,
        customerName: "Ali",
        completedAt: null,
        dueDate: "2026-11-01", // uzoq muddat
      };
      expect(isOrderNeedsAttention(order, 100, today)).toBe(true);
    });

    it("muddati yaqin zakaz (omborda hali tayyor bo'lmasa ham) diqqat ro'yxatiga kiradi", () => {
      const order: OrderItem = {
        id: "1",
        terakId: "t1",
        materialId: "m1",
        quantity: 100,
        customerName: "Ali",
        completedAt: null,
        dueDate: "2026-10-25", // 1 kun qoldi
      };
      expect(isOrderNeedsAttention(order, 20, today)).toBe(true);
    });
  });

  describe("findPendingOrderNotifications", () => {
    const today = new Date("2026-10-24T10:00:00Z");

    it("faqat hali bildirilmagan tayyor va muddati yaqin zakazlarga eslatma beradi", () => {
      const orders: OrderItem[] = [
        {
          id: "o1",
          terakId: "t1",
          materialId: "m1",
          quantity: 50,
          customerName: "Sobir",
          completedAt: null,
          dueDate: "2026-10-30",
          readyNotifiedAt: null,
        },
        {
          id: "o2",
          terakId: "t1",
          materialId: "m1",
          quantity: 200,
          customerName: "Vali",
          completedAt: null,
          dueDate: "2026-10-25",
          dueNotifiedAt: null,
        },
        {
          id: "o3",
          terakId: "t1",
          materialId: "m1",
          quantity: 50,
          customerName: "G'ani",
          completedAt: null,
          readyNotifiedAt: new Date(), // allaqachon eslatilgan
        },
      ];

      const stockMap = { m1: 80 };
      const materialNames = { m1: "Vassa" };

      const notifs = findPendingOrderNotifications(orders, stockMap, materialNames, today);

      expect(notifs).toHaveLength(2);
      expect(notifs[0]).toMatchObject({
        orderId: "o1",
        type: "ready",
        customerName: "Sobir",
      });
      expect(notifs[1]).toMatchObject({
        orderId: "o2",
        type: "due_soon",
        customerName: "Vali",
      });
    });
  });
});
