#!/usr/bin/env bash
# Ventura: Cloudflare Tunnel Linux (Ubuntu) avtomatik sozlash (ADR 0049).
#
# Ushbu skript:
#   1. ~/.cloudflared/cert.pem mavjudligini tekshiradi (cloudflared tunnel login orqali olinadi)
#   2. ventura-tunnel yaratadi (agar mavjud bo'lmasa)
#   3. DNS CNAME marshrutlarini yo'naltiradi:
#        admin.ventura.uz  -> ventura-tunnel
#        ventura.uz        -> ventura-tunnel
#        *.ventura.uz      -> ventura-tunnel
#   4. ~/.cloudflared/config.yml sozlama faylini yozadi:
#        admin.ventura.uz -> 127.0.0.1:3000
#        ventura.uz       -> 127.0.0.1:80
#        *.ventura.uz     -> 127.0.0.1:80
#   5. Sozlamani tekshiradi (ingress validate)

set -euo pipefail

DOMAIN="${1:-ventura.uz}"
TUNNEL_NAME="${2:-ventura-tunnel}"
PANEL_PORT="${3:-3000}"

say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mXato:\033[0m %s\n' "$*" >&2; exit 1; }

command -v cloudflared >/dev/null 2>&1 || die "cloudflared o'rnatilmagan!"

USER_DIR="$HOME/.cloudflared"
CERT_FILE="$USER_DIR/cert.pem"

[[ -f "$CERT_FILE" ]] || die "Avval cloudflared login qilinishi kerak ($CERT_FILE topilmadi)"

say "Tunnel mavjudligi tekshirilmoqda ($TUNNEL_NAME)..."
TUNNEL_ID=""
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
  TUNNEL_ID=$(cloudflared tunnel list | awk -v name="$TUNNEL_NAME" '$2 == name {print $1}')
  say "Mavjud tunnel topildi: $TUNNEL_NAME ($TUNNEL_ID)"
else
  say "Yangi tunnel yaratilmoqda: $TUNNEL_NAME..."
  CREATE_OUT=$(cloudflared tunnel create "$TUNNEL_NAME")
  TUNNEL_ID=$(echo "$CREATE_OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -n1)
  say "Tunnel yaratildi: $TUNNEL_ID"
fi

[[ -n "$TUNNEL_ID" ]] || die "Tunnel ID aniqlab bo'lmadi"

CREDS_FILE="$USER_DIR/$TUNNEL_ID.json"
[[ -f "$CREDS_FILE" ]] || die "Tunnel kaliti topilmadi: $CREDS_FILE"

say "DNS marshrutlari yo'naltirilmoqda..."
cloudflared tunnel route dns "$TUNNEL_NAME" "admin.$DOMAIN" 2>/dev/null || true
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" 2>/dev/null || true
cloudflared tunnel route dns "$TUNNEL_NAME" "*.$DOMAIN" 2>/dev/null || true

say "Config fayli yozilmoqda ($USER_DIR/config.yml)..."
cat > "$USER_DIR/config.yml" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $CREDS_FILE

ingress:
  # Panel
  - hostname: admin.$DOMAIN
    service: http://127.0.0.1:$PANEL_PORT
  # Landing
  - hostname: $DOMAIN
    service: http://127.0.0.1:80
  # Wildcard barcha mijoz subdomenlari (cosmos.ventura.uz, va boshqalar)
  - hostname: "*.$DOMAIN"
    service: http://127.0.0.1:80
  - service: http_status:404
EOF

say "Ingress tekshirilmoqda..."
cloudflared tunnel --config "$USER_DIR/config.yml" ingress validate

say "Muvaffaqiyatli! Endi tunnelni ishga tushirish mumkin:"
echo "cloudflared tunnel --config $USER_DIR/config.yml run"
