# 0007. Mijoz bazasi, maxfiy sozlamalar va birinchi direktor — deploy paytida, paneldan

2026-10-11 · qabul qilingan · Ventura 2-bosqich (baza strategiyalari), EDU-CRM-PLAN E0 davomi

## Vaziyat

edu-crm skeleti (0006) mijoz bazasi va maxfiy faylsiz kirish sahifasida "tizim hali sozlanmagan" deydi. Ularni terminal buyruqlari (`edu:tenant`, `edu:staff`) yaratardi. Talab (Saidakbar): hammasi paneldan — Yangi loyiha formasi va "Deploy" tugmasi bilan, buyruqsiz.

## Qaror

- **Deploy'ning `migrate` qadami** (`packages/deploy/src/drivers/ssh.ts`) shablonda `scripts/provision.ts` bo'lsa ishlaydi:
  1. Serverda baza va uning roli — `ventura-db ensure <baza> <rol>` (root yordamchisi, `ventura-site` kabi faqat `deploy` sudo bilan chaqiradi). Parol stdin'dan, psql'ga muhit o'zgaruvchisi orqali (`\getenv`) — buyruq satrida va jarayonlar ro'yxatida ko'rinmaydi. Rol: superuser emas, BYPASSRLS yo'q, baza yaratolmaydi; bazaga `PUBLIC` ulana olmaydi — har rol faqat o'z bazasiga kiradi.
  2. Yangi reliz ichida `tsx scripts/provision.ts` (ma'lumot stdin'dan JSON): migratsiyalar, "Asosiy filial", formadagi egadan birinchi direktor (vaqtinchalik parol, birinchi kirishda almashtiriladi; bot birinchi kirishda ulanadi). Qayta ishga tushirish hech narsani o'zgartirmaydi.
  3. `shared/tenant-secrets.json` (0600): baza manzili, sessiya kaliti, bot tokeni. SFTP orqali, vaqtinchalik fayl + `mv`. Ilova uni PM2 muhitidagi `VENTURA_TENANT_SECRETS_FILE` dan o'qiydi.
- **Baza nomlari:** `alohida baza` — `<shablon>_<slug>` (`edu_crm_bilim`), rol nomi bilan bir xil; `umumiy baza` — serverdagi shablon uchun bitta `edu_crm_shared`. Ajratish ikkalasida ham RLS bilan (0006).
- **Sirlar panelda shifrlangan:** baza paroli (alohida — loyiha sirlari, umumiy — server sirlari), sessiya kaliti (`auth_secret`) birinchi deploy'da yaratiladi va keyin o'zgarmaydi; xodimlar qayta deploy'da chiqib ketmaydi.
- **Yangi kod hamma mijozga birdan tushadi**, shuning uchun reliz yangi bo'lsa shu serverdagi boshqa mijozlar bazalari ham shu qadamda migratsiya qilinadi. Biri yiqilsa deploy reliz almashtirilishidan oldin to'xtaydi, eski versiya ishlashda davom etadi.
- **Ega hisobi — telefon va ism** (login emas): edu-crm xodimlari telefon bilan kiradi. `projects.owner_name`, `owner_phone`; eski `owner_login` ustuni o'chirilmadi, faqat majburiy emas.
- `alohida server` (`dedicated_server`) strategiyasi hali yo'q — deploy tushunarli xato bilan to'xtaydi (3-bosqich).

## Oqibatlari

- **Mavjud serverlarda `setup.sh` qayta ishga tushirilishi kerak** (yangi `ventura-db` va sudo qoidasi). Bo'lmasa deploy shuni aytib to'xtaydi.
- Eski loyihalarda ega telefoni yo'q: deploy bazani yaratadi, lekin direktor yaratilmaydi (logda ogohlantirish). Yangi loyiha yaratish kerak yoki keyin loyiha sahifasida egani tahrirlash qo'shiladi.
- `pnpm edu:tenant` / `edu:staff` faqat mahalliy ishlab chiqish uchun qoladi.
- CI (`server-deploy`): ikki mijoz — biri alohida, biri umumiy bazada; direktorlar, maxfiy fayl huquqi, rol boshqa bazaga kira olmasligi, qayta deploy'da ikkinchi direktor yaratilmasligi va logda parol yo'qligi tekshiriladi.
