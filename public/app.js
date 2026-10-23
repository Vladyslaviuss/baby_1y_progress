import { W, Q, QT, QH, QA, PHASES, GEAR, GH, GCAT, GEAR_SKIP, isBase, NOTICES, noticeSeason, climateVerdict, orderWeek, gearForWeek, inSeason, RCAT, RH, routineForWeek, routineFor, remindersFor, routineSpan, RWHY, earlyOk, gearStage, weekStartDate, pickTip, weekEndDate, animsForRoutine,
         flagsFor, FLAGS_ALWAYS, urgentFor, ageOf, plural, ageLabel, MONTHLY, monthWord, SECTION_HINTS,
         COLORS, colorHex, dative, genitive, FIRST_AID, EMERGENCY,
         VACCINES, VACCINES_LATER, VSTATUS, vaccinePlan, vaccineDue, vaccineKind, vaccineDate, FA_ANIMS , ROUTINE, Q as QLIST, whoWeight, weightPercentile, Z, SPURTS, SPURT_SIGNS, SPURT_DO, SPURT_DOCTOR,
         LEAP_WEEKS, LEAP_PEAKS, leapOf, LEAP_KIND, LEAP_PEAK, LEAP_NOTE } from "./data.js";
import { animHTML, startPict } from "./anim.js";
import { LANGS, DEFAULT_LANG, setLang, setNames, setBoy, isBoy, watchDom, tr } from "./i18n.js";
import { TIP_SECS, ARTICLES, articleOf, related } from "./tips.js";
import { photoOf } from "./photos.js";
import { pictScene, pictSvg, PICT } from "./pict.js";
import { vaccInfoOf, VACC_NOTE } from "./vacc-info.js";
import { CATS, search, snippet } from "./search.js";
import { FAQ, FAQ_SECS, faqOf, faqDemo, mountDemos } from "./faq.js";
import { SOURCES, VIDEOS } from "./sources.js";

const tgApp = window.Telegram?.WebApp;
const initData = tgApp?.initData || "";
if (tgApp && initData) {   // скрипт Telegram грузится и в обычном браузере, тема — только внутри Telegram
  tgApp.ready(); tgApp.expand();
  tgApp.onEvent?.("themeChanged", () => applyTheme());
}
// Тема: по умолчанию светлая (дизайн «Тёплый круг»), тёмная или «как в Telegram» — по выбору в «Семье»
function applyTheme(){
  let mode = "light"; try { mode = localStorage.getItem("theme") || "light"; } catch {}
  const sys = tgApp && initData ? tgApp.colorScheme : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const t = mode === "auto" ? (sys === "dark" ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = t;
  const bg = t === "dark" ? "#1A1613" : "#FBF6F1";
  try { tgApp?.setHeaderColor?.(bg); tgApp?.setBackgroundColor?.(bg); tgApp?.setBottomBarColor?.(bg); } catch {}
  return mode;
}
applyTheme();
const haptic = (kind) => { try { kind ? tgApp?.HapticFeedback?.notificationOccurred(kind) : tgApp?.HapticFeedback?.selectionChanged(); } catch {} };
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };
// Язык: украинский по умолчанию. Словарь грузится до первого рендера, дальше DOM переводится сам.
let LANG = lsGet("lang") === "ru" ? "ru" : DEFAULT_LANG;
document.documentElement.lang = LANG;
if (LANG === "uk") { try { setLang("uk", (await import("./i18n-uk.js")).default); } catch (e) { console.error("i18n", e); LANG = "ru"; setLang("ru"); } }
else setLang("ru");
watchDom(document.body);
async function switchLang(l){
  if (l === LANG) return;
  lsSet("lang", l); haptic();
  if (!S.demo) await call("/api/lang", {lang:l}).catch(() => {});
  location.reload();
}
const langPick = () => `<div class="seg langseg" role="tablist" aria-label="Мова / Язык">${LANGS.map(([k, n]) => `<button type="button" role="tab" data-lang="${k}" aria-selected="${LANG === k}" translate="no">${n}</button>`).join("")}</div>`;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const view = document.getElementById("view");
const qs0 = new URLSearchParams(location.search);
// Вне Telegram (приложение на главном экране): вход по личной ссылке ?k=… из бота (/web) или из настроек.
// Токен хранится на устройстве; ?k в адресе не убираем — iPhone берёт адрес страницы, когда добавляет её на экран «Домой».
const webToken = initData ? "" : (() => { const k = qs0.get("k"); try { if (k) localStorage.setItem("wt", k); return k || localStorage.getItem("wt") || ""; } catch { return k || ""; } })();
const authH = () => initData ? {"x-init-data": initData} : webToken ? {"x-web-token": webToken} : {};
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const dropCache = () => { try { return caches.delete("rita-v1"); } catch { return Promise.resolve(); } };
let installEvt = null;   // Android/Chrome: системное «Установить приложение» по кнопке
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (S.setSec === "install") render(); });
if (!initData) {
  const ml = document.querySelector('link[rel="manifest"]');
  if (ml) ml.href = `manifest.webmanifest?l=${encodeURIComponent((() => { try { return localStorage.getItem("lang") || "uk"; } catch { return "uk"; } })())}${webToken ? `&k=${encodeURIComponent(webToken)}` : ""}`;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  const mt = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (mt) mt.content = /lang=ru|l=ru/.test(ml?.href || "") ? "Первый год" : "Перший рік";
  // ?k в адресе нужен только iPhone, пока страницу не добавили на «Домой»; в остальных случаях убираем — меньше шансов переслать ключ
  if (qs0.get("k") && (standalone || !isIOS)) history.replaceState(null, "", location.pathname + location.hash);
}
// demo — «просто посмотреть», без сохранения; ob — шаги онбординга
const S = { today:null, children:[], members:[], me:null, checks:{}, vaccines:[], onboarding:false, demo:false, ob:{step:"start"},
            tab:"today", week:null, sel:null, error:null };
// локальная проверка нескольких родителей без Telegram: ?dev_user=2&dev_name=Аня
const devHeaders = !initData && qs0.get("dev_user") ? {"x-dev-user":qs0.get("dev_user"), "x-dev-name":encodeURIComponent(qs0.get("dev_name")||"")} : {};
const openHints = new Set();
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const phaseOf = n => PHASES.find(p => n>=p.from && n<=p.to);
// Цвет недели: плавный переход от первой до 52-й. Опорные точки — цвета этапов в их серединах, между ними — смешивание в OKLab (без грязных серых переходов).
const toLab = hex => { const [r, g, b] = [1, 3, 5].map(i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s]; };
const fromLab = ([L, A, B]) => { const l = (L + .3963377774 * A + .2158037573 * B) ** 3, m = (L - .1055613458 * A - .0638541728 * B) ** 3, s = (L - .0894841775 * A - 1.291485548 * B) ** 3;
  return "#" + [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s]
    .map(c => Math.round(255 * Math.min(1, Math.max(0, c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055))).toString(16).padStart(2, "0")).join(""); };
