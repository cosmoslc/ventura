# 0049. Uydagi server: Cloudflare Tunnel va har loyiha uchun avtomatik subdomen

2026-10-17 · qabul qilingan · SPEC 6 (② Uydagi server), 7, 13 (2-bosqich); ADR 0025

## Vaziyat

Uydagi server (Windows + WSL) internetga chiqmagan edi: loyihalar faqat `<slug>.localhost` orqali ochilardi.
`ventura.uz` Cloudflare'ga ulangan. Kompyuterda `cloudflared` o'rnatilgan va `ventura-tunnel` yaratilgan, lekin
sozlanmagan va ishga tushirilmagan edi.

Ikki muammo tunnelni yoqishdan oldin hal qilinishi kerak edi:

- **HTTPS belgisi yo'qolardi.** nginx ilovaga `X-Forwarded-Proto $scheme` (doim `http`) yuborardi. Tunnel
  orqali kelgan HTTPS so'rovni edu-crm HTTP deb bilardi: cookie `Secure` bo'lmasdi, auth manzili `http://` bo'lardi.
- **Mijoz IP manzili yo'qolardi.** nginx `X-Real-IP $remote_addr` yuborardi. Tunnel orqasida u har doim
  `127.0.0.1`. Ariza formasining IP bo'yicha chegarasi hamma mijozlar uchun bitta bo'lib qolardi.

## Qaror

**Yo'naltirish bitta joker yozuv bilan.**

- DNS'da ikkita CNAME tunnelga qaraydi: `admin.ventura.uz` va `*.ventura.uz`.
- Tunnel sozlamasi:
  - `admin.ventura.uz` → panel (`127.0.0.1:3000`);
  - `*.ventura.uz` → WSL nginx (`127.0.0.1:80`, Windows → WSL yo'naltirishi orqali);
  - qolgan hammasi → 404.
- nginx saytni `Host` bo'yicha tanlaydi (`ventura-site`, deploy'ning `route` qadami).
- Natijada yangi loyiha uchun DNS yoki tunnel sozlamasini o'zgartirish kerak emas: deploy tugashi bilan
  `https://<slug>.ventura.uz` ishlaydi.
- SSL'ni Cloudflare beradi: Universal SSL `*.ventura.uz` ning bir darajasini qoplaydi. Slug bitta daraja, `admin`
  esa band qilingan slug.

**Tunnel Windows xizmati sifatida ishlaydi** (`tooling/tunnel/install-windows.ps1`, administrator, bir marta):

- sozlama va tunnel kaliti LocalSystem profiliga yoziladi;
- kalitni faqat SYSTEM va Administratorlar o'qiy oladi;
- sozlama tekshiriladi (`ingress validate`);
- xizmat avtomatik ishga tushadigan qilib o'rnatiladi.

**nginx sarlavhalari** (`setup.sh`, `00-ventura-proxy.conf`):

- `X-Forwarded-Proto`: `https` faqat `127.0.0.1`/`::1` dan (tunnel) kelgan so'rovda va faqat shu qiymat
  bo'lsa; aks holda `$scheme`.
- `X-Real-IP` va `X-Forwarded-For`: `CF-Connecting-IP` faqat `127.0.0.1`/`::1` dan kelgan so'rovda; aks holda
  `$remote_addr`. Tashqaridan to'g'ridan-to'g'ri kelgan so'rov (online VPS) bu sarlavhalarni soxtalashtira olmaydi.
- `setup.sh` qayta ishga tushirilganda bor saytlar ham yangi sarlavhalarga o'tkaziladi, keyingi deploy'ni
  kutish shart emas.

**Panel ikki manzildan ochiladi.**

- `.env` da `BETTER_AUTH_URL=https://admin.ventura.uz` va `BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000`.
- `trustedOrigins` faqat to'liq `http(s)://host[:port]` qiymatlarni qabul qiladi.
- Cookie `Secure` bo'ladi; brauzerlar `localhost` da ham uni qabul qiladi.

**Sinov:**

- CI'dagi haqiqiy deploy: `127.0.0.1` dan `X-Forwarded-Proto: https` kelsa, ilova `https://` ga yo'naltiradi;
  sarlavhasiz so'rov `http://` da qoladi.
- Unit test: `trustedOrigins`.

## Oqibatlar

- Uydagi kompyuter yoki internet o'chsa, barcha `*.ventura.uz` saytlari to'xtaydi (SPEC 6 ②: UPS va muhim
  mijozlarni VPS'ga o'tkazish).
- Mijozning o'z domeni (`bilim.uz`) tunnel orqali avtomatik ulanmaydi: buning uchun domen Cloudflare hisobida
  bo'lishi va tunnelga alohida yozuv kerak. Hozircha o'z domen — online VPS + certbot (3-bosqich).
- Panel internetga ochiq: himoya — majburiy 2FA, bloklash va audit. Qo'shimcha qatlam sifatida Cloudflare Access
  keyin qo'shilishi mumkin.

## Qo'shimcha (2026-11-21): Linux kompyuterga ko'chirilgandan keyin

- Tunnel endi Linux'da user systemd xizmati (`ventura-tunnel.service`); mijoz saytlari multipass VM
  (`ventura-server`) ichidagi nginx'da. `*.ventura.uz` → VM IP manzili (`~/.cloudflared/config.yml`).
- Muammo: boot paytida `multipass start ... || true` multipassd tayyor bo'lmasdan ishlardi, xato yashirinardi va
  VM o'chiq qolardi — barcha subdomenlar ishlamasdi.
- Yechim: `tooling/tunnel/vm-up.sh` (`ventura-vm.service`, `Restart=on-failure`) multipassd'ni kutadi, VM'ni
  ishga tushiradi, VM IP o'zgargan bo'lsa tunnel sozlamasini yangilab tunnelni qayta yuklaydi va nginx'ni kutadi.
