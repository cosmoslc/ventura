import Link from "next/link";
import { currentTenant } from "@/lib/server/tenant";
import { uz } from "@/lib/uz";

/** Notanish domen yoki yopiq/mavjud bo'lmagan sahifa. */
export default async function NotFound() {
  const tenant = await currentTenant();
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="type-heading text-title text-foreground">{tenant ? uz.notFoundTitle : uz.unknownTitle}</h1>
        <p className="mt-1 text-body text-muted-foreground">{tenant ? uz.notFoundHint : uz.unknownHint}</p>
        {tenant ? (
          <Link href="/" className="mt-4 inline-block text-body font-semibold text-primary-text hover:underline">
            {uz.section.toHome}
          </Link>
        ) : null}
      </div>
    </main>
  );
}
