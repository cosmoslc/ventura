"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Slot } from "radix-ui";
import { cn } from "../lib/utils";
import { MORPH_EASE, reducedMotion, uniformScale } from "../lib/morph";

/*
 * Morph dropdown (menyu, select va sidebar flyout uchun umumiy asos):
 * - panel trigger chegarasidan o'sib chiqadi (360ms), kontent bir xil masshtabda kattalashadi,
 *   bandlar 100ms + 30ms qadam bilan paydo bo'ladi; yopilishda trigger'ga qaytadi (280ms);
 * - kichik tugmalarda boshlang'ich radius tugma balandligining yarmi bilan cheklanadi;
 * - side="bottom" (standart) yoki "right" (yig'ilgan sidebar flyout'i);
 * - reduced-motion: animatsiyasiz.
 * Fokus doim trigger'da qoladi, band aria-activedescendant bilan belgilanadi — shuning uchun
 * menyu modal (Radix Dialog) ichida ham fokus tuzog'i va "tashqariga bosish" bilan to'qnashmaydi.
 * Klaviatura: ↑ ↓ Home End, Enter/Space, Escape, Tab.
 */

/** Modal shu atribut bor elementlarni "tashqari" deb hisoblamaydi (modal.tsx). */
export const MORPH_LAYER_ATTR = "data-morph-layer";

interface MenuCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  menuId: string;
}

const MenuContext = React.createContext<MenuCtx | null>(null);

function useMenu() {
  const ctx = React.useContext(MenuContext);
  if (!ctx) throw new Error("DropdownMenu ichida ishlatilishi kerak");
  return ctx;
}

export function DropdownMenu({
  children,
  open: openProp,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [inner, setInner] = React.useState(false);
  const open = openProp ?? inner;
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const menuId = React.useId();
  const setOpen = React.useCallback(
    (o: boolean) => {
      if (openProp === undefined) setInner(o);
      onOpenChange?.(o);
    },
    [openProp, onOpenChange],
  );
  return <MenuContext.Provider value={{ open, setOpen, triggerRef, menuId }}>{children}</MenuContext.Provider>;
}

export function DropdownMenuTrigger({
  asChild,
  onClick,
  onKeyDown,
  popup = "menu",
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean; popup?: "menu" | "listbox" }) {
  const { open, setOpen, triggerRef, menuId } = useMenu();
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={triggerRef as React.Ref<HTMLButtonElement>}
      type={asChild ? undefined : "button"}
      aria-haspopup={popup}
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      data-state={open ? "open" : "closed"}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) setOpen(!open);
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(e);
        if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          setOpen(true);
        }
      }}
      {...props}
    />
  );
}

const WIDTH_CLASS = /(^|\s)(w-|min-w-|max-w-)/;

interface Placement {
  top: number;
  left: number;
  /** Panel balandligi: sig'masa cheklanadi, kontent ichida aylanadi */
  height: number;
  /** Morph boshlanadigan nuqta */
  startTop: number;
  origin: string;
}

/** Pastda shundan kam joy qolsa (va tepada ko'proq bo'lsa) panel yuqoriga ochiladi */
const MIN_BELOW = 200;

function place(
  tr: DOMRect,
  w: number,
  h: number,
  side: "bottom" | "right",
  align: "start" | "center" | "end",
  offset: number,
): Placement {
  if (side === "right") {
    const left = Math.max(8, Math.min(tr.right + offset, innerWidth - w - 8));
    const height = Math.min(h, innerHeight - 20);
    const top = Math.max(8, Math.min(tr.top, innerHeight - height - 12));
    return { top, left, height, startTop: tr.top, origin: "top left" };
  }
  let left = align === "end" ? tr.right - w : align === "center" ? tr.left + tr.width / 2 - w / 2 : tr.left;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  // Odatda pastga ochiladi; sig'masa balandlik cheklanadi va ro'yxat ichida aylanadi. Yuqoriga faqat pastda juda
  // kam joy qolgan va tepada ko'proq joy bo'lsa (uzun ro'yxat butunlay yuqoriga "sakramasin")
  const below = innerHeight - tr.bottom - offset - 12;
  const above = tr.top - offset - 8;
  const up = h > below && below < MIN_BELOW && above > below;
  const height = Math.max(0, Math.min(h, up ? above : below));
  const top = up ? Math.max(8, tr.top - height - offset) : tr.bottom + offset;
  const startTop = up ? tr.top - (tr.height || 4) : tr.bottom + offset;
  const hx = align === "end" ? "right" : align === "center" ? "center" : "left";
  return { top, left, height, startTop, origin: `${up ? "bottom" : "top"} ${hx}` };
}

