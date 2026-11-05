"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "../lib/utils";
import { controlClass } from "./input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

/*
 * Select — morph dropdown ustida (menyu bilan bir xil ochilish/yopilish animatsiyasi).
 * API Radix Select bilan bir xil: Select / SelectTrigger / SelectValue / SelectContent / SelectItem.
 */

interface SelectCtx {
  value: string | undefined;
  setValue: (v: string) => void;
  labels: Map<string, React.ReactNode>;
  open: boolean;
  /** Ichki qidiruv (12 tadan ko'p bandda) — kichik harfda */
  query: string;
  setQuery: (q: string) => void;
}

/** Native select uchun tokenli ko'rinish; OS select xulqi kerak bo'lgan oddiy forma maydonlari uchun. */
export function SelectField({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      data-slot="select-field"
      className={cn(controlClass, "cursor-pointer pr-3", className)}
      {...props}
    />
  );
}

/** Shundan ko'p band bo'lsa ro'yxat tepasida qidiruv chiqadi (kurs, o'qituvchi, guruh ko'payganda) */
const SEARCH_FROM = 12;

/** Band nomidagi matn (qidiruv uchun): satr, son yoki ichma-ich elementlardagi matn */
function nodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

const matches = (node: React.ReactNode, query: string) => !query || nodeText(node).toLocaleLowerCase().includes(query);

const SelectContext = React.createContext<SelectCtx | null>(null);

function useSelect() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select ichida ishlatilishi kerak");
  return ctx;
}

/** Yopiq paytda ham tanlangan band nomini ko'rsatish uchun SelectItem'larni oldindan yig'amiz. */
function collectLabels(node: React.ReactNode, out: Map<string, React.ReactNode>) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement<{ value?: string; children?: React.ReactNode }>(child)) return;
    if (child.type === SelectItem && child.props.value !== undefined) out.set(child.props.value, child.props.children);
    else collectLabels(child.props.children, out);
  });
}

export function Select({
  value: valueProp,
  defaultValue,
  onValueChange,
  onOpenChange,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [inner, setInner] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const value = valueProp ?? inner;
  const labels = React.useMemo(() => {
    const m = new Map<string, React.ReactNode>();
    collectLabels(children, m);
    return m;
  }, [children]);
  const setValue = React.useCallback(
    (v: string) => {
      if (valueProp === undefined) setInner(v);
      onValueChange?.(v);
    },
    [valueProp, onValueChange],
  );
  return (
    <SelectContext.Provider value={{ value, setValue, labels, open, query, setQuery }}>
      <DropdownMenu
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setQuery(""); // har ochilishda qidiruv toza
          onOpenChange?.(o);
        }}
      >
        {children}
      </DropdownMenu>
    </SelectContext.Provider>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, labels } = useSelect();
  const label = value !== undefined ? labels.get(value) : undefined;
  return label !== undefined ? <span>{label}</span> : <span data-placeholder="">{placeholder}</span>;
}

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<"button">) {
  return (
    <DropdownMenuTrigger
      popup="listbox"
      role="combobox"
      className={cn(
        controlClass,
        "group flex cursor-pointer items-center justify-between gap-2 pr-3 text-left [&>[data-placeholder]]:text-placeholder",
        "data-[state=open]:border-(--ring-border) data-[state=open]:shadow-(--ring-shadow)",
        "[&>span]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </DropdownMenuTrigger>
  );
}

export function SelectContent({
  className,
  children,
  searchPlaceholder = "Qidirish...",
  emptyText = "Topilmadi",
}: {
  className?: string;
  children: React.ReactNode;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const { labels, open, query, setQuery } = useSelect();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const searchable = labels.size > SEARCH_FROM;
  // Panel ochilish animatsiyasidan keyin (boshida ko'rinmas bo'ladi) fokus qidiruvga o'tadi
  React.useEffect(() => {
    if (!open || !searchable) return;
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [open, searchable]);
  const none = searchable && query !== "" && ![...labels.values()].some((l) => matches(l, query));
  return (
    <DropdownMenuContent role="listbox" matchTriggerWidth className={className}>
      {searchable ? (
        <div className="sticky -top-1 z-10 -mx-1 -mt-1 mb-1 border-b border-border-soft bg-popover p-1.5">
          <label className="flex h-8 items-center gap-2 rounded-control border border-border bg-background px-2.5 focus-within:border-(--ring-border)">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value.toLocaleLowerCase())}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      ) : null}
      {children}
      {none ? <div className="px-2.5 py-2 text-body text-muted-foreground">{emptyText}</div> : null}
    </DropdownMenuContent>
  );
}

export function SelectItem({
  value,
  className,
  hidden,
  children,
}: {
  value: string;
  className?: string;
  /** Qidiruvga mos kelmadi: ro'yxatda ko'rinmaydi (tanlangan nom yo'qolmasligi uchun o'chirilmaydi) */
  hidden?: boolean;
  children: React.ReactNode;
}) {
  const { value: selected, setValue, query } = useSelect();
  const on = selected === value;
  return (
    <DropdownMenuItem
      role="option"
      aria-selected={on}
      hidden={hidden || !matches(children, query.trim())}
      onSelect={() => setValue(value)}
      className={cn("relative pr-8", on && "text-primary-text data-highlighted:text-primary-text", className)}
    >
      <span className="truncate">{children}</span>
      {on ? <Check className="absolute right-2.5 text-primary-text!" /> : null}
    </DropdownMenuItem>
  );
}

export const SelectGroup = React.Fragment;
