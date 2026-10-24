import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@ventura/ui/button";

export default function BolimYopiqPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-muted)] mb-4">
        <AlertCircle className="w-8 h-8 text-amber-500" />
      </div>
      <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Bu bo'lim yoqilmagan</h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
        Ushbu imkoniyatdan foydalanish uchun uni Ventura boshqaruv panelida loyiha bo'limlaridan faollashtiring.
      </p>
      <Button asChild>
        <Link href="/">Bosh sahifaga qaytish</Link>
      </Button>
    </div>
  );
}
