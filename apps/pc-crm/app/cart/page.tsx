"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { useCart } from "@/lib/cart-context";
import { formatMoney } from "@/lib/format";
import { useFinancialMode } from "@/lib/store-context";

export default function CartPage() {
  const isFinancial = useFinancialMode();
  const { items, updateQty, removeItem, clearCart, subtotal, shipping, total } = useCart();

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-[var(--storefront-max-w,1320px)] flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-foreground sm:text-3xl">Xarid savatchasi</h1>
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
              {items.length} xil mahsulot
            </span>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-(--danger-fg) hover:underline"
            >
              Savatchani tozalash
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex h-80 flex-col items-center justify-center text-center rounded-modal border border-border bg-card p-6">
            <ShoppingBag size={54} className="text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-bold text-foreground">Savatchangiz boʻsh</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mb-6">
              Hozircha savatchangizga hech narsa qoʻshilmagan. Mahsulotlar katalogiga oʻtib xaridni boshlang.
            </p>
            <Link href="/products">
              <Button variant="primary" size="default" className="font-bold">
                Katalogga oʻtish
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Chap tomon: Savatdagi tovarlar ro'yxati */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-card border border-border bg-card p-4 shadow-control"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-control border border-border bg-media p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" />
                    </div>

                    <div>
                      {item.brandName && (
                        <span className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                          {item.brandName}
                        </span>
                      )}
                      <h3 className="font-bold text-sm text-foreground line-clamp-1">{item.name}</h3>
                      {item.colorName && <p className="text-xs text-muted-foreground">Rang: {item.colorName}</p>}
                      <p className="mt-1 font-bold text-foreground text-sm">{formatMoney(item.price)}</p>
                    </div>
                  </div>

                  {/* Miqdor va o'chirish */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/60">
                    <div className="flex items-center rounded-control border border-border bg-background">
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty - 1)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-bold text-xs">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {isFinancial && (
                      <div className="text-right min-w-25">
                        <p className="font-black text-foreground text-sm">
                          {formatMoney(item.price * BigInt(item.qty))}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-muted-foreground hover:text-(--danger-fg) p-1.5 transition-colors"
                      title="Oʻchirish"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* O'ng tomon: Buyurtma tafsilotlari kartasi */}
            <div>
              <div className="sticky top-20 rounded-modal border border-border bg-card p-6 shadow-card space-y-4">
                <h2 className="text-base font-black text-foreground">Buyurtma tafsilotlari</h2>

                <div className="space-y-2.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Tanlangan tovarlar:</span>
                    <span className="font-bold text-foreground">{items.reduce((s, it) => s + it.qty, 0)} dona</span>
                  </div>

                  {isFinancial && (
                    <>
                      <div className="flex justify-between">
                        <span>Mahsulotlar summasi:</span>
                        <span className="font-bold text-foreground">{formatMoney(subtotal)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span>Yetkazib berish:</span>
                        <span className="font-bold text-foreground">
                          {shipping === 0n ? <span className="text-(--success-fg)">Bepul</span> : formatMoney(shipping)}
                        </span>
                      </div>

                      <div className="flex justify-between border-t border-border pt-3 text-base font-black text-foreground">
                        <span>Jami toʻlov:</span>
                        <span className="text-primary font-black">{formatMoney(total)}</span>
                      </div>
                    </>
                  )}
                </div>

                <Link href="/checkout" className="block pt-2">
                  <Button variant="primary" size="default" className="w-full gap-2 font-bold shadow-card-hover">
                    {isFinancial ? "Toʻlovga oʻtish" : "Buyurtmaga oʻtish"} <ArrowRight size={16} />
                  </Button>
                </Link>

                <p className="text-center text-caption text-muted-foreground">
                  Xavfsiz buyurtma va rasmiy kafolat bilan
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
