# 0066. edu-crm: Xotira nazorati (/storage), Control Panel limiti va fayllarni tozalash

2026-10-22 · qabul qilingan · ADR 0051, 0061, 0063, 0065  
**Muallif / Agent:** Google Gemini

## Vaziyat

Uy vazifalari, dars materiallari va o'quvchilar javoblari sifatida ko'p miqdorda fayllar (rasm, PDF, zip) yuklanishi natijasida server disk xotirasi to'lib boradi. Har bir o'quv markazi uchun boshqaruv panelida disk xotirasi limiti belgilanishi, markaz rahbari o'z kabinetida ishlatilgan hajm va limitni ko'rib turishi, shuningdek, muddat o'tgan eski fayllarni (1 oy, 3 oy, 4 oy, 6 oy oldingi) oson tozalash mexanizmi zarur edi.

## Qaror

### 1. Boshqaruv paneli (Control Panel) limiti
- Boshqaruv panelida (`apps/panel`) har bir loyiha sozlamalarida `storageLimitGb` parametri joriy qilindi (standart: `5 GB`).
- Bu ko'rsatkich deploy paytida `tenants.json` ro'yxatiga `storageLimitMb` ko'rinishida yoziladi va markazga yetkaziladi.
- Yangi fayl yuklanayotganda (`POST /api/uploads`) markazning joriy ishlatilgan hajmi tekshiriladi; agar limitdan oshib ketayotgan bo'lsa, xatolik qaytariladi.

### 2. Xotira va fayllar sahifasi (`/storage`)
- Sozlamalar navbariga `storage` (`HardDrive` belgisi) bandi qo'shildi.
- **Ko'rsatkichlar:**
  - Ishlatilgan hajm va umumiy limit (`usedMb / limitMb`);
  - Rangli progress bar (xavfsiz, ogohlantiruvchi, kritik xavf);
  - Bo'sh joy va to'lganlik foizi;
  - Bo'limlar kesimidagi statistika (O'qituvchi materiallari, O'quvchi javoblari, Boshqa fayllar).

### 3. Xotirani tozalash (Cleanup) imkoniyatlari
- Muddat bo'yicha tezkor tozalash tugmalari:
  - 1 oydan eski fayllar (30 kun oldingi);
  - 3 oydan eski fayllar (90 kun oldingi);
  - 4 oydan eski fayllar (120 kun oldingi);
  - 6 oydan eski fayllar (180 kun oldingi);
  - Faqat o'quvchi javoblari (dars konspektlarini saqlab qolgan holda);
  - Bog'lanmagan (yetim) fayllar.
- **Xavfsiz tasdiqlash (Estimate modal):** Har qanday tozalash amali oldidan server diskidan qancha fayl o'chirilishi va qancha MB bo'shashi real vaqtda hisoblab ko'rsatiladi va tasdiqlangach amalga oshiriladi.
- Tozalash paytida fizik fayllar diskdan o'chiriladi, bazadagi bog'lamalar tozalab chiqiladi va audit jurnaliga (`storage.cleanup`, `storage.file_delete`) yoziladi.

### 4. Fayllar ro'yxati (Explorer)
- Barcha saqlanayotgan fayllar ro'yxati (fayl formati, nomi, manbasi, hajmi, yuklangan vaqti);
- Kategoriya bo'yicha filtrlar va qidiruv;
- Har bir faylni to'g'ridan-to'g'ri ko'rish/yuklab olish yoki alohida o'chirish imkoniyati.
