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
  - yil va (davrli hisobotda) oy, "butun yil" yoki "barcha davr";
  - tanlov manzilda saqlanadi (`?yil=&oy=`);
  - filial — tepadagi umumiy tanlov.
- **Excel** — `/reports/excel/<kalit>?yil=&oy=`. Sahifa bilan bir xil yuklovchi ishlatiladi. Raqamlar son bo'lib
  yoziladi, foiz `0.0%` formatida.
- **Jadval:** birinchi ustun yopishqoq, raqamlar o'ngda, manfiy pul qizil, bo'lim va jami qatorlari ajratilgan.

### Moliyaviy hisobotlar (ruxsat `dashboard.financial_stats`)

| Hisobot | Davr | Manba | Mazmuni |
| --- | --- | --- | --- |
| Pul oqimi | yil | `loadFlows` (bosh panel bilan umumiy) | 12 oy |
| Xarajatlar tahlili | oy / yil / barcha | xarajatlar va ADR 0016 rejalari | toifalar bo'yicha reja, fakt, farq, bajarilish, ulush, kirimdan ulush |
| Chegirmalar tahlili | oy / yil / barcha | o'quvchi hisobi (`loadAccounts`) va bir martalik chegirmalar | o'quvchi bo'yicha |
| Kurs bo'yicha daromad | oy / yil / barcha | o'quvchi hisobi va to'lovlar | kurs bo'yicha |

**Pul oqimi:**

- kirim — to'lovlar va qo'shimcha daromad;
- chiqim — xarajat toifalari, ish haqi, avans, qaytarishlar;
- natija — sof oqim va yig'ma qoldiq;
- hali kelmagan oylar bo'sh.

**Chegirmalar tahlili** — har o'quvchi uchun: doimiy chegirma, bir martalik chegirma, oylar va chegirma sababi.
Ko'rsatkichlar — jami chegirma va chegirmasiz hisobdagi ulushi. Doimiy chegirma summasi oy hisobidagi farq bilan
olinadi: `(asl narx − chegirmali narx) × to'lanadigan darslar / oydagi darslar`. Bu hisoblangan summa bilan bir xil
ulush.

**Kurs bo'yicha daromad** — har kurs uchun: guruhlar, o'quvchilar, asl narxdagi summa, chegirma, hisoblangan summa,
tushum va ulush. Tushum — guruh uchun qabul qilingan to'lovlardan qaytarishlar ayrilgani.

### Bitta manba

- Pul oqimi bosh panel kodidan `loadFlows` sifatida ajratildi. Bosh panel ham shundan foydalanadi.
- Kirim rejasi va prognoz (eski tizimdagi "Reja / Fakt / Prognoz") olinmadi. Reja faqat xarajatlar uchun — ADR 0016.

## Sinov

- **Vitest:** pul oqimi jadvali, xarajatlar qatorlari, chegirma ulushi, hisobot davri.
- **Haqiqiy PostgreSQL** (EDU-CRM-PLAN qabul sharti):
  - pul oqimi oyi bosh panel bilan bir xil;
  - xarajat reja va fakti;
  - chegirma va kurs daromadi o'quvchi hisobi bilan bir xil;
  - boshqa mijoz ko'rmaydi.
- **Mahalliy sinov bazasi:** pul oqimidagi oktyabr kirimi bosh paneldagi tushum bilan bir xil chiqdi.

## Oqibatlari

- E5b–E5d hisobotlari shu ro'yxatga yangi kalit bilan qo'shiladi. Sahifa, filtr va Excel tayyor.
- Kirim rejasi kerak bo'lsa — alohida qaror va jadval.
