"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Cpu,
  Flame,
  HardDrive,
  Layers,
  Monitor,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { formatMoney } from "@/lib/format";

export interface SearchProductItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: bigint;
  imageUrl: string;
  url: string;
}

const SEARCH_CATALOG: SearchProductItem[] = [
  {
    id: "p-1",
    name: "Intel Core i7-14700K 3.4GHz LGA1700 Protsessor",
    slug: "intel-core-i7-14700k",
    category: "Protsessorlar",
    price: 5_200_000n,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&q=80",
    url: "/products/intel-core-i7-14700k",
  },
  {
    id: "p-2",
    name: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB GDDR6X",
    slug: "asus-rog-strix-geforce-rtx-4070-ti-super",
    category: "Videokartalar",
    price: 13_500_000n,
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300&q=80",
    url: "/products/asus-rog-strix-geforce-rtx-4070-ti-super",
  },
  {
    id: "p-3",
    name: "Kingston FURY Beast RGB 32GB (2x16GB) 6000MHz DDR5",
    slug: "kingston-fury-beast-rgb-32gb-ddr5",
    category: "Operativ xotira",
    price: 1_750_000n,
    imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=300&q=80",
    url: "/products/kingston-fury-beast-rgb-32gb-ddr5",
  },
  {
    id: "p-4",
    name: "Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2 SSD",
    slug: "samsung-990-pro-2tb-nvme-ssd",
    category: "SSD disklar",
    price: 2_600_000n,
    imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=300&q=80",
    url: "/products/samsung-990-pro-2tb-nvme-ssd",
  },
  {
    id: "p-5",
    name: "MSI MAG Z790 TOMAHAWK WIFI Ona plata",
    slug: "msi-mag-z790-tomahawk-wifi",
    category: "Ona platalar",
    price: 3_100_000n,
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&q=80",
    url: "/products/msi-mag-z790-tomahawk-wifi",
  },
  {
    id: "pc-1",
    name: "Gaming Titan (RTX 4070 Ti)",
    slug: "ventura-gaming-titan-i7-4070",
    category: "Tayyor kompyuterlar",
    price: 24_800_000n,
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300&q=80",
    url: "/computers/ventura-gaming-titan-i7-4070",
  },
  {
    id: "pc-2",
    name: "Ventura Cyber Pro (Ryzen 7 7800X3D / RTX 4080 SUPER)",
    slug: "ventura-cyber-pro-r7-4080",
    category: "Tayyor kompyuterlar",
    price: 31_500_000n,
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300&q=80",
    url: "/computers/ventura-gaming-titan-i7-4070",
  },
];

const SEARCH_CATEGORIES = [
  {
    name: "Videokartalar",
    query: "4070",
    icon: Zap,
    color: "text-(--warning-fg) bg-(--warning-bg)",
  },
  {
    name: "Protsessorlar",
    query: "intel",
    icon: Cpu,
    color: "text-(--info-fg) bg-(--info-bg)",
  },
  {
    name: "Kompyuterlar",
    href: "/computers",
    icon: Monitor,
    color: "text-primary-text bg-primary-soft",
  },
  {
    name: "Operativ xotira",
    query: "ddr5",
    icon: Layers,
    color: "text-(--success-fg) bg-(--success-bg)",
  },
  {
    name: "SSD disklar",
    query: "ssd",
    icon: HardDrive,
    color: "text-(--danger-fg) bg-(--danger-bg)",
  },
  {
    name: "Top chegirmalar",
    query: "chegirma",
    icon: Flame,
    color: "text-(--warning-fg) bg-(--warning-bg)",
  },
];

const DEFAULT_RECENT = [
  "RTX 4070 Ti",
  "Intel Core i7 14-avlod",
  "DDR5 32GB",
  "Samsung 990 Pro",
];

const STORAGE_KEY = "ventura_recent_searches_v1";

