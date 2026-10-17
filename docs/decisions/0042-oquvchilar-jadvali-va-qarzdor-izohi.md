# 0042. edu-crm: yagona o'quvchilar jadvali, guruh qutilari va qarzdor izohi

2026-10-16 · qabul qilingan · EDU-CRM-FIXES 4.2, 5.1, 5.2

## Vaziyat

O'quvchilar ko'rsatiladigan jadvallar (xavfli o'quvchilar, guruhdan chiqqanlar, davomat hisoboti, qarzdorlar, to'lovlar)
har biri o'z uslubida yozilgan edi: ism oddiy havola, avatar yo'q, qator oralig'i va ranglar har xil. To'lovlar va
qarzdorlar bitta uzun jadval bo'lib, qaysi guruhga tegishli ekani ko'zga tashlanmasdi. Eski tizimda qarzdorlarda "Izoh"
ustuni bor edi (rang + teg + matn, o'quvchining `debtNote` maydoniga bitta qiymat sifatida yozilardi — tarix yo'q).

## Qaror

- **Yagona komponent:** `app/(crm)/student-table.tsx`. `StudentsTable` — "O'quvchilar" sahifasidagi jadval uslubi
  (kartochka, `THead`/`Tr`/`Td`, avatar + ism + qisqa qator, bo'sh holat, gorizontal aylanadigan `minWidth`). Sahifa
  faqat ustunlarni (`columns`), birinchi ustun ma'lumotini (`student`), ixtiyoriy tanlovni (`selection`), kartochka
  ichidagi `header`/`footer` va `empty` ni beradi. `StudentCell` alohida ham ishlatiladi; `GroupBoxHeader` va
  `MoreRows` guruh qutilari uchun.
- **Qayerda ishlatildi:** O'quvchilar sahifasi (ko'rinish o'zgarmadi), xavfli o'quvchilar va guruhdan chiqishlar
  ro'yxati, davomat hisoboti (qoldirganlar), qarzdorlar, to'lovlar. Guruh profili a'zolari, o'qituvchi profili va
  ushlab turish ro'yxati tegilmadi: birinchisi alohida qayta ishlanadi, ikkinchisi o'z ma'lumotiga ega kichik blok,
  uchinchisi server komponent (funksiya propslarini mijoz komponentiga berib bo'lmaydi).
- **Davomat hisobotida "№" ustuni olib tashlandi** — umumiy jadvalda tartib raqami yo'q, ro'yxat tartibi o'zgarmadi.
- **Qarzdorlar va to'lovlar — guruh qutilari:** har bir guruh o'z kartochkasi (nomi, o'qituvchi, soni, jami summa),
  ichida shu guruhning jadvali. Qarzdorlarda o'quvchi har bir qarzi bor guruhida chiqadi (summa — shu guruh bo'yicha
  qarz; ko'p guruhli o'quvchida kichik yozuvda "Jami"); guruhga bog'lanmagan qarz (boshlang'ich qoldiq, tuzatish)
  oxirgi "Guruhsiz qarz" qutisida. Qutilar qarz summasi bo'yicha (to'lovlarda guruh nomi bo'yicha), guruhsiz oxirida.
  Har quti dastlab 10 (to'lovlarda 15) qator ko'rsatadi, qolganini "Yana N ta" ochadi. Sahifa darajasidagi
  filtrlar, saralash, KPI va to'lov oynasi o'zgarmadi.
- **Qarzdor izohi (5.2):** yangi jadval/migratsiya yo'q — mavjud `student_notes` ishlatiladi (turlari: qo'ng'iroq,
  xabar, ota-ona bilan suhbat; ogohlantirish ham o'qiladi). Jadvalda har qarzdorning eng oxirgi izohi (matn, tur,
  muallif, sana) — so'rovda `DISTINCT ON (student_id)`. Yozish — `addDebtorNoteAction` (`finance.debtors_remind`
  yoki `students.edit` ruxsati, filial tekshiruvi, `student.note.create` auditi, `source: "debtors"`). Izoh
  o'quvchi profilidagi "Eslatma" tabida ham ko'rinadi — bitta manba. Eski tizimdagi rang/teg bekor qilindi:
  tur yorlig'i ularning o'rnini bosadi, "premium & sodda" qoidasiga ko'ra bezak yo'q.
- **Qilinmadi:** eski tizimdagi SMS eslatma (SMS tizimi qurilmaydi, EDU-CRM-PLAN 8), "sanadan–sanagacha" va teg
  filtrlari (teg yo'q, qarz oy bo'yicha hisoblanadi), jadvaldagi tanlov katagi (guruhli amal yo'q).

## Oqibatlari

- Yangi o'quvchilar ro'yxati kerak bo'lsa, `StudentsTable` ishlatiladi; alohida `<Table>` yozilmaydi.
- Komponent mijoz komponenti: server komponentdan funksiya (`cell`, `student`) uzatib bo'lmaydi — server sahifa
  avval mijoz ko'rinishiga o'raladi.
- Izoh turlari ro'yxati (`DEBTOR_NOTE_KINDS`) o'zgarsa, `student_notes.kind` enumida bo'lishi kerak; yangi tur
  qo'shish migratsiya talab qiladi.
- Bir o'quvchi bir nechta qutida chiqishi mumkin; qarzdorlar soni (KPI) o'quvchilar bo'yicha, qutilardagi qatorlar
  soni esa qarz-guruh juftlari bo'yicha ekanini yodda tutish kerak.
