// Service worker для приложения на главном экране (вне Telegram). Внутри Telegram не регистрируется.
// Всё — «сначала сеть»: модули импортируются без ?v, и кэш-первым легко застрять на старой версии.
// Нет сети — отдаём сохранённое: оболочку, модули, картинки и последний /api/state своего входа (только посмотреть).
// Выход и отзыв ссылок чистят кэш целиком (app.js).
const CACHE = "rita-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

const put = (key, res) => { if (res.ok) caches.open(CACHE).then(c => c.put(key, res)).catch(() => {}); };
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.startsWith("/api/") && u.pathname !== "/api/state") return;
  if (u.pathname.startsWith("/admin")) return;   // админка — только сеть и не под ключом оболочки «/»   // события, файлы, запись — только сеть
  // оболочка одна на все адреса (?k=…, ?tab=…)
  // состояние — под ключом своего входа: чужой или вышедший на этом телефоне его не увидит
  const key = r.mode === "navigate" ? "/" : u.pathname === "/api/state" ? `/api/state?t=${r.headers.get("x-web-token") || ""}` : r;
  e.respondWith(fetch(r).then(res => { put(key, res.clone()); return res; })
    .catch(() => caches.match(key, {ignoreSearch: r.mode === "navigate"}).then(hit => hit || Response.error())));
});
