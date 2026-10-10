import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap select-none",
    "transition-[background,color,border-color,box-shadow,transform] duration-200 ease-out",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Hamma matnli tugmalarda 1px chegara (primary/danger'da shaffof) — bir xil matnda kengligi bir xil
        primary: "btn-primary-surface type-btn rounded-btn border border-transparent",
        ghost: [
          "type-btn rounded-btn border",
          "border-(--btn-ghost-border) bg-(--btn-ghost-bg) text-(--btn-ghost-fg)",
          "hover:border-(--btn-ghost-border-hover) hover:bg-(--btn-ghost-bg-hover) hover:text-(--btn-ghost-fg-hover)",
        ],
        danger: "btn-danger-surface type-btn rounded-btn border border-transparent",
        icon: [
          "rounded-btn border",
          "border-(--icon-btn-border) bg-(--icon-btn-bg) text-(--icon-btn-fg)",
          "hover:border-(--icon-btn-hover-border) hover:bg-(--icon-btn-hover-bg) hover:text-(--icon-btn-hover-fg)",
          "hover:transform-(--icon-btn-hover-transform)",
        ],
        subtle: "rounded-btn text-muted-foreground hover:bg-secondary hover:text-foreground",
      },
      size: {
        default: "h-(--control-h) px-(--btn-px)",
        sm: "h-(--control-h-sm) px-3 [&_svg]:size-3.5",
        icon: "size-(--control-h) [&_svg]:size-[17px]",
        "icon-sm": "size-(--control-h-sm) [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type = "button", ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
