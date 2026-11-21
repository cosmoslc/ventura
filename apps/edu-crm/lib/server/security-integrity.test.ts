import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Tenant } from "@ventura/tenants";
import type { TenantDeps } from "@/lib/server/deps";
import { GET as getUploadHandler } from "@/app/api/uploads/[...file]/route";
import { POST as postUploadHandler } from "@/app/api/uploads/route";
import { POST as telegramWebhookHandler, telegramUpdateSchema } from "@/app/api/telegram/webhook/route";
import { getBotWebhookSecret } from "@/lib/server/telegram-bots";
import {
  type LedgerEntry,
  canUpdatePaymentAmountWithoutRefundConflict,
  canVoidPaymentWithoutRefundConflict,
} from "@/lib/ledger";

// Mock dependencies for uploads and webhook
vi.mock("@/lib/server/tenant", () => ({
  currentTenant: vi.fn(),
  tenantForHost: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({
  getStaff: vi.fn(),
}));

vi.mock("@/lib/server/deps", () => ({
  tenantDeps: vi.fn(),
  getTenantDb: vi.fn(),
}));

vi.mock("@/lib/server/storage", () => ({
  getStorageStats: vi.fn().mockResolvedValue({ usedBytes: 100, limitBytes: 1000000, limitMb: 1 }),
}));

vi.mock("@/lib/server/telegram-bots", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getTelegramBotsConfig: vi.fn(),
    handleTelegramWebhook: vi.fn().mockResolvedValue({ ok: true }),
  };
});

import { currentTenant, tenantForHost } from "@/lib/server/tenant";
import { getStaff } from "@/lib/server/session";
import { tenantDeps } from "@/lib/server/deps";
import { getTelegramBotsConfig } from "@/lib/server/telegram-bots";

const mockTenant: Tenant = {
  slug: "bilim",
  name: "Bilim",
  hosts: ["bilim.ventura.uz"],
  brand: {
    primary: "#006aff",
    appearance: "light",
  },
  features: [],
};

