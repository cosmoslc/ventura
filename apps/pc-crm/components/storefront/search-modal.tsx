"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Cpu, HardDrive, Monitor, Search, Sparkles, X } from "lucide-react";
import { Input } from "@ventura/ui/input";
import { useCart } from "@/lib/cart-context";
import { formatMoney } from "@/lib/format";

const POPULAR_SEARCHES = [
  "RTX 4070 Ti",
  "Intel Core i7 14-avlod",
  "DDR5 32GB",
  "Oʻyin kompyuteri",
  "Samsung 990 Pro SSD",
  "Gaming monitor 240Hz",
];

const SUGGESTIONS = [
  {
    type: "product" as const,
    name: "Intel Core i7-14700K 3.4GHz Protsessor",
    slug: "intel-core-i7-14700k",
    price: 5_200_000n,
    category: "Protsessorlar",
  },
  {
    type: "product" as const,
    name: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB",
    slug: "asus-rog-strix-geforce-rtx-4070-ti-super",
    price: 13_500_000n,
    category: "Videokartalar",
  },
  {
    type: "product" as const,
    name: "Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2 SSD",
    slug: "samsung-990-pro-2tb-nvme-ssd",
    price: 2_600_000n,
    category: "SSD disklar",
  },
  {
    type: "category" as const,
    name: "Videokartalar (GPU)",
    slug: "videokartalar",
  },
  {
    type: "brand" as const,
    name: "ASUS ROG mahsulotlari",
    slug: "asus",
  },
];

export function SearchModal() {
  const { isSearchOpen, setIsSearchOpen } = useCart();
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Ctrl+K klaviatura tugmasi
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  if (!isSearchOpen) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearchOpen(false);
    router.push(`/products?q=${encodeURIComponent(query.trim())}`);
  };

  const filtered = query.trim()
    ? SUGGESTIONS.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsSearchOpen(false)}
      />

      {/* Modal oynasi */}
      <div className="relative w-full max-w-2xl rounded-modal border border-border bg-card p-4 shadow-modal text-foreground">
        {/* Qidiruv formasi */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center border-b border-border pb-3">
          <Search size={18} className="text-primary mr-3 shrink-0" />
          <Input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nomi, modeli yoki toifasi boʻyicha qidiring..."
            className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm font-semibold shadow-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:shadow-none"
          />
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground ml-2"
          >
            <X size={18} />
          </button>
        </form>

        {/* Natijalar yoki Ommabop qidiruvlar */}
        <div className="py-4 text-xs">
          {query.trim() === "" ? (
            <div className="space-y-4">
              <div>
                <p className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-caption text-muted-foreground mb-2">
                  <Sparkles size={13} className="text-primary" />
                  Koʻp qidirilayotganlar
                </p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuery(item);
                        setIsSearchOpen(false);
                        router.push(`/products?q=${encodeURIComponent(item)}`);
                      }}
                      className="rounded-control border border-border bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/70 pt-3">
                <p className="font-bold text-caption text-muted-foreground mb-2">
                  Kategoriyalar boʻyicha tezkor oʻtish
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Link
                    href="/products?category=protsessorlar"
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center gap-2 rounded-control p-2 text-foreground hover:bg-secondary transition-colors"
                  >
                    <Cpu size={15} className="text-primary" />
                    <span className="font-semibold">Protsessorlar</span>
                  </Link>
                  <Link
                    href="/products?category=videokartalar"
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center gap-2 rounded-control p-2 text-foreground hover:bg-secondary transition-colors"
                  >
                    <Monitor size={15} className="text-primary" />
                    <span className="font-semibold">Videokartalar</span>
                  </Link>
                  <Link
                    href="/products?category=ssd-disklar"
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center gap-2 rounded-control p-2 text-foreground hover:bg-secondary transition-colors"
                  >
                    <HardDrive size={15} className="text-primary" />
                    <span className="font-semibold">SSD toʻplovchilar</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-bold text-caption text-muted-foreground mb-2">
                Qidiruv natijalari: ({filtered.length} ta)
              </p>

              {filtered.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  «{query}» soʻrovi boʻyicha mahsulotlar topilmadi
                </div>
              ) : (
                filtered.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.type === "product" ? `/products/${item.slug}` : `/products?category=${item.slug}`}
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center justify-between rounded-control p-2.5 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-2xs font-bold text-primary uppercase">
                        {item.type}
                      </span>
                      <span className="font-semibold text-foreground">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {"price" in item && (
                        <span className="font-bold text-foreground">
                          {formatMoney(item.price as bigint)}
                        </span>
                      )}
                      <ArrowRight size={13} className="text-muted-foreground" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
