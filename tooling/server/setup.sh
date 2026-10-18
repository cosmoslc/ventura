#!/usr/bin/env bash
#
# Ventura: serverni deploy uchun tayyorlash (Ubuntu 24.04; VPS yoki WSL).
# Bir marta, root nomidan ishga tushiriladi. Qayta ishga tushirish xavfsiz: bor narsani qayta o'rnatmaydi.
#
#   sudo bash setup.sh --key "ssh-ed25519 AAAA... ventura-panel:nom"
#
# Nima qiladi:
#   1. Dasturlar: git, nginx, OpenSSH server, Node.js 24, pnpm, PM2, PostgreSQL 17
#   2. `deploy` foydalanuvchisi (parolsiz; faqat panel kaliti bilan kiradi)
#   3. Yordamchilar va ularga cheklangan sudo huquqi: nginx sayti (`ventura-site`), mijoz bazasi (`ventura-db`)
#   4. PM2'ni tizim xizmati sifatida (server qayta yonganda ilovalar o'zi ko'tariladi)
#
# Nima QILMAYDI: mavjud foydalanuvchilar va ularning SSH kirishiga tegmaydi, firewall'ni o'zgartirmaydi.

set -euo pipefail

PANEL_KEY=""
SSH_PORT=""
NODE_MAJOR=24
PG_MAJOR=17
PNPM_VERSION="10.34.6"
DEPLOY_USER="deploy"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key) PANEL_KEY="${2:-}"; shift 2 ;;
    --ssh-port) SSH_PORT="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Noma'lum parametr: $1" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mXato:\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Root nomidan ishga tushiring: sudo bash setup.sh --key \"...\""
