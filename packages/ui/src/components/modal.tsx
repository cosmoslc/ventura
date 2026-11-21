"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "../lib/utils";
import {
  consumeOrigin,
  installTriggerRecorder,
  MORPH_EASE,
  reducedMotion,
  uniformScale,
  type Origin,
} from "../lib/morph";
import { Button } from "./button";
import { Input } from "./input";
import { MORPH_LAYER_ATTR } from "./dropdown-menu";

installTriggerRecorder();

/*
 * Modal animatsiyalari:
 * - "right": o'ngdan siljiydigan panel, ochilish va yopilish 320ms, fon ham shunday so'nadi;
 * - "center" va ConfirmModal: bosilgan tugmadan morph bo'lib ochiladi (460ms) va unga qaytadi
 *   (440ms); kontent 140ms kechikish bilan 220ms da paydo bo'ladi. Tugma topilmasa — markazdan
 *   0.92 → 1 masshtab (350ms / 280ms).
 * Fokus, Escape va aria Radix Dialog'da qoladi; ochiq/yopiq holat esa animatsiya tugaguncha ushlab turiladi.
 */

/** open=false bo'lgach ham yopilish animatsiyasi tugaguncha DOM'da qoldiradi. */
function usePresence(open: boolean) {
  const [rendered, setRendered] = React.useState(open);
  // Ochilganda darhol (render paytida) — effektsiz, ortiqcha qayta chizishsiz
  if (open && !rendered) setRendered(true);
  return [rendered, () => setRendered(false)] as const;
}

/** Modal ichidagi dropdown/select (body'ga portal qilingan) modalni yopib yubormasin va fokusni to'smaydi. */
const layerSafe = {
  onPointerDownOutside: (e: { target: EventTarget | null; preventDefault: () => void }) => {
    if ((e.target as Element | null)?.closest?.(`[${MORPH_LAYER_ATTR}]`)) e.preventDefault();
  },
  onFocusOutside: (e: { target: EventTarget | null; preventDefault: () => void }) => {
    if ((e.target as Element | null)?.closest?.(`[${MORPH_LAYER_ATTR}]`)) e.preventDefault();
  },
  onInteractOutside: (e: { target: EventTarget | null; preventDefault: () => void }) => {
    if ((e.target as Element | null)?.closest?.(`[${MORPH_LAYER_ATTR}]`)) e.preventDefault();
  },
  onEscapeKeyDown: (e: KeyboardEvent) => {
    if (document.querySelector(`[${MORPH_LAYER_ATTR}="panel"][data-state="open"]`)) e.preventDefault();
  },
};

const overlayBase =
  "fixed inset-0 z-(--z-overlay) bg-(--overlay) backdrop-blur-(--overlay-blur) transition-opacity ease-ios";

