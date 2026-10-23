// Запуск того же воркера (src/worker.js) на обычном сервере (Coolify/Docker) вместо Cloudflare.
// D1 → SQLite-файл (node:sqlite), ASSETS → раздача public/, cron → таймер.
// Переменные окружения: BOT_TOKEN, WEBHOOK_SECRET, APP_URL, PORT (8080), DB_PATH (/data/rita.db), ADMIN_IDS (id админов через запятую — им приходят отзывы).
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import worker from "./src/worker.js";
import { createHash } from "node:crypto";
import { verifyInitData } from "./src/tg.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, "public");
const DB_PATH = process.env.DB_PATH || "/data/rita.db";
const PORT = Number(process.env.PORT || 8080);
for (const k of ["BOT_TOKEN", "WEBHOOK_SECRET", "APP_URL"]) if (!process.env[k]) { console.error(`Нет переменной окружения ${k}`); process.exit(1); }

// ---------- D1 поверх SQLite ----------
mkdirSync(dirname(DB_PATH), {recursive:true});
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
const hadLang = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_lang'").get();
sqlite.exec(readFileSync(join(ROOT, "schema.sql"), "utf8"));   // все CREATE ... IF NOT EXISTS — безопасно при каждом старте
// языки появились позже: у тех, кто уже пользовался ботом, оставляем русский; новые — по умолчанию украинский
if (!hadLang) sqlite.exec("INSERT OR IGNORE INTO user_lang(user_id, lang) SELECT user_id, 'ru' FROM members");
// таблица users появилась позже: заводим строки всем, кого уже знаем (родители, язык, канал, отзывы)
sqlite.exec(`INSERT OR IGNORE INTO users(user_id, first_name, first_seen, last_seen, src) SELECT user_id, name, created, created, 'old' FROM members;
  INSERT OR IGNORE INTO users(user_id, first_seen, last_seen, src) SELECT user_id, ok_at, ok_at, 'old' FROM gate;
  INSERT OR IGNORE INTO users(user_id, first_seen, last_seen, src) SELECT user_id, MIN(created), MAX(created), 'old' FROM feedback GROUP BY user_id;
  INSERT OR IGNORE INTO users(user_id, src) SELECT user_id, 'old' FROM user_lang;`);
// миграции колонок, которых нет в старых базах
const cols = (t) => sqlite.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
if (!cols("children").includes("sex")) sqlite.exec("ALTER TABLE children ADD COLUMN sex TEXT");
if (!cols("families").includes("modules")) sqlite.exec("ALTER TABLE families ADD COLUMN modules TEXT");
if (!cols("families").includes("routine")) sqlite.exec("ALTER TABLE families ADD COLUMN routine TEXT");
if (!cols("feedings").includes("paused_at")) sqlite.exec("ALTER TABLE feedings ADD COLUMN paused_at INTEGER");
if (!cols("feedings").includes("pause_ms")) sqlite.exec("ALTER TABLE feedings ADD COLUMN pause_ms INTEGER NOT NULL DEFAULT 0");
if (!cols("sleeps").includes("msg_id")) { sqlite.exec("ALTER TABLE sleeps ADD COLUMN chat_id INTEGER"); sqlite.exec("ALTER TABLE sleeps ADD COLUMN msg_id INTEGER"); }
if (!cols("feedback").includes("liked")) { sqlite.exec("ALTER TABLE feedback ADD COLUMN liked INTEGER NOT NULL DEFAULT 0"); sqlite.exec("ALTER TABLE feedback ADD COLUMN reply TEXT"); sqlite.exec("ALTER TABLE feedback ADD COLUMN reply_at INTEGER"); }
if (!cols("members").includes("role")) sqlite.exec("ALTER TABLE members ADD COLUMN role TEXT");
if (!cols("members").includes("owner")) {   // основной — тот, кто создал семью
  sqlite.exec("ALTER TABLE members ADD COLUMN owner INTEGER NOT NULL DEFAULT 0");
  sqlite.exec("UPDATE members SET owner=1 WHERE user_id IN (SELECT user_id FROM members m WHERE created=(SELECT MIN(created) FROM members WHERE family_id=m.family_id))");
}
const norm = v => v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v;
class Stmt {
  constructor(sql, params = []) { this.sql = sql; this.params = params; }
  bind(...p) { return new Stmt(this.sql, p.map(norm)); }
  async first(col) { const r = sqlite.prepare(this.sql).get(...this.params); if (!r) return null; return col ? r[col] : {...r}; }
  async all() { return {results: sqlite.prepare(this.sql).all(...this.params).map(r => ({...r})), success: true}; }
  async run() { const r = sqlite.prepare(this.sql).run(...this.params); return {success: true, meta: {last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes)}}; }
  async raw() { return sqlite.prepare(this.sql).all(...this.params).map(r => Object.values(r)); }
}
const DB = {
  prepare: sql => new Stmt(sql),
  batch: async stmts => {   // как в D1: всё в одной транзакции
    sqlite.exec("BEGIN");
    try { const out = []; for (const s of stmts) out.push(await s.run()); sqlite.exec("COMMIT"); return out; }
    catch (e) { sqlite.exec("ROLLBACK"); throw e; }
  },
  exec: async sql => { sqlite.exec(sql); return {count: 0}; },
};

