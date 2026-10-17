#!/usr/bin/env bash
#
# Ventura: landing sahifasini asosiy domenga chiqarish (uydagi server, ADR 0049).
# Root nomidan, landing yangilanganda qayta ishga tushiriladi (xavfsiz):
#
#   sudo bash tooling/landing/publish.sh --domain ventura.uz --file docs/design/landing/ventura-landing.html
#
# Nima qiladi:
#   1. Faylni /var/www/ventura-landing/index.html ga ko'chiradi (o'qish uchun ochiq, egasi root)
#   2. nginx: <domen> — landing, www.<domen> — <domen> ga doimiy yo'naltirish
#   3. nginx sozlamasini tekshiradi; xato bo'lsa avvalgi holat tiklanadi
# Tunnel `<domen>` ni 127.0.0.1:80 ga uzatadi (tooling/tunnel/install-windows.ps1); DNS: cloudflared tunnel route dns.
set -euo pipefail

DOMAIN=""
FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --file) FILE="${2:-}"; shift 2 ;;
    *) echo "publish.sh: noma'lum parametr: $1" >&2; exit 2 ;;
  esac
done

fail() { echo "publish.sh: $*" >&2; exit 2; }
[[ $EUID -eq 0 ]] || fail "root nomidan ishga tushiring (sudo)"
[[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] || fail "--domain noto'g'ri"
[[ -f "$FILE" ]] || fail "--file topilmadi: $FILE"
[[ $(stat -c %s "$FILE") -le 5242880 ]] || fail "fayl 5 MB dan katta"

ROOT=/var/www/ventura-landing
CONF=/etc/nginx/conf.d/00-ventura-landing.conf
install -d -m 0755 "$ROOT"
install -m 0644 "$FILE" "$ROOT/index.html.new"
mv -f "$ROOT/index.html.new" "$ROOT/index.html"

backup=""
if [[ -f "$CONF" ]]; then backup="$(mktemp)"; cp "$CONF" "$backup"; fi
cat > "$CONF" <<CONF
# Ventura boshqaradi — qo'lda o'zgartirmang (tooling/landing/publish.sh)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    root $ROOT;
    index index.html;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    location = /index.html {
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options nosniff always;
    }
    location / { try_files \$uri /index.html; }
}
server {
    listen 80;
    listen [::]:80;
    server_name www.$DOMAIN;
    return 301 https://$DOMAIN\$request_uri;
}
CONF
if ! nginx -t 2>/dev/null; then
  if [[ -n "$backup" ]]; then cp "$backup" "$CONF"; else rm -f "$CONF"; fi
  fail "nginx sozlamasi tekshiruvdan o'tmadi — avvalgi holat tiklandi"
fi
[[ -n "$backup" ]] && rm -f "$backup"
systemctl reload nginx
echo "publish.sh: $DOMAIN -> $ROOT/index.html (www.$DOMAIN -> $DOMAIN)"
