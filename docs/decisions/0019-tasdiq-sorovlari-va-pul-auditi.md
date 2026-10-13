# 0019. edu-crm E3d: tasdiq so'rovlari va pul amallari tarixi

2026-10-13 · qabul qilingan · EDU-CRM-PLAN E3 (to'rtinchi qism), EDU-CRM-E3-DAVOMI "E3d", 14-qaror

## Vaziyat

Eski tizimda (cosmoslc) lavozimda har ruxsatga uchta holat beriladi: "Ruxsat", "Tasdiq bilan" yoki "Taqiq".
"Tasdiq bilan" amal brauzerdagi o'ramda to'xtatilib, `approval_requests` jadvaliga argumentlari bilan yozilar edi.
Direktor tasdiqlasa, o'sha funksiya uning brauzerida chaqirilar edi.

Ventura'da E1 dan beri faqat ikki holat bor edi (ADR 0010: "tasdiq oqimi — E3 da"). Pul amallari jurnalga yozilar edi,
lekin direktor ularni ko'radigan sahifa yo'q edi — eski tizimda ham bunday sahifa bo'lmagan.

## Qaror

### Ruxsat holatlari

- `positions.approvals` (0011 migratsiyasi) — lavozimdagi "tasdiq bilan" ruxsatlar.
- Xodimning ruxsatlari barcha lavozimlari bo'yicha birlashtiriladi:
  - **ruxsat** — `permissions` da bor;
  - **tasdiq bilan** — `approvals` da bor, `permissions` da yo'q (boshqa lavozimi to'liq ruxsat bergan bo'lsa, tasdiq
    kerak emas — eski tizimdagidek);
  - **taqiq** — ikkalasida ham yo'q.
- Tasdiq bilan bo'lmaydigan ruxsatlar (`isApprovable`, eski tizimdagidek):
  - ko'rish, eksport va chop etish ruxsatlari;
  - `dashboard.*`;
  - `settings.roles_permissions`, `settings.logs`, `staff.roles_assign`.
- Lavozimlar sahifasida har ruxsat uchun uchta tugma bor ("Taqiq / Tasdiq bilan / Ruxsat") va "Tasdiq bilan" filtri.
- Ruxsat oshirishga yo'l yo'q: direktor bo'lmagan xodim o'zida ruxsat ham, tasdiq ham bo'lmagan ruxsatni "tasdiq bilan"
  qila olmaydi.

### Oqim

1. `crmAction` boshida `permissionState` tekshiriladi:
   - ruxsat — amal bajariladi;
   - taqiq — rad etiladi;
   - tasdiq bilan — amal **bajarilmaydi**. `approval_requests` ga so'rov yoziladi (ruxsat, amal kaliti, sarlavha, qisqa
     mazmun, kirish). Natija `{ ok: false, pending: true }` qaytadi.
   - Forma bunday natijani xato deb ko'rsatmaydi: "Amal direktor tasdig'iga yuborildi" xabari chiqadi va forma yopiladi.
2. Amal ichidagi qo'shimcha tekshiruvlar (yozuv turi, o'tgan sana, o'qituvchini almashtirish) ham shu qoidaga bo'ysunadi
   (`ctx.requireAny`).
3. **Reyestr** (`lib/server/approval-registry.ts`) — kalit → server amali. Ro'yxatda 34 ta amal:
   - to'lovlar, chegirmalar, xarajatlar, toifalar, rejalar;
   - qo'shimcha daromad, ish haqi;
   - o'quvchi (saqlash, holat, o'chirish);
   - guruh va a'zolik;
   - davomat va xodimlar davomati.

   Sozlamalar, xodimlar va lavozimlar ro'yxatga kiritilmadi — ular "ruxsat" yoki "taqiq" bo'lib qoladi.
4. **So'rov sarlavhasi va mazmuni** yaratilganda kirishdan yig'iladi: o'quvchi, xodim yoki o'qituvchi nomi; guruh;
   toifa; summa; oy; sana; holat; sabab va izoh. Kirishda filial bo'sh bo'lsa, so'rovchining tanlangan filiali yoziladi
   — direktor boshqa filialni tanlagan bo'lsa ham amal to'g'ri filialga tushadi.
5. **Direktor tasdiqlasa:**
   - holat "kutilmoqda" sharti bilan "tasdiqlandi" ga o'tadi — ikki marta bajarilmaydi;
   - reyestrdagi amal saqlangan kirish bilan direktor sessiyasida chaqiriladi. Ruxsat, filial, Zod, qulf va jurnal
     oddiy chaqiruvdagidek ishlaydi;
   - amal bajarilmasa so'rov "kutilmoqda" ga qaytadi va sababi (`last_error`) ko'rsatiladi.
6. **Rad etish** — sabab bilan (ixtiyoriy).
7. **Bekor qilish** — faqat so'rovchining o'zi, kutilayotgan so'rovni.

### Ko'rinish

- **`/approvals`** (bo'lim emas, har mijozda ishlaydi):
  - direktor uchun "Tasdiqlar": barcha so'rovlar;
  - "tasdiq bilan" ruxsati bor xodim uchun "So'rovlarim": faqat o'zinikilar;
  - tablar: "Kutilmoqda (n)" va "Tarix"; qidiruv.
- **Menyu:** bosh sahifa ostida "Tasdiqlar (n)" yoki "So'rovlarim (n)", kutilayotganlar soni bilan.
- **Pul amallari tarixi** (`/money-audit`, faqat direktor, "To'lovlar" bo'limi bilan):
  - manba — faoliyat jurnali (xesh zanjiri, ADR 0002): to'lov, chegirma, xarajat va reja, qo'shimcha daromad, ish haqi,
    tasdiq yozuvlari;
  - filtrlar: sana oralig'i, amal turi, xodim, qidiruv;
  - ustunlar: vaqt, xodim, amal, tafsilot, summa.

### Jurnal

- `approval.request` (xodim nomidan) va `approval.approve`, `approval.reject`, `approval.fail`, `approval.cancel`.
- Tasdiqlangan amalning o'zi o'z nomi bilan (masalan `payment.create`) direktor nomidan yoziladi.

### Sinov

- `packages/auth` (Vitest):
  - qaysi ruxsatlar tasdiq bilan bo'la oladi;
  - to'liq ruxsat tasdiqdan ustun turadi;
  - `permissionState`.
- Haqiqiy PostgreSQL (`approvals.db.test.ts`, CI):
  - sarlavha va mazmun kirishdan yig'iladi;
  - filial so'rovchining tanlovidan to'ldiriladi;
  - ro'yxat va menyudagi son to'g'ri;
  - CHECK himoyasi: tasdiqlangan so'rovda kim va qachon majburiy;
  - boshqa mijoz ma'lumoti ko'rinmaydi.

## Oqibatlari

- Yangi o'zgartiruvchi amal "tasdiq bilan" bo'lishi uchun:
  - reyestrga qo'shiladi;
  - `crmAction` ga `{ approval: { action, input } }` beriladi;
  - `uz.approvals.actions` da nomi yoziladi.
- Eski tizimdagi "tasdiq kutayotgan xarajatlar" (`finance.status = pending`) alohida oqim emas — xarajat ham shu umumiy
  tasdiq orqali o'tadi.
