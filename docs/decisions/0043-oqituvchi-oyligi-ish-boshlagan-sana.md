# 0043. edu-crm: support oyligi, ulush ro'yxati va belgilangan oylikda ish boshlagan sana

2026-10-16 · qabul qilingan · EDU-CRM-FIXES 2.1, 2.2, 2.3; ADR 0018 (ish haqi) va 0021 (o'qituvchi profili) bilan bog'liq

## Vaziyat

1. **Support o'qituvchining oyligi** hisoblanadimi — savol ochiq turgan edi.
2. **Profildagi "To'lovlardan hisoblangan ulush" tabi** guruhlar bo'yicha yig'ma (tushum va ulush) ko'rsatar edi.
   Eski tizimda esa har bir to'lov alohida qatorda: o'quvchi, to'langan summa, ulush sharti va ustozga hisoblangan
   summa.
3. **Belgilangan oylik** (o'qituvchining o'zi yoki guruhdagi summa) har oyga to'liq yozilar edi:
   - oyning o'rtasida ishga kirgan o'qituvchi ham butun oylikni olardi;
   - o'qituvchi tizimga qo'shilishidan oldingi oylarga ham oylik yozilardi. Buni faqat o'qituvchilar reytingi
     hisoboti vaqtincha `since` xaritasi bilan yashirib turgan edi.

## Qaror

### Support o'qituvchi (2.1)

**Ha, hisoblanadi — belgilangan oylik sifatida.**

- Eski tizimda support formasida faqat "Oylik maosh" bor edi (turi doim belgilangan). Hozirgi tizim ham shunday:
  support yaratilganda `salary_type = fixed`, summa `fixed_salary`ga yoziladi.
- Support o'z guruhiga ega emas, shuning uchun foiz yoki o'quvchi soniga bog'lanmaydi. Ustozining guruhlaridagi
  tushumdan foiz berish eski tizimda ham, bu yerda ham yo'q — ataylab qo'shilmadi.
- U Ish haqi sahifasida va profilida o'qituvchilar bilan bir xil ko'rinadi (rol: "Support"): hisoblangan, bonus va
  jarima, avans, maosh, qoldiq.
- Yangi qoida faqat bitta: oylik ham ish boshlagan sanadan hisoblanadi (pastga qarang).

### Ulush ro'yxati (2.2)

Eski profildagi tab ko'chirildi va ish haqi bilan bir manbaga ulandi:

- Jadval (tanlangan oy): o'quvchi, guruh, to'langan summa, ulush sharti, ustozga hisoblandi, sana. Qaytarish manfiy
  summa va manfiy ulush bilan chiqadi.
- **Ulush sharti:** foiz — `40%`; har bir o'quvchi uchun — `100 000 so'm / o'quvchi`; belgilangan — "Belgilangan
  oylik".
- **Belgilangan oyliklar** alohida qatorlarda: o'qituvchining o'z oyligi va guruhdagi o'zgacha summa; ish boshlagan
  sana va (to'liq bo'lmagan oyda) kunlar ko'rsatiladi.
- **Jami qator = Ish haqi sahifasidagi "hisoblangan"** (aynan teng). Buning uchun hisob bitta pure funksiyaga
  (`groupShares`) o'tkazildi, `groupPay` shu qatorlarning yig'indisini oladi:
  - foiz: har to'lovdan `round(summa × koeffitsient × foiz / 100)` (avvalgidek);
  - har bir o'quvchi uchun: o'quvchining chegarasi to'lovlarga sana tartibida bo'linadi (jamlangan summalar
    ayirmasi). Bo'lib-bo'lib to'laganda ham, ortiqcha to'lov yoki qaytarishda ham yig'indi oldingi formula bilan
    bir xil.
  - belgilangan guruhda to'lovlar 0 (ro'yxatda "—").
- Qatorlar faqat to'lovlari borlarni emas, hamma to'lovni ko'rsatadi (tushum jami to'lovlarga teng bo'lishi uchun).

### Ish boshlagan sana (2.3)

**Ma'lumot (migratsiya `0021_fixed_salary_start.sql`):**

