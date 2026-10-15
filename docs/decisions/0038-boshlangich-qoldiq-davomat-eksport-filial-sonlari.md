# 0038. edu-crm E6: boshlang'ich qoldiq, davomat jurnali Excel, xodimlar oylik davomati, filial sonlari

2026-10-15 · qabul qilingan · EDU-CRM-E6 (E6i, E6j, E6k)

## Vaziyat

Pul oqimi hisobotidagi "yig'ma qoldiq" har yil nol bilan boshlanar edi: kassada avvaldan turgan pul va oldingi yillar
hisobga olinmasdi. Davomat jurnalini Excelga yuklash (`attendance.export`, ADR 0014) qoldirilgan edi. Xodimlar
davomatida faqat oxirgi 7 va 30 kunlik reyting bor edi, oy tanlab bo'lmasdi. Filiallar kartasida "Faol o'quvchilar" va
"Guruhlar" doim 0 ko'rinardi. Bir necha joyda ishlamaydigan yoki doim bo'sh element qolgan edi.

## Qaror

- **Boshlang'ich qoldiq (E6j).**
  - `settings` jadvalida `finance.opening_balance` kaliti; qiymat: `{ [filialId]: { amount, date } }`. Migratsiya
    yo'q. `amount` — butun, manfiy emas; `date` — kelajakda emas.
  - Hisob (`lib/opening-balance.ts`, toza, Vitest): qoldig'i bor filial uchun yig'ma qoldiq = qoldiq + shu sanadan
    keyingi sof oqim. Sanadan oldingi harakatlar qoldiqqa kirgan hisoblanadi, shuning uchun ikki marta sanalmaydi.
    Qoldig'i yo'q filiallar oldingidek, yil boshidan sanaladi. Hech bir filialda qoldiq bo'lmasa — hisob o'zgarmaydi.
  - Filial bo'yicha harakatlar `loadFlows(db, [filial])` bilan alohida yuklanadi (faqat qoldiq kiritilgan bo'lsa);
    qolgan filiallar — umumiy harakatdan ayirib olinadi, shuning uchun filialsiz yozuvlar yo'qolmaydi.
  - Qoldiq yig'ma qoldiq qatoriga, grafikka (`monthlyFlows`) va jadval ostidagi izohga tushadi. Kirim, chiqim va sof
    oqim qatorlari o'zgarmaydi.
  - **Kiritish joyi:** pul oqimi hisobotining o'zida ("Boshlang'ich qoldiq" tugmasi, `opening-balance-editor.tsx`),
    reja tahrirlagichi kabi. `/payment-settings` da emas: u sahifaga `settings.*` ruxsati kerak, hisobotni ko'radigan
    xodimda esa u bo'lmasligi mumkin.
  - **Ruxsat:** `dashboard.financial_stats` (hisobotni ko'rish ruxsati; reja bilan bir xil). Yangi ruxsat qo'shilmadi.
    Xodim faqat o'zi ko'radigan filiallarning qoldig'ini o'zgartiradi, boshqalariniki saqlanadi.
  - **Jurnal:** `finance_opening_balance.update` — o'zgargan filiallar, oldingi va yangi qiymat bilan.
  - Cheklov: ish haqi bir necha filialga biriktirilgan xodimga berilsa, u filiallar kesimida bir necha marta
    sanalishi mumkin; umumiy harakatdan ayirish bu holda ham jami hisobotdagi bilan mos keladi.
- **Davomat jurnali Excel (E6j).** `/attendance` sahifasida "Excel" tugmasi (`attendance.export`): oy va guruh
  (yoki barcha guruhlar, har biri alohida varaqda; ko'pi bilan 60). Route `/attendance/excel`, kitob —
  `lib/server/attendance-journal.ts`, hisob — `lib/attendance-journal.ts`. Katak: ✓ bor, K kech, S sababli, ✕ yo'q,
  bo'sh — belgilanmagan yoki o'quvchi o'sha kuni guruhda emas (yoki muzlatilgan). Oxirida bor, kech, sababli, yo'q
  soni va foiz = (bor + kech) / belgilangan kunlar (ADR 0014).
- **Xodimlar oylik davomati (E6j).** `/staff-attendance` da uchinchi tab "Oylik hisobot": oy tanlanadi (`?oy=`),
  xodim bo'yicha kelgan, kech, kelmagan, belgilangan kun va foiz. Hisob reytingniki (`rankEmployees`), jadval
  reyting bilan umumiy. Excel — `/staff-attendance/excel` (`attendance.employee_view`).
- **Filial sonlari (E6i, S qismi).** "Faol o'quvchilar" — arxivlanmagan, holati faol yoki qaytgan va ochiq guruhi bor
  (bosh paneldagi bilan bir xil qoida); "Guruhlar" — arxivlanmagan guruhlar. Tafsilot oynasi va filiallar taqqoslash
  hisoboti (M qismi) bu qarorga kirmaydi.
- **Tozalash (E6k).**
  - O'qituvchilar va support jadvallaridan doim "—" bo'lgan "Reyting" ustuni olib tashlandi (reyting tizimi yo'q).
  - O'quvchi moliya tabidan qattiq yozilgan "Coin" kartasi olib tashlandi (kartalar ikkita qoldi).
  - O'chirilgan "SMS" tugmasi qoldi (so'ralgan), izohi: "SMS ulanganda ishlaydi".
  - Ishlatilmaydigan `groupsLater` (2 ta), `attendanceLater`, `cardCoins*` matnlari va `paid: 0` maydoni olib
    tashlandi; eskirgan izohlar yangilandi; `systemStageMove` matni to'g'rilandi.
  - `app/(crm)/[section]` bo'sh sahifasiga tegilmadi.

## Oqibatlari

- Boshlang'ich qoldiq kiritilmaguncha hisobotlar avvalgidek. Kiritilgach yig'ma qoldiq kassadagi haqiqiy summaga
  yaqinlashadi; oldingi yillar ham hisobga olinadi.
- Qoldiq noto'g'ri kiritilsa, jurnaldagi oldingi qiymatdan qaytarish mumkin.
- Tests: `lib/opening-balance.test.ts`, `lib/attendance-journal.test.ts`, `app/(crm)/branches/data.db.test.ts`
  (mijoz bazasi bo'lsa).
