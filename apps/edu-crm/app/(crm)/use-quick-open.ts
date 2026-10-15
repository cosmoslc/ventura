"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/** Tezkor amal havolasi: `?yangi=1` (qidiruv oynasidagi "Yangi o'quvchi" va h.k., E6h). */
export const QUICK_PARAM = "yangi";

/**
 * Sahifa `?yangi=1` bilan ochilsa (yoki shu sahifada turib tezkor amal bosilsa) — forma/oyna ochiladi va parametr
 * manzildan olib tashlanadi (yangilashda qayta ochilmasin). `enabled` false bo'lsa (ruxsat yo'q) faqat tozalanadi.
 */
export function useQuickOpen(onOpen: () => void, enabled = true) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asked = params.get(QUICK_PARAM) === "1";
  const open = React.useEffectEvent(onOpen);
  React.useEffect(() => {
    if (!asked) return;
    if (enabled) open();
    router.replace(pathname, { scroll: false });
  }, [asked, enabled, pathname, router]);
}
