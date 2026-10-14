# 0032. edu-crm: lid hisobotlari — voronka, yo'qotilganlar, manbalar, mavsumiy oqim (E5c)

2026-10-14 · qabul qilingan · docs/EDU-CRM-E5.md (E5c), EDU-CRM-PLAN E5

## Vaziyat

Eski tizimdagi "Marketing va lidlar" guruhidagi 4 ta sahifa. Ularning muammolari:

- **CRM voronka:** lidning qaysi bosqichgacha yetganini hozirgi bosqichidan taxmin qilardi.
- **Yo'qotilgan lidlar:** bosqich kuzatuvidan oldingi lidlarda bosqich umuman yo'q edi.
- **Hisob brauzerda edi.** Tushumni topish uchun lid o'quvchiga telefon raqami orqali bog'lanardi.
- **Mavsumiy oqim:** "byudjet tavsiyasi" bir necha oylik ma'lumotda ham chiqib, tasodifiy natija berardi.

Ventura'da lidning bosqichlar tarixi (`lead_events`, ADR 0022) va o'quvchiga bog'lanishi (`leads.student_id`)
aniq saqlanadi.

## Qaror

Guruh "Marketing va lidlar" (menyuda — Hisobotlar → Marketing va lidlar). Ruxsat — `dashboard.conversion_stats`
(E5 qarori 7), bo'lim — `leads`. Arxivdagi lidlar hech qaysi hisobotga kirmaydi (bosh paneldagidek).

| Hisobot | Davr | Asosiy jadval | Qo'shimcha jadvallar |
| --- | --- | --- | --- |
| CRM voronka | qo'shilgan sana, oy / yil / barcha | bosqichlar bo'yicha | mas'ul xodimlar bo'yicha |
| Yo'qotilgan lidlar | yo'qotilgan sana, oy / yil / barcha | sabab bo'yicha | bosqich bo'yicha; xodim bo'yicha; ro'yxat |
| Manbalar samaradorligi | qo'shilgan sana, oy / yil / barcha | manba bo'yicha | — |
| Mavsumiy oqim | yil | 12 oy | reklama oylari |

**CRM voronka** (`funnelSteps`, `biggestDrop`, `stageDays`):

- **Pog'onalar:** ochiq bosqichlar (tartib bo'yicha) va oxirida "O'quvchi bo'ldi".
- **Lid qayergacha yetgani** — bosqichlar tarixidagi, hozirgi va yo'qotilishidan oldingi bosqichlarning eng
  uzog'i. O'quvchi bo'lgani — oxirgi pog'ona.
- **Har pog'ona uchun:**
  - yetganlar soni;
  - jamidan ulushi;
  - oldingi pog'onadan o'tganlar foizi;
  - qolib ketganlar;
  - bosqichda o'rtacha necha kun turilgani. Faqat tugallangan turishlar sanaladi, "Yo'qotildi" bosqichi kirmaydi.
- **Eng katta tushish** — oldingi pog'onaga nisbatan eng katta foiz.
- Eski tizimdagi "bosqichni voronkadan yashirish" sozlamasi olinmadi. Voronka lid bosqichlari sozlamasining o'zidan
  olinadi.

**Yo'qotilgan lidlar:**

- **Davr** — lid "Yo'qotildi" bosqichiga o'tgan kun bo'yicha.
- **"Kelganlardan yo'qotilgani"** — davrda qo'shilgan lidlarning hozirgi holati bo'yicha.
- **Oldingi davr bilan solishtirish:** oy — oldingi oy, yil — oldingi yil.

**Manbalar samaradorligi:**

- **Holatlar:** har manba bo'yicha jarayonda, o'quvchi bo'lgan va yo'qotilgan lidlar, konversiya.
- **Eng samarali manba** — kamida 5 ta lidi bor manbalar ichida konversiyasi eng yuqorisi.
- **Tushum** — o'quvchi bo'lgan lidlarning `student_id` si bo'yicha hozirgacha to'langani, qaytarishlar ayrilgan.
  - Ustun faqat `dashboard.financial_stats` ruxsati bor xodimga ko'rinadi.
  - `LoadArgs.finance` — hisobot sahifasi va Excel bir xil tekshiradi.

**Mavsumiy oqim** (`seasonMonths`, `monthAdvice`):

- **Har oy uchun:**
  - lidlar va o'tgan yilning shu oyi;
  - o'zgarish;
  - shu oy lidlaridan o'quvchi bo'lganlar va konversiya;
  - yangi o'quvchilar — birinchi marta faollashtirilganlar, lid orqali kelmaganlar ham.
- **Ko'rsatkichlar:**
  - jami lidlar (o'tgan yilning shu oylariga nisbatan);
  - o'rtacha konversiya;
  - eng faol oy;
  - eng sokin oy — lid kelgan oylar ichidan, kamida ikki oy bo'lsa.
- **Reklama oylari** — barcha yillar bo'yicha kalendar oylari o'rtachasi. Kamida 6 oylik ma'lumotda chiqadi:
  - eng ko'p 2 oy — cho'qqi;
  - ulardan oldingi oy — reklamani kuchaytirish;
  - eng kam 2 oy — tejash.

## Sinov

- **Vitest:**
  - voronka pog'onalari va eng katta tushish;
  - bosqichda turish;
  - sabab ulushi, manbalar va eng samarali manba;
  - mavsumiy oylar va reklama tavsiyasi.
- **Haqiqiy PostgreSQL** (`lead-reports.db.test.ts`):
  - bosqichlar tarixidan voronka;
  - yo'qotilgan sana bo'yicha davr;
  - tushum faqat moliyaviy ruxsat bilan;
  - arxivdagi lid kirmasligi;
  - boshqa mijoz ko'rmaydi.
- **Mahalliy sinov bazasi:** to'rtala hisobot haqiqiy lidlarda xatosiz yuklandi (faqat o'qish).

## Oqibatlari

- E5d (o'qituvchi reytingi) bilan hisobotlar menyusining 4 guruhi to'ladi.
- Qo'ng'iroqlar tahlili (keyinga qoldirilgan ro'yxat) lid qo'ng'iroq izohlari (`lead_notes`, `kind = call`) ustiga
  quriladi.
