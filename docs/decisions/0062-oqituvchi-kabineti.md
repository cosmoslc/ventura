# 0062. edu-crm: o'qituvchi kabineti

2026-10-19 · qabul qilingan · ADR 0010, 0014, 0018, 0021, 0033, 0051, 0061

## Vaziyat

Egasi o'qituvchi uchun alohida ish joyini so'radi: o'qituvchi tizimga o'z paroli bilan kiradi va **faqat o'z
guruhlarini** ko'radi. Bo'limlar: bosh sahifa (balans, reyting, top-3 o'quvchi va top-3 o'qituvchi, bugungi va barcha
guruhlar), guruhlar (haftalik jadval, guruh ichida davomat, baholash, o'quvchilar, statistika), o'quvchilar, statistika,
moliya va profil.

Hozirgi holat:

- O'qituvchi tizimga kira olmaydi. ADR 0010 bo'yicha `teachers` jadvali xodimlardan (`users`) alohida, birinchi
  versiyada o'qituvchi portali yo'q edi (EDU-CRM-PLAN, 1-qaror).
- Ko'p hisoblar tayyor, kabinet ularni qayta ishlatadi:
  - balans, avans, jarima, guruhlar bo'yicha ulush — `loadTeacherPayroll` (ADR 0018, 0021);
  - ushlab turish va davomat — `lib/teacher-stats.ts`;
  - o'qituvchilar reytingi — `teachersReport` (ADR 0033);
  - davomat va baholar jadvali — `AttendanceTab` va `GradesTab` (ADR 0014, 0061);
  - xodim hisobini yaratish — `createStaffUser` (Better Auth, telefon va parol).

## Qaror

### 1. Alohida app emas, edu-crm ichida

Kabinet edu-crm ichida, o'z route group'i va layout'i bilan: `app/(kabinet)/kabinet/...`. Bir xil baza, RLS, kirish
(parol, Telegram kodi, qurilmalar), audit va amallar ishlatiladi. Deploy o'zgarmaydi: har markazga bitta ilova.

### 2. O'qituvchi hisobi

- `teachers.user_id` (ixtiyoriy, noyob, `users` ga FK) — o'qituvchini kirish hisobiga bog'laydi.
- `users.kind`: `staff` (standart) yoki `teacher`. `teacher` turidagi hisob **faqat kabinetni** ochadi:
  - admin CRM sahifalari yopiq, `/kabinet` ga yo'naltiriladi;
  - admin server amallari rad etiladi.
- **O'qituvchi formasi**: "Tizimga kirish paroli" maydoni (ixtiyoriy). Berilsa, telefon va parol bilan hisob
  yaratiladi (`createStaffUser`), birinchi kirishda parol almashtiriladi. Mavjud o'qituvchi profilida "Kirish berish",
  "Parolni tiklash" va "Kirishni o'chirish" amallari bor. Hammasi audit bilan.
- O'qituvchining telefoni boshqa xodimda band bo'lsa, hisob yaratilmaydi va xato ko'rsatiladi. Ham admin, ham
  o'qituvchi bo'lgan odam (masalan direktor dars beradi) birinchi versiyada admin CRM'dan foydalanadi.
- O'qituvchi o'quvchilar ma'lumotini birinchi versiyada faqat ko'radi, tahrirlay olmaydi.
- Kabinetdagi ruxsatlar odatdagidek lavozimdan olinadi: "O'qituvchi / Mentor" lavozimi standart biriktiriladi.
  Masalan, o'tgan kun davomatini o'zgartirish uchun `attendance.student_edit_past` kerak bo'ladi.

**1-bosqichda amalga oshirilgani:**

- Parol formada yoziladi (egasining talabi). Xodimlar bo'limidagi qoida ("parol formada yozilmaydi, vaqtinchalik
  parol ko'rsatiladi") o'qituvchiga tatbiq etilmaydi. Shu sababli birinchi kirishda parol baribir almashtiriladi.
- Kirish berish uchun `staff.create`, parolni yangilash uchun `staff.edit`, kirishni o'chirish uchun `staff.delete`
  kerak. Beruvchida "O'qituvchi / Mentor" lavozimining hamma ruxsatlari bo'lishi shart: ruxsat oshirishga yo'l yo'q.
- Kirish o'chirilganda hisob arxivlanadi, telefon band qoladi. Qayta berilganda o'sha hisob tiklanadi. O'qituvchi
  arxivlansa, sessiyasi keyingi so'rovdayoq yopiladi.
- O'qituvchi hisoblari (`kind = 'teacher'`) quyidagilarga kirmaydi:
  - "Xodimlar" ro'yxati va arxivi;
  - xodimlar oyligi (oyligi o'qituvchi sifatida, `teachers` orqali hisoblanadi);
  - filialga biriktirish va lid mas'ullari;
  - xarajat tanlovi va global qidiruv;
  - admin bildirishnomalari.
- Admin qism yopiq: `requireStaff()` o'qituvchini `/kabinet` ga yuboradi, `crmAction` esa `teacher: true` bilan
  belgilanmagan amalni rad etadi. Hozir ochiq amallar: davomat, baho, coin tarixi, o'z sessiyalarini yopish va
  kabinet profili. Filial tanlovi, qidiruv va tasdiqlar o'qituvchiga yopiq.

### 3. "Faqat o'z guruhlari"

Hozir ko'rinish faqat filial bo'yicha cheklanadi. Yangi cheklov: `teacher` hisobi uchun `staff.teacherId`, va har
so'rov hamda amalda guruh `groups.teacher_id = staff.teacherId` bo'lishi shart. Bu server tomonida tekshiriladi:

- kabinet ma'lumot yuklovchilari: guruhlar, o'quvchilar (o'z guruhlaridagi a'zolar), statistika;
- mavjud amallar: davomat (`lessonContext`), baho (`saveGradeAction`), coin tarixi. Boshqa o'qituvchining guruhi
  bo'lsa — "topilmadi";
- testlarda alohida tekshiriladi: boshqa guruhga davomat yoki baho yozib bo'lmaydi, boshqa o'quvchini ko'rib bo'lmaydi.

### 4. Sahifalar

| Sahifa | Manzil | Tarkibi |
|---|---|---|
| Bosh sahifa | `/kabinet` | Kartalar: balans (Kirim − Chiqim, ish haqi bilan bir manba), reytingdagi o'rni ("3 / 12"). Top-3 o'quvchi (o'z guruhlaridan), top-3 o'qituvchi (markaz bo'yicha, ADR 0033 tartibi), o'z o'rni. Bugungi guruhlar (vaqt, xona, o'quvchilar soni, davomat olinganmi), pastda barcha guruhlar |
| Guruhlar | `/kabinet/guruhlar` | Ro'yxat va **haftalik jadval**: tepada hafta kunlari, chapda soatlar, kataklarda guruh qutilari (vaqti va xonasi bilan). Hafta oldinga/orqaga |
| Guruh | `/kabinet/guruhlar/[id]` | Tablar: Davomat (`AttendanceTab`), Baholash (`GradesTab`), O'quvchilar (ro'yxat, coin balansi), Statistika (eng past va eng yuqori o'quvchi, o'zlashtirish foizi, davomat va uy vazifasi foizi) |
| O'quvchilar | `/kabinet/oquvchilar` | Admin sahifasidagi jadval va kartalar, lekin faqat o'z guruhlaridagi o'quvchilar, faqat ko'rish |
| Statistika | `/kabinet/statistika` | Oy tanlovi. O'tkazilgan va o'tkazilmagan darslar (o'tgan dars kuni davomat olinmagan bo'lsa — o'tkazilmagan), soatlar. O'quvchilar baho darajalari bo'yicha (a'lo / yaxshi / qoniqarli / past, o'rtacha foizdan). Ushlab turish, davomat, jarima va avanslar |
| Moliya | `/kabinet/moliya` | Oy tanlovi. Balans, hisoblangan oylik, avanslar, jarimalar, bonuslar. Guruhlar bo'yicha o'quvchilardan tushgan pul, ulush foizi va hisoblangan ulush |
| Profil | `/kabinet/profil` | Ma'lumotlarni tahrirlash (ism, rasm), xavfsizlik: parol, Telegram, qurilmalar (mavjud `/account` va `/devices` qismlari) |

Kabinet menyusi kompyuterda chap tomonda, telefonda pastda turadi. Matnlar `lib/uz.ts` da. UI faqat `packages/ui`
komponentlari va `packages/config/tokens/ventura.css` tokenlaridan quriladi. Yetishmagan komponentlar `packages/ui`
ga qo'shiladi va STYLE.md da yoziladi:

- `WeekSchedule` — haftalik jadval;
- `RankList` — top-3 va o'rin;
- `DistributionBar` — baho darajalari.

### 5. Bosqichlar

Har biri alohida branch va PR:

1. `edu/kabinet-kirish` — `users.kind`, `teachers.user_id` (migratsiya), formada parol va kirish amallari, kirishda
   yo'naltirish, admin sahifalar va amallarni yopish, "faqat o'z guruhlari" cheklovi mavjud amallarda, kabinet
   layout'i va Profil.
2. `edu/kabinet-guruhlar` — Bosh sahifa, Guruhlar (haftalik jadval), Guruh sahifasi (4 tab).
3. `edu/kabinet-tahlil` — O'quvchilar, Statistika, Moliya.

## 2-bosqichda amalga oshirilgani

- **Bosh sahifa** — bitta qatorda uchta karta:
  - balans (Ish haqi bo'limi yoqilgan bo'lsa);
  - reytingdagi o'rni (joriy oy, ADR 0033 tartibi);
  - bugungi darslar soni va ulardan davomat olinganlari.

  Ostida ikkita reyting:
  - top-3 o'qituvchi (`RankList`): faqat ism, o'z o'rni pastda;
  - top-3 o'quvchi: o'z guruhlaridagi ochiq a'zolar, coin balansi bo'yicha.

  Eng pastda bugungi guruhlar ("davomat olingan / olinmagan" belgisi bilan) va barcha guruhlar.
- **Guruhlar** — haftalik jadval (`WeekSchedule`, hafta dushanbadan, `?hafta=`), shanba va yakshanba faqat dars
  bo'lsa ko'rinadi. Ostida ro'yxat.
- **Guruh sahifasi** (`/kabinet/guruhlar/[id]`, boshqa o'qituvchiniki — 404). Tablar:
  - Davomat va Baholash — admin profilidagi jadvallar. O'quvchi nomi havolasiz, birinchi darsga kelgan lidlar
    ko'rsatilmaydi.
  - O'quvchilar — ochiq a'zolar, coin balansi va "Coin berish".
  - Statistika — oy bo'yicha:
    - o'zlashtirish (hamma baholarning o'rtachasi, %, daraja bilan);
    - davomat va uy vazifasi foizi;
    - eng yuqori va eng past o'quvchi;
    - o'quvchilar jadvali.
  - O'zlashtirish darajalari (`masteryLevel`): a'lo ≥ 85%, yaxshi ≥ 70%, qoniqarli ≥ 50%, past < 50%.
- **Qo'lda coin** (`coin_entries.rule = 'manual'`, migratsiya 0030):
  - yozuvda sabab (`note`, 1–300) va bergan xodim (`created_by`) bo'ladi, buni CHECK cheklovi talab qiladi;
  - sozlama `coins.manual = { enabled, dailyLimit }`: bir o'quvchiga kuniga ko'pi bilan `dailyLimit` coin, kim
    berganidan qat'i nazar;
  - cheklov tranzaksiyada, o'quvchi qulfi bilan tekshiriladi;
  - qo'lda berish uchun `bonuses.manage` ruxsati kerak (o'qituvchi lavozimida bor), o'qituvchi faqat o'z guruhidagi
    o'quvchiga beradi;
  - audit — `coin.manual`;
  - qo'lda berilgan coinni bekor qilish bu bosqichda yo'q.

## 3-bosqichda amalga oshirilgani

- **O'quvchilar** (`/kabinet/oquvchilar`):
  - admin jadvali uslubida (`StudentsTable`), faqat ko'rish;
  - faqat o'z guruhlaridagi ochiq a'zolar, boshqa guruhlari ko'rinmaydi;
  - kartalar: jami, faol, sinovda, o'zlashtirishi past;
  - filtrlar: qidiruv, guruh, holat;
  - ustunlar: guruhlari (kabinetdagi guruhga havola), joriy oy davomati, o'rtacha baho va daraja, coin, holat.
- **Statistika** (`/kabinet/statistika`, `?oy=`):
  - o'tkazilgan va o'tkazilmagan darslar: o'tgan dars kunlari bayramsiz; davomat olinmagan kun — o'tkazilmagan;
  - soat, ushlab turish va davomat (o'qituvchi profili bilan bir hisob, ADR 0021);
  - guruhlar bo'yicha darslar;
  - o'quvchilar daraja taqsimoti (`DistributionBar`);
  - avans, jarima va bonus, oy yozuvlari (Ish haqi bo'limi yoqilgan bo'lsa).
- **Moliya** (`/kabinet/moliya`, `?oy=`) — Ish haqi bo'limi bilan bir manba, faqat ko'rish:
  - kartalar: balans, hisoblangan, bonus, jarima, berilgan;
  - guruhlar bo'yicha o'quvchilardan tushgan pul, shart va ulush;
  - oy yozuvlari va "To'lovlardan hisoblangan ulush" (o'qituvchi profilidagi jadvallar, amallarsiz).

## Egasi javoblari

1. **Coin berish** — o'qituvchi qo'lda bera oladi (2-bosqichda, guruhning "O'quvchilar" tabida). ADR 0061 ga yangi
   `manual` qoidasi qo'shiladi:
   - sabab majburiy;
   - bir o'quvchiga kunlik cheklov (sozlamada);
   - direktor sozlamada butunlay o'chira oladi.
2. **Top-3 o'quvchi** — coin balansi bo'yicha, o'qituvchining o'z guruhlaridan.
3. **Top-3 o'qituvchi** — markaz bo'yicha, ism va o'rni ko'rinadi, raqamlar ko'rinmaydi.

## Oqibatlar

- Ikki ustun qo'shiladi (`users.kind`, `teachers.user_id`). Yangi jadval yo'q.
- Mavjud davomat va baho amallariga guruh egasi tekshiruvi qo'shiladi (admin xodimlar uchun o'zgarmaydi).
- O'qituvchi soni ko'p markazda Telegram kodi bilan kirish o'qituvchilar uchun ham ishlaydi (markaz sozlamasi).
- ADR 0061 ning 3-bosqichi ("Xotira") hali qilinmagan.