[[ -n "$PANEL_KEY" ]] || die "--key berilmagan (panel ko'rsatgan ochiq kalit)"
[[ "$PANEL_KEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ [A-Za-z0-9._:@-]+)?$ ]] || die "--key ssh-ed25519 ochiq kaliti bo'lishi kerak"
. /etc/os-release
OS_NAME="${PRETTY_NAME:-}"
[[ "${ID:-}" == "ubuntu" ]] || die "Bu skript Ubuntu uchun yozilgan (topildi: ${OS_NAME})"

IS_WSL=0
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=1
# WSL'da 22-port Windows bilan to'qnashmasligi uchun 2222; VPS'da SSH porti o'zgartirilmaydi
if [[ -z "$SSH_PORT" && $IS_WSL -eq 1 ]]; then SSH_PORT=2222; fi
if [[ -n "$SSH_PORT" ]]; then
  [[ "$SSH_PORT" =~ ^[0-9]+$ && "$SSH_PORT" -ge 1 && "$SSH_PORT" -le 65535 ]] || die "--ssh-port noto'g'ri"
fi

export DEBIAN_FRONTEND=noninteractive

say "Asosiy dasturlar (git, nginx, OpenSSH)"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git nginx openssh-server

say "Node.js ${NODE_MAJOR}"
if ! command -v node >/dev/null 2>&1 || [[ "$(node --version | cut -d. -f1)" != "v${NODE_MAJOR}" ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -y
  apt-get install -y nodejs
fi
node --version

say "pnpm ${PNPM_VERSION} va PM2"
npm install -g "pnpm@${PNPM_VERSION}" pm2 >/dev/null
pnpm --version
pm2 --version

say "PostgreSQL ${PG_MAJOR}"
if ! command -v psql >/dev/null 2>&1 || ! psql --version | grep -q " ${PG_MAJOR}\."; then
  install -d -m 0755 /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y
  apt-get install -y "postgresql-${PG_MAJOR}"
fi
psql --version
systemctl enable --now postgresql >/dev/null 2>&1 || true

say "\"${DEPLOY_USER}\" foydalanuvchisi"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "Ventura deploy" "$DEPLOY_USER" >/dev/null
fi
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/apps"
AUTH="$DEPLOY_HOME/.ssh/authorized_keys"
touch "$AUTH"
# `restrict`: bu kalit bilan terminal ochib bo'lmaydi va port yo'naltirilmaydi — faqat buyruq va fayl uzatish
KEY_BODY="$(awk '{print $2}' <<<"$PANEL_KEY")"
if ! grep -qF "$KEY_BODY" "$AUTH"; then
  echo "restrict $PANEL_KEY" >> "$AUTH"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
chmod 0600 "$AUTH"

say "SSH"
{
  echo "# Ventura (tooling/server/setup.sh)"
  [[ -n "$SSH_PORT" ]] && echo "Port ${SSH_PORT}"
  echo "Match User ${DEPLOY_USER}"
  echo "    PasswordAuthentication no"
  echo "    KbdInteractiveAuthentication no"
} > /etc/ssh/sshd_config.d/60-ventura.conf
mkdir -p /run/sshd
sshd -t
systemctl daemon-reload
# Ubuntu 24.04: SSH socket orqali ishga tushadi; port o'zgarsa socket qayta yuklanishi kerak
systemctl enable ssh >/dev/null 2>&1 || true
systemctl restart ssh.socket 2>/dev/null || true
systemctl restart ssh

say "nginx: proksi sarlavhalari (Cloudflare Tunnel orqasida ham)"
# Tunnel (cloudflared) shu kompyuterdan 127.0.0.1 orqali ulanadi: faqat undan kelgan Cloudflare sarlavhalariga
# ishoniladi. To'g'ridan-to'g'ri kelgan so'rovda mijoz yuborgan qiymat e'tiborga olinmaydi.
cat > /etc/nginx/conf.d/00-ventura-proxy.conf <<'CONF'
# Ventura boshqaradi — qo'lda o'zgartirmang (tooling/server/setup.sh)
map "$remote_addr|$http_x_forwarded_proto" $ventura_proto {
    "~^(127\.0\.0\.1|::1)\|https$" https;
    default $scheme;
}
map "$remote_addr|$http_cf_connecting_ip" $ventura_client_ip {
    "~^(127\.0\.0\.1|::1)\|(?<cf>[0-9A-Fa-f:.]+)$" $cf;
    default $remote_addr;
}
CONF
# Noma'lum domen (masalan hali deploy qilinmagan <slug>.ventura.uz) — 404; Ubuntu'ning standart sahifasi ko'rsatilmaydi
cat > /etc/nginx/conf.d/00-ventura-default.conf <<'CONF'
# Ventura boshqaradi — qo'lda o'zgartirmang (tooling/server/setup.sh)
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 404;
}
CONF
rm -f /etc/nginx/sites-enabled/default

say "nginx yordamchisi (ventura-site)"
cat > /usr/local/sbin/ventura-site <<'HELPER'
#!/usr/bin/env bash
# Ventura: bitta sayt uchun nginx sozlamasi. Faqat `deploy` foydalanuvchisi sudo orqali chaqiradi,
# shuning uchun har kirish qat'iy tekshiriladi va sozlama qat'iy qolipdan yoziladi.
#   ventura-site check
#   ventura-site set <nom> <port> <host[,host...]>
#   ventura-site remove <nom>
set -euo pipefail
CONF_DIR=/etc/nginx/conf.d
NAME_RE='^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
HOST_RE='^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'
fail() { echo "ventura-site: $*" >&2; exit 2; }

case "${1:-}" in
  check) nginx -v 2>&1 | sed 's/^nginx version: //'; exit 0 ;;
  set)
    [[ $# -eq 4 ]] || fail "set <nom> <port> <hostlar>"
    name="$2"; port="$3"; hosts="$4"
    [[ "$name" =~ $NAME_RE ]] || fail "nom noto'g'ri"
    [[ "$port" =~ ^[0-9]{4,5}$ && "$port" -ge 1024 && "$port" -le 65535 ]] || fail "port noto'g'ri"
    names=""
    IFS=',' read -ra list <<<"$hosts"
    [[ ${#list[@]} -ge 1 && ${#list[@]} -le 20 ]] || fail "hostlar soni noto'g'ri"
    for h in "${list[@]}"; do
      [[ ${#h} -le 253 && "$h" =~ $HOST_RE ]] || fail "host noto'g'ri: $h"
      names+=" $h"
    done
    file="$CONF_DIR/ventura-$name.conf"
    backup=""
    if [[ -f "$file" ]]; then backup="$(mktemp)"; cp "$file" "$backup"; fi
    cat > "$file" <<CONF
# Ventura boshqaradi — qo'lda o'zgartirmang (ventura-site set $name)
server {
    listen 80;
    listen [::]:80;
    server_name$names;
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$ventura_client_ip;
        proxy_set_header X-Forwarded-For \$ventura_client_ip;
        proxy_set_header X-Forwarded-Proto \$ventura_proto;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
CONF
    if ! nginx -t 2>/dev/null; then
      # Xato sozlama qoldirilmaydi: avvalgisi tiklanadi
      if [[ -n "$backup" ]]; then cp "$backup" "$file"; else rm -f "$file"; fi
      [[ -n "$backup" ]] && rm -f "$backup"
      fail "nginx sozlamasi tekshiruvdan o'tmadi"
    fi
    [[ -n "$backup" ]] && rm -f "$backup"
    systemctl reload nginx
    echo "ventura-site: $name -> 127.0.0.1:$port ($hosts)"
    ;;
  remove)
    [[ $# -eq 2 ]] || fail "remove <nom>"
    [[ "$2" =~ $NAME_RE ]] || fail "nom noto'g'ri"
    rm -f "$CONF_DIR/ventura-$2.conf"
    nginx -t 2>/dev/null && systemctl reload nginx
    echo "ventura-site: $2 olib tashlandi"
    ;;
  *) fail "buyruq: check | set | remove" ;;
esac
HELPER
chown root:root /usr/local/sbin/ventura-site
chmod 0755 /usr/local/sbin/ventura-site

say "Baza yordamchisi (ventura-db)"
cat > /usr/local/sbin/ventura-db <<'HELPER'
#!/usr/bin/env bash
# Ventura: mijoz bazasi va uning foydalanuvchisi. Faqat `deploy` foydalanuvchisi sudo orqali chaqiradi.
#   ventura-db check
#   ventura-db ensure <baza> <rol>     # parol stdin'dan (bitta qator)
#   ventura-db list                    # bazalar: nom, egasi, hajm (bayt), ulanishlar — TAB bilan
# Rol superuser emas, RLS'ni chetlab o'tolmaydi, yangi baza yaratolmaydi. Bazaga faqat o'z roli ulanadi.
# Qayta chaqirish xavfsiz: bor narsa qayta yaratilmaydi, parol paneldagi qiymatga tenglashtiriladi.
set -euo pipefail
NAME_RE='^[a-z][a-z0-9_]{2,62}$'
fail() { echo "ventura-db: $*" >&2; exit 2; }

case "${1:-}" in
  check) runuser -u postgres -- psql -XAtqc 'show server_version' ;;
  ensure)
    [[ $# -eq 3 ]] || fail "ensure <baza> <rol>"
    db="$2"; role="$3"
    [[ "$db" =~ $NAME_RE ]] || fail "baza nomi noto'g'ri"
    [[ "$role" =~ $NAME_RE ]] || fail "rol nomi noto'g'ri"
    [[ "$db" != postgres && "$db" != template0 && "$db" != template1 ]] || fail "tizim bazasi"
    [[ "$role" != postgres ]] || fail "tizim roli"
    IFS= read -r pass || true
    [[ "$pass" =~ ^[A-Za-z0-9_-]{24,128}$ ]] || fail "parol noto'g'ri (stdin)"
    # Parol buyruq satrida emas — muhit o'zgaruvchisida (boshqa foydalanuvchilar ko'rmaydi), psql \getenv bilan
    VENTURA_DB_PASS="$pass" runuser -u postgres -- psql -Xq -v ON_ERROR_STOP=1 -v db="$db" -v role="$role" -d postgres <<'SQL'
\getenv pass VENTURA_DB_PASS
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS', :'role')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'role', :'pass') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'role')
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db', :'role') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db') \gexec
SQL
    echo "ventura-db: $db (egasi $role) tayyor"
    ;;
  list)
    runuser -u postgres -- psql -XAtq -F "$(printf '\t')" -d postgres -c "
      SELECT d.datname, pg_get_userbyid(d.datdba), pg_database_size(d.datname),
             (SELECT count(*) FROM pg_stat_activity a WHERE a.datname = d.datname)
      FROM pg_database d WHERE NOT d.datistemplate AND d.datname <> 'postgres' ORDER BY 1"
    ;;
  *) fail "buyruq: check | ensure | list" ;;
esac
HELPER
chown root:root /usr/local/sbin/ventura-db
chmod 0755 /usr/local/sbin/ventura-db

# deploy foydalanuvchisi root nomidan FAQAT shu ikki yordamchini ishga tushira oladi
SUDOERS=/etc/sudoers.d/ventura
echo "${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/local/sbin/ventura-site, /usr/local/sbin/ventura-db" > "${SUDOERS}.tmp"
visudo -cf "${SUDOERS}.tmp" >/dev/null
chmod 0440 "${SUDOERS}.tmp"
mv "${SUDOERS}.tmp" "$SUDOERS"

systemctl enable --now nginx >/dev/null 2>&1 || true
# Oldingi versiyada yozilgan saytlar ham yangi sarlavhalarga o'tkaziladi (keyingi deploy'ni kutmasdan)
for f in /etc/nginx/conf.d/ventura-*.conf; do
  [[ -f "$f" ]] || continue
  sed -i \
    -e 's/proxy_set_header X-Real-IP \$remote_addr;/proxy_set_header X-Real-IP $ventura_client_ip;/' \
    -e 's/proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/proxy_set_header X-Forwarded-For $ventura_client_ip;/' \
    -e 's/proxy_set_header X-Forwarded-Proto \$scheme;/proxy_set_header X-Forwarded-Proto $ventura_proto;/' \
    "$f"
done
nginx -t
systemctl reload nginx 2>/dev/null || true

say "PM2 tizim xizmati"
env PATH="$PATH" pm2 startup systemd -u "$DEPLOY_USER" --hp "$DEPLOY_HOME" >/dev/null
systemctl enable "pm2-${DEPLOY_USER}" >/dev/null 2>&1 || true

say "Tayyor"
echo "  Tizim:       ${OS_NAME}$([[ $IS_WSL -eq 1 ]] && echo ' (WSL)')"
echo "  Node:        $(node --version)   pnpm: $(pnpm --version)   PM2: $(pm2 --version)"
echo "  PostgreSQL:  $(psql --version | awk '{print $3}')"
echo "  SSH:         ${DEPLOY_USER}@<server>:${SSH_PORT:-22} (faqat panel kaliti bilan)"
echo "  Ilovalar:    ${DEPLOY_HOME}/apps"
echo
echo "Endi panelda (yoki 'pnpm server:check') serverni tekshiring."
