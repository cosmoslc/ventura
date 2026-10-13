"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "../lib/utils";
import { controlClass } from "./input";
import { MORPH_LAYER_ATTR, menuItemClass } from "./dropdown-menu";

/*
 * SearchSelect — qidiruvli tanlov (bitta yoki bir nechta qiymat). Ro'yxat portalda emas, trigger ostida ochiladi:
 * modal ichida ham qidiruv maydoniga fokus o'tadi (Radix Dialog fokus tuzog'i portaldagi inputni qabul qilmaydi) va
 * modal tanasi bilan birga aylanadi. Ochilish — balandlik bo'yicha silliq (grid-rows) o'tish.
 */

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Ikkinchi qator (masalan: kurs · o'qituvchi · vaqt) */
  hint?: string;
}

export function SearchSelect({
  id,
  options,
  value,
  onChange,
  multiple = false,
  searchable = true,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
}: {
  id?: string;
  options: readonly SearchSelectOption[];
  /** Tanlangan qiymatlar (bitta tanlovda — ko'pi bilan bittasi) */
  value: readonly string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listId = React.useId();

  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q))
    : options;
  const selected = options.filter((o) => value.includes(o.value));

  function toggle(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(0);
    }
  }

  // Ochilganda qidiruvga fokus — `inert` olib tashlangandan keyin (commit'dan so'ng)
  React.useEffect(() => {
    if (open && searchable) searchRef.current?.focus({ preventScroll: true });
  }, [open, searchable]);

  function pick(v: string) {
    if (multiple) {
      onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
      return;
    }
    // Bitta tanlovda tanlanganini qayta bosish — tozalash
    onChange(value.includes(v) ? [] : [v]);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Tashqariga bosilsa yopiladi
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      // Modal yopilib ketmasin — faqat ro'yxat yopiladi
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const o = shown[active];
      if (o) {
        e.preventDefault();
        pick(o.value);
      }
    }
  }

  const label = selected.length ? (multiple ? selected.map((o) => o.label).join(", ") : selected[0]!.label) : null;

  return (
    <div ref={rootRef} className={cn("w-full", className)} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        data-state={open ? "open" : "closed"}
        onClick={() => toggle(!open)}
        className={cn(
          controlClass,
          "group flex cursor-pointer items-center justify-between gap-2 pr-3 text-left",
          "data-[state=open]:border-(--ring-border) data-[state=open]:shadow-(--ring-shadow)",
        )}
      >
        <span className={cn("truncate", !label && "text-placeholder")}>{label ?? placeholder}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {multiple && selected.length > 1 ? (
            <span className="rounded-badge bg-primary-soft px-1.5 font-mono text-caption font-semibold text-primary-text">
              {selected.length}
            </span>
          ) : null}
          <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </span>
      </button>

      {/* Ochiq ro'yxat "panel" qatlami: modal Escape'da yopilmaydi (avval ro'yxat yopiladi) */}
      <div
        {...{ [MORPH_LAYER_ATTR]: "panel" }}
        data-state={open ? "open" : "closed"}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-ios",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 rounded-menu border border-border bg-popover p-1.5 text-popover-foreground shadow-popover">
            {searchable ? (
              <div className="relative mb-1.5">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-placeholder" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-controls={listId}
                  className={cn(controlClass, "h-9 pl-9")}
                />
              </div>
            ) : null}
            <div
              id={listId}
              role="listbox"
              aria-multiselectable={multiple || undefined}
              className="max-h-60 overflow-y-auto"
            >
              {shown.length ? (
                shown.map((o, i) => {
                  const on = value.includes(o.value);
                  return (
                    <div
                      key={o.value}
                      role="option"
                      aria-selected={on}
                      onPointerMove={() => setActive(i)}
                      onClick={() => pick(o.value)}
                      className={cn(
                        menuItemClass,
                        "h-auto min-h-9 py-1.5 pr-8 relative",
                        i === active && "bg-accent",
                        on && "text-primary-text",
                      )}
                    >
                      {multiple ? (
                        <span
                          className={cn(
                            "grid size-[18px] shrink-0 place-items-center rounded-check border border-input bg-input-bg",
                            on && "border-primary bg-primary text-primary-foreground",
                          )}
                          aria-hidden
                        >
                          {on ? <Check className="size-3!" strokeWidth={3} /> : null}
                        </span>
                      ) : null}
                      <span className="min-w-0">
                        <span className="block truncate">{o.label}</span>
                        {o.hint ? (
                          <span className="block truncate text-caption font-medium text-muted-foreground">
                            {o.hint}
                          </span>
                        ) : null}
                      </span>
                      {on && !multiple ? <Check className="absolute right-2.5 text-primary-text!" /> : null}
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-body text-muted-foreground">{emptyText}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
