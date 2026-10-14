# 0026. edu-crm: tashqi ariza sahifasi va lidlar Exceli (E4c)

2026-10-14 · qabul qilingan · docs/EDU-CRM-E4.md (qarorlar 2 va 6, Saidakbar tasdiqlagan), E4c

## Vaziyat

Eski tizimda "Lid formasi" quruvchisi havola va iframe kodini berardi, lekin `/apply-form` sahifasi yozilmagan edi —
havola ishlamasdi. Lidlarni Excel orqali olib kirish yoki chiqarish ham yo'q edi.

## Qaror

### Ariza sahifasi `/ariza`

- **Kirishsiz** ochiladi (proxy'dagi ochiq yo'llar ro'yxatida). Mijoz domen bo'yicha aniqlanadi. "Lidlar" bo'limi
  o'chirilgan markazda — 404.
- **Sozlama** `settings` jadvalida (`leads.apply_form`), lidlar sahifasidagi "Sozlamalar → Ariza sahifasi" oynasida
  (`leads.edit`):
  - yoqilganmi — standart holatda **o'chirilgan**, markaz o'zi yoqadi;
  - sarlavha, qisqa matn, yuborilgandan keyingi matn;
  - arizalar tushadigan filial; "filialni ariza beruvchi tanlasin" belgisi;
  - kurs so'ralsinmi;
  - "Lid formasi"dagi qaysi qo'shimcha maydonlar ko'rinsin. Guruh tanlash maydoni ochiq sahifada ko'rsatilmaydi.
- Oynada havola va iframe kodi bor, ikkalasi nusxalanadi. `?embed=1` — iframe ko'rinishi: logotip va fon yo'q, fon
  saytniki bo'lib qoladi.
- **Ariza qayerga tushadi:**
  - filial: ariza beruvchi tanlagani (ruxsat bo'lsa), aks holda sozlamadagi, u ham bo'lmasa birinchi faol filial;
  - lid "Veb-sayt forma" manbasi bilan birinchi ish ustuniga tushadi;
  - tarixga va jurnalga `lead.apply` yoziladi; muallif — tizim ("Veb-sayt forma"), IP bilan;
  - boshqa filialning kursi tanlansa, kurs yozilmaydi.
- **Shu telefonli ochiq lid bo'lsa** (E4 qarori 2) yangi lid yaratilmaydi: o'sha lidga "Saytdan qayta ariza: ..."
  izohi qo'shiladi (ism, kurs, maydonlar).

### Spamdan himoya

| Qatlam | Qanday |
| --- | --- |
| IP bo'yicha | bir IP'dan 10 daqiqada 3 ta ariza. IP — nginx yozadigan `X-Real-IP` (`X-Forwarded-For` ning birinchi qiymatini mijoz o'zi yuborishi mumkin) |
| Markaz bo'yicha | soatiga 60 ta ariza — ko'p IP'dan kelgan oqim ham cheklanadi |
| Tuzoq maydon | ekrandan tashqaridagi "website" maydoni; to'ldirilsa — bot |
| Vaqt belgisi | sahifa ochilgan vaqt mijoz siri bilan imzolanadi (HMAC). 3 soniyadan tez yuborilsa — bot; belgi 7 kundan eski yoki soxta bo'lsa — "sahifani yangilang" |
| Telefon | 9 ta raqam, ochiq-oydin soxtasi emas (hammasi bir xil raqam, kod va nollar, 123456789). Operator kodlari ro'yxati bilan cheklanmaydi — yangi kod chiqsa haqiqiy ariza yo'qolmasin |

Tuzoq va juda tez yuborishda botga "qabul qilindi" deb javob beriladi — u nimani noto'g'ri qilganini bilmaydi.
Chegaralar jarayon xotirasida: ilova qayta ishga tushsa hisob nolga tushadi. Bu himoyaning bir qatlami, yolg'iz emas.

### Ramkada ochish (clickjacking)

Proxy endi `/ariza` dan boshqa hamma sahifaga `X-Frame-Options: DENY` va `Content-Security-Policy: frame-ancestors
'none'` qo'shadi. Ilgari CRM sahifalarini istalgan sayt ramkaga solishi mumkin edi.

### Lidlar Exceli

Umumiy Excel tizimiga (ADR 0013) `leads` jadvali qo'shildi. Ruxsat — `leads.import_export`; Excel tugmasi faqat shu
ruxsat bilan ko'rinadi.

- **Eksport:** asosiy maydonlar, bosqich, mas'ul, qo'shilgan sana va qo'shimcha maydonlar. Sarlavhalar import
  qoliplariga tushadi — eksport qilingan fayl qayta import qilinadi.
- **Namuna shablon** ham bor.
- **Import:** ism, telefon, qo'shimcha telefon, jins, manba, kurs, keyingi aloqa sanasi, izoh.
  - shu telefonli ochiq lid bo'lsa yoki telefon faylda takrorlansa — qator rad etiladi;
  - kurs nomi aniq topilmasa (yoki boshqa filialniki bo'lsa) — rad etiladi;
  - lidlar birinchi ish ustuniga tushadi, tarix import qilgan xodim nomidan yoziladi;
  - hamma to'g'ri qator bitta tranzaksiyada yoziladi.

### Lidlar sahifasi

Sarlavhadagi uchta tugma ("Ustunlar", "Lid formasi", "Sabablar") va yangi "Ariza sahifasi" bitta "Sozlamalar"
menyusiga yig'ildi. Yonida Excel tugmasi.

## Sinov

- **Vitest:**
  - sozlama standarti va buzilgan qiymat;
  - iframe kodida HTML belgilari yo'q;
  - telefon tekshiruvi;
  - so'rovlar chegarasi: oyna, alohida kalitlar, rad etilgan urinish hisoblanmaydi;
  - vaqt belgisi: to'g'ri, juda tez, eskirgan, boshqa markaz yoki sir, o'zgartirilgan vaqt;
  - lid eksport sarlavhalarini qayta aniqlash, jins yozuvlari.
- **Haqiqiy PostgreSQL:**
  - yangi lid: ustun, manba, tarix, jurnal, tanlanmagan maydon yozilmaydi;
  - qayta ariza izohga aylanadi;
  - majburiy maydon;
  - filial va kurs tanlovi;
  - boshqa mijoz ko'rmaydi;
  - import: ochiq lid telefoni va takror rad, to'g'ri qator tarix bilan yoziladi.

## Oqibatlari

- Saytdan kelgan ariza haqida xodimga xabar (Telegram) hali yo'q — lid doskada paydo bo'ladi. Bildirishnomalar —
  E6.
- Ariza sahifasi ko'rinishi markaz brendidan (asosiy rang va logotip) oladi.
- Lid analitikasi (manba bo'yicha, shu jumladan "Veb-sayt forma") — E5.
