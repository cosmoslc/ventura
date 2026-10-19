import { describe, expect, it } from "vitest";
import { ownsGroup } from "./teacher-scope";

describe("o'z guruhlari (ADR 0062)", () => {
  it("admin xodim — har qanday guruh (filial alohida tekshiriladi)", () => {
    expect(ownsGroup({ kind: "staff", teacherId: null }, { teacherId: "t1" })).toBe(true);
  });

  it("o'qituvchi — faqat o'zi o'qituvchi bo'lgan guruh", () => {
    expect(ownsGroup({ kind: "teacher", teacherId: "t1" }, { teacherId: "t1" })).toBe(true);
    expect(ownsGroup({ kind: "teacher", teacherId: "t1" }, { teacherId: "t2" })).toBe(false);
    expect(ownsGroup({ kind: "teacher", teacherId: null }, { teacherId: "t1" })).toBe(false);
  });
});
