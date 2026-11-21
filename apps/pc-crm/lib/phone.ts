/** Canonicalizes Uzbek phone input to E.164 for the PC CRM admin account. */
export function normalizeUzPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const national =
    digits.length === 9 ? digits : digits.startsWith("998") && digits.length === 12 ? digits.slice(3) : null;
  return national ? `+998${national}` : null;
}
