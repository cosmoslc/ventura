"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";
import { reducedMotion } from "../lib/morph";

/*
 * Buyruqlar oynasi (Ctrl K): tepada qidiruv maydoni, ostida guruhlangan natijalar. Klaviatura: ↑ ↓ — tanlash,
 * Enter — ochish, Esc — yopish (Radix Dialog). Fokus maydonda qoladi, tanlangan band `aria-activedescendant` bilan
 * belgilanadi. Sichqoncha va tegish: band ustiga olib borilsa tanlanadi, bosilsa ochiladi. Ilova ma'lumotni va
 * `onSelect` ni beradi (komponent Next'ga bog'lanmaydi). Ochilish/yopilish — qisqa fade + siljish; reduced-motion'da
 * animatsiyasiz.
 */

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

export interface CommandGroup {
  id: string;
  label: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ekran o'qigichlar uchun sarlavha va izoh (ko'rinmaydi) */
  title: string;
  description?: string;
  placeholder?: string;
  query: string;
  onQueryChange: (query: string) => void;
  groups: CommandGroup[];
  /** Natija yo'q bo'lganda ko'rsatiladigan matn (yuklanmoqda, topilmadi, yo'riqnoma) */
  message?: React.ReactNode;
}

export function CommandPalette({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  query,
  onQueryChange,
  groups,
  message,
}: CommandPaletteProps) {
  // Yopilish animatsiyasi tugaguncha DOM'da qoladi
  const [rendered, setRendered] = React.useState(open);
  const [entered, setEntered] = React.useState(false);
  if (open && !rendered) setRendered(true);
  if (!open && entered) setEntered(false);
  React.useEffect(() => {
    if (open && rendered) {
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    if (!open && rendered) {
      const timer = setTimeout(() => setRendered(false), reducedMotion() ? 0 : 200);
      return () => clearTimeout(timer);
    }
  }, [open, rendered]);

  const flat = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [activeRaw, setActive] = React.useState<string | null>(null);
  // Tanlangan band ro'yxatdan chiqib ketsa (natija o'zgardi) — birinchisiga qaytadi
  const active = flat.some((i) => i.id === activeRaw) ? activeRaw : (flat[0]?.id ?? null);
  const listId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const optionId = (id: string) => `${listId}-${id}`;

  React.useEffect(() => {
    if (!active || !rendered) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId faqat listId'ga bog'liq
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rendered]);

  function move(step: 1 | -1) {
    if (!flat.length) return;
    const at = flat.findIndex((i) => i.id === active);
    setActive(flat[(at + step + flat.length) % flat.length]!.id);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      const item = flat.find((i) => i.id === active);
      if (item) {
        e.preventDefault();
        item.onSelect();
      }
    }
  }

  return (
    <Dialog.Root open={rendered} onOpenChange={(o) => !o && onOpenChange(false)}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-modal
          className={cn(
            "fixed inset-0 z-(--z-overlay) bg-(--overlay) backdrop-blur-(--overlay-blur) transition-opacity duration-200 ease-ios",
            entered ? "opacity-100" : "opacity-0",
          )}
        />
        <Dialog.Content
          data-modal
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Fokus doim qidiruv maydoniga (animatsiya boshlanishidan qat'i nazar)
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className={cn(
            "fixed top-2 left-1/2 z-(--z-modal) flex max-h-[min(34rem,calc(100dvh-1rem))] w-[min(40rem,calc(100vw-1rem))] -translate-x-1/2 flex-col overflow-hidden rounded-modal border border-border bg-popover text-popover-foreground shadow-modal outline-none sm:top-[12vh]",
            "transition-[opacity,translate,scale] duration-200 ease-ios motion-reduce:transition-none",
            entered ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-[0.98] opacity-0",
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {description ? <Dialog.Description className="sr-only">{description}</Dialog.Description> : null}
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-placeholder" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={active ? optionId(active) : undefined}
              aria-label={title}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-placeholder"
            />
          </div>
          <div id={listId} role="listbox" aria-label={title} className="min-h-0 flex-1 overflow-y-auto p-2">
            {groups.map((group) => (
              <div key={group.id} role="group" aria-label={group.label} className="pb-1">
                <div className="px-3 pt-2 pb-1 text-caption font-bold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    id={optionId(item.id)}
                    role="option"
                    aria-selected={item.id === active}
                    data-active={item.id === active || undefined}
                    onPointerMove={() => item.id !== active && setActive(item.id)}
                    onClick={item.onSelect}
                    className="flex cursor-pointer items-center gap-3 rounded-btn px-3 py-2.5 text-secondary-foreground data-active:bg-secondary data-active:text-foreground"
                  >
                    {item.icon ? (
                      <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{item.icon}</span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold">{item.title}</span>
                      {item.subtitle ? (
                        <span className="block truncate text-caption text-muted-foreground">{item.subtitle}</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {!flat.length && message ? (
              <p className="px-3 py-8 text-center text-body text-muted-foreground" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
