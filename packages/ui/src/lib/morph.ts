/**
 * "Bosilgan tugmadan morph" animatsiyasi uchun umumiy yordamchilar.
 */

export const MORPH_EASE = "cubic-bezier(.32,.72,0,1)";

export interface OriginRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Origin {
  rect: OriginRect;
  radius: string;
}

/** Modal, dialog va overlay ichidagi bosishlar trigger hisoblanmaydi. */
export const MODAL_IGNORE_SELECTOR = "[data-modal], [role='dialog'], [aria-modal='true']";

const last: { element: HTMLElement | null; origin: Origin | null; timestamp: number } = {
  element: null,
  origin: null,
  timestamp: 0,
};

function toOrigin(el: Element): Origin | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return {
    rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    radius: getComputedStyle(el).borderRadius || "16px",
  };
}

let installed = false;

/** Har pointerdown'da oxirgi bosilgan tugmani eslab qoladi (bir marta o'rnatiladi). */
export function installTriggerRecorder() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  document.addEventListener(
    "pointerdown",
    (e) => {
      const raw = e.target;
      const target = raw instanceof HTMLElement ? raw : raw instanceof SVGElement ? raw.parentElement : null;
      if (!target || target.closest(MODAL_IGNORE_SELECTOR)) return;
      const trigger =
        target.closest<HTMLElement>("button, a, [role='button'], [role='menuitem'], [data-trigger]") ?? target;
      const origin = toOrigin(trigger);
      if (!origin) return;
      last.element = trigger;
      last.origin = origin;
      last.timestamp = Date.now();
    },
    true,
  );
}

/**
 * Modal qayerdan o'sib chiqishini topadi:
 * 1) aniq berilgan element, 2) oxirgi bosilgan tugma, 3) bosish paytidagi suratga olingan o'lcham
 * (tugma qayta chizilgan bo'lsa), 4) fokusdagi element. Ishlatilgandan keyin tozalanadi.
 */
export function consumeOrigin(explicit?: HTMLElement | null): Origin | null {
  let origin: Origin | null = null;
  if (explicit?.isConnected) origin = toOrigin(explicit);
  if (!origin && last.element?.isConnected && !last.element.closest(MODAL_IGNORE_SELECTOR))
    origin = toOrigin(last.element);
  if (!origin && last.origin && Date.now() - last.timestamp < 3000) origin = last.origin;
  const active = document.activeElement;
  if (!origin && active instanceof HTMLElement && active !== document.body && !active.closest(MODAL_IGNORE_SELECTOR)) {
    origin = toOrigin(active);
  }
  last.element = null;
  last.origin = null;
  last.timestamp = 0;
  return origin;
}

/** Bir xil masshtab: s = sqrt(sx * sy), matn cho'zilmasdan kichrayadi. */
export function uniformScale(from: { width: number; height: number }, to: { width: number; height: number }) {
  const sx = to.width > 0 ? from.width / to.width : 1;
  const sy = to.height > 0 ? from.height / to.height : 1;
  return Math.sqrt(Math.max(0.01, sx * sy));
}

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
