/**
 * Logotip faylini tekshirish va optimallashtirish (client-side):
 * - Format: PNG, JPEG, WebP, SVG
 * - Hajmi: maks 2 MB
 * - Katta rasmlarni (masalan, telefon kamerasi surati) 512x512 canvas orqali siqadi
 * - Natija: Data URL (base64)
 */
export function processLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      reject(new Error("Faqat PNG, JPG, WebP yoki SVG formatdagi rasmlar qabul qilinadi"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error("Rasm hajmi 2 MB dan oshmasligi kerak"));
      return;
    }

    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Faylni o'qishda xatolik yuz berdi"));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Faylni o'qishda xatolik yuz berdi"));
    reader.readAsDataURL(file);
  });
}
