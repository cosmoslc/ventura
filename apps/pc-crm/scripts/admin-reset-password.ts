import { eq } from "drizzle-orm";
import { createPcCrmDb } from "@ventura/db";
import { accounts, users, sessions, verifications } from "@ventura/db/schema/pc-crm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber } from "better-auth/plugins";

const DEFAULT_DB_URL = "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/pc_crm_dev";

async function main() {
  const targetPhone = process.argv[2] || "+998902021479";
  const newPassword = process.argv[3] || "Admin12345678!";

  console.log(`[reset-password] Target phone: ${targetPhone}`);
  console.log(`[reset-password] New password: ${newPassword}`);

  const db = createPcCrmDb(DEFAULT_DB_URL, { max: 1 });

  try {
    const auth = betterAuth({
      secret: "local-only-pc-crm-secret-change-before-deploy-1234567890",
      baseURL: "http://localhost:3004",
      database: drizzleAdapter(db, {
        provider: "pg",
        schema: { user: users, session: sessions, account: accounts, verification: verifications },
      }),
      emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
      plugins: [
        phoneNumber({
          sendOTP: async () => {},
          phoneNumberValidator: (val) => /^\+998\d{9}$/.test(val),
          schema: { user: { fields: { phoneNumber: "phone", phoneNumberVerified: "phoneVerified" } } },
        }),
      ],
      user: {
        additionalFields: {
          role: { type: "string", defaultValue: "customer" },
          isActive: { type: "boolean", defaultValue: true },
          locale: { type: "string", defaultValue: "uz" },
        },
      },
      advanced: { database: { generateId: "uuid" } },
    });

    // 1. Foydalanuvchini topish
    const [user] = await db.select().from(users).where(eq(users.phone, targetPhone)).limit(1);

    if (!user) {
      console.error(`Xatolik: ${targetPhone} raqamli foydalanuvchi topilmadi.`);
      return;
    }

    console.log(`Foydalanuvchi topildi: ${user.name} (${user.id}), roli: ${user.role}`);

    // 2. Yangi parolni xesh qilish
    const context = await auth.$context;
    const hashedPassword = await context.password.hash(newPassword);

    // 3. Accounts jadvalidagi parolni yangilash
    const [existingAccount] = await db.select().from(accounts).where(eq(accounts.userId, user.id)).limit(1);

    if (existingAccount) {
      await db.update(accounts).set({ password: hashedPassword }).where(eq(accounts.id, existingAccount.id));
      console.log(`Mavjud akkount paroli yangilandi!`);
    } else {
      await db.insert(accounts).values({
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      });
      console.log(`Yangi credential akkount ulandi va parol o'rnatildi!`);
    }

    // Role admin bo'lishini ta'minlash
    await db.update(users).set({ role: "admin", isActive: true, phoneVerified: true }).where(eq(users.id, user.id));

    console.log(`\n✅ MUVAFFAQIYATLI YAKUNLANDI!`);
    console.log(`Admin telefon raqami: ${user.phone}`);
    console.log(`Yangi parol: ${newPassword}`);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
