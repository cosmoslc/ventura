"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

/** Sahifa ma'lumotini vaqti-vaqti bilan serverdan qayta oladi (yashirin tabda — yo'q). */
export function useAutoRefresh(ms: number) {
  const router = useRouter();
  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => clearInterval(id);
  }, [ms, router]);
}
