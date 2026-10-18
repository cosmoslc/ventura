/*
 * SMS qismlari hisobi (GSM-7: 160 / 153 belgi, UCS-2: 70 / 67; kengaytirilgan belgilar 2 ta). Markaz ilovasi
 * (hisoblagich, navbat) ham, panel (Ventura paketi — qismlarni band qilish) ham shu funksiyadan foydalanadi.
 */

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

export interface SmsParts {
  /** Belgilar (GSM-7 da kengaytirilgan belgi 2 ta hisoblanadi) */
  length: number;
  parts: number;
  unicode: boolean;
  /** Joriy qism chegarasi (160 / 153 / 70 / 67) */
  perPart: number;
}

export function smsParts(text: string): SmsParts {
  let gsm = 0;
  let unicode = false;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) gsm += 1;
    else if (GSM_EXT.includes(ch)) gsm += 2;
    else {
      unicode = true;
      break;
    }
  }
  if (unicode) {
    const length = text.length; // UTF-16 birliklari
    const perPart = length <= 70 ? 70 : 67;
    return { length, parts: Math.max(1, Math.ceil(length / perPart)), unicode, perPart };
  }
  const perPart = gsm <= 160 ? 160 : 153;
  return { length: gsm, parts: Math.max(1, Math.ceil(gsm / perPart)), unicode, perPart };
}
