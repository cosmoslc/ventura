import { describe, expect, it } from "vitest";
import {
  dbNameFor,
  dbPasswordOwner,
  nextDbAlerts,
  nextQuotaAlerts,
  parseDbList,
  parseTenantSizes,
  projectUsage,
  quotaBytesOf,
} from "./databases";

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

  it("mijozlar hajmi, loyiha egallagan joy va limit", () => {
    expect(parseTenantSizes("alfa\t1024\nbeta\t2048\nYomon\t1\n")).toEqual({ alfa: 1024, beta: 2048 });
    const dbs = [{ name: "edu_crm_ali", owner: "x", sizeBytes: 500, connections: 0 }];
    const usage = [{ db: "edu_crm_shared", tenants: { alfa: 300 } }];
    expect(projectUsage({ slug: "ali", templateKey: "edu-crm", dbStrategy: "db_per_tenant" }, dbs, usage)).toBe(500);
    expect(projectUsage({ slug: "alfa", templateKey: "edu-crm", dbStrategy: "shared_db" }, dbs, usage)).toBe(300);
    expect(projectUsage({ slug: "beta", templateKey: "edu-crm", dbStrategy: "shared_db" }, dbs, usage)).toBe(0);
    expect(projectUsage({ slug: "beta", templateKey: "edu-crm", dbStrategy: "shared_db" }, dbs, undefined)).toBeNull();
    expect(quotaBytesOf({ dbQuotaGb: 2 })).toBe(2 * 1024 ** 3);
    expect(quotaBytesOf({})).toBeNull();
    expect(quotaBytesOf({ dbQuotaGb: 0 })).toBeNull();
    const rows = [
      { slug: "a", usage: 10, quotaBytes: 5 },
      { slug: "b", usage: 1, quotaBytes: 5 },
      { slug: "c", usage: 99, quotaBytes: null },
    ];
    expect(nextQuotaAlerts(undefined, rows)).toEqual({ over: ["a"], newly: ["a"] });
    expect(nextQuotaAlerts(["a"], rows)).toEqual({ over: ["a"], newly: [] });
  });
});