/** Markaziy dialog uchun morph: ochilish (mount) va yopilish (open=false). */
function useMorphDialog(open: boolean, rendered: boolean, onClosed: () => void, originEl?: HTMLElement | null) {
  const overlay = React.useRef<HTMLDivElement>(null);
  const panel = React.useRef<HTMLDivElement | null>(null);
  // Radix Portal kontentni keyingi commit'da chizadi — panel paydo bo'lganini state orqali bilamiz
  const [panelEl, setPanelEl] = React.useState<HTMLDivElement | null>(null);
  const panelRef = React.useCallback((el: HTMLDivElement | null) => {
    panel.current = el;
    setPanelEl(el);
  }, []);
  const started = React.useRef(false);
  const content = React.useRef<HTMLDivElement>(null);
  const [contentIn, setContentIn] = React.useState(false);
  const origin = React.useRef<Origin | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const onClosedEvent = React.useEffectEvent(onClosed);
  // Yopilish boshlanganda kontent darhol yashirinadi
  if (!open && contentIn) setContentIn(false);

  const rest = (p: HTMLDivElement) =>
    Object.assign(p.style, {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "",
      height: "",
      borderRadius: "",
    });

  // Ochilish
  React.useLayoutEffect(() => {
    if (!open || !rendered || started.current) return;
    const o = overlay.current;
    const p = panel.current;
    const c = content.current;
    if (!o || !p || !c || !panelEl) return;
    started.current = true;
    clearTimeout(timer.current);
    origin.current = consumeOrigin(originEl);
    requestAnimationFrame(() => (o.style.opacity = "1"));

    p.style.transition = "none";
    rest(p);
    p.style.opacity = "1";
    if (reducedMotion()) {
      requestAnimationFrame(() => setContentIn(true));
      return;
    }

    const finalRect = p.getBoundingClientRect();
    const finalRadius = getComputedStyle(p).borderRadius;
    c.style.width = `${finalRect.width}px`;
    const from = origin.current;

    if (from) {
      const s = uniformScale(from.rect, finalRect);
      Object.assign(p.style, {
        transform: "none",
        top: `${from.rect.top}px`,
        left: `${from.rect.left}px`,
        width: `${from.rect.width}px`,
        height: `${from.rect.height}px`,
        borderRadius: from.radius,
      });
      c.style.transition = "none";
      c.style.transform = `scale(${s})`;
      void p.offsetHeight;
      const ease = `460ms ${MORPH_EASE}`;
      Object.assign(p.style, {
        transition: `top ${ease}, left ${ease}, width ${ease}, height ${ease}, border-radius ${ease}`,
        top: `${finalRect.top}px`,
        left: `${finalRect.left}px`,
        width: `${finalRect.width}px`,
        height: `${finalRect.height}px`,
        borderRadius: finalRadius,
      });
      c.style.transition = `transform ${ease}`;
      c.style.transform = "scale(1)";
    } else {
      p.style.transform = "translate(-50%, -50%) scale(0.92)";
      p.style.opacity = "0";
      void p.offsetHeight;
      const ease = `350ms ${MORPH_EASE}`;
      p.style.transition = `transform ${ease}, opacity ${ease}`;
      p.style.transform = "translate(-50%, -50%) scale(1)";
      p.style.opacity = "1";
    }
    requestAnimationFrame(() => setContentIn(true));

    // Tugagach panelni tabiiy holatiga qaytaramiz — kontent o'zgarsa o'lcham moslashadi
    timer.current = setTimeout(() => {
      if (!panel.current || !content.current) return;
      panel.current.style.transition = "none";
      rest(panel.current);
      content.current.style.width = "";
    }, 480);
    // originEl ataylab bog'liqlikda yo'q: faqat ochilish paytidagisi kerak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rendered, panelEl]);

  // Yopilish
  React.useLayoutEffect(() => {
    if (open || !rendered) return;
    started.current = false;
    const o = overlay.current;
    const p = panel.current;
    const c = content.current;
    clearTimeout(timer.current);
    if (o) o.style.opacity = "0";
    const done = (ms: number) => {
      timer.current = setTimeout(() => onClosedEvent(), ms);
    };
    if (!p || !c || reducedMotion()) return done(0);

    const from = origin.current;
    const cur = p.getBoundingClientRect();
    // Hozirgi joyida qotirib, keyin animatsiya
    Object.assign(p.style, {
      transition: "none",
      transform: "none",
      top: `${cur.top}px`,
      left: `${cur.left}px`,
      width: `${cur.width}px`,
      height: `${cur.height}px`,
      borderRadius: getComputedStyle(p).borderRadius,
    });
    c.style.width = `${cur.width}px`;
    void p.offsetHeight;

    if (from) {
      const D = 440;
      const ease = `${D}ms ${MORPH_EASE}`;
      Object.assign(p.style, {
        transition: `top ${ease}, left ${ease}, width ${ease}, height ${ease}, border-radius ${ease}, opacity ${D * 0.4}ms ease-in ${D * 0.6}ms`,
        top: `${from.rect.top}px`,
        left: `${from.rect.left}px`,
        width: `${from.rect.width}px`,
        height: `${from.rect.height}px`,
        borderRadius: from.radius,
        opacity: "0",
      });
      c.style.transition = `transform ${ease}`;
      c.style.transform = `scale(${uniformScale(from.rect, cur)})`;
      done(D);
    } else {
      const D = 280;
      const ease = `${D}ms ${MORPH_EASE}`;
      Object.assign(p.style, {
        top: `${cur.top + cur.height / 2}px`,
        left: `${cur.left + cur.width / 2}px`,
        transform: "translate(-50%, -50%)",
      });
      void p.offsetHeight;
      p.style.transition = `transform ${ease}, opacity ${ease}`;
      p.style.transform = "translate(-50%, -50%) scale(0.92)";
      p.style.opacity = "0";
      done(D);
    }
  }, [open, rendered]);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return { overlayRef: overlay, panelRef, contentRef: content, contentIn };
}

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Standart: o'ngdan chiqadigan panel (docs/design/STYLE.md, 11.16). */
  position?: "right" | "center";
  wide?: boolean;
  className?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Modal(props: ModalProps) {
  return props.position === "center" ? <CenterModal {...props} /> : <DrawerModal {...props} />;
}

function ModalHeader({ title, description, sticky }: { title: string; description?: string; sticky?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6 sm:py-5",
        sticky && "bg-popover/80 backdrop-blur",
      )}
    >
      <div className="min-w-0">
        <Dialog.Title className="type-heading text-lg leading-snug text-foreground">{title}</Dialog.Title>
        <Dialog.Description className={description ? "mt-1 text-body text-muted-foreground" : "sr-only"}>
          {description ?? title}
        </Dialog.Description>
      </div>
      <Dialog.Close asChild>
        <Button variant="icon" size="icon" aria-label="Yopish">
          <X />
        </Button>
      </Dialog.Close>
    </div>
  );
}

