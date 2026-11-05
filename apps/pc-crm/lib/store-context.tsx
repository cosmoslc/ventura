"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type StoreMode = "financial" | "inventory";

export interface StoreBranding {
  name: string;
  slug: string;
  logoUrl?: string | null;
  primary?: string | null;
  appearance?: "light" | "dark" | "system";
  storeMode?: StoreMode;
  contacts?: {
    phone?: string;
    telegram?: string;
    address?: string;
    email?: string;
  };
}

const DEFAULT_BRANDING: StoreBranding = {
  name: "Ventura PC",
  slug: "ventura-pc",
  logoUrl: null,
  primary: null,
  appearance: "system",
  storeMode: "financial",
  contacts: {
    phone: "+998 71 200 00 00",
    telegram: "@venturapc_operator",
    address: "Toshkent shahri, Yunusobod tumani",
    email: "info@venturapc.uz",
  },
};

interface StoreContextValue {
  branding: StoreBranding;
  isFinancial: boolean;
  setBranding: (branding: StoreBranding) => void;
  setStoreMode: (mode: StoreMode) => void;
}

const StoreContext = createContext<StoreContextValue>({
  branding: DEFAULT_BRANDING,
  isFinancial: true,
  setBranding: () => {},
  setStoreMode: () => {},
});

export function StoreProvider({
  initialBranding,
  children,
}: {
  initialBranding?: StoreBranding | null;
  children: React.ReactNode;
}) {
  const [branding, setBranding] = useState<StoreBranding>(initialBranding ?? DEFAULT_BRANDING);

  const setStoreMode = (mode: StoreMode) => {
    setBranding((prev) => ({ ...prev, storeMode: mode }));
  };

  const isFinancial = branding.storeMode !== "inventory";

  const value = useMemo(
    () => ({ branding, isFinancial, setBranding, setStoreMode }),
    [branding, isFinancial],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}

export function useFinancialMode(): boolean {
  const { isFinancial } = useStore();
  return isFinancial;
}
