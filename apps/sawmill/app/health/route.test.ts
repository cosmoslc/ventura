import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("sawmill health endpoint", () => {
  it("status ok va ilova nomi sawmill qaytaradi", async () => {
    const req = new Request("http://localhost:3003/health", {
      headers: { host: "localhost:3003" },
    });
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.app).toBe("sawmill");
    expect(data).toHaveProperty("uptime");
    expect(data).toHaveProperty("tenantSlug");
  });
});
