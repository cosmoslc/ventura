# 0012. edu-crm E1d: guruhlar va a'zolik davrlari

2026-10-12 · qabul qilingan · EDU-CRM-PLAN E1 (to'rtinchi qism)

## Vaziyat

Eski tizimda (cosmoslc) a'zolik ikki joyda edi: o'quvchi kartochkasidagi JSON xarita (`group_memberships`,
`group_ids`) va alohida `membership_periods` jadvali. Ular ajralib qolar edi: guruhdan chiqarishning ba'zi yo'llari
davrni yopmas edi, guruh o'chirilganda o'quvchida o'lik id qolar edi, to'lov va davomat esa kaskad bilan o'char edi.
O'quvchini muzlatish to'lov hisobini to'xtatmas edi. Guruh profilida "90 daqiqa", "Haftada 3 kun", "Faol guruh"
qattiq yozilgan; `billingMode` formada bor, lekin saqlanmas edi; xona va o'qituvchi bandligi tekshirilmas edi.

## Qaror

### Ma'lumot

- `groups`: filial, kurs, o'qituvchi, xona (hammasi kompozit FK), nom, oylik narx, davomiylik, dars kunlari
  (`mon..sun`), boshlanish/tugash vaqti, boshlanish sanasi, rang, izoh va o'qituvchi maoshining guruhdagi o'zgacha
  sozlamasi (null — o'qituvchining o'z sozlamasi). Kurs guruh ochilgandan keyin o'zgarmaydi (eski tizimdagidek).
- `group_memberships` — **yagona manba**: har qatori bitta a'zolik davri. Holat: sinovda → faol → muzlatilgan;
  chiqqanda davr yopiladi (`left_at`, sabab). Qayta qo'shilsa yangi davr. Bir o'quvchi bir guruhda bir vaqtda
  bitta ochiq davrga ega (qisman noyob indeks). Bazadagi CHECKlar holat va sanalarni mos ushlaydi.
- Guruh **o'chirilmaydi, arxivlanadi**: a'zoliklar shu kun bilan yopiladi, tarix (keyin to'lov va davomat) qoladi.
  Kursi, o'qituvchisi yoki filiali faol guruhga bog'langan bo'lsa ular arxivlanmaydi/o'chmaydi; xona o'chsa guruh
  xonasiz qoladi.

### Oqimlar (eski tizimdagidek)

- Guruhga qo'shish — sinovda (to'lov yo'q). "Faollashtirish" — sana bilan (oy boshidan bo'lishi mumkin): to'lov
  shu kundan (E3); sinovdagi o'quvchi faolga o'tadi.
- Muzlatish va muzlatishdan chiqarish — guruh bo'yicha (`students.freeze`); asl faollashtirish sanasi saqlanadi
  (eski tizim uni bugunga almashtirar edi).
- Guruhdan chiqarish — sana va sabab bilan. Qarz tekshiruvi va pul qaytarish (eski "Tark etish" oynasi) — E3.
- **O'quvchi holati a'zoliklar bilan birga o'zgaradi:** muzlatilgan → faol a'zoliklar muzlatiladi; qayta faol →
  muzlatilganlari tiklanadi; ketgan/bitirgan yoki arxiv → ochiq davrlar yopiladi.
- Yangi: xona yoki o'qituvchi shu kunlarda shu vaqtda boshqa guruhda band bo'lsa, guruh saqlanmaydi.

### Ko'rinish

- Guruhlar: kartalar (kurs, o'qituvchi, xona, kunlar va vaqt, o'quvchilar / sig'im, narx), qidiruv, kurs va
  toq/juft kun filtri. Statistika: guruhlar, o'quvchilar (takrorsiz — eski tizim ikki guruhdagini ikki marta
  sanar edi), sinovdagilar, bo'sh o'rinlar. Daromad kartalari — E3.
- Guruh profili: haqiqiy dars davomiyligi va haftadagi kunlar, o'quvchilar jadvali (holat, ota-ona, qo'shilgan
  sana, amallar), "Chiqqanlar" tabi, mavjud yoki yangi o'quvchini qo'shish. Davomat jadvali — E2.
- O'quvchi profilidagi "Guruhlar" tabi va ro'yxatdagi "Guruhi / O'qituvchi" ustuni, guruh va o'qituvchi filtrlari;
  kurslar, xonalar va o'qituvchilar sahifalaridagi guruh va o'quvchi sonlari endi haqiqiy.
- Arxivga "Guruhlar" tabi qo'shildi (tiklash — kursi va o'qituvchisi faol bo'lsa).

## Oqibatlari

- E2 (davomat) va E3 (to'lov, qarz, maosh) `group_memberships` davrlariga tayanadi: hisob `activated_at`,
  `paused_at` va `left_at` sanalaridan.
