# E5 (Hisobotlar) — reja

2026-10-14 · E5a, E5b, E5c tayyor (ADR 0030, 0031, 0032) · bo'lim: `reports` · EDU-CRM-PLAN E5

E3 va E4 dagidek qismlarga bo'linadi. Har qism — alohida branch, PR va ADR.

| Qism | Mazmuni | Holati |
| --- | --- | --- |
| E5a | Bo'lim asosi (hisobotlar sahifasi, umumiy filtr qatori, Excel) va moliya: pul oqimi, reja-fakt-prognoz, xarajatlar, chegirmalar, kurs daromadi | tayyor (ADR 0030) |
| E5b | O'quv: guruhdan chiqish sabablari (sabablar ro'yxati bilan), xavfli o'quvchilar, o'quvchini ushlab turish | tayyor (ADR 0031) |
| E5c | Lidlar: voronka, yo'qotilgan lidlar, manbalar samaradorligi, mavsumiy oqim | tayyor (ADR 0032) |
| E5d | O'qituvchi samaradorlik reytingi | — |

Bosh panel (ADR 0017, 0027) va davomat hisoboti (ADR 0014, Davomat sahifasi) allaqachon bor — hisobotlar sahifasidan
ularga havola bo'ladi, qayta yozilmaydi.

## Eski tizimda nima bor edi

"Hisobotlar" menyusi — 6 guruh, 30 ga yaqin band:

- **Moliyaviy:** pul oqimi, xarajatlar tahlili, chegirmalar tahlili, kurs bo'yicha daromad.
- **O'quvchilar:** ballar, davomat, xavfli o'quvchilar, guruhdan chiqish sabablari, ushlab turish, imtihon, tanga.
- **Marketing va lidlar:** CRM voronka, yo'qotilgan lidlar, mavsumiy oqim, lid statistikasi.
- **O'qituvchi:** samaradorlik reytingi, jurnallar; yana 4 tasi "tez kunda".
- **Kommunikatsiya:** SMS; yana 4 tasi "tez kunda".
- **Tizim:** xodimlar davomati; yana 2 tasi "tez kunda".

**Umumiy filtr qatori** (oxirgi o'zgarishlar): oy tanlash, sana oralig'i, tanlovlar. Har filtrni sozlamadan
o'chirish mumkin, bu brauzerda eslab qolinadi.

## Eski tizimdagi xatolar — takrorlanmaydi

- **Soxta raqamlar:** bir qator hisobot sahifalari (o'qituvchi, SMS, jurnallar, imtihon, tanga) qo'lda yozilgan
  raqamlarni ko'rsatardi — "4.89 / 5.0", "14,820 ta SMS". Bu yerda ma'lumoti yo'q hisobot umuman chiqmaydi.
- **Hisob brauzerda:** butun baza yuklab olinib, sahifada hisoblanardi. Bir xil raqam turli sahifada turlicha
  chiqardi.
- **Pul oqimi rejasi** alohida jadvalda, hisobotning o'zidan tahrirlanardi. Xarajatlar rejasi esa boshqa joyda
  edi — ikki xil reja yashardi.

## Qarorlar (Saidakbar tasdiqladi, 2026-10-14)

1. **Bitta manba.** Har hisobot raqami tegishli ro'yxat sahifasidagi bilan bir xil funksiyadan olinadi:
   - to'lov va qarz — o'quvchi hisobidan (`lib/ledger.ts`, ADR 0015);
   - pul oqimi — bosh paneldagi kunlik yig'indidan (`lib/dashboard.ts`);
   - xarajat rejasi — ADR 0016 rejalaridan.

   Hisob serverda, toza funksiyalarda (Vitest); natija haqiqiy PostgreSQL testida ro'yxat sahifasi bilan
   solishtiriladi (EDU-CRM-PLAN qabul sharti).
2. **Hisobotlar sahifasi `/reports`:** guruhlangan kartalar (moliya, o'quv, lidlar, o'qituvchilar). Har karta —
   alohida sahifa (`/reports/<nom>`). Xodim faqat ruxsati bor hisobotlarni ko'radi.
3. **Umumiy filtr qatori** (`ReportFilters`):
   - davr — oy, yil yoki sana oralig'i; manzilda saqlanadi, havolani ulashsa bo'ladi;
   - filial — tepadagi umumiy tanlov, alohida filtr yo'q;
   - qo'shimcha tanlovlar hisobotga qarab (kurs, guruh, o'qituvchi, manba).
4. **Excel:** har hisobotda "Excel'ga yuklab olish" — ko'rinib turgan jadval, filtrlar bilan.
5. **Pul oqimi:** yil bo'yicha 12 oy ustunlari.
   - **Kirim:** o'quvchi to'lovlari, qo'shimcha daromad.
   - **Chiqim:** xarajat toifalari, ish haqi, avans, qaytarishlar.
   - **Natija:** sof oqim va yig'ma qoldiq.
   - **Reja, fakt va prognoz** — alohida hisobot (Saidakbar: "kirim rejasi, reja, prognoz, fakt ham kelsin"):
     - reja: to'lovlar, qo'shimcha daromad va ish haqi — filial va oy bo'yicha yangi `finance_plans` jadvali;
       xarajatlar — ADR 0016 toifa rejalari yig'indisi (ikki xil xarajat rejasi bo'lmaydi);
     - prognoz haqiqiy hisob: eski tizimda bu ustun doim bo'sh edi. Qoidasi ADR 0030 da.
   - Lid, o'quvchi, guruh ko'rsatkichlari pul oqimidan ajratiladi — ular E5b/E5c hisobotlarida.
