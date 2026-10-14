# 0030. edu-crm: hisobotlar bo'limi asosi va moliyaviy hisobotlar (E5a)

2026-10-14 · qabul qilingan · docs/EDU-CRM-E5.md (E5a), EDU-CRM-PLAN E5

## Vaziyat

Eski tizimda "Hisobotlar" menyusida 30 ga yaqin band bor edi. Muammolari:

- bir qismi qo'lda yozilgan soxta raqamlarni ko'rsatardi;
- hisob brauzerda qilinardi, shuning uchun bir xil raqam turli sahifada turlicha chiqardi;
- pul oqimi rejasi xarajatlar rejasidan alohida yashardi.

Ventura'da "Hisobotlar" bandi bor edi, lekin sahifasi yo'q edi ("bo'lim tayyorlanmoqda").

## Qaror

### Tuzilma

- **Hisobotlar ro'yxati** — `/reports`. Guruhlangan kartalar: moliya, o'quv jarayoni, lidlar, o'qituvchilar.
  - Xodim faqat ruxsati va bo'limi bor hisobotlarni ko'radi.
  - Boshqa sahifalardagi hisobotlar (bosh panel, davomat hisoboti) — havola bilan, qayta yozilmaydi.
- **Hisobot sahifasi** — `/reports/<kalit>`. Tarkibi:
  - filtr qatori;
  - 4 ta qisqa ko'rsatkich (`MetricCard`);
  - jadval;
  - hisob qoidasi izohi.
- **Hisobot ro'yxati** `lib/server/reports.ts` da (`REPORTS`). Har hisobotda: guruh, bo'lim, ruxsatlar, davr turi va
  yuklovchi. Yuklovchi bitta tuzilma qaytaradi — ko'rsatkichlar va jadval (`lib/reports.ts`). Ekran ham, Excel ham
  shundan chiziladi, ya'ni ekrandagi raqam faylda ham aynan shu.