const WEEK_ANCHORS = PHASES.map((p, i) => [i === 0 ? 1 : i === PHASES.length - 1 ? 52 : (p.from + p.to) / 2, toLab(p.color)]);
const WEEK_COLORS = Array.from({length:52}, (_, i) => {
  const n = i + 1, k = WEEK_ANCHORS.findIndex(([w]) => w >= n);
  if (k <= 0) return fromLab(WEEK_ANCHORS[k < 0 ? WEEK_ANCHORS.length - 1 : 0][1]);
  const [w0, c0] = WEEK_ANCHORS[k - 1], [w1, c1] = WEEK_ANCHORS[k], t = (n - w0) / (w1 - w0);
  return fromLab(c0.map((v, j) => v + (c1[j] - v) * t));
});
const weekColor = n => WEEK_COLORS[Math.min(52, Math.max(1, n)) - 1];
const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const fmtDate = iso => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m-1]}`; };
const addDays = (iso, k) => new Date(Date.parse(iso+"T00:00:00Z") + k*864e5).toISOString().slice(0,10);
const addMonths = (iso, k) => { const [y,m,d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m-1+k, d)).toISOString().slice(0,10); };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const TYPE_HINT = {new:"Что вводим на этой неделе", body:"Массаж, гимнастика, движение", play:"Игра или песня", task:"Дело недели для родителей", order:"Купить заранее: доставка ~3 недели"};

// ---------- дети и группы ----------
// Группа — дети с одной датой (двойня ведётся вместе). Ещё не рождённые — отдельные группы по ПДР.
function nameOf(c){
  if (c.name) return c.name;
  const noName = S.children.filter(x => !x.name);
  return noName.length > 1 ? `Малыш ${noName.indexOf(c) + 1}` : "Малыш";
}
const joinNames = (kids, f = x => x) => { const n = kids.map(c => f(nameOf(c))); return n.length < 2 ? n.join("") : `${n.slice(0,-1).join(", ")} и ${n.at(-1)}`; };
function groups(){
  const m = new Map();
  for (const c of S.children) {
    const key = c.birth ? `b:${c.birth}` : c.due ? `d:${c.due}` : `u:${c.id}`;
    if (!m.has(key)) m.set(key, {key, kids:[], born:!!c.birth, date:c.birth || c.due || null});
    m.get(key).kids.push(c);
  }
  return [...m.values()].sort((a,b) => (b.born - a.born) || String(a.date).localeCompare(String(b.date)));
}
const G = () => { const gs = groups(); return gs.find(g => g.key === S.sel) || gs[0]; };
const ageG = g => ageOf(g.date, S.today);
const curWeek = g => g.born ? Math.min(Math.max(ageG(g).week, 1), 52) : 1;
const weekStart = (g, n) => g.date ? addDays(g.date, (n-1)*7) : null;

// ---------- api ----------
async function call(path, body){
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {...authH(), ...devHeaders, ...(body ? {"content-type":"application/json"} : {})},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 403 && webToken && path === "/api/state") { try { localStorage.removeItem("wt"); } catch {} dropCache(); S.webBad = true; } throw new Error(j.error || `Ошибка ${r.status}`); }
  return j;
}
async function load(){
  if (S.demo) return render();
  try {
    const r = await call("/api/state");
    if (r.onboarding) Object.assign(S, {onboarding:true, today:r.today, suggestedName:r.suggestedName, gate:r.gate || null, error:null});
    else {
      // старые дни календаря, подгруженные через /api/day, в /api/state не входят — переносим их, чтобы не стереть
      const had = S.daysLoaded, kept = {};
      if (had) for (const id in S.checks) { const d = /:d:(\d{4}-\d{2}-\d{2}):/.exec(id)?.[1]; if (d && had.has(d)) kept[id] = S.checks[id]; }
      Object.assign(S, r, {onboarding:false, error:null, skew: (r.now || Date.now()) - Date.now()});
      if (had) { for (const id in kept) if (!(id in S.checks)) S.checks[id] = kept[id]; S.daysLoaded = had; }
      dayIndex.src = null;
    }
    if (!S.sel && qs0.get("child")) S.sel = groups().find(g => g.kids.some(c => String(c.id) === qs0.get("child")))?.key;
  }
  catch (e) { S.error = e.message; }
  if (S.lang && S.lang !== LANG && !load.langSynced) { load.langSynced = true; lsSet("lang", S.lang); return location.reload(); }
  load.langSynced = true;
  setNames([...(S.children || []).map(c => c.name), ...(S.members || []).map(m => m.name)]);
  render();
  if (!S.error && !S.onboarding) connectLive();
  if (S.day && !S.demo && !S.error && !S.onboarding && !dayLoaded(S.day)) fetchDay(S.day);   // выбранный старый день — подгрузить тихо
  if (S.cal) { S.cal.keep = true; renderCal(); }
  if (S.noticeOpen && !load.notice && !S.error && !S.onboarding) {   // из сообщения бота: уже скрыто — показать в архиве
    load.notice = true;
    const x = S.children.length && activeNotices(G()).find(y => y.n.id === S.noticeOpen);
    if (x && isOn(x.key)) return openNoticeArchive();
  }
  if (!S.error && !S.onboarding) celebrateCheck();
}
function toast(t){
  const el = document.getElementById("toast"); el.textContent = t; el.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 3000);
}
// val: true/1 — отмечено, 2 — «не нужно» (только вещи o:…), false/0 — снять
async function setCheck(id, val){
  const prev = S.checks[id];
  val = val === 2 ? 2 : val ? 1 : 0;
  if (val) S.checks[id] = {by:S.me, at:Date.now(), val}; else delete S.checks[id];
  haptic(); render();
  if (S.demo) return;
  try { await call("/api/check", {id, val}); }
  catch (e) { if (prev) S.checks[id] = prev; else delete S.checks[id]; render(); toast("Не сохранилось: " + e.message); }
}
// Вещь уходит из списка («есть» или «не нужно»): зачёркивается, гаснет, строка схлопывается — потом сохраняем.
// Только там, где отмеченное правда пропадает: «Пора заказать» и «Весь список» со «Скрыть отмеченные».
function gearLeave(id, val){
  const row = document.getElementById(`c-${id}`)?.closest(".row.grow");
  const gone = val && S.tab === "orders" && (S.thView !== "all" || S.thHide);
  if (!row || !gone || matchMedia("(prefers-reduced-motion: reduce)").matches) return setCheck(id, val);
  if (row.classList.contains("leaving")) return;
  row.style.height = row.offsetHeight + "px";
  row.classList.add("leaving", val === 2 ? "skip" : "got"); haptic();
  setTimeout(() => row.classList.add("collapse"), 480);
  setTimeout(() => setCheck(id, val), 800);
}
const demoVaccines = birth => vaccinePlan(birth).map((v, i) => ({...v, id:-(i+1), child_id:0, status:"planned", booked_at:null, done_date:null, note:null}));
function startDemo(){
  // с экрана входа (вне Telegram) сервер дату не прислал — берём киевскую дату устройства
  S.today ||= new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Kyiv"}).format(new Date());
  S.error = null;
  const birth = addDays(S.today, -9*7);
  Object.assign(S, {demo:true, onboarding:false, children:[{id:0, name:null, birth, due:null}], members:[{user_id:0, name:"Ты", color:"raspberry"}], me:0, checks:{}, vaccines:demoVaccines(birth), measures:[], feeds:demoFeeds(), sleeps:demoSleeps(), tab:"today", sel:null});
  render(); window.scrollTo(0,0);
}

// ---------- pieces ----------
const memberOf = id => S.members.find(m => m.user_id === id);
const meM = () => memberOf(S.me) || {name:"", color:COLORS[0].id};
const isOn = id => !!S.checks[id];   // для вещей: есть (val 1) или не нужно (val 2)
const isSkip = id => S.checks[id]?.val === 2;
const infoBtn = (key, label="Зачем это") =>
  `<button type="button" class="info" data-hint="${key}" aria-expanded="${openHints.has(key)}" aria-label="${label}" title="${label}">${label==="Как делать"?"▶":"?"}</button>`;
const hintBox = (key, text) => openHints.has(key) ? `<div class="hint">${esc(text)}</div>` : "";
// Строка с отметкой. ids — по одной на ребёнка: [{id, kid}] или одна отметка на семью [{id}].
function checkRow(ids, inner, how, hint, anims=[]){
  const key = "h:" + ids[0].id;
  const hintFull = hint || anims.length ? `${hint?`<p>${esc(hint)}</p>`:""}${anims.map(animHTML).join("")}` : "";
  const allOn = ids.every(x => isOn(x.id));
  const tail = `${hintFull ? infoBtn(key, anims.length ? "Как делать" : "Зачем это") : ""}${hintFull && openHints.has(key) ? `<div class="hint">${hintFull}</div>` : ""}`;
  if (ids.length === 1) {
    const {id} = ids[0], c = S.checks[id], who = c && memberOf(c.by);
    return `<div class="row" ${who?`style="--who:${colorHex(who.color)}"`:""}>
      <input type="checkbox" id="c-${id}" data-id="${id}" ${c?"checked":""}>
      <label for="c-${id}"><span class="t">${inner}${who?`<span class="by">${esc(who.name)}</span>`:""}</span>${how?`<span class="how">${how}</span>`:""}</label>${tail}</div>`;
  }
  const pills = ids.map(({id, kid}) => {
    const c = S.checks[id], who = c && memberOf(c.by);
    return `<label class="kid" ${who?`style="--who:${colorHex(who.color)}"`:""} title="${who?`Отметил(а) ${esc(who.name)}`:"Не отмечено"}">
      <input type="checkbox" data-id="${id}" ${c?"checked":""}><span>${esc(nameOf(kid))}</span></label>`;
  }).join("");
  return `<div class="row multi ${allOn?"all":""}">
    <div class="txt"><span class="t">${inner}</span>${how?`<span class="how">${how}</span>`:""}<div class="kids">${pills}</div></div>${tail}</div>`;
}
const kidIds = (g, suffix) => g.kids.map(kid => ({id:`c${kid.id}:${suffix}`, kid}));
const secHead = (title, key, extra="") => `<div class="head"><h2>${title}</h2><span class="head-r">${extra}${infoBtn("s:"+key, "Что это за раздел")}</span></div>${hintBox("s:"+key, SECTION_HINTS[key])}`;
const chip = k => `<span class="chip ${k}" title="${TYPE_HINT[k]}">${QT[k]}</span>`;
function ageText(a){ return `${a.months?`${a.months} мес `:""}${a.rest} ${plural(a.rest,"день","дня","дней")}`; }
function orderDue(g, item, cur){
  const k = item.need - cur, when = weekStart(g, item.need);
  if (!g.born) return when ? `нужно к ${fmtDate(when)} · неделя жизни ${item.need}` : `нужно на неделе жизни ${item.need}`;
  if (k <= 0) return `нужно уже сейчас`;
  return `нужно к ${fmtDate(when)} · неделя ${item.need}, через ${k} ${plural(k,"неделю","недели","недель")}`;
}
const twinsNote = g => g.kids.length > 1 ? ` · ×${g.kids.length}, где нужно каждому` : "";
function weekProgress(g, n){
  const ids = [...Q[n-1].flatMap((_,i) => kidIds(g, `q:${n}:${i}`).map(x => x.id)), ...gearForWeek(n).map(x => `o:${x.id}`)];
  return [ids.filter(isOn).length, ids.length];
}
// Недельная логика — только для вещей с need ≥ 4; базовый набор (need 0) живёт во «Весь список».
const WEEKLY = GEAR.filter(x => x.need >= 4);
const ordersNow = (g) => { const cur = curWeek(g); return WEEKLY.filter(x => (g.born ? orderWeek(x) <= cur && x.need >= cur : x.need <= 6) && !isOn(`o:${x.id}`) && inSeason(x, S.today)); };
// После рождения «Подготовка до родов» уже позади — в базовый набор не входит.
const BASE = GEAR.filter(isBase);
const baseOf = g => g?.born ? BASE.filter(x => x.cat !== "prep") : BASE;
const baseDone = list => list.filter(x => isOn(`o:${x.id}`)).length;
const bar = (d, t) => `<div class="gbar" aria-hidden="true"><i style="width:${t ? Math.round(d / t * 100) : 0}%"></i></div>`;
const ofN = (d, t) => `${d} <span>из</span> ${t}`;
// Когда нужна вещь — коротко, для «Весь список»
const needShort = x => x.need < 4 ? "" : x.need < 13 ? `нужно к неделе ${x.need}` : `нужно к ${Math.round(x.need / 4.35)} мес`;
// Цвет метки «нужно к…» по тому, сколько осталось: уже/скоро — тёплый, через месяц-два — жёлтый, нескоро — спокойный
const needCls = (g, x) => { const k = x.need - (g?.born ? curWeek(g) : 0); return k <= 2 ? "now" : k <= 6 ? "soon" : k <= 12 ? "mid" : "later"; };
const needTag = (g, x) => x.need < 4 ? "" : `<span class="ntag ${needCls(g, x)}">${needShort(x)}</span>`;
const dueTag = (g, x, cur) => `<span class="ntag due ${needCls(g, x)}">${orderDue(g, x, cur)}${twinsNote(g)}</span>`;
// Строка вещи: «есть» (чекбокс цветом родителя), условие, «не нужно», подсказка с предупреждением.
function gearRow(x, how = "", pre = "", why = false){
  const id = `o:${x.id}`, c = S.checks[id], skip = c?.val === 2, who = c && memberOf(c.by), key = "h:" + id;
  const hint = GH[x.id] ? `<p>${esc(GH[x.id])}</p>` : "";
  return `<div class="row grow ${skip ? "skipped" : ""} ${S.focusGear === x.id ? "found" : ""}" id="g-${x.id}" ${who ? `style="--who:${colorHex(who.color)}"` : ""}>
    <input type="checkbox" id="c-${id}" data-id="${id}" ${c && !skip ? "checked" : ""} aria-label="Есть: ${esc(x.x)}">
    <label for="c-${id}"><span class="t">${pre}<span class="nm">${esc(x.x)}</span>${who ? `<span class="by">${esc(who.name)}</span>` : ""}</span>${x.cond ? `<span class="cond">${esc(x.cond)}</span>` : ""}${x.warn ? `<span class="gwarn">${esc(x.warn)}</span>` : ""}${how ? `<span class="how">${how}</span>` : ""}</label>
    <span class="gr-r"><button type="button" class="gskip" data-skip="${id}" aria-pressed="${skip}" title="Не нужно — убрать из списка покупок">не нужно</button>${hint && !why ? infoBtn(key) : ""}</span>
    ${gearRt(x, c && !skip)}
    ${hint && why ? `<p class="g-why">${esc(GH[x.id])}</p>` : hint && openHints.has(key) ? `<div class="hint">${hint}</div>` : ""}</div>`;
}
// Отметили «есть» у вещи, чей этап рутины ещё впереди, — спросить, включить ли его сейчас (отмеченная вещь из списка уходит)
function rtAskFor(id, on){
  const x = GEAR.find(g => `o:${g.id}` === id), st = gearStage(x), g = G();
  if (!on || !st || !g?.born || !earlyOk(st.id)) { if (S.rtAsk === x?.id) S.rtAsk = null; return; }
  const wk = Math.max(1, ageG(g).week), a = S.routine?.adj?.[st.id];
  if (wk < st.a && !a?.off && a?.early !== st.a) S.rtAsk = x.id;
}
function rtAskBlock(){
  const x = GEAR.find(g => g.id === S.rtAsk), st = gearStage(x), g = G(); if (!st || !g) return "";
  return `<div class="panel rt-ask"><p><b>${esc(x.x)}</b> — отмечено. В рутине «${esc(st.x)}» появится сам с ${fmtDate(weekStartDate(g.date, st.a))}.</p>
    <p class="muted">${esc(st.how)}</p>
    <div class="frow"><button type="button" class="btn small" data-rearly="${st.id}|${st.a}">Включить сейчас</button><button type="button" class="btn ghost small" data-rtno>Пусть по плану</button></div></div>`;
}
// Вещь и рутина: когда она появится в рутине; если вещь уже есть — можно включить этап сейчас
function gearRt(x, have){
  const g = G(), st = gearStage(x); if (!st || !g?.born) return "";
  const wk = Math.max(1, ageG(g).week), a = S.routine?.adj?.[st.id], end = ROUTINE.find(r => r.id === st.id).st.find(s => s[0] === st.a)[1];
  if (wk > end || a?.off) return "";
  if (wk >= st.a || (a?.early === st.a && S.today >= a.from)) return `<div class="g-rt"><span>✓ В рутине: «${esc(st.x)}»</span></div>`;
  return `<div class="g-rt"><span>В рутине с ${fmtDate(weekStartDate(g.date, st.a))}: «${esc(st.x)}»</span>${have && earlyOk(st.id) ? `<button type="button" class="link" data-rearly="${st.id}|${st.a}">Уже есть — включить сейчас</button>` : ""}</div>`;
}

// ---------- «Важное»: сезонные уведомления ----------
// Активные сегодня: show-окно, условие по возрасту. В демо — отопительный сезон как пример.
function activeNotices(g){
  const out = [];
  for (const n of NOTICES) {
    let season = noticeSeason(n.show, S.today);
    if (season === null && S.demo && n.id === "heating") season = Number(S.today.slice(0, 4));
    if (season === null) continue;
    if (n.minWeeks && !(g?.born && ageG(g).week >= n.minWeeks)) continue;
    out.push({n, season, key:`n:${n.id}:${season}:u${S.me}`});
  }
  return out;
}
const climateBox = () => `<div class="cc"><span class="eyebrow">Климат-чек</span>
  <div class="cc-in"><label>°C<input type="number" inputmode="decimal" step="0.5" data-cc="t" value="${esc(S.ccT ?? "")}" aria-label="Температура, °C"></label>
  <label>%<input type="number" inputmode="numeric" data-cc="h" value="${esc(S.ccH ?? "")}" aria-label="Влажность, %"></label></div>
  <p class="cc-out">${esc(climateText())}</p></div>`;
const ccNum = v => v === "" || v == null ? NaN : Number(String(v).replace(",", "."));
const climateText = () => climateVerdict(ccNum(S.ccT), ccNum(S.ccH)) || "Введи температуру и влажность в детской";
function noticeCard({n, key}, full = false){
  const open = full || S.noticeOpen === n.id;
  const go = n.go && MOD().orders && !full ? `<button type="button" class="btn small" data-ngo="${n.id}">Что купить →</button>` : "";
  return `<div class="panel notice" id="nt-${n.id}">
    <span class="eyebrow">⚠️ Важное</span>
    <h2>${esc(n.title)}</h2>
    <p>${esc(n.lead)}</p>
    ${open ? `<ul class="nt-list">${n.items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>${n.climate ? climateBox() : ""}` : ""}
    <div class="nt-actions">${full ? "" : `<button type="button" class="link" data-nmore="${n.id}">${open ? "Свернуть" : "Подробнее"}</button>`}${go}
      ${full ? (isOn(key) ? `<button type="button" class="btn ghost small" data-nunread="${key}">Вернуть на главную</button>` : "") : `<button type="button" class="btn ghost small" data-nread="${key}">Понятно, скрыть</button>`}</div>
  </div>`;
}
const noticesBlock = g => activeNotices(g).filter(x => !isOn(x.key)).map(x => noticeCard(x)).join("");
function openNoticeArchive(){
  const list = activeNotices(S.children.length ? G() : null);
  openSheet(`<div class="sheet-head"><h2 class="plain">Прочитанные уведомления</h2><button type="button" class="sheet-x" data-sheet-close aria-label="Закрыть">×</button></div>
    ${list.length ? list.map(x => noticeCard(x, true)).join("") : `<p class="empty">В этом сезоне уведомлений нет.</p>`}`);
}

// ---------- общие куски экранов ----------
function demoBar(){
  if (!S.demo) return "";
  const w = curWeek(G());
  const opts = Array.from({length:52}, (_,i) => `<option value="${i+1}" ${i+1===w?"selected":""}>неделя ${i+1}</option>`).join("");
  return `<div class="demo-bar"><div><b>Демо-режим</b><span>Отметки не сохраняются. Возраст для примера:</span>
    <select id="demo-week" aria-label="Возраст в демо">${opts}</select></div>
    <button class="btn small" type="button" id="demo-exit">Начать по-настоящему</button></div>`;
}
function switcher(){
  const gs = groups(); if (gs.length < 2) return "";
  const cur = G();
  return `<div class="switch" role="tablist" aria-label="Ребёнок">${gs.map(g =>
    `<button type="button" role="tab" data-sel="${g.key}" aria-selected="${g.key===cur.key}">${esc(joinNames(g.kids))}${g.born?"":" · ждём"}</button>`).join("")}</div>`;
}
function whoLine(){
  if (S.demo) return "";
  const chips = S.members.map(m => `<span style="--c:${colorHex(m.color)}"><i></i>${esc(m.name)}${m.user_id===S.me?" (ты)":""}</span>`).join("");
  return `<div class="who"><span class="eyebrow">Отмечают:</span>${chips}${S.members.length<2?`<button class="btn ghost small" type="button" data-go="family" data-sec="family">+ второй родитель</button>`:""}</div>`;
}
function swatches(selected, takenBy){
  return `<div class="swatches" role="radiogroup" aria-label="Любимый цвет">${COLORS.map(c => {
    const taken = takenBy && takenBy(c.id);
    return `<button type="button" class="sw" style="--c:${c.hex}" data-color="${c.id}" aria-pressed="${c.id===selected}" ${taken?"disabled":""} title="${c.name}${taken?` — у ${esc(taken)}`:""}" aria-label="${c.name}"></button>`;
  }).join("")}</div>`;
}

// ---------- онбординг: приветствие → (подписка) → кто вы → малыш → что ведём → позвать второго ----------
const MOD_LIST = [
  ["vaccines", "Прививки", "Календарь МОЗ, напоминания за 3 дня и за час до записи"],
  ["feeding", "Кормление", "Таймер, история, график по дням"],
  ["sleep", "Сон", "Когда спит, сколько за сутки и как меняется режим"],
  ["growth", "Вес и рост", "Нормы ВОЗ, скачки роста"],
  ["orders", "Вещи", "Полный список и что заказать за 3 недели до нужды"],
];
const MOD = () => S.demo ? {vaccines:true, feeding:true, sleep:true, growth:true, orders:true} : (S.modules || {vaccines:true, feeding:true, sleep:true, growth:true, orders:true});
const OB_STEPS = () => [...(S.gate?.required && !S.gate?.passed ? ["gate"] : []), "role", "baby", "modules"];
function obDots(step){
  const st = OB_STEPS(), i = st.indexOf(step);
  return `<div class="ob-top"><button type="button" class="link back" data-ob="${i > 0 ? st[i - 1] : "start"}">← Назад</button>
    <div class="ob-dots" aria-label="Шаг ${i + 1} из ${st.length}">${st.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div><span></span></div>`;
}
const toggle = (key, on, title, sub) => `<label class="tgl"><span><b>${title}</b><small>${sub}</small></span>
  <input type="checkbox" role="switch" data-mod="${key}" ${on ? "checked" : ""}><i aria-hidden="true"></i></label>`;
function onboardingScreen(){
  const ob = S.ob;
  ob.color = ob.color || (ob.role === "papa" ? "blue" : COLORS[0].id);
  ob.kids ||= [{name:"", birth:"", due:"", sex:""}];
  ob.mods ||= {vaccines:true, feeding:true, sleep:true, growth:true, orders:true};
  ob.born ??= true;
  if (ob.step === "start") return `
    <div class="ob-welcome">
      <div class="ob-blobs" aria-hidden="true"><i></i><i></i><i></i></div>
      ${langPick()}
      <span class="eyebrow" style="color:var(--accent)">Первый год</span>
      <h1 class="ob-h1">Спокойнее,<br>когда вдвоём</h1>
      <p class="muted" style="font-size:16px;max-width:300px">Недели, рутина на день, кормления и прививки. Отмечайте вместе — каждый своим цветом.</p>
      <div class="ob-circle" aria-hidden="true"><span>1</span><small>год вместе</small></div>
      <button type="button" class="btn ob-cta" data-ob="${OB_STEPS()[0]}">Начать — 30 секунд</button>
      <button type="button" class="link" data-ob="demo" style="text-align:center">Просто посмотреть, что внутри</button>
    </div>`;
  if (ob.step === "gate") return `${obDots("gate")}
    <div class="ob-card">
      <span class="eyebrow">Один шаг до старта</span>
      <h1>Подпишитесь на канал</h1>
      <p class="muted">Приложение бесплатное для подписчиков канала <b>${esc(S.gate.channel)}</b>. Подпишитесь и вернитесь сюда.</p>
      <a class="btn ob-cta" href="${esc(S.gate.url)}" data-gate-open>Открыть канал</a>
      <button type="button" class="btn ghost ob-cta" id="gate-check">Подписка есть — проверить</button>
      <p class="muted" style="font-size:13px">Второму родителю подписка не нужна — он придёт по вашему приглашению.</p>
    </div>`;
  if (ob.step === "role") return `${obDots("role")}
    <div class="ob-card">
      <h1>Кто вы?</h1>
      <div class="ob-pick">${[["mama", "Мама"], ["papa", "Папа"]].map(([k, n]) => `<button type="button" data-role="${k}" aria-pressed="${ob.role === k}">${n}</button>`).join("")}</div>
      <div class="field"><label for="ob-me">Как вас зовут</label><input id="ob-me" autocomplete="given-name" value="${esc(ob.me ?? S.suggestedName ?? "")}"></div>
      <div class="field"><label>Ваш цвет — им будет зачёркиваться то, что сделали вы</label>${swatches(ob.color)}</div>
      <button type="button" class="btn ob-cta" data-ob-next="baby">Дальше</button>
    </div>`;
  if (ob.step === "baby") {
    const kids = ob.kids.map((k, i) => `
      <div class="kid-form">
        ${ob.kids.length > 1 ? `<div class="head"><h3>Малыш ${i + 1}</h3>${i > 0 ? `<button type="button" class="link" data-ob-del="${i}">Убрать</button>` : ""}</div>` : ""}
        <div class="field"><label for="ob-name-${i}">Имя</label><input id="ob-name-${i}" data-ob-kid="${i}" data-f="name" autocomplete="off" placeholder="${ob.born ? "Например, Рита" : "Можно позже"}" value="${esc(k.name)}"></div>
        ${ob.born
          ? `<div class="field"><label for="ob-birth-${i}">Дата рождения</label><input type="date" id="ob-birth-${i}" data-ob-kid="${i}" data-f="birth" max="${S.today}" value="${esc(k.birth)}"></div>`
          : `<div class="field"><label for="ob-due-${i}">Предполагаемая дата родов — можно пропустить</label><input type="date" id="ob-due-${i}" data-ob-kid="${i}" data-f="due" min="${S.today}" value="${esc(k.due)}"></div>`}
        <div class="ob-pick small">${[["girl", "Девочка"], ["boy", "Мальчик"]].map(([s, n]) => `<button type="button" data-sexkid="${i}" data-s="${s}" aria-pressed="${k.sex === s}">${n}</button>`).join("")}</div>
      </div>`).join("");
    return `${obDots("baby")}
    <div class="ob-card">
      <h1>${ob.kids.length > 1 ? "Малыши" : "Малыш"}</h1>
      <div class="seg" role="tablist">${[[true, "Уже родился"], [false, "Ждём"]].map(([v, n]) => `<button type="button" role="tab" data-obborn="${v}" aria-selected="${ob.born === v}">${n}</button>`).join("")}</div>
      ${kids}
      ${ob.kids.length < 4 ? `<button type="button" class="link" id="ob-add" style="text-align:left">${ob.kids.length === 1 ? "+ Двойня" : "+ Ещё ребёнок"}</button>` : ""}
      <button type="button" class="btn ob-cta" data-ob-next="modules">Дальше</button>
    </div>`;
  }
  // что ведём
  const old = ob.born && ob.kids.some(k => k.birth && daysBetween(k.birth, S.today) >= 56);
  return `${obDots("modules")}
    <div class="ob-card">
      <h1>Что будем вести?</h1>
      <p class="muted">Рутина, недели, советы и первая помощь есть всегда. Остальное — по желанию, можно поменять потом: ⚙️ Настройки → «Что ведём».</p>
      <div class="tgls">${MOD_LIST.map(([k, t, s]) => toggle(k, ob.mods[k], t, s)).join("")}</div>
      ${old && ob.mods.vaccines ? `<div class="ob-q"><b>Прививки до сегодня сделаны по календарю?</b>
        <div class="ob-pick small">${[[true, "Да, все"], [false, "Отмечу сам(а)"]].map(([v, n]) => `<button type="button" data-pastdone="${v}" aria-pressed="${(ob.pastDone ?? true) === v}">${n}</button>`).join("")}</div>
        <small class="muted">Чтобы не было стены красного. Отдельные даты можно поправить в «Прививках».</small></div>` : ""}
      ${old ? `<p class="note-small">Начнём с сегодняшнего дня: задания прошлых недель не будут висеть как долги.</p>` : ""}
      <button type="button" class="btn ob-cta" id="ob-save">Готово</button>
    </div>`;
}
// после создания — позвать второго родителя (только основной)
function inviteScreen(){
  const who = S.role === "papa" ? "маму" : S.role === "mama" ? "папу" : "второго родителя";
  return `<div class="ob-card" style="margin-top:24px">
    <div class="ob-circle small" aria-hidden="true"><span>2</span><small>родителя</small></div>
    <h1>Позовите ${who}</h1>
    <p class="muted">По ссылке ${who === "маму" ? "мама попадёт" : who === "папу" ? "папа попадёт" : "второй родитель попадёт"} в вашу семью: те же уведомления, общие отметки — каждая своим цветом. Пригласить можно одного человека.</p>
    <button type="button" class="btn ob-cta" id="invite">Отправить приглашение</button>
    ${S.inviteLink ? `<p class="mono" style="font-size:12px;word-break:break-all">${esc(S.inviteLink)}</p>` : ""}
    <button type="button" class="link" data-invite-later style="text-align:center">Позже</button>
  </div>`;
}

// ---------- экраны ----------
function expectingScreen(g){
  const d = g.date ? daysBetween(S.today, g.date) : null;
  const base = baseOf(g), done = baseDone(base);
  return `${demoBar()}${switcher()}
  ${noticesBlock(g)}
  <div class="hero" style="--ph:${PHASES[0].color}">
    <span class="eyebrow">${g.kids.length > 1 ? "Ждём двойню" : "Ждём малыша"}${g.date ? ` · ПДР ${fmtDate(g.date)}` : ""}</span>
    <h1>${d === null ? "Скоро встретимся" : d > 0 ? `До встречи ${d} ${plural(d,"день","дня","дней")}` : "Уже вот-вот!"}</h1>
    <p>${g.kids.some(k => k.name) ? esc(joinNames(g.kids)) + ". " : ""}Когда малыш родится, укажи дату — начнутся карточки недель, рутина и поздравления.</p>
  </div>
  <button class="btn" type="button" data-go="family" data-sec="kids">${g.kids.length > 1 ? "Малыши родились!" : "Малыш родился!"}</button>
  ${whoLine()}
  ${MOD().orders ? `<div class="panel">
    ${secHead("Подготовить до родов", "orders", `<span class="prog ${done===base.length?"full":""}">${ofN(done, base.length)}</span>`)}
    <p class="muted" style="font-size:14px">Базовый набор: что нужно дома к выписке и в первые недели${twinsNote(g)}. Ненужное отметь «не нужно».</p>
    ${bar(done, base.length)}
    <button class="btn ghost" type="button" data-thgo="all">Открыть весь список</button>
  </div>` : ""}
  <div class="panel">
    <h2>Что будет внутри</h2>
    <p class="muted" style="font-size:14.5px">52 недели с заданиями, рутина на каждый день с анимациями «как делать», заказы за 3 недели до нужды, красные флаги по возрасту и праздники каждый месяц.</p>
    <button class="btn ghost" type="button" data-go="week">Посмотреть первую неделю</button>
  </div>`;
}

function todayScreen(){
  const g = G();
  if (!g) return "";
  if (!g.born) return expectingScreen(g);
  const a = ageG(g);
  if (a.week > 52) return `${demoBar()}${switcher()}<div class="panel"><h2>${esc(joinNames(g.kids, dative))} уже больше года</h2><p class="muted">План первого года закончен.</p></div>`;
  const n = a.week, ph = phaseOf(n), left = 7 - a.dayOfWeek;
  const [qd, qt] = weekProgress(g, n);
  const routine = routineFor(g.date, S.today, S.routine);
  const rIds = routine.flatMap(r => kidIds(g, `d:${S.today}:${r.id}`).map(x => x.id));
  const rDone = rIds.filter(isOn).length;
  const due = ordersNow(g).length;
  return `${demoBar()}${switcher()}
  ${liveBar(g)}
  ${noticesBlock(g)}
  ${dayStrip(g)}
  ${ringHero(g, a, n, left)}
  <div class="today-sec"><h2>На сегодня</h2><span class="muted" style="font-size:13px">${esc(ph.name)}</span></div>
  <div class="tiles">
    <button class="tile ${qd===qt?"ok":""}" data-go="week" title="Разовые задания текущей недели"><b>${qd}/${qt}</b><span>задания недели</span></button>
    <button class="tile" data-go="today-r" title="Ритм дня: что полезно сегодня"><b>${rDone ? `сделано ${rDone}` : `${rIds.length}`}</b><span>${rDone ? "ритм дня" : `${plural(rIds.length, "пункт", "пункта", "пунктов")} · ритм дня`}</span></button>
    ${MOD().orders ? `<button class="tile ${due?"alert":"ok"}" data-go="orders" title="Вещи, которые пора заказать с учётом доставки"><b>${due}</b><span>пора заказать</span></button>` : ""}
  </div>
  ${dayTipBlock(g)}
  ${MOD().orders ? ordersBlock(g) : ""}
  ${MOD().feeding ? feedStat(g) : ""}
  ${MOD().sleep ? sleepStat(g) : ""}
  ${weekMini(g, n)}
  ${whoLine()}
  ${routineBlock(g)}`;
}
// «Совет дня» — тот же, что в утреннем сообщении бота; «Подробнее» ведёт в статью, если она есть
function dayTipBlock(g){
  const tip = S.demo ? pickTip({birth:g.date, sex:g.kids[0]?.sex}, S.today) : S.tip; if (!tip) return "";   // в демо — без истории
  const art = tip.go && articleOf(tip.go);
  return `<div class="panel daytip"><span class="eyebrow">💡 Совет дня</span><p>${esc(tip.t)}</p>${art ? `<button type="button" class="link" data-art="${art.id}">${esc(art.title)} →</button>` : ""}</div>`;
}
// «Пора заказать» на «Сегодня»: сами вещи с отметками, чтобы не терялись внутри недели
function ordersBlock(g){
  const now = ordersNow(g); if (!now.length) return "";
  const cur = curWeek(g), more = now.length - 4;
  return `<div class="panel tord"><div class="head"><h2>Пора заказать</h2><span class="prog">${now.length}</span></div>
    <p class="muted" style="font-size:13.5px;margin:0">Доставка ~3 недели. Заказали, уже есть или не нужно — отметь.</p>
    ${now.slice(0, 4).map(x => gearRow(x, dueTag(g, x, cur))).join("")}
    <button type="button" class="link" data-go="orders">${more > 0 ? `Ещё ${more} — во «Вещах» →` : "Все вещи →"}</button></div>`;
}
// Неделя на «Сегодня»: коротко, вся неделя — подэкраном
function weekMini(g, n){
  const w = W[n-1], ph = phaseOf(n), [d, t] = weekProgress(g, n);
  return `<div class="panel weekmini" style="--ph:${weekColor(n)}"><span class="eyebrow">Неделя ${n} · ${esc(ph.name)}${leapTag(n)}</span>
    <h2>${esc(w.t)}</h2><p class="clamp2">${esc(w.d)}</p>
    <div class="head"><span class="prog ${d===t?"full":""}">задания недели ${d}/${t}</span><button type="button" class="btn small" data-go="week">Вся неделя →</button></div></div>`;
}

function weekScreen(){
  const g = G(), cur = g.born ? ageG(g).week : null;
  const n = S.week || (cur && cur <= 52 ? cur : 1);
  S.week = n;
  const w = W[n-1], ph = phaseOf(n), gear = gearForWeek(n);
  const [d, t] = weekProgress(g, n);
  const opts = W.flatMap((x, i) => { const p = phaseOf(i + 1); return [...(p.from === i + 1 ? [{head:p.name, dot:weekColor(i + 1)}] : []), {v:i + 1, t:`Неделя ${i + 1}`, sub:x.t, dot:weekColor(i + 1), badge:i + 1 === cur ? "сейчас" : ""}]; });
  const from = weekStart(g, n);
  return `${demoBar()}<button type="button" class="link back" data-back>← Назад</button>${switcher()}
  <div class="weeknav">
    <button type="button" data-wk="${n-1}" ${n<=1?"disabled":""} aria-label="Предыдущая неделя">‹</button>
    ${dropdown("wk-sel", opts, n, {label:"Выбрать неделю", pick:"week"})}
    <button type="button" data-wk="${n+1}" ${n>=52?"disabled":""} aria-label="Следующая неделя">›</button>
  </div>
  <div class="hero" style="--ph:${weekColor(n)}">
    <span class="eyebrow">Неделя ${n} · ${ageLabel(n)}${from && g.born ? ` · с ${fmtDate(from)}` : ""}</span>
    <h1>${esc(w.t)}</h1>
    <p>${esc(ph.name)}${n===cur?" · текущая неделя":""}${g.born ? "" : " · так это будет после рождения"}</p>
  </div>
  ${leapBox(n)}
  <div class="panel">
    <div class="blk"><span class="eyebrow">Что происходит</span><p>${esc(w.d)}</p></div>
  </div>
  <div class="panel">
    ${secHead("Задания недели", "quests", `<span class="prog ${d===t?"full":""}">${d}/${t}</span>`)}
    <p class="note-small nb-hint">Идеи на эту неделю, не обязаловка. Что-то не подошло — пропусти.</p>
    ${Q[n-1].map(([k,x],i) => checkRow(kidIds(g, `q:${n}:${i}`), `${chip(k)}${esc(x)}`, "", QH[n-1][i], QA[`${n}:${i}`]||[])).join("")}
    ${gear.map(x => gearRow(x, dueTag(g, x, n), chip("order"))).join("")}
  </div>
  <div class="panel wsleep"><div class="head"><span class="eyebrow">Сон в этом возрасте</span>${MOD().sleep && g.born ? `<button type="button" class="link" data-go="sleep">Мой сон →</button>` : ""}</div>
    <p><b>${sleepNorm(n - .5).join("–")} ч</b> за сутки вместе с дневным</p>${sleepFacts(n - .5)}</div>
  <div class="panel">
    <div class="blk"><span class="eyebrow">Важно помнить</span><ul>${w.a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="blk"><span class="eyebrow">Почему</span><p class="muted">${esc(w.w)}</p></div>
    <div class="lang-box"><span class="eyebrow">Язык</span>${esc(w.l)}</div>
    ${w.m?`<div class="med-box"><span class="eyebrow">Врач</span>${esc(w.m)}${/прививк|БЦЖ/i.test(w.m) ? `<button type="button" class="link" data-go="vaccines">Прививки ${g.born ? esc(joinNames(g.kids, genitive)) : "по календарю"} →</button>` : ""}</div>`:""}
  </div>`;
}

// Вкладка «Вещи»: «Пора заказать» (недельная логика) и «Весь список» (по разделам).
function ordersScreen(){
  const g = G(), all = S.thView === "all";
  return `${demoBar()}${switcher()}
  <div class="sec-title"><span class="eyebrow">${all ? "Всё на первый год" : "Доставка ~3 недели"}</span><div class="head"><h1>Вещи</h1>${infoBtn("s:orders","Что это за раздел")}</div>${hintBox("s:orders", SECTION_HINTS.orders)}</div>
  <div class="seg" role="tablist" aria-label="Вид">${[["now", "Пора заказать"], ["all", "Весь список"]].map(([k, n]) => `<button type="button" role="tab" data-thview="${k}" aria-selected="${(all ? "all" : "now") === k}">${n}</button>`).join("")}</div>
  ${all ? thingsAll(g) : thingsNow(g)}`;
}
function thingsAll(g){
  const hide = !!S.thHide;
  const prepLast = g.born;
  const cats = GCAT.filter(c => !(prepLast && c.id === "prep")).map(c => {
    const items = GEAR.filter(x => x.cat === c.id); if (!items.length) return "";
    const d = items.filter(x => isOn(`o:${x.id}`)).length;
    const shown = hide ? items.filter(x => !isOn(`o:${x.id}`) || x.id === S.focusGear) : items;
    return `<div class="panel gcat" id="gc-${c.id}">
      <div class="head"><h2>${esc(c.name)}</h2><span class="head-r"><span class="prog ${d === items.length ? "full" : ""}">${ofN(d, items.length)}</span>${c.hint ? infoBtn("gc:" + c.id, "Что важно") : ""}</span></div>
      ${c.hint ? hintBox("gc:" + c.id, c.hint) : ""}${bar(d, items.length)}
      ${shown.length ? shown.map(x => gearRow(x, needTag(g, x))).join("") : `<p class="empty">Всё отмечено.</p>`}</div>`;
  }).join("");
  const prep = GEAR.filter(x => x.cat === "prep"), prepName = GCAT.find(c => c.id === "prep").name;
  const prepBlock = prepLast ? `<div class="panel gcat" id="gc-prep"><details ${prep.some(x => x.id === S.focusGear) ? "open" : ""}><summary>${esc(prepName)}</summary>
    <p class="muted" style="font-size:13.5px;margin:8px 0">Уже позади — можно не отмечать.</p>${prep.map(x => gearRow(x)).join("")}</details></div>` : "";
  return `<label class="tgl"><span><b>Скрыть отмеченные</b><small>«есть» и «не нужно»</small></span><input type="checkbox" role="switch" data-thhide ${hide ? "checked" : ""}><i aria-hidden="true"></i></label>
  ${cats}
  ${prepBlock}
  <div class="panel" id="gskip"><details ${S.focusSkip ? "open" : ""}><summary>Не покупать: ${GEAR_SKIP.length}</summary>
    <p class="muted" style="font-size:13.5px;margin:8px 0">Это часто советуют, но оно не нужно или небезопасно.</p>
    <ul class="skip-list">${GEAR_SKIP.map(s => `<li id="gs-${s.id}" class="${S.focusSkip === s.id ? "found" : ""}"><b>${esc(s.x)}</b><span>${esc(s.why)}</span></li>`).join("")}</ul></details></div>`;
}
function thingsNow(g){
  const cur = curWeek(g);
  const now = ordersNow(g);
  const soon = g.born ? WEEKLY.filter(x => orderWeek(x) > cur && orderWeek(x) <= cur+4 && !isOn(`o:${x.id}`)) : [];
  const done = WEEKLY.filter(x => isOn(`o:${x.id}`));
  const past = g.born ? WEEKLY.filter(x => x.need < cur && !isOn(`o:${x.id}`)) : [];
  const laterList = WEEKLY.filter(x => !isOn(`o:${x.id}`) && !now.includes(x) && !soon.includes(x) && !past.includes(x)).sort((a, b) => !inSeason(a, S.today) - !inSeason(b, S.today) || orderWeek(a) - orderWeek(b) || a.need - b.need), later = laterList.length;
  // весь план на год: по месяцам, когда понадобится; сразу с подсказкой «зачем»
  const monthOf = x => { if (!inSeason(x, S.today)) return "По сезону — когда он начнётся"; if (!g.born) return `${Math.max(1, Math.ceil(x.need / 4.35))} мес`; const d = weekStartDate(g.date, x.need); return `${MONTHS_NOM[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`; };
  const laterBlock = later ? `<div class="panel" id="glater"><details ${laterList.some(x => x.id === S.focusGear) ? "open" : ""}><summary>Дальше по плану: ${later} — весь год</summary>
    <p class="muted" style="font-size:13.5px;margin:8px 0">Заказывать пока рано — каждая вещь сама поднимется в «Пора заказать», когда подойдёт срок. Уже есть или не нужна — можно отметить сейчас.</p>
    ${laterList.map((x, i) => `${i === 0 || monthOf(x) !== monthOf(laterList[i - 1]) ? `<h3 class="g-month">${esc(monthOf(x))}</h3>` : ""}${gearRow(x, inSeason(x, S.today) ? dueTag(g, x, cur) : "", "", true)}`).join("")}</details></div>` : "";
  const list = (arr, empty) => arr.length ? arr.map(x => gearRow(x, dueTag(g, x, cur))).join("") : `<p class="empty">${empty}</p>`;
  const base = baseOf(g), bd = baseDone(base);
  return `${bd < base.length ? `<div class="panel"><div class="head"><h2>Базовый набор</h2><span class="prog">отмечено ${ofN(bd, base.length)}</span></div>
    ${bar(bd, base.length)}<button type="button" class="btn ghost small" data-thview="all">Открыть список →</button></div>` : ""}
  <div class="panel"><div class="head"><h2>${g.born ? "Пора заказать" : "До родов"}</h2><span class="prog">${now.length}</span></div>${list(now, "Сейчас заказывать нечего.")}</div>
  ${g.born ? `<div class="panel"><div class="head"><h2>В ближайший месяц</h2><span class="prog">${soon.length}</span></div>${list(soon, "В ближайшие 4 недели ничего нового.")}` : `<div class="panel">`}
    </div>
  ${laterBlock}
  ${done.length?`<div class="panel"><details><summary>Отмечено: ${done.length}</summary><div class="group" style="margin-top:10px">${list(done,"")}</div></details></div>`:""}
  ${past.length?`<div class="panel"><details><summary>Срок прошёл, не отмечено: ${past.length}</summary><p class="empty" style="margin:8px 0">Если уже есть дома или не нужно — отметь.</p><div class="group">${list(past,"")}</div></details></div>`:""}`;
}

function flagsScreen(){
  const g = G();
  if (!g.born) return `${demoBar()}${switcher()}<div class="sec-title"><span class="eyebrow">Пока ждём</span><h1>Красные флаги</h1></div>
    <div class="panel"><p>Флаги развития появятся после рождения: здесь будет только то, что относится к текущему возрасту.</p></div>`;
  const a = ageG(g), f = flagsFor(a.months);
  const next = f.to < 99 ? addMonths(g.date, f.to) : null;
  const daysToNext = next ? daysBetween(S.today, next) : 0;
  return `${demoBar()}${switcher()}
  <div class="sec-title"><span class="eyebrow">${esc(joinNames(g.kids, dative))} ${ageText(a)}</span><div class="head"><h1>Красные флаги</h1>${infoBtn("s:flags","Что это за раздел")}</div>${hintBox("s:flags", SECTION_HINTS.flags)}</div>
  <div class="panel">
    <h2>${esc(f.title)}</h2>
    <p class="muted" style="font-size:14px">Покажи ${g.kids.length > 1 ? "детей" : "ребёнка"} педиатру, не дожидаясь планового осмотра, если сейчас:</p>
    <ul class="flag-list">${f.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    <p class="muted" style="font-size:13.5px">${esc(FLAGS_ALWAYS)}${g.kids.length > 1 ? " Двойняшки часто развиваются в немного разном темпе — оценивай каждого отдельно." : ""}</p>
    ${next?`<p class="mono" style="font-size:12.5px;color:var(--muted)">Следующий рубеж — ${fmtDate(next)}, через ${daysToNext} ${plural(daysToNext,"день","дня","дней")}.</p>`:""}
  </div>
  <div class="urgent">
    <h2>Срочно, не ждать</h2>
    <ul class="flag-list">${urgentFor(a.months).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
  </div>
  <button type="button" class="btn ghost" data-go="vaccines">💉 Календарь прививок</button>`;
}

function settingsPanel(){
  const mode = (() => { try { return localStorage.getItem("theme") || "light"; } catch { return "light"; } })();
  return `<div class="panel"><h2>Настройки</h2>
    <div class="field"><label>Язык</label>${langPick()}</div>
    <div class="field"><label>Оформление</label><div class="seg" role="tablist">${[["light", "Светлая"], ["dark", "Тёмная"], ["auto", "Как в Telegram"]].map(([k, n]) => `<button type="button" role="tab" data-thememode="${k}" aria-selected="${mode === k}">${n}</button>`).join("")}</div></div>
    ${S.children.length && activeNotices(G()).length ? `<button type="button" class="link" data-narchive style="text-align:left">Прочитанные уведомления</button>` : ""}</div>`;
}
// «Настройки» (бывшая «Семья»): меню разделов, раздел открывается внутри экрана. Вкладка по-прежнему family — ссылки бота не ломаются.
const SET_SECS = [
  {id:"kids", f:"var(--pink-fg)", ic:"👶", c:"var(--pink)", t:() => S.children.length > 1 ? "Дети" : "Ребёнок", s:() => S.children.map(c => `${nameOf(c)}${c.birth ? ` · ${fmtDate(c.birth)}` : ""}`).join(", ")},
  {id:"family", f:"var(--lav-fg)", ic:"🎨", c:"var(--lav)", t:() => "Семья и цвета", s:() => S.members.map(m => m.name).join(" и ")},
  {id:"modules", f:"var(--mint-fg)", ic:"🧩", c:"var(--mint)", t:() => "Что ведём", s:() => MOD_LIST.filter(([k]) => MOD()[k]).map(([, t]) => t).join(", ") || "Ничего не выбрано"},
  {id:"routine", f:"var(--accent)", ic:"✅", c:"var(--peach1)", t:() => "Своя рутина", s:() => { const n = S.routine?.own?.length || 0, h = Object.values(S.routine?.adj || {}).filter(a => a.off).length; return [n ? `своих: ${n}` : "Добавить свои пункты", h ? `скрыто: ${h}` : ""].filter(Boolean).join(" · "); }},
  {id:"install", f:"var(--mint-fg)", ic:"📲", c:"var(--mint)", t:() => "На главный экран", s:() => standalone ? "Установлено на этом телефоне" : "Иконка на телефоне — открывать без Telegram"},
  {id:"look", f:"var(--butter-fg)", ic:"🌗", c:"var(--butter)", t:() => "Оформление и язык", s:() => "Тема, язык интерфейса"},
  {id:"faq", f:"var(--health)", ic:"❓", c:"var(--health-soft)", t:() => "Вопросы и ответы", s:() => "Как пользоваться, команды бота"},
  {id:"feedback", f:"var(--accent)", ic:"💬", c:"var(--peach1)", t:() => "Обратная связь", s:() => "Отзыв, идея, неполадка"},
  {id:"data", f:"var(--en)", ic:"📦", c:"var(--en-soft)", t:() => "Данные", s:() => "Копия, PDF для педиатра, восстановление"},
];
// Иконки настроек: тонкая линия цветом плашки, без эмодзи
const SET_ICON = {
  kids:`<circle cx="12" cy="13" r="7"/><path d="M12 6c0-1.8 1.6-2.6 3-1.6"/><path d="M9.6 15.6c1.3 1.1 3.5 1.1 4.8 0"/><path d="M9.5 12h.01M14.5 12h.01" stroke-width="2.4"/>`,
  family:`<circle cx="9" cy="8.5" r="3"/><circle cx="16.5" cy="10" r="2.3"/><path d="M3.8 19c.6-3.2 2.7-5 5.2-5s4.6 1.8 5.2 5"/><path d="M14.6 14.4c.6-.3 1.2-.4 1.9-.4 2 0 3.5 1.5 4 4.2"/>`,
  modules:`<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>`,
  routine:`<circle cx="12" cy="12" r="8"/><path d="M8.5 12.3l2.4 2.3 4.6-4.8"/>`,
  install:`<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M12 8v6M9.5 11.5L12 14l2.5-2.5"/><path d="M11 18h2"/>`,
  look:`<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none" opacity=".35"/>`,
  faq:`<circle cx="12" cy="12" r="8"/><path d="M9.8 9.8a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4"/><path d="M12 16.6h.01" stroke-width="2.4"/>`,
  feedback:`<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V15h0A2 2 0 0 1 5 13z"/><path d="M12 12.2s-2.4-1.4-2.4-3a1.2 1.2 0 0 1 2.4-.3 1.2 1.2 0 0 1 2.4.3c0 1.6-2.4 3-2.4 3z"/>`,
  admin:`<path d="M12 3.5l7 3v5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9v-5z"/><path d="M9 12l2 2 4-4"/>`,
  data:`<rect x="4" y="5" width="16" height="4" rx="1.5"/><path d="M5.5 9v8.5A1.5 1.5 0 0 0 7 19h10a1.5 1.5 0 0 0 1.5-1.5V9"/><path d="M10 13h4"/>`,
};
const setIcon = x => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${SET_ICON[x.id] || ""}</svg>`;
const setRow = x => `<button type="button" class="set-row" ${x.id === "feedback" ? "data-fbopen" : x.id === "faq" ? "data-faqopen" : `data-setsec="${x.id}"`}><span class="set-ic" style="--c:${x.c};--f:${x.f}" aria-hidden="true">${setIcon(x)}</span>
  <span class="set-t"><b>${esc(x.t())}</b><small>${esc(x.s())}</small></span><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
function familyScreen(){
  const head = (eyebrow, title) => `<div class="sec-title"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1></div>`;
  if (S.demo) {
    if (S.setSec === "look") return `${demoBar()}<button type="button" class="link back" data-setsec="">← Настройки</button>${head("Настройки", "Оформление и язык")}${settingsPanel()}`;
    return `${demoBar()}${head("Демо-режим", "Настройки")}<div class="panel"><p class="muted">В демо нет семьи. Нажми «Начать по-настоящему», чтобы указать малыша и пригласить второго родителя.</p></div>
      <div class="panel set-list">${SET_SECS.filter(x => ["look", "faq", "feedback"].includes(x.id)).map(setRow).join("")}</div>`;
  }
  const me = meM(), others = S.members.filter(m => m.user_id !== S.me);
  const kids = S.children.map(c => {
    const born = !!c.birth, open = S.bornForm === c.id;
    return `<div class="kid-form">
      <div class="head"><h3>${esc(nameOf(c))}</h3><span class="prog">${born ? `родился ${fmtDate(c.birth)}` : c.due ? `ждём к ${fmtDate(c.due)}` : "ждём"}</span></div>
      <div class="field"><label for="k-name-${c.id}">Имя</label><input id="k-name-${c.id}" value="${esc(c.name||"")}" placeholder="${born ? "Имя" : "Ещё не выбрали"}"></div>
      ${born || open
        ? `<div class="field"><label for="k-birth-${c.id}">Дата рождения</label><input type="date" id="k-birth-${c.id}" value="${esc(c.birth||"")}" max="${S.today}"></div>`
        : `<div class="field"><label for="k-due-${c.id}">Предполагаемая дата родов</label><input type="date" id="k-due-${c.id}" value="${esc(c.due||"")}"></div>
           <button type="button" class="btn" data-born="${c.id}">Родился! Указать дату</button>`}
      <div class="field"><label for="k-sex-${c.id}">Пол — для норм веса ВОЗ</label>${sexSelect(`k-sex-${c.id}`, c.sex)}</div>
      <div class="kid-actions"><button type="button" class="btn ghost" data-kid-save="${c.id}">Сохранить</button>
        ${S.children.length > 1 ? `<button type="button" class="link" data-kid-del="${c.id}">Удалить</button>` : ""}</div>
    </div>`;
  }).join("");
  const sec = SET_SECS.find(x => x.id === S.setSec);
  if (!sec) return `${head(`${esc(joinNames(S.children))} · ${S.members.length} ${plural(S.members.length,"родитель","родителя","родителей")}`, "Настройки")}
    <div class="panel set-list">${SET_SECS.map(setRow).join("")}</div>${S.admin ? `<div class="panel set-list"><a class="set-row" href="admin" translate="no"><span class="set-ic" style="--c:var(--line);--f:var(--fg)" aria-hidden="true">${setIcon({id:"admin"})}</span>
      <span class="set-t"><b>Админка</b><small>Пользователи, семьи, отзывы</small></span></a></div>` : ""}`;
  const body = {
    kids: () => `<div class="panel">
    <h2>${S.children.length > 1 ? "Дети" : "Ребёнок"}</h2>
    ${kids}
    ${S.children.length < 4 ? (S.addKid
      ? `<div class="kid-form"><h3>Новый ребёнок</h3>
          <div class="field"><label for="k-name-new">Имя</label><input id="k-name-new" placeholder="Можно позже"></div>
          <div class="field"><label for="k-birth-new">Дата рождения — если уже родился</label><input type="date" id="k-birth-new" max="${S.today}" value="${esc(S.children.find(c=>c.birth)?.birth||"")}"></div>
          <div class="field"><label for="k-due-new">Или предполагаемая дата родов</label><input type="date" id="k-due-new"></div>
          <div class="kid-actions"><button type="button" class="btn" id="kid-add-save">Добавить</button><button type="button" class="link" id="kid-add-cancel">Отмена</button></div>
          <p class="muted" style="font-size:13px">Для двойни дата рождения уже подставлена — дети с одной датой ведутся вместе.</p></div>`
      : `<button type="button" class="btn ghost" id="kid-add">+ Добавить ребёнка (двойня, брат или сестра)</button>`) : ""}
  </div>`,
    family: () => `<div class="panel">
    <h2>Ты</h2>
    <div class="field"><label for="me-name">Имя</label><input id="me-name" value="${esc(me.name)}"></div>
    <div class="ob-pick small">${[["mama", "Мама"], ["papa", "Папа"]].map(([k, n]) => `<button type="button" data-myrole="${k}" aria-pressed="${(S.myRole || S.role) === k}">${n}</button>`).join("")}</div>
    <div class="field"><label>Цвет отметок</label>${swatches(S.myColor || me.color, id => others.find(m => m.color===id)?.name)}</div>
    <button class="btn" type="button" id="me-save">Сохранить</button>
  </div>
  ${others.length ? `<div class="panel"><h2>${others[0].role === "papa" ? "Папа" : others[0].role === "mama" ? "Мама" : "Второй родитель"}</h2><div class="who">${others.map(o => `<span style="--c:${colorHex(o.color)}"><i></i>${esc(o.name)}${o.owner ? " · основной" : ""}</span>`).join("")}</div>
    ${others.map(o => `<div class="field"><label>Цвет отметок · ${esc(o.name)}</label>${swatches(o.color, id => id === (S.myColor || me.color) ? "тебя" : null).replaceAll("data-color=", `data-ocolor-uid="${o.user_id}" data-ocolor=`)}</div>`).join("")}
    <p class="muted" style="font-size:14px">Получает те же уведомления. Отметки видны обоим, каждая своим цветом.</p></div>` : ""}
  ${S.owner && !others.length ? `<div class="invite"><h2>Позвать ${S.role === "papa" ? "маму" : S.role === "mama" ? "папу" : "второго родителя"}</h2>
    <p style="font-size:14.5px">Ссылка в Telegram: по ней второй родитель попадёт в семью, будет получать те же уведомления, а его отметки будут видны его цветом. Пригласить можно одного человека.</p>
    <button class="btn" type="button" id="invite">Отправить приглашение</button>${S.inviteLink?`<p class="mono" style="font-size:12px;word-break:break-all">${esc(S.inviteLink)}</p>`:""}</div>` : ""}`,
    modules: () => `<div class="panel"><h2>Что ведём</h2><p class="muted" style="font-size:14px">Выключенное пропадает из вкладок и уведомлений. Данные не удаляются.</p>
    <div class="tgls">${MOD_LIST.map(([k, t, s]) => toggle(k, MOD()[k], t, s)).join("")}</div></div>
    <div class="panel"><h2>Сообщения от бота</h2>
    <div class="tgls"><label class="tgl"><span><b>Утреннее сообщение</b><small>Возраст, о чём помнить, совет дня. Только у тебя — второй родитель решает сам.</small></span>
      <input type="checkbox" role="switch" data-pref="morning" ${S.prefs?.morning !== false ? "checked" : ""}><i aria-hidden="true"></i></label></div>
    <p class="muted" style="font-size:13.5px">Прививки, таймеры кормления и сна, карточки новой недели и сезонное «Важное» приходят всё равно.</p></div>`,
    look: () => settingsPanel(),
    routine: () => routineSettings(),
    install: () => installPanel(),
    data: () => `<div class="panel"><h2>Данные</h2>
    <p class="muted" style="font-size:14px">Копия всех отметок и прививок — файлом в чат с ботом. PDF-сводку удобно показать педиатру.</p>
    <div class="data-btns">
      <button type="button" class="btn ghost" data-go="vaccines">💉 Прививки</button>
      <button type="button" class="btn ghost" id="exp-json">Скачать копию данных</button>
      <button type="button" class="btn ghost" id="exp-pdf">PDF-сводка</button>
      <button type="button" class="btn ghost" id="imp-json">Восстановить из копии</button>
      <input type="file" id="imp-file" accept=".json,application/json" hidden>
    </div></div>`,
  }[sec.id];
  return `<button type="button" class="link back" data-setsec="">← Настройки</button>${head("Настройки", esc(sec.t()))}${body()}`;
}
// ---------- приложение на главном экране (PWA) ----------
const STEPS_IOS = `<ol class="inst"><li>Открой ссылку в <b>Safari</b></li><li>Нажми «Поделиться» <span aria-hidden="true">⬆️</span></li><li>Выбери «На экран „Домой“»</li></ol>`;
const STEPS_AND = `<ol class="inst"><li>Открой ссылку в <b>Chrome</b></li><li>Меню ⋮ → «Добавить на главный экран» или «Установить приложение»</li></ol>`;
function installPanel(){
  const demo = `<div class="panel"><h2>Как это выглядит</h2>${faqDemo(faqOf("pwa"))}</div>`;   // та же раскадровка, что в «Вопросах и ответах» и ролике /web
  const warn = `<p class="muted" style="font-size:13.5px">Ссылка личная — как ключ от вашей семьи в приложении. Не пересылай её. Второй родитель берёт свою — в своём Telegram.</p>
    <button type="button" class="link danger" data-webrevoke>Отключить все мои ссылки</button>`;
  if (initData) return `<div class="panel"><h2>Иконка на телефоне</h2>
    <p style="font-size:14.5px">Приложение можно открывать прямо с главного экрана, без Telegram. Уведомления по-прежнему приходят в бот.</p>
    <button type="button" class="btn" data-weblink>Получить ссылку для браузера</button>
    ${S.webLink ? `<p class="mono" style="font-size:12px;word-break:break-all">${esc(S.webLink)}</p><div class="data-btns"><button type="button" class="btn ghost" data-webopen>Открыть в браузере</button><button type="button" class="btn ghost" data-webcopy>Скопировать ссылку</button></div>` : ""}
    <h3>iPhone</h3>${STEPS_IOS}<h3>Android</h3>${STEPS_AND}${warn}</div>${demo}`;
  return `<div class="panel"><h2>Иконка на телефоне</h2>
    ${standalone ? `<p style="font-size:14.5px">✅ Установлено: приложение открыто с главного экрана.</p>`
      : installEvt ? `<button type="button" class="btn" data-pwainstall>Установить приложение</button>`
      : isIOS ? `<p style="font-size:14.5px">Добавь эту страницу на экран «Домой»:</p>${STEPS_IOS}` : `<p style="font-size:14.5px">Добавь эту страницу на главный экран:</p>${STEPS_AND}`}
    <p class="muted" style="font-size:13.5px">Уведомления по-прежнему приходят в Telegram-бот.</p>
    <button type="button" class="link" data-weblogout>Выйти на этом устройстве</button>${warn}</div>${standalone ? "" : demo}`;
}
// Вход через Telegram прямо в этом окне: заявка с кодом → бот спрашивает «Войти?» → приложение само забирает вход.
// Заявку берём заранее, чтобы кнопка была обычной ссылкой (iPhone открывает Telegram только по прямому нажатию).
const WL = {req:null, timer:null, err:""};
async function wlStart(){
  if (WL.req && Date.now() < WL.req.until) return;
  try {
    const r = await fetch("/api/web/login/start", {method:"POST", headers:{"content-type":"application/json"}, body:"{}"}).then(x => x.json());
    if (r.error) { WL.err = r.error; return render(); }
    WL.req = {...r, until:Date.now() + r.ttl - 30e3}; WL.err = ""; render();
    clearInterval(WL.timer); WL.timer = setInterval(wlPoll, 2500);
  } catch { WL.err = "Нет связи с сервером"; render(); }
}
async function wlPoll(){
  const q = WL.req; if (!q) return;
  if (Date.now() > q.until) { WL.req = null; clearInterval(WL.timer); return wlStart(); }
  const r = await fetch("/api/web/login/claim", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({id:q.id, secret:q.secret})}).then(x => x.json()).catch(() => null);
  if (r?.token) { clearInterval(WL.timer); try { localStorage.setItem("wt", r.token); } catch {} await dropCache(); location.replace("/?pwa=1"); }
  else if (r?.error) { WL.req = null; clearInterval(WL.timer); wlStart(); }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && WL.req) wlPoll(); });   // вернулись из Telegram — сразу проверить
function noAccessScreen(){
  if (!WL.req && !WL.err) setTimeout(wlStart);
  const q = WL.req, url = q ? `https://t.me/${q.bot || "child_devbot"}?start=wl_${q.id}` : "";
  return `<div class="panel wlogin"><h2>Вход через Telegram</h2>
    <p style="font-size:14.5px">${S.webBad ? "Эта ссылка больше не действует — её отключили или заменили." : "Приложение работает вместе с Telegram-ботом: он присылает рутину, напоминания и связывает вас со вторым родителем."}</p>
    ${q ? `<a class="btn" href="${url}" target="_blank" rel="noopener" data-wlgo>Войти через Telegram</a>
      <div class="wl-code"><span class="muted">Код для проверки</span><b>${q.code}</b></div>
      <p class="note-small">Откроется бот — нажми «Войти». Потом вернись сюда: приложение откроется само.</p>`
      : `<button type="button" class="btn" disabled>${WL.err ? esc(WL.err) : "Готовлю вход…"}</button>${WL.err ? `<button type="button" class="link" data-wlretry>Попробовать ещё раз</button>` : ""}`}
    <button type="button" class="btn ghost" data-ob="demo">Посмотреть демо</button></div>`;
}
async function installClick(t, d){
  if (t.hasAttribute("data-wlretry")) { WL.err = ""; WL.req = null; wlStart(); return true; }
  if (t.hasAttribute("data-weblink")) { const r = await call("/api/web/link", {}).catch(e => toast(e.message)); if (r?.url) { S.webLink = r.url; render(); } return true; }
  if (t.hasAttribute("data-webopen")) { try { tgApp.openLink(S.webLink); } catch { open(S.webLink, "_blank"); } return true; }
  if (t.hasAttribute("data-webcopy")) { navigator.clipboard?.writeText(S.webLink).then(() => toast("Скопировано — вставь в Safari или Chrome"), () => toast("Не скопировалось — выдели ссылку вручную")); return true; }
  if (t.hasAttribute("data-pwainstall")) { installEvt?.prompt(); installEvt?.userChoice?.then(() => { installEvt = null; render(); }); return true; }
  if (t.hasAttribute("data-weblogout")) { try { localStorage.removeItem("wt"); } catch {} await dropCache(); location.href = "/"; return true; }
  if (t.hasAttribute("data-webrevoke")) {
    if (!(await ask("Отключить все ссылки для браузера? Приложения на главном экране попросят войти заново."))) return true;
    await call("/api/web/revoke", {}).then(async () => { S.webLink = null; toast("Ссылки отключены"); if (!initData) { try { localStorage.removeItem("wt"); } catch {} await dropCache(); location.href = "/"; } else render(); }, e => toast(e.message));
    return true;
  }
  return false;
}
// ---------- своя рутина ----------
// Свои пункты со сроком (2–3 недели, месяц, бессрочно) и сроки встроенных: до какой даты пункт в рутине, продлить, сократить, скрыть.
const fmtDateY = iso => `${fmtDate(iso)}${iso.slice(0, 4) !== S.today.slice(0, 4) ? " " + iso.slice(0, 4) : ""}`;
const RDUR = [["2", "2 недели"], ["3", "3 недели"], ["4", "Месяц"], ["0", "Бессрочно"]];
const durUntil = v => v === "0" ? null : addDays(S.today, Number(v) * 7 - 1);
function routineSettings(){
  const g = G(), cfg = S.routine || {own:[], adj:{}}, open = S.rsetOpen;
  const chips = (id, list, cur) => `<div class="rchips">${list.map(([v, n]) => `<button type="button" data-rdur="${id}|${v}" aria-pressed="${cur === v}">${n}</button>`).join("")}</div>`;
  // свои
  const own = cfg.own.map(o => `<div class="rs-row ${open === o.id ? "open" : ""}"><button type="button" class="rs-main" data-rsopen="${o.id}" aria-expanded="${open === o.id}"><svg class="rs-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${esc(o.x)}</b>
      <small>${o.until ? (o.until < S.today ? `закончился ${fmtDateY(o.until)}` : `до ${fmtDateY(o.until)}`) : "бессрочно"}${o.how ? ` · ${esc(o.how)}` : ""}</small></button>
      <div class="rs-edit" ${open === o.id ? "" : "inert"}><div class="rs-in"><span class="eyebrow">Продолжительность — от сегодня</span>${chips(o.id, RDUR, null)}<button type="button" class="link danger" data-rdel="${o.id}">Удалить пункт</button></div></div></div>`).join("");
  // встроенные: что идёт сейчас, и всё, что меняли
  let builtin = "";
  if (g?.born) {
    const wk = Math.max(1, ageG(g).week), now = new Set(routineForWeek(wk).map(r => r.id));   // вся неделя: пункты «через день» тоже
    const list = ROUTINE.filter(r => now.has(r.id) || cfg.adj[r.id]);
    const row = r => {
      const a = cfg.adj[r.id], [, last] = routineSpan(r.id), planEnd = weekEndDate(g.date, last), st = r.st.find(([x, y]) => wk >= x && wk <= y) || r.st[r.st.length - 1];
      const plan = last >= 52 ? "весь первый год" : `по плану до ${fmtDateY(planEnd)} · неделя ${last}`;
      const early = a?.early && S.today >= a.from && wk < a.early ? r.st.find(s => s[0] === a.early) : null;
      const state = a?.off ? "не показываем" : early ? `«${early[2]}» включили раньше плана` : a?.until ? (a.until < S.today ? `закончился ${fmtDateY(a.until)}` : `до ${fmtDateY(a.until)}${a.until > planEnd ? " — продлено" : " — сокращено"}`) : plan;
      const cur = a?.off ? "off" : a?.until ? null : "plan";
      return `<div class="rs-row ${a ? "chg" : ""} ${open === r.id ? "open" : ""}"><button type="button" class="rs-main" data-rsopen="${r.id}" aria-expanded="${open === r.id}"><svg class="rs-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${esc((early || st)[2])}</b><small>${RCAT[r.cat]} · ${state}</small></button>
        <div class="rs-edit" ${open === r.id ? "" : "inert"}><div class="rs-in"><p class="muted">По плану: ${plan}.</p><span class="eyebrow">Показывать — считая от сегодня</span>${chips(r.id, [["plan", "По плану"], ["2", "2 недели"], ["3", "3 недели"], ["4", "Месяц"], ["year", "До конца года"], ["off", "Не показывать"]], cur)}</div></div></div>`;
    };
    const vis = list.filter(r => !cfg.adj[r.id]?.off), hid = list.filter(r => cfg.adj[r.id]?.off);
    // будущие этапы: серые, с недели N, почему именно тогда; что не на паузе и ещё не включено раньше
    const soon = ROUTINE.flatMap(r => r.st.filter(s => s[0] > wk && !cfg.adj[r.id]?.off && cfg.adj[r.id]?.early !== s[0]).map(s => ({r, s}))).sort((x, y) => x.s[0] - y.s[0]);
    const gearOf = (id, a) => GEAR.filter(x => x.rt === `${id}:${a}`);
    const soonRow = ({r, s}) => { const k = `soon:${r.id}:${s[0]}`, gs = gearOf(r.id, s[0]);
      return `<div class="rs-row soon ${open === k ? "open" : ""}"><button type="button" class="rs-main" data-rsopen="${k}" aria-expanded="${open === k}"><svg class="rs-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${esc(s[2])}</b>
        <small><span class="rs-when">с недели ${s[0]} · ${fmtDate(weekStartDate(g.date, s[0]))}</span> ${RCAT[r.cat]}</small></button>
        <div class="rs-edit" ${open === k ? "" : "inert"}><div class="rs-in">${RWHY[`${r.id}:${s[0]}`] ? `<p><b>Почему с этой недели.</b> ${esc(RWHY[`${r.id}:${s[0]}`])}</p>` : ""}
          ${s[3] ? `<p class="muted">Как: ${esc(s[3])}</p>` : ""}
          ${gs.length ? `<p class="muted">Понадобится: ${gs.map(x => esc(x.x)).join(", ")}</p>` : ""}
          ${earlyOk(r.id) ? `<button type="button" class="btn ghost small" data-rearly="${r.id}|${s[0]}">Включить сейчас</button>` : `<p class="muted">Раньше срока не включаем — начинайте по готовности и после разговора с педиатром.</p>`}</div></div></div>`; };
    const near = soon.filter(x => x.s[0] <= wk + 13), later = soon.filter(x => x.s[0] > wk + 13);
    const soonBlock = soon.length ? `<div class="panel"><h2>Скоро в рутине</h2><p class="muted" style="font-size:14px">Появятся сами в свою неделю — добавлять вручную не нужно. Если вещь уже есть или малыш готов раньше — нажми на пункт и включи сейчас.</p>
      <div class="rs-list">${near.map(soonRow).join("")}</div>
      ${later.length ? `<details class="rs-hid" ${later.some(x => open === `soon:${x.r.id}:${x.s[0]}`) ? "open" : ""}><summary>Позже: ${later.length}</summary><div class="rs-list">${later.map(soonRow).join("")}</div></details>` : ""}</div>` : "";
    builtin = `<div class="panel"><h2>Пункты приложения</h2><p class="muted" style="font-size:14px">Нажми на пункт — увидишь, до какой даты он в рутине. Можно продлить, сократить или не показывать вовсе.</p>
      <div class="rs-list">${vis.map(row).join("")}</div>
      ${hid.length ? `<details class="rs-hid" ${hid.some(r => r.id === open) ? "open" : ""}><summary>Не показываем: ${hid.length}</summary><div class="rs-list">${hid.map(row).join("")}</div></details>` : ""}</div>${soonBlock}`;
  }
  return `<div class="panel"><h2>Свои пункты</h2><p class="muted" style="font-size:14px">То, чего нет в приложении: особый ритуал, процедура от врача, семейная традиция. Видны обоим родителям, отмечаются как обычная рутина.</p>
    ${own ? `<div class="rs-list">${own}</div>` : ""}
    <div class="rs-add"><div class="field"><label for="rs-x">Что делать</label><input id="rs-x" maxlength="80" placeholder="Например, сказка на ночь"></div>
      <div class="field"><label for="rs-how">Как — необязательно</label><input id="rs-how" maxlength="160" placeholder="Например, папа, 10 минут"></div>
      <span class="eyebrow">Сколько показывать</span><div class="rchips">${RDUR.map(([v, n]) => `<button type="button" data-rsdur="${v}" aria-pressed="${(S.rsDur ?? "2") === v}">${n}</button>`).join("")}</div>
      <button type="button" class="btn" id="rs-add">Добавить в рутину</button></div></div>
  ${builtin || `<div class="panel"><p class="muted">Пункты приложения появятся после рождения малыша.</p></div>`}`;
}
async function saveRoutine(cfg, msg){
  const prev = S.routine; S.routine = cfg; haptic(); render();
  if (S.demo) return toast(msg);
  try { const r = await call("/api/routine", cfg); S.routine = r.routine || cfg; toast(msg); render(); }
  catch (e) { S.routine = prev; render(); toast("Не сохранилось: " + e.message); }
}
function routineClick(t, d){
  const cfg = S.routine || {own:[], adj:{}};
  if (d.rsopen) {   // без перерисовки: карточка раскрывается плавно, открыта одна
    const row = t.closest(".rs-row"), was = row.classList.contains("open");
    for (const r of view.querySelectorAll(".rs-row.open")) { r.classList.remove("open"); r.querySelector(".rs-edit")?.setAttribute("inert", ""); r.querySelector(".rs-main")?.setAttribute("aria-expanded", "false"); }
    if (!was) { row.classList.add("open"); row.querySelector(".rs-edit")?.removeAttribute("inert"); t.setAttribute("aria-expanded", "true"); }
    S.rsetOpen = was ? null : d.rsopen; haptic(); return true;
  }
  if (d.rsdur) { S.rsDur = d.rsdur; haptic(); render(); return true; }
  if (t.id === "rs-add") {
    const x = document.getElementById("rs-x").value.trim(), how = document.getElementById("rs-how").value.trim();
    if (!x) { toast("Напиши, что делать"); document.getElementById("rs-x").focus(); return true; }
    const until = durUntil(S.rsDur ?? "2");
    saveRoutine({...cfg, own:[...cfg.own, {id:`u${Date.now()}`, x, how, from:S.today, until}]}, until ? `Добавлено до ${fmtDateY(until)}` : "Добавлено, бессрочно");
    return true;
  }
  if (d.rdel) { S.rsetOpen = null; saveRoutine({...cfg, own:cfg.own.filter(o => o.id !== d.rdel)}, "Пункт удалён"); return true; }
  if (t.hasAttribute("data-rtno")) { S.rtAsk = null; render(); return true; }
  if (d.rearly) {
    S.rtAsk = null;
    const [id, a] = d.rearly.split("|"), adj = {...cfg.adj}, cur = adj[id] && !adj[id].off ? adj[id] : {};
    adj[id] = {...cur, early:Number(a), from:S.today};
    saveRoutine({...cfg, adj}, "Включено — уже сегодня в рутине");
    return true;
  }
  if (d.rdur) {
    const [id, v] = d.rdur.split("|"), g = G();
    if (id.startsWith("u")) { const until = durUntil(v); saveRoutine({...cfg, own:cfg.own.map(o => o.id === id ? {...o, until} : o)}, until ? `Теперь до ${fmtDateY(until)}` : "Теперь бессрочно"); return true; }
    const adj = {...cfg.adj};
    if (v === "plan") delete adj[id];
    else if (v === "off") adj[id] = {off:1};
    else adj[id] = {until:v === "year" ? weekEndDate(g.date, 52) : durUntil(v)};
    saveRoutine({...cfg, adj}, v === "off" ? "Больше не показываем — вернуть можно здесь же" : v === "plan" ? "Как по плану" : `Показываем до ${fmtDateY(adj[id].until)}`);
    return true;
  }
  return false;
}
// ---------- вопросы и ответы ----------
// Аккордеон: открыт один вопрос, под ответом — раскадровка (faq.js) и «Показать в приложении» — переход на настоящий экран с подсветкой.
function faqScreen(){
  const m = MOD();
  const goOf = q => q.go && !(q.mod && !m[q.mod]) && !(S.demo && q.go.tab === "family" && q.go.sec !== "look") ? q.go : null;
  const para = p => typeof p === "string" ? `<p>${esc(p)}</p>` : `<ul>${p.ul.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const item = q => { const on = S.faqOpen === q.id;
    return `<div class="fq${on ? " open" : ""}" id="fq-${q.id}"><button type="button" class="fq-q" data-fq="${q.id}" aria-expanded="${on}"><span>${esc(q.q)}</span><i aria-hidden="true">+</i></button>
      ${on ? `<div class="fq-a">${q.a.map(para).join("")}${faqDemo(q)}${goOf(q) ? `<button type="button" class="btn ghost" data-fqgo="${q.id}">Показать в приложении →</button>` : ""}</div>` : ""}</div>`; };
  return `${demoBar()}<button type="button" class="link back" data-fqback>← Назад</button>
    <div class="sec-title"><span class="eyebrow">Как пользоваться</span><h1>Вопросы и ответы</h1></div>
    ${FAQ_SECS.map(s => `<section class="panel fq-sec"><h2>${esc(s.name)}</h2><div>${FAQ.filter(q => q.sec === s.id).map(item).join("")}</div></section>`).join("")}
    <div class="panel"><h2>Не нашли ответ?</h2><p class="muted" style="font-size:14px">Напиши нам — ответим и, если вопрос частый, добавим сюда.</p><button type="button" class="btn ghost" data-fbopen>Написать</button></div>`;
}
const scrollFaq = id => setTimeout(() => document.getElementById(`fq-${id}`)?.scrollIntoView({block:"start", behavior: reduceMotion ? "auto" : "smooth"}), 30);
function openFaq(id){
  if (S.tab !== "faq") { S.fqFrom = S.tab; S.fqTips = S.tab === "tips" ? tipsPos() : null; }
  S.faqOpen = faqOf(id) ? id : null; haptic(); go("faq");
  if (S.faqOpen) scrollFaq(S.faqOpen);
}
// подсветить настоящий элемент после перехода
function flash(sel){
  setTimeout(() => { const el = sel && view.querySelector(sel); if (!el) return;
    el.scrollIntoView({block:"center", behavior: reduceMotion ? "auto" : "smooth"});
    el.classList.add("fq-hl"); setTimeout(() => el.classList.remove("fq-hl"), 2800); }, 80);
}
// Клики экрана вопросов; true — обработано
function faqClick(t, d){
  if ("faqopen" in d) { openFaq(d.faqopen); return true; }
  if (d.fq) { S.faqOpen = S.faqOpen === d.fq ? null : d.fq; haptic(); render(); if (S.faqOpen) scrollFaq(S.faqOpen); return true; }
  if (t.hasAttribute("data-fqback")) {
    const to = S.fqFrom && S.fqFrom !== "faq" ? S.fqFrom : "family";
    go(to); if (to === "tips" && S.fqTips) { restoreTips(S.fqTips); S.fqTips = null; }
    return true;
  }
  if (d.fqgo) {
    const g = faqOf(d.fqgo)?.go; if (!g) return true;
    haptic();
    if (g.tab === "feedback") { S.fbFrom = "faq"; S.fb = {mine:S.fb?.mine || null}; go("feedback"); return true; }
    if ("sec" in g) S.setSec = g.sec;
    if (g.gseg) S.gseg = g.gseg;
    if (g.tab === "week") S.week = null;
    if (g.tab === "orders") S.thView = "now";
    go(g.tab);
    if (g.tab === "search") setTimeout(() => document.getElementById("q")?.focus(), 30);
    flash(g.hl);
    return true;
  }
  return false;
}
// ---------- прививки ----------
const vOf = id => S.vaccines.find(v => v.id === id);
const vKind = v => vaccineKind(v.code);
const byDue = (a, b) => String(vaccineDue(a) || "9999").localeCompare(String(vaccineDue(b) || "9999"));
// over — просрочено (красное), soon — в ближайшие 14 дней, later, done, skip. Платные рекомендованные не «просрочиваются», пока не записались.
function vState(v){
  if (v.status === "done" || v.status === "skip") return v.status;
  const due = vaccineDue(v); if (!due) return "later";
  const d = daysBetween(S.today, due);
  if (d < 0) return vKind(v) === "rec" && v.status !== "booked" ? "later" : "over";
  return d <= 14 ? "soon" : "later";
}
const fmtY = iso => fmtDate(iso) + (iso.slice(0,4) !== S.today.slice(0,4) ? ` ${iso.slice(0,4)}` : "");
// Относительно — только в пределах двух месяцев, дальше хватает даты.
const inDays = d => Math.abs(d) > 60 ? "" : d === 0 ? "сегодня" : d === 1 ? "завтра" : d > 0 ? `через ${d} ${plural(d,"день","дня","дней")}` : `${-d} ${plural(-d,"день","дня","дней")} назад`;
function vWhen(v){
  if (v.status === "done") return v.done_date ? `сделано ${fmtY(v.done_date)}` : "сделано";
  if (v.status === "skip") return "не планируем";
  if (v.status === "booked" && v.booked_at) {
    const d = v.booked_at.slice(0, 10);
    return [`запись ${fmtY(d)}${v.booked_at.length > 10 ? ` в ${v.booked_at.slice(11, 16)}` : ""}`, inDays(daysBetween(S.today, d)), v.booked_at.length > 10 && d >= S.today ? "🔔 напомню за час" : ""].filter(Boolean).join(" · ");
  }
  if (!v.planned) return v.status === "booked" ? "записались, дата не указана" : "без даты";
  const d = daysBetween(S.today, v.planned);
  if (vKind(v) === "rec") return `${v.status === "booked" ? "записались · " : ""}можно с ${fmtY(v.planned)}${d >= 0 && inDays(d) ? ` · ${inDays(d)}` : ""}`;
  return `${v.status === "booked" ? "записались, " : ""}${d < 0 ? `пора сделать · срок был ${fmtY(v.planned)}` : [fmtY(v.planned), inDays(d)].filter(Boolean).join(" · ")}`;
}
function vRow(v){
  const st = vState(v), k = vKind(v), due = vaccineDue(v);
  // без записи в приложении тоже можно сразу «Сделали»: записались по телефону и забыли отметить
  const act = v.status === "planned" ? (due && due <= S.today
      ? `<button type="button" class="v-act" data-vnext="${v.id}" data-to="done">Сделали</button>`
      : `<button type="button" class="v-act" data-vnext="${v.id}" data-to="booked">Записались</button><button type="button" class="v-act ok" data-vnext="${v.id}" data-to="done">✓ Сделали</button>`)
    : v.status === "booked" ? `<button type="button" class="v-act" data-vnext="${v.id}" data-to="done">Сделали</button>`
    : v.status === "skip" ? `<button type="button" class="v-act ghost" data-vnext="${v.id}" data-to="planned">Вернуть</button>`
    : `<span class="v-st ${v.status}">${VSTATUS[v.status]}</span>`;
  const skip = vOpen(v) && k !== "own" ? `<button type="button" class="v-skip" data-vskip="${v.id}">Не планируем</button>` : "";
  const info = vaccInfoOf(v.code), ik = `vi:${v.id}`;
  return `<div class="vx ${st}">
    <div class="v-hd"><button type="button" class="v-main" data-vedit="${v.id}" aria-label="Изменить: ${esc(v.name)}">
      <span class="v-name">${k === "rec" ? `<span class="chip rec">платно</span>` : k === "own" ? `<span class="chip own">своя</span>` : ""}${esc(v.name)}</span>
      <span class="v-when">${vWhen(v)}</span>${v.note ? `<span class="v-note">${esc(v.note)}</span>` : ""}</button>${info ? infoBtn(ik, "Что это за прививка") : ""}</div><span class="v-acts">${act}${skip}</span>
    ${info && openHints.has(ik) ? vInfo(info) : ""}</div>`;
}
// Подсказка к прививке: от чего, чем опасно, сколько лет вакцине, источники
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const yearsAgo = y => { const n = Number(S.today.slice(0, 4)) - y; return `${n} ${plural(n, "год", "года", "лет")}`; };
function vInfo(x){
  const part = p => `<details class="vi-part"><summary><b>${esc(p.name)}</b><span class="vi-y">с ${p.year}</span></summary>
    <p>${esc(p.what)}</p><p><b>Чем опасно.</b> ${esc(p.why)}</p><p><b>Вакцина.</b> ${esc(p.since)}</p></details>`;
  const src = [...new Set([...(x.src || []), ...(x.parts || []).flatMap(p => p.src || [])])];
  return `<div class="vinfo">
    ${x.year ? `<div class="vi-age"><span><b>${yearsAgo(x.year)}</b>${esc(x.yearNote)} — ${x.year}</span></div>` : ""}
    ${x.intro ? `<p>${esc(x.intro)}</p>` : `<p class="vi-what">${esc(x.what)}</p><h4>Чем опасно</h4><p>${esc(x.why)}</p>`}
    ${x.parts ? `<h4>Шесть компонентов — нажми, чтобы раскрыть</h4><div class="vi-parts">${x.parts.map(part).join("")}</div>` : ""}
    <h4>${x.parts ? "Гексавакцина" : "История вакцины"}</h4><p>${esc(x.since)}</p>
    ${x.used ? `<p class="vi-used">${esc(x.used)}</p>` : ""}
    <p class="vi-note">${esc(VACC_NOTE)}</p>
    <p class="vi-src">Источники: ${src.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(", ")}</p></div>`;
}
// Вкладка «Здоровье»: вес, скачки роста и прививки — переключателем сверху.
function healthHead(g, cur){
  const m = MOD(), segs = [...(m.growth ? [["weight", "Вес"], ["spurts", "Скачки"]] : []), ...(m.vaccines ? [["vaccines", "Прививки"]] : [])];
  const vac = cur === "vaccines";
  return `<div class="sec-title"><span class="eyebrow">${vac ? "Календарь МОЗ Украины · с 2026 года" : g ? esc(joinNames(g.kids)) : ""}</span>
    <div class="head"><h1>Здоровье</h1>${vac ? infoBtn("s:vaccines", "Что это за раздел") : ""}</div>${vac ? hintBox("s:vaccines", SECTION_HINTS.vaccines) : ""}</div>
  ${segs.length > 1 ? `<div class="seg" role="tablist" aria-label="Раздел" style="grid-template-columns:repeat(${segs.length},1fr)">${segs.map(([k, n]) => `<button type="button" role="tab" data-gseg="${k}" aria-selected="${cur === k}">${n}</button>`).join("")}</div>` : ""}`;
}
// Этапы календаря — по возрасту: роддом, 2, 4, 6, 12, 18 месяцев, 4 и 6 лет.
const atKey = at => JSON.stringify(at);
const V_STAGES = [...new Map(VACCINES.map(v => [atKey(v.at), v.at])).values()];
const stageName = at => at.d !== undefined ? "Роддом" : at.m < 24 ? `${at.m} ${plural(at.m, "месяц", "месяца", "месяцев")}` : `${at.m / 12} ${plural(at.m / 12, "год", "года", "лет")}`;
const kindOrder = {must:0, rec:1, own:2};
const vOpen = v => v.status === "planned" || v.status === "booked";
// Свои записи (Манту и т. п.) — в этап, к которому они ближе всего по дате.
function vStages(kid){
  const stages = V_STAGES.map(at => ({at, date:vaccineDate(kid.birth, at), items:[]}));
  stages.skipped = [];
  for (const v of S.vaccines.filter(x => x.child_id === kid.id)) {
    if (v.status === "skip") { stages.skipped.push(v); continue; }
    const cal = VACCINES.find(x => x.code === v.code);
    const d = v.done_date || vaccineDue(v) || S.today;
    (cal ? stages.find(st => atKey(st.at) === atKey(cal.at)) : stages.filter(st => st.date <= d).at(-1) || stages[0]).items.push(v);
  }
  for (const st of stages) {
    st.items.sort((a, b) => kindOrder[vKind(a)] - kindOrder[vKind(b)] || byDue(a, b));
    const must = st.items.filter(v => vKind(v) === "must");
    st.skipped = stages.skipped.filter(v => atKey(VACCINES.find(x => x.code === v.code)?.at) === atKey(st.at)).length;
    st.done = must.filter(v => v.status === "done").length; st.total = must.length;
    st.state = st.items.some(v => vState(v) === "over") ? "over"
      : !st.items.some(v => vOpen(v) && (vKind(v) !== "rec" || v.status === "booked")) && st.date <= S.today ? "done" : "later";
  }
  const next = stages.find(st => st.state === "later"); if (next) next.state = "next";
  return stages;
}
function vTimeline(kid){
  const stages = vStages(kid);
  let todayShown = false;
  return `<ol class="vtl">${stages.map(st => {
    const mark = !todayShown && st.date > S.today ? (todayShown = true, `<li class="vtoday">Сегодня, ${fmtDate(S.today)}</li>`) : "";
    const rel = st.date > S.today ? inDays(daysBetween(S.today, st.date)) : "";
    return `${mark}<li class="vst ${st.state}"><div class="vst-h"><b>${stageName(st.at)}</b><span class="vdate">${fmtY(st.date)}${rel ? ` · ${rel}` : ""}</span>${st.total ? `<span class="prog ${st.done === st.total ? "full" : ""}">${st.done}/${st.total}</span>` : ""}</div>
      ${st.items.length ? `<div class="vlist">${st.items.map(vRow).join("")}</div>` : st.skipped ? `<p class="empty">Не планируем — в списке внизу.</p>` : ""}</li>`;
  }).join("")}${todayShown ? "" : `<li class="vtoday">Сегодня, ${fmtDate(S.today)}</li>`}</ol>
  ${stages.skipped.length ? `<div class="panel"><details ${S.vSkipOpen ? "open" : ""}><summary>Не планируем: ${stages.skipped.length}</summary>
    <p class="muted" style="font-size:13.5px;margin:8px 0">Напоминаний о них нет. Передумали — «Вернуть».</p><div class="vlist">${stages.skipped.map(vRow).join("")}</div></details></div>` : ""}`;
}
function vaccinesScreen(){
  const g = G();
  const head = `${demoBar()}${switcher()}${healthHead(g, "vaccines")}`;
  const foot = `<p class="muted" style="font-size:13px">${esc(VACCINES_LATER)} Даты ориентировочные: точную схему и вакцины уточните у педиатра.</p>`;
  if (!g.born) return `${head}
    <div class="panel"><p>Даты посчитаются сами, когда укажешь дату рождения. Вот весь календарь по возрасту:</p></div>
    <ol class="vtl">${V_STAGES.map(at => `<li class="vst later"><div class="vst-h"><b>${stageName(at)}</b></div>
      <div class="vlist">${VACCINES.filter(v => atKey(v.at) === atKey(at)).sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]).map(v => `<div class="vx"><span class="v-main"><span class="v-name">${v.kind === "rec" ? `<span class="chip rec">платно</span>` : ""}${esc(v.name)}</span>${v.note ? `<span class="v-note">${esc(v.note)}</span>` : ""}</span></div>`).join("")}</div></li>`).join("")}</ol>${foot}`;
  const kids = g.kids.map(kid => {
    const rows = S.vaccines.filter(v => v.child_id === kid.id);
    const over = rows.filter(v => vState(v) === "over");
    const overMust = over.filter(v => vKind(v) === "must" && v.status === "planned").length;
    const next = rows.filter(v => vOpen(v) && vState(v) !== "over" && (vKind(v) !== "rec" || v.status === "booked")).sort(byDue)[0];
    const nd = next && vaccineDue(next);
    const addOpen = S.vAdd === kid.id;
    return `${g.kids.length > 1 ? `<h2 class="v-kid">${esc(nameOf(kid))}</h2>` : ""}
    <div class="panel vsum ${over.length ? "has-over" : ""}">
      ${over.length ? `<p class="vsum-over">Пора сделать: ${over.length} — отмечены ниже. Срок прошёл, но сделать можно и сейчас — спроси педиатра.</p>` : ""}
      ${next ? `<p><span class="eyebrow">Следующая</span><b>${esc(next.name)}</b><span class="muted">${nd ? [fmtY(nd), inDays(daysBetween(S.today, nd))].filter(Boolean).join(" · ") : "без даты"}</span></p>` : `<p class="empty">Всё по календарю отмечено.</p>`}
      ${overMust >= 2 ? `<button type="button" class="btn ghost small" data-vpast="${kid.id}">Всё прошедшее уже сделано</button>` : ""}</div>
    ${vTimeline(kid)}
    <div class="panel">${addOpen ? `<h3>Своя запись${g.kids.length > 1 ? ` · ${esc(nameOf(kid))}` : ""}</h3>
      <div class="field"><label for="va-name">Что</label><input id="va-name" maxlength="80" placeholder="Манту, вторая доза ротавируса…"></div>
      <div class="field"><label for="va-date">Когда</label><input type="date" id="va-date" value="${S.today}"></div>
      <div class="kid-actions"><button type="button" class="btn" data-vadd="${kid.id}">Добавить</button><button type="button" class="link" data-vadd-cancel>Отмена</button></div>`
      : `<button type="button" class="btn ghost" data-vadd-open="${kid.id}">+ Своя запись (например, Манту)</button>`}</div>`;
  }).join("");
  return `${head}${kids}${foot}`;
}
function openVaccine(id, focus){
  const v = vOf(id); if (!v) return;
  const k = vKind(v), kid = S.children.find(c => c.id === v.child_id), cal = VACCINES.find(x => x.code === v.code);
  const bd = v.booked_at ? v.booked_at.slice(0, 10) : "", bt = v.booked_at?.length > 10 ? v.booked_at.slice(11, 16) : "";
  const sts = Object.keys(VSTATUS);
  openSheet(`<div class="sheet-head"><h2 class="plain">${k === "own" ? "Своя запись" : "Прививка"}</h2><button type="button" class="sheet-x" data-sheet-close aria-label="Закрыть">×</button></div>
    <div class="panel v-sheet" data-vid="${v.id}">
      ${k === "own" ? `<div class="field"><label for="v-name">Название</label><input id="v-name" maxlength="80" value="${esc(v.name)}"></div>` : `<h3>${esc(v.name)}</h3>`}
      <p class="muted" style="font-size:13.5px">${esc(nameOf(kid || {}))} · ${k === "must" ? "бесплатно по календарю МОЗ" : k === "rec" ? "рекомендованная, платно" : "своя запись"}</p>
      ${cal?.note ? `<p style="font-size:14px">${esc(cal.note)}</p>` : ""}
      <div class="seg" role="radiogroup" aria-label="Статус">${sts.map(s => `<button type="button" role="radio" data-vst="${s}" aria-pressed="${s === v.status}">${VSTATUS[s]}</button>`).join("")}</div>
      <div class="field"><label for="v-planned">${k === "own" ? "Когда" : "По календарю"}</label><input type="date" id="v-planned" value="${esc(v.planned || "")}"></div>
      <div class="field"><label for="v-bd">Записались на</label><div class="row2"><input type="date" id="v-bd" value="${bd}"><input type="time" id="v-bt" value="${bt}" aria-label="Время записи"></div><p class="note-small">Со временем бот напомнит за час до записи и пришлёт кнопку «Сделали».</p></div>
      <div class="field"><label for="v-done">Сделали</label><input type="date" id="v-done" max="${S.today}" value="${esc(v.done_date || "")}"></div>
      <div class="field"><label for="v-note">Заметка: клиника, серия вакцины, реакция</label><textarea id="v-note" maxlength="300">${esc(v.note || "")}</textarea></div>
      <div class="kid-actions"><button type="button" class="btn" data-vsave="${v.id}">Сохранить</button>${k === "own" ? `<button type="button" class="link" data-vdel="${v.id}">Удалить</button>` : ""}</div>
    </div>`);
  if (focus) setTimeout(() => document.getElementById(focus)?.focus(), 60);
}
// Изменение записи: сразу на экране, потом на сервер; при ошибке — откат.
async function saveVaccine(id, patch){
  const v = vOf(id); if (!v) return;
  const prev = {...v};
  if (patch.status === "done" && !("done_date" in patch)) patch.done_date = S.today;
  Object.assign(v, patch); haptic(); render();
  if (S.demo) return true;
  try { const r = await call("/api/vaccine", {id, ...patch}); Object.assign(v, r.vaccine); render(); return true; }
  catch (e) { Object.assign(v, prev); render(); toast("Не сохранилось: " + e.message); return false; }
}
async function addVaccine(child_id, name, planned){
  if (!name.trim()) return toast("Напиши, что за прививка или проба");
  if (S.demo) S.vaccines.push({id:-Date.now(), child_id, code:null, name:name.trim(), planned:planned || null, status:"planned", booked_at:null, done_date:null, note:null});
  else { try { S.vaccines.push((await call("/api/vaccine", {child_id, name, planned})).vaccine); } catch (e) { return toast(e.message); } }
  S.vAdd = null; haptic("success"); render(); toast("Добавлено");
}
const ask = text => tgApp?.showConfirm && initData ? new Promise(res => tgApp.showConfirm(text, res)) : Promise.resolve(confirm(text));
document.getElementById("sheet").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  const d = t.dataset;
  if (d.vst) {
    t.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === t));
    if (d.vst === "done" && !document.getElementById("v-done").value) document.getElementById("v-done").value = S.today;
    if (d.vst === "booked") document.getElementById("v-bd").focus();
    return haptic();
  }
  if (d.nunread) { await setCheck(d.nunread, 0); return openNoticeArchive(); }
  if (d.vsave) {
    const id = Number(d.vsave), v = vOf(id), bd = document.getElementById("v-bd").value, bt = document.getElementById("v-bt").value;
    const status = sheet.querySelector("[data-vst][aria-pressed='true']")?.dataset.vst || v.status;
    const patch = {status, planned:document.getElementById("v-planned").value || null, booked_at:bd ? bd + (bt ? "T" + bt : "") : null,
      done_date:status === "done" ? (document.getElementById("v-done").value || null) : null, note:document.getElementById("v-note").value.trim() || null};
    if (patch.done_date && patch.done_date > S.today) return toast("Дата прививки в будущем");
    if (vKind(v) === "own") { patch.name = document.getElementById("v-name").value.trim(); if (!patch.name) return toast("Нужно название"); }
    closeSheet();
    if (await saveVaccine(id, patch)) toast("Сохранено");
    return;
  }
  if (d.vdel) {
    if (!(await ask("Удалить эту запись?"))) return;
    const id = Number(d.vdel);
    try { if (!S.demo) await call("/api/vaccine/delete", {id}); S.vaccines = S.vaccines.filter(v => v.id !== id); closeSheet(); render(); toast("Удалено"); }
    catch (err) { toast(err.message); }
  }
});

// ---------- экспорт: JSON и PDF в чат с ботом ----------
function download(blob, name){
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function busy(btn, fn){
  if (btn.disabled) return;
  const label = btn.textContent; btn.disabled = true; btn.textContent = "Готовлю…";
  try { await fn(); } catch (e) { toast(e.message); } finally { btn.disabled = false; btn.textContent = label; }
}
// Файл уходит в чат с ботом; вне Telegram (локальная проверка) — скачивается в браузере.
async function sendFile(path, body, type, fallback){
  try {
    const r = await fetch(path, {method:"POST", headers:{...authH(), ...devHeaders, "content-type":type}, body});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Ошибка ${r.status}`);
    haptic("success"); toast("Файл в чате с ботом");
  } catch (e) {
    if (initData) throw e;
    await fallback(); toast("Telegram недоступен — файл скачан");
  }
}
function exportJSON(btn){
  if (S.demo) return toast("В демо-режиме нечего сохранять");
  return busy(btn, () => sendFile("/api/export", "{}", "application/json", async () => {
    const r = await fetch("/api/export", {headers:{...authH(), ...devHeaders}});
    if (!r.ok) throw new Error(`Ошибка ${r.status}`);
    download(await r.blob(), `first-year-${S.today}.json`);
  }));
}
function loadScript(src){
  return new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Не загрузилась библиотека PDF — проверь интернет")); document.head.appendChild(s); });
}
const toB64 = buf => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
async function buildPDF(){
  if (!window.jspdf) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js");
  const doc = new window.jspdf.jsPDF({unit:"mm", format:"a4"});
  for (const [file, style] of [["GolosText-Regular.ttf", "normal"], ["GolosText-SemiBold.ttf", "bold"]]) {
    const r = await fetch(`fonts/${file}`); if (!r.ok) throw new Error("Не загрузился шрифт для PDF");
    doc.addFileToVFS(file, toB64(await r.arrayBuffer())); doc.addFont(file, "Golos", style);
  }
  const M = 16, PW = 210 - 2*M, BOTTOM = 297 - 16;
  let y = M;
  const room = h => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };
  const text = (s, {size=10.5, bold=false, color=[28,41,50], x=M, w=PW, gap=1.5}={}) => {
    doc.setFont("Golos", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(s), w), lh = size * 0.42;
    for (const l of lines) { room(lh); doc.text(l, x, y + lh*0.8); y += lh; }
    y += gap;
  };
  const rule = () => { room(4); doc.setDrawColor(214,221,216); doc.line(M, y, M + PW, y); y += 4; };
  const MUTED = [91,106,112], WARN = [180,67,44], OK = [35,128,111];
  text("Первый год — сводка", {size:20, bold:true, gap:1});
  text(`Составлено ${fmtDate(S.today)} ${S.today.slice(0,4)} · ${S.members.map(m => m.name).join(", ")}`, {color:MUTED, gap:4});
  for (const kid of S.children) {
    rule();
    const name = nameOf(kid);
    text(name, {size:16, bold:true, gap:1});
    if (kid.birth) { const a = ageOf(kid.birth, S.today); text(`Дата рождения: ${fmtDate(kid.birth)} ${kid.birth.slice(0,4)} · возраст: ${ageText(a)} · неделя ${a.week}`, {color:MUTED, gap:4}); }
    else { text(kid.due ? `Ждём, ПДР ${fmtDate(kid.due)}` : "Ждём малыша", {color:MUTED, gap:4}); continue; }
    // прививки
    const rows = S.vaccines.filter(v => v.child_id === kid.id).sort(byDue);
    text("Прививки", {size:13, bold:true, gap:2});
    const cols = [[M, 88, "Прививка"], [M+90, 28, "По плану"], [M+120, 26, "Статус"], [M+148, 30, "Дата"]];
    const head = () => { room(6); doc.setFont("Golos","bold"); doc.setFontSize(9); doc.setTextColor(...MUTED); cols.forEach(([x,,h]) => doc.text(h, x, y + 3.5)); y += 6; };
    head();
    for (const v of rows) {
      const st = vState(v);
      const date = v.status === "done" ? (v.done_date ? fmtDate(v.done_date) + " " + v.done_date.slice(0,4) : "—")
        : v.status === "booked" && v.booked_at ? `запись ${fmtDate(v.booked_at.slice(0,10))}${v.booked_at.length > 10 ? " " + v.booked_at.slice(11,16) : ""}` : "";
      const cells = [(vKind(v) === "rec" ? "(платно) " : "") + v.name, v.planned ? `${fmtDate(v.planned)} ${v.planned.slice(0,4)}` : "—",
        st === "over" ? "просрочено" : VSTATUS[v.status], date];
      doc.setFont("Golos","normal"); doc.setFontSize(9.5);
      const split = cells.map((c, i) => doc.splitTextToSize(c, cols[i][1]));
      const note = v.note ? doc.splitTextToSize("Заметка: " + v.note, 176) : [];
      const h = Math.max(...split.map(l => l.length)) * 4 + note.length * 3.8 + 2;
      if (y + h > BOTTOM) { doc.addPage(); y = M; head(); }
      split.forEach((lines, i) => {
        doc.setTextColor(...(i === 2 ? (st === "over" ? WARN : v.status === "done" ? OK : [28,41,50]) : [28,41,50]));
        lines.forEach((l, j) => doc.text(l, cols[i][0], y + 3.5 + j*4));
      });
      y += Math.max(...split.map(l => l.length)) * 4;
      if (note.length) { doc.setFontSize(8.5); doc.setTextColor(...MUTED); note.forEach((l, j) => doc.text(l, M + 2, y + 3 + j*3.8)); y += note.length * 3.8; }
      y += 2; doc.setDrawColor(230,234,231); doc.line(M, y - 1, M + PW, y - 1);
    }
    y += 3;
    // задания по неделям
    const done = new Map();
    for (const id of Object.keys(S.checks)) {
      const m = id.match(/^c(\d+):q:(\d+):(\d+)$/); if (!m || Number(m[1]) !== kid.id) continue;
      const n = Number(m[2]); if (!done.has(n)) done.set(n, []); done.get(n).push(Number(m[3]));
    }
    text("Сделанные задания по неделям", {size:13, bold:true, gap:2});
    if (!done.size) text("Пока ничего не отмечено.", {color:MUTED});
    for (const n of [...done.keys()].sort((a, b) => a - b)) {
      text(`Неделя ${n} · ${W[n-1].t}`, {bold:true, size:10.5, gap:0.5});
      for (const i of done.get(n).sort((a, b) => a - b)) if (Q[n-1][i]) text("• " + Q[n-1][i][1], {x:M+3, w:PW-3, size:10, gap:0.5});
      y += 1.5;
    }
  }
  const bought = GEAR.filter(x => isOn(`o:${x.id}`) && !isSkip(`o:${x.id}`));
  rule();
  text("Покупки", {size:13, bold:true, gap:2});
  if (!bought.length) text("Пока ничего не отмечено.", {color:MUTED});
  for (const x of bought) { const at = S.checks[`o:${x.id}`]?.at; text(`• ${x.x}${at ? ` — отмечено ${fmtDate(new Date(at).toISOString().slice(0,10))}` : ""}`, {size:10, gap:0.5}); }
  y += 4;
  text("Даты прививок посчитаны по календарю профилактических прививок МОЗ Украины (с 01.01.2026). Точную схему и вакцины уточняйте у педиатра.", {size:8.5, color:MUTED});
  return doc.output("arraybuffer");
}
function exportPDF(btn){
  if (S.demo) return toast("В демо-режиме нечего сохранять");
  return busy(btn, async () => {
    const buf = await buildPDF();
    await sendFile("/api/export/pdf", buf, "application/pdf", async () => download(new Blob([buf], {type:"application/pdf"}), `first-year-${S.today}.pdf`));
  });
}
async function importFile(input){
  const file = input.files?.[0]; input.value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast("Не получилось прочитать файл: это не JSON"); }
  if (data?.app !== "first-year" || data.version !== 1) return toast("Это не копия данных «Первый год»");
  const when = data.exportedAt ? fmtDate(data.exportedAt.slice(0, 10)) : "?";
  if (!(await ask(`Восстановить копию от ${when}? Отметки и прививки из файла добавятся к текущим, ничего не удалится.`))) return;
  try {
    const r = await call("/api/import", {data});
    haptic("success"); toast(`Восстановлено: ${r.checks} ${plural(r.checks,"отметка","отметки","отметок")}, ${r.vaccines} ${plural(r.vaccines,"прививка","прививки","прививок")}`);
    await load();
  } catch (e) { toast(e.message); }
}

