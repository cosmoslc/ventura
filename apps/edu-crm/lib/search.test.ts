import { describe, expect, it } from "vitest";
import { SEARCH_MAX, escapeLike, parseQuery } from "./search";

describe("global qidiruv so'rovi", () => {
  it("qisqa va bo'sh so'rov qidirilmaydi", () => {
    expect(parseQuery("")).toBeNull();
    expect(parseQuery("  a ")).toBeNull();
    expect(parseQuery("al")).not.toBeNull();
  });

  it("ism bo'yicha namuna: bo'shliqlar yig'iladi, maxsus belgilar qochiriladi", () => {
    expect(parseQuery("  Ali   Vali ")?.name).toBe("%Ali Vali%");
    expect(parseQuery("100%_x")?.name).toBe("%100\\%\\_x%");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("telefon: raqamlar ajratiladi, 3 tadan kam bo'lsa telefon bo'yicha qidirilmaydi", () => {
    expect(parseQuery("+998 90 123")?.digits).toBe("99890123");
    expect(parseQuery("90 123 45")?.digits).toBe("9012345");
    expect(parseQuery("12")?.digits).toBeNull();
    expect(parseQuery("Ali")?.digits).toBeNull();
  });

  it("ism ichidagi raqam telefon deb olinmaydi", () => {
    expect(parseQuery("Ali 2-guruh")?.digits).toBeNull();
  });

  it("uzun so'rov kesiladi", () => {
    expect(parseQuery("x".repeat(500))!.name.length).toBeLessThanOrEqual(SEARCH_MAX + 2);
  });
});
