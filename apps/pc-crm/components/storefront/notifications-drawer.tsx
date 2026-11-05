"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  PackageCheck,
  Sparkles,
  Tag,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";

export interface NotificationItem {
  id: string;
  type: "discount" | "order" | "new_product" | "system";
  title: string;
  message: string;
  link?: string;
  createdAt: string;
  isRead: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    type: "discount",
    title: "Katta kuzgi chegirmalar!",
    message: "Barcha GeForce RTX 4070 Ti SUPER videokartalariga 10% gacha maxsus chegirma eʼlon qilindi.",
    link: "/products?q=4070",
    createdAt: "10 daqiqa oldin",
    isRead: false,
  },
  {
    id: "notif-2",
    type: "new_product",
    title: "Yangi avlod PC yigʻildi",
    message: "Ventura Gaming Titan (Core i7-14700K / RTX 4070 Ti) tayyor kompyuterlar qatoriga qoʻshildi.",
    link: "/computers/ventura-gaming-titan-i7-4070",
    createdAt: "2 soat oldin",
    isRead: false,
  },
  {
    id: "notif-3",
    type: "order",
    title: "Buyurtmangiz yoʻlga chiqdi!",
    message: "ORD-2026-042 raqamli buyurtmangiz kuryerga topshirildi. Kuryer tez orada yetib boradi.",
    link: "/profile/orders",
    createdAt: "Kecha",
    isRead: true,
  },
  {
    id: "notif-4",
    type: "system",
    title: "Xizmat koʻrsatish sifati",
    message: "Kafolat muddati davomida bepul profilaktika va changdan tozalash xizmati taqdim etiladi.",
    link: "/faq",
    createdAt: "3 kun oldin",
    isRead: true,
  },
];

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsDrawer({ isOpen, onClose }: NotificationsDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC tugmasi bosilganda yopish va fon scrollini bloklash
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "discount":
        return <Tag size={16} className="text-(--warning-fg)" />;
      case "new_product":
        return <Sparkles size={16} className="text-primary" />;
      case "order":
        return <PackageCheck size={16} className="text-(--success-fg)" />;
      case "system":
        return <Bell size={16} className="text-muted-foreground" />;
    }
  };

  const content = (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Full-viewport Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* O'ngdan chiqadigan to'liq balandlikdagi panel */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-card shadow-modal border-l border-border animate-in slide-in-from-right duration-200">
        {/* Sarlavha qatori */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-control bg-primary/10 text-primary">
              <Bell size={18} />
            </div>
            <h2 className="text-base font-bold text-foreground">Bildirishnomalar</h2>
            {unreadCount > 0 && (
              <Badge tone="info" className="font-mono text-xs">
                {unreadCount} yangi
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                title="Hammasini oʻqilgan qilish"
              >
                <CheckCheck size={14} />
                Oʻqildi
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="flex h-8 w-8 items-center justify-center rounded-control text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Bildirishnomalar ro'yxati */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              <Bell size={36} className="text-muted-foreground/30 mx-auto mb-2" />
              Yangi bildirishnomalar yoʻq.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 transition-colors ${
                  n.isRead ? "bg-card hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted border border-border">
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-xs sm:text-sm text-foreground truncate">
                        {n.title}
                      </h3>
                      <span className="font-mono text-2xs text-muted-foreground shrink-0">
                        {n.createdAt}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {n.message}
                    </p>

                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={onClose}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        Batafsil koʻrish
                        <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
