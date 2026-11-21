# Ventura CRM — tuzatishlar rejasi

> Eski CRM asosiy namuna (reference) sifatida olinadi. Qayerda "eski CRM kabi" deyilgan bo'lsa, avval eski CRMdagi funksiyani to'liq o'rganib chiqish, so'ng uni yaxshilab yangi CRMga ko'chirish kerak.

---

## 1. Lidlar

### 1.1. Lidni guruhga yozishda dars kunlarini ko'rsatish
- **Muammo:** Lidni birinchi guruhga yozishda hozir sana tanlash inputi chiqyapti.
- **Vazifa:** Tanlangan guruhning kelayotgan dars kunlari ro'yxat ko'rinishida chiqib turishi kerak.
- [x] Guruh tanlanganda uning dars jadvalidan yaqin dars kunlarini olish
- [x] Sana inputi o'rniga dars kunlarini tanlash elementini qo'yish

### 1.2. Lidlar sahifasidagi standart ustunlar
- **Vazifa:** Lidlar sahifasida quyidagi ustunlar avtomatik (default) yaratilsin:
  1. Yangi
  2. Ma'lumot berildi
  3. Sinov darsida
  4. Sinovda qatnashdi
  5. Guruhga qo'shildi
- [x] Yangi hisob/filial ochilganda ustunlar avtomatik yaratilishini ta'minlash

### 1.3. CRM voronka sahifasi
- **Muammo:** Eski CRMdagi voronka funksiyalarining hammasi yangisiga o'tmagan.
- **Vazifa:** Eski CRMdagi voronka sahifasini to'liq tahlil qilish va barcha funksiyalarini ko'chirish.
- [x] Eski voronka funksiyalarining to'liq ro'yxatini tuzish
- [x] Yangi CRMda yo'q funksiyalarni aniqlash
- [x] Yetishmayotganlarini qo'shish

---

## 2. O'qituvchilar va oyliklar

### 2.1. Support o'quvchining oyligi
- **Savol:** Support o'quvchining oyligi ham hisoblanadimi?
- [x] Mavjud hisoblash mantig'ini tekshirib, javobni aniqlash
- [x] Kerak bo'lsa, hisoblash qoidasini to'g'rilash

### 2.2. O'qituvchi profili — "To'lovlardan hisoblangan tushum"
- **Vazifa:** Bu menyu eski CRMdagidek bo'lsin, ya'ni o'quvchilarning to'lovlari asosida hisoblansin.
- [x] Eski CRMdagi hisoblash mantig'ini o'rganish
- [x] Yangi CRMga o'tkazish

### 2.3. Fiks oylikda ish boshlagan sana
- **Muammo:** O'qituvchi fiks oylikda bo'lsa-yu, oyning o'rtasidan boshlasa (yoki oy boshidan dars bermasa) ham to'liq bir oylik fiks pulini olyapti.
- **Vazifa:** Guruh yaratishda o'qituvchi uchun fiks tanlanganda **ish boshlagan sana** maydoni qo'shilsin (oylik davr tanlash).
- [x] Guruh yaratish formasiga "ish boshlagan sana" maydonini qo'shish
- [x] Fiks oylikni boshlangan sanadan boshlab proporsional hisoblash

---

## 3. Guruhlar

### 3.1. Guruh profili
- **Vazifa:** Guruh profilini eski CRMdagidek qilish va ustiga yaxshilash. Eski CRMda ham mukammal emas, shuning uchun qo'shimcha yaxshilashlar kerak.
- [x] Eski guruh profilini to'liq tahlil qilish
- [x] Yetishmayotgan va noqulay joylarni aniqlash
- [x] Yangi profilni qayta loyihalash

---

## 4. O'quvchilar

### 4.1. Faol o'quvchini o'chirishdagi sabablar
- **Muammo:** Faol o'quvchi o'chirilganda "Sabablar" sahifasidagi ma'lumotlar dropdown ko'rinishida chiqmayapti.
- [x] Sabab nega chiqmayotganini aniqlash (ma'lumot saqlanmayaptimi yoki ko'rsatilmayaptimi)
- [x] Dropdownda sabablarni chiqarish

