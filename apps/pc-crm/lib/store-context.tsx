"use client";

import { createContext, useContext, useMemo, useState } from "react";

export interface StoreBranding {
  name: string;
  slug: string;
  logoUrl?: string | null;
  primary?: string | null;
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
  contacts: {
    phone: "+998 71 200 00 00",
    telegram: "@venturapc_operator",
    address: "Toshkent shahri, Yunusobod tumani",
    email: "info@venturapc.uz",
  },
};

interface StoreContextValue {
  branding: StoreBranding;
  setBranding: (branding: StoreBranding) => void;
}

const StoreContext = createContext<StoreContextValue>({
  branding: DEFAULT_BRANDING,
  setBranding: () => {},
});

export function StoreProvider({
  initialBranding,
  children,
}: {
  initialBranding?: StoreBranding | null;
  children: React.ReactNode;
}) {
  const [branding, setBranding] = useState<StoreBranding>(initialBranding ?? DEFAULT_BRANDING);

  const value = useMemo(() => ({ branding, setBranding }), [branding]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