// ---------- статика ----------
const TYPES = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json",
  ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".ttf":"font/ttf", ".woff":"font/woff", ".woff2":"font/woff2", ".ico":"image/x-icon", ".webmanifest":"application/manifest+json", ".mp4":"video/mp4"};
const ASSETS = {
  async fetch(req) {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = normalize(join(PUBLIC, p));
    if (!file.startsWith(PUBLIC) || !existsSync(file) || !statSync(file).isFile()) return new Response("Not found", {status: 404});
    const type = TYPES[extname(file)] || "application/octet-stream";
    const cache = /\/cards\//.test(p) ? "public, max-age=86400" : "no-cache";
    return new Response(readFileSync(file), {headers: {"content-type": type, "cache-control": cache}});
  },
};

const env = {DB, ASSETS, BOT_TOKEN: process.env.BOT_TOKEN, WEBHOOK_SECRET: process.env.WEBHOOK_SECRET, APP_URL: process.env.APP_URL, TG_API: process.env.TG_API, GATE_CHANNEL: process.env.GATE_CHANNEL, ONBOARD_VIDEO_URL: process.env.ONBOARD_VIDEO_URL, ADMIN_IDS: process.env.ADMIN_IDS || "", DEV: process.env.DEV === "1" ? "1" : "0"};
const ctx = {waitUntil: p => p.catch(e => console.error(e)), passThroughOnException(){}};

// ---------- живые обновления (Server-Sent Events) ----------
// Клиент держит GET /api/events; после любого успешного изменения через API семья получает событие {by, path, id}.
const streams = new Map();   // family_id → Set<{res, user}>
// вход по личной ссылке (PWA): в базе sha-256 токена, settings web:<хэш> = "uid|имя|дата"
function webUserSync(token){
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token || "")) return null;
  const v = sqlite.prepare("SELECT v FROM settings WHERE k=?").get(`web:${createHash("sha256").update(token).digest("hex")}`)?.v;
  if (!v || !(Date.now() - Date.parse(v.split("|")[2]) < 180 * 864e5)) return null;
  return {id: Number(v.split("|")[0])};
}
async function userFrom(initData, devUser, web){
  if (web && !initData) return webUserSync(web);
  if (devUser && process.env.DEV === "1") return {id: Number(devUser)};
  return verifyInitData(initData, env.BOT_TOKEN);
}
const familyOf = uid => sqlite.prepare("SELECT family_id FROM members WHERE user_id=?").get(uid)?.family_id;
function broadcast(fid, payload, exceptUser){
  const set = streams.get(fid); if (!set) return;
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const s of set) if (s.user !== exceptUser) s.res.write(msg);
}
async function openStream(req, res, url){
  const user = await userFrom(url.searchParams.get("init"), url.searchParams.get("dev_user"), url.searchParams.get("web"));
  const fid = user && familyOf(user.id);
  if (!fid) { res.writeHead(403, {"content-type": "text/plain"}); return res.end("forbidden"); }
  res.writeHead(200, {"content-type": "text/event-stream", "cache-control": "no-cache, no-transform", "connection": "keep-alive", "x-accel-buffering": "no"});
  res.write("retry: 3000\n: connected\n\n");
  const entry = {res, user: user.id, web: url.searchParams.get("web") || null};
  if (!streams.has(fid)) streams.set(fid, new Set());
  streams.get(fid).add(entry);
  const ping = setInterval(() => {   // ссылку отозвали — поток по ней закрываем
    if (entry.web && !webUserSync(entry.web)) { clearInterval(ping); streams.get(fid)?.delete(entry); return res.end(); }
    res.write(": ping\n\n");
  }, 25000);
  req.on("close", () => {
    clearInterval(ping); streams.get(fid)?.delete(entry);
    // Закрыли мини-апп совсем: Telegram убивает окно, и запрос «свернули» из приложения уйти не успевает.
    // Поэтому смотрим сами: если через несколько секунд у человека не осталось ни одного потока (не перезагрузка) — шлём таймеры.
    setTimeout(() => {
      if ([...(streams.get(fid) || [])].some(s => s.user === user.id)) return;
      worker.appClosed(env, user.id).catch(e => console.error("appClosed", e));
    }, Number(process.env.CLOSED_GRACE_MS || 8000));
  });
}

