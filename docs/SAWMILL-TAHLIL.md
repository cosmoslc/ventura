# sawmill: eski Pilorama ilovasi (Flutter) tahlili

2026-10-17 · manba: `C:\Projects\Pilorama` (faqat o'qish uchun) · reja: `docs/SAWMILL-PLAN.md`

Bu hujjat eski ilova **nima qilishini** yozadi: ekranlar, ma'lumotlar, har bir hisob-kitob formulasi va topilgan kamchiliklar. Yangi `apps/sawmill` shu hujjatdagi xatti-harakatni takrorlaydi (kamchiliklar bo'yicha qaror — rejaning 9-bo'limida).

## 1. Umumiy ko'rinish

Ilova nomi interfeysda "Pilorama Boshqaruvi" (paket nomi `parket_boshqaruv`, versiya 1.0.1). Bitta pilorama (yog'och tilish sexi) egasi uchun: **terak** (sotib olingan yog'och partiyasi) bo'yicha ishchilar ishi, ish haqi, material ombori, yuk chiqarish (sotuv) va foydani hisoblaydi.

| | Eski tizim |
| --- | --- |
| Til va ilova | Dart, Flutter (SDK ^3.10), asosan Android; Linux/Windows/web papkalari bor, lekin ishlatilmaydi |
| UI | `forui` 0.27 + Material, o'z navbar'i (`ZumradNavBar`), Noto Sans |
| Holat | `provider` — 8 ta `ChangeNotifier`; asosiy mantiq bitta faylda (`AppDataProvider`, 1 628 qator) |
| Ma'lumot | Telefonning o'zida SQLite (`sqflite`, `parket_boshqaruv.db`, sxema versiyasi 7), 15 jadval. Server yo'q |
| Sozlamalar | `shared_preferences` (tema, til, birliklar, foyda usuli, obuna) |
| Kirish | Yo'q. Birinchi ochilganda ism + telefon → `pilorama.uz/api/register`, qurilma ID (UUID) bo'yicha 7 kunlik sinov va bloklash (`/status`) |
| Obuna | DEMO: karta oxirgi 4 raqami saqlanadi, "to'lash" tugmasi to'lovsiz 30 kun qo'shadi (Click integratsiyasi TODO) |
| Bildirishnoma | Telefon ichidagi (`flutter_local_notifications`): zakaz tayyor, muddat yaqin, sinov tugashi |
| Yangilanish | GitHub Releases'dagi `version.json` → APK ilova ichida yuklanadi |
| Zaxira | Hamma jadval JSON faylga eksport (ulashish oynasi orqali) va JSON'dan to'liq tiklash |
| Tillar | O'zbekcha va ruscha (`app_text.dart`, 327 kalit) |
| Kod hajmi | `lib/` — 13 191 qator Dart: ekranlar 4 600, mantiq va baza 2 900, UI/tema 3 000, tarjimalar 670 |
| Testlar | `test/calculations_test.dart` — 17 ta hisob-kitob testi (dona↔kub, balans, terak foydasi, yuk summasi, sana filtri, formatterlar); `db_schema_test.dart` — sxema va modellar mosligi. Yangi Vitest testlari uchun tayyor ssenariylar |
| Qo'shimcha | `backend/` papkasi — aslida reklama sayti (React 19 + Vite, Google AI Studio'da yaratilgan), ilova serveri emas |

**O'lik kod:** `WorkersScreen` (`workers_screen.dart`) va `ExpensesScreen` (`expenses_screen.dart`) hech qayerdan ochilmaydi; `computeMaterialPay`, `totalWorkersBalance`, `totalOtherExpenses` chaqirilmaydi. Ko'chirilmaydi.

## 2. Asosiy tushunchalar

