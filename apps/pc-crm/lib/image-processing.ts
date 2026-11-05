/**
 * Ventura PC-CRM: Brauzerda ishlovchi yuqori tezlikdagi aqlli fon tozalagich (Smart Matting & Flood-Fill).
 * Tashqi API kalitsiz ham mahsulot suratlaridan bir xil yoki och/oq/kulrang fonni
 * to'liq olib tashlab, shaffof WebP holatiga keltiradi.
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface SmartMattingOptions {
  targetColor?: ColorRGB;
  tolerance?: number; // 5 dan 90 gacha (odatiy: 35)
  feather?: number; // 0 dan 10 gacha (odatiy: 2)
  mode?: "flood-fill" | "global"; // flood-fill ichki oq elementlarni asraydi
}

export interface MattingResult {
  removedPixels: number;
  totalPixels: number;
  percentRemoved: number;
  detectedColor: ColorRGB;
}

/** Ranglar orasidagi masofa (Evklid formulasi) */
export function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Rasmni xavfsiz yuklab beruvchi yordamchi (CORS blokirovkasidan himoya bilan) */
export function loadImageSafely(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    // Agar rasm tashqi domenda bo'lsa va dataURL bo'lmasa, proksi orqali yuklash
    const isExternal =
      src.startsWith("http://") || src.startsWith("https://");
    const isCurrentOrigin =
      typeof window !== "undefined" && src.startsWith(window.location.origin);

    const finalSrc =
      isExternal && !isCurrentOrigin
        ? `/api/uploads/proxy?url=${encodeURIComponent(src)}`
        : src;

    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Rasmni yuklab bo'lmadi: ${String(err)}`));
    img.src = finalSrc;
  });
}

/** 4 ta burchakdan eng asosiy fon rangini aniqlash */
export function detectCornerBackgroundColor(imgData: ImageData): ColorRGB {
  const { data, width, height } = imgData;

  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
    { x: Math.floor(width / 2), y: 0 },
  ];

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (const { x, y } of corners) {
    const idx = (y * width + x) * 4;
    // faqat to'liq ko'rinadigan piksellar
    if (data[idx + 3]! > 128) {
      sumR += data[idx]!;
      sumG += data[idx + 1]!;
      sumB += data[idx + 2]!;
      count++;
    }
  }

  if (count === 0) {
    return { r: 255, g: 255, b: 255 }; // odatiy oq
  }

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  };
}

/**
 * Asosiy aqlli fon tozalash funksiyasi.
 * O'zgartirishlarni to'g'ridan-to'g'ri targetCanvas ga chizadi.
 */
export function applySmartMatting(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  options: SmartMattingOptions = {}
): MattingResult {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  targetCanvas.width = width;
  targetCanvas.height = height;

  const srcCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const tgtCtx = targetCanvas.getContext("2d", { willReadFrequently: true });

  if (!srcCtx || !tgtCtx) {
    throw new Error("Canvas context topilmadi");
  }

  const srcData = srcCtx.getImageData(0, 0, width, height);
  const tgtData = tgtCtx.createImageData(width, height);

  // Dastlabki nusxa
  tgtData.data.set(srcData.data);

  const {
    tolerance = 35,
    feather = 2,
    mode = "flood-fill",
  } = options;

  const targetColor =
    options.targetColor ?? detectCornerBackgroundColor(srcData);

  const data = tgtData.data;
  const totalPixels = width * height;
  let removedPixels = 0;

  if (mode === "global") {
    // Butun rasm bo'ylab rangni o'chirish
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;

      const dist = colorDistance(r, g, b, targetColor.r, targetColor.g, targetColor.b);

      if (dist <= tolerance) {
        data[idx + 3] = 0; // to'liq shaffof
        removedPixels++;
      } else if (dist < tolerance + feather) {
        // Yumshoq chegara (feathering)
        const factor = (dist - tolerance) / (feather || 1);
        data[idx + 3] = Math.round(data[idx + 3]! * factor);
      }
    }
  } else {
    // Perimetrdan boshlab BFS Flood-Fill (Eng aniq usul)
    const visited = new Uint8Array(totalPixels);
    const queue: number[] = [];

    // Chegara piksellarini navbatga qo'shish
    for (let x = 0; x < width; x++) {
      // Tepasi va pasti
      for (const y of [0, height - 1]) {
        const i = y * width + x;
        const idx = i * 4;
        const dist = colorDistance(
          data[idx]!,
          data[idx + 1]!,
          data[idx + 2]!,
          targetColor.r,
          targetColor.g,
          targetColor.b
        );
        if (dist <= tolerance + feather) {
          visited[i] = 1;
          queue.push(x, y);
        }
      }
    }

    for (let y = 0; y < height; y++) {
      // Chap va o'ng qirralar
      for (const x of [0, width - 1]) {
        const i = y * width + x;
        if (!visited[i]) {
          const idx = i * 4;
          const dist = colorDistance(
            data[idx]!,
            data[idx + 1]!,
            data[idx + 2]!,
            targetColor.r,
            targetColor.g,
            targetColor.b
          );
          if (dist <= tolerance + feather) {
            visited[i] = 1;
            queue.push(x, y);
          }
        }
      }
    }

    // BFS aylanishi
    let head = 0;
    while (head < queue.length) {
      const cx = queue[head++]!;
      const cy = queue[head++]!;
      const i = cy * width + cx;
      const idx = i * 4;

      const dist = colorDistance(
        data[idx]!,
        data[idx + 1]!,
        data[idx + 2]!,
        targetColor.r,
        targetColor.g,
        targetColor.b
      );

      if (dist <= tolerance) {
        data[idx + 3] = 0; // to'liq shaffof
        removedPixels++;
      } else if (dist < tolerance + feather) {
        const factor = (dist - tolerance) / (feather || 1);
        data[idx + 3] = Math.round(data[idx + 3]! * factor);
      }

      // Qo'shni 4 ta piksel
      const neighbors = [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx! >= 0 && nx! < width && ny! >= 0 && ny! < height) {
          const ni = ny! * width + nx!;
          if (!visited[ni]) {
            const nidx = ni * 4;
            const ndist = colorDistance(
              data[nidx]!,
              data[nidx + 1]!,
              data[nidx + 2]!,
              targetColor.r,
              targetColor.g,
              targetColor.b
            );
            if (ndist <= tolerance + feather) {
              visited[ni] = 1;
              queue.push(nx!, ny!);
            }
          }
        }
      }
    }
  }

  tgtCtx.putImageData(tgtData, 0, 0);

  return {
    removedPixels,
    totalPixels,
    percentRemoved: Number(((removedPixels / totalPixels) * 100).toFixed(1)),
    detectedColor: targetColor,
  };
}
