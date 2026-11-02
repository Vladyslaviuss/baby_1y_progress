# Бот «Первый год» для Coolify. Данные — SQLite в томе /data.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/rita.db
COPY package.json ./
# Рантайму зависимости не нужны: рендер карточек делается заранее (npm run render), картинки лежат в public/cards
COPY schema.sql server.mjs ./
COPY src ./src
COPY public ./public
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--no-warnings", "server.mjs"]
