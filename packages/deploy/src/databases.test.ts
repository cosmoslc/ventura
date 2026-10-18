import { describe, expect, it } from "vitest";
import { dbNameFor, dbPasswordOwner, nextDbAlerts, parseDbList } from "./databases";

/* Bazalar (ADR 0057): nomlash deploy bilan bir xil, `ventura-db list` o'qiladi, hajm ogohlantirishi faqat o'zgarganda. */

describe("bazalar", () => {
  it("loyiha bazasi nomi", () => {
    expect(dbNameFor("edu-crm", "cosmos-lc", "shared_db")).toBe("edu_crm_shared");
    expect(dbNameFor("edu-crm", "cosmos-lc", "db_per_tenant")).toBe("edu_crm_cosmos_lc");
    expect(dbNameFor("edu-crm", "cosmos-lc", "dedicated_server")).toBe("edu_crm_cosmos_lc");
  });

  it("parol qayerda", () => {
    expect(dbPasswordOwner("project", { serverId: "s", projectId: "p" }, "edu_crm_x")).toEqual({
      owner: { type: "project", id: "p" },
      name: "db_password",
    });
    expect(dbPasswordOwner("shared", { serverId: "s" }, "edu_crm_shared")).toEqual({
      owner: { type: "server", id: "s" },
      name: "db:edu_crm_shared",
    });
  });

  it("ventura-db list chiqishini o'qiydi, tizim va noto'g'ri nomlarni tashlaydi", () => {
    const out =
      "edu_crm_shared\tedu_crm_shared\t10485760\t3\npostgres\tpostgres\t1\t0\nYomon-nom\tx\t1\t0\nanalytics\tanalytics\tabc\t\n";
    expect(parseDbList(out)).toEqual([
      { name: "analytics", owner: "analytics", sizeBytes: 0, connections: 0 },
      { name: "edu_crm_shared", owner: "edu_crm_shared", sizeBytes: 10485760, connections: 3 },
    ]);
  });

  it("hajm ogohlantirishi faqat yangi oshganda", () => {
    const dbs = [
      { name: "a", owner: "a", sizeBytes: 6, connections: 0 },
      { name: "b", owner: "b", sizeBytes: 1, connections: 0 },
    ];
    expect(nextDbAlerts(undefined, dbs, 5)).toEqual({ over: ["a"], newly: [dbs[0]] });
    expect(nextDbAlerts(["a"], dbs, 5)).toEqual({ over: ["a"], newly: [] });
    expect(nextDbAlerts(["a"], [{ ...dbs[0]!, sizeBytes: 1 }], 5)).toEqual({ over: [], newly: [] });
  });
});
