import { describe, expect, it } from "vitest";
import { rankEmployees } from "./employee-ranking";

describe("xodimlar reytingi", () => {
  it("kech qolgan kelgan hisoblanadi, belgilanmagan kun foizni tushirmaydi, davrdan tashqarisi sanalmaydi", () => {
    const rows = rankEmployees(
      ["u:a", "t:b", "u:c"],
      [
        { key: "u:a", date: "2026-10-10", status: "present" },
        { key: "u:a", date: "2026-10-11", status: "late" },
        { key: "u:a", date: "2026-10-12", status: "absent" },
        { key: "t:b", date: "2026-10-12", status: "present" },
        { key: "t:b", date: "2026-09-01", status: "absent" },
        { key: "x:z", date: "2026-10-12", status: "present" },
      ],
      "2026-10-06",
      "2026-10-12",
    );
    expect(rows.map((r) => r.key)).toEqual(["t:b", "u:a", "u:c"]);
    expect(rows[0]).toMatchObject({ present: 1, absent: 0, records: 1, rate: 100 });
    expect(rows[1]).toMatchObject({ present: 1, late: 1, absent: 1, records: 3, rate: 67 });
    expect(rows[2]).toMatchObject({ records: 0, rate: null });
  });
});
