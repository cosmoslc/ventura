# 0027. edu-crm: "Bugungi ishlar" va bosh paneldagi lid kartalari (E4d)

2026-10-14 · qabul qilingan · docs/EDU-CRM-E4.md (E4d), ADR 0017 (lid kartalari joyi qoldirilgan)

## Vaziyat

- **"Bugungi ish stoli":** eski tizimda (`TodayWorkbench`) to'rt blok bor edi — qarzdorlar, bugun kelmaganlar,
  "bugun qarzini to'laydiganlar" va tugayotgan guruhlar. Hisob brauzerda, butun baza yuklab olingach qilinardi.
  Bugungi davomat bo'lmasa, oxirgi kundagi davomat "bugungi" deb ko'rsatilardi.
- **Bosh panel (ADR 0017):** lid kartalarining joyi bor edi — "Yangi lidlar" KPI, "Lid manbalari", "So'nggi
  amallar"dagi lidlar ustuni va "Lid konversiyasi". Ular "bo'lim hali ishga tushmagan" deb turardi.

## Qaror

### "Bugungi ishlar" — `/bugun`

- **Menyu:** asosiy bo'limda, "O'quvchilar"dan oldin.
- **Ochiladi:** bloklaridan birortasini ko'ra oladigan xodimga.
- **Bloklar.** Har blok o'z ruxsati va bo'limi bilan. Ko'ra olmaydigan blok bazadan o'qilmaydi va brauzerga
  yuborilmaydi.

| Blok | Bo'lim / ruxsat | Mazmuni |
| --- | --- | --- |
| Bog'lanish kerak | `leads` / Lidlar sahifasi ruxsatlari | ish bosqichidagi lidlar, "keyingi aloqa sanasi" bugun yoki o'tgan; eng ko'p kechikkani birinchi |
| Birinchi darslar | `leads` | bugungi birinchi (sinov) darslar, guruh vaqti va holati bilan |
| Mas'ulsiz yangi lidlar | `leads` | birinchi ustundagi mas'ulsiz lidlar (saytdan kelgan arizalar ham, ADR 0026); manbasi ko'rinadi |
| Bugun kelmaganlar | `attendance` / davomat ruxsatlari yoki `groups.attendance_view` | bugun "kelmadi" yoki "sababli" belgilanganlar, sababi bilan; bugungi darslar soni va nechtasi belgilangani |
| Qarzdorlar | `debtors` / Qarzdorlar sahifasi ruxsatlari | Qarzdorlar sahifasidagi bilan bir xil hisob; eng katta 8 tasi, jami soni va summasi |
| Tugayotgan guruhlar | `groups` / Guruhlar sahifasi ruxsatlari | 30 kun ichida tugaydigan yoki muddati o'tgan guruhlar |

- **Ko'rinish:**
  - tepada qisqa ko'rsatkichlar (`MetricCard`);
  - har blokda 8 tagacha qator va "Yana N ta" havolasi;
  - telefon raqami bosilsa qo'ng'iroq qilinadi.
- **Hisob qoidalari:**
  - "bugun" — Toshkent kuni;
  - davomat faqat bugungi kun bo'yicha olinadi — oxirgi kunga qaytilmaydi;
  - dam olish kuni bugungi darslar soniga kirmaydi;
  - guruh tugash sanasi = boshlanish + guruh davomiyligi (oy). Oy oxiri qisqa bo'lsa — o'sha oyning oxirgi kuni.
    Davomiyligi 0 bo'lgan guruh muddatsiz hisoblanadi.
- **"Bugun qarzini to'laydiganlar" olinmadi:** eski tizimda u to'lovdagi "qarz to'lash sanasi"ga tayanardi. Yangi
  tizimda bunday maydon yo'q. Qarzdorga eslatma va va'da sanasi Qarzdorlar bo'limi bilan qo'shiladi.

### Bosh paneldagi lid kartalari

- Faqat `dashboard.conversion_stats` ruxsati va Lidlar bo'limi bo'lsa o'qiladi.
- Filial bo'yicha, arxivdagi lidlarsiz.

| Karta | Hisob |
| --- | --- |
| Yangi lidlar (KPI) | davrda qo'shilgan lidlar (Toshkent kuni); oldingi davr bilan farqi; 12 oylik ustunlar |
| Lid manbalari | davr lidlari manba bo'yicha: eng kattasidan 3 tasi va "Boshqa"; manbasizi "Boshqa" |
| So'nggi amallar → Lidlar | oxirgi lidlar: sana, ism, manba, bosqich. Pul ruxsati bo'lmasa — faqat lidlar ustuni |
| Lid konversiyasi | davr lidlaridan hozir "O'quvchi bo'ldi" bosqichidagilar ulushi, oldingi davr bilan (p.p.) |

"Lid konversiyasi" kartasida yana uch qator bor:

- guruhga qo'shilganlar;
- **eng ko'p yo'qotilgan bosqich.** Lid qaysi bosqichdan yo'qotilgani yoziladi (`lost_from_stage_id`). Eski tizim buni
  voronkadagi tushishdan taxmin qilardi;
- **birinchi to'lov qilganlar:** o'quvchiga aylanib, kamida bitta to'lov qilganlar. Bekor qilingan to'lov kirmaydi.
  Eski tizim lidni telefon bo'yicha moslardi, bu yerda lid o'quvchiga aniq bog'langan.

To'liq voronka va manba bo'yicha tahlil — E5 hisobotlari.

## Sinov

- **Vitest:**
  - guruh tugash sanasi (oy oxiri, kabisa yil);
  - tugayotgan guruhlar oynasi va tartibi;
  - bog'lanish kerak bo'lgan lidlar;
  - sarlavha sanasi;
  - lid kartalari hisobi: son, oylar, manbalar, konversiya, birinchi to'lov, yo'qotilgan bosqich, "barcha davr".
- **Haqiqiy PostgreSQL:**
  - lid kartalari, filial bo'yicha;
  - "bugungi ishlar"ning hamma bloki;
  - ruxsatsiz blok o'qilmaydi;
  - boshqa mijoz ko'rmaydi.

## Oqibatlari

- Lid → o'quvchi oqimi uchun Playwright testi (E4 qabul sharti) alohida qadam. edu-crm uchun hali e2e muhit yo'q:
  mijoz reyestri, mijoz bazasi, xodim kirishi va Telegram o'rnidagi soxta server kerak.
