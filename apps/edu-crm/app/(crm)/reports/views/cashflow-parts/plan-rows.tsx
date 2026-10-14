import { BLOCK_TITLE } from "../blocks";
import { cn } from "@ventura/ui/lib/utils";
import { barScale, barShare, hasForecastGap } from "@/lib/cashflow-views";
import { money } from "@/lib/format";
import { type PlanCell, percent } from "@/lib/reports";
import { uz } from "@/lib/uz";

const p = uz.reports.plan;

const signed = (n: number) => `${n < 0 ? "−" : ""}${money(Math.abs(Math.round(n)))}`;
const pct = (v: number | null) => (v === null ? null : `${v.toFixed(1)}%`);

export interface PlanRowData {
  label: string;
  cell: PlanCell;
  /** Jami qator: kattaroq yozuv */
  total?: boolean;
}

/** Fakt, prognoz va reja belgisi uchun ranglar (grafikdagi bilan bir xil tartib) */
export const PLAN_COLORS = { fact: "var(--chart-1)", plan: "var(--chart-2)", forecast: "var(--chart-3)" } as const;

/**
 * Bitta qator: nomi va fakt summasi, ostida chiziq (to'ldirilgan qism — fakt, och qism — kutilayotgan prognoz,
 * tik belgi — reja), eng pastda reja bajarilishi va prognoz. Prognoz faktga teng bo'lsa alohida yozilmaydi.
 */
function PlanRow({
  row,
  scale,
  /** Chiqimda rejadan oshish yomon: bajarilish foizi qizil */
  lowerIsBetter,
}: {
  row: PlanRowData;
  scale: number;
  lowerIsBetter: boolean;
}) {
  const { cell, total } = row;
  const share = barShare(cell, scale);
  const done = cell.plan && cell.fact !== null ? percent(cell.fact, cell.plan) : null;
  const forecastDone = cell.plan ? percent(cell.forecast, cell.plan) : null;
  const over = lowerIsBetter && done !== null && done > 100;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("truncate text-body", total ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {row.label}
        </span>
        <span className="shrink-0 text-foreground tabular-nums">
          <b className={total ? "type-stat" : "text-body font-semibold"}>
            {cell.fact === null ? "—" : signed(cell.fact)}
          </b>
          {cell.fact !== null ? (
            <small className="ml-1 text-caption text-muted-foreground">{uz.common.som}</small>
          ) : null}
        </span>
      </div>
      <div
        className="relative mt-2 h-2 rounded-full"
        style={{ background: "color-mix(in oklab, var(--foreground) 8%, transparent)" }}
        aria-hidden
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${share.forecast}%`, background: PLAN_COLORS.forecast }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${share.fact}%`, background: PLAN_COLORS.fact }}
        />
        {share.plan !== null ? (
          <div
            className="absolute -inset-y-1 w-0.5 rounded-full"
            style={{ left: `calc(${share.plan}% - 1px)`, background: PLAN_COLORS.plan }}
          />
        ) : null}
      </div>
      {cell.plan || hasForecastGap(cell) ? (
        <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-caption text-muted-foreground tabular-nums">
          <span>
            {cell.plan ? (
              <>
                {p.plan}: {money(cell.plan)}
                {done !== null ? (
                  <>
                    {" · "}
                    <span className={cn(over && "font-semibold text-(--danger-fg)")}>{pct(done)}</span>
                  </>
                ) : null}
              </>
            ) : null}
          </span>
          {hasForecastGap(cell) ? (
            <span>{p.forecastFoot(money(Math.round(cell.forecast)), pct(forecastDone))}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Qatorlar guruhi (kirim yoki chiqim): birinchi — jami, keyin tarkibi; hammasi bitta shkalada */
export function PlanGroup({
  title,
  rows,
  lowerIsBetter = false,
}: {
  title?: string;
  rows: readonly PlanRowData[];
  lowerIsBetter?: boolean;
}) {
  const scale = barScale(rows.map((r) => r.cell));
  const [first, ...rest] = rows;
  return (
    <div className="flex flex-col gap-5 p-5">
      {title ? <h2 className={BLOCK_TITLE}>{title}</h2> : null}
      {first ? <PlanRow row={first} scale={scale} lowerIsBetter={lowerIsBetter} /> : null}
      {rest.length ? (
        <div className="flex flex-col gap-4 border-t border-border-soft pt-4">
          {rest.map((r) => (
            <PlanRow key={r.label} row={r} scale={scale} lowerIsBetter={lowerIsBetter} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Belgilar izohi: fakt, kutilayotgan prognoz (bo'lsa) va reja belgisi (bo'lsa) */
export function PlanLegend({ forecast, plan }: { forecast: boolean; plan: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <i className="size-2.5 rounded-full" style={{ background: PLAN_COLORS.fact }} aria-hidden />
        {p.fact}
      </li>
      {forecast ? (
        <li className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-full" style={{ background: PLAN_COLORS.forecast }} aria-hidden />
          {p.forecast}
        </li>
      ) : null}
      <li className="flex items-center gap-1.5">
        <i className="h-3 w-0.5 rounded-full" style={{ background: PLAN_COLORS.plan }} aria-hidden />
        {plan ? p.plan : p.noPlan}
      </li>
    </ul>
  );
}
