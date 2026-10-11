/*
 * Sirlarni logdan yashirish (CLAUDE.md: "Sirni logga yozma"). Deploy logi bazaga yoziladi va
 * panelda ko'rsatiladi, shuning uchun har qator saqlanishidan oldin shu yerdan o'tadi.
 */

const MASK = "••••••";

/** Ma'lum sir qiymatlarini va tanish ko'rinishdagi tokenlarni yashiradi. */
export function redact(line: string, secrets: readonly string[] = []): string {
  let out = line;
  // Uzunidan boshlab: biri ikkinchisining ichida bo'lsa ham to'liq yashirinadi
  for (const secret of [...secrets].filter((s) => s.length >= 4).sort((a, b) => b.length - a.length)) {
    out = out.split(secret).join(MASK);
  }
  return (
    out
      // postgres://user:PAROL@host → parol qismi
      .replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+(@)/gi, `$1${MASK}$2`)
      // GitHub tokenlari
      .replace(/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]{16,}/g, `$1${MASK}`)
      // Authorization: Bearer ...
      .replace(/(\bBearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi, `$1${MASK}`)
      // KEY=..., TOKEN=..., PASSWORD=..., SECRET=... ko'rinishidagi muhit o'zgaruvchilari
      .replace(/\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*=)(\S+)/g, `$1${MASK}`)
  );
}

/** Juda uzun qatorlar bazani to'ldirmasligi uchun qirqiladi. */
export function clip(line: string, max = 2000): string {
  return line.length > max ? `${line.slice(0, max)}… (+${line.length - max} belgi)` : line;
}
