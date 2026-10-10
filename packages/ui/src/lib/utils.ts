import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// theme.css dagi qo'shimcha matn o'lchamlari — aks holda twMerge ularni rang deb o'ylab text-foreground bilan to'qnashtiradi
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["2xs", "caption", "body", "title"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