interface ItemCtx {
  close: () => void;
  highlight: (el: HTMLElement | null) => void;
}

const ItemContext = React.createContext<ItemCtx>({ close: () => {}, highlight: () => {} });

export function DropdownMenuContent({
  className,
  children,
  align = "start",
  side = "bottom",
  sideOffset = 6,
  matchTriggerWidth = false,
  role = "menu",
}: {
  className?: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "bottom" | "right";
  sideOffset?: number;
  /** Panel kengligi trigger bilan bir xil (select). */
  matchTriggerWidth?: boolean;
  role?: "menu" | "listbox";
}) {
  const { open, setOpen, triggerRef, menuId } = useMenu();
  const [mounted, setMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const doneTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  // Ochilganda darhol (render paytida) DOM'ga qo'shiladi; yopilish animatsiyasidan keyin olib tashlanadi
  if (open && !mounted) setMounted(true);

  React.useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
      clearTimeout(doneTimer.current);
    },
    [],
  );

  const highlight = React.useCallback(
    (el: HTMLElement | null) => {
      const panel = panelRef.current;
      const trigger = triggerRef.current;
      panel?.querySelectorAll("[data-highlighted]").forEach((x) => x.removeAttribute("data-highlighted"));
      if (el) {
        el.setAttribute("data-highlighted", "");
        el.scrollIntoView({ block: "nearest" });
        trigger?.setAttribute("aria-activedescendant", el.id);
      } else {
        trigger?.removeAttribute("aria-activedescendant");
      }
    },
    [triggerRef],
  );

  const close = React.useCallback(() => {
    highlight(null);
    setOpen(false);
  }, [highlight, setOpen]);

  React.useLayoutEffect(() => {
    const panel = panelRef.current;
    const content = contentRef.current;
    const trigger = triggerRef.current;
    if (!mounted || !panel || !content || !trigger) return;

    const radius = getComputedStyle(panel).getPropertyValue("--r-menu").trim() || "16px";
    const tr = trigger.getBoundingClientRect();
    const reduce = reducedMotion();
    // 999px kabi radiuslar tugma o'lchamidan oshmasin
    const originRadius = `${Math.min(parseFloat(getComputedStyle(trigger).borderRadius) || 12, tr.height / 2)}px`;
    const width = matchTriggerWidth ? `${tr.width}px` : WIDTH_CLASS.test(className ?? "") ? "" : "max-content";

    if (open) {
      clearTimeout(doneTimer.current);
      clearTimeout(hideTimer.current); // yopilayotgan paytda qayta ochilsa
      // 1. Tabiiy o'lchamni o'lchash
      panel.classList.add("is-animating");
      panel.classList.toggle("has-stagger", !reduce);
      Object.assign(panel.style, {
        transition: "none",
        top: `${tr.bottom + sideOffset}px`,
        left: `${align === "end" && side === "bottom" ? tr.right - 260 : tr.left}px`,
        width,
        minWidth: matchTriggerWidth ? "0px" : "",
        height: "auto",
        visibility: "hidden",
        opacity: "0",
        transform: "none",
        borderRadius: radius,
      });
      Object.assign(content.style, {
        width: "auto",
        transform: "none",
        transition: "none",
        maxHeight: "",
        overflowY: "",
      });
      const final = panel.getBoundingClientRect();
      const targetWidth = Math.min(final.width, innerWidth - 16);
      const p = place(tr, targetWidth, final.height, side, align, sideOffset);
      // Sig'magan ro'yxat ichida aylanadi (panel o'zi ekrandan chiqmaydi)
      if (p.height < final.height) {
        const pcs = getComputedStyle(panel);
        const chromeY = parseFloat(pcs.borderTopWidth) + parseFloat(pcs.borderBottomWidth);
        Object.assign(content.style, { maxHeight: `${p.height - chromeY}px`, overflowY: "auto" });
      }
      const targetHeight = Math.min(final.height, p.height);

      // Boshlang'ich band: tanlangan qiymat (select)
      highlight(panel.querySelector<HTMLElement>("[aria-selected='true']"));

      if (reduce) {
        Object.assign(panel.style, {
          top: `${p.top}px`,
          left: `${p.left}px`,
          width: `${targetWidth}px`,
          visibility: "visible",
          opacity: "1",
        });
        panel.classList.remove("is-animating");
        return;
      }

      // Kontent kengligi qotiriladi — animatsiya paytida matn qayta oqmaydi
      const cs = getComputedStyle(panel);
      const chromeX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      content.style.width = `${Math.max(0, targetWidth - chromeX)}px`;
      const s = uniformScale(tr, { width: targetWidth, height: targetHeight });

      // 2. Panelni trigger chegarasiga qo'yish
      Object.assign(panel.style, {
        top: `${p.startTop}px`,
        left: `${tr.left}px`,
        width: `${tr.width}px`,
        minWidth: "0px", // min-w-[200px] tugma o'lchamidan boshlashga xalaqit bermasin
        height: `${tr.height || 6}px`,
        borderRadius: originRadius,
        visibility: "visible",
        opacity: "1",
      });
      Object.assign(content.style, { transformOrigin: p.origin, transform: `scale(${s})` });
      void panel.offsetHeight;

      // 3. Maqsad o'lchamiga animatsiya
      const ease = `360ms ${MORPH_EASE}`;
      Object.assign(panel.style, {
        transition: `top ${ease}, left ${ease}, width ${ease}, height ${ease}, border-radius ${ease}`,
        top: `${p.top}px`,
        left: `${p.left}px`,
        width: `${targetWidth}px`,
        height: `${targetHeight}px`,
        borderRadius: radius,
      });
      content.style.transition = `transform ${ease}`;
      content.style.transform = "scale(1)";

      // 4. Bandlar ketma-ket
      panel.querySelectorAll<HTMLElement>(".morph-menu-item").forEach((item, i) => {
        item.style.transitionDelay = `${100 + i * 30}ms`;
      });
      panel.classList.remove("content-in");
      requestAnimationFrame(() => panel.classList.add("content-in"));

      doneTimer.current = setTimeout(() => {
        const el = panelRef.current;
        if (!el) return;
        el.classList.remove("is-animating");
        el.style.height = "auto"; // keyin kontent o'zgarsa kesilib qolmasin
      }, 380);
    } else {
      clearTimeout(doneTimer.current);
      clearTimeout(hideTimer.current);
      if (reduce) {
        hideTimer.current = setTimeout(() => setMounted(false), 0);
        return;
      }
      panel.classList.add("is-animating");
      const current = panel.getBoundingClientRect();
      panel.style.height = `${current.height}px`;
      const s = uniformScale(tr, { width: current.width || 200, height: current.height || 100 });
      panel.querySelectorAll<HTMLElement>(".morph-menu-item").forEach((item) => {
        item.style.transitionDelay = "0ms";
      });
      panel.classList.remove("content-in");
      void panel.offsetHeight;

      const D = 280;
      const ease = `${D}ms ${MORPH_EASE}`;
      const back = side === "right" ? tr.top : tr.bottom + sideOffset;
      Object.assign(panel.style, {
        transition: `top ${ease}, left ${ease}, width ${ease}, height ${ease}, border-radius ${ease}, opacity ${D * 0.4}ms ease-in ${D * 0.6}ms`,
        top: `${back}px`,
        left: `${tr.left}px`,
        width: `${tr.width}px`,
        height: `${tr.height || 6}px`,
        borderRadius: originRadius,
        opacity: "0",
      });
      content.style.transition = `transform ${ease}`;
      content.style.transform = `scale(${s})`;
      hideTimer.current = setTimeout(() => setMounted(false), D);
    }
  }, [open, mounted, align, side, sideOffset, matchTriggerWidth, className, triggerRef, highlight]);

  // Klaviatura — fokus trigger'da, shuning uchun hujjat darajasida tinglanadi
  React.useEffect(() => {
    if (!open || !mounted) return;
    const items = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]:not([data-disabled]):not([hidden])") ?? [],
      );
    const current = () => panelRef.current?.querySelector<HTMLElement>("[data-highlighted]") ?? null;
    let consumedSpace = false;
    const onKeyDown = (e: KeyboardEvent) => {
      // Qidiruv maydonida: Probel, Home, End — matn uchun; Enter tanlanmagan bo'lsa — birinchi topilgan band
      const typing = (e.target as HTMLElement | null)?.tagName === "INPUT";
      if (typing && (e.key === " " || e.key === "Home" || e.key === "End")) return;
      if (typing && e.key === "Enter" && !current()) {
        e.preventDefault();
        items()[0]?.click();
        return;
      }
      const list = items();
      const i = list.indexOf(current() as HTMLElement);
      const go = (n: number) => {
        e.preventDefault();
        if (list.length) highlight(list[(n + list.length) % list.length] ?? null);
      };
      if (e.key === "ArrowDown") go(i + 1);
      else if (e.key === "ArrowUp") go(i < 0 ? list.length - 1 : i - 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(list.length - 1);
      else if ((e.key === "Enter" || e.key === " ") && current()) {
        e.preventDefault();
        consumedSpace = e.key === " ";
        current()?.click();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus({ preventScroll: true });
      } else if (e.key === "Tab") close();
    };
    // Space tugmasi keyup'da trigger'ni ham bosmasin
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " && consumedSpace) {
        e.preventDefault();
        consumedSpace = false;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp, true);
    };
  }, [open, mounted, close, highlight, triggerRef]);

  if (!mounted) return null;

  // Bosish fokusni trigger'dan olmasin (modal fokus tuzog'i bilan to'qnashmasin)
  // Fokus trigger'da qoladi; panel ichidagi qidiruv maydoni bundan mustasno (unga yoziladi)
  const keepFocus = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("input, textarea")) e.preventDefault();
  };

  return createPortal(
    <>
      {/* Tashqariga bosish faqat yopadi, ostidagi elementni bosmaydi */}
      <div
        {...{ [MORPH_LAYER_ATTR]: "backdrop" }}
        className="pointer-events-auto fixed inset-0 z-(--z-popover) cursor-default"
        aria-hidden
        onMouseDown={keepFocus}
        onClick={close}
      />
      <div
        {...{ [MORPH_LAYER_ATTR]: "panel" }}
        ref={panelRef}
        id={menuId}
        role={role}
        onMouseDown={keepFocus}
        data-state={open ? "open" : "closed"}
        style={{
          position: "fixed",
          willChange: "top, left, width, height, border-radius, opacity",
          visibility: "hidden",
        }}
        className={cn(
          "morph-panel pointer-events-auto z-(--z-popover) min-w-[200px] overflow-hidden rounded-menu border border-border bg-popover text-popover-foreground shadow-popover outline-none",
          className,
        )}
      >
        <div ref={contentRef} className="morph-content shrink-0 origin-top-left overscroll-contain p-1">
          <ItemContext.Provider value={{ close, highlight }}>{children}</ItemContext.Provider>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Menyu bandi — dropdown, select va flyout uchun umumiy o'lcham. */
export const menuItemClass =
  "flex h-8 max-[900px]:h-9 cursor-pointer items-center gap-2 rounded-menu-item px-2.5 text-body font-semibold outline-none select-none [&_svg]:size-4 [&_svg]:shrink-0";

export function DropdownMenuItem({
  className,
  danger,
  disabled,
  onSelect,
  onClick,
  role = "menuitem",
  ...props
}: Omit<React.ComponentProps<"div">, "onSelect"> & {
  danger?: boolean;
  disabled?: boolean;
  role?: "menuitem" | "option";
  /** event.preventDefault() chaqirilsa menyu yopilmaydi. */
  onSelect?: (event: Event) => void;
}) {
  const { close, highlight } = React.useContext(ItemContext);
  const id = React.useId();
  return (
    <div
      id={id}
      role={role}
      data-menu-item=""
      aria-disabled={disabled || undefined}
      data-disabled={disabled || undefined}
      onPointerMove={(e) =>
        !disabled && !e.currentTarget.hasAttribute("data-highlighted") && highlight(e.currentTarget)
      }
      onPointerLeave={() => highlight(null)}
      onClick={(e) => {
        onClick?.(e);
        if (disabled) return;
        const ev = new Event("menu.select", { cancelable: true });
        onSelect?.(ev);
        if (!ev.defaultPrevented) close();
      }}
      className={cn(
        "morph-menu-item",
        menuItemClass,
        danger
          ? "text-destructive-text data-highlighted:bg-(--danger-bg)"
          : "text-secondary-foreground data-highlighted:bg-secondary data-highlighted:text-foreground [&_svg]:text-muted-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("morph-menu-item px-3 pt-2 pb-1.5", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="separator" className={cn("-mx-1.5 my-1.5 h-px bg-border-soft", className)} {...props} />;
}
