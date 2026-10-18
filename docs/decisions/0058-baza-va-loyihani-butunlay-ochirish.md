# 0058. Panel: bazani va savatdagi loyihani butunlay o'chirish (faqat super admin)

2026-10-18 · qabul qilingan · ADR 0057 ("o'chirish yo'q" qarori o'zgardi)

## Vaziyat

ADR 0057 da bazani o'chirish ataylab qo'yilmagan edi. Egasi ikkita imkoniyat so'radi, ikkalasi faqat super admin
uchun:

- keraksiz bazani o'chirish;
- savatdagi loyihani butunlay o'chirish.

Loyiha savatga o'tkazilganda faqat panelda belgilanadi: sayt, ilova va ma'lumotlar serverda qoladi.

## Qaror

**Himoya** — ikkalasi ham faqat super adminga ochiq.

- Tasdiqlash oynasida nomini (baza nomi yoki loyiha slug'i) aynan yozish kerak; server amalida yana tekshiriladi.
- Bajarish ishchi jarayonda, server vazifasi orqali (`db_drop`, `project_purge`). Natija audit jurnaliga va
  serverning oxirgi buyrug'iga yoziladi.

**Bazani o'chirish** — `ventura-db drop <baza>`: ulanishlar uziladi, baza va shu nomdagi rol o'chadi.

- Ishlab turgan (savatda bo'lmagan) loyiha ishlatadigan baza rad etiladi.
- Umumiy (`*_shared`) baza ham rad etiladi: unda boshqa markazlar bo'lishi mumkin, markazlar loyihani o'chirish
  orqali tozalanadi.
- Server sirlaridagi paroli (`db:<nom>`) ham o'chadi.

**Savatdagi loyihani butunlay o'chirish** — quyidagi tartibda:

1. nginx sayti — manzil darhol yopiladi.
2. Ilova:
   - umumiy ilovada — `tenants.json` va `tenant-secrets.json` dan markaz yozuvi olib tashlanadi, ilova qayta
     ishga tushirilmaydi;
   - alohida ilovada — PM2 jarayoni va papkasi o'chiriladi.
3. Ma'lumotlar:
   - alohida baza — `ventura-db drop`;
   - umumiy baza — `ventura-db purge <baza> <mijoz>`: `tenant_id` ustuni bor har jadvaldan faqat shu mijoz
     qatorlari, bitta tranzaksiyada.
   - `purge` paytida bog'lanishlar va o'chmas jurnal triggeri vaqtincha o'chiriladi
     (`session_replication_role = replica`), boshqa mijozlarga tegilmaydi.
4. Panel: loyiha (domenlar, bo'limlar, deploylar — cascade) va uning sirlari.

Server bosqichi yiqilsa, loyiha savatda qoladi va qayta urinish mumkin. Hech qachon deploy qilinmagan loyiha
darhol paneldan o'chiriladi.

## Oqibatlar

- Serverda `setup.sh` qayta ishga tushirilishi kerak (yangi `drop` va `purge` buyruqlari). Ungacha bu amallar
  serverdagi xato bilan tugaydi, hech narsa o'chmaydi.
- Markazning faoliyat jurnali (o'chmas) ham o'chadi. Panel audit jurnalida o'chirish yozuvi qoladi.
- 30 kunlik avtomatik tozalash hali yo'q: savatdagi loyiha faqat qo'lda butunlay o'chiriladi.
