import { describe, expect, it } from "vitest";
import { ago, applyDraft, approvalDecidedDraft, approvalRequestDraft, assignedDraft, clip } from "./notifications";

describe("bildirishnoma matnlari", () => {
  it("saytdan ariza: lidga havola, qayta ariza alohida sarlavha", () => {
    const first = applyDraft({ id: "L1", name: "Ali Valiyev", phone: "+998 90 123 45 67" }, false);
    expect(first).toMatchObject({ kind: "lead_apply", href: "/leads/L1", body: "Ali Valiyev · +998 90 123 45 67" });
    const again = applyDraft({ id: "L1", name: "Ali", phone: "+998 90 123 45 67" }, true);
    expect(again.title).not.toBe(first.title);
  });

  it("biriktirilgan lid: bittasi — lid sahifasi, bir nechtasi — ro'yxat va soni", () => {
    expect(assignedDraft([{ id: "L1", name: "Ali" }])).toMatchObject({ href: "/leads/L1", body: "Ali" });
    const many = assignedDraft([
      { id: "L1", name: "Ali" },
      { id: "L2", name: "Vali" },
    ]);
    expect(many.href).toBe("/leads");
    expect(many.title).toContain("2");
    expect(many.body).toBe("Ali, Vali");
  });

  it("tasdiq so'rovi va qarori /approvals ga olib boradi", () => {
    expect(approvalRequestDraft("Menejer", "To'lov qabul qilish")).toMatchObject({
      kind: "approval_request",
      href: "/approvals",
      body: "Menejer: To'lov qabul qilish",
    });
    const ok = approvalDecidedDraft(true, "To'lov", "Direktor");
    const no = approvalDecidedDraft(false, "To'lov", "Direktor", "Summa noto'g'ri");
    expect(ok.title).not.toBe(no.title);
    expect(no.body).toContain("Summa noto'g'ri");
    expect(ok.href).toBe("/approvals");
  });

  it("matn bazadagi chegaradan (500) oshmaydi", () => {
    expect(clip("x".repeat(900), 500)).toHaveLength(500);
    expect(clip("qisqa", 500)).toBe("qisqa");
    const long = assignedDraft(Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: `Lid nomi ${i}` })));
    expect(long.body!.length).toBeLessThanOrEqual(500);
  });
});

describe("ago", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const before = (ms: number) => new Date(now.getTime() - ms).toISOString();
  it("daqiqa, soat, kecha, kun", () => {
    expect(ago(before(10_000), now)).toBe("Hozir");
    expect(ago(before(5 * 60_000), now)).toBe("5 daqiqa oldin");
    expect(ago(before(3 * 3_600_000), now)).toBe("3 soat oldin");
    expect(ago(before(30 * 3_600_000), now)).toBe("Kecha");
    expect(ago(before(3 * 86_400_000), now)).toBe("3 kun oldin");
  });
  it("bir haftadan keyin — sana", () => {
    expect(ago(before(20 * 86_400_000), now)).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });
  it("kelajakdagi vaqt (soat farqi) — hozir", () => {
    expect(ago(before(-60_000), now)).toBe("Hozir");
  });
});
