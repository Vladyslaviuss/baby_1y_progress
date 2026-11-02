// Админка (только ADMIN_IDS): пользователи, семьи, что ведут и трекают, приглашения за них, отзывы с ответами.
// Вход — как у приложения: initData из Telegram (кнопка /admin) или токен входа по ссылке /web в этом браузере.
// Без перевода: интерфейс только для разработчика. Всё, что написали люди, — только через esc().
import { ROUTINE, Q, GEAR, ageOf } from "./data.js";

const tgw = window.Telegram?.WebApp;
try { tgw?.ready(); tgw?.expand(); } catch {}
const initData = tgw?.initData || "";
const qs = new URLSearchParams(location.search);
const wt = initData ? "" : (() => { try { return localStorage.getItem("wt") || ""; } catch { return ""; } })();
const H = initData ? {"x-init-data":initData} : wt ? {"x-web-token":wt} : qs.get("dev_user") ? {"x-dev-user":qs.get("dev_user")} : {};
const root = document.getElementById("ad");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function call(path, body){
  const r = await fetch(path, body ? {method:"POST", headers:{...H, "content-type":"application/json"}, body:JSON.stringify(body)} : {headers:H});
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || `Ошибка ${r.status}`);
  return d;
}
function toast(t){ const el = document.createElement("div"); el.className = "ad-toast"; el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 2200); }

