import { Logo } from "@ventura/ui/logo";
import { ThemeToggle } from "@ventura/ui/theme-toggle";
import { uz } from "@/lib/uz";

/** Kirish sahifalari: shell'siz, markazda kartochka. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo subtitle={uz.app.subtitle} />
        </div>
        {children}
      </div>
    </div>
  );
}
