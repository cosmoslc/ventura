# 0063. edu-crm: o'quvchilar kabineti (Student Portal)

2026-10-22 · qabul qilingan · ADR 0010, 0011, 0014, 0015, 0061, 0062  
**Muallif / Agent:** Google Gemini

## Vaziyat

Egasi va markaz talablariga ko'ra o'quvchilar uchun alohida shaxsiy kabinet (Student Portal) kerak. O'quvchi o'z telefon raqami va paroli bilan tizimga kiradi va faqat o'ziga tegishli ta'limiy va moliyaviy ma'lumotlarni ko'radi.

Hozirgi holat:
- O'quvchilar tizimga kira olmaydi (EDU-CRM-PLAN 1-qaror: birinchi versiyaga kirmagan edi). `students` jadvalida kirish uchun `user_id` mavjud emas.
- O'qituvchi kabineti (ADR 0062) allaqachon muvaffaqiyatli ishga tushirilgan: `users.kind` va Better Auth orqali tizimga kirish tajribasi mavjud.
- Davomat, baholar, to'lovlar, guruh a'zoligi va coinlar tayyor (`attendance`, `lesson_grades`, `payments`, `group_students`, `coin_entries`).
- Biroq o'qituvchi tomonidan guruhga topshiriladigan uy vazifalari (vazifa matni, muddati) uchun alohida jadval yo'q edi (faqat dars baholashdagi `homework: boolean` belgisi bor).

## Qaror

### 1. Alohida app emas, edu-crm ichida

O'quvchilar portali alohida ilova emas, balki `apps/edu-crm` ichida, o'z route group'i va layout'i bilan quriladi: `app/(portal)/portal/...`.
Baza, PostgreSQL RLS, Better Auth sessiyalari va audit yagona saqlanadi. Deploy va infratuzilmaga qo'shimcha yuk tushmaydi.

### 2. O'quvchi hisobi va Kirish (Auth)

- `users.kind`: `staff` (admin CRM), `teacher` (o'qituvchi kabineti) va endi **`student`** (o'quvchi portali).
- `students.user_id` (ixtiyoriy, noyob, `users.id` ga FK) — o'quvchini kirish hisobiga bog'laydi.
- **Kirish usuli:** O'quvchi telefon raqami (`students.phone`) va parol bilan kiradi.
- **2FA:** Birinchi marta kirishda bot 2FA **talab qilinmaydi** (`twoFactorEnabled: false`). O'quvchi xohlasa keyinchalik o'z sozlamalaridan Telegram 2FA'ni yoqib olishi mumkin.
- **Parol berish:**
  - Admin yangi o'quvchi yaratayotganda (`/students/new`) formada "Parol" degan ixtiyoriy input bo'ladi. Kiritilsa, Better Auth orqali bir yo'la hisob yaratiladi.
  - O'qituvchi kabinetida ham o'z guruhidagi o'quvchiga parol o'rnatish va berish imkoni bo'ladi.
  - Mavjud o'quvchi profilida (admin va o'qituvchida) "Kirish berish", "Parolni yangilash" va "Kirishni o'chirish" amallari bo'ladi.
- **Ruxsatlar va himoya:**
  - `student` hisobi admin CRM (`/students`, `/finances` va h.k.) yoki o'qituvchi kabinetiga (`/kabinet`) kira olmaydi. Ularga murojaat qilganda to'g'ridan-to'g'ri `/portal` ga yo'naltiriladi.
  - Admin yoki o'qituvchi `/portal` ga kirishga urinsa, o'zining tegishli ish joyiga (CRM bosh sahifasi yoki `/kabinet`) yo'naltiriladi.

### 3. Uy vazifalari (Homework) jadvali

Guruh darslari uchun o'qituvchi topshiradigan uy vazifalari uchun yangi `group_homeworks` jadvali yaratiladi:
- `id`, `tenant_id`, `group_id`, `lesson_date`, `title`, `description`, `due_date`, `created_by` (o'qituvchi user_id).
- O'qituvchi guruh sahifasidan dars uchun vazifa qoldiradi; o'quvchi esa o'z kabinetida barcha uy vazifalarini ko'rib boradi.

### 4. O'quvchi kabineti sahifalari

| Sahifa | Manzil | Tarkibi va imkoniyatlari |
|---|---|---|
| Bosh sahifa | `/portal` | **Balans** (ortiqcha / qarz, to'lov holati), **Reyting** (coinlar va ballar bo'yicha markaz va guruhdagi o'rni), **Davomat statistikasi** (qatnashish foizi), **Baholar statistikasi** (o'rtacha baho, uy vazifasi bajarish ko'rsatkichi), **Bugungi darslar** (bugungi dars vaqti, xona, o'qituvchi) |
| Guruhlarim | `/portal/guruhlar` | O'quvchi a'zo bo'lgan guruhlar ro'yxati, dars kunlari, dars vaqti, xonasi, kursi va o'qituvchisi |
| Guruh tafsiloti | `/portal/guruhlar/[id]` | Guruh dars jadvali, o'quvchining shu guruhdagi **davomati**, **baholari**, shu guruh bo'yicha **balansi**, guruhdagi **reytingi** va guruhdosh o'quvchilar ro'yxati |
| Uy ishi | `/portal/uy-ishi` | O'qituvchi tomonidan biriktirilgan barcha uy vazifalari ro'yxati, muddati, tavsifi va bajarilganlik holati |
| Sozlamalar | `/portal/sozlamalar` | **Xavfsizlik** (Telegram 2FA yoqish/o'chirish, parol almashtirish), **Profil** (taxallus/ism ko'rinishi, faol sessiyalar) |

### 5. Bosqichlar

- **1-bosqich (Auth va Baza sxemasi):**
  - `USER_KINDS` ga `"student"` qo'shish, `students.userId` bog'lash, `group_homeworks` jadvali.
  - Drizzle migratsiyasi (`pnpm db:generate:tenant`).
  - O'quvchi hisobini boshqarish servisi (`student-account.ts`).
  - Admin va O'qituvchi tomonidan parol berish imkoniyati.
  - Login oqimida o'quvchini tanish va `/portal` ga yo'naltirish.
- **2-bosqich (Portal asosi va Bosh sahifa):**
  - `/portal` shell va navigation (mobilga mos, zamonaviy toza interfeys).
  - Bosh sahifa kartalari va bugungi darslar.
- **3-bosqich (Guruhlarim sahifalari):**
  - `/portal/guruhlar` va `/portal/guruhlar/[id]`.
  - Guruhdagi davomat, baholar, to'lovlar, reyting va a'zolar.
- **4-bosqich (Uy ishi va Sozlamalar):**
  - `/portal/uy-ishi` va o'qituvchining uy ishi topshirish amali.
  - `/portal/sozlamalar`: 2FA, taxallus, parol.
