import * as React from "react";
import { Avatar } from "./avatar";
import { cn } from "../lib/utils";

/*
 * RankList — qisqa reyting (STYLE.md 11.38): o'rin belgisi, avatar, ism va ixtiyoriy qiymat. Birinchi uch o'rin
 * ohang bilan ajratiladi. `self` — ro'yxatda bo'lmasa ham xodimning o'z o'rni pastda ("Siz: 7 / 12").
 * Qiymatni ko'rsatmaslik mumkin (masalan, boshqa o'qituvchilar raqamlari yashirin).
 */

export interface RankItem {
  id: string;
  name: string;
  /** O'ngdagi qiymat (berilmasa — faqat o'rin) */
  value?: string;
  /** Xodimning o'zi — ajratib ko'rsatiladi */
  me?: boolean;
}

const PLACE = [
  "bg-(--warning-bg) text-(--warning-fg) border-(--warning-border)",
  "bg-muted text-foreground border-border",
  "bg-(--info-bg) text-(--info-fg) border-(--info-border)",
];

function Place({ n }: { n: number }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border font-mono text-caption font-bold",
        PLACE[n - 1] ?? "border-border-soft text-muted-foreground",
      )}
    >
      {n}
    </span>
  );
}

export function RankList({
  items,
  self,
  emptyLabel,
  className,
}: {
  items: readonly RankItem[];
  /** O'z o'rni: ro'yxatda yo'q bo'lsa pastda chiqadi */
  self?: { place: number; total: number; label: string } | null;
  emptyLabel?: string;
  className?: string;
}) {
  const selfShown = self && items.some((i) => i.me);
  return (
    <div className={cn("space-y-1.5", className)}>
      {items.length ? (
        <ol className="space-y-1.5">
          {items.map((it, i) => (
            <li
              key={it.id}
              className={cn(
                "flex items-center gap-2.5 rounded-control border border-transparent px-2 py-1.5",
                it.me && "border-(--ring-border) bg-primary-soft",
              )}
            >
              <Place n={i + 1} />
              <Avatar name={it.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{it.name}</span>
              {it.value ? (
                <span className="font-mono text-caption font-bold text-foreground tabular-nums">{it.value}</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : emptyLabel ? (
        <div className="py-4 text-center text-caption text-muted-foreground">{emptyLabel}</div>
      ) : null}
      {self && !selfShown ? (
        <div className="flex items-center justify-between gap-2 border-t border-border-soft px-2 pt-2 text-caption">
          <span className="text-muted-foreground">{self.label}</span>
          <span className="font-mono font-bold text-primary-text">
            {self.place} / {self.total}
          </span>
        </div>
      ) : null}
    </div>
  );
}
