#!/bin/sh
# Одноразово: создать в Coolify проект «rita» и приложение rita-bot (dockerimage), том /data, домен, переменные.
# Запуск на сервере: SERVER_UUID=<uuid сервера в Coolify> DOMAIN=https://<адрес> BOT_TOKEN_FILE=/root/.rita_bot_token sh /opt/rita-bot/deploy/coolify-create.sh
set -eu
API=http://localhost:8000/api/v1
SERVER=${SERVER_UUID:?нужен SERVER_UUID}
DOMAIN=${DOMAIN:?нужен DOMAIN}
echo "$DOMAIN" > /opt/rita-bot/.app_url
[ -f /opt/rita-bot/.coolify_app ] && { echo "уже создано: $(cat /opt/rita-bot/.coolify_app)"; exit 0; }
HDR=$(mktemp); printf 'Authorization: Bearer %s' "$(cat /root/.coolify_token)" > "$HDR"
j() { python3 -c "import sys,json; raw=sys.stdin.read(); d=json.loads(raw); print(d$1) if 'uuid' in str(d) else sys.exit('API: '+raw)"; }

PROJECT=${PROJECT:-$(curl -s -X POST -H "@$HDR" -H 'Content-Type: application/json' "$API/projects" -d '{"name":"rita"}' | j "['uuid']")}
echo "project $PROJECT"
APP=$(curl -s -X POST -H "@$HDR" -H 'Content-Type: application/json' "$API/applications/dockerimage" -d "{
  \"project_uuid\":\"$PROJECT\",\"server_uuid\":\"$SERVER\",\"environment_name\":\"production\",
  \"name\":\"rita-bot\",\"docker_registry_image_name\":\"localhost:5000/rita-bot\",\"docker_registry_image_tag\":\"latest\",
  \"ports_exposes\":\"8080\",\"domains\":\"$DOMAIN\",\"instant_deploy\":false}" | j "['uuid']")
echo "app $APP"
echo "$APP" > /opt/rita-bot/.coolify_app

# том для SQLite
curl -s -X POST -H "@$HDR" -H 'Content-Type: application/json' "$API/applications/$APP/storages" \
  -d '{"type":"persistent","name":"rita-bot-data","mount_path":"/data"}'; echo

# переменные (значения — из файлов, не из командной строки)
env_add() { python3 -c "import json,sys; print(json.dumps({'key':sys.argv[1],'value':open(sys.argv[2]).read().strip()}))" "$1" "$2" \
  | curl -s -X POST -H "@$HDR" -H 'Content-Type: application/json' "$API/applications/$APP/envs" -d @- >/dev/null; echo "env $1"; }
TMP=$(mktemp); echo "$DOMAIN" > "$TMP"; env_add APP_URL "$TMP"
head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n' > /root/.rita_webhook_secret; env_add WEBHOOK_SECRET /root/.rita_webhook_secret
env_add BOT_TOKEN "$BOT_TOKEN_FILE"
rm -f "$TMP" "$HDR"
echo "готово: $APP"
