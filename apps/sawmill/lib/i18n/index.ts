import { ru } from "./ru";
import { type TranslationKey, uz } from "./uz";

export type Locale = "uz" | "ru";

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  uz,
  ru,
};

export function t(key: TranslationKey, locale: Locale = "uz"): string {
  return translations[locale]?.[key] ?? translations.uz[key] ?? key;
}

export { type TranslationKey };
