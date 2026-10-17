"use client";

import { TrendingUp } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { money } from "@/lib/format";
import type { ReportTable } from "@/lib/reports";
import { uz } from "@/lib/uz";

const k = uz.reports.funnel;

/**
 * Mas'ul xodimlar kesimi: har xodimning lidlari voronka bosqichlari bo'yicha (voronka bilan bir xil hisob). "Konversiyani
 * ko'rsatish" — har katak ostida xodimning jami lidlaridan necha foizi shu bosqichga yetgani. Jadvalning o'zi Excel'dagi
 * bilan bir xil (`table`): ustunlar — xodim, jami, bosqichlar (`s<n>`), konversiya.
 */
export function StaffMatrix({ table, empty }: { table: ReportTable; empty: string }) {
  const [percent, setPercent] = React.useState(false);
  const steps = table.columns.filter((c) => /^s\d+$/.test(c.key));
  const conv = table.columns.find((c) => c.key === "conv");
  return (
    <>
      <div className="flex justify-end px-4">
        <Button
          variant={percent ? "primary" : "ghost"}
          size="sm"
          aria-pressed={percent}
          onClick={() => setPercent((p) => !p)}
        >
          <TrendingUp /> {k.showConversion}
        </Button>
      </div>
      {table.rows.length ? (
        <div className="border-t border-border-soft">
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th>{k.staff}</Th>
                  <Th className="text-right">{k.leads}</Th>
                  {steps.map((c) => (
                    <Th key={c.key} className="text-right">
                      {c.label}
                    </Th>
                  ))}
                  {conv ? <Th className="text-right">{conv.label}</Th> : null}
                </tr>
              </THead>
              <TBody>
                {table.rows.map((r, i) => {
                  const total = Number(r.cells.total ?? 0);
                  return (
                    <Tr key={i}>
                      <Td className="max-w-72 truncate font-semibold text-foreground">{r.cells.staff}</Td>
                      <Td className="text-right tabular-nums">{money(total)}</Td>
                      {steps.map((c) => {
                        const n = Number(r.cells[c.key] ?? 0);
                        return (
                          <Td key={c.key} className="text-right tabular-nums">
                            {money(n)}
                            {percent && total ? (
                              <span className="block text-caption text-muted-foreground">
                                {((n / total) * 100).toFixed(1)}%
                              </span>
                            ) : null}
                          </Td>
                        );
                      })}
                      {conv ? (
                        <Td className="text-right tabular-nums">
                          {typeof r.cells.conv === "number" ? `${r.cells.conv.toFixed(1)}%` : "—"}
                        </Td>
                      ) : null}
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        </div>
      ) : (
        <p className="py-16 text-center text-body text-muted-foreground">{empty}</p>
      )}
    </>
  );
}
