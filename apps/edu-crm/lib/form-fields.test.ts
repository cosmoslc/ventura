import { describe, expect, it } from "vitest";
import {
  type FormField,
  cleanCustomData,
  fieldText,
  formFieldsSchema,
  missingRequired,
  splitMulti,
} from "./form-fields";

const field = (id: string, type: FormField["type"], extra: Partial<FormField> = {}): FormField => ({
  id,
  label: id,
  type,
  placeholder: "",
  required: false,
  options: [],
  ...extra,
});

const GROUP = "3f1c2a9e-8b7d-4c6e-9a1b-2d3e4f5a6b7c";

describe("qo'shimcha maydonlar qiymati", () => {
  const fields = [
    field("color", "select", { options: ["Qizil", "Yashil"] }),
    field("langs", "multiselect", { options: ["Ingliz", "Rus", "Nemis"] }),
    field("consent", "checkbox"),
    field("group", "group"),
    field("day", "date"),
    field("at", "time"),
    field("note", "text"),
  ];

  it("to'g'ri qiymatlar saqlanadi, ko'p tanlov sozlamadagi tartibda", () => {
    expect(
      cleanCustomData(
        {
          color: "Yashil",
          langs: "Nemis, Ingliz",
          consent: "1",
          group: GROUP.toUpperCase(),
          day: "2026-10-13",
          at: "14:30",
          note: "  salom ",
          stranger: "x",
        },
        fields,
      ),
    ).toEqual({
      color: "Yashil",
      langs: "Ingliz, Nemis",
      consent: "1",
      group: GROUP,
      day: "2026-10-13",
      at: "14:30",
      note: "salom",
    });
  });

  it("noto'g'ri qiymatlar tashlanadi", () => {
    expect(
      cleanCustomData(
        { color: "Ko'k", langs: "Fransuz", consent: "true", group: "guruh", day: "13.10.2026", at: "25:00" },
        fields,
      ),
    ).toEqual({});
  });

  it("majburiy belgilash belgilanmagan bo'lsa to'ldirilmagan", () => {
    const f = [field("consent", "checkbox", { required: true })];
    expect(missingRequired({}, f)?.id).toBe("consent");
    expect(missingRequired({ consent: "1" }, f)).toBeNull();
  });

  it("profil matni: belgilash Ha/Yo'q, guruh nomi, sana", () => {
    const labels = { yes: "Ha", no: "Yo'q", groupName: (id: string) => (id === GROUP ? "IELTS" : undefined) };
    expect(fieldText(field("c", "checkbox"), undefined, labels)).toBe("Yo'q");
    expect(fieldText(field("c", "checkbox"), "1", labels)).toBe("Ha");
    expect(fieldText(field("g", "group"), GROUP, labels)).toBe("IELTS");
    expect(fieldText(field("g", "group"), "boshqa", labels)).toBe("—");
    expect(fieldText(field("d", "date"), "2026-10-13", labels)).toBe("13.10.2026");
    expect(fieldText(field("t", "text"), undefined, labels)).toBeNull();
    expect(splitMulti("Ingliz, Rus")).toEqual(["Ingliz", "Rus"]);
  });

  it("variant ichida vergul bo'lmaydi", () => {
    expect(formFieldsSchema.safeParse([field("x", "select", { options: ["A, B"] })]).success).toBe(false);
  });
});
