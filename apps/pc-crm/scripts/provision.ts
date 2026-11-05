import { eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeUzPhone } from "@ventura/auth";
import { createPcCrmDb } from "@ventura/db";
import { migratePcCrmDb } from "@ventura/db/migrate/pc-crm";
import { accounts, sessions, settings, shippingRates, users, verifications } from "@ventura/db/schema/pc-crm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins";

/*
 * PC-CRM mijozini tayyorlash — deploy'ning `migrate` qadami serverda ishga tushiradi
 * (packages/deploy/src/drivers/ssh.ts). Ma'lumot stdin'dan JSON bo'lib keladi: sirlar
 * buyruq satriga va logga tushmaydi.
 *
 * 1. Migratsiyalarni qo'llash (migratePcCrmDb).
 * 2. Standart do'kon sozlamalari va viloyatlar yetkazib berish tariflari.
 * 3. Birinchi admin foydalanuvchisini yaratish (agar ega ma'lumotlari berilgan bo'lsa).
 */

const inputSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/),
  name: z.string().min(1),
  databaseUrl: z.string().regex(/^postgres(ql)?:\/\//),
  authSecret: z.string().min(32),
  owner: z
    .object({
      phone: z.string().transform((v, ctx) => {
        const phone = normalizeUzPhone(v);
        if (!phone) ctx.addIssue({ code: "custom", message: "telefon noto'g'ri" });
        return phone ?? "";
      }),
      name: z.string().trim().min(2),
      password: z.string().min(8).max(128),
    })
    .nullable(),
});

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const parsed = inputSchema.safeParse(JSON.parse(await readStdin()));
if (!parsed.success) {
  console.error(`Kirish ma'lumoti noto'g'ri: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  process.exit(2);
}
const input = parsed.data;

// 1. Migratsiyalar
await migratePcCrmDb(input.databaseUrl);
console.log("PC-CRM migratsiyalari qo'llandi");

// 2. Boshlang'ich ma'lumotlar
const db = createPcCrmDb(input.databaseUrl, { max: 1 });
try {
  await db
    .insert(settings)
    .values([
      { key: "store_branding", value: { storeName: input.name, slug: input.slug } },
      { key: "usd_rate", value: { rate: 12850 } },
      { key: "tax_percent", value: { percent: 0 } },
      { key: "free_shipping_from", value: { amount: "1000000" } },
      {
        key: "store_contacts",
        value: {
          phone: "+998 71 200 00 00",
          telegram: "@venturapc_operator",
          address: "Toshkent sh., Bunyodkor shoh ko'chasi 42",
        },
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(shippingRates)
    .values([
      { region: "Toshkent shahri", price: 35_000n, estimatedDays: "1 kun", enabled: true },
      { region: "Toshkent viloyati", price: 40_000n, estimatedDays: "1-2 kun", enabled: true },
      { region: "Samarqand viloyati", price: 50_000n, estimatedDays: "2-3 kun", enabled: true },
      { region: "Farg'ona vodiysi", price: 50_000n, estimatedDays: "2-3 kun", enabled: true },
    ])
    .onConflictDoNothing();

  // 3. Birinchi admin
  if (!input.owner) {
    console.log("Ega ma'lumotlari kiritilmagan — admin yaratilmadi");
  } else {
    const auth = betterAuth({
      secret: input.authSecret,
      baseURL: "http://localhost:3004",
      database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
          user: users,
          session: sessions,
          account: accounts,
          verification: verifications,
        },
      }),
      emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 128 },
      plugins: [
        phoneNumber({
          sendOTP: async () => {
            throw new Error("Telefon OTP sozlanmagan");
          },
          phoneNumberValidator: (value) => /^\+998\d{9}$/.test(value),
          schema: { user: { fields: { phoneNumber: "phone", phoneNumberVerified: "phoneVerified" } } },
        }),
      ],
      user: {
        additionalFields: {
          role: { type: "string", input: false, defaultValue: "customer" },
          isActive: { type: "boolean", input: false, defaultValue: true },
          locale: { type: "string", input: false, defaultValue: "uz" },
        },
      },
      advanced: { database: { generateId: "uuid" } },
    });

    const [existing] = await db.select().from(users).where(eq(users.phone, input.owner.phone)).limit(1);
    const context = await auth.$context;
    let userId: string;
    if (existing) {
      userId = existing.id;
      await db
        .update(users)
        .set({ name: input.owner.name, role: "admin", isActive: true, phoneVerified: true })
        .where(eq(users.id, userId));
    } else {
      const email = `admin+${input.owner.phone.replace(/\D/g, "")}@pc-crm.invalid`;
      const user = await context.internalAdapter.createUser(
        {
          name: input.owner.name,
          email,
          emailVerified: false,
          phoneNumber: input.owner.phone,
          phoneNumberVerified: true,
          role: "admin",
          isActive: true,
          locale: "uz",
        },
        { method: "admin" },
      );
      userId = user.id;
    }

    const hash = await context.password.hash(input.owner.password);
    const existingAccounts = await context.internalAdapter.findAccounts(userId);
    if (!existingAccounts.some((a) => a.providerId === "credential")) {
      await context.internalAdapter.linkAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hash,
      });
    }
    console.log(`Admin tayyorlandi: ${input.owner.phone}`);
  }
} finally {
  await db.close();
}
