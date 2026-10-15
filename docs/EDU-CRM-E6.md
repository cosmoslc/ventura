# E6 (Sozlamalar va yakun) — bo'shliqlar ro'yxati va reja

2026-10-15 · bosqich E6 — **yakunlandi** (ADR 0035–0041) · reja: [EDU-CRM-PLAN.md](EDU-CRM-PLAN.md) (E6 bo'limi va 8-bo'lim) · oldingi qism: [EDU-CRM-E5.md](EDU-CRM-E5.md)

**Natija (2026-10-15).** §3 dagi paketlar bajarildi: E6a–E6h, E6i (filial sonlari; filiallarni solishtirish hisoboti
keyinga), E6j, E6k, E6l. Jadvaldagi `qisman` va `yo'q` qatorlari shu paketlar bilan yopildi; qolganlari §4 "olinmaydi"
ro'yxatida va docs/EDU-CRM-E5.md dagi keyinga qoldirilgan hisobotlar ro'yxatida.

Bu hujjat E6 boshlanishidan oldin tuzilgan. Eski CRM'ning har admin ko'rinishi (`view`) yangi `apps/edu-crm` bilan
solishtirilgan. Qabul sharti (EDU-CRM-PLAN E6): har ko'rinish yo yangi tizimda bor, yo "olinmaydi" ro'yxatida sababi
bilan yozilgan.

Manbalar:

- eski: `src/features/admin/App.jsx` (`view === "..."` shartlari), `utils/constants.jsx` (`ALL_NAV_PAGES`, `REPORT_MENU`),
  `layout/Layout.jsx` (haqiqiy yon menyu), sahifa fayllari `pages/*.jsx`;
- yangi: `apps/edu-crm/app/(crm)/**`, `apps/edu-crm/features.ts`, `packages/auth/src/staff/permissions.ts`,
  `apps/edu-crm/lib/uz.ts`, ADR 0006–0034.

## 1. Natija: sonlar

Jadvaldagi har qator bitta `view` id (taxallus ham alohida qator) yoki qobiqdagi bitta element.

| Holat | Soni |
| --- | --- |
| `bor` | 57 |
| `qisman` | 12 |
| `yo'q` | 8 |
| `olinmaydi` | 25 |
| Jami | 102 |

- 102 qatorning ichida 99 tasi `view` id'lar (taxalluslar bilan; ulardan 10 tasi eskida ham "Tez kunda" hisobot
  id'lari), 3 tasi yuqori panel (qobiq) elementlari.
- Asosiy bo'shliqlar (`qisman` + `yo'q`, taxalluslarsiz): markaz sozlamalari, chek sozlamalari, sabablar sahifasi,
  faoliyat jurnali, qurilmalar, bildirishnomalar, shaxsiy profil va xavfsizlik, xodimni arxivdan tiklash, global
  qidiruv, filial tafsilotlari, boshlang'ich kapital, xodimlar davomati oylik hisoboti.
- Ventura'da eski tizimda yo'q sahifalar ham bor: `/money-audit`, `/reports` markazi, `/ariza` (tashqi ariza), zahira
  guruhlar, Excel import va eksport. Ular jadvalga kirmagan.

## 2. Eski ko'rinishlar jadvali

Eslatma: "bor" — sahifa ochilib, asosiy imkoniyatlari (ro'yxat, forma, filtr, amal) tekshirilgan. Tafsilot — ADR'larda.

### 2.1. Asosiy

| Eski id | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `workbench` | Bugungi ish stoli | `/bugun` | `bor` | ADR 0027 |
| `home` | Dashboard | `/` (`dashboard-view.tsx`) | `bor` | ADR 0017; hisob bitta manbadan |

### 2.2. Lidlar

| Eski id | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `leads` | Lidlar bo'limi | `/leads`, `/leads/[id]` | `bor` | doska, ro'yxat, zahira guruhlar, ketgan va o'quvchi bo'lgan tablar, telefon takrori, Excel (ADR 0022–0026) |
| `leadsLost` | Ketgan lidlar | `/leads` → "Ketgan" tabi | `bor` | tiklash `canRestore` bilan; tahlil — `/reports/lost` |
| `leadsAnalytics` | Lidlar analitikasi | `/reports/funnel`, `/reports/sources`, bosh panel lid kartalari | `bor` | ADR 0032 |
| `leadsForm` | Lidlar formasi (ariza havolasi) | `/leads` → Sozlamalar → Ariza sahifasi; ochiq sahifa `/ariza` | `bor` | havola, iframe kodi, spamdan himoya (ADR 0026); eski havola ishlamas edi |
| `leadsSettings` | Forma sozlamalari | `/leads` → Sozlamalar → Lid formasi, Ustunlar, Sabablar | `bor` | maydon turlari 9 ta (matn, raqam, telefon, sana, soat, tanlov, ko'p tanlov, belgilash, guruh) |
| `leadsFormSettings` | (taxallus: `leadsSettings`) | yuqoridagi | `bor` | |
| `leadForms` | Lidlar formalari | — | `olinmaydi` | faqat `ALL_NAV_PAGES` da; `App.jsx` da bu id uchun sahifa yo'q |
| `analytics` | Markaz analitikasi ("Analitika va Moliya") | `/` (moliya dinamikasi, chiqim tuzilmasi, so'nggi amallar), `/reports/cashflow` | `qisman` | yo'q: "Filiallar foydasi" (filial bo'yicha tushum, xarajat, rentabellik taqqoslash). Eski yon menyuda bu sahifaga yo'l yo'q edi, faqat ruxsat ro'yxatida |
| `branchAnalytics` | Filiallar analitikasi | — | `yo'q` | oy va yil bo'yicha filiallar taqqoslash. Eski yon menyuda yo'l yo'q edi. Ixtiyoriy, E6 paket "Filiallar" ga qarang |

### 2.3. Boshqaruv va xodimlar

