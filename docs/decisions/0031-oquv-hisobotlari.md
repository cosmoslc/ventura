# 0031. edu-crm: o'quv hisobotlari — chiqish sabablari, xavfli o'quvchilar, ushlab turish (E5b)

2026-10-14 · qabul qilingan · docs/EDU-CRM-E5.md (E5b), EDU-CRM-PLAN E5

## Vaziyat

Eski tizimdagi "O'quvchilar hisoboti" guruhidagi uchta sahifa. Ularning muammolari:

- **Guruhdan chiqish sabablari:**
  - sabab va izoh eski yozuvlarda bitta matnda edi ("sabab | izoh"), sahifa ularni qayta ajratishga urinardi;
  - hisob butun bazani brauzerga yuklab qilinardi.
- **Xavfli o'quvchilar:**
  - baholarga tayanardi (Ventura'da ball tizimi hali yo'q);
  - sozlamalari brauzer holatida edi.
- **O'quvchini ushlab turish:**
  - sinovda qolib ketganlar ham "ketgan" deb sanalardi;
  - segmentlar baholar va brauzerdagi balansdan chiqarilardi.

Ventura'da sabab erkin matn edi (`left_reason`), tayyor ro'yxat yo'q edi — hisobot sabablarni guruhlay olmas edi.

## Qaror

### Chiqish sabablari ro'yxati

- **Sozlama** `groups.leave_reasons` (lid yo'qotish sabablari kabi, `lib/reasons.ts`):
  - standart ro'yxat — 10 ta sabab;
  - tahrirlash — "Guruhdan chiqish sabablari" hisobotidagi "Sabablar ro'yxati" tugmasi;
  - ruxsat — `groups.edit`, jurnalga `settings.update` bo'lib yoziladi.
- **Chiqarish oynalari** (guruh va o'quvchi profilidagi, o'quvchilar ro'yxatidagi birga chiqarish):
  - sabab ro'yxatdan tanlanadi va majburiy;
  - izoh — alohida erkin matn.
- **Yangi ustun** `group_memberships.left_note` (0018 migratsiyasi, 500 belgigacha CHECK).
  - Faqat qo'shiladi, ustun o'chirilmaydi.
  - Eski yozuvlar va tizim sabablari ("Guruh yopildi", "Boshqa filialga o'tkazildi") o'zgarmaydi. Server sabab
    uzunligini tekshiradi, ro'yxatga mosligini emas.
- **Lidlar va guruhlar** sabablar oynasi bitta komponentdan (`ReasonsModal`).

### Hisobotlar (guruh "O'quv jarayoni", ruxsat `dashboard.view` — E5 qarori 7)

| Hisobot | Davr | Asosiy jadval | Qo'shimcha jadvallar |
| --- | --- | --- | --- |
| Guruhdan chiqish sabablari | oy / yil / barcha | sabab bo'yicha | guruhlar bo'yicha; chiqishlar ro'yxati |
| Xavfli o'quvchilar | bugungi holat | o'quvchi × guruh | — |
| O'quvchini ushlab turish | oy / yil / barcha | kurs bo'yicha | ketish sabablari; kohortalar (6 oy) |

Qo'shimcha jadvallar sahifada asosiy jadval ostida, Excel'da alohida varaqlarda (ADR 0030 tuzilmasi kengaytirildi:
`ReportData.extra`). "Bugungi holat" — davrsiz hisobot uchun yangi davr turi (`none`).

**Guruhdan chiqish sabablari** (`leaveSummary`):

- har yopilgan a'zolik — bitta chiqish;
- sinovda chiqqan — guruhda hech faollashtirilmagan (`activated_at` bo'sh);
- muddat — qo'shilgandan chiqqangacha kun;
- davomat — faqat a'zolik davridagi belgilar (bor + kech) / belgilangan;
- ko'rsatkichlar — chiqishlar, o'quvchilar, sinovda chiqqan va o'rtacha muddat.

**Xavfli o'quvchilar** (`riskOf`):

- faol va sinovdagi o'quvchilar;
- davomat ko'rsatkichlari davomat hisobotidagi funksiyadan (ADR 0014), oxirgi 30 kun. Ketma-ket qoldirish 90 kunlik
  tarix bilan hisoblanadi;
- omillar va ball (eski tizimdagidek, baholarsiz):

  | Omil | Shart | Ball |
  | --- | --- | --- |
  | Ketma-ket qoldirgan | 2+ dars | har dars 30 |
  | Ko'p qoldirgan | oyda 3+ yoki 30 kunlik davomat 70% dan past (kamida 4 belgi) | har dars 15, kamida 15 |
  | Bog'lanilmagan | biror omil bor va oxirgi qoldirishdan keyin qo'ng'iroq yoki ota-ona bilan suhbat yo'q | 20 |
  | Qarzdor | o'quvchi hisobidagi qarz 100 000 so'mdan ko'p | 20 |

- daraja: kritik — 70+ ball yoki 3+ dars ketma-ket; yuqori — 40+; qolgani o'rta;
- qarz summasi jadvalda ko'rsatilmaydi (hisobot moliyaviy ruxsatsiz ochiladi) — faqat "Qarzdor" omili.

**O'quvchini ushlab turish** (`churnStats`, `cohorts`):

- faqat faollashtirilgan o'quvchilar; sinovda qolib ketganlar chiqish sabablari hisobotida;
- ketgan — ochiq a'zoligi qolmagan yoki arxivda; ketgan sanasi — oxirgi chiqqan kuni, sababi — o'sha a'zolikdan;
- baza — davr oxirigacha kelgan va davr boshigacha ketmaganlar; ketish foizi = davrda ketganlar / baza;
- kurs — hozirgi (ketgan bo'lsa oxirgi) guruhining kursi;
- kohortalar — oxirgi 6 oyda kelganlar: kelgan oyi bo'yicha, k oydan keyin ham o'qiyotganlar ulushi; davrga
  bog'liq emas.

Eski sahifadagi segmentlar (sodiq, o'rta, xavfli, yangi) olinmadi. Ular baholarga tayanardi; xavf alohida hisobotda.
Bog'lanish izohlari o'quvchi eslatmalarida (ADR 0014), hisobotda alohida izoh oynasi yo'q.

## Sinov

- **Vitest:**
  - sabablar va guruhlar bo'yicha yig'indi;
  - xavf balli, chegaralar va darajalar;
  - ushlab turish bazasi va kohortalar.
- **Haqiqiy PostgreSQL** (`academic-reports.db.test.ts`):
  - chiqish sababi, izoh va a'zolik davridagi davomat;
  - kritik xavf va qarzdor;
  - sinovda chiqqan ushlab turishga kirmasligi;
  - izoh uzunligi CHECK;
  - boshqa mijoz ko'rmaydi.

## Oqibatlari

- Baholar qo'shilganda (keyinga qoldirilgan ro'yxat, docs/EDU-CRM-E5.md) xavf balliga "past baho" omili qo'shiladi.
- Chegaralarni markaz sozlamasidan o'zgartirish hozircha yo'q — kerak bo'lsa `settings` kaliti bilan.
