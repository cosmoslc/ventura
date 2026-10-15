# 0039. edu-crm: ichki bildirishnomalar va global qidiruv

2026-10-15 · qabul qilingan · E6d va E6h paketlari, ADR 0019 (tasdiqlar) va 0026 (tashqi ariza) davomi

## Vaziyat

Eski CRM'da qo'ng'iroq xotiradagi toast jurnali edi: sahifa yangilansa yo'qolardi. Yangi tizimda bildirishnoma umuman
yo'q edi; ADR 0026 saytdan kelgan ariza haqida xabarni E6 ga qoldirgan. Yuqori paneldagi "Qidirish… Ctrl K" maydoni
chizilgan, lekin hech narsa qilmasdi.

## Qaror

### Bildirishnomalar (E6d)

- **Faqat ilova ichida.** Telegram yuborish yo'q. Toast (`@ventura/ui/toast`) bildirishnoma emas, u qoladi va
  jurnalga yozilmaydi (eskidek "har toast jurnalga" takrorlanmaydi).
- **Jadval `notifications`** (migratsiya `0019_e6_notifications.sql`): `user_id` (qabul qiluvchi), `kind`, `title`,
  `body`, `href`, `created_at`, `read_at`. `tenant_id`, RLS (FORCE) va mijoz bo'yicha tashqi kalit. CHECK: sarlavha
  1–200, matn ≤ 500, `href` ichki manzil (`/` bilan boshlanadi). Indekslar: `(user_id, created_at desc)` va
  o'qilmaganlar uchun qisman `(user_id) where read_at is null`.
- **Qabul qiluvchi yozilganda aniqlanadi** (`lib/server/notify.ts`): `staffWithPermission(db, ruxsatlar, filial)` —
  direktorlar (hamma filial) va lavozimida ruxsatlardan biri bor, shu filialga biriktirilgan xodimlar. Bo'shatilgan
  (arxivdagi) xodim hech qachon olmaydi. `notify(db, qabulQiluvchilar, {kind, title, body, href}, except)` takror va
  amalni o'zi qilgan xodimni olib tashlaydi; yozilmasa xato faqat logga, asosiy amal to'xtamaydi.
- **O'qish faqat o'zinikini** — har so'rov `user_id` bo'yicha cheklanadi (RLS faqat mijozni ajratadi). Boshqa xodimning
  bildirishnomasini o'qilgan qilib bo'lmaydi.
- **Manbalar:**
  | Hodisa | Kimga |
  | --- | --- |
  | Saytdan yangi ariza (`lib/server/apply.ts`) | lid filialida `leads.view` ruxsati bor xodimlar va direktorlar |
  | Saytdan qayta ariza (ochiq lidga izoh) | lidning mas'uli, bo'lmasa yuqoridagilar |
  | Tasdiq so'rovi yaratildi (`createApprovalRequest`) | direktorlar |
  | Tasdiq hal qilindi (tasdiqlandi yoki rad etildi) | so'rov egasi |
  | Lid biriktirildi (lid formasi yoki tanlab biriktirish) | yangi mas'ul; allaqachon shu xodimda bo'lgan lidga yuborilmaydi |
- **Ko'rinish.** Yuqori panelda qo'ng'iroq (`notifications/notification-bell.tsx`, `crm-shell.tsx` ichida): o'qilmagan
  soni, ochilganda oxirgi 10 ta, "Hammasini o'qilgan qilish" va "Barchasi" → `/notifications` (hammasi / o'qilmagan,
  bittasini yoki hammasini o'qilgan qilish). Sahifa bo'lim emas (manifestda yo'q): har xodimga ochiq, faqat o'zinikini
  ko'radi.
- **Yangilanish: so'rov (polling).** O'qilmaganlar soni har 60 soniyada server amali bilan so'raladi (tab ko'rinib
  turgandagina); websocket yo'q. Boshlang'ich son layout'dan keladi, tasdiqdan keyin `revalidatePath` bilan yangilanadi.
- **Matnlar yozilganda tayyorlanadi** (`lib/notifications.ts`), keyin yozuv o'zgarsa ham xabar o'zgarmaydi.

### Global qidiruv va tezkor amallar (E6h)

- **Ctrl/Cmd+K** yoki yuqori paneldagi maydon (tor ekranda ikonka) buyruqlar oynasini ochadi
  (`packages/ui/src/components/command-palette.tsx`: ↑ ↓, Enter, Esc, tegish). `Topbar` ga ixtiyoriy `onSearchOpen`
  qo'shildi: berilsa maydon tugmaga aylanadi, berilmasa (panel ilovasi) eskicha matn maydoni — orqaga moslik saqlangan.
- **Server amali** `globalSearchAction` (`app/(crm)/search/actions.ts`): o'quvchi, lid, guruh, o'qituvchi, xodim; ism
  yoki telefon (raqamlar ajratiladi, `+998 90 123` ham mos), har turdan ko'pi bilan 5 ta, arxivdagilar chiqmaydi.
  Tur faqat bo'lim yoqilgan va xodimda shu sahifani ochadigan ruxsat bo'lsa (`PAGE_ACCESS`) qidiriladi; filial doirasi
  — `getBranchContext().filter` (tanlangan filial va xodimning cheklovi). Xodimlar bo'yicha filial `user_branches`
  orqali. So'rov 250 ms to'xtagach ketadi, eskirgan javob e'tiborga olinmaydi; `%` va `_` oddiy belgi.
- **Tezkor amallar:** "Yangi o'quvchi", "Yangi lid", "To'lov qabul qilish" — ruxsat va bo'lim yoqilganiga qarab
  layout'da hisoblanadi. Mavjud forma/oynalarni ochadi: sahifa `?yangi=1` bilan ochiladi (`use-quick-open.ts`),
  parametr manzildan olib tashlanadi.

## Oqibatlari

- Migratsiya `0019` mijoz bazalarida qo'llanishi kerak (panel deploy'da avtomatik). Qo'llanmaguncha qo'ng'iroq 0
  ko'rsatadi va yozish xatosi faqat logga tushadi (markaz sahifalari ochilaveradi), lekin bildirishnomalar ishlamaydi.
- Bildirishnomalar tozalanmaydi (eskilari o'chirilmaydi); hajm oshsa — eski o'qilganlarni arxivlash alohida ish.
- Telegram bildirishnomalari (xodim yoqadi/o'chiradi), "yangi qurilmadan kirish" va "bugungi o'tgan keyingi aloqa"
  manbalari keyinga qoldirildi; yangi manba — `notify()` chaqiruvi va `NOTIFICATION_KINDS` ga tur qo'shish.
- Qidiruv telefon bo'yicha `ilike %raqam%` ishlatadi; katta bazada (yuz minglab qator) trigram indeksi kerak bo'lishi
  mumkin.
- DB testlari: `lib/server/notify.db.test.ts` (qabul qiluvchilar, RLS, filial doirasi, qidiruv); toza mantiq —
  `lib/notifications.test.ts`, `lib/search.test.ts`.