| Eski id | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `branches` | Ofislar (Filiallar) | `/branches` | `qisman` | qo'shish, tahrirlash, o'chirish, xodim biriktirish bor. Yo'q: kartochkadagi "Faol o'quvchilar" va "Guruhlar" doim 0 (`branches/data.ts:102-103`); eski `BranchDetailModal` (tushum, xarajat, sof foyda, faol, muzlatilgan, ketgan, qarzdorlar, xodimlar) yo'q |
| `managers` | Xodimlar (Menejerlar) | `/staff`, `/staff/[id]` | `bor` | qo'shish, tahrirlash, bloklash, parol va Telegram tiklash, bo'shatish, xodim formasi maydonlari, maosh turi (ADR 0010). Ruxsatlar eskidek lavozim orqali (qaror 14) |
| `staff` | (taxallus: `managers`) | `/staff` | `bor` | |
| `xodimlar` | (taxallus: `managers`) | `/staff` | `bor` | |
| `employeeAttendance` | Xodimlar davomati | `/staff-attendance` | `bor` | Kunlik va Reyting tablari (ADR 0014) |
| `activityLog` | Amallar tarixi | — | `yo'q` | baza tayyor (`audit_events`, `settings.logs` ruxsati), umumiy sahifa yo'q. Hozir faqat pul amallari: `/money-audit` |
| `devices` | Qurilmalar | — | `yo'q` | `known_devices` jadvali bor (yangi qurilmadan kirsa Telegram ogohlantirishi), ro'yxat sahifasi va bloklash yo'q |
| `approvals` | Tasdiqlar / So'rovlarim | `/approvals` | `bor` | ADR 0019 |

### 2.4. O'quv jarayoni