// ---------- HTTP ----------
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/api/events" && req.method === "GET") return openStream(req, res, url);
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length && !["GET", "HEAD"].includes(req.method) ? Buffer.concat(chunks) : undefined;
    const proto = req.headers["x-forwarded-proto"] || "http", host = req.headers["x-forwarded-host"] || req.headers.host;
    const request = new Request(`${proto}://${host}${req.url}`, {method: req.method, headers: req.headers, body});
    const r = await worker.fetch(request, env, ctx);
    // приложение закрыто входом — искать нечего; поддомен не должен попадать в поиск рядом с основным сайтом
    res.writeHead(r.status, {...Object.fromEntries(r.headers), "x-robots-tag":"noindex, nofollow"});
    res.end(Buffer.from(await r.arrayBuffer()));
    // кнопка в боте (кормление) — обновить приложение у всей семьи, включая того, кто нажал
    if (url.pathname === "/tg" && req.method === "POST") {
      try { const cq = JSON.parse(body?.toString() || "{}").callback_query;
        if (cq?.data?.startsWith("gear:")) { const fid = familyOf(cq.from.id), [, v, gid] = cq.data.split(":"); if (fid) broadcast(fid, {by: cq.from.id, path: "/api/check", id: `o:${gid}`, val: Number(v)}, null); }
        if (cq?.data?.startsWith("vac:")) { const fid = familyOf(cq.from.id); if (fid) broadcast(fid, {by: cq.from.id, path: "/api/vaccine", id: null, val: null}, null); }
        if (cq?.data?.startsWith("sleep")) { const fid = familyOf(cq.from.id); if (fid) broadcast(fid, {by: cq.from.id, path: "/api/sleep/bot", id: null, val: null}, null); }
        if (cq?.data?.startsWith("feed")) { const fid = familyOf(cq.from.id); if (fid) broadcast(fid, {by: cq.from.id, path: "/api/feed/bot", id: null, val: null}, null); } } catch {}
    }
    // отозвали ссылки — сразу закрыть открытые по ним потоки
    if (url.pathname === "/api/web/revoke" && req.method === "POST" && r.ok)
      for (const set of streams.values()) for (const s of [...set]) if (s.web && !webUserSync(s.web)) { set.delete(s); s.res.end(); }
    // изменение прошло — сообщить остальным в семье
    // отзыв — личное: второму родителю о нём ничего не показываем
    if (req.method === "POST" && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/export") && !url.pathname.startsWith("/api/feedback") && !url.pathname.startsWith("/api/web/") && r.ok) {
      const user = await userFrom(req.headers["x-init-data"], req.headers["x-dev-user"], req.headers["x-web-token"]);
      const fid = user && familyOf(user.id);
      if (fid) { let id = null, val = null; try { const j = JSON.parse(body?.toString() || "{}"); id = j.id ?? null; val = j.val ?? null; } catch {}
        broadcast(fid, {by: user.id, path: url.pathname, id, val}, user.id); }
    }
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, {"content-type": "text/plain"});
    res.end("error");
  }
}).listen(PORT, () => console.log(`rita-bot on :${PORT}, db ${DB_PATH}`));

// ---------- утренняя рассылка ----------
// Как cron "0 6 * * *": после 06:00 UTC раз в 5 минут; повторно семье в тот же день не шлёт (last_daily).
const tick = () => { if (new Date().getUTCHours() >= 6) worker.scheduled({cron: "0 6 * * *"}, env, ctx); };
setInterval(tick, 5 * 60 * 1000);
// таймеры кормлений в сообщениях бота — раз в минуту
setInterval(() => worker.feedTick(env).catch(e => console.error("feedTick", e)), Number(process.env.FEED_TICK_MS || 60000));
setInterval(() => worker.sleepTick(env).catch(e => console.error("sleepTick", e)), Number(process.env.FEED_TICK_MS || 60000));
setInterval(() => worker.vacTick(env).catch(e => console.error("vacTick", e)), Number(process.env.FEED_TICK_MS || 60000));   // прививка через час
setTimeout(tick, 15 * 1000);