| Tushuncha | Eski kodda | Ma'nosi |
| --- | --- | --- |
| Terak | `Terak` | Sotib olingan yog'och partiyasi: nomi, sotib olingan sana va narx. Deyarli hamma narsa terakka bog'lanadi |
| Res | `TerakCost.reysCount` | Terakdan olib kelingan xoda (reys). "Res olib kelish" xarajatidagi reys soni yig'iladi |
| Sartirofka | `workType == 'Sartirofka'` | Xodani saralash ishi. 1 res = 1 sartirofka; res tugasa sartirofka yozib bo'lmaydi |
| Material | `MaterialItem` | Tayyor mahsulot turi: Vassa, Kvadrat, Dona, Bay va foydalanuvchi qo'shganlari. Katalog umumiy |
| Terak materiali | `TerakMaterialStock` | Shu terakdagi material: qoldiq, ishchi narxi va sotish narxi (dona va kub uchun alohida), maqsad |
| Hisoblash turi | `PricingMode` | `perPiece` (dona) yoki `perRow` (qator). `perCube` enum'da bor, lekin formada tanlanmaydi |
| O'lcham | `MaterialSize` | Bitta materialning o'lcham varianti (qalinlik × eni × uzunlik). "Chuqur hisob-kitob" sozlamasi yoqilganda |
| Ish | `WorkEntry` | Ishchining bitta ishi va unga hisoblangan pul. Yakka yoki guruh |
| To'lov | `Payment` | Ishchiga berilgan pul (balansdan ayiriladi) |
| Yuk chiqarish | `Dispatch` | Ombordan mijozga sotish: miqdor, narx, qabul qiluvchi |
| Yuk mashinasi | `Truck` | Nomi va summasi; yuk chiqarishda tanlangan ishchilarga teng bo'linib to'lov sifatida yoziladi |
| Zakaz | `OrderItem` | Mijoz buyurtmasi: material, miqdor, muddat. Ombor yetarli bo'lsa "tayyor" |
| Qo'shimcha xarajat | `TerakCost` | Terakka tegishli xarajat: Tashish, Res olib kelish, Boshqa |

## 3. Ekranlar

Pastki navbar: 4 tab + "tezkor amallar" tugmasi.