// ---------- «Советы»: секции-карусели и статьи из существующего контента ----------
const bKey = id => `b:${id}:u${S.me}`;
const secOf = id => TIP_SECS.find(s => s.id === id);
const toneOf = a => a.kind === "week" ? "phase" : a.sec === "flags" || a.sec === "notice" ? "accent" : secOf(a.sec)?.tone || "accent";
const pictArt = (k, cls) => PICT[k] ? `<span class="${cls}" aria-hidden="true">${pictSvg(pictScene(PICT[k].pose(0.35)))}</span>` : "";
function tipCard(a, cur = false){
  const ph = a.kind === "week" ? weekColor(a.week) : null, photo = photoOf(a);
  return `<button type="button" class="tcard t-${toneOf(a)} ${cur ? "cur" : ""} ${photo ? "has-photo" : ""}" data-art="${a.id}" ${ph ? `style="--ph:${ph}"` : ""}>
    ${photo ? `<img class="tc-photo" src="${photo}" alt="" loading="lazy" decoding="async">` : a.pict && a.sec !== "fa" ? pictArt(a.pict, "tc-pict") : `<span class="tc-mark" aria-hidden="true">${a.kind === "week" ? a.week : a.sec === "fa" ? "+" : ""}</span>`}
    ${a.lead ? `<span class="tc-lead">${esc(a.lead)}</span>` : ""}<b>${esc(a.title)}</b></button>`;
}
const carousel = (id, name, list, cur) => list.length ? `<section class="tsec" id="ts-${id}"><h2>${esc(name)}</h2>
  <div class="tcar">${list.map(a => tipCard(a, a.id === cur)).join("")}</div></section>` : "";
