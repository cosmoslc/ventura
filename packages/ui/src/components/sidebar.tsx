"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn, prefersReducedMotion } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export interface NavChild {
  id: string;
  label: string;
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

function parentOf(sections: NavSection[], id: string) {
  for (const s of sections) for (const it of s.items) if (it.children?.some((c) => c.id === id)) return it.id;
  return null;
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
  const activeParent = parentOf(sections, activeId);
  const [open, setOpen] = React.useState<Set<string>>(() => new Set(activeParent ? [activeParent] : []));
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
            "flex-1 overflow-y-auto overflow-x-hidden",
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
                              {item.children!.map((child) => {
                                const on = child.id === activeId;
                                return (
                                  <DropdownMenuItem
                                    key={child.id}
                                    onSelect={() => onSelect(child.id)}
                                    aria-current={on ? "page" : undefined}
                                    className={cn(
                                      "gap-2.5",
                                      on &&
                                        "bg-(--sub-active-bg) text-(--sub-active-fg) data-highlighted:bg-(--sub-active-bg) data-highlighted:text-(--sub-active-fg)",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "size-[5px] shrink-0 rounded-full",
                                        on ? "bg-(--sub-dot-active)" : "bg-(--sub-dot)",
                                      )}
                                      style={on ? { boxShadow: "var(--sub-dot-ring)" } : undefined}
                                    />
                                    <span className="truncate">{child.label}</span>
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          button
                        )}

                        {isParent && isOpen ? (
                          <ul className="mt-[3px] mb-1.5 ml-4 animate-[slide-down_180ms_ease-out] space-y-0.5 border-l-[1.5px] border-(--sub-line) py-1 pl-3.5">
                            {item.children!.map((child) => {
                              const on = child.id === activeId;
                              return (
                                <li key={child.id}>
                                  <button
                                    type="button"
                                    onClick={() => onSelect(child.id)}
                                    aria-current={on ? "page" : undefined}
                                    className={cn(
                                      "flex h-(--sub-item-h) w-full cursor-pointer items-center gap-2.5 rounded-sub px-2.5 text-left text-body transition-colors duration-150",
                                      on
                                        ? "bg-(--sub-active-bg) font-bold text-(--sub-active-fg)"
                                        : "font-medium text-(--sub-fg) hover:bg-(--nav-hover-bg) hover:text-(--nav-hover-fg)",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "size-[5px] shrink-0 rounded-full",
                                        on ? "bg-(--sub-dot-active)" : "bg-(--sub-dot)",
                                      )}
                                      style={on ? { boxShadow: "var(--sub-dot-ring)" } : undefined}
                                    />
                                    <span className="truncate">{child.label}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
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