- **Filtr qatori:**
  - davr turi: yillik (faqat yil), davrli (yil, oy, "butun yil" yoki "barcha davr"), oylik (yil va oy yoki "butun
    yil", "barcha davr"siz);
  - tanlov manzilda saqlanadi (`?yil=&oy=`);
  - filial — tepadagi umumiy tanlov.
- **Excel** — `/reports/excel/<kalit>?yil=&oy=`. Sahifa bilan bir xil yuklovchi ishlatiladi. Raqamlar son bo'lib
  yoziladi, foiz `0.0%` formatida.
- **Jadval:** birinchi ustun yopishqoq, raqamlar o'ngda, manfiy pul qizil, bo'lim va jami qatorlari ajratilgan.

### Moliyaviy hisobotlar (ruxsat `dashboard.financial_stats`)

| Hisobot | Davr | Manba | Mazmuni |
| --- | --- | --- | --- |
| Pul oqimi | yil | `loadFlows` (bosh panel bilan umumiy) | 12 oy |
| Reja, fakt va prognoz | oy / yil | `loadFlows`, `finance_plans`, ADR 0016 rejalari, o'quvchi hisobi | kirim va chiqim qatorlari |
| Xarajatlar tahlili | oy / yil / barcha | xarajatlar va ADR 0016 rejalari | toifalar bo'yicha reja, fakt, farq, bajarilish, ulush, kirimdan ulush |
| Chegirmalar tahlili | oy / yil / barcha | o'quvchi hisobi (`loadAccounts`) va bir martalik chegirmalar | o'quvchi bo'yicha |
| Kurs bo'yicha daromad | oy / yil / barcha | o'quvchi hisobi va to'lovlar | kurs bo'yicha |

**Pul oqimi:**

- kirim — to'lovlar va qo'shimcha daromad;
- chiqim — xarajat toifalari, ish haqi, avans, qaytarishlar;
- natija — sof oqim va yig'ma qoldiq;
- hali kelmagan oylar bo'sh.

**Reja, fakt va prognoz** (eski tizimdagi "Reja / Fakt / Prognoz"):

- **Qatorlar:** o'quvchi to'lovlari, qo'shimcha daromad, jami kirim; ish haqi va avans, xarajatlar, qaytarishlar,
  jami chiqim; sof oqim.
- **Ustunlar:** reja, fakt, bajarilish, prognoz, prognozning rejaga nisbati.
- **Reja:**
  - to'lovlar, qo'shimcha daromad va ish haqi — yangi `finance_plans` jadvali (0017 migratsiyasi, FORCE RLS):
    filial + oy + qator bo'yicha bitta summa, `UNIQUE`, summa > 0, qator ro'yxatdan (CHECK);
  - xarajatlar — ADR 0016 toifa rejalari yig'indisi. Eski tizimdagidek ikkinchi xarajat rejasi yo'q;
  - qaytarishlar rejasiz.
- **Prognoz** (eski tizimda bu ustun doim bo'sh edi):
  - o'tgan oy — fakt;
  - joriy oy — fakt va kutilgan summadan kattasi;
  - kelgusi oylar — kutilgan summa.

  Kutilgan to'lov — joriy oyda o'quvchilar hisobidagi hisoblangan summa (o'quvchilar tarkibi o'zgarmasa). Boshqa
  qatorlar uchun — reja, reja bo'lmasa oxirgi 3 to'liq oy o'rtachasi. "Butun yil"da prognoz — yil oxiriga kutilgan
  natija.
- **Rejani kiritish** — hisobot sahifasidagi "Rejani kiritish" oynasi: bir filialning 12 oy × 3 qatori bir martada
  saqlanadi (tranzaksiya). Bo'sh katak — reja o'chiriladi.
  - Ruxsat — hisobotni ko'radigan `dashboard.financial_stats`. Reja pul yozuvi emas, tasdiq so'rovisiz.
  - Filial cheklovi bor xodim faqat o'z filiallari rejasini o'zgartiradi.
  - Har saqlash jurnalga `finance_plan.update` bo'lib yoziladi (oy, qator, oldingi va yangi summa). Pul amallari
    tarixida xarajatlar guruhida ko'rinadi.

**Chegirmalar tahlili** — har o'quvchi uchun: doimiy chegirma, bir martalik chegirma, oylar va chegirma sababi.
Ko'rsatkichlar — jami chegirma va chegirmasiz hisobdagi ulushi. Doimiy chegirma summasi oy hisobidagi farq bilan
olinadi: `(asl narx − chegirmali narx) × to'lanadigan darslar / oydagi darslar`. Bu hisoblangan summa bilan bir xil
ulush.

**Kurs bo'yicha daromad** — har kurs uchun: guruhlar, o'quvchilar, asl narxdagi summa, chegirma, hisoblangan summa,
tushum va ulush. Tushum — guruh uchun qabul qilingan to'lovlardan qaytarishlar ayrilgani.

### Bitta manba

- Pul oqimi bosh panel kodidan `loadFlows` sifatida ajratildi. Bosh panel ham shundan foydalanadi.
- Reja va prognoz hisobotining fakti ham `loadFlows` dan — pul oqimi va bosh panel bilan bir xil.

## Sinov

- **Vitest:** pul oqimi jadvali, xarajatlar qatorlari, chegirma ulushi, hisobot davri, prognoz qoidasi (o'tgan,
  joriy, kelgusi oy; reja yo'q — 3 oy o'rtachasi) va jami qatorlar.
- **Haqiqiy PostgreSQL** (EDU-CRM-PLAN qabul sharti):
  - pul oqimi oyi bosh panel bilan bir xil;
  - xarajat reja va fakti;
  - chegirma va kurs daromadi o'quvchi hisobi bilan bir xil;
  - reja: kirim rejasi, xarajat rejasi, o'quvchi hisobidan kutilgan to'lov; `finance_plans` CHECK va UNIQUE himoyasi;
  - boshqa mijoz ko'rmaydi.
- **Mahalliy sinov bazasi:** pul oqimidagi oktyabr kirimi bosh paneldagi tushum bilan bir xil chiqdi.

## Oqibatlari

- E5b–E5d hisobotlari shu ro'yxatga yangi kalit bilan qo'shiladi. Sahifa, filtr va Excel tayyor.
- Operatsion ko'rsatkichlar rejasi (lidlar, o'quvchilar, konversiya) — keyinga qoldirilgan ro'yxatda
  (docs/EDU-CRM-E5.md), xuddi shu tuzilmada qo'shiladi.
