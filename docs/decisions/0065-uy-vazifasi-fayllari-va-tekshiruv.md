# 0065. edu-crm: Uy vazifasi fayllari, javoblar (submissions) va o'qituvchi tekshiruvi

2026-10-22 · qabul qilingan · ADR 0061, 0062, 0063  
**Muallif / Agent:** Google Gemini

## Vaziyat

Dars jarayonida o'qituvchilar darsliklar, qo'shimcha mashqlar, konspektlar va audio/video materiallarni fayl (PDF, rasm, word, zip) ko'rinishida biriktirishlari, o'quvchilar esa bajargan vazifalarining natijasini (daftardan rasm, kod arxivlari, esse) reply tariqasida tizimga yuborishlari zarur edi. Shuningdek, o'qituvchi topshirilgan har bir o'quvchi javobini ko'rib chiqib, unga baho qo'yishi, izoh yozishi va qabul qilingan/qaytarilgan holatini belgilashi kerak edi.

## Qaror

### 1. Baza sxemasi va migratsiya (`0033_homework_attachments_and_submissions.sql`)
- `group_homeworks` jadvaliga `attachments jsonb default '[]'::jsonb not null` ustuni qo'shildi (`HomeworkAttachment[]`).
- Yangi `homework_submissions` jadvali yaratildi:
  - `id`, `tenant_id`, `homework_id`, `student_id`, `text`, `attachments`, `status` (`submitted`, `accepted`, `rejected`), `grade`, `feedback`, `checked_at`, `checked_by`.
  - Composite xavfsizlik: `tenant_id` va `id` orqali RLS tenant isolation siyosati, `(tenant_id, homework_id, student_id)` unikal cheklovi.

### 2. Xavfsiz fayl yuklash xizmati (`/api/uploads`)
- Multipart forma orqali fayl yuklash (har bir fayl 25MB gacha).
- Serverda xavfsiz fayl nomi yaratish (sanitizatsiya, traversal himoyasi).
- Fayllar serverning relizlar almashganda o'chmaydigan doimiy jildi (`/home/deploy/apps/edu-crm/shared/uploads/`) da saqlanadi.
- Streaming GET endpoint (`/api/uploads/[...file]`) to'g'ri mime-type va kesh sarlavhalari bilan kontentni uzatadi.

### 3. O'quvchi javoblari va qayta topshirish
- O'quvchi portalida (`/portal/uy-ishi`) berilgan har bir vazifa uchun alohida javob topshirish dialogi.
- O'quvchi matnli izoh va fayllar biriktirib topshiradi.
- Holat o'quvchiga darhol ko'rinadi: `Kutilmoqda`, `Qabul qilindi (baho bilan)` yoki `Qaytarildi (o'qituvchi izohi bilan)`.

### 4. O'qituvchi tekshiruvi va baholar sinxronizatsiyasi
- O'qituvchi kabinetida (`/kabinet/uy-ishi` va `/kabinet/guruhlar/[id]` uy ishi tabi) har bir vazifa kartasida `Javoblar (X/Y)` tugmasi chiqadi.
- Modal oynada barcha o'quvchilar javoblari ro'yxati, yuborilgan fayllar, yuklab olish tugmasi, baho qo'yish (1–100 yoki 1–5) va o'qituvchi fikri formasi.
- Baholanganda baho dars jurnali (`lesson_grades`) bilan sinxronlanadi va o'quvchi hamda ota-onaga Telegram orqali xabar boradi.
