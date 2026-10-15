import type { CenterContacts } from "@/lib/center-settings";

/** Ariza sahifasi pastidagi aloqa: ish vaqti, telefonlar, manzil va havolalar ("Markaz sozlamalari"dan); bo'sh bo'lsa chizilmaydi */
export function ApplyContacts({ contacts }: { contacts: CenterContacts }) {
  const { phones, address, links, hours } = contacts;
  if (!phones.length && !address && !links.length && !hours) return null;
  const a = "font-medium text-foreground hover:underline";
  return (
    <div className="mt-6 space-y-1.5 text-center text-caption text-muted-foreground">
      {hours ? <p>{hours}</p> : null}
      {address ? <p>{address}</p> : null}
      {phones.length ? (
        <p className="flex flex-wrap justify-center gap-x-4">
          {phones.map((p) => (
            <a key={p.href} href={p.href} className={a}>
              {p.label}
            </a>
          ))}
        </p>
      ) : null}
      {links.length ? (
        <p className="flex flex-wrap justify-center gap-x-4">
          {links.map((l) => (
            <a key={l.kind} href={l.href} target="_blank" rel="noopener noreferrer" className={a}>
              {l.label}
            </a>
          ))}
        </p>
      ) : null}
    </div>
  );
}