// ---------- форматирование ----------
const pad = n => String(n).padStart(2, "0");
const dt = ms => { if (!ms) return "—"; const d = new Date(ms); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dIso = iso => iso ? iso.split("-").reverse().join(".") : "—";
function ago(ms, now = Date.now()){
  if (!ms) return "—";
  const m = Math.round((now - ms) / 60e3);
  if (m < 2) return "только что"; if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60); if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24); return d < 30 ? `${d} дн назад` : dt(ms).slice(0, 10);
}
const dur = ms => { if (!(ms > 0)) return "—"; const m = Math.round(ms / 60e3); return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60} мин`; };
const today = () => new Date().toISOString().slice(0, 10);
const SEX = {girl:"девочка", boy:"мальчик"}, ROLE = {mama:"мама", papa:"папа"}, SRC = {bot:"бот", app:"Telegram", web:"браузер", old:"—"};
const SIDE = {L:"левая", R:"правая", B:"бутылочка"};
const KIND = {like:"💬 Отзыв", idea:"💡 Идея", issue:"⚠️ Неполадка"}, STATUS = {new:"🆕 новое", seen:"👀 прочитано", done:"✅ сделано"};
const MOD_NAME = {vaccines:"прививки", feeding:"кормления", sleep:"сон", growth:"рост и вес", orders:"вещи"};
const kidLine = k => {
  const nm = k.name || "без имени";
  if (k.birth) { const a = ageOf(k.birth, today()); return `${nm} · род. ${dIso(k.birth)} · ${a.week} нед.${k.sex ? ` · ${SEX[k.sex]}` : ""}`; }
  return `${nm} · ждут${k.due ? ` к ${dIso(k.due)}` : ""}${k.sex ? ` · ${SEX[k.sex]}` : ""}`;
};
const uName = u => esc([u.member_name || u.first_name, u.last_name && !u.member_name ? u.last_name : ""].filter(Boolean).join(" ") || `id ${u.user_id}`);
const tgLink = u => u.username ? `<a href="https://t.me/${esc(u.username)}" target="_blank" rel="noopener">@${esc(u.username)}</a>` : "";

// Подпись отметки: рутина дня, задание недели, вещь
function checkLabel(id, val, fam){
  let m = /^c(\d+):d:(\d{4}-\d{2}-\d{2}):(.+)$/.exec(id);
  if (m) {
    const [, cid, day, rid] = m, kid = fam.children.find(c => String(c.id) === cid);
    const own = fam.routine?.own?.find(o => o.id === rid);
    if (own) return `Рутина: ${own.x} (своё)`;
    const r = ROUTINE.find(x => x.id === rid);
    if (!r) return `Рутина: ${rid}`;
    const wk = kid?.birth ? Math.max(1, ageOf(kid.birth, day).week) : 1;
    return `Рутина: ${(r.st.find(([a, b]) => wk >= a && wk <= b) || r.st[0])[2]}`;
  }
  m = /^c\d+:q:(\d+):(\d+)$/.exec(id);
  if (m) return `Неделя ${m[1]}: ${Q[m[1] - 1]?.[m[2]]?.[1] || "задание"}`;
  m = /^o:(.+)$/.exec(id);
  if (m) return `Вещь: ${GEAR.find(g => g.id === m[1])?.x || m[1]} — ${val === 2 ? "не нужно" : "есть"}`;
  return id;
}
const routineName = id => { const r = ROUTINE.find(x => x.id === id); return r ? r.st[0][2] : id; };

// ---------- состояние и маршрут (#u=ID, #fb) ----------
const S = {view:"users", list:null, filter:"all", q:"", user:null, fb:null, fbFilter:"open", invite:null, err:null};
function route(){
  const h = location.hash.slice(1), m = /^u=(\d+)$/.exec(h);
  if (m) { S.view = "user"; loadUser(Number(m[1])); }
  else if (h === "fb") { S.view = "fb"; if (!S.fb) loadFb(); }
  else S.view = "users";
  if (!S.list) loadUsers();   // цифры сверху нужны на любом экране
  render();
}
addEventListener("hashchange", route);
let listReq = null;
function loadUsers(){ return listReq ||= call("/api/admin/users").then(d => { S.list = d; S.err = null; }, e => { S.err = e.message; }).finally(() => { listReq = null; render(); }); }
async function loadUser(id){ S.user = null; S.invite = null; try { S.user = await call(`/api/admin/user?id=${id}`); S.err = null; } catch (e) { S.err = e.message; } render(); }
async function loadFb(){ try { S.fb = await call("/api/admin/feedback"); S.err = null; } catch (e) { S.err = e.message; } render(); }

// ---------- экраны ----------
function head(){
  const L = S.list, wk = Date.now() - 7 * 864e5;
  const stats = L ? [[L.users.length, "пользователей"], [L.families, "семей"], [L.users.filter(u => u.first_seen > wk).length, "новых за 7 дней"], [L.fbNew, "новых отзывов"]] : [];
  return `<div class="ad-top"><h1>Админка</h1><a class="ad-muted" href="./">← В приложение</a></div>
    ${stats.length ? `<div class="ad-stats">${stats.map(([n, t]) => `<div class="ad-stat"><b>${n}</b><small>${t}</small></div>`).join("")}</div>` : ""}
    <div class="ad-seg"><button data-go="" aria-pressed="${S.view !== "fb"}">Пользователи</button><button data-go="fb" aria-pressed="${S.view === "fb"}">Обратная связь${L?.fbNew ? ` · ${L.fbNew}` : ""}</button></div>`;
}
const FILTERS = [["all", "Все"], ["new", "Новые 7 дн"], ["nofam", "Без семьи"], ["solo", "Без второго родителя"], ["fb", "Писали отзыв"]];
function usersScreen(){
  if (!S.list) return `<p class="ad-empty">Загружаю…</p>`;
  const wk = Date.now() - 7 * 864e5, q = S.q.trim().toLowerCase();
  const rows = S.list.users.filter(u =>
    (S.filter === "all" || (S.filter === "new" && u.first_seen > wk) || (S.filter === "nofam" && !u.family_id) || (S.filter === "solo" && u.family_id && u.parents < 2) || (S.filter === "fb" && u.fb))
    && (!q || [u.member_name, u.first_name, u.last_name, u.username, String(u.user_id), ...u.kids.map(k => k.name)].some(x => x && String(x).toLowerCase().includes(q))));
  return `<div class="ad-seg">${FILTERS.map(([k, t]) => `<button data-filter="${k}" aria-pressed="${S.filter === k}">${t}</button>`).join("")}</div>
    <input class="ad-search" id="ad-q" type="search" placeholder="Имя, @username, id, имя ребёнка" value="${esc(S.q)}">
    ${rows.length ? rows.map(u => `<button class="ad-card" data-user="${u.user_id}">
      <div class="ad-row"><span class="ad-name">${uName(u)} ${u.username ? `<span class="ad-muted">@${esc(u.username)}</span>` : ""}</span><span class="ad-muted">${ago(u.last_seen, S.list.now)}</span></div>
      <div class="ad-muted">${u.kids.length ? u.kids.map(k => esc(kidLine(k))).join("<br>") : u.family_id ? "без детей" : "ещё не завёл семью"}</div>
      <div class="ad-tags">
        ${u.first_seen > wk ? `<span class="ad-tag new">новый · ${dt(u.first_seen).slice(0, 5)}</span>` : ""}
        ${u.family_id ? (u.parents >= 2 ? `<span class="ad-tag ok">вдвоём${u.partner ? ` с ${esc(u.partner.name)}` : ""}</span>` : `<span class="ad-tag warn">один родитель</span>`) : `<span class="ad-tag">без семьи</span>`}
        ${u.role ? `<span class="ad-tag lav">${ROLE[u.role]}${u.owner ? " · основной" : ""}</span>` : ""}
        ${u.week ? `<span class="ad-tag">7 дн: ${u.week.checks} отметок · ${u.week.feeds} корм. · ${u.week.sleeps} сна</span>` : ""}
        ${u.fb ? `<span class="ad-tag new">отзывов: ${u.fb}</span>` : ""}
      </div></button>`).join("") : `<p class="ad-empty">Никого</p>`}`;
}
function userScreen(){
  const back = `<button class="ad-back" data-go="">← Все пользователи</button>`;
  if (!S.user) return back + `<p class="ad-empty">${S.err ? esc(S.err) : "Загружаю…"}</p>`;
  const {user:u, member:m, family:f, feedback, now, max} = S.user;
  const nm = esc([m?.name || u.first_name, u.last_name].filter(Boolean).join(" ") || `id ${u.user_id}`);
  let out = `${back}<h1>${nm}</h1>
    <div class="ad-panel"><dl class="ad-kv">
      <dt>Telegram</dt><dd>${tgLink(u) || "нет @username"} · <code>${u.user_id}</code></dd>
      <dt>Впервые</dt><dd>${u.first_seen ? dt(u.first_seen) : "до учёта"}</dd>
      <dt>Последний раз</dt><dd>${ago(u.last_seen, now)}${u.src ? ` · ${SRC[u.src] || u.src}` : ""}</dd>
      <dt>Язык</dt><dd>${esc(u.lang || "uk (по умолчанию)")}${u.tg_lang ? ` · в Telegram ${esc(u.tg_lang)}` : ""}</dd>
      <dt>Канал</dt><dd>${u.gate_at ? `подписан, проверено ${dt(u.gate_at)}` : m && !m.owner ? "не нужно (приглашён)" : "не проверялось"}</dd>
      ${m ? `<dt>В семье</dt><dd>${m.role ? ROLE[m.role] : "роль не указана"}${m.owner ? " · основной родитель" : " · приглашён"}</dd>` : ""}
    </dl></div>`;
  if (!f) return out + `<div class="ad-panel"><p class="ad-muted">Семью ещё не завёл: открыл бота, но не прошёл настройку.</p></div>` + fbBlock(feedback, now);
  out += `<div class="ad-panel"><h2>${f.children.length > 1 ? "Дети" : "Ребёнок"}</h2><ul class="ad-list">${f.children.map(k => `<li><span>${esc(kidLine(k))}</span><span>добавлен ${dt(k.created).slice(0, 10)}</span></li>`).join("")}</ul></div>`;
  // родители и приглашение
  const solo = f.members.length < max;
  out += `<div class="ad-panel"><h2>Родители</h2><ul class="ad-list">${f.members.map(p => `<li><span>${p.owner ? "★ " : ""}<a href="#u=${p.user_id}">${esc(p.name)}</a>${p.username ? ` · @${esc(p.username)}` : ""}${p.role ? ` · ${ROLE[p.role]}` : ""}</span><span>${ago(p.last_seen, now)}</span></li>`).join("")}</ul>
    ${solo ? `<p class="ad-muted" style="margin:10px 0 0">Второго родителя нет.${f.invites.length ? ` Ссылку уже создавали: ${f.invites.map(i => dt(i.created).slice(0, 10)).join(", ")} (живёт 14 дней).` : " Ссылку ещё не создавали."}</p>
      <div class="ad-btns"><button class="ad-btn" data-invite="${f.id}">Создать ссылку-приглашение</button><button class="ad-btn ghost" data-invite-send="${f.id}">Отправить ссылку основному родителю в бот</button></div>
      ${S.invite ? `<input class="ad-link" readonly value="${esc(S.invite)}" id="ad-inv"><div class="ad-btns"><button class="ad-btn ghost" data-copy>Скопировать</button>
        <a class="ad-btn ghost" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(S.invite)}&text=${encodeURIComponent("Присоединяйся к нашей семье в «Первом годе»")}">Переслать в Telegram</a></div>` : ""}` : ""}</div>`;
  // что ведут и своя рутина
  const own = f.routine?.own || [], adj = Object.entries(f.routine?.adj || {});
  out += `<div class="ad-panel"><h2>Что ведут</h2><div class="ad-tags">${Object.entries(f.modules).map(([k, on]) => `<span class="ad-tag ${on ? "ok" : ""}">${on ? "✓" : "✕"} ${MOD_NAME[k] || k}</span>`).join("")}</div>
    <h2 style="margin-top:14px">Рутина</h2>
    ${own.length || adj.length ? `<ul class="ad-list">
      ${own.map(o => `<li><span>➕ ${esc(o.x)}${o.how ? ` <span class="ad-muted">— ${esc(o.how)}</span>` : ""}</span><span>с ${dIso(o.from)}${o.until ? ` до ${dIso(o.until)}` : ""}</span></li>`).join("")}
      ${adj.map(([id, a]) => `<li><span>${a.off ? "🙈 скрыли" : a.early ? "⏩ раньше плана" : "⏳ продлили"}: ${esc(routineName(id))}</span><span>${a.early ? `этап с ${a.early} нед., с ${dIso(a.from)}` : a.until ? `до ${dIso(a.until)}` : ""}</span></li>`).join("")}
    </ul>` : `<p class="ad-muted">Стандартная, ничего не меняли.</p>`}</div>`;
  // активность
  const days = [...Array(21)].map((_, i) => { const d = new Date(Date.now() - (20 - i) * 864e5).toISOString().slice(0, 10); return [d, f.checkDays.find(x => x.d === d)?.n || 0]; });
  const mx = Math.max(1, ...days.map(d => d[1]));
  const vac = Object.fromEntries(f.vaccines.map(v => [v.status, v.n]));
  out += `<div class="ad-panel"><h2>Активность</h2><dl class="ad-kv">
      <dt>Всего</dt><dd>${f.totals.checks} отметок · ${f.totals.feeds} кормлений · ${f.totals.sleeps} снов</dd>
      <dt>Прививки</dt><dd>${vac.done || 0} сделано · ${vac.booked || 0} записаны · ${vac.planned || 0} впереди${vac.skip ? ` · ${vac.skip} пропущено` : ""}</dd>
      <dt>Замеры</dt><dd>${f.measures.length ? f.measures.slice(0, 3).map(x => `${dIso(x.date)}: ${(x.weight_g / 1000).toFixed(2)} кг${x.length_cm ? `, ${x.length_cm} см` : ""}`).join("; ") : "нет"}</dd>
    </dl>
    <p class="ad-muted" style="margin:12px 0 0">Отметки рутины за 3 недели</p>
    <div class="ad-bars">${days.map(([d, n]) => `<i class="${n ? "on" : ""}" style="height:${Math.round(n / mx * 100)}%" title="${dIso(d)}: ${n}"></i>`).join("")}</div></div>`;
  const by = id => esc(f.members.find(p => p.user_id === id)?.name || "");
  if (f.feeds.length) out += `<div class="ad-panel"><h2>Кормления</h2><ul class="ad-list">${f.feeds.map(x => `<li><span>${dt(x.start_at)} · ${SIDE[x.side] || x.side}${x.end_at ? "" : " · идёт сейчас"}</span><span>${x.end_at ? dur(x.end_at - x.start_at - (x.pause_ms || 0)) : ""} ${by(x.by_user)}</span></li>`).join("")}</ul></div>`;
  if (f.sleeps.length) out += `<div class="ad-panel"><h2>Сон</h2><ul class="ad-list">${f.sleeps.map(x => `<li><span>${dt(x.start_at)}${x.end_at ? "" : " · спит сейчас"}</span><span>${x.end_at ? dur(x.end_at - x.start_at) : ""} ${by(x.by_user)}</span></li>`).join("")}</ul></div>`;
  out += `<div class="ad-panel"><h2>Последние отметки</h2>${f.checks.length ? `<ul class="ad-list">${f.checks.slice(0, 40).map(c => `<li><span>${esc(checkLabel(c.id, c.val, f))}</span><span>${dt(c.at)} ${by(c.by_user)}</span></li>`).join("")}</ul>` : `<p class="ad-muted">Пока ничего не отмечали.</p>`}</div>`;
  return out + fbBlock(feedback, now);
}
const fbBlock = (items, now) => `<h2 style="margin:18px 0 10px">Отзывы и обратная связь</h2>${items.length ? items.map(x => fbItem(x, now)).join("") : `<p class="ad-muted">Не писали.</p>`}`;
function fbItem(x, now){
  const who = x.member_name || x.first_name;
  return `<div class="ad-fb" data-fbid="${x.id}">
    <div class="ad-row"><b>${KIND[x.kind] || x.kind} №${x.id}</b><span class="ad-muted">${STATUS[x.status] || x.status}${x.liked ? " · ❤️" : ""}</span></div>
    <div class="ad-muted">${who !== undefined ? `<a href="#u=${x.user_id}">${esc(who || `id ${x.user_id}`)}</a>${x.username ? ` · @${esc(x.username)}` : ""} · ` : ""}${ago(x.created, now)}${x.updated ? " · изменено" : ""}${x.rating ? ` · ${"★".repeat(x.rating)}${"☆".repeat(5 - x.rating)}` : ""}</div>
    <p>${esc(x.text)}</p>
    ${x.reply ? `<div class="ad-reply">Ответ (${ago(x.reply_at, now)}): ${esc(x.reply)}</div>` : ""}
    <div class="ad-btns">
      ${x.liked ? "" : `<button class="ad-btn ghost" data-fbact="like">❤️ Нравится</button>`}
      ${x.status === "new" ? `<button class="ad-btn ghost" data-fbact="seen">👀 Прочитано</button>` : ""}
      ${x.status !== "done" ? `<button class="ad-btn ghost" data-fbact="done">✅ Сделано</button>` : ""}
      <button class="ad-btn ghost" data-fbreply>💬 ${x.reply ? "Ответить ещё" : "Ответить"}</button>
    </div></div>`;
}
function fbScreen(){
  if (!S.fb) return `<p class="ad-empty">${S.err ? esc(S.err) : "Загружаю…"}</p>`;
  const items = S.fb.items.filter(x => S.fbFilter === "all" || (S.fbFilter === "open" ? x.status !== "done" : x.kind === S.fbFilter));
  return `<div class="ad-seg">${[["open", "Открытые"], ["all", "Все"], ["like", "Отзывы"], ["idea", "Идеи"], ["issue", "Неполадки"]].map(([k, t]) => `<button data-fbfilter="${k}" aria-pressed="${S.fbFilter === k}">${t}</button>`).join("")}</div>
    <p class="ad-muted" style="margin:0 0 10px">Новые сообщения сразу приходят и в бот — с теми же кнопками.</p>
    ${items.length ? items.map(x => fbItem(x, S.fb.now)).join("") : `<p class="ad-empty">Пусто</p>`}`;
}
function render(){
  if (!Object.keys(H).length) { root.innerHTML = `<h1>Админка</h1><div class="ad-panel"><p>Открой админку из бота командой /admin — или войди в приложение в этом браузере по ссылке из /web.</p></div>`; return; }
  if (S.err && !S.list && !S.user && !S.fb) { root.innerHTML = `<h1>Админка</h1><div class="ad-panel"><p>${esc(S.err)}</p></div>`; return; }
  const focus = document.activeElement?.id === "ad-q";
  root.innerHTML = head() + (S.view === "user" ? userScreen() : S.view === "fb" ? fbScreen() : usersScreen());
  if (focus) { const i = document.getElementById("ad-q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}

// ---------- действия ----------
root.addEventListener("input", e => { if (e.target.id === "ad-q") { S.q = e.target.value; render(); } });
root.addEventListener("click", async e => {
  const t = e.target.closest("button, a"); if (!t) return;
  const d = t.dataset;
  if ("go" in d) {   // повторное нажатие — обновить
    if (d.go === "fb") S.fb = null; else S.list = null;
    if (location.hash.slice(1) === d.go) route(); else location.hash = d.go;
    return;
  }
  if (d.user) { location.hash = `u=${d.user}`; return; }
  if (d.filter) { S.filter = d.filter; return render(); }
  if (d.fbfilter) { S.fbFilter = d.fbfilter; return render(); }
  if (d.invite || d.inviteSend) {
    t.disabled = true;
    try {
      const r = await call("/api/admin/invite", {family_id:Number(d.invite || d.inviteSend), send:!!d.inviteSend});
      S.invite = r.link; toast(r.sent ? "Ссылка отправлена основному родителю" : "Ссылка создана");
      loadUser(S.user.user.user_id).then(() => { S.invite = r.link; render(); });
    } catch (err) { toast(err.message); t.disabled = false; }
    return;
  }
  if ("copy" in d) { try { await navigator.clipboard.writeText(S.invite); toast("Скопировано"); } catch { document.getElementById("ad-inv")?.select(); } return; }
  const card = t.closest("[data-fbid]"); if (!card) return;
  const id = Number(card.dataset.fbid);
  if ("fbreply" in d) {
    if (card.querySelector("textarea")) return;
    card.insertAdjacentHTML("beforeend", `<textarea placeholder="Ответ — человек увидит его в приложении и получит в бот"></textarea><div class="ad-btns"><button class="ad-btn" data-fbsend>Отправить ответ</button></div>`);
    return card.querySelector("textarea").focus();
  }
  const act = d.fbact || ("fbsend" in d ? "reply" : null); if (!act) return;
  const text = card.querySelector("textarea")?.value || "";
  if (act === "reply" && !text.trim()) return toast("Пустой ответ");
  t.disabled = true;
  try {
    const r = await call("/api/admin/feedback", {id, act, text});
    for (const list of [S.fb?.items, S.user?.feedback]) { const x = list?.find(i => i.id === id); if (x) Object.assign(x, r.item); }
    toast(act === "reply" ? "Ответ отправлен" : "Готово"); render();
    loadUsers();   // счётчик новых отзывов сверху
  } catch (err) { toast(err.message); t.disabled = false; }
});

route();