function tipsScreen(){
  const g = S.children.length ? G() : null, born = g?.born, cur = born ? curWeek(g) : null;
  const saved = ARTICLES.filter(a => isOn(bKey(a.id)) && fitsSex(a));
  const now = [cur && articleOf(`w:${cur}`), born && articleOf(`flags:${flagsFor(ageG(g).months).from}`), ...activeNotices(g).map(x => articleOf(`n:${x.n.id}`)),
    ...(cur ? ARTICLES.filter(a => a.wk && cur >= a.wk[0] && cur <= a.wk[1] && fitsSex(a)).slice(0, 8) : [])].filter(Boolean);   // гайды с wk — по возрасту
  const secs = TIP_SECS.filter(s => !["saved", "now"].includes(s.id) && (s.id !== "things" || MOD().orders) && (s.id !== "vaccines" || MOD().vaccines));
  return `${demoBar()}${switcher()}<div class="sec-title"><span class="eyebrow">Всё из приложения — по темам</span><h1>Советы</h1></div>
    ${carousel("saved", secOf("saved").name, saved)}
    ${carousel("now", secOf("now").name, now)}
    ${secs.map(s => carousel(s.id, s.name, ARTICLES.filter(a => a.sec === s.id && fitsSex(a)), s.id === "weeks" && cur ? `w:${cur}` : null)).join("")}

    <button type="button" class="link tips-fb" data-faqopen>Вопросы по приложению →</button>
    <button type="button" class="link tips-fb" data-fbopen>Нашли ошибку или есть идея? Напишите нам →</button>`;
}
const tipsPos = () => ({y:scrollY, cars:[...view.querySelectorAll(".tcar")].map(c => [c.closest(".tsec").id, c.scrollLeft])});
function restoreTips(p){ if (!p) return; for (const [id, x] of p.cars) { const c = document.querySelector(`#${id} .tcar`); if (c) c.scrollLeft = x; } if (p.y !== undefined) window.scrollTo(0, p.y); }
// прокрутить «Неделя за неделей» к текущей
function scrollTips(){
  const c = view.querySelector(".tcard.cur"), car = c?.closest(".tcar");
  if (car) car.scrollLeft = c.offsetLeft - car.offsetLeft - 16;
}
function openArticle(id){
  const a = articleOf(id); if (!a) return;
  if (a.kind === "week") { S.week = a.week; return go("week"); }
  if (a.kind === "things") { S.thView = "all"; S.focusGear = S.focusSkip = null; go("orders"); return setTimeout(() => document.getElementById(`gc-${a.cat}`)?.scrollIntoView({block:"start"}), 50); }
  if (S.tab !== "article") S.artFrom = S.tab;
  if (S.tab === "tips") S.tipsBack = tipsPos();
  S.article = id; go("article");
}
const GO_LABEL = {flags:"Красные флаги по возрасту →", vaccines:"Прививки по календарю →", growth:"Вес и рост →", today:"К рутине на сегодня →"};
function articleScreen(){
  const a = articleOf(S.article); if (!a) { S.tab = "tips"; return tipsScreen(); }
  const saved = isOn(bKey(a.id)), n = a.notice && NOTICES.find(x => x.id === a.notice);
  const block = b => `${b.h ? `<h3>${esc(b.h)}</h3>` : ""}${b.p ? `<p>${esc(b.p)}</p>` : ""}${b.ul ? `<ul>${b.ul.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${b.ol ? `<ol>${b.ol.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}`;
  const goBtn = a.go && GO_LABEL[a.go.tab] && !(a.go.tab === "vaccines" && !MOD().vaccines) && !(a.go.tab === "growth" && !MOD().growth) ? `<button type="button" class="btn ghost" data-artgo="${a.id}">${GO_LABEL[a.go.tab]}</button>` : "";
  const rel = related(a).filter(fitsSex);
  const photo = photoOf(a);
  return `<div class="art-head t-${toneOf(a)} ${photo ? "has-photo" : ""}">${photo ? `<img class="art-photo" src="${photo}" alt="">` : ""}
      <div class="art-bar"><button type="button" class="art-btn" data-back aria-label="Назад">←</button>
        ${noFam() ? "" : `<button type="button" class="art-btn" data-bm="${a.id}" aria-pressed="${saved}" aria-label="${saved ? "Убрать из сохранённых" : "Сохранить"}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4h10v16l-5-4-5 4z" fill="${saved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button>`}</div>
      ${a.pict && !photo ? pictArt(a.pict, "art-pict") : ""}
      <span class="eyebrow">${esc(secOf(a.sec)?.name || (a.sec === "flags" ? "Красные флаги" : "Важное"))}</span>
      <h1>${esc(a.title)}</h1>${a.lead && a.lead !== "Важное" && !a.id.startsWith("r:") ? `<p>${esc(a.lead)}</p>` : ""}</div>
    <div class="panel art-body">
      ${a.calls ? `<div class="sos-call">${EMERGENCY.map(e => `<a class="call" href="tel:${e.num}"><b>${e.num}</b><span>${e.label}</span></a>`).join("")}</div>
        <p class="muted" style="font-size:13px">Звони на громкой связи — диспетчер подскажет, что делать, пока едет скорая.</p>` : ""}
      ${a.blocks.map(block).join("")}
      ${n?.climate ? climateBox() : ""}
      ${(a.anims || []).map(animHTML).join("")}
      ${artVideo(VIDEOS[a.id])}
      ${goBtn}
      ${artSources(SOURCES[a.id])}
    </div>
    ${rel.length ? `<div class="panel"><h2>Связанное</h2><div class="rel">${rel.map(r => `<button type="button" class="relrow" data-art="${r.id}"><i class="t-${toneOf(r)}"></i><span><b>${esc(r.title)}</b>${r.lead ? `<small>${esc(r.lead)}</small>` : ""}</span></button>`).join("")}</div></div>` : ""}`;
}

// Видео — превью и переход на YouTube (во встроенном плеере Telegram видео часто не играет); источники — нумерованные ссылки
const artVideo = v => v ? `<a class="yt" href="https://www.youtube.com/watch?v=${esc(v.yt)}" target="_blank" rel="noopener">
    <span class="yt-th"><img src="https://i.ytimg.com/vi/${esc(v.yt)}/hqdefault.jpg" alt="" loading="lazy"><i aria-hidden="true">▶</i></span>
    <span class="yt-t"><small>Видео-инструкция · YouTube</small><b translate="no">${esc(v.t)}</b><small translate="no">${esc(v.by)}</small></span></a>` : "";
// «NHS — Breastfeeding and alcohol» → значок «NHS», заголовок страницы и домен
const srcRow = x => { const [org, ...rest] = String(x.t).split(" — "), page = rest.join(" — ") || org, dom = (() => { try { return new URL(x.u).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const w = org.replace(/\(.*?\)/g, "").replace(/^(The|US)\s+/, "").trim().split(/\s+/), caps = s => (s.match(/[A-ZА-ЯЄІЇ]/g) || []).join(""), badge = /^[A-ZА-ЯЄІЇ]{2,6}$/.test(w[0]) ? w[0] : w.length === 1 ? (caps(w[0]).length > 1 ? caps(w[0]).slice(0, 3) : w[0].slice(0, 2)) : w.filter(x => /^[A-ZА-ЯЄІЇ]/.test(x)).map(x => x[0]).join("").slice(0, 3);
  return `<li><a class="src" href="${esc(x.u)}" target="_blank" rel="noopener" translate="no"><span class="src-b">${esc(badge)}</span><span class="src-t"><b>${esc(page)}</b><small>${esc(rest.length ? org : "")}${rest.length && dom ? " · " : ""}${esc(dom)}</small></span><span class="src-go" aria-hidden="true">↗</span></a></li>`; };
const artSources = list => list?.length ? `<div class="srcs"><h3>Источники</h3><ol>${list.map(srcRow).join("")}</ol>
    <p class="muted">Общие рекомендации, сверенные с этими источниками. Они не заменяют осмотр врача.</p></div>` : "";

// ---------- поиск: пустое состояние ----------
const FREQ_Q = ["удушье","температура","сыпь","рвота","колики","срыгивание","сон","прикорм","прививки","отопление"];
const recentQ = () => { try { const v = JSON.parse(localStorage.getItem("recentQ") || "[]"); return Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, 5) : []; } catch { return []; } };
function saveRecentQ(q){
  q = String(q || "").trim(); if (q.length < 2) return;
  try { localStorage.setItem("recentQ", JSON.stringify([q, ...recentQ().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 5))); } catch {}
}
function searchEmpty(){
  const rec = recentQ();
  return `<div class="panel"><h3>Частые запросы</h3><div class="cats">${FREQ_Q.map(w => `<button type="button" data-qsuggest="${w}">${w}</button>`).join("")}</div></div>
    ${rec.length ? `<div class="panel"><h3>Недавние</h3><div class="cats">${rec.map(w => `<button type="button" data-qsuggest="${esc(w)}" translate="no">${esc(w)}</button>`).join("")}</div></div>` : ""}`;
}

// ---------- поиск ----------
S.q = ""; S.qcat = "all";
function searchScreen(){
  return `<div class="search-box">
    <input id="q" type="search" placeholder="температура, прикорм, сон…" value="${esc(S.q)}" autocomplete="off" enterkeyhint="search" aria-label="Поиск">
  </div>
  <div class="cats" role="tablist" aria-label="Категории">${CATS.map(c => `<button type="button" role="tab" data-qcat="${c.id}" aria-selected="${c.id===S.qcat}">${c.name}</button>`).join("")}</div>
  <div id="results">${resultsHTML()}</div>`;
}
function resultsHTML(){
  if (!S.q.trim()) return searchEmpty();
  const res = searchRes();
  if (!res.length) return `<p class="empty">Ничего не нашлось. Попробуй другое слово или категорию «Всё».</p>`;
  return `<p class="muted" style="font-size:13px">Найдено: ${res.length}</p>` + res.slice(0, 60).map((r, i) =>
    `<button type="button" class="result ${r.cat}" data-res="${i}"><span class="meta">${esc(CATS.find(c=>c.id===r.cat).name)} · ${esc(r.meta)}</span><b>${esc(r.title)}</b><span class="snip">${snippet(r.text, S.q, esc)}</span></button>`).join("");
}
function openResult(r){
  const go = r.go, g = G(), kid = g?.kids[0];
  closeSheet();
  saveRecentQ(S.q);
  if (go.faq) return openFaq(go.faq);
  if (go.sos) return openArticle(`fa:${go.sos}`);
  if (go.article) return openArticle(go.article);
  if (go.notice) return openArticle(`n:${go.notice}`);
  if (go.anim) return openSheet(`<div class="sheet-head"><h2>Как делать</h2><button type="button" class="sheet-x" data-sheet-close aria-label="Закрыть">×</button></div>${animHTML(go.anim)}`);
  if (go.week) { S.week = go.week; if (go.quest !== undefined && kid) openHints.add(`h:c${kid.id}:q:${go.week}:${go.quest}`); }
  if (go.gear) { openHints.add(`h:o:${go.gear}`); S.focusGear = go.gear; S.thView = "all"; }
  if (go.skip) { S.focusSkip = go.skip; S.thView = "all"; }
  if (go.routine && kid) openHints.add(`h:c${kid.id}:d:${S.today}:${go.routine}`);
  go_(go.tab);
  if (go.routine && g?.born) { const n = curWeek(g); if (n < go.from || n > go.to) toast(`Это актуально на неделях ${go.from}–${go.to}`); }
  const target = go.gear ? `#g-${go.gear}` : go.skip ? `#gs-${go.skip}` : ".info[aria-expanded='true']";
  setTimeout(() => view.querySelector(target)?.scrollIntoView({block:"center", behavior: reduceMotion ? "auto" : "smooth"}), 50);
}

// ---------- шторка ----------
const sheet = document.getElementById("sheet");
function openSheet(html){ sheet.innerHTML = `<div class="sheet-card" role="dialog" aria-modal="true">${html}</div>`; sheet.hidden = false; document.body.classList.add("locked"); }
function closeSheet(){ sheet.hidden = true; sheet.innerHTML = ""; document.body.classList.remove("locked"); }
sheet.addEventListener("click", e => {
  if (e.target === sheet || e.target.closest("[data-sheet-close]")) closeSheet();
});
document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (S.cal) return closeCal(); if (!sheet.hidden) closeSheet(); });
document.getElementById("family-open").addEventListener("click", () => { S.setSec = null; go_("family"); });
document.getElementById("search-open").addEventListener("click", () => { S.q = ""; go_("search"); setTimeout(() => document.getElementById("q")?.focus(), 30); });

// ---------- интерактивные графики: ведёшь пальцем — видно точное значение ----------
// Каждый график регистрирует модель CHARTS[id] = {at(x) → индекс/значение, show(root, v)}; x — в координатах viewBox.
const CHARTS = {};
function chartPick(e, clear){
  const root = e.target.closest?.("[data-chart]"); if (!root) return;
  const M = CHARTS[root.dataset.chart]; if (!M) return;
  if (clear) { M.show(root, null); root.classList.remove("picking"); return; }
  const svg = root.querySelector("svg"), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
  const x = vb.x + (e.clientX - r.left) / r.width * vb.width, y = vb.y + (e.clientY - r.top) / r.height * vb.height;
  const v = M.at(x, y);
  if (v === root._sel) return;
  root._sel = v; root.classList.add("picking");
  M.show(root, v); haptic();
}
view.addEventListener("pointerdown", e => { if (e.target.closest?.("[data-chart] svg")) { e.target.closest("[data-chart]")._sel = undefined; chartPick(e); } });
view.addEventListener("pointermove", e => { if (e.buttons || e.pointerType === "touch") { if (e.target.closest?.("[data-chart] svg")) chartPick(e); } });

