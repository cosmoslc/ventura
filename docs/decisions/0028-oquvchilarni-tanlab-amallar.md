# 0028. edu-crm: o'quvchilarni tanlab, birga amal bajarish

2026-10-14 · qabul qilingan · Saidakbar so'rovi (eski tizimdagi o'quvchilar ro'yxati)

## Vaziyat

Eski tizimda o'quvchilar ro'yxatida har qator oldida checkbox bor edi. O'quvchilar tanlansa, jadval ustida panel
chiqardi: "Guruhga qo'shish", "Chiqarish" va "Xabar yuborish". Kamchiliklari:

- **"Chiqarish"ning ishlovchisi yo'q edi** — tasdiq oynasi chiqar, lekin hech narsa bajarilmasdi.
- **"Xabar yuborish" SMS yubormasdi** — provayder ulanmagan, xabar faqat bildirishnomalar tarixiga yozilardi.
- **Guruhga qo'shish o'quvchilarni birma-bir qo'shardi** — o'rtada xato chiqsa, bir qismi qo'shilib qolardi.
- Filial va "guruhda bor" tekshiruvi yo'q edi.

## Qaror

### Ko'rinish

- O'quvchilar jadvalida har qator oldida `Checkbox`. Sarlavhadagi checkbox shu sahifadagilarni tanlaydi (bir qismi
  tanlangan bo'lsa — "indeterminate"). Tanlov sahifalar orasida saqlanadi. Tanlangan qator fon rangi bilan
  ajralib turadi.
- Checkbox faqat amal ruxsati bo'lsa va "O'chirilganlar" (arxiv) filtri tanlanmagan bo'lsa chiqadi.
- Tanlov bo'lsa pastda, o'rtada **`SelectionBar`** suzib chiqadi (`packages/ui`, STYLE.md 11.36):
  "N ta tanlandi", amallar, bekor qilish.

### Amallar

| Amal | Ruxsat | Tasdiq kaliti | Mazmuni |
| --- | --- | --- | --- |
| Guruhga qo'shish | `groups.add_student` | `groups.enrollMany` | guruh tanlanadi (qidiruv bilan); hammasi sinovda qo'shiladi |
| Guruhdan chiqarish | `groups.remove_student` | `groups.leaveMany` | tanlanganlar a'zo bo'lgan guruhlardan biri, sana va sabab |
| SMS yuborish | — | — | o'chirilgan: SMS bo'limi hali ulanmagan |

- **Bitta so'rov va bitta tranzaksiya:** yo hammasi bajariladi, yo hech biri.
- **Natijada** nechtasi bajarilgani va nechtasi o'tkazib yuborilgani ko'rsatiladi.
- **O'tkazib yuboriladi:**
  - qo'shishda — arxivdagi, guruh filialidan boshqa filialdagi va guruhda allaqachon bor o'quvchilar;
  - chiqarishda — guruhda ochiq a'zoligi yo'q yoki guruhga sanadan keyin qo'shilganlar.
- Bittalab amaldagidek:
  - chiqarishda muzlatish yopiladi;
  - jurnalga har o'quvchi uchun `group.enroll` / `student.enroll` (yoki `leave`) yoziladi, `bulk: true` belgisi bilan.
- Bir amalda 400 tagacha o'quvchi — tasdiq so'rovi hajmiga sig'adi.

## Oqibatlari

- **SMS:** bo'lim ulanganda (provayder, shablonlar, yuborish tarixi) shu panelga qo'shiladi.
- **`SelectionBar`** boshqa ro'yxatlarda ham ishlatiladi: lidlar, qarzdorlar.
