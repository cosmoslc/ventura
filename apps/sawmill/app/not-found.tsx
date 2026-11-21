import Link from "next/link";
import { Button } from "@ventura/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-muted)] flex items-center justify-center text-2xl font-bold text-[var(--text-muted)] mb-4">
        404
      </div>
      <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Sahifa topilmadi</h1>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">
        Siz qidirayotgan sahifa mavjud emas yoki boshqa manzilga ko'chirilgan bo'lishi mumkin.
      </p>
      <Button asChild>
        <Link href="/">Bosh sahifaga qaytish</Link>
      </Button>
    </div>
  );
}
