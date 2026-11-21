"use client";

import { ArrowLeft, CheckCircle2, Clock, Coins, GraduationCap, MapPin, Trophy, User } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { StatCard } from "@ventura/ui/stat-card";
import { Table, TableWrap, TBody, Td, Th, THead, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { formatDate, money } from "@/lib/format";
import type { PortalGroupDetail } from "@/lib/server/portal";
import { uz } from "@/lib/uz";

const DAY_LABELS: Record<string, string> = {
  mon: "Dushanba",
  tue: "Seshanba",
  wed: "Chorshanba",
  thu: "Payshanba",
  fri: "Juma",
  sat: "Shanba",
  sun: "Yakshanba",
};

const ATT_LABELS: Record<string, { label: string; tone: "success" | "danger" | "warning" | "info" }> = {
  present: { label: "Kelgan", tone: "success" },
  absent: { label: "Kelmadi", tone: "danger" },
  late: { label: "Kechikkan", tone: "warning" },
  excused: { label: "Sababli", tone: "info" },
};

/**
 * Tanlangan guruh tafsiloti (ADR 0063).
 * Davomat, dars baholari, guruhdoshlar ro'yxati va guruh reytingi.
 * Muallif / Agent: Google Gemini
 */
export function PortalGroupDetailView({ data }: { data: PortalGroupDetail }) {
  const { group: g, attendance, grades, members, rank } = data;
  const [tab, setTab] = React.useState<"attendance" | "grades" | "members">("attendance");

  const daysText = g.days.map((d) => DAY_LABELS[d] ?? d).join(", ");

  return (
    <div className="space-y-6">
      {/* Yuqori qism va navigatsiya */}
      <div className="space-y-3">
        <Link href="/portal/guruhlar">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Guruhlarga qaytish
          </Button>
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="type-heading text-title text-foreground">{g.groupName}</h1>
            <p className="text-body text-muted-foreground">{g.courseName}</p>
          </div>
          <Badge tone={g.status === "active" ? "success" : "neutral"} className="self-start sm:self-auto">
            {g.status === "active" ? uz.portal.activeGroup : g.status}
          </Badge>
        </div>
      </div>

      {/* Guruh dars ma'lumotlari kartasi */}
      <Card className="p-4 bg-muted/30 border-border-soft">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-caption">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary shrink-0" />
            <div>
              <div className="text-muted-foreground">Dars vaqti</div>
              <div className="font-mono font-semibold text-foreground">
                {g.startTime} — {g.endTime}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary shrink-0" />
            <div>
              <div className="text-muted-foreground">Dars xonasi</div>
              <div className="font-semibold text-foreground">{g.roomName}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <User className="size-4 text-primary shrink-0" />
            <div>
              <div className="text-muted-foreground">O'qituvchi</div>
              <div className="font-semibold text-foreground">{g.teacherName}</div>
            </div>
          </div>
        </div>
        {daysText ? (
          <div className="mt-3 pt-3 border-t border-border-soft text-caption text-muted-foreground">
            Dars kunlari: <span className="font-semibold text-foreground">{daysText}</span>
          </div>
        ) : null}
      </Card>

      {/* Guruh statistik kartalari */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          tone={2}
          icon={<CheckCircle2 />}
          label={uz.portal.guruhdagiDavomat}
          value={attendance.percent !== null ? `${attendance.percent}%` : "—"}
          hint={`${attendance.present} / ${attendance.total} ta dars`}
        />

        <StatCard
          tone={1}
          icon={<GraduationCap />}
          label={uz.portal.ortachaBaho}
          value={grades.average !== null ? `${grades.average}%` : "—"}
          hint={uz.portal.gradedLessons(grades.count)}
        />

        <StatCard
          tone={4}
          icon={<Trophy />}
          label={uz.portal.guruhdagiOrningiz}
          value={`${rank.current}-o'rin`}
          hint={uz.portal.amongStudents(rank.total)}
        />
      </div>

      {/* Tablar */}
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="attendance">Davomat tarixi ({attendance.list.length})</TabsTrigger>
            <TabsTrigger value="grades">Dars baholari ({grades.list.length})</TabsTrigger>
            <TabsTrigger value="members">Guruhdoshlar va Reyting ({members.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 1. Davomat */}
        {tab === "attendance" ? (
          <Card className="p-0 overflow-hidden">
            {attendance.list.length > 0 ? (
              <TableWrap>
                <Table>
                  <THead>
                    <Tr>
                      <Th>{uz.portal.darsSanasi}</Th>
                      <Th className="text-right">Holat</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {attendance.list.map((a) => {
                      const st = ATT_LABELS[a.status] ?? { label: a.status, tone: "neutral" as const };
                      return (
                        <Tr key={a.date}>
                          <Td className="font-mono text-body font-semibold">{formatDate(a.date)}</Td>
                          <Td className="text-right">
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </TableWrap>
            ) : (
              <div className="p-8 text-center text-caption text-muted-foreground">
                {uz.portal.hozirchaDavomatBelgilariMavjud}
              </div>
            )}
          </Card>
        ) : null}

        {/* 2. Baholar */}
        {tab === "grades" ? (
          <Card className="p-0 overflow-hidden">
            {grades.list.length > 0 ? (
              <TableWrap>
                <Table>
                  <THead>
                    <Tr>
                      <Th>{uz.portal.darsSanasi}</Th>
                      <Th className="text-center">Baho</Th>
                      <Th className="text-right">Uy vazifasi</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {grades.list.map((gItem) => (
                      <Tr key={gItem.date}>
                        <Td className="font-mono text-body font-semibold">{formatDate(gItem.date)}</Td>
                        <Td className="text-center">
                          {gItem.score !== null ? (
                            <span className="font-mono font-bold text-foreground">
                              {gItem.score} <span className="text-muted-foreground text-caption">/ {gItem.scale}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Td>
                        <Td className="text-right">
                          {gItem.homework === true ? (
                            <Badge tone="success">{uz.portal.hwDone}</Badge>
                          ) : gItem.homework === false ? (
                            <Badge tone="danger">{uz.portal.hwNotDone}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            ) : (
              <div className="p-8 text-center text-caption text-muted-foreground">
                {uz.portal.hozirchaDarsBaholariQoyilmagan}
              </div>
            )}
          </Card>
        ) : null}

        {/* 3. Guruhdoshlar va Reyting */}
        {tab === "members" ? (
          <Card className="p-0 overflow-hidden">
            <TableWrap>
              <Table>
                <THead>
                  <Tr>
                    <Th className="w-12">#</Th>
                    <Th>{uz.portal.oquvchi}</Th>
                    <Th className="text-right">Coinlar</Th>
                  </Tr>
                </THead>
                <TBody>
                  {members.map((m, idx) => (
                    <Tr key={m.studentId} className={m.isMe ? "bg-primary-soft/30 font-semibold" : undefined}>
                      <Td className="font-mono text-caption text-muted-foreground">{idx + 1}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="text-body text-foreground">{m.name}</span>
                          {m.isMe ? (
                            <Badge tone="info" className="text-2xs">
                              Siz
                            </Badge>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-right font-mono font-semibold text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Coins className="size-3.5 text-warning-fg" /> {money(m.coins)}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
