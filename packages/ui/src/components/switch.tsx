"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

/** Yoqish/o'chirish — bo'limlar (features) va sozlamalar uchun. */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        // 36×20, padding 2px → ichki joy aniq 32×16: 16px doira markazda, yoqilganda 16px suriladi
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none",
        "bg-(--input-hover) transition-colors duration-200 ease-ios data-[state=checked]:bg-primary",
        "focus-visible:shadow-(--ring-shadow) disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-[0_0.5px_1.5px_rgb(0_0_0/0.2)]",
          "transition-transform duration-200 ease-ios data-[state=checked]:translate-x-4",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
