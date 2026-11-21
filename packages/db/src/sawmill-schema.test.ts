import { getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema/sawmill";

describe("sawmill schema", () => {
  it("har bir jadvalda tenant_id ustuni bor", () => {
    const tables = Object.entries(schema).filter(([, v]) => is(v, PgTable));
    expect(tables.length).toBeGreaterThan(15);
    for (const [name, table] of tables) {
      const cols = getTableColumns(table as PgTable);
      expect(cols, `${name} jadvalida tenantId bo'lishi shart`).toHaveProperty("tenantId");
    }
  });

  it("rollar va lokallar to'g'ri belgilangan", () => {
    expect(schema.SAWMILL_ROLES).toEqual(["owner", "accountant", "viewer"]);
    expect(schema.SAWMILL_LOCALES).toEqual(["uz", "ru"]);
  });
});
