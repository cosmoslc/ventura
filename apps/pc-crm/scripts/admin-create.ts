import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";
import { phoneNumber } from "better-auth/plugins";
import { normalizeUzPhone } from "../lib/phone";

const root = resolve(process.cwd(), "../..");
const envFile = resolve(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const localEnvFile = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvFile)) process.loadEnvFile(localEnvFile);

const rl = createInterface({ input: stdin, output: stdout });
const ask = async (label: string) => (await rl.question(label)).trim();
let closeDb: (() => Promise<void>) | undefined;
const askHidden = async (label: string) => {
  stdout.write(label);
  return new Promise<string>((resolveValue, reject) => {
    let value = "";
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolveValue(value);
          return;
        }
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Bekor qilindi"));
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode?.(wasRaw ?? false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
};

try {
  console.log("PC CRM — birinchi admin yaratish\n");
  const phone = normalizeUzPhone(await ask("Admin telefon (+998...): "));
  const name = await ask("Ism familiya: ");
  const password = await askHidden("Parol (kamida 12 belgi, ekranda ko'rinmaydi): ");
  if (!phone) throw new Error("Telefon raqamini +998 90 123 45 67 formatida kiriting");
  if (name.length < 2 || name.length > 120) throw new Error("Ism noto'g'ri");
  if (password.length < 12 || password.length > 128) throw new Error("Parol kamida 12 belgi bo'lishi kerak");

  const databaseUrl = process.env.DATABASE_URL ?? process.env.PC_CRM_DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL yoki PC_CRM_DATABASE_URL majburiy");
  if (!process.env.BETTER_AUTH_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("Production uchun BETTER_AUTH_SECRET majburiy");
  }
  const [{ createPcCrmDb }, schema, { betterAuth }, { drizzleAdapter }] = await Promise.all([
    import("@ventura/db"),
    import("@ventura/db/schema/pc-crm"),
    import("better-auth"),
    import("better-auth/adapters/drizzle"),
  ]);
  const { accounts, users } = schema;
  const db = createPcCrmDb(databaseUrl, { max: 1 });
  closeDb = () => db.close();
  const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET ?? "local-only-pc-crm-secret-change-before-deploy-1234567890",
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3004",
    database: drizzleAdapter(db, { provider: "pg", schema: { user: users, session: schema.sessions, account: accounts, verification: schema.verifications } }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    plugins: [phoneNumber({
      sendOTP: async () => { throw new Error("Telefon OTP sozlanmagan"); },
      phoneNumberValidator: (value) => /^\+998\d{9}$/.test(value),
      schema: { user: { fields: { phoneNumber: "phone", phoneNumberVerified: "phoneVerified" } } },
    })],
    user: { additionalFields: {
      role: { type: "string", input: false, defaultValue: "customer" },
      isActive: { type: "boolean", input: false, defaultValue: true },
      locale: { type: "string", input: false, defaultValue: "uz" },
    } },
    advanced: { database: { generateId: "uuid" } },
  });
  const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  const context = await auth.$context;
  let userId: string;
  if (existing) {
    const existingAccounts = await context.internalAdapter.findAccounts(existing.id);
    if (existingAccounts.some((account) => account.providerId === "credential")) {
      throw new Error("Bu telefonda parolli hisob bor; admin parolini alohida tiklash oqimi orqali o'zgartiring");
    }
    userId = existing.id;
    await db.update(users).set({ name, phoneVerified: true }).where(eq(users.id, userId));
  } else {
    const email = `admin+${phone.replace(/\D/g, "")}@pc-crm.invalid`;
    const user = await context.internalAdapter.createUser({
      name,
      email,
      emailVerified: false,
      phoneNumber: phone,
      phoneNumberVerified: true,
      role: "admin",
      isActive: true,
      locale: "uz",
    }, { method: "admin" });
    userId = user.id;
  }

  const hash = await context.password.hash(password);
  await context.internalAdapter.linkAccount({
    userId,
    providerId: "credential",
    accountId: userId,
    password: hash,
  });
  await db.update(users).set({ role: "admin", isActive: true, phone, phoneVerified: true }).where(eq(users.id, userId));
  console.log(`\nAdmin tayyor: ${phone}`);
} finally {
  await closeDb?.();
  rl.close();
}
