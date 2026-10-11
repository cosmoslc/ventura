"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { FormState } from "./actions";

/** Amal muvaffaqiyatli bo'lsa, brauzer `state.next` manziliga o'tadi (sabab: actions.ts dagi FormState izohi). */
export function useFormNext(state: FormState) {
  const router = useRouter();
  useEffect(() => {
    if (state.next) router.replace(state.next);
  }, [state, router]);
}
