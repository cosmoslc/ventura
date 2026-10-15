# 0035. edu-crm: Sabablar sahifasi

2026-10-15 · qabul qilingan · ADR 0022, 0031 davomi (E6f)

## Vaziyat

Eski CRM'da "Sabablar" sahifasi bor edi: har amal turi (o'quvchi o'chirilganda, muzlatilganda, qaytarilganda, lid va
guruh o'chirilganda) uchun alohida sabablar ro'yxati va "sabab so'ralsinmi" yoqgichi. Yangi tizimda faqat ikkita
ro'yxat bor edi: lid yo'qotish (ADR 0022) va guruhdan chiqish (ADR 0031). Boshqa dialoglarda sabab erkin matn edi.

## Qaror

- **Sahifa `/reasons`** ("Sabablar", menyuda "Ofis" bo'limi): har tur uchun bitta karta — ro'yxat, "Tahrirlash"
  (umumiy `ReasonsModal`) va yoqgichi bor turlarda "Sabab so'ralsin" tugmasi. Kartalar bo'limlar bo'yicha:
  o'quvchilar, guruhlar, lidlar. Bo'limi (guruhlar, lidlar) o'chirilgan markazda shu bo'lim turlari ko'rinmaydi.
- **Turlar (8 ta)** — `lib/reasons.ts` dagi `REASON_CATEGORIES`:

  | Tur | Kalit | Qayerda so'raladi | Yoqgich |
  | --- | --- | --- | --- |
  | `student_active` | `reasons.student_active` | faol o'quvchini o'chirish | bor |
  | `student_trial` | `reasons.student_trial` | sinovdagi o'quvchini o'chirish | bor |
  | `freeze` | `reasons.freeze` | holat "Muzlatilgan"ga o'zgarganda | bor |
  | `student_return` | `reasons.student_return` | holat "Qaytgan"ga o'zgarganda | bor |
  | `leave` | `groups.leave_reasons` | guruhdan chiqarish (ADR 0031) | yo'q, doim |
  | `group_archive` | `reasons.group_archive` | guruhni o'chirish | bor |
  | `lead_archive` | `reasons.lead_archive` | lidni o'chirish (arxiv) | bor |
  | `lost` | `leads.lost_reasons` | lidni yo'qotish (ADR 0022) | yo'q, doim |

  Mavjud ikki kalit o'z joyida; ularning ro'yxati bir xil `settings` qatori, shuning uchun hisobotdagi
  "Sabablar ro'yxati" tugmasi (modal) o'zgarishsiz ishlaydi. Yoqgichlar bitta `reasons.switches` qatorida (JSON);
  qiymat yo'q bo'lsa — yoqilgan (eski tizimdagidek). Migratsiya yo'q: hammasi `settings` jadvalida.
- **Dialoglarda** erkin matn o'rniga `ReasonField` (`app/(crm)/reason-field.tsx`): ro'yxatdan sabab tanlanadi,
  "Boshqa" — o'z matni. Sabab shu amalning mavjud maydoniga yoziladi: o'quvchi arxivi — `archiveReason`, holat —
  `statusNote`, lid arxivi — `archiveReason`, guruh o'chirish — a'zoliklarning `leftReason` va jurnal metadatasi.
  Yoqgich o'chiq yoki ro'yxat bo'sh bo'lsa — avvalgidek ixtiyoriy matn. Yoqilgan bo'lsa sabab majburiy.
- **Yuklash.** Dialoglar sozlamani `reasonsConfigAction` bilan bir marta o'qiydi (modul keshi, `leave-reason-fields`
  kabi); Sabablar sahifasida saqlangach kesh unutiladi. Server tomonda `lib/server/reasons.ts` — bitta so'rov.
- **Ruxsat.** Alohida ruxsat qo'shilmadi. Sahifa — `students.edit`, `groups.edit` yoki `leads.edit` dan biri
  (`PAGE_ACCESS["/reasons"]`); har turni tahrirlash — shu turning bo'limi ruxsati (o'quvchi, guruh, lid). Ruxsati
  yo'q xodim kartani ko'radi, tahrirlay olmaydi. Har o'zgarish `settings.update` jurnali bilan.
- **Guruh o'chirish** endi `{ id, reason }` qabul qiladi; eski tasdiq so'rovlaridagi oddiy `id` ham ishlaydi.

## Qilinmadi

- **"O'quvchi kelmaganda" (davomat)** turi: davomat oynasi (`groups/attendance-tab.tsx`) boshqa paketniki
  (E6j), shuning uchun tur qo'shilmadi. Qo'shish: `REASON_CATEGORIES` ga bitta qator va o'sha oynada `ReasonField`.
- **Arxivdan tiklashda sabab**: tiklash `/archive` sahifasida (E6e), unga tegilmadi. "O'quvchi qaytarilganda" turi
  hozir faqat holatni "Qaytgan"ga o'zgartirishda so'raladi.
- Eski CRM'dagi "sinovga qaytarish" turi olinmadi: yangi tizimda bunday amal yo'q.

## Oqibatlari

- Yangi sabab turi: `REASON_CATEGORIES` ga qator, `uz.reasons.categories` ga matn, kerakli dialogga `ReasonField`.
- Mavjud markazlarda arxivlash/muzlatish/qaytarish dialoglari endi standart ro'yxatdan sabab so'raydi; direktor
  sahifadan yoqgichni o'chirib eski ko'rinishga qaytara oladi.
