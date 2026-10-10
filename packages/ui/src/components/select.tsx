"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
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
}

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
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  const [inner, setInner] = React.useState(defaultValue);
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
    <SelectContext.Provider value={{ value, setValue, labels }}>
      <DropdownMenu>{children}</DropdownMenu>
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

export function SelectContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <DropdownMenuContent role="listbox" matchTriggerWidth className={className}>
      {children}
    </DropdownMenuContent>
  );
}

export function SelectItem({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const { value: selected, setValue } = useSelect();
  const on = selected === value;
  return (
    <DropdownMenuItem
      role="option"
      aria-selected={on}
      onSelect={() => setValue(value)}
      className={cn("relative pr-8", on && "text-primary-text data-highlighted:text-primary-text", className)}
    >
      <span className="truncate">{children}</span>
      {on ? <Check className="absolute right-2.5 text-primary-text!" /> : null}
    </DropdownMenuItem>
  );
}

export const SelectGroup = React.Fragment;
