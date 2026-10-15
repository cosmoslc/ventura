import qrcode from "qrcode-generator";

/**
 * Matndan QR kod: bitta SVG `path` (qora kataklar) va tomon uzunligi. Xato tuzatish darajasi M — chekni qayta
 * nusxalaganda ham o'qiladi. Juda uzun matn sig'masa — `null`.
 */
export function qrPath(text: string): { size: number; d: string } | null {
  if (!text) return null;
  try {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { size, d };
  } catch {
    return null;
  }
}
