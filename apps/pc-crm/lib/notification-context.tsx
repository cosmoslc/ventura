"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getStorefrontNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./server/actions";
import type { DbNotificationItem } from "./server/notifications";

interface NotificationContextType {
  notifications: DbNotificationItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const STORAGE_KEY = "venturapc_read_notifs";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<DbNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Mehmon yoki mahalliy o'qilgan ID lar to'plami
  const getLocalReadIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      // ignore
    }
    return new Set();
  };

  const saveLocalReadIds = (ids: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      // ignore
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getStorefrontNotificationsAction();
      if (res.success && res.notifications) {
        const localRead = getLocalReadIds();

        // Serverdan kelgan ma'lumotni mahalliy o'qilganlar bilan birlashtirish
        const merged = res.notifications.map((item) => ({
          ...item,
          isRead: item.isRead || localRead.has(item.id),
        }));

        setNotifications(merged);
      }
    } catch (e) {
      console.error("Bildirishnomalarni yuklashda xatolik:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Bitta bildirishnomani o'qilgan deb belgilash
  const markAsRead = async (id: string) => {
    // Optimistic UI: darhol holatni o'zgartirish
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    // Mahalliy xotiraga saqlash
    const local = getLocalReadIds();
    local.add(id);
    saveLocalReadIds(local);

    // Serverga yuborish
    try {
      await markNotificationReadAction(id);
    } catch (e) {
      console.error("markNotificationReadAction xatoligi:", e);
    }
  };

  // Hammasini o'qilgan qilish
  const markAllAsRead = async () => {
    // Optimistic UI: darhol unreadCount = 0 bo'ladi
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    // Mahalliy xotiraga barcha ID larni saqlash
    const local = getLocalReadIds();
    for (const n of notifications) {
      local.add(n.id);
    }
    saveLocalReadIds(local);

    // Serverga yuborish
    try {
      await markAllNotificationsReadAction();
    } catch (e) {
      console.error("markAllNotificationsReadAction xatoligi:", e);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refreshNotifications: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