- `teachers.salary_start_date date null` — o'qituvchining (support ham) o'z belgilangan oyligi shu sanadan.
- `groups.teacher_salary_from date null` — guruhdagi belgilangan summa shu sanadan.
- CHECK: ikkalasi ham faqat belgilangan turida (`salary_type = 'fixed'` / `teacher_salary_type = 'fixed'`) bo'lishi
  mumkin. Mavjud qatorlar o'zgarmaydi (hammasi `null`).

**Standart (sana kiritilmasa):**

- guruhdagi summa — guruh boshlangan sana (`groups.start_date`);
- o'qituvchining o'z oyligi — tizimga qo'shilgan kun (Toshkent) va uning guruhlaridan eng erta boshlangani, qaysi biri
  oldin bo'lsa. Sabab: guruhi oldin boshlangan o'qituvchi ishga ham oldin kirgan.
- Formada: o'qituvchi formasida (belgilangan turi va support) va guruh formasida (belgilangan summa tanlanganda)
  "Ish boshlagan sana" maydoni. Guruhda maydon guruh boshlanish sanasi bilan to'ldirilib turadi; shu sanaga teng
  qoldirilsa `null` saqlanadi (guruh sanasi o'zgarsa, ergashadi).

**Hisob (`lib/payroll.ts`):**

- Sanadan oldingi oylar — 0.
- Sana oyida — `round(summa × ishlangan kun / oydagi kun)`. Boshlagan kun ham sanaladi (15-oktabr: 17/31). Oyning
  1-kuni — to'liq oy.
- Keyingi oylar — to'liq.
- **Kunlar bo'yicha, darslar bo'yicha emas.** Sabab: darslar soni bayram va jadval o'zgarishiga bog'liq, bunda oylik
  keyinroq o'zgarib ketardi. Kunlar bo'yicha summa oldindan aniq va tushuntirish oson. Foiz va o'quvchi uchun turlariga
  ta'sir qilmaydi: ular zaten haqiqiy to'lovdan hisoblanadi.
- `teacherAccrual` va `groupPay` ixtiyoriy `month` oladi (server doim beradi). Berilmasa sana hisobga olinmaydi.
- Natijada `baseProration` / `proration` ({ days, total }) ham qaytadi: interfeys "16/31 kun"ni ko'rsatadi.

**`since` yechimi olib tashlandi:** o'qituvchilar reytingi hisoboti (`lib/server/teacher-reports.ts`) endi faqat
`loadPayroll` natijasini yig'adi. Boshlanishdan oldingi oylar ish haqi hisobining o'zida 0.

## Oqibatlari

- Eski o'qituvchilarda sana `null` — ularga standart ishlaydi. Natija o'zgarishi mumkin bo'lgan holat: o'qituvchi
  tizimga qo'shilgan kundan oldin boshlangan guruhi bor bo'lsa, oylik shu guruh sanasidan hisoblanadi (oldin faqat
  qo'shilgan kunning oyidan). Bu to'g'riroq, lekin eski oylar uchun "hisoblangan" oshishi mumkin.
- Ketgan o'qituvchiga oylik tugash sanasi yo'q: arxivlangan o'qituvchi ish haqi ro'yxatidan chiqadi, lekin profilida
  ochilgan oylarda belgilangan oylik hisoblanadi. Tugash sanasi keyingi vazifa.
- Migratsiya qo'llangunicha o'qituvchilar va guruhlar sahifalari yangi ustunlarni so'raydi.

## Sinov

- Vitest (`lib/payroll.test.ts`): kunlar, sanadan oldingi/birinchi/keyingi oy, yaxlitlash, standart sana, support
  o'z oyligi, guruhdagi summa; to'lov qatorlari yig'indisi `groupPay` ga teng (foiz, bo'lib-bo'lib to'lash, ortiqcha
  to'lov, qaytarish).
- Haqiqiy PostgreSQL (`lib/server/payroll.db.test.ts`): profil qatorlari yig'indisi hisobga teng; aniq sana va
  standart sana (qo'shilgan kun va guruh sanasi); CHECK himoyasi.
