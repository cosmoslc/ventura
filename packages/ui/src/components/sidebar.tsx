"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn, prefersReducedMotion } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export interface NavChild {
  id: string;
  label: string;
  /** Ikkinchi daraja: guruh (masalan Hisobotlar → Moliyaviy hisobotlar → Pul oqimi). Guruh o'zi sahifa emas. */
  children?: NavChild[];
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Light rejimda ikonka rangi; --nav-icon-color berilsa (dark), u ustun turadi. */
  color?: string;
  count?: number;
  children?: NavChild[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface SidebarProps {
  sections: NavSection[];
  activeId: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  footer?: React.ReactNode;
}

/** Aktiv bandning otalari (tepadan pastga): [band, guruh?]; oddiy band uchun bo'sh */
function ancestorsOf(sections: NavSection[], id: string): string[] {
  const walk = (list: readonly NavChild[], path: string[]): string[] | null => {
    for (const c of list) {
      if (c.id === id) return path;
      const found = c.children ? walk(c.children, [...path, c.id]) : null;
      if (found) return found;
    }
    return null;
  };
  for (const s of sections)
    for (const it of s.items) {
      const found = it.children ? walk(it.children, [it.id]) : null;
      if (found) return found;
    }
  return [];
}

export function Sidebar({
  sections,
  activeId,
  onSelect,
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
  footer,
}: SidebarProps) {
  const ancestors = ancestorsOf(sections, activeId);
  const activeParent = ancestors[0] ?? null;
  const [open, setOpen] = React.useState<Set<string>>(() => new Set(ancestors));
  // Boshqa joydan (havola, orqaga) ichki bandga o'tilsa — uning otalari ochiladi
  const ancestorKey = ancestors.join("|");
  const [openedFor, setOpenedFor] = React.useState(ancestorKey);
  if (openedFor !== ancestorKey) {
    setOpenedFor(ancestorKey);
    if (ancestors.some((a) => !open.has(a))) setOpen(new Set([...open, ...ancestors]));
  }
  const listRef = React.useRef<HTMLDivElement>(null);
  const indicatorRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const prevTarget = React.useRef<string | null>(null);

  // Indikator qaysi bandda turadi: oddiy band — o'zi; yig'ilgan rejimda — aktiv bolaning otasi.
  const target = activeParent ? (collapsed ? activeParent : null) : activeId;

  const place = React.useCallback(() => {
    const el = indicatorRef.current;
    const btn = target ? itemRefs.current.get(target) : undefined;
    if (!el) return;
    if (!btn) {
      el.style.opacity = "0";
      return;
    }
    const list = listRef.current;
    const top = list ? btn.getBoundingClientRect().top - list.getBoundingClientRect().top : btn.offsetTop;
    el.style.opacity = "1";
    el.style.transform = `translateY(${top}px)`;
    el.style.height = `${btn.offsetHeight}px`;
  }, [target]);

  React.useLayoutEffect(() => {
    place();
    const el = indicatorRef.current;
    // Band almashganda pill sirpanadi va o'rtada siqiladi (NavIndicator, 380ms).
    if (el && target && prevTarget.current && prevTarget.current !== target && !prefersReducedMotion()) {
      el.firstElementChild?.animate(
        [{ transform: "scaleX(1)" }, { transform: "scaleX(0.88)" }, { transform: "scaleX(1)" }],
        { duration: 380, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
      );
    }
    prevTarget.current = target;
  }, [place, target, collapsed, open]);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const ro = new ResizeObserver(() => place());
    ro.observe(list);
    return () => ro.disconnect();
  }, [place]);

  function toggleParent(id: string) {
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <>
      <div
        onClick={onMobileClose}
        className={cn(
          "fixed inset-0 z-(--z-overlay) bg-(--overlay) backdrop-blur-(--overlay-blur) transition-opacity min-[901px]:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
      <aside
        className={cn(
          "z-(--z-sidebar) flex shrink-0 flex-col border-r border-(--sidebar-border) bg-(--sidebar-bg)",
          "sticky top-(--topbar-h) h-[calc(100dvh-var(--topbar-h))] transition-[width] duration-200 ease-out",
          collapsed ? "w-(--sidebar-collapsed-w)" : "w-(--sidebar-w)",
          "max-[900px]:fixed max-[900px]:z-(--z-modal) max-[900px]:top-0 max-[900px]:left-0 max-[900px]:h-dvh max-[900px]:w-[280px]",
          "max-[900px]:transition-transform max-[900px]:duration-300 max-[900px]:ease-ios",
          mobileOpen
            ? "max-[900px]:translate-x-0 max-[900px]:shadow-[0_20px_40px_rgb(0_0_0/0.25)]"
            : "max-[900px]:-translate-x-full",
        )}
        aria-label="Asosiy menyu"
      >
        <nav
          className={cn(
            // overscroll-contain: menyu oxiriga yetganda g'ildirak sahifani aylantirib yubormaydi
            "flex-1 overflow-y-auto overflow-x-hidden overscroll-contain",
            collapsed ? "px-2 pt-3.5 pb-5" : "px-3.5 pt-5 pb-6",
          )}
        >
          <div ref={listRef} className="relative">
            <div
              ref={indicatorRef}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 transition-[transform,height,opacity] duration-[380ms] ease-ios motion-reduce:transition-none"
              style={{ opacity: 0 }}
            >
              <div className="nav-active-surface relative size-full rounded-nav">
                {!collapsed ? (
                  <span className="absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-r-full bg-(--nav-bar) max-[900px]:hidden" />
                ) : null}
              </div>
            </div>

            {sections.map((section, si) => (
              <div key={section.title} className={cn(si > 0 && "mt-4")}>
                {collapsed ? (
                  si > 0 ? (
                    <div className="mx-3 mb-3 h-px bg-(--sidebar-border)" />
                  ) : null
                ) : (
                  <div className="type-eyebrow mb-2 flex items-center gap-2 px-3 text-(--nav-section-fg)">
                    {section.title}
                    <span className="h-px flex-1 bg-(--sidebar-border)" />
                  </div>
                )}
                <ul className="space-y-[3px]">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isParent = !!item.children?.length;
                    const isOpen = open.has(item.id) && !collapsed;
                    const isActive = target === item.id;
                    const hasActiveChild = activeParent === item.id;
                    const flyout = isParent && collapsed;
                    const button = (
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) itemRefs.current.set(item.id, el);
                          else itemRefs.current.delete(item.id);
                        }}
                        title={collapsed ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        aria-expanded={isParent && !collapsed ? isOpen : undefined}
                        onClick={flyout ? undefined : () => (isParent ? toggleParent(item.id) : onSelect(item.id))}
                        className={cn(
                          "group/nav type-nav relative z-10 flex h-(--nav-item-h) w-full cursor-pointer items-center gap-3 rounded-nav px-2 text-left transition-colors duration-200",
                          collapsed && "justify-center px-0",
                          isActive
                            ? "text-(--nav-active-fg)"
                            : [
                                "text-(--nav-fg) hover:bg-(--nav-hover-bg) hover:text-(--nav-hover-fg)",
                                "hover:animate-[var(--nav-hover-anim)_380ms_var(--ease-ios)]",
                              ],
                          hasActiveChild && !isActive && "font-bold text-(--nav-parent-active-fg)",
                        )}
                      >
                        <span className="grid size-8 shrink-0 place-items-center">
                          <Icon
                            className="size-[19px] transition-transform duration-200 group-hover/nav:scale-110"
                            style={{
                              color: isActive
                                ? "currentColor"
                                : `var(--nav-icon-color, ${item.color ?? "currentColor"})`,
                            }}
                          />
                        </span>
                        {!collapsed ? (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.count != null ? (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 font-mono text-caption font-semibold",
                                  isActive ? "bg-white/20 text-current" : "bg-primary-soft text-primary-text",
                                )}
                              >
                                {item.count}
                              </span>
                            ) : null}
                            {isParent ? (
                              <ChevronDown
                                className={cn(
                                  "mr-1 size-3.5 text-(--nav-chevron) transition-transform duration-200",
                                  isOpen && "rotate-180",
                                )}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </button>
                    );
                    return (
                      <li key={item.id}>
                        {flyout ? (
                          // Yig'ilgan rejim: ost menyu o'ngga morph flyout bo'lib chiqadi
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
                            <DropdownMenuContent side="right" sideOffset={10} className="w-[230px]">
                              <DropdownMenuLabel>
                                <span className="type-eyebrow text-(--nav-section-fg)">{item.label}</span>
                              </DropdownMenuLabel>
                              {item.children!.map((child) =>
                                child.children?.length ? (
                                  <React.Fragment key={child.id}>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-caption font-semibold text-muted-foreground">
                                      {child.label}
                                    </DropdownMenuLabel>
                                    {child.children.map((leaf) => (
                                      <FlyoutItem
                                        key={leaf.id}
                                        child={leaf}
                                        active={leaf.id === activeId}
                                        onSelect={onSelect}
                                      />
                                    ))}
                                  </React.Fragment>
                                ) : (
                                  <FlyoutItem
                                    key={child.id}
                                    child={child}
                                    active={child.id === activeId}
                                    onSelect={onSelect}
                                  />
                                ),
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          button
                        )}

                        {isParent && isOpen ? (
                          <SubList
                            items={item.children!}
                            activeId={activeId}
                            ancestors={ancestors}
                            open={open}
                            onToggle={toggleParent}
                            onSelect={onSelect}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        {footer && !collapsed ? <div className="border-t border-(--sidebar-border) p-3.5">{footer}</div> : null}
      </aside>
    </>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={cn("size-[5px] shrink-0 rounded-full", on ? "bg-(--sub-dot-active)" : "bg-(--sub-dot)")}
      style={on ? { boxShadow: "var(--sub-dot-ring)" } : undefined}
    />
  );
}

function FlyoutItem({ child, active, onSelect }: { child: NavChild; active: boolean; onSelect: (id: string) => void }) {
  return (
    <DropdownMenuItem
      onSelect={() => onSelect(child.id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "gap-2.5",
        active &&
          "bg-(--sub-active-bg) text-(--sub-active-fg) data-highlighted:bg-(--sub-active-bg) data-highlighted:text-(--sub-active-fg)",
      )}
    >
      <Dot on={active} />
      <span className="truncate">{child.label}</span>
    </DropdownMenuItem>
  );
}

/** Ost menyu (chiziq bilan). Guruh bandi — ochiladigan sarlavha, uning bandlari bir pog'ona ichkarida. */
function SubList({
  items,
  activeId,
  ancestors,
  open,
  onToggle,
  onSelect,
  nested = false,
}: {
  items: NavChild[];
  activeId: string;
  ancestors: string[];
  open: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  nested?: boolean;
}) {
  return (
    <ul
      className={cn(
        "animate-[slide-down_180ms_ease-out] space-y-0.5 border-l-[1.5px] border-(--sub-line)",
        nested ? "mt-0.5 mb-1 ml-2.5 py-0.5 pl-2" : "mt-[3px] mb-1.5 ml-4 py-1 pl-3.5",
      )}
    >
      {items.map((child) => {
        if (child.children?.length) {
          const isOpen = open.has(child.id);
          const hasActive = ancestors.includes(child.id);
          return (
            <li key={child.id}>
              <button
                type="button"
                onClick={() => onToggle(child.id)}
                aria-expanded={isOpen}
                className={cn(
                  "flex h-(--sub-item-h) w-full cursor-pointer items-center gap-2.5 rounded-sub px-2.5 text-left text-body transition-colors duration-150",
                  "hover:bg-(--nav-hover-bg) hover:text-(--nav-hover-fg)",
                  hasActive ? "font-bold text-(--nav-parent-active-fg)" : "font-semibold text-(--sub-fg)",
                )}
              >
                <span className="flex-1 truncate">{child.label}</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-(--nav-chevron) transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen ? (
                <SubList
                  items={child.children}
                  activeId={activeId}
                  ancestors={ancestors}
                  open={open}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  nested
                />
              ) : null}
            </li>
          );
        }
        const on = child.id === activeId;
        return (
          <li key={child.id}>
            <button
              type="button"
              onClick={() => onSelect(child.id)}
              aria-current={on ? "page" : undefined}
              title={child.label}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-sub px-2.5 text-left text-body transition-colors duration-150",
                // Ichki pog'onada joy tor — uzun nom ikki qatorga o'tadi
                nested ? "min-h-(--sub-item-h) py-1.5 leading-snug" : "h-(--sub-item-h)",
                on
                  ? "bg-(--sub-active-bg) font-bold text-(--sub-active-fg)"
                  : "font-medium text-(--sub-fg) hover:bg-(--nav-hover-bg) hover:text-(--nav-hover-fg)",
              )}
            >
              <Dot on={on} />
              <span className={nested ? "line-clamp-2" : "truncate"}>{child.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
