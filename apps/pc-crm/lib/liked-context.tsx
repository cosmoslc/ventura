"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "./auth-client";

export interface LikedItem {
  id: string;
  type: "product" | "pc";
  name: string;
  slug: string;
  imageUrl: string;
  price: bigint | number;
  originalPrice?: bigint | number;
  brandName?: string;
  categoryName?: string;
  specs?: string;
  ratingAvg?: number;
  ratingCount?: number;
  isAvailable?: boolean;
}

interface LikedContextType {
  items: LikedItem[];
  likedIds: Set<string>;
  likedCount: number;
  isLiked: (id: string) => boolean;
  toggleLike: (item: LikedItem | { id: string; type?: "product" | "pc"; [key: string]: any }) => void;
  removeLiked: (id: string) => void;
  clearLiked: () => void;
  likedProducts: LikedItem[];
  likedBuilds: LikedItem[];
}

const LikedContext = createContext<LikedContextType | null>(null);

export function LikedProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "guest";
  const storageKey = `venturapc_liked_${userId}`;

  const [items, setItems] = useState<LikedItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentKey, setCurrentKey] = useState<string>("");

  // Foydalanuvchi o'zgarganda uning shaxsiy sevimlilarini yuklash
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        } else {
          setItems([]);
        }
      } else {
        // Agar foydalanuvchi yangi kirdi va mehmon sevimlisida narsalar bo'lsa
        if (userId !== "guest") {
          const guestStored = localStorage.getItem("venturapc_liked_guest");
          if (guestStored) {
            const parsed = JSON.parse(guestStored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setItems(parsed);
              localStorage.removeItem("venturapc_liked_guest");
              setCurrentKey(storageKey);
              setIsLoaded(true);
              return;
            }
          }
        }
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setCurrentKey(storageKey);
      setIsLoaded(true);
    }
  }, [storageKey, userId]);

  // O'zgarishlarni har bir profil kalitiga alohida saqlash
  useEffect(() => {
    if (!isLoaded || currentKey !== storageKey) return;
    try {
      const serialized = items.map((i) => ({
        ...i,
        price: typeof i.price === "bigint" ? i.price.toString() : i.price,
        originalPrice:
          typeof i.originalPrice === "bigint"
            ? i.originalPrice.toString()
            : i.originalPrice,
      }));
      localStorage.setItem(storageKey, JSON.stringify(serialized));
    } catch {
      // Ignored
    }
  }, [items, isLoaded, currentKey, storageKey]);

  const likedIds = new Set(items.map((i) => i.id));

  const isLiked = (id: string) => likedIds.has(id);

  const toggleLike = (item: any) => {
    if (!item?.id) return;
    setItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      }
      const newItem: LikedItem = {
        id: item.id,
        type: item.type || (item.slug?.includes("pc") || item.specs ? "pc" : "product"),
        name: item.name || "Mahsulot",
        slug: item.slug || item.id,
        imageUrl: item.imageUrl || "/placeholder.png",
        price: item.price ?? 0,
        originalPrice: item.originalPrice,
        brandName: item.brandName,
        categoryName: item.categoryName,
        specs: item.specs,
        ratingAvg: item.ratingAvg,
        ratingCount: item.ratingCount,
        isAvailable: item.isAvailable ?? true,
      };
      return [...prev, newItem];
    });
  };

  const removeLiked = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearLiked = () => {
    setItems([]);
  };

  const likedProducts = items.filter((i) => i.type === "product");
  const likedBuilds = items.filter((i) => i.type === "pc");

  return (
    <LikedContext.Provider
      value={{
        items,
        likedIds,
        likedCount: items.length,
        isLiked,
        toggleLike,
        removeLiked,
        clearLiked,
        likedProducts,
        likedBuilds,
      }}
    >
      {children}
    </LikedContext.Provider>
  );
}

export function useLiked() {
  const ctx = useContext(LikedContext);
  if (!ctx) {
    throw new Error("useLiked LikedProvider ichida ishlatilishi kerak");
  }
  return ctx;
}
