#!/bin/sh
# Деплой rita-bot (запускать на сервере): sh /opt/rita-bot/deploy/deploy.sh
# Адрес приложения — в /opt/rita-bot/.app_url, uuid в Coolify — в /opt/rita-bot/.coolify_app.
# backup базы → сборка кандидата → смоук-тест → push в localhost:5000 → redeploy в Coolify.
set -eu
cd /opt/rita-bot
IMAGE=rita-bot
APP=$(cat /opt/rita-bot/.coolify_app 2>/dev/null || true)

# 1. CRLF ломает сборку и sh
if grep -lq "$(printf '\r')" Dockerfile deploy/*.sh 2>/dev/null; then echo "CRLF в Dockerfile или deploy/*.sh — стоп"; exit 1; fi

# 2. backup SQLite, если контейнер уже есть
C=$(docker ps --filter "name=$APP" --format '{{.Names}}' | head -1 || true)
if [ -n "$APP" ] && [ -n "$C" ]; then
  mkdir -p /opt/rita-bot/backups
  docker exec "$C" node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/data/rita.db');d.exec(\"VACUUM INTO '/data/backup.db'\")" 2>/dev/null \
    && docker cp "$C:/data/backup.db" "/opt/rita-bot/backups/rita-$(date +%Y%m%d-%H%M%S).db" \
    && docker exec "$C" rm -f /data/backup.db || echo "backup пропущен"
  ls -1t /opt/rita-bot/backups/*.db 2>/dev/null | tail -n +21 | xargs -r rm -f
fi

# 3. сборка кандидата
docker build -t $IMAGE:candidate .

# 4. смоук-тест: сервер стартует и отдаёт страницу и карточку
docker rm -f rita-smoke >/dev/null 2>&1 || true
docker run -d --name rita-smoke -e BOT_TOKEN=0:test -e WEBHOOK_SECRET=t -e APP_URL=http://localhost -e DB_PATH=/tmp/t.db $IMAGE:candidate >/dev/null
sleep 4
OK=$(docker exec rita-smoke node -e "Promise.all(['/', '/cards/w01.png', '/pict.js'].map(p=>fetch('http://127.0.0.1:8080'+p).then(r=>r.status))).then(s=>console.log(s.join(',')))" || echo fail)
docker logs rita-smoke 2>&1 | tail -3
docker rm -f rita-smoke >/dev/null
[ "$OK" = "200,200,200" ] || { echo "смоук-тест провален: $OK"; exit 1; }
echo "смоук-тест ок"

# 5. публикация и redeploy
docker tag $IMAGE:candidate localhost:5000/$IMAGE:latest
docker push localhost:5000/$IMAGE:latest >/dev/null
OLD=$(docker ps --filter "name=$APP" --format '{{.Names}}' | head -1)
if [ -n "$APP" ]; then
  HDR=$(mktemp); printf 'Authorization: Bearer %s' "$(cat /root/.coolify_token)" > "$HDR"
  curl -s -X POST -H "@$HDR" "http://localhost:8000/api/v1/deploy?uuid=$APP&force=true"; echo
  rm -f "$HDR"
fi

# 6. дождаться, пока Coolify уберёт старый контейнер, и обновить вебхук/команды/меню
if [ -n "$APP" ]; then
  # ждём: старого контейнера нет, новый один и здоров
  i=0; until NOW=$(docker ps --filter "name=$APP" --filter "health=healthy" --format '{{.Names}}'); [ -n "$NOW" ] && [ "$(echo "$NOW" | wc -l)" = "1" ] && [ "$NOW" != "$OLD" ]; do i=$((i+1)); [ $i -gt 60 ] && { echo "новый контейнер не дождались"; break; }; sleep 4; done
  sleep 3
  curl -s "$(cat /opt/rita-bot/.app_url)/setup?key=$(cat /root/.rita_webhook_secret)" >/dev/null && echo "setup ок"
fi