function ModalFooter({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-6 sm:py-5">
      {children}
    </div>
  );
}

function DrawerModal({ open, onOpenChange, title, description, wide, className, footer, children }: ModalProps) {
  const [rendered, unmount] = usePresence(open);
  const [entered, setEntered] = React.useState(false);
  if (!open && entered) setEntered(false);

  React.useEffect(() => {
    if (open && rendered) {
      const id = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(id);
    }
    if (!open && rendered) {
      const t = setTimeout(unmount, reducedMotion() ? 0 : 320);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rendered]);

  return (
    <Dialog.Root open={rendered} onOpenChange={(o) => !o && onOpenChange(false)}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-modal
          className={cn(overlayBase, "duration-[320ms]", entered ? "opacity-100" : "opacity-0")}
        />
        <Dialog.Content
          {...layerSafe}
          data-modal
          className={cn(
            "fixed inset-y-0 right-0 z-(--z-modal) flex h-full w-full flex-col border-l border-border bg-popover text-popover-foreground shadow-modal outline-none",
            wide ? "max-w-2xl" : "max-w-md sm:max-w-lg",
            "transition-transform duration-[320ms] ease-ios",
            entered ? "translate-x-0" : "translate-x-full",
            className,
          )}
        >
          <ModalHeader title={title} description={description} sticky />
          <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">{children}</div>
          <ModalFooter>{footer}</ModalFooter>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CenterModal({ open, onOpenChange, title, description, wide, className, footer, children }: ModalProps) {
  const [rendered, unmount] = usePresence(open);
  const { overlayRef, panelRef, contentRef, contentIn } = useMorphDialog(open, rendered, unmount);

  return (
    <Dialog.Root open={rendered} onOpenChange={(o) => !o && onOpenChange(false)}>
      <Dialog.Portal>
        <Dialog.Overlay
          ref={overlayRef}
          data-modal
          className={cn(overlayBase, "duration-[350ms]")}
          style={{ opacity: 0 }}
        />
        <Dialog.Content
          {...layerSafe}
          ref={panelRef}
          data-modal
          style={{ opacity: 0 }}
          className={cn(
            "fixed z-(--z-modal) max-h-[85vh] overflow-hidden rounded-modal border border-border bg-popover text-popover-foreground shadow-modal outline-none",
            wide ? "w-[min(42rem,calc(100vw-2rem))]" : "w-[min(28rem,calc(100vw-2rem))]",
            className,
          )}
        >
          <div ref={contentRef} className="flex max-h-[85vh] shrink-0 origin-center flex-col">
            <div
              className={cn(
                "flex min-h-0 flex-col transition-opacity duration-[220ms] ease-ios",
                contentIn ? "opacity-100 delay-[140ms]" : "opacity-0",
              )}
            >
              <ModalHeader title={title} description={description} />
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">{children}</div>
              <ModalFooter>{footer}</ModalFooter>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Yopilish animatsiyasi tugagach chaqiriladi. */
  onConfirm: () => void;
  /** Morph boshlanadigan element; berilmasa oxirgi bosilgan tugma olinadi. */
  originEl?: HTMLElement | null;
  /** Xavfli amal: shu matn (masalan loyiha slug'i) aynan yozilmaguncha tasdiqlash tugmasi o'chiq. */
  requireText?: string;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Ha, tasdiqlash",
  cancelLabel = "Yo'q, bekor",
  onConfirm,
  originEl,
  requireText,
}: ConfirmModalProps) {
  const [rendered, unmount] = usePresence(open);
  const [typed, setTyped] = React.useState("");
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTyped("");
  }
  const locked = !!requireText && typed.trim() !== requireText;
  const typeId = React.useId();
  const pending = React.useRef<(() => void) | null>(null);
  const { overlayRef, panelRef, contentRef, contentIn } = useMorphDialog(
    open,
    rendered,
    () => {
      unmount();
      const action = pending.current;
      pending.current = null;
      action?.();
    },
    originEl,
  );

  return (
    <Dialog.Root open={rendered} onOpenChange={(o) => !o && onOpenChange(false)}>
      <Dialog.Portal>
        <Dialog.Overlay
          ref={overlayRef}
          data-modal
          className={cn(overlayBase, "duration-[350ms]")}
          style={{ opacity: 0 }}
        />
        <Dialog.Content
          {...layerSafe}
          ref={panelRef}
          data-modal
          style={{ opacity: 0 }}
          className="fixed z-(--z-modal) w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-modal border border-border bg-popover text-popover-foreground shadow-modal outline-none"
        >
          <div ref={contentRef} className="shrink-0 origin-center">
            <div
              className={cn(
                "p-6 transition-opacity duration-[220ms] ease-ios",
                contentIn ? "opacity-100 delay-[140ms]" : "opacity-0",
              )}
            >
              <div className="mb-4 grid size-11 place-items-center rounded-stat-icon bg-(--danger-bg) text-(--danger-fg)">
                <AlertTriangle className="size-5" />
              </div>
              <Dialog.Title className="type-heading text-lg text-foreground">{title}</Dialog.Title>
              <Dialog.Description asChild>
                <div className="mt-1.5 text-body leading-relaxed text-muted-foreground">{message}</div>
              </Dialog.Description>
              {requireText ? (
                <div className="mt-4">
                  <label htmlFor={typeId} className="mb-1.5 block text-xs text-muted-foreground">
                    Tasdiqlash uchun <b className="font-mono font-semibold text-foreground">{requireText}</b> deb yozing
                  </label>
                  <Input
                    id={typeId}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                    placeholder={requireText}
                  />
                </div>
              ) : null}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Dialog.Close asChild>
                  <Button variant="ghost">{cancelLabel}</Button>
                </Dialog.Close>
                <Button
                  variant="danger"
                  disabled={locked}
                  onClick={() => {
                    pending.current = onConfirm;
                    onOpenChange(false);
                  }}
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
