import type { Metadata, Viewport } from "next";
import { themeInitScript } from "@ventura/ui/lib/theme";
import { Toaster } from "@ventura/ui/toast";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { CartProvider } from "@/lib/cart-context";
import { LikedProvider } from "@/lib/liked-context";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#3f6df6",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Kompyuter va Texnika Do'koni",
  description: "Onlayn kompyuter va elektronika do'koni, PC konfigurator va boshqaruv tizimi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-brand="ventura" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-[family-name:var(--font-quicksand)]">
        <CartProvider>
          <LikedProvider>
            {children}
            <CartDrawer />
            <Toaster />
          </LikedProvider>
        </CartProvider>
      </body>
    </html>
  );
}
