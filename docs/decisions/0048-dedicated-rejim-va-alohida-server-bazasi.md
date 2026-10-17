# 0048. Panel: `dedicated` deploy rejimi, `dedicated_server` bazasi; GitHub + Vercel rejadan olib tashlandi

2026-10-17 · qabul qilingan · SPEC 4, 6, 13; ADR 0006, 0007, 0009

## Vaziyat

SSH drayveri faqat `shared` rejimni bilardi: serverda shablonning bitta ilovasi (`edu-crm`) shu serverdagi hamma
mijozga xizmat qiladi. `dedicated` rejim va `dedicated_server` baza strategiyasi formada bor edi, lekin deploy
"hali qo'llab-quvvatlanmaydi" deb to'xtardi. SPEC'da GitHub + Vercel bosqichi (`fork` rejim, Vercel drayveri) ham
rejalashtirilgan edi.

Egasi qarori (2026-10-17): alohida deploy va alohida baza rejimlari kerak; GitHub + Vercel kerak emas — VPS'ning
o'zi frontend, backend va baza bo'ladi.

## Qaror

**Rejimlar faqat ikkita:** `shared` va `dedicated`. Manzillar: `home` (uydagi server) va `vps` (online VPS).
`fork` rejimi va `vercel` manzili kod, forma va SPEC'dan olib tashlandi. Ustunlar `text` + TypeScript enum bo'lgani
uchun bazada migratsiya kerak emas (bazada CHECK yo'q). Mahalliy panel bazasida bu qiymatli loyiha yo'q edi.

**`dedicated` rejim (SSH drayveri):**

- Ilova nusxasi `<shablon>-<slug>` (masalan `edu-crm-bilim`): o'z papkasi `<deploy_root>/edu-crm-bilim`
  (releases, current, shared), o'z PM2 jarayoni, `apps` jadvalida o'z porti, nginx o'sha portga.
- Nusxaning `tenants.json` va `tenant-secrets.json` fayllari har deploy'da noldan yoziladi: ularda faqat shu mijoz.
- Kod yuborish, build, health check, avtomatik rollback va eski relizlarni tozalash `shared` bilan bir xil kod.
- `shared` ilova deploy'idagi "shu serverdagi boshqa mijozlar bazasini ham yangilash" `dedicated` mijozlarga
  tegmaydi: ular o'z versiyasida qoladi va o'z deploy'ida yangilanadi.

**Baza nomi rejimga bog'liq emas:** shablon + slug (`edu_crm_bilim`) yoki umumiy baza (`edu_crm_shared`). Shuning
uchun `shared` ↔ `dedicated` almashganda ma'lumot o'sha bazada qoladi.

**Rejim almashishi (deploy oxirida, nginx yangi nusxaga ulangandan keyin — uzilishsiz):**

- `dedicated` bo'ldi: mijoz umumiy ilovaning ro'yxati va maxfiy faylidan olib tashlanadi;
- `shared` bo'ldi: alohida nusxaning PM2 jarayoni to'xtatiladi va `apps` yozuvi o'chiriladi. Serverdagi
  fayllari o'chirilmaydi (logda yo'li yoziladi).
- Bu qadam xato bersa deploy yiqilmaydi (yangi versiya allaqachon ishlab turibdi): xato logga yoziladi.

**`dedicated_server` bazasi:** baza mijozning o'z serveridagi PostgreSQL'da (ilova va baza bitta VPS'da), xuddi
alohida baza kabi `ventura-db` yordamchisi bilan yaratiladi. Farqi: server butunlay shu mijozniki.

- Faqat `dedicated` rejimda; `shared_db` faqat `shared` rejimda. Qoida bitta joyda (`dbOptionsFor`,
  `deployProblem`): forma faqat mos variantlarni ko'rsatadi, server action va drayver ham tekshiradi.
- Drayver: boshqa loyihasi bor serverga `dedicated_server` qo'yilmaydi. Server tanlanmagan bo'lsa birinchi bo'sh
  server olinadi. `dedicated_server` loyihasi turgan serverga boshqa loyiha qo'yilmaydi (`serverFit`).
- Deploy qilingan loyihada umumiy baza ↔ alohida baza almashishi rad etiladi: ma'lumot boshqa bazada qolardi.
  Ko'chirish alohida vazifa.

**Sinov:**

- Unit testlar: `instanceName`, `serverFit`.
- CI'dagi haqiqiy Ubuntu deploy sinoviga qo'shilgan bosqich:
  - `demo-c` `dedicated` rejimda deploy qilinadi: o'z jarayoni, o'z ro'yxati va o'z bazasi tekshiriladi, boshqa
    mijozlar ishlashda davom etadi;
  - band serverga `dedicated_server` loyiha qo'yib bo'lmaydi;
  - `demo-c` `shared` rejimga qaytadi: qayta build qilinmaydi, alohida jarayon to'xtaydi, baza o'sha qoladi.

## Oqibatlar

- Katta mijozni boshqalardan ajratish (xato, yuklama, versiya) bitta tanlov bilan: `dedicated`. Butun serverni
  berish: `dedicated` + `dedicated_server`.
- Har `dedicated` nusxa o'z `node_modules` va build'iga ega: diskda ~1–2 GB va o'z RAM'i (PM2 limiti 512 MB).
- Alohida nusxa `shared` ga qaytarilganda eski papka qo'lda o'chiriladi (ataylab: serverdagi fayllar avtomatik
  o'chirilmaydi).
- Loyihani bir serverdan boshqasiga ko'chirish hali yo'q (3-bosqichning qolgan bandi).
- PgBouncer hali o'rnatilmaydi. Ko'p `dedicated` nusxa bitta serverda bo'lsa, PostgreSQL ulanishlari soni
  kuzatilishi kerak.