6. **Hozircha olinmaydigan hisobotlar** — pastdagi "Keyinga qoldirilgan hisobotlar" ro'yxatida. Ular oxirida baribir
   qo'shiladi (Saidakbar, 2026-10-14); ro'yxat har qismda to'ldirib boriladi.
7. **Ruxsatlar:**

   | Hisobot | Ruxsat |
   | --- | --- |
   | Moliyaviy | `dashboard.financial_stats` |
   | O'quv | `dashboard.view` |
   | Lidlar | `dashboard.conversion_stats` |

   Mavjud ruxsatlar; yangi ruxsat qo'shilmaydi.

## Keyinga qoldirilgan hisobotlar (oxirida qo'shiladi)

Eski CRM "Hisobotlar" menyusi (`src/features/admin/utils/constants.jsx`, `REPORT_MENU`) va EDU-CRM-PLAN bilan
solishtirilgan. Har band uchun: nima kerak bo'lishi va nimaga bog'liq. "Soxta" — eski sahifa qo'lda yozilgan
raqamlarni ko'rsatardi (`ReportsSubPages.jsx`), ya'ni ko'chiradigan haqiqiy hisob yo'q.

| # | Hisobot | Eski tizimda | Nimaga bog'liq |
| --- | --- | --- | --- |
| 1 | Ballar hisoboti | O'quvchilar guruhi | Ball tizimi (EDU-CRM-PLAN 8-bo'lim: birinchi versiyada yo'q) |
| 2 | Imtihon hisoboti | O'quvchilar guruhi | Imtihonlar bo'limi (`exams`) |
| 3 | Tanga hisoboti | O'quvchilar guruhi | Tanga tizimi (`coins`) |
| 4 | Jurnallar | O'qituvchi guruhi, soxta | O'qituvchi portali va dars jurnali |
| 5 | O'quvchi ushlab turish (o'qituvchi kesimida) | "Tez kunda" | E5b ushlab turish hisobi tayyor bo'lgach — o'qituvchi bo'yicha guruhlash |
| 6 | Davomat sifati (o'qituvchi) | "Tez kunda" | Davomat o'z vaqtida belgilanishi; E5d bilan birga ko'rib chiqiladi |
| 7 | Guruh dolzarbligi | "Tez kunda" | Ta'rifi aniqlanishi kerak (to'lish, o'sish, ketish) |
| 8 | Imtihon va baholar sifati | "Tez kunda" | Imtihonlar va ball tizimi |
| 9 | SMS va xabarlar | Kommunikatsiya, soxta | SMS yuborish (`sms`) |
| 10 | Qo'ng'iroqlar tahlili | "Tez kunda" | Telefoniya ulanishi; hozircha lid qo'ng'iroq yozuvlari bor (ADR 0022) |
| 11 | Telegram bot aktivligi | "Tez kunda" | Bot xabarlari jurnali |
| 12 | Student app aktivligi | "Tez kunda" | O'quvchi portali (EDU-CRM-PLAN 8-bo'lim) |
| 13 | Takliflar (referal) | "Tez kunda" | Taklif tizimi |
| 14 | Xodimlar faollik hisoboti | "Tez kunda" | Faoliyat jurnali bor (ADR 0002) — hisobot ko'rinishi E6 da |
| 15 | Xodimlar davomati hisoboti | Tizim guruhi, soxta | Xodimlar davomati sahifasi bor (30 kun); oylik hisobot ko'rinishi keyin |
| 16 | Vazifalar bajarish | "Tez kunda" | Vazifalar bo'limi |
| 17 | Operatsion ko'rsatkichlar rejasi | Pul oqimi sahifasining ikkinchi jadvali: lidlar, sinov darsi, birinchi to'lov, konversiya, o'quvchilar, ketganlar, guruhlar, o'rtacha guruh, davomat — reja / fakt / prognoz | Fakt qismi E5b/E5c hisobotlarida; reja jadvali — `finance_plans` kabi alohida || 18 | Xavf chegaralari sozlamasi | Eski "Xavf sozlamalari" oynasi | Chegaralar hozir doimiy (ADR 0031); markaz sozlamasi — `settings` kaliti |
| 19 | Ushlab turish segmentlari va bog'lanish izohlari oynasi | Eski "O'quvchi ushlab turish" sahifasi | Baholar (1-band); izohlar hozir o'quvchi eslatmalarida |
| 20 | Voronkada bosqichni yashirish sozlamasi | Eski "CRM funnel" sahifasidagi tanlov | Voronka hozir lid bosqichlari sozlamasidan (ADR 0032) |
