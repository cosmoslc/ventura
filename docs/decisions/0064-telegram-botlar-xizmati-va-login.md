# 0064. edu-crm: Telegram botlar tizimi va login orqali ulanish

2026-10-22 · qabul qilingan · ADR 0039, 0049, 0051, 0062, 0063  
**Muallif / Agent:** Google Gemini

## Vaziyat

Markaz o'qituvchilari, o'quvchilari va ularning ota-onalari uchun Telegram orqali xabarnomalar (davomat, baho, to'lov, avans, jarima) hamda mini-ilovalarga kirish imkoniyati zarur edi.

Muammolar:
- Telegram hisob raqami o'quv markazida ro'yxatdan o'tgan telefon raqamidan farq qilishi mumkin (masalan, chet el raqami, boshqa oila a'zosi raqami).
- Faqat kontakt yuborish (telefon raqam orqali) ba'zi hollarda foydalanuvchining hisobini topa olmaydi.
- Admin panelda qaysi botlar ulanganligi, qancha foydalanuvchi botdan faol foydalanayotgani va qanchasi hali ulanmaganligi monitoring qilinishi kerak edi.

## Qaror

### 1. Telegram botlar bo'limi (`/telegram-bots`)
Admin CRM sozlamalarida (`/telegram-bots`) har bir bot roli (O'qituvchi boti, O'quvchi boti, Ota-ona boti) uchun ixcham kartochkalar yaratildi:
- Har bir botning nomi, username'i, ulanish holati;
- Faol ishlatayotganlar soni va hali ulanmaganlar soni statistikasi;
- Bot tokenini kiritish/yangilash va webhook'ni avtomatik sozlash.

### 2. Ikki tomonlama ulanish: Telefon raqam va Login orqali
Botga start bosilganda foydalanuvchiga 2 xil ulanish yo'li taqdim etiladi:
1. **Telefon raqam yuborish:** `📱 Telefon raqamni yuborish` tugmasi bosiladi va Telegram kontakti orqali bazadan hisob topiladi.
2. **Web login orqali ulanish:** `/login` buyrug'i yoki formadagi login/parol orqali. Foydalanuvchi o'zining CRM/Portal tizimidagi login yoki telefon raqami hamda parolini yuborib botga ulanadi.

### 3. Xabarnomalar xizmati
- **O'qituvchi boti:** Avans berilganda, oylik to'lov hisoblanganda, dars guruhi boshlanishidan oldin va davomat qilinmaganda eslatma keladi.
- **O'quvchi boti:** Olingan baho, dars qoldirilganligi (sababli/sababsiz) va yangi berilgan uy vazifalari haqida xabar beradi.
- **O'ta-ona boti:** Farzandning darsga kelgan/kelmaganligi, kechikkanligi, past baholari va to'lov qarzdorliklari xabarnomasi yuboriladi.

### 4. Webhook va Cloudflare Tunnel integratsiyasi
- Webhook manzili markazning faol subdomeni (`https://<slug>.ventura.uz/api/telegram/webhook`) asosida o'rnatiladi.
- Nginx va Cloudflare Tunnel orqali tashqi Telegram so'rovlari bevosita CRM API'siga kechikishsiz yo'naltiriladi.
