import Link from "next/link";
import type { TeachersViewData } from "@/lib/server/teacher-reports";
import { uz } from "@/lib/uz";
import { Panel } from "../blocks";
import { ATTENDANCE_COLOR, RETENTION_COLOR } from "./leader-card";

const t = uz.reports.teachers;

const SERIES = [
  { key: "retention", label: t.retention, color: RETENTION_COLOR },
  { key: "attendance", label: t.attendance, color: ATTENDANCE_COLOR },
] as const;

const TICKS = [0, 50, 100];
const ROW =
  "grid items-center gap-x-3 grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] sm:grid-cols-[11rem_minmax(0,1fr)_4.75rem_4.75rem]";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

/**
 * Taqqoslash grafigi: har o'qituvchi — bitta qator, umumiy 0–100% o'qda ikki nuqta (ushlab turish va davomat), orasi
 * chiziq bilan ulanadi (farq ko'rinadi). Qiymatlar o'ngda matn bilan; hisoblanmagan — "—" va nuqta yo'q.
 * Qatorlar reyting tartibida.
 */
export function CompareChart({ teachers }: { teachers: TeachersViewData["teachers"] }) {
  return (
    <Panel
      title={t.compare}
      sub={t.compareHint}
      flush
      className="overflow-hidden"
      aside={
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      }
    >
      <div className="px-4 pb-2" role="list" aria-label={t.compareCaption}>
        <div className={`${ROW} pb-2`} aria-hidden>
          <span className="col-span-1 hidden sm:block" />
          <div className="relative h-4">
            {TICKS.map((v) => (
              <span
                key={v}
                className="absolute inset-y-0 -translate-x-1/2 font-mono text-2xs text-muted-foreground"
                style={{ left: `calc(0.5rem + (100% - 1rem) * ${v / 100})` }}
              >
                {v}
              </span>
            ))}
          </div>
          <span />
          <span />
        </div>
        {teachers.map((x) => (
          <div key={x.id} role="listitem" className="border-t border-border-soft py-2.5">
            <div className={ROW}>
              <Link
                href={`/teachers/${x.id}`}
                className="col-span-3 truncate text-body font-semibold text-foreground hover:text-primary-text max-sm:mb-1.5 sm:col-span-1"
                title={x.name}
              >
                {x.name}
              </Link>
              <Plot a={x.retention} b={x.attendance} />
              {SERIES.map((s) => (
                <span key={s.key} className="flex items-center justify-end gap-1.5 font-mono text-xs text-foreground">
                  <span
                    className="size-1.5 shrink-0 rounded-full max-sm:hidden"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  {pct(x[s.key])}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Bir qatorlik 0–100 o'q: yengil to'r, ikki nuqta va ularni ulovchi chiziq */
function Plot({ a, b }: { a: number | null; b: number | null }) {
  const at = (v: number) => `${Math.min(100, Math.max(0, v))}%`;
  return (
    <div className="relative h-5">
      <div className="absolute inset-x-2 inset-y-0">
        {TICKS.map((v) => (
          <span key={v} className="absolute inset-y-0 w-px bg-border-soft" style={{ left: `${v}%` }} />
        ))}
        <span className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border-soft" />
        {a !== null && b !== null ? (
          <span
            className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/40"
            style={{ left: at(Math.min(a, b)), width: `${Math.abs(Math.min(100, a) - Math.min(100, b))}%` }}
          />
        ) : null}
        {a !== null ? <Dot v={at(a)} color={RETENTION_COLOR} /> : null}
        {b !== null ? <Dot v={at(b)} color={ATTENDANCE_COLOR} /> : null}
      </div>
    </div>
  );
}

function Dot({ v, color }: { v: string; color: string }) {
  return (
    <span
      className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card box-content"
      style={{ left: v, background: color }}
    />
  );
}
