# E5 (Hisobotlar) — reja

2026-10-14 · E5a tayyor (ADR 0030) · bo'lim: `reports` · EDU-CRM-PLAN E5

E3 va E4 dagidek qismlarga bo'linadi. Har qism — alohida branch, PR va ADR.

| Qism | Mazmuni | Holati |
| --- | --- | --- |
| E5a | Bo'lim asosi (hisobotlar sahifasi, umumiy filtr qatori, Excel) va moliya: pul oqimi, xarajatlar, chegirmalar, kurs daromadi | tayyor (ADR 0030) |
| E5b | O'quv: guruhdan chiqish sabablari, xavfli o'quvchilar, o'quvchini ushlab turish | — |
| E5c | Lidlar: voronka, yo'qotilgan lidlar, manbalar, mavsumiy oqim | — |
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

## Qarorlar (taklif — Saidakbar tasdig'i kerak; E5a shu bo'yicha qilingan)

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
   - **Reja ustunlari** — faqat xarajatlar uchun (ADR 0016 rejalari). Kirim rejasi (eski tizimdagi "Reja / Fakt /
     Prognoz") hozircha olinmaydi — kerak bo'lsa alohida qaror.
   - Lid, o'quvchi, guruh ko'rsatkichlari pul oqimidan ajratiladi — ular E5b/E5c hisobotlarida.
6. **Olinmaydi (hozircha):**
   - ballar, imtihon, tanga — bu bo'limlar Ventura'da hali yo'q;
   - SMS hisoboti — SMS ulanganda;
   - jurnallar va "tez kunda" bandlari — ma'lumoti yo'q.
7. **Ruxsatlar:**

   | Hisobot | Ruxsat |
   | --- | --- |
   | Moliyaviy | `dashboard.financial_stats` |
   | O'quv | `dashboard.view` |
   | Lidlar | `dashboard.conversion_stats` |

   Mavjud ruxsatlar; yangi ruxsat qo'shilmaydi.
