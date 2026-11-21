#!/usr/bin/env bash
# Ventura: uydagi server VM'ini (multipass) ishga tushirish va tunnelni unga moslash (ADR 0049).
#
# systemd (user) xizmati `ventura-vm.service` shu skriptni boot'da chaqiradi:
#   1. multipassd tayyor bo'lguncha kutadi (boot paytida u kechroq ko'tariladi) va VM'ni ishga tushiradi;
#   2. VM'ning joriy IPv4 manzilini oladi;
#   3. ~/.cloudflared/config.yml dagi "*.<domen>" yozuvi boshqa IP'ga qarasa — yangilaydi va tunnelni qayta yuklaydi;
#   4. VM ichidagi nginx (80-port) javob berguncha kutadi.
# Xato bo'lsa nol bo'lmagan kod bilan chiqadi: systemd uni qayta urinadi va jurnalda ko'rinadi.

set -euo pipefail

VM_NAME="${VENTURA_VM:-ventura-server}"
DOMAIN="${VENTURA_DOMAIN:-ventura.uz}"
CONFIG="${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}"
MULTIPASS="${MULTIPASS_BIN:-/snap/bin/multipass}"
TUNNEL_UNIT="ventura-tunnel.service"

log() { printf '[vm-up] %s\n' "$*"; }

# 1. multipassd tayyorligini kutish (3 daqiqagacha)
for i in $(seq 1 90); do
  if "$MULTIPASS" version >/dev/null 2>&1 && "$MULTIPASS" list >/dev/null 2>&1; then break; fi
  [[ $i -eq 90 ]] && { log "multipassd javob bermadi"; exit 1; }
  sleep 2
done

state() { "$MULTIPASS" info "$VM_NAME" --format csv 2>/dev/null | awk -F, 'NR==2 {print $2}'; }

if [[ "$(state)" != "Running" ]]; then
  log "$VM_NAME ishga tushirilmoqda..."
  for i in $(seq 1 10); do
    "$MULTIPASS" start "$VM_NAME" && break
    [[ $i -eq 10 ]] && { log "$VM_NAME ishga tushmadi"; exit 1; }
    sleep 6
  done
fi

# 2. IPv4 (tarmoq ko'tarilguncha bo'sh bo'lishi mumkin)
IP=""
for i in $(seq 1 60); do
  IP="$("$MULTIPASS" info "$VM_NAME" --format csv | awk -F, 'NR==2 {print $5}')"
  [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && break
  IP=""
  sleep 2
done
[[ -n "$IP" ]] || { log "$VM_NAME IP manzili aniqlanmadi"; exit 1; }
log "$VM_NAME: $IP"

# 3. Tunnel sozlamasidagi joker yozuvni moslash
if [[ -f "$CONFIG" ]]; then
  CURRENT="$(awk -v host="hostname: \"*.$DOMAIN\"" '
    index($0, host) { getline; if (match($0, /http:\/\/[0-9.]+/)) print substr($0, RSTART + 7, RLENGTH - 7) }
  ' "$CONFIG")"
  if [[ -n "$CURRENT" && "$CURRENT" != "$IP" ]]; then
    log "Tunnel joker manzili yangilanmoqda: $CURRENT -> $IP"
    sed -i "s#http://$CURRENT:80#http://$IP:80#" "$CONFIG"
    systemctl --user try-restart "$TUNNEL_UNIT" || true
  fi
fi

# 4. nginx tayyorligi (2 daqiqagacha); tayyor bo'lmasa ham VM ishlayapti — faqat ogohlantirish
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null -m 3 "http://$IP/" -H "Host: $DOMAIN" 2>/dev/null \
    || curl -sS -o /dev/null -m 3 -w '%{http_code}' "http://$IP/" 2>/dev/null | grep -qE '^[1-5][0-9]{2}$'; then
    log "nginx javob beryapti"
    exit 0
  fi
  sleep 2
done
log "Ogohlantirish: $IP:80 javob bermadi (nginx ishlayaptimi?)"
