"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

const boxBase = cn(
  "peer grid size-[18px] shrink-0 cursor-pointer place-items-center border border-input bg-input-bg outline-none",
  "transition-[background,border-color,box-shadow] duration-150 hover:border-(--input-hover)",
  "focus-visible:border-(--ring-border) focus-visible:shadow-(--ring-shadow)",
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root className={cn(boxBase, "rounded-check", className)} {...props}>
      <CheckboxPrimitive.Indicator className="text-primary-foreground">
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export const RadioGroup = ({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Root>) => (
  <RadioPrimitive.Root className={cn("grid gap-2", className)} {...props} />
);

export function Radio({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(boxBase, "rounded-full data-[state=checked]:bg-input-bg", className)}
      {...props}
    >
      <RadioPrimitive.Indicator className="size-2 rounded-full bg-primary" />
    </RadioPrimitive.Item>
  );
}

/** Kartochka ko'rinishidagi radio: sarlavha + izoh, tanlanganda chegara va fon urg'u rangida. */
export function RadioCard({
  value,
  title,
  description,
  className,
}: {
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-control border border-border p-3 transition-colors",
        "hover:bg-accent has-data-[state=checked]:border-(--ring-border) has-data-[state=checked]:bg-primary-soft",
        className,
      )}
    >
      <Radio id={id} value={value} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-body font-semibold text-foreground">{title}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}

/** Checkbox yoki switch yonidagi yozuv va izoh. */
export function ChoiceField({
  control,
  label,
  description,
  className,
}: {
  control: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", className)}>
      <span className="pt-px">{control}</span>
      <span className="min-w-0">
        <span className="block text-body font-semibold text-foreground">{label}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </label>
  );
}
