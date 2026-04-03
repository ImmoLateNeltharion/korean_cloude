#!/usr/bin/env bash
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/ImmoLateNeltharion/word-tower-builder.git"
APP_DIR_DEFAULT="/opt/wordtower"
BRANCH_DEFAULT="main"
ONLINE_PORT_DEFAULT="12013"
OFFLINE_PORT_DEFAULT="12014"

read -r -p "Repo URL [${REPO_URL_DEFAULT}]: " REPO_URL
REPO_URL="${REPO_URL:-$REPO_URL_DEFAULT}"

read -r -p "Deploy dir [${APP_DIR_DEFAULT}]: " APP_DIR
APP_DIR="${APP_DIR:-$APP_DIR_DEFAULT}"

read -r -p "Branch [${BRANCH_DEFAULT}]: " BRANCH
BRANCH="${BRANCH:-$BRANCH_DEFAULT}"

read -r -p "Online port [${ONLINE_PORT_DEFAULT}]: " ONLINE_PORT
ONLINE_PORT="${ONLINE_PORT:-$ONLINE_PORT_DEFAULT}"

read -r -p "Offline port [${OFFLINE_PORT_DEFAULT}]: " OFFLINE_PORT
OFFLINE_PORT="${OFFLINE_PORT:-$OFFLINE_PORT_DEFAULT}"

read -r -p "Заполнить тестово БД 100 словами при первом запуске? [y/N]: " SEED_REPLY
SEED_REPLY="${SEED_REPLY:-N}"

SEED_ENV=()
if [[ "$SEED_REPLY" =~ ^[YyАа]$ ]]; then
  SEED_ENV=(-e SEED_APPROVED_WORDS_ON_EMPTY=100)
  echo "Seed включён: при пустой БД добавится 100 слов."
else
  echo "Seed отключён: БД останется пустой, пока слова не добавят вручную/ботом."
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден. Установи Docker и запусти скрипт снова."
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

docker build -t word-tower:latest .
docker build -t word-tower-offline:latest ./manual-tower

docker rm -f wordtower >/dev/null 2>&1 || true
docker run -d --name wordtower \
  -p "${ONLINE_PORT}:80" \
  -e DATABASE_PATH=/data/wordtower.db \
  "${SEED_ENV[@]}" \
  -v wordtower-data:/data \
  word-tower:latest

docker rm -f wordtower-offline >/dev/null 2>&1 || true
docker run -d --name wordtower-offline \
  -p "${OFFLINE_PORT}:80" \
  -e DATABASE_PATH=/data/wordtower.db \
  "${SEED_ENV[@]}" \
  -v wordtower-offline-data:/data \
  word-tower-offline:latest

echo
echo "Готово."
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -E "^(wordtower|wordtower-offline)"
echo
echo "Проверка:"
curl -s -o /dev/null -w "online  %{http_code}  %{time_total}s\n" "http://127.0.0.1:${ONLINE_PORT}/"
curl -s -o /dev/null -w "offline %{http_code}  %{time_total}s\n" "http://127.0.0.1:${OFFLINE_PORT}/"
