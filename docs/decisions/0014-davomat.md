# 0014. edu-crm E2: davomat, dam olish kunlari va xodimlar davomati

2026-10-12 · qabul qilingan · EDU-CRM-PLAN E2

## Vaziyat

Eski tizimda (cosmoslc) davomat guruh+sana uchun bitta JSON qator edi (noyob kalitsiz, takror qatorlar paydo
bo'lar edi). Belgisi yo'q o'quvchi ba'zi joylarda "keldi", ba'zilarida "kelmadi" deb hisoblanar edi. O'tgan
kunlar davomatini ruxsatsiz o'zgartirish mumkin edi. "Hammasini bor qilish" mavjud belgilar va sabablarni
o'chirib yozar edi. Sabab har harfda saqlanar edi. Bayram sahifasi bazaga saqlamas edi, shuning uchun bayram
kunlari dars sanalaridan chiqmas edi. Xodimlar davomati sahifasida belgilab bo'lmas edi, belgisi yo'q xodim esa
"Kelgan" ko'rinar edi. "Kelmaganlar" hisoboti faqat davomat qatori bor kunlarni sanar edi: umuman olinmagan dars
"belgilanmagan"ga tushmas edi.

## Qaror

- **Jadvallar** (mijoz bazasi, RLS va FORCE RLS):
  - `attendance` — (guruh, o'quvchi, sana) noyob; holat: bor, kech, sababli, yo'q; sabab ixtiyoriy (500 belgi).
    Guruh va o'quvchiga FK `restrict` — tarix o'chmaydi.
  - `holidays` va `holiday_branches` — oraliq (ko'pi bilan 60 kun) va "darslarga ta'sir qiladi" belgisi.
    `holiday_branches`da qator bo'lmasa, bayram barcha filiallarga tegishli.
  - `employee_attendance` — xodim (`users`) yoki o'qituvchi (`teachers`), aniq bittasi. Har kishi uchun kuniga
    bitta belgi. Holat: kelgan, kech qoldi, kelmagan; kelgan vaqti va izoh ixtiyoriy.
- **Dars taqvimi** (`lib/lessons.ts`, toza funksiyalar, Vitest). Dars sanalari guruhning dars kunlari va
  boshlanish sanasidan hisoblanadi. "Darslarga ta'sir qiladi" belgisi bor bayram (guruh filialiga tegishli)
  kunlari chiqarib tashlanadi. E3dagi oylik hisob ham shu funksiyadan foydalanadi.
  - A'zo bo'lgan kun: qo'shilgan kundan chiqqan kungacha, chiqqan kun kirmaydi.
  - Muzlatilgan kundan boshlab o'quvchi belgilanmaydi.
- **Belgilash** (guruh profilidagi "Davomat jadvali" tabi):
  - Bugungi dars uchun `attendance.student_mark` kerak, o'tgan kunlar uchun `attendance.student_edit_past`.
  - Kelajakdagi kun, dars bo'lmagan kun va bayram kuni belgilanmaydi.
  - Belgisi yo'q kun "belgilanmagan" bo'lib qoladi. U hech qachon taxmin qilinmaydi.
  - "Belgilanmaganlarni BOR qilish" faqat bo'sh belgilarni to'ldiradi.
  - Sabab maydondan chiqqanda yoki Enter bosilganda saqlanadi. "Bor" holatida sabab saqlanmaydi.
  - Bayram saqlanayotganda, uning oralig'ida olingan davomat bo'lsa, bayram saqlanmaydi. Avval davomatni
    o'chirish kerak, aks holda tarix bilan taqvim mos kelmay qoladi.
- **Hisobot** (`/attendance`, eski "Kelmaganlar" sahifasi; `lib/attendance-report.ts`, Vitest):
  - Har o'quvchi × guruh uchun davrdagi darslar, bor, kech, qoldirgan (sababsiz + sababli) va belgilanmagan
    darslar soni hisoblanadi. Belgilanmagan dars taqvimdan olinadi.
  - Foiz = (bor + kech) / belgilangan darslar. Belgilanmagan dars foizni tushirmaydi.
  - "Avvalgi dars" — oxirgi o'tgan dars. Ketma-ket qoldirish davrdan oldingi 90 kunni ham hisobga oladi.
  - "Xavf" — 3+ ketma-ket yoki davrda 3+ qoldirish.
  - Filtrlar va KPI kartalari eski tizimdagidek; sana oralig'i ko'pi bilan 1 yil.
  - Sabab oxirgi qoldirilgan darsning belgisiga yoziladi va belgilashdagi ruxsat qoidalari bilan tekshiriladi.
- **Bog'lanish**:
  - Hisobotdagi "Bog'lanish natijasi" o'quvchi eslatmalariga yoziladi.
  - "Gaplashildi" — "Qo'ng'iroq" turidagi eslatma, "javob bermadi" — oddiy eslatma.
  - O'quvchi "bog'lanilgan" deb hisoblanadi, agar oxirgi qoldirilgan darsdan keyin "Qo'ng'iroq" yoki "Ota-onasi
    bilan suhbat" eslatmasi bo'lsa. Bu eslatmalar profildan ham qo'shilishi mumkin.
- **Xodimlar davomati** (`/staff-attendance`, "Ofis" menyusi):
  - Ruxsat: ko'rish — `attendance.employee_view`, belgilash — `attendance.employee_mark`.
  - Ro'yxatda xodimlar (direktorsiz) va o'qituvchilar, tepadagi filial tanlovi bo'yicha.
  - Kunlik ko'rinish: sana tanlanadi (kelajak emas). Belgisi yo'q xodim "Belgilanmagan" ko'rinadi.
    "Belgilanmaganlarni KELGAN qilish" mavjud belgilarga tegmaydi.
  - Reyting: oxirgi 7 yoki 30 kun. Foiz = (kelgan + kech) / belgilangan kunlar (`lib/employee-ranking.ts`).
- Har o'zgartiruvchi amal tarixga yoziladi: `attendance.mark`, `attendance.mark_all`, `holiday.*`,
  `employee_attendance.*`, `student.note.create`.

## Oqibatlari

- E3 (moliya) oylik to'lov va o'qituvchi maoshini shu dars taqvimi va davomatdan hisoblaydi. Bayramdagi darslar
  hisobdan chiqadi.
- Davomat jurnalini Excelga yuklab olish (`attendance.export`) hali qo'shilmagan. U hisobotlar bosqichida
  qo'shiladi.
