"use client";

import * as React from "react";
import { ChevronDown, Menu, Search } from "lucide-react";
import { cn } from "../lib/utils";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { Logo } from "./logo";

export interface TopbarProps {
  collapsed?: boolean;
  onToggleSidebar: () => void;
  /** Tizim nomi va logo belgisi — mijoz brendidan keladi. */
  brandName?: string;
  brandMark?: React.ReactNode;
  brandSubtitle?: string;
  searchPlaceholder?: string;
  /**
   * Berilsa qidiruv maydoni tugmaga aylanadi (bosilganda shu chaqiriladi — buyruqlar oynasi ochiladi) va tor
   * ekranda qidiruv ikonkasi chiqadi. Berilmasa — oddiy matn maydoni (panel ilovasi).
   */
  onSearchOpen?: () => void;
  /** Menyu tugmasidan keyin, qidiruvdan oldin (masalan filial tanlovi) */
  leading?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function Topbar({
  collapsed,
  onToggleSidebar,
  brandName,
  brandMark,
  brandSubtitle,
  searchPlaceholder = "Qidirish…",
  onSearchOpen,
  leading,
  children,
  className,
}: TopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-(--z-topbar) flex h-(--topbar-h) w-full items-stretch border-b border-(--topbar-border) bg-(--topbar-bg) [backdrop-filter:var(--topbar-blur)] [-webkit-backdrop-filter:var(--topbar-blur)]",
        "max-[900px]:h-[56px]",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center border-r border-(--topbar-border) px-5 transition-[width] duration-200 ease-out",
          collapsed ? "w-(--sidebar-collapsed-w) justify-center px-0" : "w-(--sidebar-w)",
          "max-[900px]:w-auto max-[900px]:border-r-0 max-[900px]:px-4",
        )}
      >
        <Logo
          name={brandName}
          mark={brandMark}
          subtitle={brandSubtitle}
          collapsed={collapsed}
          className="max-[900px]:[&>span:last-child]:hidden"
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-4 px-5 max-[900px]:gap-2 max-[900px]:px-3">
        <Button variant="icon" size="icon" onClick={onToggleSidebar} aria-label="Menyuni ochish/yopish">
          <Menu />
        </Button>
        {leading}
        {onSearchOpen ? (
          <>
            <button
              type="button"
              onClick={onSearchOpen}
              aria-label={searchPlaceholder}
              aria-keyshortcuts="Control+K Meta+K"
              className={cn(
                "group relative hidden h-(--control-h) w-56 cursor-pointer items-center rounded-control border border-border-soft bg-(--search-bg) pr-14 pl-10 text-left text-sm text-placeholder lg:w-72 sm:flex",
                "transition-[background,border-color,box-shadow] duration-200 hover:bg-(--search-hover-bg) focus-visible:border-(--ring-border) focus-visible:shadow-(--search-ring)",
              )}
            >
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-placeholder" />
              <span className="truncate">{searchPlaceholder}</span>
              <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-border bg-(--kbd-bg) px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                Ctrl K
              </kbd>
            </button>
            <Button
              variant="icon"
              size="icon"
              onClick={onSearchOpen}
              aria-label={searchPlaceholder}
              className="sm:hidden"
            >
              <Search />
            </Button>
          </>
        ) : (
          <label className="group relative hidden sm:block">
            <span className="sr-only">Qidirish</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-placeholder transition-colors group-focus-within:text-primary-text" />
            <input
              type="search"
              placeholder={searchPlaceholder}
              className={cn(
                "h-(--control-h) w-56 rounded-control border border-border-soft bg-(--search-bg) pr-14 pl-10 text-sm text-foreground outline-none lg:w-72",
                "placeholder:text-placeholder transition-[background,border-color,box-shadow] duration-200",
                "hover:bg-(--search-hover-bg) focus:border-(--ring-border) focus:bg-(--search-focus-bg) focus:shadow-(--search-ring)",
              )}
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-border bg-(--kbd-bg) px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
              Ctrl K
            </kbd>
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}

export function ProfileButton({
  name,
  role,
  className,
  ...props
}: React.ComponentProps<"button"> & { name: string; role: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-btn border border-transparent py-1 pr-2.5 pl-1 text-left transition-colors",
        "hover:border-border-soft hover:bg-(--profile-hover-bg) data-[state=open]:border-border-soft data-[state=open]:bg-(--profile-hover-bg)",
        className,
      )}
      {...props}
    >
      <Avatar name={name} size={36} variant="brand" />
      <span className="hidden leading-tight md:block">
        <span className="block text-body font-bold text-foreground">{name}</span>
        <span className="block text-caption text-muted-foreground">{role}</span>
      </span>
      <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" />
    </button>
  );
}
