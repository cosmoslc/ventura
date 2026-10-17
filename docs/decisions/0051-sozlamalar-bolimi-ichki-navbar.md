# 0051. edu-crm: "Sozlamalar" — bitta menyu bandi, ichida o'z navbari

2026-10-17 · qabul qilingan · ADR 0036, 0039, 0040

## Vaziyat

Sozlamalarga oid sahifalar asosiy menyuda tarqoq edi ("Ofis" va "O'quv" bo'limlarida):

- Kurslar, Xonalar, Dam olish kunlari;
- Markaz sozlamalari, To'lov sozlamalari;
- Qurilmalar.

Profil va bildirishnomalar esa faqat yuqori paneldan ochilardi. Egasi bir joyni so'radi: "Sozlamalar"ga kirganda
yonida o'z navbari ochilsin. Namuna sifatida klasbox ko'rinishi berilgan.

## Qaror

- Asosiy menyuda bu bandlar o'rniga **bitta "Sozlamalar"** bandi turadi (Ofis bo'limining oxirida).
  - U xodim ochishi mumkin bo'lgan birinchi sozlamaga olib boradi.
  - Sozlamalar ichidagi istalgan sahifada (`/account/password` ham) faol ko'rinadi.
- Sahifalar Next.js route group'iga ko'chirildi: `app/(crm)/(settings)/...`. Bu guruhning `layout.tsx` fayli
  chapda guruhlangan navbar va qidiruvni beradi, sahifa o'ngda.
- **Manzillar o'zgarmadi** (`/courses`, `/rooms`, `/settings`, ...). Shuning uchun quyidagilarga tegilmadi:
  - ruxsatlar (`lib/access.ts`, manzil bo'yicha);
  - havolalar, `revalidatePath`, bildirishnoma va xatcho'plar.
- Ro'yxat bitta joyda: `lib/settings-nav.ts`.
- Band qachon ko'rinadi (`settingsFor`): bo'lim yoqilgan va sahifa ruxsati bor bo'lsa. Ruxsati yozilmagan
  sahifalar (o'z profili, bildirishnomalar) har bir xodimga ochiq. Sahifaning o'zi ruxsatni serverda yana
  tekshiradi.
- Kichik ekranda navbar tepada gorizontal tasma bo'ladi.

**Hozirgi bandlar:**

| Guruh | Bandlar |
|---|---|
| Markaz | Markaz ma'lumotlari |
| O'quv jarayoni | Kurslar, Xonalar, Bayram kunlari |
| Moliya | To'lov sozlamalari |
| Aloqa | Bildirishnomalar |
| Hisob | Mening profilim, Xavfsizlik va qurilmalar |

**Hali yo'q sahifalar** — navbarga qo'yilmadi, bo'sh joy ko'rsatilmaydi:

- til va mintaqa;
- davomat qoidalari;
- coin turlari (`/coins` hozircha bo'sh bo'lim sahifasi);
- SMS va Telegram;
- obuna to'lovi;
- AI ulanish;
- ma'lumotlarni eksport va import qilish (Excel menyusi har ro'yxatning o'zida bor, umumiy sahifa yo'q);
- ma'lumotlarni tozalash (reset).

Har biri qurilganda `SETTINGS_NAV` ga bitta qator bilan qo'shiladi.

## Oqibatlar

- Asosiy menyu qisqardi.
- Sozlamalar navbari ruxsatga qarab har xodimda boshqacha. Hech biri ko'rinmasa, "Sozlamalar" bandining o'zi ham
  chiqmaydi.
- Yangi sozlama sahifasi `(settings)` papkasiga va `SETTINGS_NAV` ga qo'shiladi. Test har bir band uchun sahifa
  fayli borligini tekshiradi.
