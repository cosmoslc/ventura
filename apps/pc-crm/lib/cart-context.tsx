"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { calcFinalPrice, calcOrderTotal } from "./calc/formulas";
import { useSession } from "./auth-client";

export interface CartItem {
  id: string; // unique item key: `${productId}_${variantId ?? 'default'}`
  productId: string;
  variantId?: string;
  name: string;
  brandName?: string;
  price: bigint;
  originalPrice?: bigint;
  imageUrl: string;
  colorName?: string;
  colorHex?: string;
  qty: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id" | "qty">, qty?: number) => void;
  removeItem: (itemId: string) => void;
  updateQty: (itemId: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  subtotal: bigint;
  shipping: bigint;
  total: bigint;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "venturapc_cart_v1";
const FREE_SHIPPING_LIMIT = 1_000_000n; // 1 mln so'mdan oshsa bepul
const DEFAULT_SHIPPING_FEE = 35_000n;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "guest";
  const storageKey = `venturapc_cart_${userId}`;

  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentKey, setCurrentKey] = useState<string>("");
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Foydalanuvchi o'zgarganda (A kirsa, chiqsa, yoki B kirsa) uning savatchasini yuklash
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const restored = parsed.map((item: any) => ({
            ...item,
            price: BigInt(item.price),
            originalPrice: item.originalPrice ? BigInt(item.originalPrice) : undefined,
          }));
          setItems(restored);
        } else {
          setItems([]);
        }
      } else {
        // Agar foydalanuvchi tizimga kirsa va mehmon savatchasida mahsulot bo'lsa, ularni ko'chirish
        if (userId !== "guest") {
          const guestStored =
            localStorage.getItem("venturapc_cart_guest") ||
            localStorage.getItem(CART_STORAGE_KEY);
          if (guestStored) {
            const parsed = JSON.parse(guestStored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const restored = parsed.map((item: any) => ({
                ...item,
                price: BigInt(item.price),
                originalPrice: item.originalPrice ? BigInt(item.originalPrice) : undefined,
              }));
              setItems(restored);
              localStorage.removeItem("venturapc_cart_guest");
              localStorage.removeItem(CART_STORAGE_KEY);
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

  // Faqat joriy hisob kalitiga saqlash
  useEffect(() => {
    if (!isLoaded || currentKey !== storageKey) return;
    try {
      const serialized = items.map((i) => ({
        ...i,
        price: i.price.toString(),
        originalPrice: i.originalPrice?.toString(),
      }));
      localStorage.setItem(storageKey, JSON.stringify(serialized));
    } catch {
      // Ignored
    }
  }, [items, isLoaded, currentKey, storageKey]);

  const addItem = (item: Omit<CartItem, "id" | "qty">, qty = 1) => {
    const id = `${item.productId}_${item.variantId ?? "default"}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i));
      }
      return [...prev, { ...item, id, qty }];
    });
    setIsCartDrawerOpen(true);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty } : i)));
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartCount = items.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * BigInt(i.qty), 0n);
  const shipping = subtotal === 0n || subtotal >= FREE_SHIPPING_LIMIT ? 0n : DEFAULT_SHIPPING_FEE;
  const total = calcOrderTotal({ subtotal, shipping });

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        cartCount,
        subtotal,
        shipping,
        total,
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        isSearchOpen,
        setIsSearchOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart CartProvider ichida ishlatilishi kerak");
  }
  return ctx;
}
