import { eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeUzPhone } from "@ventura/auth";
import { createSawmillDb } from "@ventura/db";
import { migrateSawmillDb } from "@ventura/db/migrate/sawmill";
import { branches, materials, users, workTypes } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { createSawmillAuth } from "../lib/server/auth";

/*
 * Sawmill mijozini tayyorlash — deploy'ning `migrate` qadami serverda ishga tushiradi.
 * Ma'lumot stdin'dan JSON bo'lib keladi (xavfsiz, logga tushmaydi).
 *
 * 1. Migratsiyalarni qo'llash (migrateSawmillDb).
 * 2. Boshlang'ich sex: "Asosiy sex".
 * 3. Standart ish turlari: Sartirofka (sorting), Terak kesish (regular).
 * 4. Standart materiallar: Vassa, Kvadrat, Dona, Bay.
 * 5. Birinchi ega (owner) foydalanuvchisi.
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

await migrateSawmillDb(input.databaseUrl);
console.log("Sawmill migratsiyalari muvaffaqiyatli qo'llandi");

const db = createSawmillDb(input.databaseUrl, input.slug, { max: 1 });
try {
  // 1. Asosiy sex
  const [branch] = await db.select({ id: branches.id }).from(branches).limit(1);
  if (!branch) {
    await db.insert(branches).values({ name: "Asosiy sex" });
    console.log("Birinchi sex yaratildi: Asosiy sex");
  }

  // 2. Standart ish turlari
  const [existingWorkType] = await db.select({ id: workTypes.id }).from(workTypes).limit(1);
  if (!existingWorkType) {
    await db.insert(workTypes).values([
      { name: "Sartirofka", kind: "sorting", isSystem: true },
      { name: "Terak kesish", kind: "regular", isSystem: true },
    ]);
    console.log("Standart ish turlari yaratildi (Sartirofka, Terak kesish)");
  }

  // 3. Standart materiallar
  const [existingMaterial] = await db.select({ id: materials.id }).from(materials).limit(1);
  if (!existingMaterial) {
    await db.insert(materials).values([
      { name: "Vassa", unit: "dona", pricingMode: "piece" },
      { name: "Kvadrat", unit: "qator", pricingMode: "row" },
      { name: "Dona", unit: "dona", pricingMode: "piece" },
      { name: "Bay", unit: "bay", pricingMode: "piece" },
    ]);
    console.log("Standart materiallar yaratildi (Vassa, Kvadrat, Dona, Bay)");
  }

  // 4. Birinchi ega (owner)
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.role, "owner")).limit(1);
  if (owner) {
    console.log("Egasi (owner) allaqachon mavjud — o'zgartirilmadi");
  } else if (!input.owner) {
    console.log("Ega ma'lumotlari kiritilmagan — foydalanuvchi yaratilmadi");
  } else {
    const auth = createSawmillAuth({
      db,
      appName: input.name,
      secret: input.authSecret,
      baseURL: "http://localhost:3003",
    });

    const ctx = await auth.$context;
    const hash = await ctx.password.hash(input.owner.password);
    const internalEmail = `${input.owner.phone}@sawmill.local`;

    const user = await ctx.internalAdapter.createUser(
      {
        name: input.owner.name,
        email: internalEmail,
        phoneNumber: input.owner.phone,
        phoneNumberVerified: true,
        role: "owner",
        locale: "uz",
        telegramChatId: null,
        twoFactorEnabled: false,
        mustChangePassword: false,
        failedAttempts: 0,
      },
      { method: "admin" },
    );

    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: hash,
    });

    await db.update(users).set({ phoneNumber: input.owner.phone }).where(eq(users.id, user.id));

    await tenantAudit.record(db, {
      actor: { type: "system", name: "Ventura deploy" },
      action: "user.create",
      target: { type: "user", id: user.id },
      metadata: { role: "owner", source: "project.owner" },
    });

    console.log(`Egasi yaratildi: ${input.owner.name} (${input.owner.phone})`);
  }
} finally {
  await db.close();
}
