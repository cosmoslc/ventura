# 0057. Panel: "Bazalar" sahifasi — PostgreSQL bazalarini kuzatish va yaratish

2026-10-18 · qabul qilingan · ADR 0007 (mijoz bazasi), 0049

## Vaziyat

Mijoz bazalari har serverning o'z PostgreSQL'ida turadi va deploy paytida `ventura-db ensure` bilan yaratiladi.
Ikki tur bor:

- umumiy baza `<shablon>_shared` — bitta serverdagi hamma markaz, RLS bilan ajratilgan;
- alohida baza `<shablon>_<slug>`.

Egasiga bitta joyda quyidagilar kerak edi:

- nechta baza bor, qaysi bazada qaysi loyihalar ishlayapti;
- bazalar hajmi;
- yangi baza yaratish;
- baza manzilini olish.

## Qaror (egasi bilan kelishilgan)

**Ro'yxat va hajm**

- Serverdagi yordamchiga `ventura-db list` qo'shildi: nom, egasi, hajm (bayt), ulanishlar soni, TAB bilan.
- Har daqiqalik metrika so'rovi (`probeServer`) uni ham oladi va `servers.metrics.databases` ga yozadi (migratsiyasiz).
- Yordamchi eski bo'lsa metrika baribir saqlanadi, sahifa "setup.sh ni qayta ishga tushiring" deydi.
- Qaysi loyiha qaysi bazada — panel ma'lumotidan, deploy bilan bir xil qoida bo'yicha
  (`packages/deploy/src/databases.ts`: `dbNameFor`). Loyiha kutgan, lekin serverda yo'q baza "Serverda yo'q" deb
  ko'rsatiladi.

**Ogohlantirish** — baza 5 GB dan oshsa, super adminlarga Telegram xabari keladi (faqat yangi oshganda,
`servers.alerts.databases`). Disk ogohlantirishi avvalgidek. PostgreSQL'da bazaga qat'iy limit qo'yib bo'lmaydi —
faqat kuzatiladi.

**Yaratish** — "Servers boshqarish" ruxsati bilan ishlaydi.

- Panel `db_create` server vazifasini navbatga qo'yadi, ishchi jarayon SSH orqali `ventura-db ensure <nom> <nom>` ni
  chaqiradi. Parol server sirlariga yoziladi (`db:<nom>`).
- `ensure` bor bazaning parolini almashtiradi. Shuning uchun serverda bor yoki loyiha ishlatadigan nom rad etiladi:
  avval panelda, keyin ishchi jarayonda jonli ro'yxat bilan yana tekshiriladi. Aks holda ishlab turgan ilovaning
  paroli buzilardi.
- **O'chirish yo'q** — xato bilan ma'lumot yo'qolmasin.

**Manzil** — faqat super admin uchun.

- Ko'rishdan oldin tasdiqlash so'raladi, har ko'rish audit jurnaliga yoziladi (`database.reveal`).
- Server ichidagi URL (`127.0.0.1:5432`), SSH tunnel buyrug'i va tunnel orqali URL (`localhost:15432`) beriladi.
- Port ochilmaydi: tashqaridan faqat o'z SSH kaliting bilan tunnel orqali ulaniladi.

## Oqibatlar

- Har serverda bir marta `setup.sh` qayta ishga tushirilishi kerak — u `ventura-db` ni yangilaydi.
- Hajm har daqiqa yangilanadi; tarix (o'sish grafigi) keyinroq, kerak bo'lsa `server_metrics` ga qo'shiladi.
- Panelga noma'lum baza (qo'lda boshqa yo'l bilan yaratilgan) ko'rinadi, lekin uning paroli panelda yo'q — URL berilmaydi.
