import { eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeUzPhone } from "@ventura/auth";
import { createStaffAuth, createStaffUser, ensurePositions } from "@ventura/auth/staff";
import { createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { branches, users } from "@ventura/db/schema/tenant";
import { tenantAudit } from "@ventura/security";

/*
 * Mijozni tayyorlash — deploy'ning `migrate` qadami serverda, yangi reliz ichida ishga tushiradi
 * (packages/deploy/src/drivers/ssh.ts). Ma'lumot stdin'dan JSON bo'lib keladi: sirlar buyruq satriga,
 * jarayonlar ro'yxatiga va logga tushmaydi. Chiqishda sir yo'q.
 *
 * 1. Migratsiyalar (baza egasi nomidan — rol bazaning egasi, ventura-db yaratgan).
 * 2. Birinchi filial ("Asosiy filial"), filial bo'lmasa.
 * 3. Lavozimlar: 7 ta tayyor shablon (lavozim bo'lmasa) — eski tizimdagidek.
 * 4. Birinchi direktor — Yangi loyiha formasidagi ega (telefon, ism, vaqtinchalik parol), direktor bo'lmasa.
 * Qayta ishga tushirish xavfsiz: bor narsa o'zgartirilmaydi.
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
  // Qiymatlar emas, faqat maydon nomlari
  console.error(`Kirish ma'lumoti noto'g'ri: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  process.exit(2);
}
const input = parsed.data;

await migrateTenantDb(input.databaseUrl);
console.log("Migratsiyalar qo'llandi");

const db = createTenantDb(input.databaseUrl, input.slug);
try {
  await db.run(async (tx) => {
    const [branch] = await tx.select({ id: branches.id }).from(branches).limit(1);
    if (!branch) {
      await tx.insert(branches).values({ name: "Asosiy filial" });
      console.log("Birinchi filial yaratildi: Asosiy filial");
    }

    await ensurePositions(tx);

    const [director] = await tx.select({ id: users.id }).from(users).where(eq(users.role, "director")).limit(1);
    if (director) {
      console.log("Direktor allaqachon bor — o'zgartirilmadi");
    } else if (!input.owner) {
      console.log("Ega (telefon va ism) kiritilmagan — direktor yaratilmadi");
    } else {
      const auth = createStaffAuth({
        db: tx,
        telegram: null,
        appName: input.name,
        secret: input.authSecret,
        baseURL: "http://localhost",
      });
      const user = await createStaffUser(auth, tx, {
        phone: input.owner.phone,
        name: input.owner.name,
        password: input.owner.password,
        role: "director",
        // Formadagi parol vaqtinchalik: birinchi kirishda almashtiriladi (CI: server deploy testi)
        mustChangePassword: true,
      });
      await tenantAudit.record(tx, {
        actor: { type: "system", name: "Ventura deploy" },
        action: "user.create",
        target: { type: "user", id: user.id },
        metadata: { role: "director", source: "project.owner" },
      });
      console.log(`Direktor yaratildi: ${input.owner.name} (birinchi kirishda parolni almashtiradi)`);
    }
  });
} finally {
  await db.close();
}
