// WCAG kontrast hisobi: ventura.css tokenlarini o'qiydi (light va dark), var(), color-mix(),
// oklch(from …) va gradient bo'laklarini hisoblab, juft ranglar nisbatini beradi.
// Test (contrast.test.ts) va qo'lda tekshiruv uchun; brauzersiz ishlaydi.

export type Rgba = { r: number; g: number; b: number; a: number }; // r,g,b: 0..255, a: 0..1
export type Mode = "light" | "dark";

const NAMED: Record<string, Rgba> = {
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

/** Izohlarni olib tashlab, [data-brand="ventura"] bloklaridan o'zgaruvchilarni yig'adi. */
export function parseTokens(css: string): { light: Map<string, string>; dark: Map<string, string> } {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  const re = /\[data-brand="ventura"\](\.dark)?\s*\{([^{}]*)\}/g;
  for (const m of clean.matchAll(re)) {
    const target = m[1] ? dark : light;
    for (const decl of splitTop(m[2]!, ";")) {
      const i = decl.indexOf(":");
      if (i < 0) continue;
      const name = decl.slice(0, i).trim();
      if (name.startsWith("--")) target.set(name, decl.slice(i + 1).trim());
    }
  }
  return { light, dark };
}

/** Dark rejimida dark bloki ustiga light qiymatlari (override qilinmaganlar) qo'shiladi. */
export function tokensFor(css: string, mode: Mode): Map<string, string> {
  const { light, dark } = parseTokens(css);
  return mode === "light" ? light : new Map([...light, ...dark]);
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// ---- rang bo'shliqlari ----
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

type Lab = [number, number, number];

function toOklab(c: Rgba): Lab {
  const r = toLinear(c.r / 255);
  const g = toLinear(c.g / 255);
  const b = toLinear(c.b / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Lab, alpha: number): Rgba {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [r, g, bl] = lin.map((v) => Math.min(1, Math.max(0, fromLinear(v))) * 255) as [number, number, number];
  return { r, g, b: bl, a: alpha };
}

function parseHex(h: string): Rgba | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(h);
  if (!m) return null;
  let x = m[1]!;
  if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join("");
  if (x.length !== 6 && x.length !== 8) return null;
  return {
    r: parseInt(x.slice(0, 2), 16),
    g: parseInt(x.slice(2, 4), 16),
    b: parseInt(x.slice(4, 6), 16),
    a: x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1,
  };
}

function evalChannel(expr: string, base: Record<string, number>): number {
  const e = expr.trim();
  if (e in base) return base[e]!;
  const m = /^calc\(\s*(\w+)\s*([+-])\s*([\d.]+)\s*\)$/.exec(e);
  if (!m) throw new Error(`calc() tushunarsiz: ${expr}`);
  const v = base[m[1]!]! + (m[2] === "+" ? 1 : -1) * Number(m[3]);
  return v;
}

/** Qiymatni rang(lar)ga aylantiradi. Gradient bo'lsa — barcha bo'laklari. */
export function resolveColors(value: string, vars: Map<string, string>, depth = 0): Rgba[] {
  if (depth > 12) throw new Error(`var() sikli: ${value}`);
  const v = value.trim();
  if (v in NAMED) return [NAMED[v]!];
  const hex = parseHex(v);
  if (hex) return [hex];

  let m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
  if (m) {
    const next = vars.get(m[1]!);
    if (next === undefined) throw new Error(`token yo'q: ${m[1]}`);
    return resolveColors(next, vars, depth + 1);
  }

  m = /^rgba?\(([^)]*)\)$/.exec(v);
  if (m) {
    const parts = m[1]!
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return [{ r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts[3] ?? 1 }];
  }

  m = /^color-mix\((.*)\)$/s.exec(v);
  if (m) {
    const [space, ...rest] = splitTop(m[1]!, ",").map((s) => s.trim());
    const parse = (s: string) => {
      const pm = /^(.*?)(?:\s+([\d.]+)%)?$/s.exec(s)!;
      return { color: resolveColors(pm[1]!, vars, depth + 1)[0]!, pct: pm[2] === undefined ? null : Number(pm[2]) };
    };
    const p1 = parse(rest[0]!);
    const p2 = parse(rest[1]!);
    let w1 = p1.pct ?? (p2.pct === null ? 50 : 100 - p2.pct);
    let w2 = p2.pct ?? 100 - w1;
    if (p1.pct !== null && p2.pct === null) w2 = 100 - w1;
    w1 /= 100;
    w2 /= 100;
    const alpha = p1.color.a * w1 + p2.color.a * w2;
    const mix = (x: number, y: number) => (alpha === 0 ? 0 : (x * p1.color.a * w1 + y * p2.color.a * w2) / alpha);
    if (space === "in srgb") {
      return [
        { r: mix(p1.color.r, p2.color.r), g: mix(p1.color.g, p2.color.g), b: mix(p1.color.b, p2.color.b), a: alpha },
      ];
    }
    if (space === "in oklab") {
      const a = toOklab(p1.color);
      const b = toOklab(p2.color);
      return [fromOklab([mix(a[0], b[0]), mix(a[1], b[1]), mix(a[2], b[2])], alpha)];
    }
    throw new Error(`color-mix bo'shlig'i qo'llanmaydi: ${space}`);
  }

  m = /^oklch\(\s*from\s+(.+?)\s+(calc\([^)]*\)|[lch])\s+(calc\([^)]*\)|[lch])\s+(calc\([^)]*\)|[lch])\s*\)$/s.exec(v);
  if (m) {
    const [L, a, b] = toOklab(resolveColors(m[1]!, vars, depth + 1)[0]!);
    const base = { l: L, c: Math.hypot(a, b), h: (Math.atan2(b, a) * 180) / Math.PI };
    const l2 = evalChannel(m[2]!, base);
    const c2 = evalChannel(m[3]!, base);
    const h2 = (evalChannel(m[4]!, base) * Math.PI) / 180;
    return [fromOklab([l2, c2 * Math.cos(h2), c2 * Math.sin(h2)], 1)];
  }

  m = /^linear-gradient\((.*)\)$/s.exec(v);
  if (m) {
    const parts = splitTop(m[1]!, ",").map((s) => s.trim());
    return parts.filter((p) => !/^\d+deg$/.test(p)).flatMap((p) => resolveColors(p, vars, depth + 1));
  }

  throw new Error(`rang tushunarsiz: ${value}`);
}

/** Yarim shaffof rangni tagidagi (shaffof bo'lmagan) rang ustiga qo'yadi. */
export function over(top: Rgba, under: Rgba): Rgba {
  const a = top.a + under.a * (1 - top.a);
  const ch = (t: number, u: number) => (a === 0 ? 0 : (t * top.a + u * under.a * (1 - top.a)) / a);
  return { r: ch(top.r, under.r), g: ch(top.g, under.g), b: ch(top.b, under.b), a };
}

export function luminance(c: Rgba): number {
  return 0.2126 * toLinear(c.r / 255) + 0.7152 * toLinear(c.g / 255) + 0.0722 * toLinear(c.b / 255);
}

export function ratio(fg: Rgba, bg: Rgba): number {
  const f = over(fg, bg);
  const l1 = luminance(f);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export const toHex = (c: Rgba) =>
  `#${[c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