// ---------- «Сегодня»: полоса дней и календарь рутины ----------
const DOW = ["вс","пн","вт","ср","чт","пт","сб"];
const DOW_T = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
const MONTHS_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const dowOf = iso => new Date(iso + "T12:00:00Z").getUTCDay();
const dayTitle = iso => { const k = daysBetween(S.today, iso); return `${k === -1 ? "Вчера" : k === 1 ? "Завтра" : k === 0 ? "Сегодня" : DOW_T[dowOf(iso)]}, ${fmtDate(iso)}`; };
// Прогресс рутины по дням — одним проходом по загруженным отметкам; старше окна /api/state — из счётчиков routineDays.
function dayIndex(){
  const n = Object.keys(S.checks).length;
  if (dayIndex.src === S.checks && dayIndex.n === n) return dayIndex.m;
  const m = {};
  for (const id in S.checks) { const x = /^c(\d+):d:(\d{4}-\d{2}-\d{2}):/.exec(id); if (x) m[`${x[1]}|${x[2]}`] = (m[`${x[1]}|${x[2]}`] || 0) + 1; }
  Object.assign(dayIndex, {src:S.checks, n, m});
  return m;
}
const dayLoaded = iso => !S.since || iso >= S.since || S.daysLoaded?.has(iso);
// {done, total} рутины группы за день; null — до рождения или после первого года
function dayProgress(g, iso){
  if (!g?.born || iso < g.date) return null;
  const wk = ageOf(g.date, iso).week; if (wk > 52) return null;
  const total = routineFor(g.date, iso, S.routine).length * g.kids.length;
  const idx = dayIndex(), live = dayLoaded(iso);
  const done = g.kids.reduce((s, k) => s + (live ? idx[`${k.id}|${iso}`] || 0 : S.routineDays?.[`c${k.id}`]?.[iso] || 0), 0);
  return {done:Math.min(done, total), total};
}
// Число в кольце: тонкое серое — пусто, дуга — частично, заливка — всё сделано
function ringDay(p, num){
  const C = 2 * Math.PI * 17, f = p && p.total ? p.done / p.total : 0;
  return `<span class="dring ${f >= 1 ? "full" : ""}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" class="dr-bg"/>${f > 0 && f < 1
    ? `<circle cx="20" cy="20" r="17" class="dr-fg" stroke-dasharray="${(f * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 20 20)"/>` : ""}</svg><b>${num}</b></span>`;
}
const calIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>`;
function dayStrip(g){
  const shift = (dowOf(S.today) + 6) % 7, mon = addDays(S.today, -shift + 7 * (S.stripOff || 0)), sel = S.day || S.today;
  const days = Array.from({length:7}, (_, i) => addDays(mon, i)), mid = days[3];
  const month = `${MONTHS_NOM[Number(mid.slice(5, 7)) - 1]}${mid.slice(0, 4) !== S.today.slice(0, 4) ? " " + mid.slice(0, 4) : ""}`;
  return `<div class="dstrip-wrap">
    <div class="dstrip-head">
      <button type="button" class="dnav" data-strip="-1" aria-label="Предыдущая неделя" ${days[0] <= g.date ? "disabled" : ""}>‹</button>
      <button type="button" class="dmonth" data-cal aria-label="Календарь рутины">${month} ${calIcon}</button>
      <button type="button" class="dnav" data-strip="1" aria-label="Следующая неделя">›</button>
    </div>
    <div class="dstrip" aria-label="Неделя">${days.map(iso => {
      const before = iso < g.date, fut = iso > S.today, isT = iso === S.today;
      return `<button type="button" class="dday ${isT ? "today" : ""} ${iso === sel ? "sel" : ""} ${before || fut ? "dim" : ""}" data-day="${iso}" ${before ? "disabled" : ""} aria-pressed="${iso === sel}" aria-label="${dayTitle(iso)}">
        <span>${isT ? "сегодня" : DOW[dowOf(iso)]}</span>${ringDay(fut ? null : dayProgress(g, iso), Number(iso.slice(8)))}</button>`;
    }).join("")}</div></div>`;
}
// Выбор дня в полосе: старый день — подгрузить его отметки одним запросом
async function selectDay(iso){
  const g = G(); if (!g?.born || iso < g.date) return;
  S.day = iso === S.today ? null : iso;
  const shift = (dowOf(S.today) + 6) % 7, mon = addDays(S.today, -shift);
  S.stripOff = Math.floor(daysBetween(mon, iso) / 7);
  haptic(); render();
  fetchDay(iso);
}
// Отметки старого дня одним запросом; без haptic и без сдвига полосы — годится и для тихой подгрузки после load()
async function fetchDay(iso){
  if (S.demo || dayLoaded(iso) || fetchDay.busy === iso) return;
  fetchDay.busy = iso; S.dayErr = null;
  try { const r = await call(`/api/day?date=${iso}`); Object.assign(S.checks, r.checks); (S.daysLoaded ||= new Set()).add(iso); }
  catch (e) { S.dayErr = iso; }
  fetchDay.busy = null; dayIndex.src = null;
  if (S.tab === "today") render();
}
// Рутина выбранного дня: прошлые — с отметками, будущие — только посмотреть
// пункт рутины не каждый день (5-й элемент этапа в ROUTINE)
const EVERY = n => n === 2 ? "Через день" : n === 7 ? "Раз в неделю" : `Раз в ${n} дня`;
function routineBlock(g){
  const day = S.day && S.day >= g.date ? S.day : S.today, isT = day === S.today, fut = day > S.today;
  const wait = !fut && !dayLoaded(day);   // старый день ещё не подгружен — без чекбоксов
  const wk = Math.max(1, ageOf(g.date, day).week);
  const routine = routineFor(g.date, day, S.routine);
  const ids = routine.flatMap(r => kidIds(g, `d:${day}:${r.id}`).map(x => x.id)), done = ids.filter(isOn).length;
  const sections = Object.keys(RCAT).map(cat => {
    const items = routine.filter(r => r.cat === cat); if (!items.length) return "";
    return `<div class="group"><span class="eyebrow">${RCAT[cat]}</span>
      ${items.map(r => { const how = `${r.every ? `<span class="rfreq">${EVERY(r.every)}</span> ` : ""}${esc(r.how)}`;
        return fut || wait ? `<div class="row ro"><span class="ro-dot" aria-hidden="true"></span><div><span class="t">${esc(r.x)}</span><span class="how">${how}</span></div></div>`
        : checkRow(kidIds(g, `d:${day}:${r.id}`), esc(r.x), how, RH[r.id], animsForRoutine(r.id, wk)); }).join("")}</div>`;
  }).join("");
  return `<div class="panel" id="routine">
    ${secHead(isT ? "Рутина на сегодня" : "Рутина за день", "routine", `${fut || wait ? "" : `<span class="prog ${done === ids.length ? "full" : ""}">${done}/${ids.length}</span>`}<button type="button" class="rset-btn" data-go="family" data-sec="routine" aria-label="Настроить рутину" title="Настроить рутину">✎</button>`)}
    ${isT ? "" : `<div class="dayline"><b>${dayTitle(day)}</b><button type="button" class="link" data-day="${S.today}">К сегодня</button></div>${fut ? `<p class="muted" style="font-size:13.5px">Будущий день — только посмотреть.</p>` : ""}${wait ? (S.dayErr === day ? `<p class="muted" style="font-size:13.5px">Не загрузилось — проверь интернет. <button type="button" class="link" data-dayretry>Повторить</button></p>` : `<p class="muted" style="font-size:13.5px">Загружаю…</p>`) : ""}`}
    ${isT && sections ? `<p class="note-small nb-hint">Отмечай, если хочется — это для вас, а не для отчёта.</p>` : ""}
    ${sections || `<p class="empty">Рутины на этот день нет.</p>`}
    ${remindBlock(g, day)}
  </div>`;
}
// «Помнить весь день» — без отметок, мягким цветом под рутиной
function remindBlock(g, day){
  const list = remindersFor(g.date, day); if (!list.length) return "";
  return `<div class="remind"><div class="rm-head"><span class="eyebrow">Помнить весь день</span><small>отмечать не нужно</small></div>
    ${list.map(r => `<div class="rm"><i aria-hidden="true">${r.ic}</i><div><b>${esc(r.x)}</b><ul>${r.pts.map(p => `<li>${esc(p)}</li>`).join("")}</ul>${RH[r.id] ? `<p class="rm-why"><span>Зачем:</span> ${esc(RH[r.id])}</p>` : ""}</div></div>`).join("")}</div>`;
}

// Полноэкранный календарь: месяцы от рождения до текущего (+ следующий), кольца по дням, шторка дня
const calEl = document.createElement("div"); calEl.id = "cal"; calEl.className = "cal"; calEl.hidden = true; document.body.appendChild(calEl);
const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const monthStart = (iso, k) => { const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + k; return `${y + Math.floor(m / 12)}-${String((m % 12 + 12) % 12 + 1).padStart(2, "0")}-01`; };
const monthDays = ym => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
// Отметки дня в календаре: скачок развития (и его пик) по неделе жизни, скачок роста — окна SPURTS
function dayMarks(g, iso){
  if (iso < g.date) return {};
  const wk = ageOf(g.date, iso).week, lp = leapOf(wk), sp = SPURTS.find(s => wk >= s.from && wk <= s.to);
  return {leap:lp?.k === "l", peak:lp?.k === "l" && lp.peak, spurt:sp || null};
}
function calMonth(g, ms, {mini = false, dim = false} = {}){
  const n = monthDays(ms), lead = (dowOf(ms) + 6) % 7, title = `${MONTHS_NOM[Number(ms.slice(5, 7)) - 1]}${ms.slice(0, 4) !== S.today.slice(0, 4) ? " " + ms.slice(0, 4) : ""}`;
  const cells = Array.from({length:n}, (_, i) => {
    const iso = ms.slice(0, 8) + String(i + 1).padStart(2, "0"), off = iso < g.date || iso > S.today, p = off ? null : dayProgress(g, iso);
    const mk = dayMarks(g, iso);
    if (mini) { const f = p && p.total ? p.done / p.total : 0; return `<i class="${off ? "off" : f >= 1 ? "full" : f > 0 ? "part" : ""}${mk.peak ? " pk" : ""}" ${f > 0 && f < 1 ? `style="--f:${f.toFixed(2)}"` : ""}></i>`; }
    return `<button type="button" class="cal-d ${iso === S.today ? "today" : ""} ${iso === S.cal?.day ? "sel" : ""} ${off ? "dim" : ""} ${mk.leap ? `leap${mk.peak ? " peak" : ""}` : ""} ${mk.spurt ? "spurt" : ""}" data-cday="${iso}" ${off ? "disabled" : ""}>
      ${iso === S.today ? `<small>сегодня</small>` : ""}${ringDay(p, i + 1)}</button>`;
  }).join("");
  if (mini) return `<button type="button" class="cal-mini" data-calmonth="${ms.slice(0, 7)}"><b>${title}</b><span class="cal-mgrid">${"<i class=\"blank\"></i>".repeat(lead)}${cells}</span></button>`;
  return `<section class="cal-m ${dim ? "dim" : ""}" id="cm-${ms.slice(0, 7)}"><h3>${title}</h3><div class="cal-grid">${"<span></span>".repeat(lead)}${cells}</div></section>`;
}
function calDaySheet(g, iso){
  const p = dayProgress(g, iso), kids = g.kids.map(k => k.id), facts = [];
  if (p) facts.push(`<span><b>${p.done}/${p.total}</b>рутина</span>`);
  if (MOD().feeding && daysBetween(iso, S.today) <= 30) { const n = (S.feeds || []).filter(f => kids.includes(f.child_id) && dayKey(f.start_at) === iso).length; facts.push(`<span><b>${n}</b>${plural(n, "кормление", "кормления", "кормлений")}</span>`); }
  if (MOD().sleep && daysBetween(iso, S.today) <= 30) { const ms = g.kids.reduce((a, k) => a + sleepDay(kidSleeps(k), iso, nowMs()).total, 0) / g.kids.length; if (ms) facts.push(`<span><b>${hTxt(ms).replace(" ч", "")}</b>ч сна</span>`); }
  for (const m of (S.measures || []).filter(m => kids.includes(m.child_id) && m.date === iso)) facts.push(`<span><b>${kg(m.weight_g / 1000)}</b>кг</span>`);
  const mk = dayMarks(g, iso);
  const vac = MOD().vaccines ? S.vaccines.filter(v => kids.includes(v.child_id) && (v.done_date === iso || (v.status === "booked" && v.booked_at?.slice(0, 10) === iso) || (v.status === "planned" && v.planned === iso))) : [];
  return `<div class="cal-sheet" role="dialog" aria-label="${dayTitle(iso)}">
    <div class="head"><h3>${dayTitle(iso)}</h3><button type="button" class="sheet-x" data-cday-x aria-label="Закрыть">×</button></div>
    <div class="cal-facts">${facts.join("")}</div>
    ${mk.leap || mk.spurt ? `<div class="cal-marks">${mk.leap ? `<span class="cm-leap${mk.peak ? " pk" : ""}"><b>${mk.peak ? "Пик скачка развития" : "Скачок развития"}</b>${mk.peak ? "Может чаще плакать и проситься на руки" : "Учится новому, бывает беспокойнее"}</span>` : ""}${mk.spurt ? `<span class="cm-spurt"><b>Скачок роста</b>Чаще просит есть: ${esc(mk.spurt.title)}</span>` : ""}</div>` : ""}
    ${vac.length ? `<p class="cal-vac">💉 ${vac.map(v => `${esc(v.name)} — ${v.status === "done" ? "сделано" : v.status === "booked" ? "запись" : "по плану"}`).join("; ")}</p>` : ""}
    <button type="button" class="btn" data-openday="${iso}">Открыть день</button></div>`;
}
function renderCal(){
  const g = G(); if (!g?.born) return;
  const body = calEl.querySelector(".cal-body"), top = body ? body.scrollTop : null, mode = S.cal.mode;
  const first = monthStart(g.date, 0), count = monthsBetween(first, S.today) + 1;
  const list = mode === "month"
    ? Array.from({length:count + 1}, (_, i) => calMonth(g, monthStart(first, i), {dim:i === count})).join("")
    : `<p class="cal-legend yr"><span><i class="full"></i>вся рутина</span><span><i class="part"></i>часть</span><span><i class="pk"></i>пик скачка</span></p><div class="cal-year">${Array.from({length:12}, (_, i) => calMonth(g, monthStart(first, i), {mini:true})).join("")}</div>`;
  calEl.innerHTML = `<div class="cal-top"><button type="button" class="sheet-x" data-calx aria-label="Закрыть">×</button>
      <div class="seg calseg" role="tablist">${[["month", "Месяц"], ["year", "Год"]].map(([k, n]) => `<button type="button" role="tab" data-calmode="${k}" aria-selected="${mode === k}">${n}</button>`).join("")}</div><span></span></div>
    ${mode === "month" ? `<p class="cal-legend"><span><i class="lp"></i>скачок развития</span><span><i class="pk"></i>пик скачка</span><span><i class="sp"></i>скачок роста</span></p><div class="cal-dow">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x => `<span>${x}</span>`).join("")}</div>` : ""}
    <div class="cal-body">${list}</div>${S.cal.day ? calDaySheet(g, S.cal.day) : ""}`;
  const nb = calEl.querySelector(".cal-body");
  if (top !== null && S.cal.keep) nb.scrollTop = top;
  else if (mode === "month") calEl.querySelector(`#cm-${(S.cal.month || S.today.slice(0, 7))}`)?.scrollIntoView({block:"start"});
  S.cal.keep = false;
}
function openCal(){ if (!G()?.born) return; S.cal = {mode:"month", day:null}; calEl.hidden = false; document.body.classList.add("locked"); renderCal(); haptic(); try { if (initData) tgApp?.BackButton?.show(); } catch {} }
function closeCal(){ calEl.hidden = true; calEl.innerHTML = ""; S.cal = null; document.body.classList.remove("locked"); try { if (initData) tgApp?.BackButton?.hide(); } catch {} }
try { tgApp?.BackButton?.onClick?.(() => { if (S.cal) closeCal(); }); } catch {}
calEl.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  const d = t.dataset;
  if (t.hasAttribute("data-calx")) return closeCal();
  if (d.calmode) { S.cal = {mode:d.calmode, day:null}; haptic(); return renderCal(); }
  if (d.calmonth) { S.cal = {mode:"month", day:null, month:d.calmonth}; return renderCal(); }
  if (d.cday) { S.cal.day = d.cday; S.cal.keep = true; haptic(); return renderCal(); }
  if (t.hasAttribute("data-cday-x")) { S.cal.day = null; S.cal.keep = true; return renderCal(); }
  if (d.openday) { const iso = d.openday; closeCal(); if (S.tab !== "today") go("today"); return selectDay(iso); }
});
// свайп по полосе дней — соседняя неделя
let swipeX = null;
view.addEventListener("touchstart", e => { swipeX = e.target.closest(".dstrip") ? e.touches[0].clientX : null; }, {passive:true});
view.addEventListener("touchend", e => {
  if (swipeX === null) return; const dx = e.changedTouches[0].clientX - swipeX; swipeX = null;
  if (Math.abs(dx) > 50) view.querySelector(`[data-strip="${dx < 0 ? 1 : -1}"]:not([disabled])`)?.click();
});
// 12 дуг-месяцев вокруг персикового круга: прошедшие закрашены, текущий — по дням
function ringHero(g, a, n, left){
  const R = 46, C = 50, gap = 5, arc = 30 - gap;
  const pt2 = (deg, r = R) => { const t = (deg - 90) * Math.PI / 180; return [(C + r * Math.cos(t)).toFixed(2), (C + r * Math.sin(t)).toFixed(2)]; };
  const path = (from, to) => { const [x1, y1] = pt2(from), [x2, y2] = pt2(to); return `M${x1} ${y1} A${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const part = Math.min(1, a.rest / 30.44);
  const segs = Array.from({length:12}, (_, i) => {
    const s = i * 30 + gap / 2, e = s + arc;
    if (i < a.months) return `<path d="${path(s, e)}" class="rh-seg past"/>`;
    if (i === a.months) return `<path d="${path(s, e)}" class="rh-seg cur-bg"/>${part > 0.02 ? `<path d="${path(s, s + arc * part)}" class="rh-seg cur"/>` : ""}`;
    return `<path d="${path(s, e)}" class="rh-seg todo"/>`;
  }).join("");
  const lbls = [3, 6, 9, 12].map(m => { const [x, y] = pt2(m * 30 - 15, R - 5.6); return `<text x="${x}" y="${(+y + 1.1).toFixed(2)}" text-anchor="middle" class="rh-lbl ${a.months >= m ? "on" : ""}" font-size="3.2">${m === 12 ? "год" : m}</text>`; }).join("");
  const big = a.months ? `${a.months} ${plural(a.months, "месяц", "месяца", "месяцев")}` : `${a.rest} ${plural(a.rest, "день", "дня", "дней")}`;
  const sub = a.months ? `${a.rest} ${plural(a.rest, "день", "дня", "дней")} · неделя ${n}` : `неделя ${n}`;
  return `<div class="ringhero">
    <svg viewBox="0 0 100 100" role="img" aria-label="Первый год: ${a.months} из 12 месяцев">${segs}${lbls}</svg>
    <div class="core">
      <span class="k">${esc(joinNames(g.kids))}</span>
      <span class="big">${big}</span>
      <span class="sub">${sub}</span>
      <button type="button" class="pill" data-go="week">Подробнее</button>
    </div>
  </div>
  <p class="muted" style="text-align:center;font-size:13px;margin-top:-6px">${left===7?"неделя началась сегодня":`новая неделя ${left===1?"завтра":`через ${left} ${plural(left,"день","дня","дней")}`}`} · день жизни ${a.days+1}</p>`;
}

// ---------- кормление ----------
const SIDE = {L:"Левая", R:"Правая", B:"Бутылочка"};
const nowMs = () => Date.now() + (S.skew || 0);
const fHM = ms => new Date(ms).toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
const fDur = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60 ? `${m % 60} мин` : ""}`.trim(); };
const fAgo = ms => { const m = Math.round((nowMs() - ms) / 60000); return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : `${Math.floor(m / 60)} ч ${m % 60} мин назад`; };
// до часа — секундомер «14:05»; дольше — словами: «2 ч 14 мин 05 сек», чтобы не путать с часами на циферблате
const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, "0");
  return h ? `${h} ${tr("ч")} ${m} ${tr("мин")} ${x} ${tr("сек")}` : `${m}:${x}`; };
const longT = ms => ms >= 3600e3 ? " long" : "";
const dayKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function demoFeeds(){
  const out = [], now = Date.now(); let t = now - 13 * 864e5, id = 1;
  while (t < now - 2.5 * 3600e3) { const m = 12 + Math.round(Math.random() * 14); out.push({id:id++, child_id:0, side: id % 2 ? "L" : "R", start_at:t, end_at:t + m * 60000, by_user:0}); t += (2.2 + Math.random() * 1.6) * 3600e3; }
  return out;
}
function feedKid(g){
  if (!g) return null;
  if (!g.kids.some(k => k.id === S.fkid)) S.fkid = g.kids[0].id;
  return g.kids.find(k => k.id === S.fkid);
}
const kidFeeds = kid => (S.feeds || []).filter(f => f.child_id === kid.id).sort((a, b) => a.start_at - b.start_at);
const activeFeed = kid => kidFeeds(kid).find(f => !f.end_at);
const lastFeed = kid => kidFeeds(kid).filter(f => f.end_at).at(-1);
// длительность без пауз; на паузе — замерла на моменте паузы
const fLen = (f, now = nowMs()) => (f.end_at ?? f.paused_at ?? now) - f.start_at - (f.pause_ms || 0);
// таймер: идёт — тикает от start_at + паузы; на паузе — стоит (без data-since)
const fTimer = (f, cls = "") => `<b class="ftimer${cls}${longT(fLen(f))}"${f.paused_at ? "" : ` data-since="${f.start_at + (f.pause_ms || 0)}"`}>${clock(fLen(f))}</b>`;
const nextSide = kid => { const l = lastFeed(kid); return l?.side === "L" ? "R" : "L"; };

// На «Сегодня» — только сводка; старт и стоп кормления — на вкладке «Кормление».
// Идёт кормление или сон — тонкая плашка наверху «Сегодня»: таймер и кнопка закончить, не уходя с экрана.
function liveBar(g){
  const m = MOD(), twins = g.kids.length > 1, rows = [];
  for (const k of g.kids) {
    const who = twins ? `${esc(nameOf(k))} · ` : "";
    const f = m.feeding && activeFeed(k);
    if (f) rows.push(`<div class="live${f.paused_at ? " paused" : ""}"><button type="button" class="lv-go" data-go="feed"><i aria-hidden="true">🍼</i><span>${who}${f.paused_at ? "пауза" : "ест"} · ${esc(SIDE[f.side].toLowerCase())}</span>${fTimer(f)}</button>
      <button type="button" class="lv-btn" data-fstop="${f.id}">${sx(k, "Поел", "Поела", "Поел(-а)")}</button></div>`);
    const s = m.sleep && activeSleep(k);
    if (s) rows.push(`<div class="live sleep"><button type="button" class="lv-go" data-go="sleep"><i aria-hidden="true">😴</i><span>${who}спит</span><b class="ftimer${longT(nowMs() - s.start_at)}" data-since="${s.start_at}">${clock(nowMs() - s.start_at)}</b></button>
      <button type="button" class="lv-btn" data-sstop="${s.id}">${sx(k, "Проснулся", "Проснулась", "Проснулся(-ась)")}</button></div>`);
  }
  return rows.length ? `<div class="livebar">${rows.join("")}</div>` : "";
}
function feedStat(g){
  if (!g?.born) return "";
  const today = dayKey(nowMs()), twins = g.kids.length > 1;
  const line = kid => {
    const act = activeFeed(kid), last = lastFeed(kid), n = kidFeeds(kid).filter(f => f.end_at && dayKey(f.start_at) === today).length;
    if (act) return `${act.paused_at ? "пауза" : "идёт"}: ${SIDE[act.side].toLowerCase()} · ${fTimer(act)}`;
    return `${n} ${plural(n, "раз", "раза", "раз")} сегодня${last ? ` · последнее ${fAgo(last.end_at)}` : ""}`;
  };
  const kids = g.kids.filter(k => !activeFeed(k));   // идущее — в плашке наверху «Сегодня»
  if (!kids.length) return "";
  return `<button type="button" class="feedstat" data-go="feed"><span class="eyebrow">Кормление</span>
    ${kids.map(k => `<span>${twins ? `${esc(nameOf(k))}: ` : ""}${line(k)}</span>`).join("")}<i aria-hidden="true">→</i></button>`;
}