### 4.2. Xavfli o'quvchilar jadvali
- **Muammo:** Jadval uslubi yomon.
- **Vazifa:** Bitta umumiy jadval komponenti yaratilsin va o'quvchilar ko'rsatiladigan barcha jadvallarda **O'quvchilar sahifasidagi jadval uslubi** ishlatilsin.
- [x] Umumiy (reusable) o'quvchilar jadvali komponentini yaratish
- [x] Xavfli o'quvchilar sahifasini shu komponentga o'tkazish
- [x] Boshqa o'quvchilar jadvallarini ham shu komponentga o'tkazish

---

## 5. Moliya

### 5.1. To'lovlar va Qarzdorlar sahifalari
- **Muammo:** Jadval juda xunuk ko'rinadi.
- **Vazifa:** O'quvchilar sahifasidagi jadval uslubida qayta ishlash: ravon va aniq ko'rinishda, guruhlar alohida box (karta) ichida.
- [x] To'lovlar jadvalini yangilash
- [x] Qarzdorlar jadvalini yangilash
- [x] Guruhlarni box ichiga joylash

### 5.2. Qarzdorlar — "Izoh" ustuni
- **Vazifa:** Izoh ustuni qo'shilsin. U eng oxirgi izohni ko'rsatadi: qarzdor o'quvchi bilan bog'lanilganda u nima desa, shu yoziladi.
- [x] "Izoh" ustunini qo'shish
- [x] Izoh qo'shish imkoniyatini berish
- [x] Jadvalda faqat eng oxirgi izohni ko'rsatish

### 5.3. Ish haqi va Maosh hisob-kitob sahifalari
- **Muammo:** Jadvallar juda xunuk.
- **Vazifa:** O'qituvchilar jadvali uslubida qayta ishlash. Kerak bo'lsa, umumiy komponent yaratish.
- [x] Ish haqi jadvalini yangilash
- [x] Maosh hisob-kitob jadvalini yangilash
- [x] Umumiy jadval komponentini ajratib olish (ixtiyoriy)

### 5.4. Reja, Prognoz va Pul oqimi — bitta sahifaga birlashtirish
- **Muammo:** Hozir bu uchtasi alohida (ikkita) sahifa qilib qo'yilgan, aslida bitta sahifa bo'lishi kerak.
- **Vazifa:** Ularni bitta sahifaga birlashtirish, eski CRM bilan bir xil qilish va ustiga yaxshilash.
- [x] Eski CRMdagi Pul oqimi sahifasini to'liq va batafsil o'rganish
- [x] Yangi birlashgan sahifani loyihalash
- [x] Eski sahifalarni olib tashlash
- [x] Qo'shimcha yaxshilashlarni kiritish

---

## 6. Xodimlar

### 6.1. Xodim qo'shish formasi
- **Muammo:** Forma ochilganda qo'shimcha maydonlar avtomatik qo'shilib turibdi.
- **Vazifa:** Standart holatda qo'shimcha maydonlar bo'lmasin, barcha inputlar bo'sh bo'lsin.
- [x] Standart qo'shimcha maydonlarni olib tashlash
- [x] Inputlarning boshlang'ich qiymatlarini bo'sh qilish

---

## 7. Qo'shimcha

### 7.1. Band raqami 15
- Asl faylda 15-band bo'sh qoldirilgan. Kerak bo'lsa, shu yerga to'ldiring.

---

## Umumiy tartib (taklif)

| Bosqich | Mazmun | Bandlar |
|---|---|---|
| 1 | Umumiy jadval komponentini yaratish | 4.2, 5.1, 5.3 |
| 2 | Jadval uslubini boshqa sahifalarga qo'llash | 5.1, 5.2, 5.3 |
| 3 | Eski CRM bilan taqqoslab qayta yozish | 1.3, 2.2, 3.1, 5.4 |
| 4 | Mantiqiy xatolarni tuzatish | 2.1, 2.3, 4.1 |
| 5 | Kichik tuzatishlar | 1.1, 1.2, 6.1 |