describe("P0 Security Fix — Uploads Access & Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/uploads/[...file]", () => {
    it("returns 404 when tenant is null/missing (prevents anonymous leak)", async () => {
      vi.mocked(currentTenant).mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3001/api/uploads/bilim/photo.jpg");
      const res = await getUploadHandler(req, {
        params: Promise.resolve({ file: ["bilim", "photo.jpg"] }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 when path traversal is attempted via ..", async () => {
      vi.mocked(currentTenant).mockResolvedValue(mockTenant);
      const req = new NextRequest("http://bilim.ventura.uz/api/uploads/..%2Fsecret.txt");
      const res = await getUploadHandler(req, {
        params: Promise.resolve({ file: ["..", "secret.txt"] }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when null byte injection is attempted", async () => {
      vi.mocked(currentTenant).mockResolvedValue(mockTenant);
      const req = new NextRequest("http://bilim.ventura.uz/api/uploads/bilim/photo.jpg%00.png");
      const res = await getUploadHandler(req, {
        params: Promise.resolve({ file: ["bilim", "photo.jpg\0.png"] }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 when no signed-in user (files are private)", async () => {
      vi.mocked(currentTenant).mockResolvedValue(mockTenant);
      vi.mocked(getStaff).mockResolvedValue(null);
      const req = new NextRequest("http://bilim.ventura.uz/api/uploads/bilim/photo.jpg");
      const res = await getUploadHandler(req, {
        params: Promise.resolve({ file: ["bilim", "photo.jpg"] }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when requested path segment does not match tenant slug", async () => {
      vi.mocked(currentTenant).mockResolvedValue(mockTenant);
      vi.mocked(getStaff).mockResolvedValue({ state: "ok" } as Awaited<ReturnType<typeof getStaff>>);
      // Attempting to access competitor center's file
      const req = new NextRequest("http://bilim.ventura.uz/api/uploads/other-center/doc.pdf");
      const res = await getUploadHandler(req, {
        params: Promise.resolve({ file: ["other-center", "doc.pdf"] }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 when path has only 1 segment without matching tenant folder", async () => {
      vi.mocked(currentTenant).mockResolvedValue(mockTenant);
      vi.mocked(getStaff).mockResolvedValue({ state: "ok" } as Awaited<ReturnType<typeof getStaff>>);
      const req = new NextRequest("http://bilim.ventura.uz/api/uploads/random.pdf");
      const res = await getUploadHandler(req, {
        params: Promise.resolve({ file: ["random.pdf"] }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/uploads", () => {
    it("returns 404 if tenant does not exist", async () => {
      vi.mocked(currentTenant).mockResolvedValue(null);
      const req = new NextRequest("http://localhost:3001/api/uploads", { method: "POST" });
      const res = await postUploadHandler(req);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { ok: boolean; error: string };
      expect(body.ok).toBe(false);
      expect(body.error).toContain("Tizim topilmadi");
    });

    it("returns 401 when unauthenticated (no active staff/user session)", async () => {
      vi.mocked(currentTenant).mockResolvedValue(mockTenant);
      vi.mocked(getStaff).mockResolvedValue(null);

      const req = new NextRequest("http://bilim.ventura.uz/api/uploads", { method: "POST" });
      const res = await postUploadHandler(req);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { ok: boolean; error: string };
      expect(body.ok).toBe(false);
      expect(body.error).toContain("Ruxsat berilmagan");
    });
  });
});

describe("P0 Security Fix — Telegram Webhook Zod & Secret Validation", () => {
  const dummyTenant: Tenant = mockTenant;
  const dummyDeps = {
    db: {} as TenantDeps["db"],
    secret: "test-auth-secret-12345",
    telegram: null,
    appName: "Bilim",
    auth: vi.fn() as unknown as TenantDeps["auth"],
  };
  const dummyBot = {
    token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
    username: "bilim_bot",
    name: "O'qituvchi boti",
    enabled: true,
    miniAppUrl: "/kabinet",
    notifications: {},
    webhookSecret: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails schema validation when update_id is missing or wrong type", () => {
    const invalidPayload = { message: { message_id: 1, chat: { id: 123, type: "private" }, date: 123456 } };
    const result = telegramUpdateSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("passes schema validation for valid Telegram update with message", () => {
    const validPayload = {
      update_id: 9999,
      message: {
        message_id: 1,
        chat: { id: 12345, type: "private" },
        text: "/start",
        date: 1700000000,
        from: { id: 12345, first_name: "Ali", username: "ali_uz" },
      },
    };
    const result = telegramUpdateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("passes schema validation for valid Telegram update with callback_query", () => {
    const validPayload = {
      update_id: 10001,
      callback_query: {
        id: "cq-123",
        from: { id: 12345, first_name: "Vali" },
        message: {
          message_id: 55,
          chat: { id: 12345, type: "private" },
          text: "Tasdiqlaysizmi?",
        },
        data: "parent_yes:student-123",
      },
    };
    const result = telegramUpdateSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("returns 400 when role query param is missing or invalid", async () => {
    vi.mocked(tenantForHost).mockReturnValue(dummyTenant);
    vi.mocked(tenantDeps).mockReturnValue(dummyDeps);

    const req = new NextRequest("http://bilim.ventura.uz/api/telegram/webhook?role=invalid_role", {
      method: "POST",
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await telegramWebhookHandler(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_role");
  });

  it("returns 401 when X-Telegram-Bot-Api-Secret-Token is missing or incorrect", async () => {
    vi.mocked(tenantForHost).mockReturnValue(dummyTenant);
    vi.mocked(tenantDeps).mockReturnValue(dummyDeps);
    vi.mocked(getTelegramBotsConfig).mockResolvedValue({
      teacherBot: dummyBot,
      studentBot: dummyBot,
      parentBot: dummyBot,
    });

    const req = new NextRequest("http://bilim.ventura.uz/api/telegram/webhook?role=teacher", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": "wrong-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });

    const res = await telegramWebhookHandler(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("returns 400 when body is invalid JSON with valid secret header", async () => {
    vi.mocked(tenantForHost).mockReturnValue(dummyTenant);
    vi.mocked(tenantDeps).mockReturnValue(dummyDeps);
    vi.mocked(getTelegramBotsConfig).mockResolvedValue({
      teacherBot: dummyBot,
      studentBot: dummyBot,
      parentBot: dummyBot,
    });

    const expectedSecret = getBotWebhookSecret(dummyBot, dummyDeps.secret, "teacher");

    const req = new NextRequest("http://bilim.ventura.uz/api/telegram/webhook?role=teacher", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": expectedSecret,
      },
      body: "not a json string",
    });

    const res = await telegramWebhookHandler(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_json");
  });

  it("returns 400 when body does not conform to strict Zod schema with valid secret header", async () => {
    vi.mocked(tenantForHost).mockReturnValue(dummyTenant);
    vi.mocked(tenantDeps).mockReturnValue(dummyDeps);
    vi.mocked(getTelegramBotsConfig).mockResolvedValue({
      teacherBot: dummyBot,
      studentBot: dummyBot,
      parentBot: dummyBot,
    });

    const expectedSecret = getBotWebhookSecret(dummyBot, dummyDeps.secret, "teacher");

    const req = new NextRequest("http://bilim.ventura.uz/api/telegram/webhook?role=teacher", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": expectedSecret,
      },
      body: JSON.stringify({ invalid_field: "malformed" }),
    });

    const res = await telegramWebhookHandler(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_payload");
  });

  it("successfully processes valid Telegram update with matching secret header", async () => {
    vi.mocked(tenantForHost).mockReturnValue(dummyTenant);
    vi.mocked(tenantDeps).mockReturnValue(dummyDeps);
    vi.mocked(getTelegramBotsConfig).mockResolvedValue({
      teacherBot: dummyBot,
      studentBot: dummyBot,
      parentBot: dummyBot,
    });

    const expectedSecret = getBotWebhookSecret(dummyBot, dummyDeps.secret, "teacher");

    const req = new NextRequest("http://bilim.ventura.uz/api/telegram/webhook?role=teacher", {
      method: "POST",
      headers: {
        "x-telegram-bot-api-secret-token": expectedSecret,
      },
      body: JSON.stringify({
        update_id: 1234,
        message: {
          message_id: 10,
          chat: { id: 987, type: "private" },
          date: 1700000000,
          text: "Salom",
        },
      }),
    });

    const res = await telegramWebhookHandler(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe("P0 Financial Integrity — Void and Update Invariant Logic", () => {
  it("rejects voiding payment when disbursed refunds would exceed remaining payments", () => {
    const entries: Pick<LedgerEntry, "id" | "kind" | "amount">[] = [
      { id: "p1", kind: "payment", amount: 500_000 },
      { id: "r1", kind: "refund", amount: 400_000 },
    ];

    const canVoid = canVoidPaymentWithoutRefundConflict(entries, "p1");
    expect(canVoid).toBe(false);
  });

  it("allows voiding payment when remaining payments still cover all issued refunds", () => {
    const entries: Pick<LedgerEntry, "id" | "kind" | "amount">[] = [
      { id: "p1", kind: "payment", amount: 500_000 },
      { id: "p2", kind: "payment", amount: 500_000 },
      { id: "r1", kind: "refund", amount: 300_000 },
    ];

    const canVoid = canVoidPaymentWithoutRefundConflict(entries, "p1");
    expect(canVoid).toBe(true);
  });

  it("rejects editing a payment down when new amount is less than total refunds", () => {
    const entries: Pick<LedgerEntry, "id" | "kind" | "amount">[] = [
      { id: "p1", kind: "payment", amount: 500_000 },
      { id: "r1", kind: "refund", amount: 400_000 },
    ];

    // Attempt to reduce p1 to 300_000 (less than 400_000 refund)
    const canEdit = canUpdatePaymentAmountWithoutRefundConflict(entries, "p1", "payment", 300_000);
    expect(canEdit).toBe(false);
  });

  it("allows editing a payment down when new amount still covers refunds", () => {
    const entries: Pick<LedgerEntry, "id" | "kind" | "amount">[] = [
      { id: "p1", kind: "payment", amount: 500_000 },
      { id: "r1", kind: "refund", amount: 400_000 },
    ];

    // Attempt to reduce p1 to 450_000 (still >= 400_000 refund)
    const canEdit = canUpdatePaymentAmountWithoutRefundConflict(entries, "p1", "payment", 450_000);
    expect(canEdit).toBe(true);
  });

  it("rejects increasing a refund beyond total valid payments", () => {
    const entries: Pick<LedgerEntry, "id" | "kind" | "amount">[] = [
      { id: "p1", kind: "payment", amount: 500_000 },
      { id: "r1", kind: "refund", amount: 300_000 },
    ];

    // Attempt to increase r1 to 600_000 (exceeds 500_000 payment)
    const canEdit = canUpdatePaymentAmountWithoutRefundConflict(entries, "r1", "refund", 600_000);
    expect(canEdit).toBe(false);
  });
});
