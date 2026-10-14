import { Card } from "@ventura/ui/card";
import type { TeachersViewData } from "@/lib/server/teacher-reports";
import { teacherLeaders } from "@/lib/teacher-reports";
import { uz } from "@/lib/uz";
import { CompareChart } from "./teacher-parts/compare-chart";
import { LeaderCard } from "./teacher-parts/leader-card";
import { TeacherTable } from "./teacher-parts/teacher-table";
import { BLOCK_TITLE, KpiRow } from "./blocks";
import type { ReportViewProps } from "./types";

const t = uz.reports.teachers;
const LEADERS = 3;

/**
 * O'qituvchi reytingi (ADR 0033): umumiy ko'rsatkichlar, reyting yetakchilari, ikki ko'rsatkich taqqoslanishi va
 * to'liq jadval. Umumiy ball yo'q — tartib ushlab turish, keyin davomat bo'yicha.
 */
export function TeachersView({ data }: ReportViewProps) {
  const view = data.view as TeachersViewData | undefined;
  const teachers = view?.teachers ?? [];
  const leaders = teacherLeaders(teachers, LEADERS);
  return (
    <>
      <KpiRow metrics={data.metrics} />

      {teachers.length ? (
        <>
          <section className="space-y-3">
            <div>
              <h2 className={BLOCK_TITLE}>{t.leaders}</h2>
              <p className="text-caption text-muted-foreground">{t.leadersHint}</p>
            </div>
            {leaders.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {leaders.map((x) => (
                  <LeaderCard key={x.id} teacher={x} rank={teachers.indexOf(x) + 1} />
                ))}
              </div>
            ) : (
              <Card>
                <p className="py-10 text-center text-body text-muted-foreground">{t.noRanked}</p>
              </Card>
            )}
          </section>

          <CompareChart teachers={teachers} />
        </>
      ) : null}

      <section className="space-y-3">
        <h2 className={BLOCK_TITLE}>{t.tableTitle}</h2>
        <Card className="overflow-hidden">
          {view ? (
            <TeacherTable rows={teachers} total={view.total} withSalary={view.withSalary} />
          ) : (
            <p className="py-16 text-center text-body text-muted-foreground">{uz.reports.empty}</p>
          )}
        </Card>
        {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
      </section>
    </>
  );
}
