import Link from "next/link";
import { cn } from "@ventura/ui/lib/utils";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import type { TeacherViewRow } from "@/lib/server/teacher-reports";
import { uz } from "@/lib/uz";
import { formatCell } from "../../report-table";

const t = uz.reports.teachers;

const pct = (v: number | null) => formatCell(v, "percent");
const NUM = "text-right whitespace-nowrap tabular-nums";

/**
 * Ixcham jadval (sahifada): bog'liq ko'rsatkichlar bitta katakda — guruh va o'quvchi, dars va soat, ushlab turish va
 * chiqqanlar — shunda hamma ustun ekranga sig'adi. Excel'da har ko'rsatkich alohida ustunda (yuklovchining `table`i).
 */
export function TeacherTable({
  rows,
  total,
  withSalary,
}: {
  rows: TeacherViewRow[];
  total: TeacherViewRow;
  withSalary: boolean;
}) {
  if (!rows.length) return <p className="py-16 text-center text-body text-muted-foreground">{uz.reports.empty}</p>;
  const line = (r: TeacherViewRow, isTotal: boolean) => (
    <Tr key={r.id || "total"} className={cn(isTotal && "border-t-2 border-border font-bold")}>
      <Td className="min-w-44">
        {isTotal ? (
          <span className="font-bold text-foreground">{r.name}</span>
        ) : (
          <Link href={`/teachers/${r.id}`} className="font-semibold text-foreground hover:text-primary-text">
            {r.name}
          </Link>
        )}
        <div className="text-caption font-normal text-muted-foreground">{t.groupsLine(r.groups, r.students)}</div>
      </Td>
      <Td className={NUM}>
        {formatCell(r.lessons, "number")}
        <div className="text-caption font-normal text-muted-foreground">{t.hoursLine(r.hours)}</div>
      </Td>
      <Td className={NUM}>{pct(r.markedRate)}</Td>
      <Td className={NUM}>{pct(r.attendance)}</Td>
      <Td className={NUM}>
        {pct(r.retention)}
        <div className="text-caption font-normal text-muted-foreground">{t.leftLine(r.left)}</div>
      </Td>
      <Td className={NUM}>{pct(r.trialConv)}</Td>
      <Td className={NUM}>{pct(r.firstConv)}</Td>
      {withSalary ? <Td className={NUM}>{formatCell(r.salary, "money")}</Td> : null}
    </Tr>
  );
  const head = "whitespace-normal leading-tight align-bottom text-right";
  return (
    <TableWrap>
      <Table>
        <THead>
          <tr>
            <Th className="align-bottom">{t.teacher}</Th>
            <Th className={head}>{t.lessonsCol}</Th>
            <Th className={head}>{t.markedRate}</Th>
            <Th className={head}>{t.attendance}</Th>
            <Th className={head}>{t.retention}</Th>
            <Th className={head}>{t.trialConv}</Th>
            <Th className={head}>{t.firstConv}</Th>
            {withSalary ? <Th className={head}>{t.salary}</Th> : null}
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => line(r, false))}
          {line(total, true)}
        </TBody>
      </Table>
    </TableWrap>
  );
}
