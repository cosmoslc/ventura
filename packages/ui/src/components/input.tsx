import * as React from "react";
import { cn } from "../lib/utils";

export const controlClass = cn(
  "h-(--control-h) w-full min-w-0 rounded-control border border-input bg-input-bg px-4 text-sm text-foreground",
  "placeholder:text-placeholder outline-none transition-[border-color,box-shadow] duration-150",
  "hover:border-(--input-hover)",
  "focus-visible:border-(--ring-border) focus-visible:shadow-(--ring-shadow) focus-visible:outline-none",
  "aria-invalid:border-(--danger-fg) aria-invalid:shadow-(--error-ring)",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export function Input({ className, icon, ...props }: InputProps) {
  if (!icon) return <input data-slot="input" className={cn(controlClass, className)} {...props} />;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-placeholder [&_svg]:size-4">
        {icon}
      </span>
      <input data-slot="input" className={cn(controlClass, "pl-9", className)} {...props} />
    </div>
  );
}
