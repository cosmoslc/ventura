# 0037. edu-crm: faoliyat jurnali ko'rinishi va xodimlarni arxivdan tiklash

2026-10-15 · qabul qilingan · E6c, E6e · ADR 0002 va 0019 davomi

## Vaziyat

Jurnal (`audit_events`, xesh zanjiri, ADR 0002) yozilib kelinardi, lekin uni o'qiydigan umumiy sahifa yo'q edi: faqat
pul amallari tarixi (ADR 0019) bor. Eski CRM'da "Amallar tarixi" va "Xodimlar faolligi" hisoboti ("tez kunda") bor edi.
Arxivda esa bo'shatilgan xodimlarni tiklashning yo'li yo'q edi.

## Qaror

- **`/activity` — "Faoliyat jurnali".** Ruxsat `settings.logs` (direktor va shu ruxsatli lavozim), `lib/access.ts`
  ro'yxatida. Filtrlar: sana oralig'i (standart so'nggi 7 kun, ko'pi bilan 1 yil), xodim, bo'lim, qidiruv
  (xodim nomi, amal kaliti, metadata matni). Sahifalash sahifa raqami bo'yicha, 50 tadan. Qator bosilsa tafsilot:
  yozuv raqami, amal kaliti, IP, qurilma va metadata. `/money-audit` o'z joyida qoladi.
- **Reyestr `lib/activity-log.ts`.** Amal kaliti → bo'lim + o'zbekcha jumla ("Aziz Karimov to'lov qabul qildi: 300 000 so'm —
  Ali Valiyev"). Nishon nomi (o'quvchi, guruh va h.k.) metadata'da bo'lmasa, sahifadagi yozuvlar uchun bazadan olinadi.
  Reyestrda yo'q kalit "«kalit» amalini bajardi" bo'lib chiqadi — yozuv yo'qolmaydi.
  `lib/activity-log.test.ts` kodni (`ctx.audit`, `tenantAudit.record`, `packages/auth/src/staff`) o'qib, uchragan
  har kalit reyestrda borligini va reyestrda ishlatilmaydigan o'lik kalit yo'qligini tekshiradi. Shablonli kalitlar
  (`group.${action}`, `import.${table}`...) testdagi `TEMPLATES` ro'yxatida; yangisi qo'shilsa test yiqiladi.
  **Qoida: yangi audit kaliti qo'shgan paket uni reyestrga ham qo'shadi.**
- **Aks yozuvlar.** `group.enroll` va `student.enroll` bitta amalning ikki tomoni (guruh va o'quvchi tarixi uchun).
  Umumiy jurnalda ikki marta chiqmasligi uchun `student.enroll/leave/activate/pause/unpause` ro'yxat va sanashdan
  chiqarilgan (`MIRROR_ACTIONS`); zanjirda ular saqlanadi.
- **Tafsilotda sir yo'q.** Kalit nomi `parol`, `token`, `secret`, `otp`, `kod`, `hash`, `api key` ni o'z ichiga olsa
  qiymat `•••` bilan almashtiriladi (ichma-ich obyektda ham). Yozishda ham sir metadata'ga tushmaydi (ADR 0002).
- **Butunlik tekshiruvi.** Sahifa tepasida "Tekshirish" tugmasi `tenantAudit.verify` ni ishga tushiradi va natijani
  ko'rsatadi. Butun zanjirni o'qigani uchun sahifa ochilganda o'zi ishlamaydi.
- **Xodimlar faolligi.** Eski hisobot hisobotlar hubiga qo'shilmadi (u ruxsat va guruhlari o'qituvchi/moliya/lid
  bo'yicha): `/activity` da "Xodimlar bo'yicha" tabi — davr uchun har xodimning amallar soni va bo'limlar bo'yicha
  taqsimoti; qator bosilsa jurnal shu xodim filtri bilan ochiladi. `/staff/[id]` kartochkasida ham "Faoliyat" havolasi
  (`settings.logs` ruxsati bo'lsa).
- **Migratsiya yo'q.** `(tenant_id, seq)` va nishon indekslari bor; xodim filtri hozirgi hajmda yetarli. Jurnal
  millionlab yozuvga yetsa `(actor_id, seq)` indeksi alohida migratsiya bilan qo'shiladi.
- **Arxiv: "Xodimlar" tabi (E6e).** Bo'shatilgan xodimlar (`users.archivedAt`), kim va qachon (kim — jurnaldagi oxirgi
  `staff.archive` yozuvidan). "Tiklash" `archive.restore` ruxsati bilan, qo'shimcha `staff.delete` (bo'shatish
  bilan bir xil) va o'zidan kuchli xodimni tiklab bo'lmaydi qoidasi (`manageable`). Lavozim va filiallar saqlangan,
  shuning uchun faqat `archivedAt` bo'shatiladi; telefon `users` da yagona bo'lgani uchun band bo'lib qolmaydi.
  Jurnal `staff.restore`, direktorlarga Telegram xabari (bo'shatishdagidek). Parol avtomatik yangilanmaydi — kerak
  bo'lsa `/staff` dagi "Parolni tiklash" ishlatiladi. Butunlay o'chirish xodim uchun yo'q (tarix saqlanadi).

## Oqibatlari

- Jurnalga yozishda tekshiruv o'zgarmadi; ko'rish — faqat `settings.logs` ruxsati bilan.
- Reyestrni yangilash — har yangi audit kaliti bilan majburiy (test ushlaydi).
- Ro'yxat sahifalashi sahifa raqami bo'yicha; yozuvlar juda tez qo'shilsa sahifalar orasida siljish bo'lishi mumkin.