| # | Ekran | Nima bor | Amallar |
| --- | --- | --- | --- |
| 1 | Ro'yxatdan o'tish | Logo, ism, telefon, "Sinovni boshlash" | Serverga ro'yxatdan o'tish |
| 2 | Bloklangan / sinov tugagan | Xabar | Qayta tekshirish |
| 3 | **Bosh sahifa** | Terak tanlash; sof foyda kartasi; 4 ko'rsatkich: terak xarajatlari, ishchilar balansi, yuk daromadi, ombor qiymati; ombor (material kartalari, 2 ustun); haftalik yuk grafigi (7 kun); qo'shimcha xarajatlar ro'yxati; diqqat talab zakazlar | Tema almashtirish, sozlamalar, pastga tortib yangilash. Teraksiz — bo'sh holat va "Terak qo'shish" |
| 4 | Sozlamalar (pastki oyna) | Obuna qolgan vaqti; til (uz/ru); foyda usuli (taxminiy/haqiqiy); miqdor ko'rinishi (dona/kub); kub hisoblash usuli (to'g'ridan/o'lchamdan); o'lcham birligi (mm/sm/m); o'lchamlar funksiyasi; obuna (demo karta); zaxira | Eksport/tiklash, o'lchamlarni o'chirishda ikki variant (11-qism) |
| 5 | **Kunlik ishlar** | "Umumiy ishlar" (hamma yozuvlar) + har terak kartasi, yozuvlar soni bilan | Terak ishlariga o'tish |
| 6 | Terak ishlari | Filtr: ishchi, sana oralig'i; yozuvlar ro'yxati (ishchi — ish turi, sana, miqdor, summa) | Ish qo'shish; chapga surib o'chirish; uzoq bosib tahrirlash (ish turi, summa, sana) |
| 7 | Ish qo'shish (pastki oyna) | Yakka / Guruh almashtirgich | 5-qism |
| 8 | **Ishchilar** | Ro'yxat: ism, telefon, maosh turi, balans (yashil/qizil) | Qo'shish; uzoq bosib tahrirlash; profilga o'tish |
| 9 | Ishchi formasi | Ism, telefon, maosh turi (ishiga qarab / kunlik / haftalik / oylik), maosh summasi | Saqlash |
| 10 | Ishchi profili | Telefon va maosh nishonlari; joriy balans; 3 tab: ish tarixi (filtr: ish turi, sana), to'lovlar, material narxlari | "Pul berish" (summa, izoh); materialga maxsus narx qo'yish/olib tashlash |
| 11 | **Teraklar** | Kartalar: nomi, foydasi, sana, sotib olish narxi | Qo'shish (nomi "Terak N", narx, sana); surib o'chirish; uzoq bosib tahrirlash |
| 12 | Terak tafsilotlari | Foyda kartasi + res soni; 4 tab: Ombor, Yuk chiqarish, Zakazlar, Qo'shimcha xarajatlar | Tahrirlash |
| 12a | — Ombor tabi | Material kartalari: qoldiq, o'lchamlar soni, maqsad progressi, narx teglari (ishchi/sotish × dona/kub) | Material qo'shish; uzoq bosib narx va o'lchamlarni tahrirlash; maqsad qo'yish; o'lchamlar oynasi (funksiya yoqilganda); surib terakdan olib tashlash |
| 12b | — Yuk chiqarish tabi | Ro'yxat: material — miqdor, qabul qiluvchi, manzil, telefon, sana, mashina, summa | Yuk chiqarish; yuk mashinalari oynasi; tahrirlash; o'chirish |
| 12c | — Zakazlar tabi | Ro'yxat: mijoz, material — miqdor, telefon, manzil, muddat; holat ikonkasi (bajarilgan / tayyor / kutilmoqda) | Qo'shish; tahrirlash; bajarildi belgisi; o'chirish |
| 12d | — Xarajatlar tabi | Ro'yxat: turi, sana, summa | Qo'shish; tahrirlash; o'chirish |
| 13 | Material formasi (dialog) | Nomi; dona/qator; ishchi narxi va sotish narxi (1 dona yoki 1 qator); dona uchun yana: o'lchamlar (q × e × u) va 1 dona hajmi, 1 m³ ishchi narxi, 1 m³ sotish narxi | Qo'shish (hamma teraklarga) yoki saqlash |
| 14 | Yuk chiqarish (pastki oyna) | Material (qoldig'i bilan), miqdor, dona/kub, narx, jami summa, sana, qabul qiluvchi, manzil, telefon, yuk mashinasi va ishchilar | 7-qism |
| 15 | Yuk mashinalari | Nomi, summasi | Qo'shish, tahrirlash, o'chirish |
| 16 | Zakaz (pastki oyna) | Mijoz, telefon, manzil, material, kerakli miqdor, muddat (standart +7 kun) | Saqlash |
| 17 | Qo'shimcha xarajat (pastki oyna) | Turi: Tashish / Res olib kelish / Boshqa; Res uchun reys soni × 1 reys narxi, aks holda summa; sana | Saqlash |
| 18 | Tezkor amallar (navbar) | Ish qo'shish, Yuk chiqarish, Xarajat qo'shish (bosh sahifada tanlangan terakka), Ishchi qo'shish, Terak qo'shish | — |
| 19 | Dialoglar | Yangilanish (APK yuklash progressi), sinov tugashi ogohlantirishi, o'chirish tasdig'i | — |

Jami: 4 asosiy tab, 3 ichki sahifa (terak ishlari, ishchi profili, terak tafsilotlari), ~15 pastki oyna va dialog.

## 4. Ma'lumotlar (SQLite, 15 jadval)

Hamma `id` — UUID matn, sanalar — ISO matn, pul va miqdor — `REAL`. Tashqi kalitlar va indekslar yo'q.

| Jadval | Ustunlar | Izoh |
| --- | --- | --- |
| `workers` | name, phone, createdAt, salaryType, fixedWageAmount | |
| `work_entries` | workerId, workType (matn), amount, date, materialId?, materialQty?, rows?, terakId?, materialSizeId?, isGroupWork, note | Ish turi nomi matn bo'lib saqlanadi, `work_types` ga havola emas |
| `payments` | workerId, amount, date, note | Sana doim "hozir" |
| `materials` | name, unit, pricingMode, thicknessCm?, widthCm?, lengthCm?, unitVolumeM3? | `unitVolumeM3` yoziladi, lekin o'qilmaydi |
| `terak_materials` | terakId, materialId, quantity, workerPrice, sellingPrice?, cubeWorkerPrice?, cubePrice?, goal? | Ombor qoldig'i shu yerda (doim donada) |
| `worker_material_prices` | workerId + materialId (kalit), price | Ishchiga maxsus dona narxi, hamma teraklar uchun |
| `work_types` | name | Standart: Sartirofka, Terak Kesish |
| `teraks` | name, purchaseDate, purchasePrice, resCount, note, createdAt | `resCount` ishlatilmaydi (res xarajatlardan hisoblanadi) |
| `terak_costs` | terakId, type, amount, date, note, reysCount?, pricePerReys? | |
| `dispatches` | terakId, materialId, quantity (dona), date, name, address, phone, unitPrice (1 dona uchun), truckId? | |
| `orders` | terakId, materialId, quantity, customerName, phone, address, dueDate, isCompleted, notifiedReady, notifiedDueSoon, createdAt | |
| `trucks` | name, amount, createdAt | |
| `material_sizes` | materialId, thicknessCm?, widthCm?, lengthCm?, createdAt | |
| `material_size_stock` | materialId, sizeId, quantity | Terakdan mustaqil |
| `expenses` | type, amount, date, note | Eski umumiy xarajatlar; foydaga kirmaydi, ekrani o'lik |

**Boshlang'ich ma'lumot:** birinchi ochilganda materiallar — Vassa (dona), Kvadrat (qator), Dona (dona), Bay (birligi "bay", dona hisobida); ish turlari — Sartirofka, Terak Kesish. Yangi terak qo'shilganda shu 4 material unga 0 narx bilan biriktiriladi.

## 5. Hisob-kitob: hajm va birliklar

- **O'lcham birligi** (sozlama: mm / sm / m) faqat kiritish va ko'rsatish uchun; bazada doim santimetr: `sm = qiymat × {mm: 0.1, sm: 1, m: 100}`.
- **1 dona hajmi:** `V = (q/100) × (e/100) × (u/100)` m³ (q, e, u — sm). Uchala o'lcham kiritilgan va musbat bo'lsagina; aks holda material kubga aylanmaydi.
- **Dona ↔ kub:** `kub = dona × V`, `dona = kub / V`.
- **Ombor doim donada** (qator materialida — qatorda). "Miqdor ko'rinishi: kub" sozlamasi faqat ko'rsatishni o'zgartiradi (kubga aylanmaydigan material baribir donada).
- **Pul** kiritishda faqat butun son (minglik probel bilan: `100 000`). Ko'rsatish: `1 234 567 so'm`, manfiy — `-` bilan.

## 6. Hisob-kitob: ish haqi

### Ishchining narxi

```
ishchiNarxi(ishchi, terak, material):
  ishchi "ishiga qarab" emas (kunlik/haftalik/oylik)  → 0
  ishchiga shu materialga maxsus narx bor            → maxsus narx
  aks holda                                          → terak_materials.workerPrice

ishchiKubNarxi(ishchi, terak, material):
  ishchi "ishiga qarab" emas → 0
  aks holda                  → terak_materials.cubeWorkerPrice ?? 0   (maxsus narx yo'q)
```

### Yakka ish

Ish turi ro'yxatdan (`work_types`), "Boshqa" (o'z nomi, ixtiyoriy ro'yxatga qo'shish) yoki — terak ichida bo'lsa — "Material" bo'ladi.

| Holat | Summa | Omborga qo'shiladi |
| --- | --- | --- |
| Oddiy ish turi | Qo'lda kiritilgan summa (> 0) | — |
| Material, qator | `qator × ishchiNarxi` | `qator` |
| Material, dona | `dona × ishchiNarxi` | `dona` |
| Material, kub, "to'g'ridan" usuli | `m³ × ishchiKubNarxi` | `m³ / V` dona |
| Material, kub, "o'lchamdan" usuli | `(dona × V) × ishchiKubNarxi` | `dona` |

- "Kub" almashtirgichi material kubga aylansa va terakda `cubeWorkerPrice` qo'yilgan bo'lsagina chiqadi.
- O'lcham tanlangan bo'lsa, miqdor o'lcham zaxirasiga (`material_size_stock`) ham qo'shiladi.
- Ish turi "Sartirofka" va terakda qolgan res ≤ 0 bo'lsa — rad etiladi (8-qism).

### Guruh ishi

Bir nechta ishchi tanlanadi; "har biriga to'liq" belgisi bor.

| Holat | Jami summa |
| --- | --- |
| Materialsiz | `ish soni × 1 ish narxi` |
| Material, qator | `qator × terak_materials.workerPrice` |
| Material, dona | `dona × terak_materials.workerPrice` |
| Material, kub | `kub miqdori × terak_materials.cubeWorkerPrice` (kub miqdori — usulga qarab, yakka ishdagidek) |

- **Har ishchiga:** belgi yoqilgan bo'lsa `jami`, aks holda `jami / ishchilar soni`. Maoshli ishchiga `0`.
- Har ishchiga alohida `work_entries` yozuvi (`isGroupWork = 1`); har birida **jami** miqdor turadi, lekin omborga miqdor **bir marta** qo'shiladi.
- Izoh avtomatik: `Guruh ishi • 3 kishi • Vassa • jami 450000 so'm` (yoki `• har biriga to'liq`). Guruh shu izoh + sana bo'yicha taniladi — alohida guruh ID yo'q.
- Guruh ishida ishchining maxsus narxi **hisobga olinmaydi** (yakka ishdan farq).

### Ishni o'chirish va tahrirlash

- O'chirish: ish materialni omborga qo'shgan bo'lsa, miqdor terak omboridan va o'lcham zaxirasidan ayriladi. Guruh ishida — faqat guruhning **oxirgi** yozuvi o'chirilganda (guruh = bir xil sana, izoh, ish turi, material, terak, o'lcham).
- Tahrirlash: faqat ish turi, summa va sana. Material va ombor o'zgarmaydi.

## 7. Hisob-kitob: balans, to'lov, yuk mashinasi

- **Ishchi balansi** = `Σ ish summasi − Σ to'lovlar` (hamma teraklar va umumiy ishlar). Musbat — korxona qarzdor; manfiy — ishchi ortiqcha olgan.
- **Ishchining terak bo'yicha balansi** (to'lovlar terakka bog'lanmagani uchun mutanosib taqsim):
  `shuTerakdaIshlagan × (balans / jamiIshlagan)`. Hamma teraklar bo'yicha yig'indisi umumiy balansga teng (terakka bog'lanmagan ishlar hisobga olinmasa).
- **Terak ishchilar balansi** (bosh sahifadagi ko'rsatkich) = shu terakda ishlagan har ishchining terak bo'yicha balansi yig'indisi.
- **To'lov:** summa > 0, izoh ixtiyoriy, sana — hozir. Tahrirlash va o'chirish yo'q.
- **Yuk mashinasi:** yuk chiqarishda mashina va ishchilar tanlansa, `mashina summasi / ishchilar soni` har ishchiga **to'lov** sifatida yoziladi (izoh: `Yuk mashina xarajati: <nomi>`). Ishchi balansi kamayadi; foyda hisobiga ta'sir qilmaydi.
- **Maoshli ishchilar** (kunlik/haftalik/oylik): `fixedWageAmount` saqlanadi va ko'rsatiladi, lekin **hech qayerda hisoblanmaydi** — balansga faqat qo'lda kiritilgan oddiy ishlar tushadi.

## 8. Hisob-kitob: terak, res, ombor, foyda

### Res va sartirofka

```
resSoni(terak)        = Σ terak_costs.reysCount  (shu terak, reysCount bor yozuvlar)
sartirofkaSoni(terak) = workType = 'Sartirofka' yozuvlar soni; guruh ishi (sana + izoh) = 1
qolganRes(terak)      = max(0, resSoni − sartirofkaSoni)
```

"Res olib kelish" xarajati: `summa = reys soni × 1 reys narxi`.

### Ombor

- Qoldiq ish bilan oshadi, yuk chiqarish bilan kamayadi (o'chirish va tahrirlashda teskari).
- **Maqsad progressi** = `min(1, qoldiq / maqsad)`; maqsad bo'lmasa 0.
- **Ombor qiymati** (bitta qoldiq "sotilsa"):
  ```
  sellingPrice bor             → qoldiq × sellingPrice
  aks holda cubePrice bor va V → (qoldiq × V) × cubePrice
  aks holda                    → 0
  ```
- Yangi material **hamma teraklarga** bir xil narxlar bilan qo'shiladi; keyin narxlar har terakda alohida tahrirlanadi. Nom, birlik, o'lcham va hisoblash turi — global.

### Foyda

```
terakXarajati   = sotib olish narxi + Σ qo'shimcha xarajatlar + Σ ish summalari (shu terak)
yukDaromadi     = Σ (miqdor × unitPrice)  (shu terak yuk chiqarishlari)
omborQiymati    = Σ ombor qiymati          (shu terak materiallari)

foyda (taxminiy) = yukDaromadi + omborQiymati − terakXarajati
foyda (haqiqiy)  = yukDaromadi − terakXarajati
```

Sozlamadagi "Foyda hisoblash usuli" qaysi biri ko'rsatilishini tanlaydi (standart — taxminiy). Ish summasi to'langan-to'lanmaganidan qat'i nazar xarajat (avval faqat balans olinardi, tuzatilgan).

Umumiy ("barcha teraklar") versiyasi ham bor, lekin ekranda ko'rsatilmaydi: unda terakka bog'lanmagan ishlar ham xarajatga kiradi.

## 9. Hisob-kitob: yuk chiqarish

- Ro'yxatda faqat qoldig'i > 0 materiallar (`Vassa (bor: 120 dona / 1.92 m³)`).
- Miqdor dona yoki kubda kiritiladi; saqlashda doim donaga: `dona = m³ / V`.
- **Jami summa** = `kiritilgan miqdor × kiritilgan narx` (shu birlikda).
- **Saqlanadigan narx** 1 dona uchun ekvivalent: `unitPrice = jami / dona` — shunda `miqdor × unitPrice` har doim jami summaga teng.
- Material tanlanganda narx `sellingPrice` dan to'ladi. Birlik almashtirilganda:
  - donadan kubga: `cubePrice ?? joriyNarx / V`
  - kubdan donaga: `sellingPrice ?? joriyNarx × V`
- **Tekshiruv** (`ε = 0.000001`): qoldiq ≤ ε — "Omborda X yo'q"; qoldiq + ε < miqdor — "Omborda yetarli X yo'q (bor: N)"; |miqdor − qoldiq| < ε bo'lsa miqdor = qoldiq (kubdan aylantirishdagi kasr xatosi).
- **Tahrirlash:** avval eski miqdor qaytariladi, yangisi tekshiriladi va ayriladi. Material va mashinani o'zgartirib bo'lmaydi.
- **O'chirish:** miqdor omborga qaytadi.
- Yuk chiqarish o'lcham zaxirasini kamaytirmaydi.
- **Haftalik grafik** (bosh sahifa): oxirgi 7 kun, har kun `Σ miqdor` (donada, hamma materiallar qo'shib), bugungi ustun ajratilgan.

## 10. Zakazlar va eslatmalar

- **Tayyor:** `terak qoldig'i ≥ zakaz miqdori` (zakazlar o'rtasida ombor bo'linmaydi).
- **Muddat yaqin:** muddatga ≤ 2 kun (o'tib ketganlari ham).
- **Bosh sahifadagi diqqat ro'yxati:** bajarilmagan va (tayyor yoki muddat yaqin).
- **Eslatma** (telefon bildirishnomasi), har zakazga bir martadan: "Zakaz uchun material tayyor", "Zakaz muddati yaqinlashmoqda" (muddatgacha 0–2 kun). Tekshiruv faqat ilova ochilganda, ish yoki zakaz qo'shilganda.
- "Bajarildi" — qo'lda belgi; yuk chiqarish bilan bog'lanmagan.

## 11. Sozlamalar

| Sozlama | Qiymatlar (standart) | Ta'siri |
| --- | --- | --- |
| Til | uz / ru (uz) | Interfeys |
| Tema | yorug' / qorong'i (yorug') | Interfeys |
| Foyda usuli | taxminiy / haqiqiy (taxminiy) | 8-qism |
| Miqdor ko'rinishi | dona / kub (dona) | Faqat ko'rsatish |
| Kub hisoblash usuli | to'g'ridan (m³ kiritiladi) / o'lchamdan (dona kiritiladi) (to'g'ridan) | 6-qism |
| O'lcham birligi | mm / sm / m (sm) | Kiritish va ko'rsatish |
| O'lchamlar ("chuqur hisob-kitob") | yoniq / o'chiq (o'chiq) | Ish qo'shishda o'lcham tanlash; o'chirishda: hamma o'lcham zaxirasini o'chirish yoki har materialda faqat birinchi o'lchamni qoldirish |

## 12. Topilgan kamchiliklar

Yangi tizimda har biri bo'yicha qaror kerak (reja, 9-bo'lim): eskicha qoldirish yoki tuzatish.

| # | Kamchilik | Oqibati |
| --- | --- | --- |
| K1 | Maoshli ishchining kunlik/haftalik/oylik maoshi hisoblanmaydi | Balans va terak xarajati noto'g'ri (maosh yo'q) |
| K2 | Guruh ishida ishchining maxsus narxi va kub uchun maxsus narx hisobga olinmaydi | Bir xil ish yakka va guruhda har xil to'lanadi |
| K3 | Guruh ID yo'q: guruh izoh + sana bo'yicha taniladi | Bir kunda ikki bir xil guruh ishi bitta deb sanaladi (sartirofka, o'chirish) |
| K4 | Ish turi "Sartirofka" kodda qattiq yozilgan | Nomi o'zgartirilsa yoki ruscha bo'lsa res tekshiruvi ishlamaydi |
| K5 | Yuk mashinasi summasi ishchiga "to'lov" bo'lib yoziladi, xarajatga kirmaydi | Ma'nosi noaniq: korxona xarajatimi yoki ishchiga avansmi |
| K6 | To'lovni tahrirlash/o'chirish yo'q, sanasi doim "hozir" | Xato to'lovni tuzatib bo'lmaydi, kechagi to'lovni yozib bo'lmaydi |
| K7 | Ishchini o'chirish faqat o'lik ekranda | Ishdan ketgan ishchi ro'yxatda qoladi |
| K8 | Terak o'chirilganda uning yuk chiqarishlari (daromad) o'chadi, ish haqi qoladi | Umumiy foyda buziladi |
| K9 | Terakdan material olib tashlansa qoldiq va narxlar yo'qoladi | Ombor qiymati jimgina kamayadi |
| K10 | Yuk chiqarish o'lcham zaxirasini kamaytirmaydi | O'lcham bo'yicha qoldiq faqat o'sadi |
| K11 | Haftalik grafik dona, qator va boshqa birliklarni qo'shib yuboradi | Grafik ma'nosiz bo'lishi mumkin |
| K12 | Zakaz tayyorligi har zakazga butun qoldiqni beradi | Ikki zakaz bir xil qoldiq bilan "tayyor" ko'rinadi |
| K13 | Ish tahrirlansa summa qo'lda o'zgaradi, material va ombor o'zgarmaydi | Summa narxdan farq qilishi mumkin |
| K14 | Umumiy `expenses` jadvali foydaga kirmaydi | Terakka tegishli bo'lmagan xarajat (ijara, svet) hisobsiz |
| K15 | Pul `REAL` (float), miqdor `REAL` | Yaxlitlash xatolari (`ε` bilan yamalgan) |
| K16 | Ma'lumot faqat bitta telefonda | Ikki kishi ishlay olmaydi; telefon yo'qolsa — faqat qo'lda olingan JSON zaxira |
| K17 | Kirish va rol yo'q | Telefonni olgan har kim hamma narsani ko'radi va o'chiradi |
| K18 | `perCube` hisoblash turi, `Terak.resCount`, `materials.unitVolumeM3` ishlatilmaydi | Ko'chirilmaydi |
| K19 | Material ishi turi (`'Material'` / `'Материал'`) va xarajat turi (`Tashish` / `Res olib kelish`) bazaga **interfeys tilidagi matn** bo'lib yoziladi; tahrirlash oynasi turni shu matn bilan taniydi | Til almashtirilsa eski yozuvlar "Boshqa" bo'lib ochiladi, hisobotda bir tur ikki nom bilan chiqadi |
| K20 | Zakaz tahrirlanganda `notifiedReady` va `notifiedDueSoon` bayroqlari tushib qoladi (`updateOrder` ularni ko'chirmaydi) | Tahrirdan keyin bir xil eslatma qayta keladi |
