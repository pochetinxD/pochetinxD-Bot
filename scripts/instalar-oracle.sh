#!/usr/bin/env bash
# ============================================
# scripts/instalar-oracle.sh — Instala el bot en un
# servidor Ubuntu (Oracle Cloud Always Free).
#
# Uso (ya conectado por SSH a tu servidor):
#   git clone https://github.com/pochetinxD/pochetinxD-Bot.git ~/pochetinxd-bot
#   cd ~/pochetinxd-bot
#   bash scripts/instalar-oracle.sh
#
# Instala: Node.js 20, git, yt-dlp (para !dl), pm2.
# Después sigue docs/ORACLE.md para el .env, la primera
# vinculación y UptimeRobot.
#
# NO corre este script como root: usa tu usuario normal
# (ubuntu) con sudo.
# ============================================
set -e

echo "== Actualizando paquetes... =="
sudo apt-get update -y

echo "== Instalando Node.js 20... =="
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

echo "== Instalando git y curl... =="
sudo apt-get install -y git curl

echo "== Instalando yt-dlp (para el comando !dl)... =="
if ! command -v yt-dlp >/dev/null 2>&1; then
  sudo curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  sudo chmod +x /usr/local/bin/yt-dlp
fi
yt-dlp --version

echo "== Instalando pm2 (para que el bot se quede prendido)... =="
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
pm2 --version

echo "== Instalando dependencias del bot... =="
cd "$(dirname "$0")/.."
npm ci

echo "== Preparando carpetas y .env... =="
mkdir -p logs data
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Se creó .env desde .env.example."
fi

echo ""
echo "== Listo. Ahora: =="
echo "  1. Edita .env: nano .env  (OWNER_NUMBER, USE_PAIRING_CODE=true, PAIRING_PHONE)"
echo "  2. Primera vinculación: node index.js  (anota el código, vincúlalo en WhatsApp)"
echo "  3. Ctrl+C y arranca con pm2: pm2 start ecosystem.config.js && pm2 save"
echo "  4. Para que sobreviva a reinicios: pm2 startup  (corre el comando que te imprima, con sudo)"
echo "  Ver docs/ORACLE.md para el resto (UptimeRobot, actualizar, respaldo)."