// Одна вкладка на кормление и сон: если ведут оба — переключатель сверху.
const careView = () => { const m = MOD(); return !m.feeding ? "sleep" : !m.sleep ? "feed" : S.fview === "sleep" ? "sleep" : "feed"; };
const careTitle = () => { const m = MOD(); return m.feeding && m.sleep ? "Еда и сон" : m.sleep ? "Сон" : "Кормление"; };
function feedScreen(){
  const g = G(), cv = careView(), title = cv === "sleep" ? "Сон" : "Кормление";
  if (!g?.born) return `${demoBar()}${switcher()}<div class="sec-title"><h1>${title}</h1></div><div class="panel"><p>${cv === "sleep" ? "Сон начнём записывать после рождения." : "Кормления начнём записывать после рождения."}</p></div>`;
  const kid = feedKid(g);
  const busy = k => cv === "sleep" ? activeSleep(k) : activeFeed(k);
  const chips = g.kids.length > 1 ? `<div class="cats">${g.kids.map(k => `<button type="button" data-fkid="${k.id}" aria-selected="${k.id === kid.id}">${esc(nameOf(k))}${busy(k) ? " ●" : ""}</button>`).join("")}</div>` : "";
  const seg = MOD().feeding && MOD().sleep ? `<div class="seg3 care">${[["feed", "Кормление", activeFeed], ["sleep", "Сон", activeSleep]].map(([k, n, a]) => `<button type="button" data-fview="${k}" aria-selected="${cv === k}">${n}${g.kids.some(a) ? " ●" : ""}</button>`).join("")}</div>` : "";
  if (cv === "sleep") return `${demoBar()}${switcher()}<div class="sec-title"><span class="eyebrow">${esc(nameOf(kid))}</span><h1>Сон</h1></div>${seg}${chips}${sleepScreen(g, kid)}`;
  const act = activeFeed(kid), fs = kidFeeds(kid).filter(f => f.end_at), now = nowMs();
  S.fside = S.fside && SIDE[S.fside] ? S.fside : nextSide(kid);
  const last = lastFeed(kid);
  const main = act ? `<div class="fbig active${act.paused_at ? " paused" : ""}">
      <span class="eyebrow">${SIDE[act.side]} · с ${fHM(act.start_at)}${act.paused_at ? ` · пауза с ${fHM(act.paused_at)}` : ""}${memberOf(act.by_user) ? ` · ${esc(memberOf(act.by_user).name)}` : ""}</span>
      ${fTimer(act, " big")}
      ${act.pause_ms && !act.paused_at ? `<span class="muted" style="font-size:13.5px">паузы ${fDur(act.pause_ms)} не в счёт</span>` : ""}
      <div class="frow">${act.paused_at ? `<button type="button" class="btn ghost" data-fresume="${act.id}">Продолжить</button>` : `<button type="button" class="btn ghost" data-fpause="${act.id}">Пауза</button>`}${act.side !== "B" ? `<button type="button" class="btn ghost" data-fswitch="${act.id}">Сменить грудь</button>` : ""}<button type="button" class="btn" data-fstop="${act.id}">Закончить</button></div>
      ${act.paused_at ? `<p class="note-small">Время на паузе не считается. «Закончить» запишет кормление до начала паузы.</p>` : ""}
      <p class="note-small">Если свернёшь приложение, бот пришлёт сообщение с таймером и кнопкой «Закончить».</p></div>`
    : `<div class="fbig">
      <div class="fsides">${Object.entries(SIDE).map(([k, n]) => `<button type="button" data-fside="${k}" aria-pressed="${S.fside === k}">${n}${k === nextSide(kid) && k !== "B" && last ? "<small>по очереди</small>" : ""}</button>`).join("")}</div>
      <button type="button" class="btn fstartbtn" data-fstart="${S.fside}">Старт</button>
      <span class="muted" style="font-size:13.5px">${last ? `Последнее: ${SIDE[last.side].toLowerCase()}, ${fAgo(last.end_at)}` : "Первое кормление — нажми «Старт»"}</span>
      <button type="button" class="link" data-fpast="top">Уже покормила — записать задним числом</button></div>`;
  const pastBody = `<div class="past-form" id="fp-form"><h3>Записать кормление</h3>
      <div class="fsides small">${Object.entries(SIDE).map(([k, n]) => `<button type="button" data-fpside="${k}" aria-pressed="${(S.fpside || "L") === k}">${n}</button>`).join("")}</div>
      <div class="mform"><div class="field"><label for="fp-date">Дата</label><input type="date" id="fp-date" value="${S.today}" max="${S.today}"></div>
        <div class="field"><label for="fp-time">Начало</label><input type="time" id="fp-time" value="${fHM(now - 30 * 60000)}"></div>
        <div class="field"><label for="fp-min">Минут</label><input id="fp-min" inputmode="numeric" value="15"></div></div>
      <div class="kid-actions"><button type="button" class="btn" id="fp-save">Записать</button><button type="button" class="link" data-fpast="${S.fpast}">Отмена</button></div></div>`;
  const pastForm = S.fpast === "top" ? `<div class="panel">${pastBody}</div>` : "";

  // статистика
  const today = dayKey(now), byDay = {};
  for (const f of fs) { const k = dayKey(f.start_at); (byDay[k] ||= []).push(f); }
  const todayF = byDay[today] || [];
  const gaps = fs.slice(-12).map((f, i, a) => i ? f.start_at - a[i - 1].start_at : null).filter(Boolean);
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const stats = `<div class="tiles">
    <div class="tile ok"><b>${todayF.length}</b><span>раз сегодня</span></div>
    <div class="tile"><b>${fDur(todayF.reduce((a, f) => a + fLen(f), 0)).replace(" мин", "м").replace(" ч ", "ч ")}</b><span>всего сегодня</span></div>
    <div class="tile"><b>${avgGap ? fDur(avgGap).replace(" мин", "м").replace(" ч ", "ч ") : "—"}</b><span>между кормлениями</span></div></div>`;

  const range = S.frange || 7, mode = S.fchart || "count";
  const days = Array.from({length:range}, (_, i) => dayKey(now - (range - 1 - i) * 864e5));
  const chart = feedBars(days, byDay, mode);
  const strip = feedHours(todayF, act && dayKey(act.start_at) === today ? act : null, now);

  const hist = Object.keys(byDay).sort().reverse().slice(0, 10).map(d => {
    const list = byDay[d].slice().reverse(), total = list.reduce((a, f) => a + fLen(f), 0);
    const label = d === today ? "Сегодня" : d === dayKey(now - 864e5) ? "Вчера" : new Date(d + "T12:00").toLocaleDateString("ru-RU", {day:"numeric", month:"long", weekday:"short"});
    return `<div class="fday"><div class="head"><b>${label}</b><span class="muted">${list.length} ${plural(list.length, "раз", "раза", "раз")} · ${fDur(total)}</span></div>
      ${list.map(f => { const who = memberOf(f.by_user); return `<div class="frec"><span class="fside-dot ${f.side}">${f.side === "B" ? "Б" : f.side === "L" ? "Л" : "П"}</span><span>${fHM(f.start_at)}–${fHM(f.end_at)}</span><span class="muted">${fDur(fLen(f))}</span>${who ? `<i class="dotwho" style="--c:${colorHex(who.color)}" title="${esc(who.name)}"></i>` : "<i></i>"}<button type="button" class="pen" data-fedit="${f.id}" aria-label="Изменить кормление" aria-expanded="${S.fedit === f.id}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button></div>${S.fedit === f.id ? feedEditForm(f) : ""}`; }).join("")}</div>`;
  }).join("");

  return `${demoBar()}${switcher()}<div class="sec-title"><span class="eyebrow">${esc(nameOf(kid))}</span><h1>Кормление</h1></div>${seg}${chips}
  ${main}${pastForm}${stats}
  <div class="panel"><div class="head"><h2>Сегодня по часам</h2></div>${strip}</div>
  <div class="panel">
    <div class="seg3">${[[7,"Неделя"],[14,"2 недели"],[30,"Месяц"]].map(([k, n]) => `<button type="button" data-frange="${k}" aria-selected="${range === k}">${n}</button>`).join("")}</div>
    ${chart}
    <div class="cats">${[["count","Раз в день"],["min","Минут в день"]].map(([k, n]) => `<button type="button" data-fchart="${k}" aria-selected="${mode === k}">${n}</button>`).join("")}</div>
  </div>
  <div class="panel"><div class="head"><h2>История</h2><button type="button" class="btn ghost small" data-fpast="hist" aria-expanded="${S.fpast === "hist"}">+ Добавить</button></div>
    ${S.fpast === "hist" ? pastBody : ""}${hist || `<p class="empty">Пока пусто. Нажми «Старт» во время кормления или запиши прошедшее.</p>`}</div>`;
}
// Правка записи — форма прямо под строкой истории; там же «Удалить».
function feedEditForm(f){
  const side = S.feside || f.side;
  return `<div class="fedit"><div class="fsides small">${Object.entries(SIDE).map(([k, n]) => `<button type="button" data-feside="${k}" aria-pressed="${side === k}">${n}</button>`).join("")}</div>
    <div class="mform"><div class="field"><label for="fe-date">Дата</label><input type="date" id="fe-date" value="${dayKey(f.start_at)}" max="${S.today}"></div>
      <div class="field"><label for="fe-time">Начало</label><input type="time" id="fe-time" value="${fHM(f.start_at)}"></div>
      <div class="field"><label for="fe-min">Минут</label><input id="fe-min" inputmode="numeric" value="${Math.max(1, Math.round(fLen(f) / 60000))}"></div></div>
    <div class="kid-actions"><button type="button" class="btn" id="fe-save" data-id="${f.id}">Сохранить</button><button type="button" class="link" data-fedit="${f.id}">Отмена</button><button type="button" class="link danger" data-fdel="${f.id}">Удалить</button></div></div>`;
}
// Столбики по дням, как в «Активности»: шапка — среднее за период, касание — выбранный день.
function feedBars(days, byDay, mode){
  const W = 340, H = 150, L = 4, R = 30, T = 8, B = 20, n = days.length, bw = (W - L - R) / n;
  const per = d => byDay[d] || [];
  const vals = days.map(d => per(d).reduce((a, f) => a + (mode === "count" ? 1 : fLen(f) / 60000), 0));
  const max = Math.max(mode === "count" ? 4 : 60, ...vals) * 1.1, nz = vals.filter(v => v), avg = nz.length ? nz.reduce((a, b) => a + b, 0) / nz.length : 0;
  const y = v => T + (H - T - B) * (1 - v / max);
  const step = mode === "count" ? (max > 12 ? 5 : 2) : (max > 200 ? 100 : 50), ticks = [];
  for (let v = step; v < max; v += step) ticks.push(v);
  const id = "fb";
  const fmtV = v => mode === "count" ? `${Math.round(v)} <small>${plural(Math.round(v), "раз", "раза", "раз")}</small>` : `${fDur(v * 60000).replace(/ ч /, " ч ")}`;
  const avgTxt = avg ? (mode === "count" ? `${avg.toFixed(1).replace(".", ",")} <small>раза в день</small>` : `${fDur(avg * 60000)} <small>в день</small>`) : "—";
  const dLabel = d => new Date(d + "T12:00").toLocaleDateString("ru-RU", {weekday:"short", day:"numeric", month:"short"});
  CHARTS[id] = {
    at: x => Math.max(0, Math.min(n - 1, Math.floor((x - L) / bw))),
    show(root, i){
      const head = root.querySelector(".ch-head");
      root.querySelectorAll(".fc-bar").forEach((b, k) => b.classList.toggle("sel", k === i));
      root.querySelector("svg").classList.toggle("has-sel", i !== null);
      if (i === null) { head.innerHTML = `<span class="ch-k">В среднем</span><b>${avgTxt}</b><span class="ch-d">${dLabel(days[0])} — ${dLabel(days[n - 1])}</span>`; return; }
      const list = per(days[i]), mins = list.reduce((a, f) => a + fLen(f), 0);
      head.innerHTML = `<span class="ch-k">${dLabel(days[i])}</span><b>${fmtV(vals[i])}</b><span class="ch-d">${list.length} ${plural(list.length, "кормление", "кормления", "кормлений")} · ${fDur(mins)}${list.length ? ` · первое ${fHM(list[0].start_at)}, последнее ${fHM(list.at(-1).start_at)}` : ""}</span>`;
    },
  };
  return `<div class="ichart" data-chart="${id}"><div class="ch-head"><span class="ch-k">В среднем</span><b>${avgTxt}</b><span class="ch-d">${dLabel(days[0])} — ${dLabel(days[n - 1])}</span></div>
    <svg class="fchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${mode === "count" ? "Кормлений в день" : "Минут кормления в день"}">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R + 4}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="fc-grid"/><text x="${W - 2}" y="${(y(v) + 3).toFixed(1)}" class="fc-ax" text-anchor="end">${v}</text>`).join("")}
    ${avg ? `<line x1="${L}" x2="${W - R + 4}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}" class="fc-avg"/>` : ""}
    ${vals.map((v, i) => { const x = L + i * bw + bw * 0.16, w = bw * 0.68, h = Math.max(v ? 3 : 0, H - B - y(v));
      return `<rect x="${x.toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, w / 2).toFixed(1)}" class="fc-bar${i === n - 1 ? " now" : ""}"/>
        ${(n <= 14 || i % 5 === 0 || i === n - 1) ? `<text x="${(x + w / 2).toFixed(1)}" y="${H - 5}" class="fc-ax" text-anchor="middle">${n <= 7 ? new Date(days[i] + "T12:00").toLocaleDateString("ru-RU", {weekday:"short"}) : Number(days[i].slice(8))}</text>` : ""}`; }).join("")}
    <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
  </svg></div>`;
}
// Сегодня по часам: 24 столбика минут кормления, касание — что было в этот час.
function feedHours(list, act, now){
  const W = 340, H = 120, L = 4, R = 4, T = 8, B = 18, bw = (W - L - R) / 24;
  const all = act ? [...list, {...act, end_at: act.paused_at || now, paused_at: null, live: true}] : list;
  const mins = Array(24).fill(0), inHour = Array.from({length:24}, () => []);
  for (const f of all) for (let h = 0; h < 24; h++) {
    const a = new Date(now); a.setHours(h, 0, 0, 0); const b0 = a.getTime(), b1 = b0 + 3600e3;
    const ov = Math.min(f.end_at, b1) - Math.max(f.start_at, b0);
    if (ov > 0) { mins[h] += ov / 60000; inHour[h].push(f); }
  }
  const max = 60, y = v => T + (H - T - B) * (1 - Math.min(v, max) / max), curH = new Date(now).getHours();
  const total = all.reduce((a, f) => a + fLen(f), 0);
  const sumTxt = `${all.length} <small>${plural(all.length, "раз", "раза", "раз")}</small>`;
  const id = "fh";
  CHARTS[id] = {
    at: x => Math.max(0, Math.min(23, Math.floor((x - L) / bw))),
    show(root, h){
      const head = root.querySelector(".ch-head");
      root.querySelectorAll(".fh-bar").forEach((b, k) => b.classList.toggle("sel", k === h));
      root.querySelector("svg").classList.toggle("has-sel", h !== null);
      if (h === null) { head.innerHTML = `<span class="ch-k">Сегодня</span><b>${sumTxt}</b><span class="ch-d">${fDur(total)} всего</span>`; return; }
      const fs = inHour[h];
      head.innerHTML = `<span class="ch-k">${String(h).padStart(2, "0")}:00–${String(h + 1).padStart(2, "0")}:00</span><b>${Math.round(mins[h])} <small>мин</small></b><span class="ch-d">${fs.length ? fs.map(f => `${SIDE[f.side].toLowerCase()} ${fHM(f.start_at)}–${f.live ? "сейчас" : fHM(f.end_at)}`).join(", ") : "не кормили"}</span>`;
    },
  };
  return `<div class="ichart" data-chart="${id}"><div class="ch-head"><span class="ch-k">Сегодня</span><b>${sumTxt}</b><span class="ch-d">${fDur(total)} всего</span></div>
    <svg class="fchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Кормления сегодня по часам">
    <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="fc-grid"/>
    ${mins.map((v, h) => { const x = L + h * bw + bw * 0.14, w = bw * 0.72, hh = v ? Math.max(3, H - B - y(v)) : 0, side = inHour[h].at(-1)?.side || "L";
      return `<rect x="${x.toFixed(1)}" y="${(H - B - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="2.5" class="fh-bar fs-${side}${h > curH ? " future" : ""}"/>`; }).join("")}
    ${[0, 6, 12, 18].map(h => `<text x="${(L + h * bw + 1).toFixed(1)}" y="${H - 4}" class="fc-ax">${String(h).padStart(2, "0")}</text>`).join("")}
    <line x1="${(L + (curH + new Date(now).getMinutes() / 60) * bw).toFixed(1)}" x2="${(L + (curH + new Date(now).getMinutes() / 60) * bw).toFixed(1)}" y1="${T}" y2="${H - B}" class="fs-now"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
  </svg></div>`;
}
async function feedAct(path, body, okMsg){
  if (S.demo) {
    const now = nowMs(), kid = feedKid(G());
    if (path === "start") { (S.feeds.find(f => f.child_id === kid.id && !f.end_at) || {}).end_at = now; S.feeds.push({id:Date.now(), child_id:kid.id, side:body.side, start_at:now, end_at:null, by_user:S.me}); }
    if (path === "pause" || path === "resume") { const f = S.feeds.find(x => x.id === body.id); if (path === "pause") f.paused_at ||= now; else if (f.paused_at) { f.pause_ms = (f.pause_ms || 0) + now - f.paused_at; f.paused_at = null; } }
    if (path === "stop" || path === "switch") { const f = S.feeds.find(x => x.id === body.id); f.end_at = f.paused_at || now; f.paused_at = null; if (path === "switch") S.feeds.push({id:Date.now(), child_id:f.child_id, side:f.side === "L" ? "R" : "L", start_at:now, end_at:null, by_user:S.me}); }
    if (path === "add") S.feeds.push({id:Date.now(), child_id:kid.id, side:body.side, start_at:body.start_at, end_at:body.start_at + body.minutes * 60000, by_user:S.me});
    if (path === "delete") S.feeds = S.feeds.filter(f => f.id !== body.id);
    if (path === "edit") Object.assign(S.feeds.find(x => x.id === body.id), {side:body.side, start_at:body.start_at, end_at:body.start_at + body.minutes * 60000, pause_ms:0});
    haptic(); return render();
  }
  haptic();
  return act(() => call(`/api/feed/${path}`, body), okMsg);
}
// тикают только цифры таймера, без перерисовки экрана
setInterval(() => { for (const el of document.querySelectorAll(".ftimer[data-since]")) { const ms = nowMs() - Number(el.dataset.since); el.textContent = clock(ms); el.classList.toggle("long", ms >= 3600e3); } }, 1000);
// «не спит 1 ч 20 мин» — в минутах, раз в 20 секунд
setInterval(() => { for (const el of document.querySelectorAll(".fdur[data-since]")) el.textContent = tr(fDur(nowMs() - Number(el.dataset.since))); }, 20000);
// свернули приложение во время кормления — бот пришлёт сообщение-таймер
function feedAway(){
  if (S.demo) return;
  const send = (kind, x) => {
    const key = `${kind}:${x.id}`; if (feedAway.sent?.has(key)) return; (feedAway.sent ||= new Set()).add(key);
    fetch(`/api/${kind}/away`, {method:"POST", keepalive:true, headers:{...authH(), ...devHeaders, "content-type":"application/json"}, body: JSON.stringify({id:x.id})}).catch(() => {});
  };
  for (const f of S.feeds || []) if (!f.end_at && f.by_user === S.me) send("feed", f);
  // сон — тоже только тому, кто его отметил: второго родителя не тревожим
  if (MOD().sleep) for (const s of S.sleeps || []) if (!s.end_at && s.by_user === S.me) send("sleep", s);
}
document.addEventListener("visibilitychange", () => { if (document.hidden) feedAway(); });
tgApp?.onEvent?.("deactivated", feedAway);

// ---------- сон ----------
// Сутки — с полуночи до полуночи: ночной сон делится между двумя днями, сумма за сутки остаётся честной.
// Ночной — тот, что начался с 19:00 до 06:00; остальное — дневной сон.
const sx = (k, m, f, n) => k?.sex === "boy" ? m : k?.sex === "girl" ? f : n;
// сон короче минуты (дважды нажали «Уснул») не показываем
const kidSleeps = kid => (S.sleeps || []).filter(s => s.child_id === kid.id && (!s.end_at || s.end_at - s.start_at >= 60000)).sort((a, b) => a.start_at - b.start_at);
const activeSleep = kid => kidSleeps(kid).find(s => !s.end_at);
const lastSleep = kid => kidSleeps(kid).filter(s => s.end_at).at(-1);
const sEnd = (s, now) => s.end_at ?? now;
const d0 = iso => new Date(iso + "T00:00").getTime();
const dNext = iso => dayKey(d0(iso) + 30 * 3600e3);
const isNight = s => { const h = new Date(s.start_at).getHours(); return h >= 19 || h < 6; };
const sleepIn = (list, iso, now) => { const a = d0(iso), b = d0(dNext(iso)); return list.map(s => ({s, a:Math.max(a, s.start_at), b:Math.min(b, sEnd(s, now))})).filter(p => p.b > p.a); };
function sleepDay(list, iso, now){
  const r = {night:0, day:0, naps:0, longest:0};
  for (const p of sleepIn(list, iso, now)) { if (isNight(p.s)) r.night += p.b - p.a; else { r.day += p.b - p.a; if (p.s.start_at >= d0(iso)) r.naps++; } }
  for (const s of list) if (dayKey(sEnd(s, now)) === iso) r.longest = Math.max(r.longest, sEnd(s, now) - s.start_at);   // самый длинный — по дню пробуждения
  r.total = r.night + r.day; return r;
}
// ориентиры по возрасту: сон за сутки и сколько обычно бодрствуют между снами
const sleepNorm = w => w < 17 ? [14, 17] : w < 52 ? [12, 16] : [11, 14];
const awakeNorm = w => w < 6 ? "45–60 мин" : w < 13 ? "1–1,5 ч" : w < 26 ? "1,5–2,5 ч" : w < 39 ? "2–3 ч" : "3–4 ч";
// Ориентиры собраны из общепринятых рекомендаций по детскому сну; у конкретного ребёнка разброс шире.
const napsNorm = w => w < 13 ? "4–5, без чёткого режима" : w < 26 ? "3–4" : w < 39 ? "2–3" : w < 52 ? "2" : "1–2";
const nightNorm = w => w < 13 ? "8–9 ч с пробуждениями на еду" : w < 26 ? "9–11 ч, бывают пробуждения" : "10–12 ч";
// Шкала, как у веса: зелёная полоса — ориентир для возраста, метка — ваше среднее за 7 дней.
function sleepGauge(w, avg, days){
  const [lo, hi] = sleepNorm(w), A = 8, Z = 20, pc = h => `${(Math.max(A, Math.min(Z, h)) - A) / (Z - A) * 100}%`;
  const h = avg / 3600e3, has = days >= 3;
  const st = !has ? "" : h < lo - .25 ? `меньше ориентира на ${hTxt((lo - h) * 3600e3)}` : h > hi + .25 ? `больше ориентира на ${hTxt((h - hi) * 3600e3)}` : "в пределах ориентира";
  return `<div class="sgauge">
    <div class="sg-head"><span class="eyebrow">Сна за сутки</span><b>${lo}–${hi} ч</b><span class="muted">норма для возраста</span></div>
    <div class="sg-track"><i class="sg-band" style="left:${pc(lo)};width:calc(${pc(hi)} - ${pc(lo)})"></i>${has ? `<i class="sg-mark" style="left:${pc(h)}"><span>${hTxt(avg)}</span></i>` : ""}</div>
    <div class="sg-ax">${[8, 11, 14, 17, 20].map(x => `<span style="left:${pc(x)}">${x}</span>`).join("")}</div>
    <p class="sg-st">${has ? `У вас в среднем <b>${hTxt(avg)}</b> за последние ${days} ${plural(days, "день", "дня", "дней")} — ${st}.` : "Отмечайте сон 3 дня — здесь появится ваше среднее."}</p>
  </div>`;
}
const sleepFacts = w => `<div class="srows">
      <div><span>Ночью</span><b class="sf">${nightNorm(w)}</b></div>
      <div><span>Дневных снов</span><b class="sf">${napsNorm(w)}</b></div>
      <div><span>Бодрствование между снами</span><b class="sf">${awakeNorm(w)}</b></div></div>`;
const hTxt = ms => { const h = ms / 3600e3; return h ? `${h.toFixed(1).replace(".0", "").replace(".", ",")} ч` : "0"; };
function demoSleeps(){
  const out = [], now = Date.now(); let id = 1;
  for (let d = 13; d >= 0; d--) {
    const base = new Date(now - d * 864e5); base.setHours(0, 0, 0, 0); const b = base.getTime(), r = () => (Math.random() - .5) * 3600e3;
    for (const [h, len] of [[-3.5 + d * 0.05, 5.5], [3.2, 3], [9.5, 1.5], [12.8, 2], [16.6, .8]]) {
      const st = b + h * 3600e3 + r() * .6, en = st + (len + d * -0.04) * 3600e3 + r() * .5;
      if (en < now) out.push({id:id++, child_id:0, start_at:st, end_at:en, by_user:0});
    }
  }
  return out;
}

function sleepStat(g){
  if (!g?.born) return "";
  const now = nowMs(), today = dayKey(now), twins = g.kids.length > 1;
  const line = kid => {
    const act = activeSleep(kid), last = lastSleep(kid), t = sleepDay(kidSleeps(kid), today, now);
    if (act) return `спит · <b class="ftimer" data-since="${act.start_at}">${clock(now - act.start_at)}</b>`;
    return `${hTxt(t.total)} сна сегодня${last ? ` · не спит ${fDur(now - last.end_at)}` : ""}`;
  };
  const kids = g.kids.filter(k => !activeSleep(k));   // идущий сон — в плашке наверху «Сегодня»
  if (!kids.length) return "";
  return `<button type="button" class="feedstat" data-go="sleep"><span class="eyebrow">Сон</span>
    ${kids.map(k => `<span>${twins ? `${esc(nameOf(k))}: ` : ""}${line(k)}</span>`).join("")}<i aria-hidden="true">→</i></button>`;
}

function sleepScreen(g, kid){
  const now = nowMs(), today = dayKey(now), all = kidSleeps(kid), act = activeSleep(kid), last = lastSleep(kid), w = ageG(g).days / 7;
  const main = act ? `<div class="fbig active sleep">
      <span class="eyebrow">Спит с ${fHM(act.start_at)}${memberOf(act.by_user) ? ` · ${esc(memberOf(act.by_user).name)}` : ""}</span>
      <b class="ftimer big${longT(now - act.start_at)}" data-since="${act.start_at}">${clock(now - act.start_at)}</b>
      <div class="frow"><button type="button" class="btn" data-sstop="${act.id}">${sx(kid, "Проснулся", "Проснулась", "Проснулся(-ась)")}</button></div>
      ${now - act.start_at > 12 * 3600e3 ? `<p class="note-small">Сон идёт больше 12 часов — может, забыли остановить? Удали запись в истории и запиши сон вручную.</p>` : ""}</div>`
    : `<div class="fbig">
      <button type="button" class="btn fstartbtn" data-sstart>${sx(kid, "Уснул", "Уснула", "Уснул(а)")}</button>
      <span class="muted" style="font-size:13.5px">${last ? `Не спит <b class="fdur" data-since="${last.end_at}">${fDur(now - last.end_at)}</b> · обычно в этом возрасте ${awakeNorm(w)}` : "Нажми, когда малыш уснёт — потом «Проснулся»"}</span>
      <button type="button" class="link" data-spast="top">Записать сон задним числом</button></div>`;
  const pastBody = `<div class="past-form" id="sp-form"><h3>Записать сон</h3>
      <div class="mform"><div class="field"><label for="sp-date">Дата</label><input type="date" id="sp-date" value="${S.today}" max="${S.today}"></div>
        <div class="field"><label for="sp-from">Уснул(а)</label><input type="time" id="sp-from" value="${fHM(now - 90 * 60000)}"></div>
        <div class="field"><label for="sp-to">Проснулся(-ась)</label><input type="time" id="sp-to" value="${fHM(now)}"></div></div>
      <p class="note-small">Если время пробуждения меньше времени засыпания — значит, проснулся на следующий день.</p>
      <div class="kid-actions"><button type="button" class="btn" id="sp-save">Записать</button><button type="button" class="link" data-spast="${S.spast}">Отмена</button></div></div>`;
  const pastForm = S.spast === "top" ? `<div class="panel">${pastBody}</div>` : "";

  const t = sleepDay(all, today, now);
  const stats = `<div class="tiles">
    <div class="tile ok"><b>${hTxt(t.total)}</b><span>сна сегодня</span></div>
    <div class="tile"><b>${t.naps}</b><span>${plural(t.naps, "дневной сон", "дневных сна", "дневных снов")}</span></div>
    <div class="tile"><b>${t.longest ? hTxt(t.longest) : "—"}</b><span>дольше всего</span></div></div>`;

  // как меняется: последние 7 полных дней против 7 до них
  const days = n => Array.from({length:n}, (_, i) => dayKey(now - (n - i) * 864e5));
  const span = list => { const ds = list.filter(d => sleepDay(all, d, now).total), r = ds.map(d => sleepDay(all, d, now)), avg = k => r.length ? r.reduce((a, x) => a + x[k], 0) / r.length : null; return {n:ds.length, total:avg("total"), night:avg("night"), naps:avg("naps"), longest:avg("longest")}; };
  const cur = span(days(7)), prev = span(days(14).slice(0, 7));
  const delta = (k, fmt, unit) => { if (cur[k] == null) return "—"; const v = fmt(cur[k]); if (prev.n < 3 || cur.n < 3) return v; const d = cur[k] - prev[k], th = unit === "naps" ? .3 : 15 * 60000;
    return `${v} <small class="${Math.abs(d) < th ? "" : d > 0 ? "up" : "down"}">${Math.abs(d) < th ? "≈" : d > 0 ? "↑" : "↓"}${Math.abs(d) < th ? "" : unit === "naps" ? Math.abs(d).toFixed(1).replace(".", ",") : hTxt(Math.abs(d))}</small>`; };
  const [lo, hi] = sleepNorm(w);
  const trend = cur.n ? `<div class="panel"><h2>Как меняется</h2>
    <p class="muted" style="font-size:13.5px;margin-top:-4px">Среднее за последние 7 дней${prev.n >= 3 && cur.n >= 3 ? " · стрелка — по сравнению с неделей до этого" : ""}</p>
    <div class="srows">
      <div><span>Сон за сутки</span><b>${delta("total", hTxt)}</b></div>
      <div><span>Ночью</span><b>${delta("night", hTxt)}</b></div>
      <div><span>Дневных снов</span><b>${delta("naps", v => v.toFixed(1).replace(".", ","), "naps")}</b></div>
      <div><span>Самый длинный сон</span><b>${delta("longest", hTxt)}</b></div>
    </div>
    </div>` : "";

  const range = S.srange || 7;
  const ds = Array.from({length:range}, (_, i) => dayKey(now - (range - 1 - i) * 864e5));
  const hist = [...new Set(all.map(s => dayKey(s.start_at)))].sort().reverse().slice(0, 10).map(d => {
    const list = all.filter(s => dayKey(s.start_at) === d && s.end_at).reverse(); if (!list.length) return "";
    const label = d === today ? "Сегодня" : d === dayKey(now - 864e5) ? "Вчера" : new Date(d + "T12:00").toLocaleDateString("ru-RU", {day:"numeric", month:"long", weekday:"short"});
    return `<div class="fday"><div class="head"><b>${label}</b><span class="muted">${list.length} ${plural(list.length, "сон", "сна", "снов")} · ${fDur(list.reduce((a, s) => a + s.end_at - s.start_at, 0))}</span></div>
      ${list.map(s => { const who = memberOf(s.by_user); return `<div class="frec"><span class="fside-dot ${isNight(s) ? "N" : "D"}">${isNight(s) ? "☾" : "☀"}</span><span>${fHM(s.start_at)}–${fHM(s.end_at)}</span><span class="muted">${fDur(s.end_at - s.start_at)}</span>${who ? `<i class="dotwho" style="--c:${colorHex(who.color)}" title="${esc(who.name)}"></i>` : "<i></i>"}<button type="button" class="pen" data-sedit="${s.id}" aria-label="Изменить сон" aria-expanded="${S.sedit === s.id}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></button></div>${S.sedit === s.id ? sleepEditForm(s) : ""}`; }).join("")}</div>`;
  }).join("");

  const normPanel = `<div class="panel"><h2>Норма сна сейчас</h2>${sleepGauge(w, cur.total || 0, cur.n)}${sleepFacts(w)}
    <p class="note-small">Это ориентир, а не правило. Важнее, что малыш бодрый в периоды бодрствования, хорошо ест и прибавляет. Если отмечены не все сны, среднее будет меньше настоящего.</p></div>`;
  return `${main}${pastForm}${stats}${normPanel}
  <div class="panel"><div class="head"><h2>Режим по дням</h2></div>
    <div class="seg3">${[[7,"Неделя"],[14,"2 недели"],[30,"Месяц"]].map(([k, n]) => `<button type="button" data-srange="${k}" aria-selected="${range === k}">${n}</button>`).join("")}</div>
    ${sleepGrid(all, ds, now)}
    <div class="slegend"><span><i class="sl-n"></i>ночной сон</span><span><i class="sl-d"></i>дневной</span></div>
  </div>
  <div class="panel"><div class="head"><h2>Сна за сутки</h2></div>${sleepBars(all, ds, now, lo, hi)}</div>
  ${trend}
  <div class="panel"><div class="head"><h2>История</h2><button type="button" class="btn ghost small" data-spast="hist" aria-expanded="${S.spast === "hist"}">+ Добавить</button></div>
    ${S.spast === "hist" ? pastBody : ""}${hist || `<p class="empty">Пока пусто. Нажми «${sx(kid, "Уснул", "Уснула", "Уснул(а)")}», когда малыш заснёт, или запиши прошедший сон.</p>`}</div>`;
}
function sleepEditForm(s){
  return `<div class="fedit"><div class="mform"><div class="field"><label for="se-date">Дата</label><input type="date" id="se-date" value="${dayKey(s.start_at)}" max="${S.today}"></div>
      <div class="field"><label for="se-from">Уснул(а)</label><input type="time" id="se-from" value="${fHM(s.start_at)}"></div>
      <div class="field"><label for="se-to">Проснулся(-ась)</label><input type="time" id="se-to" value="${fHM(s.end_at)}"></div></div>
    <p class="note-small">Дата — день, когда уснул(а). Если проснулся(-ась) после полуночи, время пробуждения меньше — это нормально.</p>
    <div class="kid-actions"><button type="button" class="btn" id="se-save" data-id="${s.id}">Сохранить</button><button type="button" class="link" data-sedit="${s.id}">Отмена</button><button type="button" class="link danger" data-sdel="${s.id}">Удалить</button></div></div>`;
}
// Каждый день — полоса 00–24 с блоками сна: видно, как сдвигаются укладывания и растёт ночной отрезок. Касание — итоги дня.
function sleepGrid(all, days, now){
  const n = days.length, W = 340, L = 34, R = 4, T = 4, B = 16, rh = n <= 7 ? 22 : n <= 14 ? 14 : 8, H = T + B + rh * n, x = ms => L + (W - L - R) * ms / 864e5;
  const rows = days.slice().reverse();   // сегодня сверху
  const dl = d => n <= 7 ? new Date(d + "T12:00").toLocaleDateString("ru-RU", {weekday:"short"}) : Number(d.slice(8));
  CHARTS.sg = {
    at: (_, y) => y == null ? null : Math.max(0, Math.min(n - 1, Math.floor((y - T) / rh))),
    show(root, i){
      const head = root.querySelector(".ch-head");
      if (i === null) { head.innerHTML = `<span class="ch-k">Режим</span><b>${n} ${plural(n, "день", "дня", "дней")}</b><span class="ch-d">коснись дня, чтобы увидеть итоги</span>`; return; }
      const d = rows[i], r = sleepDay(all, d, now), ps = sleepIn(all, d, now);
      head.innerHTML = `<span class="ch-k">${new Date(d + "T12:00").toLocaleDateString("ru-RU", {weekday:"short", day:"numeric", month:"short"})}</span><b>${hTxt(r.total)} <small>за сутки</small></b><span class="ch-d">ночью ${hTxt(r.night)} · днём ${hTxt(r.day)}${ps.length ? ` · ${ps.map(p => `${fHM(p.a)}–${p.s.end_at || p.b < now ? fHM(p.b) : "сейчас"}`).join(", ")}` : ""}</span>`;
    },
  };
  return `<div class="ichart" data-chart="sg"><div class="ch-head"><span class="ch-k">Режим</span><b>${n} ${plural(n, "день", "дня", "дней")}</b><span class="ch-d">коснись дня, чтобы увидеть итоги</span></div>
    <svg class="fchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Сон по дням и часам">
    ${[0, 6, 12, 18, 24].map(h => `<line x1="${x(h * 3600e3).toFixed(1)}" x2="${x(h * 3600e3).toFixed(1)}" y1="${T}" y2="${H - B}" class="fc-grid"/><text x="${x(h * 3600e3).toFixed(1)}" y="${H - 4}" class="fc-ax" text-anchor="${h ? h === 24 ? "end" : "middle" : "start"}">${String(h).padStart(2, "0")}</text>`).join("")}
    ${rows.map((d, i) => { const y = T + i * rh, a = d0(d);
      return `${n <= 14 || i % 5 === 0 ? `<text x="0" y="${(y + rh / 2 + 3).toFixed(1)}" class="fc-ax">${dl(d)}</text>` : ""}
        ${sleepIn(all, d, now).map(p => `<rect x="${x(p.a - a).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="${Math.max(1.5, x(p.b - a) - x(p.a - a)).toFixed(1)}" height="${(rh - 2).toFixed(1)}" rx="${Math.min(3, rh / 3).toFixed(1)}" class="${isNight(p.s) ? "sl-n" : "sl-d"}${p.s.end_at ? "" : " live"}"/>`).join("")}`; }).join("")}
    <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
  </svg></div>`;
}
// Столбики: сколько сна за сутки (ночь + день) и полоса ориентира для возраста.
function sleepBars(all, days, now, lo, hi){
  const W = 340, H = 150, L = 4, R = 30, T = 8, B = 20, n = days.length, bw = (W - L - R) / n;
  const vals = days.map(d => sleepDay(all, d, now)), max = Math.max(hi + 2, ...vals.map(v => v.total / 3600e3)) * 1.05;
  const y = h => T + (H - T - B) * (1 - h / max), nz = vals.slice(0, -1).filter(v => v.total), avg = nz.length ? nz.reduce((a, v) => a + v.total, 0) / nz.length : 0;
  const dLabel = d => new Date(d + "T12:00").toLocaleDateString("ru-RU", {weekday:"short", day:"numeric", month:"short"});
  const avgHead = `<span class="ch-k">В среднем</span><b>${avg ? hTxt(avg) : "—"} <small>в сутки</small></b><span class="ch-d">ориентир ${lo}–${hi} ч · без сегодняшнего дня</span>`;
  CHARTS.sb = {
    at: x => Math.max(0, Math.min(n - 1, Math.floor((x - L) / bw))),
    show(root, i){
      const head = root.querySelector(".ch-head");
      root.querySelectorAll(".sb-col").forEach((b, k) => b.classList.toggle("sel", k === i));
      root.querySelector("svg").classList.toggle("has-sel", i !== null);
      if (i === null) { head.innerHTML = avgHead; return; }
      const v = vals[i];
      head.innerHTML = `<span class="ch-k">${dLabel(days[i])}</span><b>${hTxt(v.total)}</b><span class="ch-d">ночью ${hTxt(v.night)} · днём ${hTxt(v.day)}, ${v.naps} ${plural(v.naps, "дневной сон", "дневных сна", "дневных снов")}</span>`;
    },
  };
  return `<div class="ichart" data-chart="sb"><div class="ch-head">${avgHead}</div>
    <svg class="fchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Часов сна в сутки">
    <rect x="${L}" y="${y(hi).toFixed(1)}" width="${W - L - R + 4}" height="${(y(lo) - y(hi)).toFixed(1)}" class="sl-norm"/>
    ${[4, 8, 12, 16].filter(v => v < max).map(v => `<line x1="${L}" x2="${W - R + 4}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="fc-grid"/><text x="${W - 2}" y="${(y(v) + 3).toFixed(1)}" class="fc-ax" text-anchor="end">${v}</text>`).join("")}
    ${vals.map((v, i) => { const x = L + i * bw + bw * 0.16, w = bw * 0.68, hn = H - B - y(v.night / 3600e3), hd = H - B - y(v.day / 3600e3);
      return `<g class="sb-col"><rect x="${x.toFixed(1)}" y="${(H - B - hn).toFixed(1)}" width="${w.toFixed(1)}" height="${hn.toFixed(1)}" class="sl-n"/><rect x="${x.toFixed(1)}" y="${(H - B - hn - hd).toFixed(1)}" width="${w.toFixed(1)}" height="${hd.toFixed(1)}" class="sl-d"/></g>
        ${(n <= 14 || i % 5 === 0 || i === n - 1) ? `<text x="${(x + w / 2).toFixed(1)}" y="${H - 5}" class="fc-ax" text-anchor="middle">${n <= 7 ? new Date(days[i] + "T12:00").toLocaleDateString("ru-RU", {weekday:"short"}) : Number(days[i].slice(8))}</text>` : ""}`; }).join("")}
    <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
  </svg></div>`;
}
async function sleepAct(path, body, okMsg){
  if (S.demo) {
    const now = nowMs(), kid = feedKid(G());
    if (path === "start") { for (const s of S.sleeps) if (s.child_id === kid.id && !s.end_at) s.end_at = now; S.sleeps.push({id:Date.now(), child_id:kid.id, start_at:now, end_at:null, by_user:S.me}); }
    if (path === "stop") S.sleeps.find(x => x.id === body.id).end_at = now;
    if (path === "add") S.sleeps.push({id:Date.now(), child_id:kid.id, start_at:body.start_at, end_at:body.end_at, by_user:S.me});
    if (path === "delete") S.sleeps = S.sleeps.filter(s => s.id !== body.id);
    if (path === "edit") Object.assign(S.sleeps.find(x => x.id === body.id), {start_at:body.start_at, end_at:body.end_at});
    haptic(); return render();
  }
  haptic();
  return act(() => call(`/api/sleep/${path}`, body), okMsg);
}

// ---------- рост: вес по нормам ВОЗ и скачки роста ----------
S.gseg = "weight"; S.gmode = "weeks";
const sexSelect = (id, v) => dropdown(id, [{v:"", t:"Не указан"}, {v:"girl", t:"Девочка", dot:"#e58fb0"}, {v:"boy", t:"Мальчик", dot:"#7fa8d8"}], v || "", {label:"Пол"});
// Раскрывающийся список вместо системного <select>: кнопка и всплывающий список.
// Значение лежит в скрытом input с тем же id — код, который читает val(id), не меняется. pick — что сделать при выборе (week — открыть неделю).
function dropdown(id, opts, value, {label = "", pick = ""} = {}){
  const cur = opts.find(o => !o.head && String(o.v) === String(value)) || opts.find(o => !o.head);
  const row = o => `${o.dot ? `<i class="dd-dot" style="--c:${o.dot}"></i>` : ""}<span class="dd-t">${esc(o.t)}${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span>${o.badge ? `<b class="dd-badge">${esc(o.badge)}</b>` : ""}`;
  return `<div class="dd" ${pick ? `data-ddpick="${pick}"` : ""}><input type="hidden" id="${id}" value="${esc(String(cur.v))}">
    <button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(label)}">${row({...cur, badge:""})}<svg class="dd-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <ul class="dd-list" role="listbox" hidden>${opts.map(o => o.head ? `<li class="dd-head" role="presentation">${o.dot ? `<i class="dd-dot" style="--c:${o.dot}"></i>` : ""}${esc(o.head)}</li>`
      : `<li role="option" data-v="${esc(String(o.v))}" aria-selected="${o === cur}">${row(o)}<svg class="dd-check" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></li>`).join("")}</ul></div>`;
}
const ddClose = except => document.querySelectorAll(".dd-list:not([hidden])").forEach(l => { if (l !== except) { l.hidden = true; l.previousElementSibling.setAttribute("aria-expanded", "false"); l.closest(".dd").classList.remove("open"); } });
document.addEventListener("click", e => {
  const btn = e.target.closest(".dd-btn"), opt = e.target.closest(".dd-list li[data-v]");
  if (btn) {
    const list = btn.nextElementSibling, open = list.hidden;
    ddClose(list); list.hidden = !open; btn.setAttribute("aria-expanded", open); btn.closest(".dd").classList.toggle("open", open);
    if (open) { haptic(); list.querySelector("[aria-selected='true']")?.scrollIntoView({block:"center"}); }
    return;
  }
  if (opt) {
    const dd = opt.closest(".dd"), input = dd.querySelector("input");
    input.value = opt.dataset.v;
    dd.querySelectorAll("li[data-v]").forEach(li => li.setAttribute("aria-selected", li === opt));
    dd.querySelector(".dd-btn").replaceChildren(...[...opt.childNodes].filter(n => !n.classList?.contains("dd-check") && !n.classList?.contains("dd-badge")).map(n => n.cloneNode(true)), dd.querySelector(".dd-chev"));
    ddClose(); haptic();
    if (dd.dataset.ddpick === "week") { S.week = Number(opt.dataset.v); render(); window.scrollTo(0, 0); }
    return;
  }
  if (!e.target.closest(".dd")) ddClose();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") ddClose(); });
const kg = n => n.toFixed(n < 10 ? 2 : 1).replace(".", ",").replace(/0$/, "");
function growthScreen(){
  const g = G();
  return `${demoBar()}${switcher()}${healthHead(g, S.gseg)}${S.gseg === "spurts" ? spurtsView(g) : weightView(g)}`;
}
function spurtsView(g){
  const cur = g?.born ? ageG(g).week : null;
  let nextShown = false;
  const cards = SPURTS.map(sp => {
    let badge = "", cls = "";
    if (cur !== null) {
      if (cur >= sp.from && cur <= sp.to) { badge = `<span class="badge-now">сейчас</span>`; cls = "now"; }
      else if (cur > sp.to) { badge = `<span class="muted">позади</span>`; cls = "past"; }
      else if (!nextShown) { nextShown = true; const d = daysBetween(S.today, weekStart(g, sp.from)); badge = `<span class="badge-next">через ${d} ${plural(d,"день","дня","дней")}</span>`; cls = "next"; }
    }
    return `<div class="spurt ${cls}"><div class="head"><b>${sp.title}</b>${badge}</div>
      <span class="mono muted" style="font-size:12.5px">неделя ${sp.from === sp.to ? sp.from : `${sp.from}–${sp.to}`}${g?.born ? ` · с ${fmtDate(weekStart(g, sp.from))}` : ""}</span><p>${esc(sp.d)}</p></div>`;
  }).join("");
  return `${leapsPanel(g)}<h2 class="sub-h">Скачки роста: аппетит</h2><div class="spurts">${cards}</div>
  <div class="panel"><h2>Как понять</h2><ul class="flag-list">${SPURT_SIGNS.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
  <div class="panel"><h2>Что делать</h2><ul class="flag-list">${SPURT_DO.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
  <div class="urgent"><b>Это не скачок</b><p>${esc(SPURT_DOCTOR)}</p></div>
  <p class="note-small">Скачки роста — наблюдения родителей и консультантов по грудному вскармливанию. Рост действительно идёт рывками, но сроки у каждого ребёнка свои, поэтому окна широкие. «Чудесные недели» научно не подтверждены.</p>`;
}
// Скачки развития по неделям (data.js LEAPS): сетка на «Здоровье», плашка на неделе, метка на «Сегодня» и в календаре
const LEAP_CLS = {c:"calm", g:"good", l:"leap", a:"anx"};
const leapTag = n => { const x = leapOf(n); return x?.k === "l" ? ` · <span class="leap-tag">${x.peak ? "пик скачка" : "скачок"}</span>` : ""; };
function leapBox(n){
  const x = leapOf(n); if (!x || x.k === "c") return "";
  const icon = {l:"🌀", g:"☀️", a:"🫂"}[x.k];
  return `<div class="leap-box ${LEAP_CLS[x.k]}"><b>${icon} ${esc(x.peak ? LEAP_PEAK : LEAP_KIND[x.k].name)}</b><span>${esc(LEAP_KIND[x.k].d)}</span>
    ${MOD().growth ? `<button type="button" class="link" data-gseg="spurts">Все скачки по неделям →</button>` : ""}</div>`;
}
function leapsPanel(g){
  const cur = g?.born ? ageG(g).week : null, last = S.leapMore ? LEAP_WEEKS : 52, x = cur && leapOf(cur);
  const peak = cur ? LEAP_PEAKS.find(w => w >= cur) : null, pd = peak && g.born ? daysBetween(S.today, weekStart(g, peak)) : null;
  const now = x ? `<div class="leap-now ${LEAP_CLS[x.k]}"><span class="eyebrow">Неделя ${cur} · сейчас</span><b>${esc(x.peak ? LEAP_PEAK : LEAP_KIND[x.k].name)}</b><p>${esc(LEAP_KIND[x.k].d)}</p>
    ${peak && peak !== cur && pd > 0 ? `<span class="leap-next">Следующий пик — неделя ${peak}, через ${pd} ${plural(pd, "день", "дня", "дней")}</span>` : ""}</div>` : "";
  const cells = Array.from({length:last}, (_, i) => { const n = i + 1, y = leapOf(n), cls = `lw ${LEAP_CLS[y.k]}${y.peak ? " peak" : ""}${n === cur ? " cur" : ""}${cur && n < cur ? " past" : ""}`,
    lab = `Неделя ${n} · ${y.peak ? LEAP_PEAK : LEAP_KIND[y.k].name}`;
    return n <= 52 ? `<button type="button" class="${cls}" data-leapwk="${n}" aria-label="${lab}" title="${lab}">${n}</button>` : `<span class="${cls}" title="${lab}">${n}</span>`; }).join("");
  return `<div class="panel leaps"><div class="head"><h2>Скачки развития</h2>${infoBtn("s:leaps", "Откуда это")}</div>${hintBox("s:leaps", LEAP_NOTE)}${now}
    <div class="lgrid">${cells}</div>
    <div class="llegend"><span><i class="lw calm"></i>спокойно</span><span><i class="lw good"></i>хорошее настроение</span><span><i class="lw leap"></i>скачок</span><span><i class="lw leap peak"></i>пик</span><span><i class="lw anx"></i>тревожность</span></div>
    <div class="head"><span class="muted" style="font-size:13px">Нажми на неделю — откроется её карточка</span><button type="button" class="link" data-leapmore>${S.leapMore ? "Только первый год" : "До 78-й недели"}</button></div></div>`;
}
function weightKid(g){
  if (!g) return null;
  if (!g.kids.some(k => k.id === S.wkid)) S.wkid = g.kids[0].id;
  return g.kids.find(k => k.id === S.wkid);
}
function weightView(g){
  if (!g?.born) return `<div class="panel"><p>График веса появится после рождения: здесь будут нормы ВОЗ по неделям и ваши замеры.</p></div>`;
  const kid = weightKid(g), sex = kid.sex, days = ageG(g).days;
  const kidChips = g.kids.length > 1 ? `<div class="cats">${g.kids.map(k => `<button type="button" data-wkid="${k.id}" aria-selected="${k.id===kid.id}">${esc(nameOf(k))}</button>`).join("")}</div>` : "";
  if (!sex) return `${kidChips}<div class="panel"><h2>Кто у нас?</h2><p class="muted" style="font-size:14.5px">Нормы веса ВОЗ у девочек и мальчиков разные. Выбери один раз, потом можно поменять: ⚙️ Настройки → «Ребёнок».</p>
    <div class="sex-pick"><button type="button" class="btn" data-sex="girl">Девочка</button><button type="button" class="btn" data-sex="boy">Мальчик</button></div></div>`;
  const ms = (S.measures || []).filter(m => m.child_id === kid.id).sort((a, b) => a.date.localeCompare(b.date));
  const last = ms.at(-1);
  let verdict = "";
  if (last) {
    const d = daysBetween(kid.birth, last.date), {pct} = weightPercentile(sex, d, last.weight_g / 1000);
    const tone = pct < 3 || pct > 97 ? ["warn", "вне коридора нормы — покажи педиатру"] : pct < 15 || pct > 85 ? ["mid", "у границы нормы — это может быть вариантом нормы, важна динамика"] : ["ok", "в норме"];
    verdict = `<div class="verdict ${tone[0]}"><b>${kg(last.weight_g / 1000)} кг</b><span>${fmtDate(last.date)} · ${Math.round(pct)}-й перцентиль · ${tone[1]}</span></div>`;
  }
  const rows = S.gmode === "weeks"
    ? Array.from({length:52}, (_, i) => ({label:`${i+1}`, sub:ageLabel(i+1), d:i*7, cur: Math.floor(days/7) === i}))
    : Array.from({length:13}, (_, i) => ({label:`${i} мес`, sub:"", d:Math.round(i*30.4375), cur: ageG(g).months === i}));
  const table = rows.map(r => `<tr class="${r.cur?"cur":""}"><td>${r.label}${r.sub?`<small>${r.sub}</small>`:""}</td><td><b>${kg(whoWeight(sex, r.d, 0))}</b></td><td>${kg(whoWeight(sex, r.d, Z.p15))}–${kg(whoWeight(sex, r.d, Z.p85))}</td><td class="muted">${kg(whoWeight(sex, r.d, Z.p3))}–${kg(whoWeight(sex, r.d, Z.p97))}</td></tr>`).join("");
  return `${kidChips}
  <div class="panel">
    <div class="head"><h2>Вес: ${esc(nameOf(kid))}</h2><span class="prog">${sex === "girl" ? "нормы для девочек" : "нормы для мальчиков"}</span></div>
    ${verdict}
    ${weightChart(sex, days, ms, kid.birth)}
    <div class="wlegend"><span><i class="b1"></i>норма (15–85%)</span><span><i class="b2"></i>границы (3–97%)</span><span><i class="ln"></i>медиана</span><span><i class="pt"></i>замеры</span></div>
  </div>
  <div class="panel">
    <h2>Новый замер</h2>
    <div class="mform">
      <div class="field"><label for="m-date">Дата</label><input type="date" id="m-date" value="${S.today}" max="${S.today}" min="${kid.birth}"></div>
      <div class="field"><label for="m-kg">Вес, кг</label><input id="m-kg" inputmode="decimal" placeholder="5,2"></div>
      <div class="field"><label for="m-cm">Рост, см</label><input id="m-cm" inputmode="decimal" placeholder="необязательно"></div>
    </div>
    <button type="button" class="btn" id="m-save">Сохранить замер</button>
    ${ms.length ? `<div class="mlist">${ms.slice().reverse().map(m => { const d = daysBetween(kid.birth, m.date), {pct} = weightPercentile(sex, d, m.weight_g / 1000), who = memberOf(m.by_user);
      return `<div class="mrow"><span>${fmtDate(m.date)}</span><b>${kg(m.weight_g / 1000)} кг</b>${m.length_cm ? `<span>${String(m.length_cm).replace(".", ",")} см</span>` : "<span></span>"}<span class="muted">${Math.round(pct)}%</span><button type="button" class="link" data-mdel="${m.id}" aria-label="Удалить замер">×</button>${who ? `<i class="dotwho" style="--c:${colorHex(who.color)}" title="${esc(who.name)}"></i>` : ""}</div>`; }).join("")}</div>` : ""}
  </div>
  <div class="panel">
    <div class="head"><h2>Нормы по ${S.gmode === "weeks" ? "неделям" : "месяцам"}</h2>
      <div class="cats">${[["weeks","Недели"],["months","Месяцы"]].map(([k, n]) => `<button type="button" data-gmode="${k}" aria-selected="${S.gmode===k}">${n}</button>`).join("")}</div></div>
    <div class="wtable"><table><thead><tr><th>${S.gmode === "weeks" ? "Неделя" : "Возраст"}</th><th>Медиана</th><th>Норма</th><th>Границы</th></tr></thead><tbody>${table}</tbody></table></div>
    <p class="note-small">Стандарты ВОЗ (эталон — дети на грудном вскармливании), кг. Норма — 15–85-й перцентиль, границы — 3–97-й. В первые дни малыш теряет до 7–10% веса и возвращается к весу при рождении к 10–14 дню. Важнее одного числа — что ребёнок идёт по своей кривой.</p>
  </div>`;
}
// График: коридоры ВОЗ по году, линия «сейчас», замеры точками. Пальцем — точные значения на любой возраст.
function weightChart(sex, days, ms, birth){
  const W = 340, H = 230, L = 30, R = 8, T = 10, B = 24, maxD = 365;
  const yMax = Math.ceil(whoWeight(sex, maxD, Z.p97) + 0.5), yMin = 2;
  const x = d => L + (W - L - R) * d / maxD, y = v => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin));
  const dOf = px => Math.round(Math.max(0, Math.min(maxD, (px - L) / (W - L - R) * maxD)));
  const steps = Array.from({length:53}, (_, i) => Math.min(maxD, i * 7));
  const curve = z => steps.map(d => [x(d), y(whoWeight(sex, d, z))]);
  const band = (z1, z2) => { const a = curve(z1), b = curve(z2).reverse(); return [...a, ...b].map(p => p.map(n => n.toFixed(1)).join(",")).join(" "); };
  const pts = ms.map(m => ({d: daysBetween(birth, m.date), kg: m.weight_g / 1000, m}));
  const gridY = []; for (let v = yMin + 1; v <= yMax; v += 2) gridY.push(v);
  const ageTxt = d => { const w = Math.floor(d / 7), mo = Math.floor(d / 30.4375); return d < 92 ? `${w} нед ${d % 7} дн` : `${mo} мес ${Math.round(d - mo * 30.4375)} дн`; };
  const id = "wc";
  const defHead = () => { const last = pts.at(-1); return last ? `<span class="ch-k">Последний замер · ${fmtDate(last.m.date)}</span><b>${kg(last.kg)} <small>кг</small></b><span class="ch-d">${Math.round(weightPercentile(sex, last.d, last.kg).pct)}-й перцентиль · медиана в этом возрасте ${kg(whoWeight(sex, last.d, 0))} кг</span>`
    : `<span class="ch-k">Сейчас · ${ageTxt(days)}</span><b>${kg(whoWeight(sex, days, 0))} <small>кг медиана</small></b><span class="ch-d">норма ${kg(whoWeight(sex, days, Z.p15))}–${kg(whoWeight(sex, days, Z.p85))} кг · проведи пальцем по графику</span>`; };
  CHARTS[id] = {
    at: px => { const d = dOf(px), near = pts.reduce((b, p) => Math.abs(p.d - d) < Math.abs((b?.d ?? 1e9) - d) ? p : b, null);
      return near && Math.abs(near.d - d) * (W - L - R) / maxD < 10 ? `m${pts.indexOf(near)}` : `d${d}`; },   // рядом с точкой — «прилипает» к замеру
    show(root, v){
      const head = root.querySelector(".ch-head"), xh = root.querySelector(".xh"), xm = root.querySelector(".xm");
      if (v === null) { head.innerHTML = defHead(); xh.style.display = xm.style.display = "none"; return; }
      const p = v[0] === "m" ? pts[Number(v.slice(1))] : null, d = p ? p.d : Number(v.slice(1));
      const med = whoWeight(sex, d, 0), lo = whoWeight(sex, d, Z.p15), hi = whoWeight(sex, d, Z.p85);
      xh.setAttribute("x1", x(d).toFixed(1)); xh.setAttribute("x2", x(d).toFixed(1)); xh.style.display = "";
      xm.setAttribute("cx", x(d).toFixed(1)); xm.setAttribute("cy", y(p ? p.kg : med).toFixed(1)); xm.style.display = ""; xm.classList.toggle("kid", !!p);
      head.innerHTML = p
        ? `<span class="ch-k">Замер · ${fmtDate(p.m.date)} · ${ageTxt(d)}</span><b>${kg(p.kg)} <small>кг</small></b><span class="ch-d">${Math.round(weightPercentile(sex, d, p.kg).pct)}-й перцентиль · медиана ${kg(med)} · норма ${kg(lo)}–${kg(hi)} кг${p.m.length_cm ? ` · рост ${String(p.m.length_cm).replace(".", ",")} см` : ""}</span>`
        : `<span class="ch-k">${ageTxt(d)}${birth ? ` · ${fmtDate(addDays(birth, d))}` : ""}</span><b>${kg(med)} <small>кг медиана</small></b><span class="ch-d">норма ${kg(lo)}–${kg(hi)} · границы ${kg(whoWeight(sex, d, Z.p3))}–${kg(whoWeight(sex, d, Z.p97))} кг</span>`;
    },
  };
  return `<div class="ichart" data-chart="${id}"><div class="ch-head">${defHead()}</div>
  <svg class="wsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="График веса по нормам ВОЗ">
    ${gridY.map(v => `<line x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g-grid"/><text x="${L-6}" y="${(y(v)+4).toFixed(1)}" class="g-ax" text-anchor="end">${v}</text>`).join("")}
    ${[0,2,4,6,8,10,12].map(mo => `<text x="${x(mo*30.4375).toFixed(1)}" y="${H-6}" class="g-ax" text-anchor="middle">${mo}</text>`).join("")}
    <polygon points="${band(Z.p3, Z.p97)}" class="g-b2"/><polygon points="${band(Z.p15, Z.p85)}" class="g-b1"/>
    <polyline points="${curve(0).map(p => p.map(n => n.toFixed(1)).join(",")).join(" ")}" class="g-med"/>
    <line x1="${x(Math.min(days, maxD)).toFixed(1)}" x2="${x(Math.min(days, maxD)).toFixed(1)}" y1="${T}" y2="${H-B}" class="g-now"/>
    ${pts.length > 1 ? `<polyline points="${pts.map(p => `${x(p.d).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ")}" class="g-kid"/>` : ""}
    ${pts.map(p => `<circle cx="${x(p.d).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="4.5" class="g-pt"/>`).join("")}
    <line class="xh" y1="${T}" y2="${H-B}" style="display:none"/><circle class="xm" r="6" style="display:none"/>
    <text x="${W-R}" y="${H-6}" class="g-ax" text-anchor="end">мес</text><text x="${L-6}" y="${T+8}" class="g-ax" text-anchor="end">кг</text>
    <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
  </svg></div>`;
}
async function saveMeasure(){
  const kid = weightKid(G()), body = {child_id:kid.id, date:val("m-date") || S.today, weight_kg:val("m-kg"), length_cm:val("m-cm")};
  if (S.demo) {
    const w = Number(String(body.weight_kg).replace(",", ".")); if (!(w >= 1 && w <= 25)) return toast("Вес в килограммах, например 5,2");
    S.measures.push({id:Date.now(), child_id:kid.id, date:body.date, weight_g:Math.round(w * 1000), length_cm:body.length_cm ? Number(String(body.length_cm).replace(",", ".")) : null, by_user:S.me});
    return render();
  }
  return act(() => call("/api/measure", body), "Замер сохранён");
}

// ---------- обратная связь: отзыв, предложение, неполадка ----------
// Виды и лимиты приходят с сервера (/api/feedback/mine); здесь — только подписи. Отзывы не публикуются.
const FB_UI = {
  like:{emoji:"👍", title:"Отзыв", hint:"Что нравится в приложении. Можно поставить оценку.", label:"Что нравится? Что стоит оставить как есть?", ph:"Например: удобно отмечать кормления вдвоём",
    full:"Отзыв можно оставить один раз. Измени его или удали — и напиши новый."},
  idea:{emoji:"💡", title:"Предложение", hint:"Чего не хватает, что добавить.", label:"Чего не хватает? Как это могло бы работать?", ph:"Например: напоминание о прогулке",
    full:"Сейчас больше не поместится. Измени или удали одно из прежних предложений."},
  issue:{emoji:"⚠️", title:"Неполадка", hint:"Что сломалось или мешает.", label:"Что случилось? Где и после чего?", ph:"Например: на вкладке «Вещи» не ставится отметка",
    full:"Сейчас больше не поместится. Измени или удали одно из прежних сообщений."},
};
const FB_ST = {new:"отправлено", seen:"прочитано", done:"сделано"};
const FB_MAX = 2000;
const APP_V = new URL(import.meta.url).searchParams.get("v") || "dev";
const fbDraft = kind => `fbDraft:${kind}`;
const lsDel = k => { try { localStorage.removeItem(k); } catch {} };
// К неполадке — только техническое: версия, вкладка, откуда пришли, платформа Telegram, язык, ширина окна
const fbMeta = () => ({v:APP_V, tab:S.fbFrom || "", platform:tgApp?.platform || "web", tgv:tgApp?.version || "", lang:LANG, w:String(innerWidth)});
const fbDate = ms => { const k = dayKey(ms); return fmtDate(k) + (k.slice(0, 4) !== String(S.today || "").slice(0, 4) ? ` ${k.slice(0, 4)}` : ""); };
const fbPanel = () => `<div class="panel"><h2>Обратная связь</h2>
  <p class="muted" style="font-size:14px">Что нравится, чего не хватает, что сломалось — напиши, мы читаем каждое сообщение.</p>
  <button type="button" class="btn ghost" data-fbopen>Написать</button></div>`;
function fbItem(i){
  const u = FB_UI[i.kind] || {emoji:"•", title:i.kind};
  return `<div class="fb-item">
    <div class="fb-ih"><b>${u.emoji} ${esc(u.title)}</b><span class="fb-st ${esc(i.status)}">${esc(FB_ST[i.status] || i.status)}</span></div>
    <span class="fb-date">${fbDate(i.created)}${i.updated ? " · изменено" : ""}</span>
    ${i.rating ? `<span class="fb-rate"><span aria-hidden="true">${"★".repeat(i.rating)}<i>${"★".repeat(5 - i.rating)}</i></span> ${i.rating}/5</span>` : ""}
    <p class="fb-txt" translate="no">${esc(i.text)}</p>
    ${i.liked ? `<span class="fb-liked">❤️ Нравится разработчику</span>` : ""}
    ${i.reply ? `<div class="fb-reply"><span class="eyebrow">Ответ разработчика${i.reply_at ? ` · ${fbDate(i.reply_at)}` : ""}</span><p translate="no">${esc(i.reply)}</p></div>` : ""}
    <div class="fb-acts"><button type="button" class="btn small ghost" data-fbedit="${i.id}">Изменить</button><button type="button" class="link" data-fbdel="${i.id}">Удалить</button></div>
  </div>`;
}
function feedbackScreen(){
  const F = S.fb ||= {};
  if (S.demo) F.mine ||= {kinds:[["like", 1], ["idea", 50], ["issue", 50]].map(([kind, limit]) => ({kind, limit, used:0, left:limit, full:false})), items:[]};
  else if (!F.loaded && !F.loading) fbLoad();
  const head = `${demoBar()}<button type="button" class="link back" data-fbback>← Назад</button>
    <div class="sec-title"><span class="eyebrow">Читаем каждое сообщение</span><h1>Обратная связь</h1></div>`;
  if (!F.mine) return head + (F.err ? `<div class="panel"><p class="muted">${esc(F.err)}</p><button type="button" class="btn ghost" data-fbretry>Попробовать ещё раз</button></div>` : `<p class="empty">Загружаю…</p>`);
  const kinds = F.mine.kinds.filter(k => FB_UI[k.kind]), items = F.mine.items || [];
  const cur = kinds.find(k => k.kind === F.kind);
  const rows = kinds.map(k => { const u = FB_UI[k.kind], mark = k.full ? " · уже есть" : "";   // лимит предложений и неполадок держит сервер, человеку его не показываем
    return `<button type="button" class="fb-kind" data-fbkind="${k.kind}" aria-pressed="${F.kind === k.kind}"><span class="fb-emo" aria-hidden="true">${u.emoji}</span>
      <span><span><b>${esc(u.title)}</b>${mark ? `<span class="fb-mark">${mark}</span>` : ""}</span><small>${esc(u.hint)}</small></span></button>`; }).join("");
  let body = "";
  if (cur && cur.full && !F.editing) {
    body = `<div class="panel"><h2>Такое у тебя уже есть</h2><p class="muted" style="font-size:14px">${esc(FB_UI[cur.kind].full)}</p>
      ${items.filter(i => i.kind === cur.kind).map(fbItem).join("")}</div>`;
  } else if (cur) {
    const u = FB_UI[cur.kind], len = (F.text || "").length;
    const stars = cur.kind === "like" ? `<div class="field"><label>Оценка — по желанию</label><div class="fb-stars">${[1, 2, 3, 4, 5].map(n =>
      `<button type="button" data-fbstar="${n}" aria-pressed="${(F.rating || 0) >= n}" aria-label="${n + " из 5"}">★</button>`).join("")}</div></div>` : "";
    body = `<div class="panel" id="fb-form"><h2>${F.editing ? "Изменить сообщение" : `${u.emoji} ${esc(u.title)}`}</h2>${stars}
      <div class="field"><label for="fb-text">${esc(u.label)}</label>
        <textarea id="fb-text" rows="5" maxlength="${FB_MAX}" placeholder="${esc(u.ph)}">${esc(F.text || "")}</textarea>
        <span class="fb-count" id="fb-count">${len} / ${FB_MAX}</span></div>
      ${cur.kind === "issue" ? `<p class="fb-note">К сообщению приложим: версию приложения, устройство и язык — без личных данных.</p>` : ""}
      <div class="fb-send"><button type="button" class="btn" data-fbsend>${F.editing ? "Сохранить" : "Отправить"}</button>${F.editing ? `<button type="button" class="link" data-fbcancel>Отмена</button>` : ""}</div></div>`;
  }
  return `${head}<div class="panel"><h2>О чём напишешь?</h2>${S.demo ? `<p class="fb-note">В демо-режиме отправить нельзя.</p>` : ""}<div class="fb-kinds">${rows}</div></div>${body}
    <div class="panel"><h2>Мои сообщения</h2>${items.length ? items.map(fbItem).join("") : `<p class="muted" style="font-size:14px">Пока ничего не отправлено.</p>`}</div>`;
}
async function fbLoad(){
  const F = S.fb ||= {};
  if (S.demo) return render();
  F.loading = true; F.err = null;
  try { F.mine = await call("/api/feedback/mine", {}); }
  catch (e) { F.err = e.message; }
  F.loading = false; F.loaded = true;
  if (S.tab === "feedback") render();
}
function fbInput(el){
  const F = S.fb ||= {};
  F.text = el.value;
  const c = document.getElementById("fb-count"); if (c) c.textContent = `${el.value.length} / ${FB_MAX}`;
  if (F.kind && !F.editing) lsSet(fbDraft(F.kind), el.value);   // черновик — по виду; правка своего не трогает черновик нового
}
async function fbSend(btn){
  const F = S.fb, text = (F.text || "").trim(), editing = F.editing;
  if (S.demo) return toast("В демо-режиме отправить нельзя");
  if (!F.kind) return toast("Сначала выбери, о чём");
  if (text.length < 10) { haptic("error"); toast("Напиши чуть подробнее — хотя бы 10 символов"); return document.getElementById("fb-text")?.focus(); }
  btn.disabled = true;
  try {
    const body = editing ? {id:editing, text, ...(F.kind === "like" ? {rating:F.rating || null} : {})}
      : {kind:F.kind, text, ...(F.kind === "like" && F.rating ? {rating:F.rating} : {}), ...(F.kind === "issue" ? {meta:fbMeta()} : {})};
    const r = await call(editing ? "/api/feedback/edit" : "/api/feedback", body);
    if (r.kind_full) { haptic("error"); toast(r.error); F.editing = null; return fbLoad(); }   // место заняли с другого устройства
    if (!editing) lsDel(fbDraft(F.kind));
    Object.assign(F, {kind:null, editing:null, rating:null, text:""});
    haptic("success"); toast(editing ? "Изменения сохранены" : "Спасибо! Прочитаем и ответим, если нужно");
    await fbLoad();
  } catch (e) { haptic("error"); toast(e.message); btn.disabled = false; }
}
async function fbDelete(id){
  if (!(await ask(tr("Удалить это сообщение? Вернуть его не получится.")))) return;
  try {
    await call("/api/feedback/delete", {id});
    if (S.fb.editing === id) Object.assign(S.fb, {editing:null, text:"", rating:null});
    haptic("success"); toast("Удалено — место освободилось");
    await fbLoad();
  } catch (e) { toast(e.message); }
}
// Клики экрана отзыва; true — обработано
function fbClick(t, d){
  const F = S.fb ||= {};
  if (t.hasAttribute("data-fbopen")) {
    if (S.tab !== "feedback") { S.fbFrom = S.tab; S.fbTips = S.tab === "tips" ? tipsPos() : null; }
    S.fb = {mine:F.mine || null}; haptic(); go("feedback"); return true;
  }
  if (t.hasAttribute("data-fbback")) {
    const to = S.fbFrom && S.fbFrom !== "feedback" ? S.fbFrom : "family";
    go(to); if (to === "tips" && S.fbTips) { restoreTips(S.fbTips); S.fbTips = null; }
    return true;
  }
  if (t.hasAttribute("data-fbretry")) { F.loaded = false; render(); return true; }
  if (d.fbkind) {
    if (F.kind === d.fbkind && !F.editing) return true;
    Object.assign(F, {kind:d.fbkind, editing:null, rating:null, text:lsGet(fbDraft(d.fbkind)) || ""}); haptic(); render(); return true;
  }
  if (d.fbstar) { const n = Number(d.fbstar); F.rating = F.rating === n ? null : n; haptic(); render(); return true; }
  if (t.hasAttribute("data-fbsend")) { fbSend(t); return true; }
  if (t.hasAttribute("data-fbcancel")) { Object.assign(F, {editing:null, rating:null, text:lsGet(fbDraft(F.kind)) || ""}); render(); return true; }
  if (d.fbedit) {
    const it = (F.mine?.items || []).find(i => i.id === Number(d.fbedit)); if (!it) return true;
    Object.assign(F, {kind:it.kind, editing:it.id, rating:it.rating || null, text:it.text}); haptic(); render();
    setTimeout(() => { const el = document.getElementById("fb-form"); el?.scrollIntoView({block:"start", behavior: reduceMotion ? "auto" : "smooth"}); }, 30);
    return true;
  }
  if (d.fbdel) { fbDelete(Number(d.fbdel)); return true; }
  return false;
}

// ---------- живые обновления: отметки второго родителя приходят сразу ----------
function liveLabel(m){
  if (m.path === "/api/check" && typeof m.id === "string") {
    let name = "";
    if (/^[nb]:/.test(m.id)) return null;   // прочитанное уведомление — личное, второму родителю не показываем
    const d = m.id.match(/:d:\d{4}-\d{2}-\d{2}:([a-z0-9]+)$/), q = m.id.match(/:q:(\d+):(\d)$/), o = m.id.match(/^o:([a-z0-9-]+)$/);
    if (d) name = ROUTINE.find(r => r.id === d[1])?.st[0][2] || S.routine?.own?.find(o => o.id === d[1])?.x || "рутина";
    else if (q) name = QLIST[Number(q[1]) - 1]?.[Number(q[2])]?.[1] || "задание";
    else if (o) name = "заказ: " + (GEAR.find(x => x.id === o[1])?.x || "");
    if (name.length > 48) name = name.slice(0, 46) + "…";
    return m.val === 2 ? `не нужно — ${name}` : m.val ? `✓ ${name}` : `снята отметка — ${name}`;
  }
  if (m.path.startsWith("/api/feedback")) return null;   // отзыв — личное (и "/api/feedback" начинается с "/api/feed")
  if (m.path === "/api/sleep/start") return "малыш уснул";
  if (m.path === "/api/sleep/stop" || m.path === "/api/sleep/bot") return "малыш проснулся";
  if (m.path.startsWith("/api/sleep")) return "обновлён сон";
  if (m.path === "/api/feed/start") return "начато кормление";
  if (m.path === "/api/feed/pause") return "кормление на паузе";
  if (m.path === "/api/feed/resume") return "кормление продолжено";
  if (m.path === "/api/feed/stop" || m.path === "/api/feed/bot") return "кормление записано";
  if (m.path.startsWith("/api/feed")) return "обновлены кормления";
  if (m.path.startsWith("/api/vacc")) return "обновлены прививки";
  if (m.path.startsWith("/api/measure")) return "новый замер веса";
  if (m.path === "/api/routine") return "изменена рутина";
  if (m.path.startsWith("/api/child")) return "обновлены данные ребёнка";
  return "есть изменения";
}
// Отметка второго родителя: сразу в S.checks; для дней вне окна — поправить счётчик кольца
function applyLiveCheck(m){
  const v = m.val === 2 ? 2 : m.val ? 1 : 0;
  const x = /^(c\d+):d:(\d{4}-\d{2}-\d{2}):/.exec(m.id);
  if (x && !dayLoaded(x[2])) { const c = ((S.routineDays ||= {})[x[1]] ||= {}); c[x[2]] = Math.max(0, (c[x[2]] || 0) + (v ? 1 : -1)); }
  else if (v) S.checks[m.id] = {by:m.by, at:Date.now(), val:v}; else delete S.checks[m.id];
  dayIndex.src = null;
}
function connectLive(){
  if (S.demo || connectLive.es || typeof EventSource === "undefined") return;
  const q = initData ? `init=${encodeURIComponent(initData)}` : webToken ? `web=${encodeURIComponent(webToken)}` : qs0.get("dev_user") ? `dev_user=${encodeURIComponent(qs0.get("dev_user"))}` : null;
  if (!q) return;
  const es = new EventSource(`/api/events?${q}`);
  connectLive.es = es;
  es.onmessage = async e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.by === S.me) return;
    const who = memberOf(m.by)?.name || "Второй родитель", what = liveLabel(m);
    if (what === null) return;
    const typing = document.activeElement && view.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (typing) { S.liveLater = true; return toast(`${who}: ${what}`); }   // не стираем то, что сейчас вводят
    if (m.path === "/api/check" && typeof m.id === "string") { applyLiveCheck(m); render(); if (S.cal) { S.cal.keep = true; renderCal(); } }
    else await load();
    toast(`${who}: ${what}`); haptic();
  };
}
view.addEventListener("focusout", () => setTimeout(() => {
  if (S.liveLater && !(document.activeElement && view.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) { S.liveLater = false; load(); }
}, 100));
// запасной вариант, если канал оборвался: тихо обновляться раз в минуту, пока приложение открыто
function atKyivMidnight(){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Kyiv", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"}).formatToParts(new Date()).map(x => [x.type, x.value]));
  const left = ((24 - Number(p.hour)) * 3600 - Number(p.minute) * 60 - Number(p.second)) * 1000 + 5000;
  setTimeout(() => { if (!S.demo && !S.onboarding && S.today) load(); atKyivMidnight(); }, left);
}
atKyivMidnight();
setInterval(() => { if (!document.hidden && !S.demo && !S.onboarding && S.today && connectLive.es?.readyState !== 1) load(); }, 60000);

// ---------- праздники: новая неделя и новый месяц ----------
const overlay = document.getElementById("overlay");
function confetti(colors){
  if (reduceMotion) return;
  const cv = document.createElement("canvas"); cv.className = "confetti"; overlay.appendChild(cv);
  const dpr = devicePixelRatio || 1, W0 = innerWidth, H0 = innerHeight;
  cv.width = W0*dpr; cv.height = H0*dpr; const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  const P = Array.from({length:170}, () => ({
    x: W0/2 + (Math.random()-.5)*60, y: H0*.42, vx: (Math.random()-.5)*14, vy: -Math.random()*15-5,
    s: 5+Math.random()*7, r: Math.random()*6, vr: (Math.random()-.5)*.3, c: colors[(Math.random()*colors.length)|0],
    round: Math.random() < .3,
  }));
  const t0 = performance.now();
  (function frame(t){
    const el = t - t0; ctx.clearRect(0,0,W0,H0);
    for (const p of P){
      p.vy += .32; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - el/4200); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.round){ ctx.beginPath(); ctx.arc(0,0,p.s/2,0,7); ctx.fill(); } else ctx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);
      ctx.restore();
    }
    if (el < 4200 && cv.isConnected) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}
function closeOverlay(){ overlay.hidden = true; overlay.innerHTML = ""; }
function showOverlay(html, colors){
  overlay.innerHTML = `<div class="ov-card">${html}</div>`; overlay.hidden = false;
  if (colors) confetti(colors);
}
function showMonth(g, k){
  const a = ageG(g), ph = phaseOf(Math.min(a.week, 52)), day = addMonths(g.date, k);
  haptic("success");
  showOverlay(`
    <div class="ov-top" style="--ph:${ph.color}">
      <span class="eyebrow">${fmtDate(day)} · день жизни ${daysBetween(g.date, day) + 1}</span>
      <div class="big-num">${k}</div>
      <div class="big-word">${monthWord(k)}</div>
    </div>
    <h2>Ураа! ${esc(joinNames(g.kids, dative))} ${k} ${monthWord(k)}!</h2>
    ${MONTHLY[k]?`<p class="muted">Обычно к этому возрасту: ${esc(MONTHLY[k])}</p><p class="muted" style="font-size:13px">У каждого ребёнка свои сроки, разница в несколько недель — норма.</p>`:""}
    <div class="ov-actions"><button class="btn" type="button" data-ov="close">Ура!</button><button class="btn ghost" type="button" data-ov="week">Неделя ${Math.min(a.week,52)}</button></div>`,
    PHASES.map(p => p.color).concat(["#ffffff", "#ffd166"]));
}
function showWeek(n){
  const ph = phaseOf(n), w = W[n-1], gc = gearForWeek(n).length;
  haptic("success");
  showOverlay(`
    <div class="ov-top small" style="--ph:${ph.color}">
      <span class="eyebrow">Новая неделя · ${esc(ph.name)}</span>
      <div class="big-num">${n}</div>
    </div>
    <h2>${esc(w.t)}</h2>
    <p class="muted">${esc(w.d)}</p>
    <p class="mono" style="font-size:13px">${Q[n-1].length} ${plural(Q[n-1].length,"задание","задания","заданий")}${gc?` · ${gc} к заказу`:""}</p>
    <div class="ov-actions"><button class="btn" type="button" data-ov="week">Открыть неделю</button><button class="btn ghost" type="button" data-ov="close">Позже</button></div>`,
    [ph.color, "#ffffff", ph.color]);
}
// Показывается один раз на устройстве: новый месяц (в течение недели после даты) важнее новой недели.
function celebrateCheck(){
  if (celebrateCheck.done) return; celebrateCheck.done = true;
  if (qs0.get("celebrate")) { const g = G(); if (g?.born) return showMonth(g, Math.max(1, Math.min(12, Number(qs0.get("celebrate"))))); }
  for (const g of groups().filter(g => g.born)) {
    const a = ageG(g); if (a.days < 0 || a.week > 53) continue;
    const kw = `seen-week-${g.key}`, km = `seen-month-${g.key}`;
    const seenW = Number(lsGet(kw) || 0), seenM = Number(lsGet(km) || 0);
    lsSet(kw, a.week); lsSet(km, a.months);
    if (a.months >= 1 && a.months <= 12 && seenM < a.months && daysBetween(addMonths(g.date, a.months), S.today) <= 6) { S.sel = g.key; render(); return showMonth(g, a.months); }
    if (seenW && seenW < a.week && a.week <= 52) { S.sel = g.key; render(); return showWeek(a.week); }   // первый запуск не считаем новой неделей
  }
}
overlay.addEventListener("click", e => {
  const b = e.target.closest("[data-ov]");
  if (b) { closeOverlay(); if (b.dataset.ov === "week") { S.week = curWeek(G()); go("week"); } return; }
  if (e.target === overlay) closeOverlay();
});

// ---------- render & events ----------
const noFam = () => !!S.error || !S.today || S.onboarding;
// результаты поиска; в режиме ?sos без семьи — только первая помощь
const searchRes = () => { const r = search(S.q, S.qcat).filter(x => !x.go.article || fitsSex(articleOf(x.go.article))); return S.sos && noFam() ? r.filter(x => x.go.article?.startsWith("fa:")) : r; };
// Мальчик в выбранной группе — мужская версия текстов (словарь подгружается один раз). Двойня разного пола — как раньше.
let boyMod = null;
// статьи только для девочек или мальчиков (гигиена): показываем по полу выбранной группы; пол не указан — обе
const kidSex = () => { const k = (!S.demo && S.children?.length && G()?.kids) || []; return k.length && k.every(x => x.sex && x.sex === k[0].sex) ? k[0].sex : null; };
const fitsSex = a => !a?.sex || !kidSex() || a.sex === kidSex();
function syncBoy(){
  const g = !S.onboarding && !S.demo && S.children?.length ? G() : null;
  const want = !!g?.kids?.length && g.kids.every(k => k.sex === "boy");
  if (want === isBoy()) return;
  if (!want) return setBoy(null);
  if (boyMod) return setBoy(boyMod);
  import("./i18n-boy.js").then(m => { boyMod = m.default; setBoy(boyMod); render(); }).catch(e => console.error("boy", e));
}
function render(){
  syncBoy();
  const nav = S.tab === "week" ? (S.weekFrom === "tips" ? "tips" : "today") : S.tab === "article" ? "tips" : S.tab === "vaccines" ? "growth" : S.tab;
  document.getElementById("family-open").setAttribute("aria-current", S.tab === "family" || S.tab === "faq");
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.tab === nav));
  const tg0 = !S.error && !S.onboarding && S.children?.length ? G() : null;
  const topKid = document.getElementById("top-kid");
  if (topKid) topKid.textContent = tg0 ? (tg0.born ? `${joinNames(tg0.kids)} · ${ageText(ageG(tg0))}` : joinNames(tg0.kids)) : "";
  const badge = document.getElementById("b-orders");
  const g = !S.error && !S.onboarding && S.children.length ? G() : null;
  const due = g ? ordersNow(g).length : 0;
  badge.hidden = !due; badge.textContent = due;
  // на «Здоровье» счётчика нет: прививку не «уберёшь» нажатием, а цифра висит как непрочитанное. Напоминание — в боте и в самом разделе.
  if (S.sos && noFam() && (S.tab === "search" || (S.tab === "article" && S.article?.startsWith("fa:")))) {
    document.getElementById("tabs").hidden = true; document.getElementById("search-open").hidden = false;
    view.innerHTML = (S.tab === "search" ? searchScreen() : articleScreen()) + `<button type="button" class="btn ghost" data-sos-done>Продолжить настройку</button>`;
    return;
  }
  if (S.error && !initData && (!webToken || S.webBad) && !qs0.get("dev_user")) {
    for (const id of ["tabs", "search-open", "family-open"]) document.getElementById(id).hidden = true;
    view.innerHTML = noAccessScreen(); return;
  }
  if (S.error) { view.innerHTML = `<div class="panel"><h2>Нет доступа</h2><p class="muted">${esc(S.error)}</p></div>`; return; }
  if (!S.today) { view.innerHTML = `<p class="empty">Загружаю…</p>`; return; }
  document.getElementById("tabs").hidden = S.onboarding || !!S.showInvite;
  document.getElementById("search-open").hidden = S.onboarding || !!S.showInvite;
  document.getElementById("family-open").hidden = S.onboarding || !!S.showInvite;
  if (S.onboarding) { view.innerHTML = S.tab === "feedback" ? feedbackScreen() : onboardingScreen(); return; }   // написать можно и без семьи
  const mods = MOD(), hide = {feed:!mods.feeding && !mods.sleep, growth:!mods.growth && !mods.vaccines, orders:!mods.orders};
  const tabs = [...document.querySelectorAll("#tabs button")];
  tabs.forEach(b => b.hidden = !!hide[b.dataset.tab]);
  const ft = document.querySelector('#tabs button[data-tab="feed"]')?.lastChild;
  if (ft?.nodeType === 3 && ft.data.trim() !== tr(careTitle())) ft.data = tr(careTitle());
  document.getElementById("tabs").style.gridTemplateColumns = `repeat(${tabs.filter(b => !b.hidden).length},1fr)`;
  if (S.tab === "growth" && !mods.growth && mods.vaccines) S.tab = "vaccines";
  if (hide[S.tab] || (S.tab === "vaccines" && !mods.vaccines)) S.tab = S.tab === "vaccines" && mods.growth ? "growth" : "today";
  if (S.showInvite) { view.innerHTML = inviteScreen(); return; }
  const keepTips = S.tab === "tips" && view.querySelector(".tsec") ? {cars:tipsPos().cars} : null;   // живые обновления не сбрасывают карусели
  view.innerHTML = {today:todayScreen, week:weekScreen, tips:tipsScreen, article:articleScreen, orders:ordersScreen, flags:flagsScreen, family:familyScreen, search:searchScreen, vaccines:vaccinesScreen, growth:growthScreen, feed:feedScreen, feedback:feedbackScreen, faq:faqScreen}[S.tab]();
  if (S.tab === "faq" || (S.tab === "family" && S.setSec === "install")) mountDemos(view);
  if (S.rtAsk && ["orders", "week", "today"].includes(S.tab)) view.insertAdjacentHTML("afterbegin", rtAskBlock());
  if (keepTips && S.tab === "tips") restoreTips(keepTips);
}
function go(tab){
  if (tab !== "orders") S.focusGear = S.focusSkip = null;
  if (tab === "week" && S.tab !== "week") S.weekFrom = S.tab;   // «Вся неделя» — подэкран, «назад» возвращает откуда пришли
  if (tab === "vaccines" || tab === "growth") S.hseg = tab;
  S.tab = tab; render(); window.scrollTo(0,0);
  if (tab === "tips") scrollTips();
}
const go_ = go;
const val = id => document.getElementById(id)?.value ?? "";
function keepOb(){
  view.querySelectorAll("[data-ob-kid]").forEach(el => { S.ob.kids[Number(el.dataset.obKid)][el.dataset.f] = el.value; });
  if (document.getElementById("ob-me")) S.ob.me = val("ob-me");
}
async function act(fn, ok){ try { await fn(); if (ok) toast(ok); await load(); } catch (err) { toast(err.message); } }

document.getElementById("tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  // «Здоровье» открывается на том разделе, где были в последний раз
  go(b.dataset.tab === "growth" && (S.hseg === "vaccines" || !MOD().growth) && MOD().vaccines ? "vaccines" : b.dataset.tab);
});
// Климат-чек: вывод — в своём блоке .cc (на главной и в архиве уведомлений)
function climateInput(el){
  S[el.dataset.cc === "t" ? "ccT" : "ccH"] = el.value;
  const o = el.closest(".cc")?.querySelector(".cc-out"); if (o) o.textContent = climateText();
}
document.getElementById("sheet").addEventListener("input", e => { if (e.target.dataset.cc) climateInput(e.target); });
view.addEventListener("keydown", e => { if (e.target.id === "q" && e.key === "Enter") saveRecentQ(S.q); });
view.addEventListener("input", e => {
  if (e.target.dataset.cc) return climateInput(e.target);
  if (e.target.id === "q") { S.q = e.target.value; document.getElementById("results").innerHTML = resultsHTML(); }
  if (e.target.id === "fb-text") fbInput(e.target);
});
view.addEventListener("change", e => {
  if (e.target.matches("input[data-mod]")) {
    const k = e.target.dataset.mod, on = e.target.checked;
    if (S.onboarding) { S.ob.mods[k] = on; haptic(); return render(); }
    S.modules = {...MOD(), [k]: on}; haptic(); render();
    if (!S.demo) call("/api/modules", S.modules).catch(err => toast(err.message));
    return;
  }
  if (e.target.matches("input[data-pref]")) {
    S.prefs = {...S.prefs, [e.target.dataset.pref]: e.target.checked}; haptic();
    if (!S.demo) call("/api/prefs", {[e.target.dataset.pref]: e.target.checked}).catch(err => toast(err.message));
    return;
  }
  if (e.target.matches("input[data-thhide]")) { S.thHide = e.target.checked; lsSet("thHide", S.thHide ? 1 : 0); haptic(); return render(); }
  if (e.target.matches("input[data-id]")) { const id = e.target.dataset.id; if (id.startsWith("o:")) rtAskFor(id, e.target.checked); return id.startsWith("o:") ? gearLeave(id, e.target.checked) : setCheck(id, e.target.checked); }
  if (e.target.id === "wk-sel") { S.week = Number(e.target.value); render(); }
  if (e.target.id === "demo-week") { S.children[0].birth = addDays(S.today, -(Number(e.target.value)-1)*7 - 3); S.vaccines = demoVaccines(S.children[0].birth); S.week = null; render(); }
  if (e.target.id === "imp-file") importFile(e.target);
});
view.addEventListener("click", async e => {
  const t = e.target.closest("button, a"); if (!t) return;
  const d = t.dataset;
  // внешние ссылки (источники) — во внешнем браузере Telegram, мини-апп остаётся открытым
  if (t.matches("a[target=_blank]") && initData && tgApp?.openLink) { e.preventDefault(); return tgApp.openLink(t.href); }
  if (fbClick(t, d) || faqClick(t, d) || routineClick(t, d)) return;
  if (await installClick(t, d)) return;
  if (d.qcat) { S.qcat = d.qcat; view.querySelectorAll("[data-qcat]").forEach(b => b.setAttribute("aria-selected", b === t)); document.getElementById("results").innerHTML = resultsHTML(); return; }
  if (d.qsuggest) { S.q = t.textContent.trim(); document.getElementById("q").value = S.q; document.getElementById("results").innerHTML = resultsHTML(); return; }
  if (d.skip) return isSkip(d.skip) ? setCheck(d.skip, 0) : gearLeave(d.skip, 2);
  if (d.thview || d.thgo) { S.thView = d.thview || d.thgo; S.focusGear = S.focusSkip = null; lsSet("thView", S.thView); haptic(); if (d.thgo) return go("orders"); render(); return window.scrollTo(0,0); }
  if (d.nmore) { S.noticeOpen = S.noticeOpen === d.nmore ? null : d.nmore; haptic(); return render(); }
  if (d.nread) { if (S.noticeOpen && d.nread.startsWith(`n:${S.noticeOpen}:`)) S.noticeOpen = null; toast("Скрыто. Перечитать: ⚙️ Настройки → «Оформление и язык» → «Прочитанные уведомления»"); return setCheck(d.nread, 1); }
  if (d.ngo) { const n = NOTICES.find(x => x.id === d.ngo); S.thView = "all"; S.focusGear = S.focusSkip = null; go("orders"); return setTimeout(() => document.getElementById(`gc-${n.go.cat}`)?.scrollIntoView({block:"start", behavior: reduceMotion ? "auto" : "smooth"}), 50); }
  if (t.hasAttribute("data-narchive")) return openNoticeArchive();
  if (d.res) return openResult(searchRes()[Number(d.res)]);
  if (t.hasAttribute("data-sos-done")) { S.sos = false; S.q = ""; S.tab = "today"; return render(); }
  if (t.hasAttribute("data-dayretry")) { S.dayErr = null; render(); return fetchDay(S.day); }
  if (d.day) return selectDay(d.day);
  if (d.strip) { S.stripOff = (S.stripOff || 0) + Number(d.strip); haptic(); return render(); }
  if (t.hasAttribute("data-cal")) return openCal();
  if (d.art) return openArticle(d.art);
  if (d.bm) { const k = bKey(d.bm); toast(isOn(k) ? "Убрано из сохранённых" : "Сохранено в «Советах»"); return setCheck(k, isOn(k) ? 0 : 1); }
  if (d.artgo) { const a = articleOf(d.artgo); if (a.go.routine) { const kid = G()?.kids[0]; if (kid) openHints.add(`h:c${kid.id}:d:${S.today}:${a.go.routine}`); S.day = null; } go(a.go.tab); return a.go.routine && setTimeout(() => view.querySelector(".info[aria-expanded='true']")?.scrollIntoView({block:"center"}), 50); }
  if (t.hasAttribute("data-back")) { const to = S.tab === "article" ? (S.artFrom || "tips") : (S.weekFrom && S.weekFrom !== "week" ? S.weekFrom : "today"); go(to); if (to === "tips") { restoreTips(S.tipsBack); S.tipsBack = null; } return; }
  if (d.hint) { openHints.has(d.hint) ? openHints.delete(d.hint) : openHints.add(d.hint); haptic(); return render(); }
  if (d.wk) { S.week = Number(d.wk); render(); return window.scrollTo(0,0); }
  if (d.fstart) return feedAct("start", {child_id:feedKid(G()).id, side:d.fstart}, "Кормление началось");
  if (d.fstop) return feedAct("stop", {id:Number(d.fstop)}, "Кормление записано");
  if (d.fswitch) return feedAct("switch", {id:Number(d.fswitch)}, "Сменили грудь");
  if (d.fpause) return feedAct("pause", {id:Number(d.fpause)}, "Пауза");
  if (d.fresume) return feedAct("resume", {id:Number(d.fresume)}, "Продолжаем");
  if (d.fside) { S.fside = d.fside; haptic(); return render(); }
  if (d.fpside) { S.fpside = d.fpside; haptic(); return render(); }
  if (d.fkid) { S.fkid = Number(d.fkid); S.fside = null; return render(); }
  if (d.fchart) { S.fchart = d.fchart; return render(); }
  if (d.frange) { S.frange = Number(d.frange); haptic(); return render(); }
  if (t.hasAttribute("data-fpast")) { S.fpast = S.fpast === d.fpast ? null : d.fpast; render(); if (S.fpast) document.getElementById("fp-form")?.scrollIntoView({block:"nearest", behavior:"smooth"}); return; }
  if (t.id === "fp-save") {
    const st = new Date(`${val("fp-date")}T${val("fp-time") || "00:00"}`).getTime(), minutes = Number(val("fp-min"));
    if (!(st <= nowMs())) return toast("Время в будущем");
    S.fpast = null;
    return feedAct("add", {child_id:feedKid(G()).id, side:S.fpside || "L", start_at:st, minutes}, "Записано");
  }
  if (d.fdel) { S.fedit = null; return feedAct("delete", {id:Number(d.fdel)}, "Удалено"); }
  if (d.fedit) { const id = Number(d.fedit); S.fedit = S.fedit === id ? null : id; S.feside = null; haptic(); return render(); }
  if (d.feside) { S.feside = d.feside; haptic(); return render(); }
  if (t.id === "fe-save") {
    const f = S.feeds.find(x => x.id === Number(t.dataset.id)); if (!f) return;
    const st = new Date(`${val("fe-date")}T${val("fe-time") || "00:00"}`).getTime(), minutes = Number(val("fe-min"));
    if (!(st <= nowMs())) return toast("Время в будущем");
    if (!(minutes >= 1 && minutes <= 180)) return toast("Длительность от 1 до 180 минут");
    S.fedit = null;
    return feedAct("edit", {id:f.id, side:S.feside || f.side, start_at:st, minutes}, "Сохранено");
  }
  if (d.fview) { S.fview = d.fview; haptic(); return render(); }
  if (t.hasAttribute("data-sstart")) return sleepAct("start", {child_id:feedKid(G()).id}, "Сладких снов");
  if (d.sstop) return sleepAct("stop", {id:Number(d.sstop)}, "Сон записан");
  if (d.srange) { S.srange = Number(d.srange); haptic(); return render(); }
  if (t.hasAttribute("data-spast")) { S.spast = S.spast === d.spast ? null : d.spast; render(); if (S.spast) document.getElementById("sp-form")?.scrollIntoView({block:"nearest", behavior:"smooth"}); return; }
  if (t.id === "sp-save") {
    const date = val("sp-date"), st = new Date(`${date}T${val("sp-from") || "00:00"}`).getTime();
    let en = new Date(`${date}T${val("sp-to") || "00:00"}`).getTime();
    if (en <= st) en += 864e5;   // проснулся на следующий день
    if (!(en <= nowMs() + 60000)) return toast("Время в будущем");
    S.spast = null;
    return sleepAct("add", {child_id:feedKid(G()).id, start_at:st, end_at:en}, "Записано");
  }
  if (d.sdel) { S.sedit = null; return sleepAct("delete", {id:Number(d.sdel)}, "Удалено"); }
  if (d.sedit) { const id = Number(d.sedit); S.sedit = S.sedit === id ? null : id; haptic(); return render(); }
  if (t.id === "se-save") {
    const date = val("se-date"), st = new Date(`${date}T${val("se-from") || "00:00"}`).getTime();
    let en = new Date(`${date}T${val("se-to") || "00:00"}`).getTime();
    if (en <= st) en += 864e5;   // проснулся на следующий день
    if (!(en <= nowMs() + 60000)) return toast("Время в будущем");
    S.sedit = null;
    return sleepAct("edit", {id:Number(t.dataset.id), start_at:st, end_at:en}, "Сохранено");
  }
  if (d.gseg) { haptic(); if (d.gseg === "vaccines") return go("vaccines"); S.gseg = d.gseg; return S.tab === "growth" ? render() : go("growth"); }
  if (d.gmode) { S.gmode = d.gmode; return render(); }
  if (t.hasAttribute("data-leapmore")) { S.leapMore = !S.leapMore; haptic(); return render(); }
  if (d.leapwk) { S.week = Number(d.leapwk); haptic(); return go("week"); }
  if (d.wkid) { S.wkid = Number(d.wkid); return render(); }
  if (d.sex) {
    const kid = weightKid(G());
    if (S.demo) { kid.sex = d.sex; return render(); }
    return act(() => call("/api/child", {id:kid.id, name:kid.name, birth:kid.birth, due:kid.due, sex:d.sex}), "Сохранено");
  }
  if (t.id === "m-save") return saveMeasure();
  if (d.mdel) {
    if (S.demo) { S.measures = S.measures.filter(m => m.id !== Number(d.mdel)); return render(); }
    return act(() => call("/api/measure/delete", {id:Number(d.mdel)}), "Удалено");
  }
  if (d.sel) { S.sel = d.sel; S.week = null; haptic(); return render(); }
  if ("setsec" in d) { S.setSec = d.setsec || null; render(); window.scrollTo(0, 0); return haptic(); }
  if (d.ocolor) {
    const uid = Number(d.ocolorUid);
    try { if (!S.demo) await call("/api/member/color", {user_id:uid, color:d.ocolor}); const m = S.members.find(x => x.user_id === uid); if (m) m.color = d.ocolor; render(); haptic("success"); toast("Цвет изменён"); }
    catch (err) { toast(err.message); }
    return;
  }
  if (d.go === "feed" || d.go === "sleep") { S.fview = d.go; return go("feed"); }
  if (d.go) { if ("sec" in d) S.setSec = d.sec || null; if (d.go === "today-r") { if (S.day) { S.day = null; S.stripOff = 0; render(); } return document.getElementById("routine")?.scrollIntoView({behavior:"smooth"}); } if (d.go === "week") S.week = curWeek(G()); return go(d.go); }
  if (d.color) {
    if (S.onboarding) { keepOb(); S.ob.color = d.color; S.ob.colorPicked = true; } else S.myColor = d.color;
    view.querySelectorAll("button[data-color]").forEach(b => b.setAttribute("aria-pressed", b === t)); return haptic();
  }
  // онбординг
  if (d.ob) { keepOb(); if (d.ob === "demo") return startDemo(); S.ob.step = d.ob; render(); return window.scrollTo(0,0); }
  if (d.obNext) {
    keepOb();
    if (S.ob.step === "role" && !S.ob.role) return toast("Выберите: мама или папа");
    if (S.ob.step === "baby" && S.ob.born && S.ob.kids.some(k => !k.birth)) return toast("Укажите дату рождения");
    S.ob.step = d.obNext; haptic(); render(); return window.scrollTo(0,0);
  }
  if (d.role) { keepOb(); S.ob.role = d.role; if (!S.ob.colorPicked) S.ob.color = d.role === "papa" ? "blue" : "raspberry"; haptic(); return render(); }
  if (d.obborn) { keepOb(); S.ob.born = d.obborn === "true"; haptic(); return render(); }
  if (d.sexkid) { keepOb(); S.ob.kids[Number(d.sexkid)].sex = d.s; haptic(); return render(); }
  if (d.pastdone) { S.ob.pastDone = d.pastdone === "true"; haptic(); return render(); }
  if (d.lang) return switchLang(d.lang);
  if (d.thememode) { lsSet("theme", d.thememode); applyTheme(); haptic(); return render(); }
  if (d.myrole) { S.myRole = d.myrole; view.querySelectorAll("[data-myrole]").forEach(b => b.setAttribute("aria-pressed", b === t)); return haptic(); }
  if (t.id === "gate-check") {
    try { const r = await call("/api/gate/check", {}); if (r.ok) { S.gate.passed = true; S.ob.step = "role"; toast("Спасибо! Подписка есть"); render(); } else toast("Пока не вижу подписки. Подпишитесь и нажмите ещё раз"); }
    catch (err) { toast(err.message); }
    return;
  }
  if (t.hasAttribute("data-gate-open") && tgApp?.openTelegramLink && initData) { e.preventDefault(); tgApp.openTelegramLink(S.gate.url); return; }
  if (t.hasAttribute("data-invite-later")) { S.showInvite = false; return render(); }
  if (d.obDel) { keepOb(); S.ob.kids.splice(Number(d.obDel), 1); return render(); }
  if (t.id === "ob-add") { keepOb(); const f = S.ob.kids[0]; S.ob.kids.push({name:"", birth:f.birth, due:f.due, sex:""}); return render(); }
  if (t.id === "ob-save") {
    keepOb();
    const born = S.ob.born;
    const children = S.ob.kids.map(k => born ? {name:k.name, birth:k.birth, sex:k.sex || null} : {name:k.name, due:k.due, sex:k.sex || null});
    return act(async () => {
      await call("/api/onboard", {children, role:S.ob.role, my_name:S.ob.me, color:S.ob.color, modules:S.ob.mods, past_done:S.ob.pastDone ?? true});
      S.tab = "today"; celebrateCheck.done = true; S.showInvite = true;
    });
  }
  if (t.id === "demo-exit") { Object.assign(S, {demo:false, onboarding:true, ob:{step:"start"}, children:[], checks:{}, tab:"today"}); celebrateCheck.done = false; return load(); }
  // семья
  if (d.born) { S.bornForm = Number(d.born); return render(); }
  if (d.kidSave) {
    const id = Number(d.kidSave), birth = val(`k-birth-${id}`);
    const wasBorn = !!S.children.find(c => c.id === id)?.birth;
    return act(async () => {
      await call("/api/child", {id, name:val(`k-name-${id}`), birth, due:val(`k-due-${id}`), sex:val(`k-sex-${id}`) || null});
      S.bornForm = null;
      if (birth && !wasBorn) { S.sel = `b:${birth}`; S.tab = "today"; }
    }, birth && !wasBorn ? "Поздравляем! 🎉" : "Сохранено");
  }
  if (d.kidDel) return act(() => call("/api/child/delete", {id:Number(d.kidDel)}), "Удалено");
  if (t.id === "kid-add") { S.addKid = true; return render(); }
  if (t.id === "kid-add-cancel") { S.addKid = false; return render(); }
  if (t.id === "kid-add-save") {
    const birth = val("k-birth-new"), due = birth ? "" : val("k-due-new");
    return act(async () => { await call("/api/child", {name:val("k-name-new"), birth, due}); S.addKid = false; }, "Добавлено");
  }
  // прививки
  if (d.vnext) {
    const id = Number(d.vnext);
    if (d.to === "planned") { S.vSkipOpen = true; if (await saveVaccine(id, {status:"planned"})) toast("Вернули в план"); return; }
    if (d.to === "booked") { if (await saveVaccine(id, {status:"booked"})) { toast("Записались. Укажи дату и время — напомню за час"); openVaccine(id, "v-bd"); } return; }
    if (await saveVaccine(id, {status:"done", done_date:S.today})) toast("Сделано сегодня. Дату можно поправить в записи");
    return;
  }
  if (d.vskip) {
    const id = Number(d.vskip), v = vOf(id);
    if (v && vKind(v) === "must" && !(await ask("Это прививка из бесплатного календаря. Убрать её из плана? Напоминаний о ней не будет, вернуть можно в любой момент."))) return;
    if (await saveVaccine(id, {status:"skip"})) toast("Убрали из плана. Вернуть — внизу списка");
    return;
  }
  if (d.vedit) return openVaccine(Number(d.vedit));
  if (d.vaddOpen) { S.vAdd = Number(d.vaddOpen); render(); return setTimeout(() => document.getElementById("va-name")?.focus(), 30); }
  if (t.hasAttribute("data-vadd-cancel")) { S.vAdd = null; return render(); }
  if (d.vadd) return addVaccine(Number(d.vadd), val("va-name"), val("va-date"));
  if (d.vpast) {
    if (!(await ask("Отметить все прошедшие прививки по календарю как сделанные? Даты можно будет уточнить в каждой записи."))) return;
    if (S.demo) { S.vaccines.forEach(v => { if (v.child_id === Number(d.vpast) && vKind(v) === "must" && v.status !== "done" && v.planned < S.today) v.status = "done"; }); return render(); }
    return act(() => call("/api/vaccines/past-done", {child_id:Number(d.vpast)}), "Отмечено");
  }
  // данные
  if (t.id === "exp-json") return exportJSON(t);
  if (t.id === "exp-pdf") return exportPDF(t);
  if (t.id === "imp-json") return document.getElementById("imp-file").click();
  if (t.id === "me-save") return act(async () => { await call("/api/me", {name:val("me-name"), color:S.myColor || meM().color, role:S.myRole || S.role}); S.myColor = null; S.myRole = null; }, "Сохранено");
  if (t.id === "invite") {
    try {
      const {link} = await call("/api/invite", {});
      S.inviteLink = link; render();
      if (S.showInvite) setTimeout(() => { S.showInvite = false; render(); }, 1500);
      const text = `Присоединяйся: будем вместе вести первый год ${joinNames(S.children, genitive)}`;
      if (tgApp?.openTelegramLink && initData) tgApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
      else { try { await navigator.clipboard.writeText(link); toast("Ссылка скопирована"); } catch { toast("Скопируй ссылку ниже"); } }
    } catch (err) { toast(err.message); }
  }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.onboarding && !S.demo) load(); });

// стартовые параметры: ?w=12 из кнопки под карточкой, ?tab=family
const wParam = Number(qs0.get("w") || 0);
if (wParam >= 1 && wParam <= 52) { S.tab = "week"; S.week = wParam; }
if (qs0.get("tab") === "sleep") { S.tab = "feed"; S.fview = "sleep"; }
if (["today","week","orders","flags","family","vaccines","growth","feed","feedback","faq"].includes(qs0.get("tab"))) S.tab = qs0.get("tab");
if (faqOf(qs0.get("faq"))) { S.tab = "faq"; S.faqOpen = qs0.get("faq"); }   // из бота: ?faq=invite
if (articleOf(qs0.get("art")) && articleOf(qs0.get("art")).kind !== "week") { S.tab = "article"; S.article = qs0.get("art"); S.artFrom = "tips"; }   // ссылка на статью: ?art=g:colic
if (qs0.get("tab") === "family") S.setSec = "kids";   // ссылки бота «Малыш родился» ведут к данным ребёнка
if (qs0.get("tab") === "things") S.tab = "orders";
if (qs0.get("tab") === "tips") S.tab = "tips";
// /sos в боте: SOS-кнопки больше нет — открываем поиск с выдачей по первой помощи
if (qs0.get("sos")) { S.sos = true; S.tab = "search"; S.q = tr("Первая помощь"); S.qcat = "all"; }
S.thView = lsGet("thView") === "all" ? "all" : "now"; S.thHide = lsGet("thHide") === "1";
if (NOTICES.some(n => n.id === qs0.get("notice"))) { S.tab = "today"; S.noticeOpen = qs0.get("notice"); }   // из сообщения бота
render();
load();
startPict();