| Eski id | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `groups` | Guruhlar | `/groups` | `bor` | ADR 0012 |
| `groupProfile` | Guruh profili | `/groups/[id]` | `bor` | a'zolik davrlari, davomat jadvali tabi |
| `students` | O'quvchilar | `/students` | `bor` | ro'yxat, forma, holatlar, tanlab amallar, Excel (ADR 0011, 0013, 0028) |
| `riskStudents` | Xavfli o'quvchilar | `/reports/risk` | `bor` | ADR 0031 |
| `reportRiskStudents` | (taxallus) | `/reports/risk` | `bor` | |
| `studentRetention` | O'quvchilarni ushlab turish | `/reports/retention` | `bor` | ADR 0031; segmentlar va bog'lanish izohlari oynasi keyinga qoldirilgan (E5 #19) |
| `reportStudentRetention` | (taxallus) | `/reports/retention` | `bor` | |
| `teachers` | O'qituvchilar (HR) | `/teachers` | `qisman` | ro'yxat, support o'qituvchilar, forma bor. "Reyting" ustuni (ikkala jadvalda) doim "—": o'quvchi bahosi tizimi yo'q (`teachers-view.tsx:366,394,410,446`) |
| `teacherProfile` | O'qituvchi profili | `/teachers/[id]` | `bor` | ADR 0021 |
| `attendance` | Davomat | `/attendance`, guruh profili tabi | `bor` | ADR 0014. Davomat jurnalini Excelga yuklash (`attendance.export`) hali yo'q — ADR 0014 "Oqibatlari" |
| `courses` | Kurslar | `/courses` | `bor` | ADR 0008 |
| `rooms` | Xonalar | `/rooms` | `bor` | ADR 0008 |

### 2.5. Moliya

| Eski id | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `payments` | To'lovlar jurnali | `/payments`, chek `/payments/[id]/receipt` | `bor` | qabul qilish, qaytarish, chegirma, bekor qilish va tiklash (ADR 0015) |
| `debtors` | Qarzdorlar | `/debtors` | `bor` | SMS eslatma — olinmaydi (SMS yuborish, 8-bo'lim) |
| `paymentTypes` | To'lov turlari | `/payment-settings` | `bor` | usullar va hisoblash rejimi |
| `expenses` | Xarajatlar | `/expenses` | `bor` | toifalar, oylik rejalar, bekor qilish, tiklash (ADR 0016) |
| `additionalIncome` | Qo'shimcha daromadlar | `/additional-income` | `bor` | ADR 0016 |
| `salaries` | Ish haqi | `/salaries` | `bor` | o'qituvchi va xodimlar, avans, bonus, jarima (ADR 0018) |
| `finance` | Moliya boshqaruvi / balansi | `/`, `/reports/cashflow`, `/expenses`, `/money-audit` | `qisman` | tushum va chiqim ko'rinishi bor. Yo'q: "Boshlang'ich kapital kiritish" (eski `FinancePage.jsx`, `capitalInput`); pul oqimidagi yig'ma qoldiq 0 dan boshlanadi |
| `coins` | Coin tizimi | `/coins` (menyuda, lekin sahifa yo'q) | `olinmaydi` | EDU-CRM-PLAN 8-bo'lim: coin va ball tizimi birinchi versiyada yo'q. Menyu bandi bo'sh sahifaga olib boradi — 3.2 ga qarang |
| `holidays` | Dam olish / bayram kunlari | `/holidays` | `bor` | ADR 0014 |

### 2.6. Arxiv

| Eski id | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `archive` | Tizim arxivi | `/archive` | `qisman` | 5 tab: o'quvchi, guruh, kurs, o'qituvchi, lid; tiklash; butunlay o'chirish faqat o'quvchida. Yo'q: xodim tabi, "arxivni tozalash" (olinmaydi, xavfli) |
| `archiveLeads` | Arxiv: lidlar | `/archive` → Lidlar | `bor` | telefon bandligi tekshiriladi |
| `archiveStudents` | Arxiv: o'quvchilar | `/archive` → O'quvchilar | `bor` | ADR 0011 |
| `archiveTeachers` | Arxiv: o'qituvchilar | `/archive` → O'qituvchilar | `bor` | |
| `archiveStaff` | Arxiv: xodimlar | — | `yo'q` | xodim bo'shatiladi (`staff.archive`, `archivedAt`), qaytarish amali ham, tab ham yo'q |
| `archiveGroups` | Arxiv: guruhlar | `/archive` → Guruhlar | `bor` | kursi yoki o'qituvchisi arxivda bo'lsa tiklanmaydi |
| `archivePayments` | Arxiv: to'lovlar | `/payments` ("Bekor qilingan", tiklash) | `bor` | Ventura'da to'lov o'chirilmaydi, sabab bilan bekor qilinadi va shu sahifada tiklanadi |
| `archiveSalaries` | Arxiv: ish haqi | `/salaries`, `/teachers/[id]` | `bor` | xuddi shunday (`salaries.restore`) |
| `archiveExpenses` | Arxiv: xarajatlar | `/expenses` | `bor` | `expenses.restore` |
| `archiveAdditionalIncome` | Arxiv: qo'shimcha daromad | `/additional-income` | `bor` | `incomes.restore` |
| `archiveBonuses` | Arxiv: bonuslar | `/salaries` (yozuv turi "bonus") | `bor` | alohida bonus jadvali yo'q, ish haqi yozuvi |

### 2.7. Sozlamalar

| Eski id | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `centerSettings` | Umumiy sozlamalar | — (qisman `/payment-settings`) | `qisman` | eski sahifada: markaz nomi; hisoblash rejimi va sababli kelmaslik (Ventura'da `/payment-settings` da bor); 2 telefon, manzil, Telegram, Instagram, veb-sayt; ish kunlari va soati; "Xavfli zona". Yo'q: aloqa, ijtimoiy tarmoqlar, ish vaqti. Eski tizimda bu maydonlar faqat saqlanardi, hech joyda ishlatilmasdi. Nom va logotip — Ventura panelida (`tenant.name`, `tenant.brand`) |
| `settings` | Markaz sozlamalari (Profil + Markaz + Xavfsizlik tablari) | yuqoridagi, `/account/password` | `qisman` | `ProfileSettingsHub.jsx` uch tab; qismlari quyida (`profile`, `security`, `centerSettings`) |
| `profile` | Profil | `/account/password` | `qisman` | eski: ism, telefon, email, markaz nomi, izoh, logotip, parol. Yangida: faqat parol almashtirish va Telegram ulash; ism va telefonni direktor `/staff` dan o'zgartiradi. Shaxsiy profil sahifasi yo'q |
| `security` | Xavfsizlik | `/account/password` | `qisman` | parol almashtirish bor. Kirish har doim parol + Telegram kodi (qaror 8), shuning uchun 2FA yoqish/o'chirish yo'q. PIN va avto-qulf — olinmaydi. Qurilmalar ro'yxati yo'q (`devices`) |
| `notifications` | Bildirishnomalar (sahifa va qo'ng'iroq) | — | `yo'q` | eski tizimda bu xotiradagi toast jurnali edi: sahifa yangilansa yo'qolardi. Yangida bildirishnoma umuman yo'q; ADR 0026: saytdan kelgan ariza haqida xabar E6 ga qoldirilgan |
| `positions` | Lavozimlar | `/positions` | `bor` | 11 toifa, 69 ruxsat, 7 shablon, Ruxsat / Tasdiq bilan / Taqiq, klon, lavozimdagi xodimlar soni (ADR 0010, 0019) |
| `receiptSettings` | Chek sozlamalari | `/payments/[id]/receipt` | `qisman` | chek bor (markaz nomi, filial, manzil, to'lov tafsiloti avtomatik). Yo'q: sozlamalar sahifasi — chek sarlavhasi, telefon, pastki matn, qog'oz hajmi (80 mm, 58 mm, A4), QR kod, avto chop |
| `reasons` | Sabablar | lid ("Sabablar") va guruhdan chiqish (hisobotdagi "Sabablar") oynalari | `qisman` | eskida 8 ta sabab turi va har biri uchun "sabab so'ralsinmi" yoqgichi. Yangida 2 ta ro'yxat: lid yo'qotish (`leads.lost_reasons`), guruhdan chiqish (`groups.leave_reasons`). Qolganlari (kelmaganda, muzlatilganda, o'quvchi o'chirilganda, lid o'chirilganda, guruh o'chirilganda, o'quvchi qaytarilganda) erkin matn. Yagona "Sabablar" sahifasi yo'q |
| `placementTest` | Daraja testi | — | `olinmaydi` | imtihonlar birinchi versiyada yo'q (8-bo'lim); eski sahifa faqat test nomlari ro'yxati edi, test topshirish yo'q |
| `points` | Ballar | — | `olinmaydi` | ball tizimi yo'q (8-bo'lim) |
| `examTemplates` | Imtihon shablonlari | `/exams` (menyuda, sahifa yo'q) | `olinmaydi` | imtihonlar va sertifikatlar yo'q (8-bo'lim) |
| `smsBuy` | SMS sotib olish | `/sms` (menyuda, sahifa yo'q) | `olinmaydi` | SMS yuborish yo'q (8-bo'lim) |
| `autoSms` | Auto SMS | — | `olinmaydi` | xuddi shu sabab |
| `smsTemplates` | SMS shablonlar | — | `olinmaydi` | xuddi shu sabab |
| `simpleForm` | Oddiy forma | `/ariza` va sozlama | `bor` | lid arizasi (ADR 0026) |
| `teacherForm` | O'qituvchi formasi | — | `olinmaydi` | eski sahifa faqat maydonlarni belgilash va ko'rinish edi; ariza qabul qiluvchi sahifa va oqim yo'q edi. Ichki o'qituvchi formasi `/teachers` da bor |
| `staffForm` | Xodim formasi | `/staff` → "Xodim formasi" | `olinmaydi` | eski id — xuddi shu, ariza ko'rinishi (qabul oqimi yo'q). Ichki "Xodim formasi" maydonlari Ventura'da bor (`staff.form_fields`) |
| `referralForm` | Referal forma | — | `olinmaydi` | taklif (referal) tizimi yo'q (E5 #13) |

### 2.8. Hisobotlar

| Eski id | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `reportCashflow` | Pul oqimi | `/reports/cashflow`, `/reports/plan` | `bor` | ADR 0030 |
| `reportExpenses` | Xarajatlar tahlili | `/reports/expenses` | `bor` | |
| `reportDiscounts` | Chegirmalar tahlili | `/reports/discounts` | `bor` | |
| `reportCourse` | Kurs bo'yicha daromad | `/reports/courses` | `bor` | |
| `reportAttendance` | Davomat umumiy hisoboti | `/attendance` | `bor` | hisobotlar sahifasidan havola bor |
| `reportGroupRemoved` | Guruhdan chiqish sabablari | `/reports/leaves` | `bor` | ADR 0031 |
| `reportLeads` | Lid ma'lumotlar statistikasi | `/reports/sources` | `bor` | manbalar samaradorligi (ADR 0032) |
| `reportLeadsLost` | Yo'qotilgan lidlar tahlili | `/reports/lost` | `bor` | |
| `lostLeads` | (taxallus) | `/reports/lost` | `bor` | |
| `crmFunnel` | CRM voronka tahlili | `/reports/funnel` | `bor` | "bosqichni yashirish" sozlamasi olinmadi (E5 #20) |
| `reportCrmFunnel` | (taxallus) | `/reports/funnel` | `bor` | |
| `seasonalFlow` | Mavsumiy talaba oqimi | `/reports/seasonal` | `bor` | |
| `reportSeasonalFlow` | (taxallus) | `/reports/seasonal` | `bor` | |
| `reportTeacherPerformance` | O'qituvchi samaradorlik reytingi | `/reports/teachers` | `bor` | haqiqiy ko'rsatkichlar (ADR 0033) |
| `reportWorkTime` | Xodimlar davomati (hisobot) | `/staff-attendance` | `qisman` | kunlik va reyting bor; oylik hisobot ko'rinishi yo'q (E5 #15). Eski sahifa soxta edi |
| `reportPoints` | Ballar hisoboti | — | `olinmaydi` | ball tizimi yo'q (E5 #1) |
| `reportExams` | Imtihon hisoboti | — | `olinmaydi` | imtihonlar yo'q (E5 #2) |
| `reportCoins` | Tanga hisoboti | — | `olinmaydi` | coin tizimi yo'q (E5 #3) |
| `reportJournals` | Jurnallar | — | `olinmaydi` | eski sahifa soxta raqamli; o'qituvchi portali yo'q (E5 #4) |
| `reportSmsSent` | SMS va xabarlar | — | `olinmaydi` | eski sahifa soxta ("14,820 ta SMS"); SMS yuborish yo'q (E5 #9) |
| `reportTeacherRetention` | O'quvchi ushlab turish (o'qituvchi) | — | `olinmaydi` | eskida ham "Tez kunda" (E5 #5) |
| `reportTeacherAttendance` | Davomat sifati | — | `olinmaydi` | eskida ham "Tez kunda" (E5 #6) |
| `reportGroupRelevance` | Guruh dolzarbligi | — | `olinmaydi` | eskida ham "Tez kunda"; ta'rifi yo'q (E5 #7) |
| `reportTeacherExams` | Imtihon va baholar sifati | — | `olinmaydi` | eskida ham "Tez kunda"; imtihonlar yo'q (E5 #8) |
| `reportCalls` | Qo'ng'iroqlar tahlili | — | `olinmaydi` | eskida ham "Tez kunda"; telefoniya yo'q (E5 #10) |
| `reportTelegramBot` | Telegram bot aktivligi | — | `olinmaydi` | eskida ham "Tez kunda" (E5 #11) |
| `reportStudentApp` | Student app aktivligi | — | `olinmaydi` | o'quvchi portali yo'q (E5 #12) |
| `reportReferrals` | Takliflar | — | `olinmaydi` | taklif tizimi yo'q (E5 #13) |
| `reportStaffActivity` | Xodimlar faollik hisoboti | — | `yo'q` | eskida ham "Tez kunda". E5 #14: faoliyat jurnali bor, ko'rinish E6 da — paket E6c |
| `reportTasks` | Vazifalar bajarish hisoboti | — | `olinmaydi` | vazifalar bo'limi yo'q (E5 #16) |

### 2.9. Qobiq (view emas, `Layout.jsx` yuqori paneli)

| Eski element | Eski nom | Ventura | Holat | Izoh |
| --- | --- | --- | --- | --- |
| `SearchBox` | Qidiruv (o'quvchi, guruh, o'qituvchi) | yuqori paneldagi "Qidirish… Ctrl K" | `yo'q` | maydon chizilgan, lekin hech narsa qilmaydi (`packages/ui/src/components/topbar.tsx:62-80`, `crm-shell.tsx` unga hech narsa ulamaydi) |
| `QuickActionsMenu` | Tezkor amallar (to'lov qabul qilish, tezkor o'quvchi qo'shish) | — | `yo'q` | |
| `ImportDock` | Excel import holati | Excel oynasi (`/excel`) | `bor` | import bitta tranzaksiyada, dock kerak emas |

## 3. E6 ishlari

Paketlar bir-biriga bog'liq emas: har biri o'z papkasida ishlaydi. Umumiy fayllar (`lib/uz.ts`, `lib/access.ts`,
`features.ts`, `crm-shell.tsx`) ko'p paketda uchraydi, lekin har paket o'z bo'limini qo'shadi, to'qnashuv kichik.
Hajm: S — bir kun ichida, M — 2–4 kun, L — hafta.

Yangi migratsiya kerak bo'lganlar: E6d va E6g. Ular `0019_*` va `0020_*` raqamlarini navbat bilan oladi
(oxirgisi hozir `0018_e5b_left_note.sql`).

### 3.1. Funksional paketlar

| Paket | Nomi | Hajm | Ichida |
| --- | --- | --- | --- |
| E6a | Markaz sozlamalari | M | `/settings` sahifasi |
| E6b | Chek sozlamalari | S | chek ko'rinishi va sozlamalari |
| E6c | Faoliyat jurnali | M | `/activity` + xodimlar faollik hisoboti |
| E6d | Bildirishnomalar | L | qo'ng'iroq, sahifa, Telegram xabarlari |
| E6e | Arxiv va tiklash | S | xodim tabi va tuzatishlar |
| E6f | Sabablar sahifasi | M | 8 turdagi sabab |
| E6g | Qurilmalar, profil, xavfsizlik | L | `/devices`, `/account`, bloklash |
| E6h | Global qidiruv va tezkor amallar | M | yuqori panel |
| E6i | Filiallar | S + M | raqamlar, tafsilot, taqqoslash |
| E6j | Moliya va davomat qoldiqlari | S | boshlang'ich kapital, davomat Excel, xodimlar davomati oylik |

#### E6a. Markaz sozlamalari (M)

Eski `CenterSettingsPage.jsx` / `ProfileSettingsHub.jsx` "Markaz Sozlamalari" tabi.

- Yangi sahifa `/settings` ("Markaz sozlamalari"), `settings` jadvalida kalit `center` (JSON).
- Maydonlar (eski bilan bir xil): asosiy va qo'shimcha telefon, manzil, Telegram, Instagram, veb-sayt, ish kunlari
  (Dushanba–Yakshanba tugmalari), boshlanish va tugash vaqti.
- Eski tizimda bu maydonlar hech joyda ishlatilmasdi. Yangida ishlatiladigan joylar: ariza sahifasi (`/ariza`) pastki
  qismi, chek sarlavhasi (E6b), kelajakda dars jadvali tekshiruvi.
- Hisoblash rejimi va sababli kelmaslik yoqgichi `/payment-settings` da turibdi — bu yerga ko'chirilmaydi, sahifada
  havola beriladi.
- Markaz nomi, logotip, asosiy rang — Ventura panelida (`tenant.name`, `tenant.brand`, principle 6). Sahifada faqat
  o'qish uchun ko'rsatiladi, o'zgartirish "Ventura bilan bog'laning". Saidakbar hal qiladi (3.4, savol 1).
- "Xavfli zona" (barcha lidlarni, o'quvchilarni, to'lovlarni birdaniga o'chirish) olinmaydi: Ventura'da tanlab amallar
  (ADR 0028) va arxiv bor.
- Fayllar: yangi `app/(crm)/settings/{page,settings-view,actions,data}.ts(x)`, `lib/center-settings.ts` (+ Vitest),
  `lib/uz.ts` (`settingsCenter`), `lib/access.ts` (`/settings`), `features.ts` (nav, `students` bo'limiga "Ofis"),
  `crm-shell.tsx` (`HREF_ICONS`, `ITEM_ORDER`), `app/ariza/page.tsx` (aloqa qismi).
- Ruxsat: yangi ruxsat qo'shilmaydi. Variant: faqat direktor (eskidek) yoki `settings.receipt`. Savol 2.
- Jurnal: `settings.update` (mavjud kalit).

#### E6b. Chek sozlamalari (S)

Eski `ReceiptSettingsPage` (`SettingsSubPages.jsx`).

- `settings` kaliti `receipt`: sarlavha matni (standart — markaz nomi), manzil, telefon, pastki matn, qog'oz hajmi
  (80 mm, 58 mm, A4), QR kod yoqgichi, avto chop.
- Sozlama oynasi `/payment-settings` ichida yangi karta (`settings.receipt` ruxsati allaqachon shu sahifada ishlatiladi),
  yonida jonli chek ko'rinishi.
- Chek (`app/(print)/payments/[id]/receipt/page.tsx`) sozlamani o'qiydi; qog'oz hajmi `@page` o'lchamiga ta'sir qiladi;
  avto chop `print-button.tsx` orqali.
- Fayllar: `app/(print)/payments/[id]/receipt/*`, `app/(crm)/payment-settings/settings-view.tsx`, yangi
  `lib/receipt-config.ts` (+ Vitest), `lib/uz.ts` (`financeSettings`, `payments.receipt*`).
- E6a bilan faqat `lib/uz.ts` da kesishadi.

#### E6c. Faoliyat jurnali (M)

Eski `ActivityLogPage.jsx` ("Amallar tarixi") va hisobot `reportStaffActivity`.

- `/activity` sahifasi: `audit_events` dan jadval — qilingan ish (o'zbekcha jumla), xodim, sana, soat; qator bosilsa
  tafsilot (IP, qurilma). Filtr: xodim, amal turi (guruhlar: o'quvchi, to'lov, lid...), sana oralig'i, qidiruv.
  "Yana yuklash" (`seq` bo'yicha kursor, 100 tadan).
- Ko'rish qoidasi eskidek: direktor va `settings.logs` ruxsati bor xodim — hammasini; qolganlar — faqat o'z amallarini.
- Amal kalitlarini o'zbekcha jumlaga o'giradigan reyestr `lib/activity-log.ts`. Kodda hozir `ctx.audit(...)` va
  `tenantAudit.record(...)` bilan 80 ga yaqin kalit yoziladi (`student.update`, `payment.void`, `lead.stage`...), yana
  dinamiklari (`import.<jadval>`, `group.<amal>`, `student.<amal>`) va kirish hodisalari (`app/(auth)/actions.ts`).
  `payments.record` kabi nomlar audit kaliti emas, tasdiq reyestri (`approval-registry.ts`) nomlari. Reyestr hammasini
  qoplaydi; Vitest kodda uchraydigan kalitlarni qidirib, reyestrda yo'g'ini topsa yiqiladi. Bundan tashqari har
  o'zgartiruvchi amal jurnalga yozishini tekshirish kerak (CLAUDE.md qoidasi): ba'zi amallar `ctx.audit` chaqirmasligi
  mumkin — E6c boshida `crmAction` chaqiruvlari va `audit` chaqiruvlari solishtiriladi.
- "Pul amallari tarixi" (`/money-audit`, ADR 0019) shu sahifaning tayyor filtri sifatida qoladi, o'chirilmaydi.
- Xodimlar faollik hisoboti (E5 #14): xodim bo'yicha amallar soni va turlari, davr tanlanadi. `/reports/staff-activity`,
  ruxsat `dashboard.view`.
- "Jurnal butunligini tekshirish" tugmasi: `tenantAudit.verify` (xesh zanjiri, ADR 0002) natijasini ko'rsatadi.
- `/staff/[id]` kartochkasiga "Faoliyat" havolasi (shu xodim filtri bilan).
- Fayllar: yangi `app/(crm)/activity/*`, `lib/activity-log.ts`, `lib/server/activity.ts` (namuna — `lib/server/money-audit.ts`),
  `app/(crm)/reports/views/staff-activity.tsx`, `lib/server/reports.ts` (`REPORTS` ga bitta qator), `lib/access.ts`,
  `features.ts`, `crm-shell.tsx`, `lib/uz.ts`.
- Baza: `audit_events` da `(tenant_id, actor_id, seq)` indeksi kerak bo'lishi mumkin — migratsiya `0019`.

#### E6d. Bildirishnomalar (L)

Eskida: `NotificationBell.jsx` va `NotificationsPage.jsx` — xotiradagi toast jurnali (o'qilgan/o'qilmagan, tozalash),
saqlanmaydi. Yangida haqiqiy bildirishnoma.

- Jadval `notifications`: xodim, turi, sarlavha, matn, havola, o'qilgan vaqt, vaqt. RLS va `tenant_id`, ajratish testi
  (CLAUDE.md qoidasi). Migratsiya `0019` yoki `0020`.
- Manbalar (birinchi variant): saytdan yangi ariza (`lead.apply`, ADR 0026 qoldirgan), yangi tasdiq so'rovi
  (direktorga) va hal qilingani (so'rov egasiga), yangi qurilmadan kirish, bugungi o'tgan keyingi aloqa lidlari soni.
- Ko'rinish: yuqori panelda qo'ng'iroq (o'qilmaganlar soni, ochiladigan ro'yxat, "Hammasini o'qilgan qilish"),
  `/notifications` sahifasi (hammasi / o'qilmagan / o'qilgan, tozalash).
- Telegram: xodimning `telegramChatId` si va markaz boti (`deps(tenant).telegram`) tayyor; har xodim turini
  yoqadi/o'chiradi (sozlama `notifications.prefs` yoki alohida ustun).
- Muhim qaror: toast (`@ventura/ui/toast`) qoladi, u bildirishnoma emas. Eskidek "har toast jurnalga yozilsin"
  takrorlanmaydi. Saidakbar hal qiladi (3.4, savol 3).
- Fayllar: `packages/db/src/schema/tenant/*.ts` + `migrations/tenant/0019_*.sql`, yangi `lib/server/notify.ts`,
  `lib/notifications.ts`, `app/(crm)/notifications/*`, `crm-shell.tsx` (qo'ng'iroq `Topbar` bolalari ichida —
  `packages/ui` o'zgarmaydi), `app/ariza` yozish joyi (`lib/server/apply.ts`), `lib/server/approvals.ts`,
  `lib/uz.ts`, `lib/access.ts` (sahifa hammaga ochiq).

#### E6e. Arxiv va tiklash (S)

- "Xodimlar" tabi: bo'shatilganlar (`users.archivedAt`), kim va qachon; "Tiklash" (`archive.restore`): `archivedAt`
  bo'shatiladi, lavozim va filiallar saqlangan, telefon bandligi tekshiriladi; jurnal `staff.restore`. Tiklangan xodimga
  vaqtinchalik parol yaratish tavsiyasi (qayta kirish uchun) — qaror kerak.
- Butunlay o'chirish hozir faqat o'quvchida. Boshqa jadvallarga kengaytirish yoki yo'qligi — savol 4 (tavsiya: kengaytirmaslik,
  tarix saqlansin).
- "Bekor qilinganlar" tabi (ixtiyoriy): to'lov, xarajat, qo'shimcha daromad va ish haqi yozuvlarining bekor qilinganlari
  bitta ro'yxatda, tiklash tegishli sahifaga yo'naltiradi. Hozir har biri o'z sahifasida ko'rinadi va tiklanadi.
- Fayllar: `app/(crm)/archive/{data.ts,actions.ts,archive-view.tsx}`, `app/(crm)/staff/*` (qaytarish uchun umumiy funksiya),
  `lib/uz.ts` (`archive`).

#### E6f. Sabablar sahifasi (M)

Eski `ReasonsPage.jsx`: 8 ta sabab turi, har biri alohida ro'yxat va "sabab so'ralsinmi" yoqgichi.

- Yagona sahifa `/reasons` (menyuda "O'quv"): tablar — kelmaganda, faol o'quvchi chiqarilganda, sinovdagi o'quvchi
  chiqarilganda, muzlatilganda, o'quvchi qaytarilganda, lid o'chirilganda, guruh o'chirilganda + mavjud ikkitasi (lid
  yo'qotish, guruhdan chiqish).
- Kalitlar `lib/reasons.ts` ga: `reasons.absence`, `reasons.student_active`, `reasons.student_trial`, `reasons.freeze`,
  `reasons.student_return`, `reasons.lead_archive`, `reasons.group_archive` va yoqgichlar `reasons.switches`. Mavjud
  `leads.lost_reasons` va `groups.leave_reasons` o'z joyida qoladi (ADR 0022, 0031), sahifa ularni ham ko'rsatadi.
- Tegishli dialoglarda erkin matn o'rniga sabab tanlash (+ "Boshqa" matni): o'quvchi holati (`student-dialogs.tsx`),
  arxivlash (o'quvchi, lid, guruh), davomat (`groups/attendance-tab.tsx`), guruhga qaytarish. Yoqgich o'chiq bo'lsa —
  hozirgidek ixtiyoriy matn.
- Eslatma: ko'p dialogga tegadi, boshqa paketlar bilan fayl kesishmasligi uchun oxirida qilish tavsiya.
- Fayllar: yangi `app/(crm)/reasons/*`, `lib/reasons.ts`, `lib/server/leave-reasons.ts` o'rniga umumiy yuklovchi,
  `app/(crm)/{students,leads,groups}/*dialogs*.tsx`, `app/(crm)/reasons-modal.tsx` (qayta ishlatiladi), `lib/uz.ts`.

#### E6g. Qurilmalar, profil va xavfsizlik (L)

Eski `DevicesPage.jsx`, `ProfilePage`, `SecurityPage`.

- Qurilmalar: `/devices` (direktor; eskidek "Sozlamalar" ostida): xodim, qurilma (brauzer/OT), IP, oxirgi kirish, kirishlar
  soni, holat (faol/bloklangan); filtr (xodim, holat), qidiruv; bloklash va blokdan chiqarish. Bloklangan qurilmadan
  kirish rad etiladi (`onStaffLoginSuccess` va sessiya tekshiruvi).
- Baza: `known_devices` ga `blocked_at`, `login_count` ustunlari (migratsiya `0020`). Hozir jadvalda qurilma nomi va
  oxirgi faollik yo'q — qo'shiladi.
- Shaxsiy profil `/account`: ism, telefon (faqat ko'rish), lavozimlar, "Mening ruxsatlarim" ro'yxati, Telegram holati,
  parol almashtirishga havola, o'z qurilmalari va "boshqa seanslarni yopish". Menyudagi foydalanuvchi ro'yxatiga
  "Profil" qo'shiladi (hozir faqat "Parolni o'zgartirish").
- Fayllar: `packages/db/src/schema/tenant/auth.ts` + migratsiya, `packages/auth/src/staff/service.ts` (blok tekshiruvi
  — xavfsizlik kodi, alohida ko'rib chiqiladi), yangi `app/(crm)/devices/*`, `app/(crm)/account/*` (hozirgi
  `app/(auth)/account/password` ga tegmaydi), `crm-shell.tsx`, `lib/uz.ts`.
- Olinmaydi: tezkor PIN va avto-qulf (sessiya muddati Ventura panel siyosatida, `getSessionPolicy`).

#### E6h. Global qidiruv va tezkor amallar (M)

- Yuqori paneldagi "Qidirish… Ctrl K" hozir ishlamaydi. Variant A: ulash — o'quvchi, guruh, o'qituvchi, lid (ism,
  telefon) bo'yicha server qidiruvi, natijadan tegishli profilga o'tish, `Ctrl K` bilan ochish. Variant B: ulamaguncha
  yashirish (3.2). Tavsiya: A.
- Tezkor amallar (eski `QuickActionsMenu`): "To'lov qabul qilish", "Tezkor o'quvchi qo'shish" — mavjud dialoglarga
  ochiladigan menyu. Ruxsatga qarab ko'rinadi.
- Fayllar: `packages/ui/src/components/topbar.tsx` (qidiruv `onSearch`/`onOpen` xususiyatlari — avval UI paketda,
  STYLE.md yangilanadi), yangi `app/(crm)/search/*` (server amali), `crm-shell.tsx`, `lib/uz.ts`.
- ruxsat: natija faqat xodimning ko'rish ruxsati va filialiga mos yozuvlar.

#### E6i. Filiallar (S + M)

- S: kartadagi "Faol o'quvchilar" va "Guruhlar" haqiqiy son bo'lsin (`branches/data.ts:102-103` hozir qattiq 0). Hisob
  ro'yxat sahifalaridagi bilan bir xil funksiyadan (E5 qarori 1).
- M (ixtiyoriy): filial tafsilot oynasi — tushum, xarajat, sof foyda, faol, muzlatilgan, ketgan o'quvchi, qarzdorlar,
  xodimlar (eski `BranchDetailModal`); filiallar taqqoslash hisoboti (eski `analytics` "Filiallar foydasi" va
  `branchAnalytics`) — `/reports/branches`, ruxsat `dashboard.financial_stats`. ADR 0008 buni E5 hisobotlariga
  qoldirgan edi, E5 da qilinmadi.
- Fayllar: `app/(crm)/branches/{data.ts,branches-view.tsx}`, yangi `lib/server/branch-reports.ts`,
  `app/(crm)/reports/views/branches.tsx`, `lib/server/reports.ts`.

#### E6j. Moliya va davomat qoldiqlari (S)

Uchta mustaqil kichik ish:

1. Boshlang'ich kapital: `settings` kaliti `finance.opening_balance`; pul oqimidagi yig'ma qoldiq shundan boshlanadi.
   Kiritish — `/payment-settings` da. Fayllar: `lib/server/cashflow-reports.ts`, `lib/cashflow-views.ts`,
   `app/(crm)/payment-settings/*`.
2. Davomat jurnalini Excelga yuklash (`attendance.export`, ADR 0014 qoldirgan): guruh va oy bo'yicha jadval, Excel
   tizimi (ADR 0013, 0030) orqali. Fayllar: `app/(crm)/attendance/*`, `app/(crm)/groups/attendance-tab.tsx`, `lib/excel.ts`.
3. Xodimlar davomati oylik hisoboti (E5 #15): xodim bo'yicha kelgan, kech, kelmagan kunlar, oy tanlanadi, Excel.
   Fayllar: `app/(crm)/staff-attendance/*`, `lib/employee-ranking.ts`.

### 3.2. Bo'sh joylar va ko'rinadigan qoldiqlar (tozalash)

Foydalanuvchiga hozir ko'rinadigan, lekin ishlamaydigan yoki doim bo'sh joylar. `S` paket "E6k. Bo'sh joylarni tozalash".

| # | Joy | Nima ko'rinadi | Tavsiya |
| --- | --- | --- | --- |
| 1 | `app/(crm)/[section]/page.tsx`, `lib/uz.ts:2421` | `features.ts` da `exams` (`/exams`), `coins` (`/coins`), `sms` (`/sms`) bo'limlari menyuga chiqadi va "Bo'lim tayyorlanmoqda" bo'sh sahifasiga olib boradi. Panelda bo'lim yoqilsa darhol paydo bo'ladi | Menyudan olish: sahifasi bor bo'limlargina `nav` bersin (`features.ts` dan `nav` olib tashlash yoki `hidden`), bo'sh sahifa faqat yo'l bo'yicha ochilsa qolsin yoki o'chirilsin. Bo'limlar 8-bo'limga ko'ra birinchi versiyada yo'q |
| 2 | `packages/ui/src/components/topbar.tsx:62-80` | "Qidirish… Ctrl K" maydoni hech narsa qilmaydi | E6h; vaqtincha yashirish |
| 3 | `app/(crm)/branches/data.ts:102-103` | Filial kartasida "Faol o'quvchilar 0", "Guruhlar / xodimlar 0 / n" | E6i (S) |
| 4 | `app/(crm)/teachers/teachers-view.tsx:366,394,410,446` | O'qituvchilar va support jadvalida "Reyting" ustuni doim "—" | Ustunni olib tashlash; reyting o'quvchi portali bilan qaytadi (E5 #21) |
| 5 | `app/(crm)/payments/student-finance-tab.tsx:47` | O'quvchi moliya tabida "Coin" kartasi "0" va "Coin tizimi keyingi versiyada ulanadi" | Kartani olib tashlash yoki `coins` bo'limi yoqilgandagina ko'rsatish |
| 6 | `app/(crm)/students/bulk-actions.tsx:78`, `lib/uz.ts:567` | Tanlab amallarda o'chirilgan "SMS" tugmasi, hint "SMS bo'limi hali ulanmagan" | `sms` bo'limi yoqilganda ko'rsatish, aks holda yashirish |
| 7 | `lib/uz.ts:684, 1101, 2288` (`groupsLater`, `attendanceLater`) | Ishlatilmaydigan eski matnlar ("E1d bilan shu yerda chiqadi") | O'chirish |
| 8 | `lib/uz.ts:821` (`systemStageMove`), `app/(crm)/leads/actions.ts:210` | Xato matni "keyingi bosqichda (E4b)" — E4b tayyor | Matnni to'g'rilash |
| 9 | `app/(crm)/courses/data.ts:65` | `paid: 0` ("Moliya bilan (E3)") — ko'rinishda ishlatilmaydi | Maydonni olib tashlash |
| 10 | `app/(crm)/teachers/data.ts:35` | eskirgan izoh "Guruhlar bo'limi (E1d) bilan to'ladi; hozircha 0" | Izohni yangilash (support qatorlarida 0 — loyiha bo'yicha to'g'ri) |

Qidiruvda topilmaganlar: "tez kunda" matni `lib/uz.ts` da yo'q; "noData" faqat haqiqiy bo'sh holatda ("—" yoki "Ma'lumot
yo'q") ishlatiladi. O'qituvchilar sahifasidagi "Jami ulush" va "O'rtacha retention" kartalari tuzatilgan (commit 32f1a6c).

### 3.3. Faqat ko'rinish va tekshiruv (polish)

| Paket | Hajm | Ichida |
| --- | --- | --- |
| E6l | M | Rang kontrasti (WCAG AA) tekshiruvi: `docs/design/STYLE.md` 616 va 656-qatorlarda "hali to'liq tekshirilmagan" deb yozilgan. Avval yordamchi matn (`--muted-foreground`), dark rejimdagi badge'lar; light va dark uchun asosiy sahifalar (`/`, `/students`, `/payments`, `/reports/*`, `/leads`). Natija: token tuzatishlari `packages/ui` da, katalog (`/ui-preview`) va STYLE.md yangilanadi |
| E6l | M | Mobil ko'rinish (≤900 px): jadvallar gorizontal aylantirish yoki kartaga o'tishi, filtr qatorlari, dialoglar, doska. ADR 0034 cheklovlari: telefon kengligida 12 oy nomi zich turadi, kam sonli grafikda o'q bo'linmalari kasr chiqadi (`packages/ui` dagi `TrendChart`). Playwright mobil skrinshotlari (`apps/edu-crm/e2e`) |
| E6m | S | Hujjatlar: EDU-CRM-PLAN E6 katagi va "olinmaydi" ro'yxati (4-bo'lim bu hujjatdan ko'chiriladi), ADR 0035+ har paket uchun, `docs/design/STYLE.md` yangilanishi |

E6l va E6m boshqa paketlar tugagach (yoki parallel, faqat token va hujjat fayllarida) bajariladi.

### 3.4. Hal qilinadigan savollar (Saidakbar)

1. Markaz nomi, logotip va rangi CRM ichidan o'zgartiriladimi (hozir Ventura panelida)? Tavsiya: yo'q, faqat ko'rsatish.
2. `/settings` ruxsati: faqat direktor yoki `settings.receipt` kabi mavjud ruxsat? Yangi ruxsat qo'shilmasin (E5 qarori 7 ruhi).
3. Bildirishnoma: faqat Telegram, faqat qo'ng'iroq yoki ikkalasi? Qaysi hodisalar (3.1, E6d)? Eskidek "har amal toast jurnalga" kerak emasligini tasdiqlash.
4. Arxivdan butunlay o'chirish faqat o'quvchida qolsinmi? Tavsiya: ha.
5. `exams`, `coins`, `sms` bo'limlari menyudan yashirilsinmi (3.2, 1-band)?
6. Global qidiruv (E6h) E6 ga kiradimi yoki keyinga? Hozir u ko'rinadigan ishlamaydigan element.
7. Filiallar taqqoslash hisoboti (E6i, M qismi) E6 ga kiradimi? Eski tizimda ham menyuda yo'q edi.

## 4. Olinmaydi

Eski ko'rinish yangi tizimda bo'lmaydi. Sabab bilan; EDU-CRM-PLAN 7-bo'limga ko'chiriladi.

| Eski ko'rinish | Sabab |
| --- | --- |
| `coins`, `reportCoins` | Coin va ball tizimi birinchi versiyada yo'q (PLAN 8-bo'lim, qaror 10) |
| `points`, `reportPoints` | Xuddi shu |
| `placementTest`, `examTemplates`, `reportExams`, `reportTeacherExams` | Imtihonlar va sertifikatlar yo'q (PLAN 8-bo'lim). Daraja testi sahifasi faqat test nomlari ro'yxati edi |
| `smsBuy`, `autoSms`, `smsTemplates`, `reportSmsSent` | SMS yuborish yo'q (PLAN 8-bo'lim). `reportSmsSent` soxta raqamli edi (E5) |
| Qarzdorlar va lidlar ommaviy SMS tugmalari | SMS yuborish yo'q |
| `reportJournals` | Soxta raqamli; dars jurnali o'qituvchi portali bilan (PLAN 8-bo'lim) |
| `reportTeacherRetention`, `reportTeacherAttendance`, `reportGroupRelevance`, `reportCalls`, `reportTelegramBot`, `reportStudentApp`, `reportReferrals`, `reportTasks` | Eski tizimda ham "Tez kunda" sahifa edi; bog'liq bo'limlar yo'q (E5 ro'yxati) |
| `teacherForm`, `staffForm` (ariza ko'rinishi), `referralForm` | Eski sahifalar faqat maydon belgilash va ko'rinish edi, ariza qabul qiluvchi sahifa va oqim yo'q edi. `simpleForm` esa `/ariza` sifatida bor |
| `leadForms` | Eski tizimda sahifasi yo'q (faqat id ro'yxatda) |
| Markaz sozlamalaridagi "Xavfli zona" (hammasini o'chirish) | Xavfli; o'rniga tanlab amallar (ADR 0028), arxiv va sabab bilan bekor qilish |
| Arxivni tozalash ("Hammasini butunlay o'chirish") | Xuddi shu sabab; tarix saqlanadi |
| Profil: logotip yuklash, izoh (bio) | Brend Ventura panelida (principle 6) |
| Xavfsizlik: tezkor PIN, avto-qulf, 2FA yoqgichi | Kirish har doim parol + Telegram kodi (qaror 8); sessiya muddati panel siyosatida |
| Har menejerga alohida ruxsat | Ruxsatlar lavozim orqali (qaror 14); bir nechta lavozim qo'shiladi |
| Lid filtrlarini ko'rsatish/yashirish sozlamasi (`LeadFilterSettingsModal`) | Ahamiyati kichik; filtrlar doim ko'rinadi |
| Voronkada bosqichni yashirish, xavf chegaralari oynasi | E5 ro'yxati #18, #20 |
