import * as React from "react";
import { type ScheduleSlot, hourRange, placeDay } from "../lib/schedule";
import { cn } from "../lib/utils";

/*
 * WeekSchedule — haftalik dars jadvali (STYLE.md 11.37): tepada hafta kunlari, chapda soatlar, kataklarda dars
 * qutilari (rang chizig'i, nom va qisqa qator). Bir vaqtdagi darslar yonma-yon. Tor ekranda gorizontal siljiydi.
 * Havola ilovadan: `onSelect` (komponent Next'ga bog'lanmaydi).
 */

export interface WeekScheduleDay {
  key: string;
  label: string;
  /** Kun ostidagi kichik yozuv (sana) */
  sub?: string;
  today?: boolean;
}

export interface WeekScheduleItem extends ScheduleSlot {
  title: string;
  sub?: string;
  /** Chap chiziq rangi (guruh yoki kurs rangi) */
  color?: string;
}

/** Bir soat balandligi — hisoblangan joylashuv uchun (pikselda) */
const HOUR = 56;

export function WeekSchedule({
  days,
  items,
  onSelect,
  emptyLabel,
  className,
}: {
  days: readonly WeekScheduleDay[];
  items: readonly WeekScheduleItem[];
  onSelect?: (id: string) => void;
  /** Jadval bo'sh bo'lsa ko'rsatiladi */
  emptyLabel?: string;
  className?: string;
}) {
  const [from, to] = hourRange(items);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const height = (to - from) * HOUR;
  const px = (min: number) => (min / 60) * HOUR;

  return (
    <div className={cn("overflow-x-auto rounded-card border border-border bg-card", className)}>
      <div className="grid min-w-176" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        {/* Sarlavha */}
        <div className="border-b border-border" />
        {days.map((d) => (
          <div
            key={d.key}
            className={cn(
              "border-b border-l border-border px-2 py-2 text-center",
              d.today && "bg-primary-soft text-primary-text",
            )}
          >
            <div className="text-caption font-bold">{d.label}</div>
            {d.sub ? <div className="text-2xs text-muted-foreground">{d.sub}</div> : null}
          </div>
        ))}

        {/* Soatlar */}
        <div className="relative" style={{ height }}>
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-2 -translate-y-1/2 font-mono text-2xs text-muted-foreground"
              style={{ top: i * HOUR }}
            >
              {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
            </div>
          ))}
        </div>

        {/* Kunlar */}
        {days.map((d) => (
          <div
            key={d.key}
            className={cn("relative border-l border-border", d.today && "bg-primary-soft/30")}
            style={{ height }}
          >
            {hours.slice(1).map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-dashed border-border-soft"
                style={{ top: (i + 1) * HOUR }}
              />
            ))}
            {placeDay(
              items.filter((it) => it.day === d.key),
              from,
            ).map(({ slot, top, height: h, column, columns }) => {
              const body = (
                <>
                  <div className="truncate text-caption font-bold text-foreground">{slot.title}</div>
                  <div className="truncate font-mono text-2xs text-muted-foreground">
                    {slot.start}–{slot.end}
                  </div>
                  {slot.sub ? <div className="truncate text-2xs text-muted-foreground">{slot.sub}</div> : null}
                </>
              );
              const style: React.CSSProperties = {
                top: px(top) + 1,
                height: Math.max(px(h) - 2, 24),
                left: `calc(${(column / columns) * 100}% + 2px)`,
                width: `calc(${100 / columns}% - 4px)`,
                borderLeftColor: slot.color,
              };
              const cls =
                "absolute overflow-hidden rounded-control border border-l-4 border-border-soft bg-muted px-1.5 py-1 text-left";
              return onSelect ? (
                <button
                  key={slot.id}
                  type="button"
                  className={cn(cls, "transition-colors hover:border-(--ring-border) hover:bg-primary-soft")}
                  style={style}
                  onClick={() => onSelect(slot.id)}
                >
                  {body}
                </button>
              ) : (
                <div key={slot.id} className={cls} style={style}>
                  {body}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {!items.length && emptyLabel ? (
        <div className="border-t border-border px-4 py-3 text-center text-caption text-muted-foreground">
          {emptyLabel}
        </div>
      ) : null}
    </div>
  );
}
