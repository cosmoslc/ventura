import { describe, expect, it } from "vitest";
import { type JournalStatus, journalRows } from "./attendance-journal";

const period = (enrolledAt: string, leftAt: string | null = null) => ({
  membershipId: "m",
  enrolledAt,
  leftAt,
  status: "active" as const,
  pausedAt: null,
});

describe("davomat jurnali", () => {
  const dates = ["2026-10-05", "2026-10-07", "2026-10-09"];
  const marks: Record<string, JournalStatus> = {
    "0|2026-10-05": "present",
    "0|2026-10-07": "late",
    "0|2026-10-09": "absent",
    "1|2026-10-07": "excused",
    // 2-o'quvchi 10-07 da guruhga qo'shilgan: oldingi belgi tarixda bo'lsa ham jadvalga chiqmaydi
    "2|2026-10-05": "present",
  };

  const rows = journalRows({
    dates,
    members: [
      { name: "Ali", periods: [period("2026-09-01")] },
      { name: "Vali", periods: [period("2026-09-01")] },
      { name: "Sami", periods: [period("2026-10-07")] },
    ],
    marks: (i, d) => marks[`${i}|${d}`],
  });

  it("belgilar, sanagacha bo'sh kunlar va sonlar", () => {
    expect(rows[0]).toMatchObject({ cells: ["✓", "K", "✕"], present: 1, late: 1, absent: 1, rate: 2 / 3 });
    expect(rows[1]).toMatchObject({ cells: [null, "S", null], excused: 1, rate: 0 });
    expect(rows[2]).toMatchObject({ cells: [null, null, null], rate: null });
  });
});