interface NavbarSearchProps {
  className?: string;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

export function NavbarSearch({ className = "", isMobile = false, onCloseMobile }: NavbarSearchProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(DEFAULT_RECENT);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // localStorage'dan oxirgi qidirilganlarni yuklash
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentSearches(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveRecentSearch = (searchTerm: string) => {
    const term = searchTerm.trim();
    if (!term) return;
    setRecentSearches((prev) => {
      const updated = [term, ...prev.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const removeRecentSearch = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== termToRemove);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  // Tashqariga bosilganda yoki Escape bosilganda qisqarish
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
        if (isMobile && onCloseMobile) {
          onCloseMobile();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
        inputRef.current?.blur();
        if (isMobile && onCloseMobile) {
          onCloseMobile();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded, isMobile, onCloseMobile]);

  const handleSelectQuery = (term: string) => {
    saveRecentSearch(term);
    setIsExpanded(false);
    if (isMobile && onCloseMobile) onCloseMobile();
    router.push(`/products?q=${encodeURIComponent(term)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    handleSelectQuery(query.trim());
  };

  // Jonli qidiruv filtrlash
  const filteredProducts = query.trim()
    ? SEARCH_CATALOG.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  return (
    <div
      ref={containerRef}
      className={`relative transition-all duration-300 ease-out ${
        isMobile
          ? "w-full"
          : isExpanded
          ? "w-105 lg:w-120 xl:w-130 z-50"
          : "w-60 lg:w-70 z-30"
      } ${className}`}
    >
      {/* Input container: ikki tomonga qarab kengayadi */}
      <form
        onSubmit={handleSubmit}
        className={`relative flex h-9 items-center rounded-card border bg-card pl-[9px] pr-2.5 shadow-control transition-all duration-200 ${
          isExpanded
            ? "border-primary ring-2 ring-primary/20 shadow-card-hover bg-card"
            : "border-border hover:border-primary/40"
        }`}
      >
        <Search
          size={18}
          className={`shrink-0 transition-colors ${
            isExpanded ? "text-primary" : "text-muted-foreground"
          }`}
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          placeholder="Kompyuter, videokarta, protsessor qidirish..."
          className="ml-2 h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-foreground shadow-none outline-none placeholder:text-muted-foreground/80 focus:outline-none focus:ring-0"
          aria-label="Qidiruv"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Tozalash"
          >
            <X size={14} />
          </button>
        )}
      </form>

      {/* Pastga qarab kengayuvchi panel (Kategoriyalar va Oxirgi qidirilganlar) */}
      {isExpanded && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-modal border border-border bg-card p-4 shadow-modal backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-200 z-50 max-h-115 overflow-y-auto">
          {/* 1. AGAR QUERY BO'SH BO'LSA: Oxirgi qidiruvlar & Kategoriyalar */}
          {!query.trim() ? (
            <div className="space-y-4">
              {/* Oxirgi qidirilganlar */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-muted-foreground">
                      <Clock size={13} className="text-primary" />
                      Oxirgi qidirilganlar
                    </span>
                    <button
                      type="button"
                      onClick={clearAllRecent}
                      className="text-caption font-medium text-muted-foreground hover:text-(--danger-fg) transition-colors"
                    >
                      Tozalash
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {recentSearches.map((item) => (
                      <div
                        key={item}
                        onClick={() => handleSelectQuery(item)}
                        className="group flex cursor-pointer items-center gap-1.5 rounded-control border border-border/80 bg-secondary/50 px-2.5 py-1 text-xs text-foreground hover:border-primary/50 hover:bg-primary/10 transition-colors"
                      >
                        <Clock size={11} className="text-muted-foreground group-hover:text-primary" />
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(item, e)}
                          className="ml-1 rounded p-0.5 text-muted-foreground/60 hover:text-(--danger-fg) hover:bg-background transition-colors"
                          title="Oʻchirish"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ommabop Kategoriyalar */}
              <div className={recentSearches.length > 0 ? "border-t border-border/70 pt-3" : ""}>
                <span className="flex items-center gap-1.5 text-caption font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  <Sparkles size={13} className="text-primary" />
                  Ommabop kategoriyalar
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SEARCH_CATEGORIES.map((cat) => {
                    const IconComponent = cat.icon;
                    return cat.href ? (
                      <Link
                        key={cat.name}
                        href={cat.href}
                        onClick={() => {
                          setIsExpanded(false);
                          if (isMobile && onCloseMobile) onCloseMobile();
                        }}
                        className="flex items-center gap-2 rounded-card border border-border/60 bg-secondary/30 p-2.5 hover:bg-secondary hover:border-primary/40 transition-colors text-left"
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control ${cat.color}`}
                        >
                          <IconComponent size={14} />
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate">
                          {cat.name}
                        </span>
                      </Link>
                    ) : (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => handleSelectQuery(cat.query || cat.name)}
                        className="flex items-center gap-2 rounded-card border border-border/60 bg-secondary/30 p-2.5 hover:bg-secondary hover:border-primary/40 transition-colors text-left"
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control ${cat.color}`}
                        >
                          <IconComponent size={14} />
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate">
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* 2. AGAR QUERY YOZILAYOTGAN BO'LSA: Jonli natijalar */
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground">
                  Natijalar ({filteredProducts.length})
                </span>
                <span className="text-caption text-muted-foreground">
                  Enter bosib toʻliq qidiring
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Search size={28} className="mx-auto mb-2 text-muted-foreground/30" />
                  <p className="font-semibold text-foreground">"{query}" boʻyicha mahsulot topilmadi</p>
                  <p className="mt-1 text-caption">Boshqa soʻz yoki toifa nomi bilan qidirib koʻring</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 py-1">
                  {filteredProducts.map((p) => (
                    <Link
                      key={p.id}
                      href={p.url}
                      onClick={() => {
                        saveRecentSearch(query);
                        setIsExpanded(false);
                        if (isMobile && onCloseMobile) onCloseMobile();
                      }}
                      className="group flex items-center gap-3 p-2 rounded-control hover:bg-secondary/70 transition-colors"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border/80 bg-media p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-full w-full object-contain"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="rounded bg-muted px-1.5 py-0.2 text-2xs font-semibold text-muted-foreground">
                            {p.category}
                          </span>
                          <span className="text-xs font-black text-primary">
                            {formatMoney(p.price)}
                          </span>
                        </div>
                      </div>

                      <ArrowRight
                        size={14}
                        className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                      />
                    </Link>
                  ))}
                </div>
              )}

              {/* Barcha natijalarni ko'rish tugmasi */}
              <button
                type="button"
                onClick={() => handleSelectQuery(query)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-control border border-border bg-secondary/40 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <span>Barcha natijalarni koʻrish ("{query}")</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
