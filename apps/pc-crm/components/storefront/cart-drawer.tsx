"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { useCart } from "@/lib/cart-context";
import { formatMoney } from "@/lib/format";

export function CartDrawer() {
  const {
    items,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    updateQty,
    removeItem,
    subtotal,
    shipping,
    total,
  } = useCart();

  if (!isCartDrawerOpen) return null;

  const freeShippingTarget = 1_000_000n;
  const remainingForFreeShipping =
    subtotal < freeShippingTarget ? freeShippingTarget - subtotal : 0n;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartDrawerOpen(false)}
      />

      {/* Drawer Panel */}
      <div className="relative flex h-full w-full max-w-md flex-col justify-between bg-card p-5 text-foreground shadow-2xl transition-transform">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary" />
              <h2 className="text-base font-black">Xarid savatchasi</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {items.length} xil
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Bepul yetkazish indikatori */}
          {items.length > 0 && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
              {remainingForFreeShipping > 0n ? (
                <p className="text-muted-foreground">
                  Yana <span className="font-bold text-primary">{formatMoney(remainingForFreeShipping)}</span> xarid qiling va <span className="font-semibold text-foreground">bepul yetkazib berish</span>ga ega boʻling!
                </p>
              ) : (
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  🎉 Tabriklaymiz! Siz uchun yetkazib berish mutlaqo bepul!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Mahsulotlar ro'yxati (Scrollable) */}
        <div className="my-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingBag size={48} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm font-bold text-foreground">Savatchangiz hozircha boʻsh</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                Katalogdan oʻzingizga yoqqan mahsulotlarni tanlang
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3 text-xs shadow-xs"
              >
                {/* Rasm */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-white p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-contain"
                  />
                </div>

                {/* Ma'lumotlar */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground line-clamp-1">{item.name}</p>
                  {item.colorName && (
                    <p className="text-[11px] text-muted-foreground">Rang: {item.colorName}</p>
                  )}
                  <p className="mt-1 font-black text-foreground">{formatMoney(item.price)}</p>

                  {/* Miqdor hisoblagich (+/-) */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded-md border border-border bg-background">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center font-bold text-xs">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:text-rose-500 p-1 transition-colors"
                      title="Oʻchirish"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer va hisob-kitob */}
        {items.length > 0 && (
          <div className="border-t border-border pt-4 text-xs space-y-3">
            <div className="space-y-1.5 text-muted-foreground">
              <div className="flex justify-between">
                <span>Oraliq summa:</span>
                <span className="font-bold text-foreground">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Yetkazib berish:</span>
                <span className="font-bold text-foreground">
                  {shipping === 0n ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Bepul</span>
                  ) : (
                    formatMoney(shipping)
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/70 pt-2 text-sm font-black text-foreground">
                <span>Jami toʻlov:</span>
                <span className="text-primary font-black">{formatMoney(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href="/cart"
                onClick={() => setIsCartDrawerOpen(false)}
                className="w-full"
              >
                <Button variant="ghost" size="sm" className="w-full text-xs font-semibold">
                  Savatchaga
                </Button>
              </Link>

              <Link
                href="/checkout"
                onClick={() => setIsCartDrawerOpen(false)}
                className="w-full"
              >
                <Button variant="primary" size="sm" className="w-full gap-1 text-xs font-bold shadow-md">
                  Buyurtmaga <ArrowRight size={13} />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
