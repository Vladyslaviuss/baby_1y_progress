import { W, ageOf, plural, gearForWeek, flagsFor, urgentFor, routineForWeek, MONTHLY, monthWord,
         COLORS, dative, genitive, GEAR, gearStage, isBase, NOTICES, noticeSeason, orderWeek, inSeason, FIRST_AID, EMERGENCY, VACCINES, vaccinePlan, vaccineDue, vaccineKind, leapOf, routineFor, remindersFor, cleanRoutineCfg, pickTip, DAY_TIPS } from "../public/data.js";
import { CARDS_VERSION } from "./cards-version.js";
import { tg, tgDocument, verifyInitData, forgetLang, langOf, localize } from "./tg.js";
import { LANGS, DEFAULT_LANG } from "../public/i18n.js";
const LANG_IDS = LANGS.map(l => l[0]);
import { feedApi, onFeedCallback, feedTick, familyFeeds, feedAwayFor } from "./feed.js";
import { sleepApi, familySleeps, onSleepCallback, sleepTick, sleepAwayFor } from "./sleep.js";

const TZ = "Europe/Kyiv";
const todayKyiv = () => new Intl.DateTimeFormat("en-CA", {timeZone:TZ}).format(new Date());
const json = (d, s=200) => new Response(JSON.stringify(d), {status:s, headers:{"content-type":"application/json; charset=utf-8"}});
const base = env => env.APP_URL.replace(/\/$/, "");
const appUrl = (env, q="") => `${base(env)}/${q}`;
const pad = n => String(n).padStart(2, "0");
const cardUrl = (env, n) => `${base(env)}/cards/w${pad(n)}.png?v=${CARDS_VERSION}`;
const monthUrl = (env, k) => `${base(env)}/cards/m${pad(k)}.png?v=${CARDS_VERSION}`;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const cleanName = s => String(s||"").trim().replace(/\s+/g, " ").slice(0, 40);
const isoOrNull = s => ISO.test(s||"") ? s : null;
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const MAX_CHILDREN = 4, MAX_MEMBERS = 2;   // семья: основной родитель + один приглашённый
const MODULES = ["vaccines", "feeding", "sleep", "growth", "orders"];
const modulesOf = fam => { let m = {}; try { m = JSON.parse(fam?.modules || "{}") || {}; } catch {} return Object.fromEntries(MODULES.map(k => [k, m[k] !== false])); };
const readModules = x => Object.fromEntries(MODULES.map(k => [k, x?.[k] !== false]));
const ROLES = ["mama", "papa"];

// ---------- ворота: основной родитель подписан на канал ----------
// Telegram отдаёт статус участника канала только боту-админу. Пока бот не админ (ошибка API) — пропускаем, но не запоминаем.
const gateChannel = env => (env.GATE_CHANNEL || "").trim();
async function gateStatus(env, uid){
  const ch = gateChannel(env); if (!ch) return {required:false, passed:true};
  const ok = await env.DB.prepare("SELECT 1 FROM gate WHERE user_id=?").bind(uid).first();
  return {required:true, passed:!!ok, channel:ch, url:`https://t.me/${ch.replace(/^@/, "")}`};
}
async function gateCheck(env, uid){
  const ch = gateChannel(env); if (!ch) return {ok:true};
  const r = await tg(env, "getChatMember", {chat_id:ch, user_id:uid});
  if (!r.ok) { console.error("gate: проверка недоступна —", r.description); return {ok:true, unverified:true}; }
  const st = r.result.status, ok = ["creator", "administrator", "member"].includes(st) || (st === "restricted" && r.result.is_member);
  if (ok) await env.DB.prepare("INSERT OR REPLACE INTO gate(user_id, ok_at) VALUES(?,?)").bind(uid, Date.now()).run();
  return {ok};
}
const gateKeyboard = (env, g) => ({inline_keyboard:[[{text:"Подписаться на канал", url:g.url}], [{text:"Подписка есть — проверить", callback_data:"gatecheck"}]]});
const DT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
const dtOrNull = s => DT.test(s||"") ? s : null;
const cleanText = (s, n) => String(s||"").trim().replace(/[ \t]+/g, " ").slice(0, n);
const escH = s => String(s ?? "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
// c…:q задание, c…:d рутина, o:<вещь> (val 1 — есть, 2 — не нужно), n:<уведомление>:<сезон>:u<родитель> — прочитано (у каждого родителя своё)
const CHECK_ID = /^(c\d{1,9}:(q:\d{1,2}:\d|d:\d{4}-\d{2}-\d{2}:[a-z0-9]+)|o:[a-z0-9][a-z0-9-]{0,39}|n:[a-z0-9][a-z0-9-]{0,39}:\d{4}:u\d{1,15}|b:[a-z0-9][a-z0-9:-]{0,40}:u\d{1,15})$/;
// n: — прочитанное уведомление, b: — закладка статьи «Советов»: у каждого родителя свои
const noticeUser = id => Number(id.match(/^[nb]:.*:u(\d+)$/)?.[1] || 0);
const personal = id => id.startsWith("n:") || id.startsWith("b:");
// настоящая дата (2026-13-45 не пройдёт): round-trip через Date
const realDay = d => !!d && !Number.isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d;
const dayOfCheck = id => /^c\d+:d:(\d{4}-\d{2}-\d{2}):/.exec(id)?.[1] || null;
const DAYS_LOADED = 14;   // отметки рутины целиком — за столько дней; раньше — только счётчики по дням
const VSTAT = ["planned", "booked", "done", "skip"];
const MUST = VACCINES.filter(v => v.kind === "must").map(v => v.code);

// Имя для текста: «Рита» или «Малыш», если имя ещё не выбрали.
const nm = c => c.name || "Малыш";
const joinNames = (list, f = x => x) => { const n = list.map(c => f(nm(c))); return n.length < 2 ? n.join("") : `${n.slice(0,-1).join(", ")} и ${n.at(-1)}`; };
function ageText(a){ return `${a.months ? `${a.months} мес ` : ""}${a.rest} ${plural(a.rest,"день","дня","дней")}`; }
const appButton = (env, text, q="") => ({inline_keyboard:[[{text, web_app:{url:appUrl(env, q)}}]]});

// ---------- db ----------
// Кто пользуется (для админки): строка на человека, обновляем не чаще раза в 5 минут. Пустое из входа по ссылке старое не затирает.
const SEEN = new Map();
async function seen(env, u, src){
  const id = Number(u?.id), now = Date.now();
  if (!Number.isSafeInteger(id) || id <= 0 || now - (SEEN.get(id) || 0) < 5 * 60e3) return;
  SEEN.set(id, now);
  const s = (v, n) => String(v ?? "").trim().slice(0, n) || null;
  try {
    await env.DB.prepare(`INSERT INTO users(user_id, first_name, last_name, username, tg_lang, first_seen, last_seen, src) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET first_name=COALESCE(excluded.first_name, first_name), last_name=COALESCE(excluded.last_name, last_name),
        username=COALESCE(excluded.username, username), tg_lang=COALESCE(excluded.tg_lang, tg_lang), first_seen=COALESCE(first_seen, excluded.first_seen),
        last_seen=excluded.last_seen, src=excluded.src`)
      .bind(id, s(u.first_name, 64), s(u.last_name, 64), s(u.username, 64), s(u.language_code, 8), now, now, src).run();
  } catch (e) { console.error("seen", id, e.message); }
}
const getMember = (env, uid) => env.DB.prepare("SELECT * FROM members WHERE user_id=?").bind(uid).first();
const familyMembers = async (env, fid) => (await env.DB.prepare("SELECT user_id, name, color, role, owner FROM members WHERE family_id=? ORDER BY created").bind(fid).all()).results;
const familyChildren = async (env, fid) => (await env.DB.prepare("SELECT * FROM children WHERE family_id=? ORDER BY id").bind(fid).all()).results;
// вещи семьи с отметкой «есть» (1) или «не нужно» (2)
const familyThings = async (env, fid) => new Set((await env.DB.prepare("SELECT id FROM checks WHERE family_id=? AND val>0 AND id LIKE 'o:%'").bind(fid).all()).results.map(r => r.id));
const familyVaccines = async (env, fid) => (await env.DB.prepare("SELECT * FROM vaccines WHERE family_id=? ORDER BY child_id, COALESCE(planned,'9999'), id").bind(fid).all()).results;
// План прививок по календарю. Создаёт недостающие записи; shift — дата рождения изменилась: сдвинуть то, что ещё не сделано и без записи.
async function syncVaccines(env, fid, childId, birth, shift=false){
  if (!birth) return;
  await env.DB.prepare(`INSERT INTO vaccines(family_id,child_id,code,name,planned,status)
    SELECT ?1, ?2, json_extract(value,'$.code'), json_extract(value,'$.name'), json_extract(value,'$.planned'), 'planned' FROM json_each(?3) WHERE true
    ON CONFLICT(child_id,code) DO UPDATE SET planned=excluded.planned WHERE ?4 AND vaccines.status IN ('planned','skip')`)
    .bind(fid, childId, JSON.stringify(vaccinePlan(birth)), shift ? 1 : 0).run();
}
// Родившиеся дети без плана (семьи, созданные до появления прививок) — достроить. true, если что-то создали.
async function ensureVaccines(env, fid, children, rows){
  const has = new Set(rows.filter(v => v.code).map(v => v.child_id));
  const miss = children.filter(c => c.birth && !has.has(c.id));
  for (const c of miss) await syncVaccines(env, fid, c.id, c.birth);
  return miss.length > 0;
}
async function freeColor(env, fid){
  const used = new Set((await familyMembers(env, fid)).map(m => m.color));
  return (COLORS.find(c => !used.has(c.id)) || COLORS[0]).id;
}
async function botUsername(env){
  const c = await env.DB.prepare("SELECT v FROM settings WHERE k='bot_username'").first();
  if (c?.v) return c.v;
  const me = await tg(env, "getMe", {});
  if (!me.ok) return null;
  await env.DB.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('bot_username',?)").bind(me.result.username).run();
  return me.result.username;
}
// При указании даты рождения: не слать старые карточки, первая придёт со следующего утра.
function birthMarks(birth, today){
  if (!birth) return {last_week:0, last_month:0};
  const a = ageOf(birth, today);
  return {last_week: Math.max(0, a.week - 1), last_month: Math.max(0, a.months)};
}

// ---------- сообщения ----------
async function sendToFamily(env, fid, fn){
  for (const m of await familyMembers(env, fid)) await fn(m.user_id);
}
// Дети с одинаковой датой рождения (двойня) идут одной группой: одна карточка, одно поздравление.
function bornGroups(children){
  const g = new Map();
  for (const c of children.filter(c => c.birth)) { if (!g.has(c.birth)) g.set(c.birth, []); g.get(c.birth).push(c); }
  return [...g.values()];
}
// have — Set id вещей, отмеченных семьёй «есть» или «не нужно»: их не предлагаем
function weekCaption(group, n, a, mods = {orders:true}, have = new Set()){
  const w = W[n-1], gear = mods.orders ? gearForWeek(n).filter(g => !have.has(`o:${g.id}`)) : [], twins = group.length > 1;
  const lines = [`<b>Неделя ${n} · ${w.t}</b>`, `${joinNames(group)}: ${ageText(a)}.`];
  if (gear.length) lines.push(`🛒 Заказать${twins ? " (×" + group.length + ", где нужно)" : ""}: ${gear.map(g => g.x).join("; ")}.`);   // название целиком — так его находит словарь перевода
  const lp = leapOf(n);
  if (lp?.k === "l") lines.push(`🌀 ${lp.peak ? "Пик скачка развития" : "Скачок развития"}: может чаще плакать и проситься на руки — это временно, больше близости.`);
  lines.push("Задания, рутина и подсказки — в приложении.");
  return lines.join("\n");
}
// Напоминание за 3 дня и в день прививки — только по плану или с записью; платные рекомендованные — только если записались.
function vaccineReminder(children, rows, today){
  const lines = [];
  for (const v of rows) {
    if (!(v.status === "booked" || (v.status === "planned" && vaccineKind(v.code) !== "rec"))) continue;
    const c = children.find(k => k.id === v.child_id), due = vaccineDue(v);
    if (!c?.birth || !due) continue;
    const d = daysBetween(today, due); if (d !== 0 && d !== 3) continue;
    const time = v.status === "booked" && v.booked_at?.length > 10 ? ` в ${v.booked_at.slice(11,16)}` : "";
    lines.push(`• ${escH(nm(c))}: ${escH(v.name)} — ${d ? "через 3 дня" : "сегодня"}${time}${v.status === "booked" ? " (записались)" : d ? ", пора записаться" : " по плану"}`);
  }
  return lines.length ? ["💉 <b>Прививки</b>", ...lines].join("\n") : "";
}
function vaccinesText(children, rows, today){
  const born = children.filter(c => c.birth), out = ["💉 <b>Прививки</b>"];
  for (const c of born) {
    const mine = rows.filter(v => v.child_id === c.id);
    const open = mine.filter(v => (v.status === "planned" || v.status === "booked") && vaccineDue(v)).sort((a,b) => vaccineDue(a).localeCompare(vaccineDue(b)));
    const late = open.filter(v => vaccineDue(v) < today && vaccineKind(v.code) !== "rec");
    const next = open.filter(v => vaccineDue(v) >= today && (vaccineKind(v.code) !== "rec" || v.status === "booked")).slice(0, 3);
    const must = mine.filter(v => vaccineKind(v.code) === "must");
    out.push("");
    if (born.length > 1) out.push(`<b>${escH(nm(c))}</b>`);
    if (late.length) out.push("⏰ Пора сделать:", ...late.map(v => `• ${escH(v.name)} — срок был ${fmtD(vaccineDue(v))}`));
    out.push(next.length ? "Дальше:" : "Ближайших прививок нет.", ...next.map(v => `• ${escH(v.name)} — ${fmtD(vaccineDue(v))}${v.status === "booked" ? " (записались)" : ""}`));
    out.push(`Сделано по календарю: ${must.filter(v => v.status === "done").length} из ${must.length}.`);
  }
  out.push("", "Даты по календарю МОЗ, точную схему уточните у педиатра.");
  return out.join("\n");
}
const fmtD = iso => new Intl.DateTimeFormat("ru-RU", {day:"numeric", month:"long", timeZone:"UTC"}).format(new Date(iso+"T00:00:00Z"));

// ---------- экспорт ----------
async function familyExport(env, fid){
  const [fam, children, members, checks, vaccines, measures] = await Promise.all([
    env.DB.prepare("SELECT * FROM families WHERE id=?").bind(fid).first(), familyChildren(env, fid), familyMembers(env, fid),
    env.DB.prepare("SELECT id, val, by_user, at FROM checks WHERE family_id=? AND val>0 ORDER BY at").bind(fid).all().then(r => r.results), familyVaccines(env, fid),
    env.DB.prepare("SELECT child_id, date, weight_g, length_cm, by_user FROM measurements WHERE family_id=? ORDER BY date").bind(fid).all().then(r => r.results)]);
  return {app:"first-year", version:1, exportedAt:new Date().toISOString(),
    settings:{created:fam?.created ?? null, lastDaily:fam?.last_daily ?? null},
    children:children.map(({id,name,birth,due,sex}) => ({id,name,birth,due,sex})),
    measures:measures.map(m => ({child_id:m.child_id, date:m.date, weight_g:m.weight_g, length_cm:m.length_cm, by:m.by_user})),
    members:members.map(m => ({id:m.user_id, name:m.name, color:m.color})),
    checks:checks.map(x => ({id:x.id, by:x.by_user, at:x.at, ...(x.val === 2 ? {val:2} : {})})),
    vaccines:vaccines.map(v => ({child_id:v.child_id, code:v.code, name:v.name, planned:v.planned, status:v.status, booked_at:v.booked_at, done_date:v.done_date, note:v.note, by:v.by_user, at:v.at}))};
}
async function sendExport(env, uid, fid, today){
  const data = await familyExport(env, fid);
  return tgDocument(env, {chat_id:uid, caption:`Копия данных «Первый год» на ${fmtD(today)}: ${data.checks.length} отметок, ${data.vaccines.length} прививок.\nВосстановить: приложение → ⚙️ Настройки → «Данные» → «Восстановить из копии».`},
    JSON.stringify(data), `first-year-${today}.json`, "application/json");
}
// Дети из копии → дети семьи: по дате и имени, потом по дате, потом по порядку.
function mapChildren(from, to){
  const map = new Map(), used = new Set();
  const passes = [(k, b) => k.birth === b.birth && (k.name||"") === (b.name||""), (k, b) => !!b.birth && k.birth === b.birth, () => true];
  for (const ok of passes) for (const b of from) {
    if (map.has(Number(b.id))) continue;
    const c = to.find(k => !used.has(k.id) && ok(k, b));
    if (c) { map.set(Number(b.id), c.id); used.add(c.id); }
  }
  return map;
}

// своя рутина семьи (families.routine): свои пункты и сроки встроенных
const routineCfg = row => { try { return cleanRoutineCfg(JSON.parse(row?.routine || "{}")); } catch { return {own:[], adj:{}}; } };
// «Совет дня» семьи на дату: выбирается один раз и запоминается (settings tip:<семья>:<дата> = id),
// поэтому бот, приложение и оба родителя видят один и тот же совет, а показанные больше не повторяются.
async function familyTip(env, fid, children, today){
  const key = `tip:${fid}:${today}`;
  const had = await env.DB.prepare("SELECT v FROM settings WHERE k=?").bind(key).first();
  if (had) return DAY_TIPS.find(t => t.id === had.v) || null;
  const kid = bornGroups(children).map(g => g[0]).find(c => { const a = ageOf(c.birth, today); return a.days >= 0 && a.week <= 52; });
  if (!kid) return null;
  const seen = new Set((await env.DB.prepare("SELECT v FROM settings WHERE k LIKE ?").bind(`tip:${fid}:%`).all()).results.map(r => r.v));
  const tip = pickTip(kid, today, seen); if (!tip) return null;
  await env.DB.prepare("INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)").bind(key, tip.id).run();
  const v = (await env.DB.prepare("SELECT v FROM settings WHERE k=?").bind(key).first())?.v;   // параллельный запрос мог успеть первым
  return DAY_TIPS.find(t => t.id === v) || tip;
}
// Утро — короткое и без списка дел: возраст, о чём помнить, совет дня. Рутина пунктами — только когда сам спросил (/today).
function dailyText(groups, today, extra="", cfg=null, tip=null, list=false){
  const parts = [`☀️ <b>Доброе утро!</b>`];
  for (const g of groups) {
    const a = ageOf(g[0].birth, today); if (a.week > 52) continue;
    parts.push("", `<b>${joinNames(g)}</b>: ${ageText(a)}, неделя ${a.week}`);
    if (list) parts.push(...routineFor(g[0].birth, today, cfg).map(x => `• ${x.x}`));
    const rm = remindersFor(g[0].birth, today); if (rm.length) parts.push(`<i>Весь день помнить: ${rm.map(r => r.x.toLowerCase()).join(" · ")}</i>`);
  }
  if (extra) parts.push("", extra);
  if (tip) parts.push("", "💡 <b>Совет дня</b>", escH(tip.t));
  return parts.join("\n");
}
// кто выключил утреннее сообщение (личная настройка, у каждого родителя своя)
const MORNING_OFF = uid => `morning_off:${uid}`;
async function morningOff(env, uid){ return !!(await env.DB.prepare("SELECT 1 FROM settings WHERE k=?").bind(MORNING_OFF(uid)).first()); }
function monthCaption(group, k){
  return `🎉 <b>Ураа! ${joinNames(group, dative)} ${k} ${monthWord(k)}!</b>\n\n${MONTHLY[k] ? `Обычно к этому возрасту: ${MONTHLY[k]}\n\n` : ""}У каждого ребёнка свои сроки — разница в несколько недель это норма.`;
}
function countdownText(c, daysTo, baseLeft, orders = true){
  const weeks = Math.round(daysTo / 7);
  return [`🤰 <b>До встречи${c.name ? ` с ${c.name}` : ""} ≈ ${weeks} ${plural(weeks,"неделя","недели","недель")}</b>`,
    ...(orders ? ["", baseLeft ? `Базовый набор к выписке: осталось отметить ${baseLeft}. Список по разделам — в приложении, вкладка «Вещи».` : "Базовый набор к выписке отмечен полностью."] : []),
    "", "Когда малыш родится, укажи дату в приложении — начнутся карточки недель."].join("\n");
}
// Сезонное уведомление «Важное» для бота: заголовок, вступление и 3–4 главных пункта.
function noticeText(n){
  return [`⚠️ <b>${escH(n.title)}</b>`, "", escH(n.lead), "", ...n.items.slice(0, 4).map(x => `• ${escH(x)}`)].join("\n");
}

// «Пора заказать» — отдельным сообщением, как только у вещи открывается окно заказа (за LEAD недель до нужды),
// один раз на вещь, без повторных «ещё не отмечено». Кнопки сразу ставят «есть» или «не нужно».
// Отметки — в settings (ord:<семья>:<вещь> = дата первого пуша, r<дата> после напоминания); не дошло никому — откат.
async function ordersPush(env, fam, groups, have, today){
  const due = new Map();
  for (const g of groups) {
    const a = ageOf(g[0].birth, today); if (a.days < 0 || a.week > 52) continue;
    for (const x of GEAR) if (x.need >= 4 && orderWeek(x) <= a.week && x.need >= a.week && inSeason(x, today) && !have.has(`o:${x.id}`) && !due.has(x.id))
      due.set(x.id, {x, from:new Date(Date.parse(g[0].birth + "T00:00:00Z") + (x.need - 1) * 7 * 864e5).toISOString().slice(0, 10), twins:g.length > 1,
        rt:(st => st && st.a > a.week ? {x:st.x, from:new Date(Date.parse(g[0].birth + "T00:00:00Z") + (st.a - 1) * 7 * 864e5).toISOString().slice(0, 10)} : null)(gearStage(x))});
  }
  if (!due.size) return "";
  const marks = new Map((await env.DB.prepare("SELECT k,v FROM settings WHERE k LIKE ?").bind(`ord:${fam.id}:%`).all()).results.map(r => [r.k, r.v]));
  const key = d => `ord:${fam.id}:${d.x.id}`;
  const fresh = [], again = [];
  for (const d of due.values()) if (!marks.get(key(d))) fresh.push(d);   // о каждой вещи — один раз, без «ещё не отмечено»
  if (!fresh.length && !again.length) return "";
  const line = d => `• ${escH(d.x.x)} — понадобится с ${fmtD(d.from)}${d.twins ? " (×2, где нужно)" : ""}${d.rt ? `\n   в рутине с ${fmtD(d.rt.from)}: «${escH(d.rt.x)}» — появится сам` : ""}`;
  const text = ["🛒 <b>Пора заказать</b>", "Доставка ~3 недели, поэтому заказывай сейчас.",
    ...(fresh.length ? ["", ...fresh.map(line)] : []),
    ...(again.length ? ["", "Ещё не отмечено:", ...again.map(line)] : []),
    "", "Уже есть или не нужно — можно нажать кнопку. Больше об этих вещах не напомню."].join("\n");
  const list = [...fresh, ...again].slice(0, 8);
  const kb = [...list.map(d => [{text:`✅ ${d.x.x}`, callback_data:`gear:1:${d.x.id}`}, {text:"Не нужно", callback_data:`gear:2:${d.x.id}`}]),
    [{text:"Открыть «Вещи»", web_app:{url:appUrl(env, "?tab=orders")}}]];
  for (const d of fresh) await env.DB.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)").bind(key(d), today).run();
  for (const d of again) await env.DB.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)").bind(key(d), "r" + today).run();
  let delivered = 0;
  for (const m of await familyMembers(env, fam.id)) {
    try { if ((await tg(env, "sendMessage", {chat_id:m.user_id, text, parse_mode:"HTML", reply_markup:{inline_keyboard:kb}})).ok) delivered++; }
    catch (e) { console.error("orders push, user", m.user_id, e.message || e); }
  }
  if (delivered) return "orders";
  for (const d of fresh) await env.DB.prepare("DELETE FROM settings WHERE k=?").bind(key(d)).run();
  for (const d of again) await env.DB.prepare("INSERT OR REPLACE INTO settings(k,v) VALUES(?,?)").bind(key(d), marks.get(key(d))).run();
  return "orders-failed";
}
async function onGearCallback(env, cq){
  const [, val, id] = String(cq.data).split(":");
  const answer = text => tg(env, "answerCallbackQuery", {callback_query_id:cq.id, _uid:cq.from.id, text});
  const me = await env.DB.prepare("SELECT family_id FROM members WHERE user_id=?").bind(cq.from.id).first();
  if (!me || !GEAR.some(g => g.id === id) || !["1", "2"].includes(val)) return answer("Не получилось отметить");
  await env.DB.prepare("INSERT INTO checks(family_id,id,val,by_user,at) VALUES(?,?,?,?,?) ON CONFLICT(family_id,id) DO UPDATE SET val=excluded.val, by_user=excluded.by_user, at=excluded.at")
    .bind(me.family_id, `o:${id}`, Number(val), cq.from.id, Date.now()).run();
  await answer(val === "1" ? "Отмечено: есть" : "Отмечено: не нужно");
  const kb = (cq.message?.reply_markup?.inline_keyboard || []).filter(row => !row.some(b => b.callback_data?.endsWith(`:${id}`)));
  if (cq.message) await tg(env, "editMessageReplyMarkup", {chat_id:cq.message.chat.id, message_id:cq.message.message_id, reply_markup:{inline_keyboard:kb}});
}

// Прививки: кнопки «✅ Сделали» в утреннем напоминании — для тех, что сегодня
function vacTodayKb(children, rows, today){
  return rows.filter(v => (v.status === "booked" || (v.status === "planned" && vaccineKind(v.code) !== "rec")) && children.find(k => k.id === v.child_id)?.birth && vaccineDue(v) === today)
    .slice(0, 4).map(v => [{text:`✅ Сделали: ${cut(v.name.split(" — ")[0], 40)}`, callback_data:`vac:done:${v.id}`}]);
}
// Местное время Киева "YYYY-MM-DDTHH:MM" → миллисекунды
function kyivMs(local){
  const guess = Date.parse(local + ":00Z");
  const shown = Date.parse(new Date(guess).toLocaleString("sv-SE", {timeZone:TZ}).replace(" ", "T") + "Z");
  return guess - (shown - guess);
}
// За час до записи на прививку (если указано время) — напоминание всей семье с кнопкой «Сделали». Раз на запись: settings vrem:<id>:<время>.
async function vacTick(env){
  const now = Date.now();
  const rows = (await env.DB.prepare("SELECT v.*, f.modules FROM vaccines v JOIN families f ON f.id=v.family_id WHERE v.status='booked' AND length(v.booked_at)>10").all()).results;
  for (const v of rows) {
    if (!modulesOf(v).vaccines) continue;
    const left = kyivMs(v.booked_at) - now;
    if (left > 60 * 60e3 || left < -10 * 60e3) continue;
    const key = `vrem:${v.id}:${v.booked_at}`;
    if (!(await env.DB.prepare("INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)").bind(key, String(now)).run()).meta.changes) continue;
    const kid = (await familyChildren(env, v.family_id)).find(c => c.id === v.child_id);
    const text = ["💉 <b>Скоро прививка</b>", `${escH(kid ? nm(kid) : "")}: ${escH(v.name)}`, `🕐 Запись на ${v.booked_at.slice(11, 16)}`, "", "После прививки нажми «Сделали» — отмечу в календаре."].join("\n");
    const kb = {inline_keyboard:[[{text:"✅ Сделали", callback_data:`vac:done:${v.id}`}], [{text:"💉 Все прививки", web_app:{url:appUrl(env, "?tab=vaccines")}}]]};
    await sendToFamily(env, v.family_id, id => tg(env, "sendMessage", {chat_id:id, text, parse_mode:"HTML", reply_markup:kb}));
  }
}
// «✅ Сделали» под напоминанием: прививка — сделана (датой записи, если она уже прошла, иначе сегодня)
async function onVacCallback(env, cq){
  const [, act, sid] = String(cq.data).split(":");
  const answer = text => tg(env, "answerCallbackQuery", {callback_query_id:cq.id, _uid:cq.from.id, text});
  const me = await getMember(env, cq.from.id);
  const v = me && act === "done" ? await env.DB.prepare("SELECT * FROM vaccines WHERE id=? AND family_id=?").bind(Number(sid), me.family_id).first() : null;
  if (!v) return answer("Не получилось отметить");
  const today = todayKyiv(), bd = v.booked_at?.slice(0, 10);
  if (v.status !== "done") await env.DB.prepare("UPDATE vaccines SET status='done', done_date=?, by_user=?, at=? WHERE id=?").bind(bd && bd < today ? bd : today, cq.from.id, Date.now(), v.id).run();
  await answer(v.status === "done" ? "Уже отмечено ✅" : "Отмечено: сделали ✅");
  if (cq.message) {
    const kb = (cq.message.reply_markup?.inline_keyboard || []).filter(row => !row.some(b => b.callback_data === cq.data));
    await tg(env, "editMessageReplyMarkup", {chat_id:cq.message.chat.id, message_id:cq.message.message_id, reply_markup:{inline_keyboard:kb}});
  }
}

// Утренняя рассылка одной семье. Возвращает, что отправлено.
async function dailyForFamily(env, fam, today, force=false){
  if (!force && fam.last_daily === today) return "skip";
  const children = await familyChildren(env, fam.id);
  const groups = bornGroups(children), mods = modulesOf(fam), have = await familyThings(env, fam.id);
  const sent = [];
  let weekSent = false;
  for (const g of groups) {
    const a = ageOf(g[0].birth, today);
    if (a.days < 0) continue;
    const lastMonth = Math.min(...g.map(c => c.last_month)), lastWeek = Math.min(...g.map(c => c.last_week));
    if (a.months >= 1 && a.months <= 12 && a.months > lastMonth) {
      await sendToFamily(env, fam.id, id => tg(env, "sendPhoto", {chat_id:id, photo:monthUrl(env, a.months), caption:monthCaption(g, a.months), parse_mode:"HTML",
        reply_markup:appButton(env, "🎉 Открыть", `?celebrate=${a.months}&child=${g[0].id}`)}));
      sent.push(`month${a.months}`);
    }
    if (a.week <= 52 && a.week > lastWeek) {
      await sendToFamily(env, fam.id, id => tg(env, "sendPhoto", {chat_id:id, photo:cardUrl(env, a.week), caption:weekCaption(g, a.week, a, {...mods, orders:false}, have), parse_mode:"HTML",
        reply_markup:appButton(env, "Открыть неделю", `?w=${a.week}&child=${g[0].id}`)}));
      sent.push(`week${a.week}`); weekSent = true;
    }
    for (const c of g) await env.DB.prepare("UPDATE children SET last_week=MAX(last_week,?), last_month=MAX(last_month,?) WHERE id=?")
      .bind(Math.min(a.week, 52), Math.min(a.months, 12), c.id).run();
  }
  const active = groups.filter(g => { const a = ageOf(g[0].birth, today); return a.days >= 0 && a.week <= 52; });
  let vrows = await familyVaccines(env, fam.id);
  if (await ensureVaccines(env, fam.id, children, vrows)) vrows = await familyVaccines(env, fam.id);
  const vacc = mods.vaccines ? vaccineReminder(children, vrows, today) : "";
  const vkb = mods.vaccines ? vacTodayKb(children, vrows, today) : [];
  if (!weekSent && active.length) {
    const tip = await familyTip(env, fam.id, children, today);
    // выключил утро — прививки всё равно придут, отдельным сообщением
    await sendToFamily(env, fam.id, async id => (await morningOff(env, id))
      ? vacc && tg(env, "sendMessage", {chat_id:id, text:vacc, parse_mode:"HTML", reply_markup:{inline_keyboard:[...vkb, ...appButton(env, "💉 Прививки", "?tab=vaccines").inline_keyboard]}})
      : tg(env, "sendMessage", {chat_id:id, text:dailyText(active, today, vacc, routineCfg(fam), tip), parse_mode:"HTML", reply_markup:{inline_keyboard:[...vkb, ...appButton(env, "Открыть день").inline_keyboard]}}));
    sent.push("daily");
  } else if (vacc) {
    await sendToFamily(env, fam.id, id => tg(env, "sendMessage", {chat_id:id, text:vacc, parse_mode:"HTML", reply_markup:{inline_keyboard:[...vkb, ...appButton(env, "💉 Прививки", "?tab=vaccines").inline_keyboard]}}));
  }
  if (vacc) sent.push("vaccines");
  const expecting = new Map();                                     // ещё не родились; двойня — одним сообщением
  for (const c of children.filter(c => !c.birth && c.due)) expecting.set(c.due, [...(expecting.get(c.due) || []), c]);
  const baseIds = GEAR.filter(isBase).map(g => `o:${g.id}`);
  for (const g of expecting.values()) {
    const c = g.length > 1 ? {...g[0], name: g.every(k => k.name) ? joinNames(g) : null} : g[0];
    const d = daysBetween(today, c.due);
    if (d > 0 && d % 7 === 0) {
      const left = baseIds.filter(id => !have.has(id)).length;
      await sendToFamily(env, fam.id, id => tg(env, "sendMessage", {chat_id:id, text:countdownText(c, d, left, mods.orders), parse_mode:"HTML", reply_markup:appButton(env, "Открыть")}));
      sent.push("countdown");
    } else if (d <= 0 && (-d) % 7 === 1) {
      await sendToFamily(env, fam.id, id => tg(env, "sendMessage", {chat_id:id, parse_mode:"HTML",
        text:`👶 ${c.name ? `${c.name} уже` : g.length > 1 ? "Малыши уже" : "Малыш уже"} с вами? Укажи дату рождения — и начнутся карточки недель, рутина и поздравления.`,
        reply_markup:appButton(env, "Малыш родился", "?tab=family")}));
      sent.push("born?");
    }
  }
  // утро отмечено до уведомлений: сбой «Важного» не повторит утреннюю карточку
  await env.DB.prepare("UPDATE families SET last_daily=? WHERE id=?").bind(today, fam.id).run();
  if (mods.orders) { const o = await ordersPush(env, fam, groups, have, today); if (o) sent.push(o); }
  // «Важное»: один раз за сезон на семью, в первое утро внутри push-окна. Отметка ставится до отправки — повторный прогон не дублирует;
  // если не дошло никому — отметка снимается, повтор на следующее утро.
  const firstYear = children.some(c => !c.birth || ageOf(c.birth, today).week <= 52);
  for (const n of NOTICES) {
    const season = noticeSeason(n.push, today); if (season === null) continue;
    if (n.minWeeks ? !children.some(c => c.birth && ageOf(c.birth, today).week >= n.minWeeks) : !firstYear) continue;
    const key = `notice:${fam.id}:${n.id}:${season}`;
    const mark = await env.DB.prepare("INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)").bind(key, today).run();
    if (!mark.meta.changes) continue;
    let delivered = 0;
    for (const m of await familyMembers(env, fam.id)) {
      try { if ((await tg(env, "sendMessage", {chat_id:m.user_id, text:noticeText(n), parse_mode:"HTML", reply_markup:appButton(env, "Открыть в приложении", `?notice=${n.id}`)})).ok) delivered++; }
      catch (e) { console.error("notice", n.id, "user", m.user_id, e.message || e); }
    }
    if (delivered) sent.push(`notice:${n.id}`);
    else { await env.DB.prepare("DELETE FROM settings WHERE k=?").bind(key).run(); console.error(`notice ${n.id}: семье ${fam.id} не доставлено, повтор завтра`); sent.push(`notice-failed:${n.id}`); }
  }
  return sent.join("+") || "nothing";
}

async function onGateCallback(env, cq){
  const r = await gateCheck(env, cq.from.id);
  await tg(env, "answerCallbackQuery", {callback_query_id:cq.id, _uid:cq.from.id, text: r.ok ? "Спасибо! Можно начинать" : "Пока не вижу подписки", show_alert: !r.ok});
  if (r.ok) await tg(env, "sendMessage", {chat_id:cq.from.id, text:"Готово! Заполнение займёт полминуты.", reply_markup:appButton(env, "Начать")});
}

// ---------- обратная связь ----------
// Отзыв о приложении — один на человека (пять похвал от одного не делают приложение лучше); предложений и неполадок — до 10:
// каждое — отдельное дело. Порядок ключей — порядок на экране.
const FB_LIMIT = {like:1, idea:50, issue:50};
const FB_HEAD = {like:"💬 Отзыв", idea:"💡 Предложение", issue:"⚠️ Неполадка"};
const FB_THANKS = {like:"Спасибо! Ваш отзыв учли:", idea:"Спасибо! Ваше предложение учли:", issue:"Спасибо! Ваше сообщение о неполадке учли:"};
const FB_FULL = {like:"Отзыв у тебя уже есть. Можно изменить его или удалить и написать новый.",
  idea:"Сейчас больше не поместится. Измени или удали одно из прежних, чтобы написать новое.",
  issue:"Сейчас больше не поместится. Измени или удали одно из прежних, чтобы написать новое."};
const FB_META = ["v", "tab", "platform", "tgv", "lang", "w"];   // только это и только строками до 40 знаков: личного в meta не бывает
const HOUR = 3600e3, FB_PER_HOUR = 5, FB_EDITS_PER_HOUR = 20;
const adminIds = env => String(env.ADMIN_IDS || "").split(",").map(s => Number(s.trim())).filter(n => Number.isSafeInteger(n) && n > 0);
const isKind = k => typeof k === "string" && Object.hasOwn(FB_LIMIT, k);
const fbRating = r => { const n = Number(r); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
function fbText(body){
  const t = String(body?.text ?? "").trim();
  if (t.length < 10) return [null, "Напиши чуть подробнее — хотя бы 10 символов"];
  if (t.length > 2000) return [null, "Слишком длинно: максимум 2000 символов"];
  return [t, null];
}
function fbMeta(m){
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const o = {};
  for (const k of FB_META) if (m[k] != null && m[k] !== "" && typeof m[k] !== "object") o[k] = String(m[k]).slice(0, 40);
  return Object.keys(o).length ? JSON.stringify(o) : null;
}
// Вид исчерпан — отдельный флаг kind_full, а не только текст: по нему экран вместо поля показывает уже написанное.
const fbFull = kind => json({ok:false, kind_full:true, kind, error:FB_FULL[kind]});
const cut = (s, n) => s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
// Сообщения с текстом пользователя: подписи переводим словарём под получателя заранее, а сам текст — нет
// (иначе словарь «переводит» куски чужого текста). _uid:0 — tg() не локализует сообщение второй раз.
const trFor = async (env, uid) => { const l = await langOf(env, uid); return s => localize(l, {text:s}).text; };
const sendAsIs = (env, uid, text, reply_markup) => tg(env, "sendMessage", {chat_id:uid, _uid:0, text, parse_mode:"HTML", ...(reply_markup ? {reply_markup} : {})});

async function fbMine(env, uid){
  const items = (await env.DB.prepare("SELECT id, kind, text, rating, status, created, updated, liked, reply, reply_at FROM feedback WHERE user_id=? ORDER BY created DESC, id DESC").bind(uid).all()).results;
  const kinds = Object.entries(FB_LIMIT).map(([kind, limit]) => {
    const used = items.filter(i => i.kind === kind).length;
    return {kind, limit, used, left:Math.max(0, limit - used), full:used >= limit};
  });
  return {kinds, items};
}
// Новая запись или правка — каждому админу. Сбой отправки запись не теряет: она уже в базе.
async function fbNotify(env, id, edited = false){
  const admins = adminIds(env); if (!admins.length) return;
  const f = await env.DB.prepare("SELECT f.*, m.name FROM feedback f LEFT JOIN members m ON m.user_id=f.user_id WHERE f.id=?").bind(id).first();
  if (!f) return;
  let meta = "";
  try { const o = JSON.parse(f.meta || "null"); if (o) meta = Object.entries(o).map(([k, v]) => `${k}=${v}`).join(" · "); } catch {}
  for (const a of admins) {
    try {
      const T = await trFor(env, a);
      const text = [`<b>${T(FB_HEAD[f.kind])} №${f.id}</b>`, ...(edited ? [T("✏️ Текст изменён")] : []),
        ...(f.rating ? [`${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)} ${f.rating}/5`] : []),
        "", escH(cut(f.text, 1500)), "",
        `${f.name ? escH(f.name) : T("без семьи")} · <code>${f.user_id}</code>`, ...(meta ? [`<i>${escH(meta)}</i>`] : [])].join("\n");
      await sendAsIs(env, a, text, {inline_keyboard:[
        [...(f.liked ? [] : [{text:T("❤️ Нравится"), callback_data:`fb:like:${f.id}`}]), {text:T("💬 Ответить"), callback_data:`fb:reply:${f.id}`}],
        [{text:T("👀 Прочитано"), callback_data:`fb:seen:${f.id}`}, {text:T("✅ Сделано"), callback_data:`fb:done:${f.id}`}]]});
    } catch (e) { console.error("feedback notify, admin", a, e.message || e); }
  }
}
// API отзыва. Работает и без семьи (family_id NULL). Частота считается по базе, а не в памяти: переживает перезапуск.
async function feedbackApi(env, path, body, user, me){
  const uid = Number(user.id), now = Date.now();
  if (path === "/api/feedback/mine") return json(await fbMine(env, uid));
  if (path === "/api/feedback") {
    const kind = isKind(body.kind) ? body.kind : null;
    if (!kind) return json({error:"Сначала выбери, о чём"}, 400);
    const [text, why] = fbText(body); if (why) return json({error:why}, 400);
    // исчерпанный вид — до счётчика частоты: за этой попыткой не стоит ни записи, ни сообщения админу
    const used = (await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE user_id=? AND kind=?").bind(uid, kind).first()).n;
    if (used >= FB_LIMIT[kind]) return fbFull(kind);
    // созданные за час + удалённые за час (иначе «создал — удалил — создал» обходит счётчик)
    const recent = (await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM feedback WHERE user_id=?1 AND created>?2)
      + (SELECT COUNT(*) FROM feedback_history WHERE user_id=?1 AND action='deleted' AND at>?2) AS n`).bind(uid, now - HOUR).first()).n;
    if (recent >= FB_PER_HOUR) return json({error:"За последний час уже несколько сообщений. Следующее можно будет отправить чуть позже."}, 429);
    // лимит вида — внутри вставки: два устройства или двойное нажатие не проскочат между проверкой и записью
    const r = await env.DB.prepare(`INSERT INTO feedback(user_id,family_id,kind,text,rating,meta,status,created)
      SELECT ?,?,?,?,?,?,'new',? WHERE (SELECT COUNT(*) FROM feedback WHERE user_id=? AND kind=?) < ?`)
      .bind(uid, me?.family_id ?? null, kind, text, kind === "like" ? fbRating(body.rating) : null, fbMeta(body.meta), now, uid, kind, FB_LIMIT[kind]).run();
    if (!r.meta.changes) return fbFull(kind);
    const id = r.meta.last_row_id;
    try { await fbNotify(env, id); } catch (e) { console.error("feedback notify", id, e.message || e); }
    return json({ok:true, id, kind});
  }
  if (path === "/api/feedback/edit" || path === "/api/feedback/delete") {
    const edit = path === "/api/feedback/edit";
    let text = null;
    if (edit) { const [t, why] = fbText(body); if (why) return json({error:why}, 400); text = t; }
    const edits = (await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback_history WHERE user_id=? AND at>?").bind(uid, now - HOUR).first()).n;
    if (edits >= FB_EDITS_PER_HOUR) return json({error:"Слишком много правок подряд. Попробуй через час."}, 429);
    const id = Number(body.id);
    // user_id в WHERE: чужой номер не находится вовсе
    const old = Number.isSafeInteger(id) && id > 0 ? await env.DB.prepare("SELECT * FROM feedback WHERE id=? AND user_id=?").bind(id, uid).first() : null;
    if (!old) return json({error:"Сообщение не найдено"}, 404);
    const hist = action => env.DB.prepare("INSERT INTO feedback_history(feedback_id,user_id,kind,text,action,at) VALUES(?,?,?,?,?,?)").bind(id, uid, old.kind, old.text, action, now);
    if (!edit) {
      await env.DB.batch([hist("deleted"), env.DB.prepare("DELETE FROM feedback WHERE id=? AND user_id=?").bind(id, uid)]);
      return json({ok:true, id});
    }
    const rating = old.kind === "like" && "rating" in body ? fbRating(body.rating) : old.rating;
    if (text === old.text && rating === old.rating) return json({ok:true, id});   // ничего не поменялось — и писать нечего
    await env.DB.batch([hist("edited"), env.DB.prepare("UPDATE feedback SET text=?, rating=?, status='new', updated=? WHERE id=? AND user_id=?").bind(text, rating, now, id, uid)]);
    try { await fbNotify(env, id, true); } catch (e) { console.error("feedback notify", id, e.message || e); }
    return json({ok:true, id});
  }
  return json({error:"not found"}, 404);
}
// Кнопки под сообщением админу: fb:seen:<id> / fb:done:<id>
async function onFeedbackCallback(env, cq){
  const [, st, sid] = String(cq.data).split(":"), id = Number(sid);
  const answer = (text, show_alert = false) => tg(env, "answerCallbackQuery", {callback_query_id:cq.id, _uid:cq.from.id, text, show_alert});
  if (!adminIds(env).includes(Number(cq.from.id))) return answer("Эта кнопка только для администратора", true);
  const f = ["seen", "done", "like", "reply"].includes(st) && Number.isSafeInteger(id) ? await env.DB.prepare("SELECT * FROM feedback WHERE id=?").bind(id).first() : null;
  if (!f) return answer("Сообщение не найдено: возможно, его удалили");
  if (st === "reply") {   // ответ — обычным сообщением в ответ на эту подсказку (force_reply); номер берём из её текста
    await answer("Напиши ответ");
    return tg(env, "sendMessage", {chat_id:cq.from.id, _uid:cq.from.id, parse_mode:"HTML", text:`${FB_REPLY_MARK} №${f.id}\n«${escH(cut(f.text, 200))}»\n\nНапиши ответ сообщением на это — его увидят в приложении и получат в бот.`,
      reply_markup:{force_reply:true, input_field_placeholder:"Ответ"}});
  }
  if (st === "like") {
    await answer("Отмечено: нравится");
    if (cq.message) {
      const kb = (cq.message.reply_markup?.inline_keyboard || []).map(row => row.filter(b => b.callback_data !== cq.data)).filter(row => row.length);
      await tg(env, "editMessageReplyMarkup", {chat_id:cq.message.chat.id, message_id:cq.message.message_id, reply_markup:{inline_keyboard:kb}});
    }
    await fbLike(env, f);
    return;
  }
  await answer(st === "done" ? "Отмечено: сделано" : "Отмечено: прочитано");
  if (cq.message) {
    const kb = (cq.message.reply_markup?.inline_keyboard || []).map(row => row.filter(b => b.callback_data !== cq.data)).filter(row => row.length);
    await tg(env, "editMessageReplyMarkup", {chat_id:cq.message.chat.id, message_id:cq.message.message_id, reply_markup:{inline_keyboard:kb}});
  }
  await fbStatus(env, f, st);
}
// Действия с отзывом (кнопки в боте и админка): true — что-то изменилось
async function fbLike(env, f){
  const r = await env.DB.prepare("UPDATE feedback SET liked=1, status=CASE WHEN status='new' THEN 'seen' ELSE status END WHERE id=? AND liked=0").bind(f.id).run();
  if (r.meta.changes) await fbTell(env, f, FB_LIKED[f.kind], "");
  return !!r.meta.changes;
}
async function fbStatus(env, f, st){   // «Прочитано» не откатывает «Сделано»; «Сделано» — человеку спасибо
  const r = await env.DB.prepare(st === "done" ? "UPDATE feedback SET status='done' WHERE id=? AND status!='done'" : "UPDATE feedback SET status='seen' WHERE id=? AND status='new'").bind(f.id).run();
  if (st === "done" && r.meta.changes) {
    try { const T = await trFor(env, f.user_id); await sendAsIs(env, f.user_id, `${T(FB_THANKS[f.kind])}\n«${escH(cut(f.text, 100))}»`); }
    catch (e) { console.error("feedback thanks", f.id, e.message || e); }
  }
  return !!r.meta.changes;
}
async function fbSaveReply(env, f, text){
  await env.DB.prepare("UPDATE feedback SET reply=?, reply_at=?, status=CASE WHEN status='new' THEN 'seen' ELSE status END WHERE id=?").bind(text, Date.now(), f.id).run();
  await fbTell(env, f, "💬 Разработчик ответил на ваше сообщение:", text);
}
// Человеку о реакции разработчика: заголовок, его текст коротко, ответ (как есть, без перевода) и кнопка в приложение
const FB_LIKED = {like:"❤️ Разработчику понравился ваш отзыв:", idea:"❤️ Разработчику понравилось ваше предложение:", issue:"❤️ Разработчик отметил ваше сообщение о неполадке:"};
const FB_REPLY_MARK = "✍️ Ответ на";
async function fbTell(env, f, head, reply){
  try {
    const T = await trFor(env, f.user_id);
    await sendAsIs(env, f.user_id, [T(head), `«${escH(cut(f.text, 120))}»`, ...(reply ? ["", escH(reply)] : [])].join("\n"),
      {inline_keyboard:[[{text:T("Открыть мои сообщения"), web_app:{url:appUrl(env, "?tab=feedback")}}]]});
  } catch (e) { console.error("feedback tell", f.id, e.message || e); }
}
// админ ответил на подсказку «✍️ Ответ на №N» — сохранить и переслать автору
async function onFeedbackReply(env, msg){
  const m = /№(\d+)/.exec(msg.reply_to_message?.text || ""); if (!m) return false;
  const id = Number(m[1]), text = cleanText(msg.text, 2000);
  if (!text) return true;
  const f = await env.DB.prepare("SELECT * FROM feedback WHERE id=?").bind(id).first();
  if (!f) { await tg(env, "sendMessage", {chat_id:msg.from.id, text:"Сообщение не найдено: возможно, его удалили"}); return true; }
  await fbSaveReply(env, f, text);
  await tg(env, "sendMessage", {chat_id:msg.from.id, text:`Ответ на №${id} отправлен.`});
  return true;
}
// /feedback — только админам: последние 15 открытых (new/seen) одной строкой
async function feedbackList(env, uid){
  const T = await trFor(env, uid);
  const rows = (await env.DB.prepare(`SELECT f.id, f.kind, f.status, f.text, f.rating, m.name FROM feedback f LEFT JOIN members m ON m.user_id=f.user_id
    WHERE f.status IN ('new','seen') ORDER BY f.created DESC, f.id DESC LIMIT 15`).all()).results;
  if (!rows.length) return sendAsIs(env, uid, T("Открытых сообщений нет."));
  const icon = {like:"💬", idea:"💡", issue:"⚠️"};
  const lines = rows.map(r => `${icon[r.kind] || "•"} №${r.id} ${r.status === "new" ? "🆕" : "👀"}${r.rating ? ` ${r.rating}★` : ""} <b>${escH(r.name || T("без семьи"))}</b>: ${escH(cut(r.text.replace(/\s+/g, " "), 80))}`);
  return sendAsIs(env, uid, [`<b>${T("Открытые сообщения")}: ${rows.length}</b>`, "", ...lines, "", T("🆕 — новое, 👀 — прочитано. «Сделано» — кнопкой под сообщением.")].join("\n"));
}

// ---------- бот ----------
const WEB_HOWTO = [
  "📲 <b>Приложение на главном экране</b>",
  "",
  "Кнопка ниже откроет приложение в браузере — уже со входом в вашу семью.",
  "",
  "<b>iPhone:</b> открой в Safari → «Поделиться» → «На экран „Домой“».",
  "<b>Android:</b> открой в Chrome → ⋮ → «Добавить на главный экран» или «Установить приложение».",
  "",
  "Ссылка личная — как ключ. Не пересылай её. Отключить все ссылки: Настройки → «На главный экран».",
];
// /help: команды, что бот присылает сам, частые вопросы. Строки — целиком ключи словаря (перевод в tg()).
const HELP = [
  "<b>Команды</b>",
  "/today — рутина на сегодня",
  "/week — карточка текущей недели",
  "/card 12 — карточка любой недели, от 1 до 52",
  "/flags — красные флаги по возрасту: когда к врачу",
  "/vaccines — прививки: что впереди и что пора сделать",
  "/export — копия всех данных файлом",
  "/sos — первая помощь: номера и что делать (работает и без регистрации)",
  "/web — поставить приложение иконкой на телефон",
  "/help — эта справка",
  "",
  "<b>Что бот присылает сам</b>",
  "• Каждое утро — рутина на день, в день новой недели — её карточка",
  "• За 3 дня и в день прививки — напоминание",
  "• За час до записи на прививку — напоминание с кнопкой «Сделали»",
  "• Когда пора заказать вещи — сообщение с кнопками «есть» и «не нужно»",
  "• Раз в месяц — поздравление",
  "• Во время кормления — таймер с кнопкой «Закончить»",
  "",
  "<b>Частые вопросы</b>",
  "<b>Как позвать второго родителя?</b>",
  "Приложение → ⚙️ Настройки → «Семья и цвета» → «Отправить приглашение».",
  "<b>Малыш родился — что нажать?</b>",
  "⚙️ Настройки → «Ребёнок» → «Родился! Указать дату».",
  "<b>Как записать кормление?</b>",
  "Вкладка «Кормление» → грудь или бутылочка → «Старт».",
  "<b>Слишком много уведомлений?</b>",
  "⚙️ Настройки → «Что ведём»: выключи ненужное. Совсем без звука — в Telegram: имя бота вверху → «Выключить звук».",
  "<b>Нашли ошибку или есть идея?</b>",
  "⚙️ Настройки → «Обратная связь».",
  "",
  "Все ответы с анимациями — в приложении: ⚙️ Настройки → «Вопросы и ответы».",
].join("\n");
// Подпись к ролику на /start (≤1024 символов). Перевод — построчно, как остальные тексты бота.
// Приветствие на /start — одно сообщение: ролик (нарезка 15 с из VSL, без звука, public/media/welcome-*.mp4), текст и кнопки.
// Язык по умолчанию украинский; кнопка внизу сразу переключает (lang:ru / lang:uk) и перерисовывает это же сообщение.
const WELCOME = [
  "<b>Привет! Это «Первый год»</b> — помощник для мамы и папы на первый год малыша.",
  "",
  "🗓 Что происходит с малышом на этой неделе — и что с этим делать",
  "✅ Новое в рутине появляется вовремя, с объяснением почему",
  "👫 Сон и кормления вдвоём: таймер видно обоим",
  "💉 Прививки, вес и рост по нормам ВОЗ",
].join("\n");
async function welcomeBody(env, uid){
  const lang = (await langOf(env, uid)).lang === "ru" ? "ru" : "uk", gs = await gateStatus(env, uid);
  const gate = gs.required && !gs.passed;
  const tail = gate ? `Чтобы начать, подпишитесь на канал <b>${gs.channel}</b> и нажмите «проверить».` : "Настройка займёт полминуты: дата рождения — и план на год готов.";
  const kb = gate ? gateKeyboard(env, gs).inline_keyboard : appButton(env, "Начать").inline_keyboard;
  const other = lang === "ru" ? {text:"🇺🇦 Українською", callback_data:"lang:uk"} : {text:"Русский язык", callback_data:"lang:ru"};
  return {lang, caption:`${WELCOME}\n\n${tail}`, reply_markup:{inline_keyboard:[...kb, [other]]}};
}
async function sendWelcome(env, uid){
  const w = await welcomeBody(env, uid);
  const r = await tg(env, "sendAnimation", {chat_id:uid, animation:`${base(env)}/media/welcome-${w.lang}.mp4`, caption:w.caption, parse_mode:"HTML", width:720, height:1280, reply_markup:w.reply_markup});
  if (!r?.ok) return tg(env, "sendMessage", {chat_id:uid, text:w.caption, parse_mode:"HTML", reply_markup:w.reply_markup});   // ролик не ушёл — хотя бы текстом
  return r;
}
// кнопка языка под приветствием: сохранить язык и заменить ролик и текст в том же сообщении
async function onLangCallback(env, cq){
  const uid = cq.from.id, lang = cq.data === "lang:ru" ? "ru" : "uk";
  await env.DB.prepare("INSERT OR REPLACE INTO user_lang(user_id, lang) VALUES(?,?)").bind(uid, lang).run();
  forgetLang(uid);
  await tg(env, "answerCallbackQuery", {callback_query_id:cq.id, _uid:uid, text:lang === "ru" ? "Язык: русский" : "Мова: українська"});
  if (!cq.message) return sendWelcome(env, uid);
  const w = await welcomeBody(env, uid);
  const r = await tg(env, "editMessageMedia", {chat_id:cq.message.chat.id, message_id:cq.message.message_id, _uid:uid,
    media:{type:"animation", media:`${base(env)}/media/welcome-${w.lang}.mp4`, caption:w.caption, parse_mode:"HTML", width:720, height:1280}, reply_markup:w.reply_markup});
  if (!r?.ok) await tg(env, "editMessageText", {chat_id:cq.message.chat.id, message_id:cq.message.message_id, text:w.caption, parse_mode:"HTML", reply_markup:w.reply_markup});
}
async function onMessage(env, msg){
  if (msg.chat.type !== "private") return;
  await seen(env, msg.from, "bot");
  const uid = msg.from.id, text = (msg.text || "").trim();
  const [cmd, ...args] = text.split(/\s+/);
  const say = (t, extra={}) => tg(env, "sendMessage", {chat_id:uid, text:t, parse_mode:"HTML", ...extra});
  const me = await getMember(env, uid);
  // ответ разработчика на отзыв: сообщение-ответ на подсказку бота «✍️ Ответ на №N»
  if (msg.reply_to_message?.from?.is_bot && adminIds(env).includes(Number(uid)) && msg.text && !text.startsWith("/") && await onFeedbackReply(env, msg)) return;

  if (cmd === "/start" && (args[0] || "").startsWith("wl_")) return wlAsk(env, uid, args[0].slice(3), say);
  if (cmd === "/start") {
    const code = (args[0] || "").startsWith("inv_") ? args[0].slice(4) : null;
    if (code) {
      const inv = await env.DB.prepare("SELECT * FROM invites WHERE code=?").bind(code).first();
      if (!inv || Date.now() - inv.created > 14*864e5) return say("Приглашение устарело. Попроси новое в приложении: ⚙️ Настройки → «Семья и цвета».");
      if (me && me.family_id === inv.family_id) return say("Ты уже в этой семье.", {reply_markup:appButton(env, "Открыть приложение")});
      if (me) return say("Ты уже состоишь в другой семье. Пока один аккаунт — одна семья.");
      if ((await familyMembers(env, inv.family_id)).length >= MAX_MEMBERS) return say("В этой семье уже двое родителей.");
      const myName = cleanName(msg.from.first_name) || "Родитель";
      const ownerRole = (await env.DB.prepare("SELECT role FROM members WHERE family_id=? AND owner=1").bind(inv.family_id).first())?.role;
      const role = ownerRole === "mama" ? "papa" : ownerRole === "papa" ? "mama" : null;
      await env.DB.prepare("INSERT INTO members(user_id,family_id,name,color,role,owner,created) VALUES(?,?,?,?,?,0,?)")
        .bind(uid, inv.family_id, myName, await freeColor(env, inv.family_id), role, Date.now()).run();
      await env.DB.prepare("DELETE FROM invites WHERE family_id=?").bind(inv.family_id).run();   // место занято — старые ссылки больше не нужны
      const kids = joinNames(await familyChildren(env, inv.family_id));
      await sendToFamily(env, inv.family_id, id => id === uid ? null : tg(env, "sendMessage", {chat_id:id, text:`👋 ${myName} теперь с вами: будет видеть отметки и получать те же уведомления.`}));
      return say(`Готово! Ты в семье (${kids}). Каждое утро будут приходить те же уведомления, что и второму родителю. Свой цвет выбери в приложении: ⚙️ Настройки → «Семья и цвета».`,
        {reply_markup:appButton(env, "Открыть приложение", "?tab=family")});
    }
    if (me) return say("С возвращением!", {reply_markup:appButton(env, "Открыть приложение")});
    return sendWelcome(env, uid);
  }
  if (cmd === "/web") {   // приложение на главный экран телефона: личная ссылка для браузера
    const link = await webLink(env, msg.from);
    const kb = {inline_keyboard:[[{text:"🌐 Открыть в браузере", url:link}]]};
    // ролик-инструкция (scripts/render-intro.mjs, INTRO_ID=pwa) с текстом и кнопкой в подписи; не ушёл — просто текстом
    const lang = (await langOf(env, uid)).lang === "ru" ? "ru" : "uk";
    const r = await tg(env, "sendAnimation", {chat_id:uid, animation:`${env.APP_URL}/media/howto-pwa-${lang}.mp4`, caption:WEB_HOWTO.join("\n"), parse_mode:"HTML", width:720, height:1280, reply_markup:kb}).catch(e => ({ok:false, description:e.message}));
    if (r?.ok) return;
    console.error("web howto video", r?.description);
    return say(WEB_HOWTO.join("\n"), {reply_markup:kb});
  }
  if (cmd === "/sos") {   // работает и без семьи — в панике не до регистрации
    const head = `🆘 <b>${EMERGENCY.map(e => `${e.num} — ${e.label.toLowerCase()}`).join(" · ")}</b>`;
    return say([head, "Звони на громкой связи, диспетчер подскажет.", ...FIRST_AID.map(f => `<b>${f.title}</b> — ${f.call}`)].join("\n\n"),
      {reply_markup:appButton(env, "🆘 Пошагово", "?sos=1")});
  }
  if (cmd === "/help") return say(HELP, {reply_markup:appButton(env, "❓ Вопросы и ответы", "?tab=faq")});   // и без семьи
  if (cmd === "/feedback" && adminIds(env).includes(Number(uid))) return feedbackList(env, uid);   // остальным — как неизвестная команда
  if (cmd === "/admin" && isAdmin(env, uid)) return say(`🛠 <b>Админка</b>: пользователи, семьи, приглашения, отзывы.\n\nВ браузере: ${appUrl(env, "admin")} (если входил в приложение в этом браузере через /web)`,
    {reply_markup:appButton(env, "🛠 Открыть админку", "admin")});
  if (!me) return say("Сначала открой приложение.", {reply_markup:appButton(env, "Открыть")});
  const today = todayKyiv(), groups = bornGroups(await familyChildren(env, me.family_id));
  const g = groups[0];
  if (cmd === "/week" || cmd === "/card") {
    const n = cmd === "/card" ? Number(args[0]) : (g ? ageOf(g[0].birth, today).week : 0);
    if (!(n >= 1 && n <= 52)) return say(cmd === "/card" ? "Номер недели от 1 до 52: <code>/card 12</code>" : "Карточки начнутся после даты рождения. Посмотреть любую неделю: <code>/card 1</code>");
    const fam = await env.DB.prepare("SELECT modules FROM families WHERE id=?").bind(me.family_id).first();
    const caption = g ? weekCaption(g, n, ageOf(g[0].birth, today), modulesOf(fam), await familyThings(env, me.family_id)) :`<b>Неделя ${n} · ${W[n-1].t}</b>`;
    return tg(env, "sendPhoto", {chat_id:uid, photo:cardUrl(env, n), caption, parse_mode:"HTML", reply_markup:appButton(env, "Открыть неделю", `?w=${n}`)});
  }
  if (cmd === "/today") {
    if (!groups.length) return say("Рутина начнётся после даты рождения.", {reply_markup:appButton(env, "Открыть")});
    const fam = await env.DB.prepare("SELECT routine FROM families WHERE id=?").bind(me.family_id).first();
    return say(dailyText(groups, today, "", routineCfg(fam), await familyTip(env, me.family_id, await familyChildren(env, me.family_id), today), true), {reply_markup:appButton(env, "Открыть рутину")});
  }
  if (cmd === "/flags") {
    if (!g) return say("Флаги развития появятся после даты рождения.");
    const a = ageOf(g[0].birth, today), f = flagsFor(a.months);
    return say(`<b>${f.title}</b>\nК врачу, если:\n${f.items.map(x => "• " + x).join("\n")}\n\n<b>Срочно:</b>\n${urgentFor(a.months).map(x => "• " + x).join("\n")}`);
  }
  if (cmd === "/vaccines") {
    const kids = await familyChildren(env, me.family_id);
    if (!kids.some(c => c.birth)) return say("Календарь прививок появится после даты рождения.", {reply_markup:appButton(env, "Открыть")});
    let rows = await familyVaccines(env, me.family_id);
    if (await ensureVaccines(env, me.family_id, kids, rows)) rows = await familyVaccines(env, me.family_id);
    return say(vaccinesText(kids, rows, today), {reply_markup:appButton(env, "💉 Все прививки", "?tab=vaccines")});
  }
  if (cmd === "/export") {
    const r = await sendExport(env, uid, me.family_id, today);
    return r.ok ? null : say("Не получилось отправить файл. Попробуй из приложения: ⚙️ Настройки → «Данные» → «Скачать копию данных».");
  }
  return say("Команды: /today, /week, /card N, /flags, /vaccines, /export, /sos. Все команды и частые вопросы — /help", {reply_markup:appButton(env, "Открыть приложение")});
}

// ---------- вход вне Telegram: приложение на главном экране телефона (PWA) ----------
// Личная ссылка ?k=<токен> из бота (/web) или из настроек. В базе только sha-256 токена: settings web:<хэш> = "uid|имя|дата".
// До 10 ссылок на человека (старые вытесняются), живут 180 дней, отозвать все — /api/web/revoke. Выпуск — только из Telegram.
const sha256hex = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const WEB_TOKEN = /^[A-Za-z0-9_-]{40,64}$/, WEB_TTL = 180 * 864e5;
async function webUser(env, token){
  if (!WEB_TOKEN.test(token || "")) return null;
  const row = await env.DB.prepare("SELECT v FROM settings WHERE k=?").bind(`web:${await sha256hex(token)}`).first();
  if (!row) return null;
  const [id, name, at] = row.v.split("|");
  if (!(Date.now() - Date.parse(at) < WEB_TTL)) return null;
  return {id:Number(id), first_name:name || ""};
}
const myWebLinks = async (env, uid) => (await env.DB.prepare("SELECT k, v FROM settings WHERE k LIKE 'web:%' AND v LIKE ?").bind(`${uid}|%`).all()).results;
async function webLink(env, user){
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const mine = (await myWebLinks(env, user.id)).sort((a, b) => a.v.split("|")[2] < b.v.split("|")[2] ? -1 : 1);
  for (const r of mine.slice(0, Math.max(0, mine.length - 9))) await env.DB.prepare("DELETE FROM settings WHERE k=?").bind(r.k).run();
  await env.DB.prepare("INSERT INTO settings(k,v) VALUES(?,?)").bind(`web:${await sha256hex(token)}`,
    `${user.id}|${String(user.first_name || "").replace(/\|/g, " ").slice(0, 40)}|${new Date().toISOString()}`).run();
  return `${base(env)}/?k=${token}`;
}
// Вход в приложение на главном экране через Telegram. На iPhone оно живёт отдельно от Safari, и ссылка из бота
// открылась бы в Safari, а не в нём, — поэтому приложение само ждёт подтверждения:
// 1) /api/web/login/start — публичный id (уходит в ссылку t.me/…?start=wl_<id>), секрет (остаётся в приложении) и код из 4 цифр;
// 2) в боте человек видит тот же код и жмёт «Войти» — выпускаем обычную личную ссылку и кладём её токен к заявке;
// 3) приложение опрашивает /api/web/login/claim с секретом и забирает токен; заявка удаляется. Живёт 10 минут.
const WL_TTL = 10 * 60e3, WL_ID = /^[A-Za-z0-9_-]{16,32}$/;
const rnd = n => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(n)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function wlRow(env, id){
  if (!WL_ID.test(id || "")) return null;
  const r = await env.DB.prepare("SELECT v FROM settings WHERE k=?").bind(`wl:${id}`).first(); if (!r) return null;
  const [state, code, at, secretHash, token] = r.v.split("|");
  if (!(Date.now() - Date.parse(at) < WL_TTL)) { await env.DB.prepare("DELETE FROM settings WHERE k=?").bind(`wl:${id}`).run(); return null; }
  return {state, code, at, secretHash, token};
}
async function webLogin(env, req, path){
  const body = await req.json().catch(() => ({}));
  if (path === "/api/web/login/start" && req.method === "POST") {
    const old = new Date(Date.now() - WL_TTL).toISOString();
    for (const r of (await env.DB.prepare("SELECT k, v FROM settings WHERE k LIKE 'wl:%'").all()).results) if (r.v.split("|")[2] < old) await env.DB.prepare("DELETE FROM settings WHERE k=?").bind(r.k).run();
    if ((await env.DB.prepare("SELECT COUNT(*) AS n FROM settings WHERE k LIKE 'wl:%'").first()).n > 300) return json({error:"Слишком много попыток входа, попробуй через пару минут"}, 429);
    const id = rnd(16), secret = rnd(32), code = String(1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 9000);
    await env.DB.prepare("INSERT INTO settings(k,v) VALUES(?,?)").bind(`wl:${id}`, `pending|${code}|${new Date().toISOString()}|${await sha256hex(secret)}|`).run();
    return json({id, secret, code, bot: await botUsername(env), ttl: WL_TTL});
  }
  if (path === "/api/web/login/claim" && req.method === "POST") {
    const w = await wlRow(env, body.id);
    if (!w || w.secretHash !== await sha256hex(String(body.secret || ""))) return json({error:"Заявка на вход устарела — начни заново"}, 410);
    if (w.state !== "ok") return json({pending:true});
    await env.DB.prepare("DELETE FROM settings WHERE k=?").bind(`wl:${body.id}`).run();
    return json({token:w.token});
  }
  return json({error:"not found"}, 404);
}
// в боте: /start wl_<id> — показать код и спросить; кнопка wl:<id> — подтвердить
async function wlAsk(env, uid, id, say){
  const w = await wlRow(env, id);
  if (!w || w.state !== "pending") return say("Эта заявка на вход устарела. Нажми «Войти через Telegram» в приложении ещё раз.");
  return say(`🔐 <b>Вход в приложение на телефоне</b>\n\nКод на экране приложения: <b>${w.code}</b>\n\nПодтверждай, только если ты сам только что нажал «Войти через Telegram» и код совпадает. Если нет — просто игнорируй это сообщение.`,
    {reply_markup:{inline_keyboard:[[{text:`✅ Войти (код ${w.code})`, callback_data:`wl:${id}`}]]}});
}
async function onWebLoginCallback(env, cq){
  const id = cq.data.slice(3), w = await wlRow(env, id);
  const answer = text => tg(env, "answerCallbackQuery", {callback_query_id:cq.id, _uid:cq.from.id, text});
  if (!w || w.state !== "pending") return answer("Заявка устарела — начни вход заново");
  const token = new URL(await webLink(env, cq.from)).searchParams.get("k");
  await env.DB.prepare("UPDATE settings SET v=? WHERE k=?").bind(`ok|${w.code}|${w.at}|${w.secretHash}|${token}`, `wl:${id}`).run();
  await answer("Готово");
  if (cq.message) await tg(env, "editMessageText", {chat_id:cq.message.chat.id, message_id:cq.message.message_id, parse_mode:"HTML",
    text:"✅ <b>Вход подтверждён.</b> Вернись в приложение — оно откроется само.\n\nОтключить вход на всех устройствах: Настройки → «На главный экран» → «Отключить все мои ссылки»."});
}
// Манифест PWA: start_url несёт личную ссылку — на iPhone приложение с главного экрана живёт отдельно от Safari
// и иначе открылось бы без входа. Название — на языке интерфейса.
function manifest(url){
  const k = WEB_TOKEN.test(url.searchParams.get("k") || "") ? url.searchParams.get("k") : "", uk = url.searchParams.get("l") !== "ru";
  return new Response(JSON.stringify({
    name: uk ? "Перший рік" : "Первый год", short_name: uk ? "Перший рік" : "Первый год",
    description: uk ? "Рутина, поради й нагадування на перший рік малюка" : "Рутина, советы и напоминания на первый год малыша",
    lang: uk ? "uk" : "ru", start_url: k ? `/?k=${k}&pwa=1` : "/?pwa=1", scope: "/", id: "/", display: "standalone",
    background_color: "#FBF6F1", theme_color: "#FBF6F1",
    icons: [{src:"/icons/icon-192.png", sizes:"192x192", type:"image/png", purpose:"any"}, {src:"/icons/icon-512.png", sizes:"512x512", type:"image/png", purpose:"any"},
            {src:"/icons/maskable-512.png", sizes:"512x512", type:"image/png", purpose:"maskable"}],
  }), {headers:{"content-type":"application/manifest+json; charset=utf-8", "cache-control":"no-cache"}});
}

// ---------- API мини-приложения ----------
async function authUser(env, req){
  const wt = req.headers.get("x-web-token");
  if (wt && !req.headers.get("x-init-data")) return webUser(env, wt);
  if (env.DEV === "1" && !req.headers.get("x-init-data")) {
    const id = Number(req.headers.get("x-dev-user") || 1);
    return {id, first_name: decodeURIComponent(req.headers.get("x-dev-name") || "Dev")};
  }
  return verifyInitData(req.headers.get("x-init-data"), env.BOT_TOKEN);
}
function readChild(x){
  const name = cleanName(x?.name) || null, birth = isoOrNull(x?.birth), due = birth ? null : isoOrNull(x?.due);
  const sex = x?.sex === "girl" || x?.sex === "boy" ? x.sex : null;
  return {name, birth, due, sex};
}

async function api(env, req, path){
  const user = await authUser(env, req);
  if (!user) return json({error:"Открой приложение из Telegram-бота."}, 403);
  if (path !== "/api/events") await seen(env, user, req.headers.get("x-web-token") ? "web" : "app");
  const me = await getMember(env, user.id);
  const body = req.method === "POST" && path !== "/api/export/pdf" ? await req.json().catch(() => ({})) : null;
  if (path.startsWith("/api/admin/")) return adminApi(env, req, path, body, user);
  const today = todayKyiv();

  if (path === "/api/lang" && req.method === "POST") {   // язык интерфейса и сообщений бота; работает и до онбординга
    const lang = LANG_IDS.includes(body.lang) ? body.lang : DEFAULT_LANG;
    await env.DB.prepare("INSERT OR REPLACE INTO user_lang(user_id, lang) VALUES(?,?)").bind(user.id, lang).run();
    forgetLang(user.id);
    return json({ok:true, lang});
  }
  if (path === "/api/gate/check" && req.method === "POST") return json(await gateCheck(env, user.id));
  // по утёкшей ссылке нельзя выпустить новые и вытеснить ими настоящие
  if (path === "/api/web/link" && req.method === "POST") return req.headers.get("x-web-token") ? json({error:"Ссылку можно получить только в Telegram"}, 403) : json({url:await webLink(env, user)});
  if (path === "/api/web/revoke" && req.method === "POST") {
    for (const r of await myWebLinks(env, user.id)) await env.DB.prepare("DELETE FROM settings WHERE k=?").bind(r.k).run();
    return json({ok:true});
  }
  // до проверки семьи (пишут и без неё) и до /api/feed*: "/api/feedback" тоже начинается с "/api/feed"
  if (path.startsWith("/api/feedback") && req.method === "POST") return feedbackApi(env, path, body || {}, user, me);
  if (path === "/api/onboard" && req.method === "POST") {
    if (me) return json({error:"Семья уже создана"}, 409);
    const gs = await gateStatus(env, user.id);
    if (gs.required && !gs.passed && !(await gateCheck(env, user.id)).ok) return json({error:"Сначала подпишитесь на канал", gate:true}, 403);
    const kids = (Array.isArray(body.children) ? body.children : []).slice(0, MAX_CHILDREN).map(readChild);
    if (!kids.length) return json({error:"Нужен хотя бы один ребёнок"}, 400);
    if (kids.some(k => k.birth && k.birth > today)) return json({error:"Дата рождения в будущем. Если малыш ещё не родился, выбери «Ждём малыша»."}, 400);
    const color = COLORS.some(c => c.id === body.color) ? body.color : COLORS[0].id;
    const mods = readModules(body.modules), role = ROLES.includes(body.role) ? body.role : null;
    const fam = await env.DB.prepare("INSERT INTO families(last_daily,created,modules) VALUES(NULL,?,?)").bind(Date.now(), JSON.stringify(mods)).run();
    const fid = fam.meta.last_row_id;
    for (const k of kids) {
      const m = birthMarks(k.birth, today);
      const r = await env.DB.prepare("INSERT INTO children(family_id,name,birth,due,sex,last_week,last_month,created) VALUES(?,?,?,?,?,?,?,?)")
        .bind(fid, k.name, k.birth, k.due, k.sex, m.last_week, m.last_month, Date.now()).run();
      await syncVaccines(env, fid, r.meta.last_row_id, k.birth);
      if (body.past_done && k.birth && mods.vaccines)   // «прививки до сегодня сделаны по календарю» — без стены красного
        await env.DB.prepare(`UPDATE vaccines SET status='done', by_user=?, at=? WHERE child_id=? AND status IN ('planned','booked') AND planned < ? AND code IN (${MUST.map(() => "?").join(",")})`)
          .bind(user.id, Date.now(), r.meta.last_row_id, today, ...MUST).run();
    }
    await env.DB.prepare("INSERT INTO members(user_id,family_id,name,color,role,owner,created) VALUES(?,?,?,?,?,1,?)")
      .bind(user.id, fid, cleanName(body.my_name) || cleanName(user.first_name) || "Родитель", color, role, Date.now()).run();
    return json({ok:true});
  }
  const myLang = (await env.DB.prepare("SELECT lang FROM user_lang WHERE user_id=?").bind(user.id).first())?.lang || null;
  if (!me) return json({onboarding:true, today, suggestedName:user.first_name || "", gate:await gateStatus(env, user.id), lang:myLang});
  const fid = me.family_id;
  const ownChild = async id => (await env.DB.prepare("SELECT * FROM children WHERE id=? AND family_id=?").bind(id, fid).first());
  if (path.startsWith("/api/feed") && req.method === "POST") return feedApi(env, path, body, user, fid);
  if (path.startsWith("/api/sleep/") && req.method === "POST") return sleepApi(env, path, body, user, fid);

  if (path === "/api/state" && req.method === "GET") {
    const since = new Date(Date.parse(today) - DAYS_LOADED*864e5).toISOString().slice(0,10);
    const r = await env.DB.prepare(`SELECT id, val, by_user, at FROM checks WHERE family_id=? AND val>0
      AND (instr(id, ':d:') = 0 OR substr(id, instr(id, ':d:') + 3, 10) >= ?)`).bind(fid, since).all();
    const checks = {}; for (const x of r.results) checks[x.id] = {by:x.by_user, at:x.at, val:x.val};
    // календарь рутины: сколько отмечено по дням у каждого ребёнка (одним запросом, за всё время)
    const days = await env.DB.prepare(`SELECT substr(id, 1, instr(id, ':d:') - 1) AS c, substr(id, instr(id, ':d:') + 3, 10) AS d, COUNT(*) AS n
      FROM checks WHERE family_id=? AND val>0 AND instr(id, ':d:') > 0 GROUP BY c, d`).bind(fid).all();
    const routineDays = {}; for (const x of days.results) (routineDays[x.c] ||= {})[x.d] = x.n;
    const kids = await familyChildren(env, fid);
    let vaccines = await familyVaccines(env, fid);
    if (await ensureVaccines(env, fid, kids, vaccines)) vaccines = await familyVaccines(env, fid);
    const children = kids.map(({id,name,birth,due,sex}) => ({id,name,birth,due,sex}));
    const measures = (await env.DB.prepare("SELECT id, child_id, date, weight_g, length_cm, by_user FROM measurements WHERE family_id=? ORDER BY date").bind(fid).all()).results;
    const feeds = await familyFeeds(env, fid, Date.now() - 31 * 864e5), sleeps = await familySleeps(env, fid, Date.now() - 31 * 864e5);
    const famRow = await env.DB.prepare("SELECT modules, routine FROM families WHERE id=?").bind(fid).first();
    return json({today, now:Date.now(), children, members:await familyMembers(env, fid), me:user.id, owner:!!me.owner, role:me.role || null, modules:modulesOf(famRow), routine:routineCfg(famRow), tip:await familyTip(env, fid, children, today), lang:myLang, checks, since, routineDays, vaccines, measures, feeds, sleeps, prefs:{morning:!(await morningOff(env, user.id))}, ...(isAdmin(env, user.id) ? {admin:true} : {})});
  }
  if (path === "/api/day" && req.method === "GET") {        // отметки рутины за один старый день (календарь)
    const date = isoOrNull(new URL(req.url).searchParams.get("date")); if (!realDay(date)) return json({error:"bad date"}, 400);
    const r = await env.DB.prepare("SELECT id, val, by_user, at FROM checks WHERE family_id=? AND val>0 AND id LIKE ?").bind(fid, `c%:d:${date}:%`).all();
    const checks = {}; for (const x of r.results) checks[x.id] = {by:x.by_user, at:x.at, val:x.val};
    return json({date, checks});
  }
  if (path === "/api/check" && req.method === "POST") {
    const {id, val} = body;
    if (typeof id !== "string" || !CHECK_ID.test(id)) return json({error:"bad id"}, 400);
    const cid = id.match(/^c(\d+):/)?.[1];
    const child = cid ? await ownChild(Number(cid)) : null;
    if (cid && !child) return json({error:"not your child"}, 403);
    if (id.startsWith("b:") && id.includes(":d:")) return json({error:"bad id"}, 400);
    const day = cid ? dayOfCheck(id) : null;   // рутина: прошлые дни можно, будущее — не дальше завтра (часовые пояса)
    if (day && (!realDay(day) || daysBetween(today, day) > 1 || (child.birth && day < child.birth))) return json({error:"bad day"}, 400);
    if (personal(id) && noticeUser(id) !== Number(user.id)) return json({error:"not yours"}, 403);
    const v = val === 2 ? 2 : val ? 1 : 0;
    if (v === 2 && !id.startsWith("o:")) return json({error:"val 2 only for things"}, 400);   // «не нужно» — только у вещей
    await env.DB.prepare("INSERT INTO checks(family_id,id,val,by_user,at) VALUES(?,?,?,?,?) ON CONFLICT(family_id,id) DO UPDATE SET val=excluded.val, by_user=excluded.by_user, at=excluded.at")
      .bind(fid, id, v, user.id, Date.now()).run();
    return json({ok:true});
  }
  if (path === "/api/me" && req.method === "POST") {
    const name = cleanName(body.name) || me.name;
    const color = COLORS.some(c => c.id === body.color) ? body.color : me.color;
    const taken = (await familyMembers(env, fid)).some(m => m.user_id !== user.id && m.color === color);
    if (taken) return json({error:"Этот цвет уже у второго родителя"}, 409);
    const role = ROLES.includes(body.role) ? body.role : me.role;
    await env.DB.prepare("UPDATE members SET name=?, color=?, role=? WHERE user_id=?").bind(name, color, role, user.id).run();
    return json({ok:true});
  }
  if (path === "/api/member/color" && req.method === "POST") {   // поменять цвет второму родителю (только в своей семье)
    const fam = await familyMembers(env, fid), m = fam.find(x => x.user_id === Number(body.user_id));
    if (!m) return json({error:"not in your family"}, 403);
    if (!COLORS.some(c => c.id === body.color)) return json({error:"bad color"}, 400);
    if (fam.some(x => x.user_id !== m.user_id && x.color === body.color)) return json({error:"Этот цвет уже занят"}, 409);
    await env.DB.prepare("UPDATE members SET color=? WHERE user_id=?").bind(body.color, m.user_id).run();
    return json({ok:true});
  }
  if (path === "/api/child" && req.method === "POST") {      // создать или изменить ребёнка
    const k = readChild(body);
    if (k.birth && k.birth > today) return json({error:"Дата рождения в будущем"}, 400);
    if (body.id) {
      const old = await ownChild(Number(body.id)); if (!old) return json({error:"not found"}, 404);
      const m = old.birth === k.birth ? {last_week:old.last_week, last_month:old.last_month} : birthMarks(k.birth, today);
      const sex = body.sex === undefined ? old.sex : k.sex;
      await env.DB.prepare("UPDATE children SET name=?, birth=?, due=?, sex=?, last_week=?, last_month=? WHERE id=?")
        .bind(k.name, k.birth, k.due, sex, m.last_week, m.last_month, old.id).run();
      if (k.birth !== old.birth) await syncVaccines(env, fid, old.id, k.birth, true);
    } else {
      if ((await familyChildren(env, fid)).length >= MAX_CHILDREN) return json({error:`Не больше ${MAX_CHILDREN} детей`}, 400);
      const m = birthMarks(k.birth, today);
      const r = await env.DB.prepare("INSERT INTO children(family_id,name,birth,due,sex,last_week,last_month,created) VALUES(?,?,?,?,?,?,?,?)")
        .bind(fid, k.name, k.birth, k.due, k.sex, m.last_week, m.last_month, Date.now()).run();
      await syncVaccines(env, fid, r.meta.last_row_id, k.birth);
    }
    return json({ok:true});
  }
  if (path === "/api/measure" && req.method === "POST") {      // замер веса (и роста)
    const c = await ownChild(Number(body.child_id)); if (!c) return json({error:"not your child"}, 403);
    const date = isoOrNull(body.date) || today, kg = Number(String(body.weight_kg ?? "").replace(",", "."));
    const len = body.length_cm === "" || body.length_cm == null ? null : Number(String(body.length_cm).replace(",", "."));
    if (!(kg >= 1 && kg <= 25)) return json({error:"Вес в килограммах, например 5,2"}, 400);
    if (len !== null && !(len >= 30 && len <= 120)) return json({error:"Рост в сантиметрах, например 58"}, 400);
    if (date > today || (c.birth && date < c.birth)) return json({error:"Дата замера вне жизни ребёнка"}, 400);
    await env.DB.prepare("INSERT INTO measurements(family_id,child_id,date,weight_g,length_cm,by_user,at) VALUES(?,?,?,?,?,?,?)")
      .bind(fid, c.id, date, Math.round(kg * 1000), len, user.id, Date.now()).run();
    return json({ok:true});
  }
  if (path === "/api/measure/delete" && req.method === "POST") {
    await env.DB.prepare("DELETE FROM measurements WHERE id=? AND family_id=?").bind(Number(body.id), fid).run();
    return json({ok:true});
  }
  if (path === "/api/child/delete" && req.method === "POST") {
    const kids = await familyChildren(env, fid);
    if (kids.length < 2) return json({error:"Нельзя удалить единственного ребёнка"}, 400);
    const c = await ownChild(Number(body.id)); if (!c) return json({error:"not found"}, 404);
    await env.DB.prepare("DELETE FROM checks WHERE family_id=? AND id LIKE ?").bind(fid, `c${c.id}:%`).run();
    await env.DB.prepare("DELETE FROM vaccines WHERE family_id=? AND child_id=?").bind(fid, c.id).run();
    await env.DB.prepare("DELETE FROM measurements WHERE family_id=? AND child_id=?").bind(fid, c.id).run();
    await env.DB.prepare("DELETE FROM children WHERE id=?").bind(c.id).run();
    return json({ok:true});
  }
  if (path === "/api/vaccine" && req.method === "POST") {    // создать свою запись или изменить любую
    const f = {};
    if ("name" in body) f.name = cleanText(body.name, 80);
    if ("planned" in body) f.planned = isoOrNull(body.planned);
    if ("status" in body) { if (!VSTAT.includes(body.status)) return json({error:"bad status"}, 400); f.status = body.status; }
    if ("booked_at" in body) f.booked_at = dtOrNull(body.booked_at);
    if ("done_date" in body) f.done_date = isoOrNull(body.done_date);
    if ("note" in body) f.note = cleanText(body.note, 300) || null;
    if (f.done_date && f.done_date > today) return json({error:"Дата прививки в будущем"}, 400);
    if (f.status === "done" && !("done_date" in body)) f.done_date = today;
    if (body.id) {
      const v = await env.DB.prepare("SELECT * FROM vaccines WHERE id=? AND family_id=?").bind(Number(body.id), fid).first();
      if (!v) return json({error:"not found"}, 404);
      if (v.code) delete f.name;                                   // название из календаря не меняем
      if (f.name === "") return json({error:"Нужно название"}, 400);
      const keys = Object.keys(f);
      if (keys.length) await env.DB.prepare(`UPDATE vaccines SET ${keys.map(k => k + "=?").join(", ")}, by_user=?, at=? WHERE id=?`)
        .bind(...keys.map(k => f[k]), user.id, Date.now(), v.id).run();
      return json({ok:true, vaccine:await env.DB.prepare("SELECT * FROM vaccines WHERE id=?").bind(v.id).first()});
    }
    const c = await ownChild(Number(body.child_id)); if (!c) return json({error:"not your child"}, 403);
    if (!f.name) return json({error:"Нужно название"}, 400);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM vaccines WHERE child_id=? AND code IS NULL").bind(c.id).first();
    if (n.n >= 60) return json({error:"Слишком много своих записей"}, 400);
    if (f.status === "skip") f.status = "planned";
    const r = await env.DB.prepare("INSERT INTO vaccines(family_id,child_id,code,name,planned,status,booked_at,done_date,note,by_user,at) VALUES(?,?,NULL,?,?,?,?,?,?,?,?)")
      .bind(fid, c.id, f.name, f.planned ?? null, f.status || "planned", f.booked_at ?? null, f.done_date ?? null, f.note ?? null, user.id, Date.now()).run();
    return json({ok:true, vaccine:await env.DB.prepare("SELECT * FROM vaccines WHERE id=?").bind(r.meta.last_row_id).first()});
  }
  if (path === "/api/vaccine/delete" && req.method === "POST") { // только свои записи, календарные не удаляются
    const r = await env.DB.prepare("DELETE FROM vaccines WHERE id=? AND family_id=? AND code IS NULL").bind(Number(body.id), fid).run();
    return r.meta.changes ? json({ok:true}) : json({error:"Удалить можно только свою запись"}, 400);
  }
  if (path === "/api/vaccines/past-done" && req.method === "POST") {  // «всё прошедшее по календарю уже сделано»
    const c = await ownChild(Number(body.child_id)); if (!c) return json({error:"not your child"}, 403);
    const r = await env.DB.prepare(`UPDATE vaccines SET status='done', by_user=?, at=? WHERE family_id=? AND child_id=? AND status IN ('planned','booked')
      AND planned < ? AND code IN (${MUST.map(() => "?").join(",")})`).bind(user.id, Date.now(), fid, c.id, today, ...MUST).run();
    return json({ok:true, changed:r.meta.changes});
  }
  if (path === "/api/export" && req.method === "GET") {       // скачать JSON напрямую (запасной путь вне Telegram)
    return new Response(JSON.stringify(await familyExport(env, fid)), {headers:{"content-type":"application/json; charset=utf-8",
      "content-disposition":`attachment; filename="first-year-${today}.json"`}});
  }
  if (path === "/api/export" && req.method === "POST") {      // JSON-копия документом в чат с ботом
    const r = await sendExport(env, user.id, fid, today);
    return r.ok ? json({ok:true}) : json({error:"Telegram не принял файл: " + (r.description || "ошибка")}, 502);
  }
  if (path === "/api/export/pdf" && req.method === "POST") {  // PDF собирается в приложении, бот пересылает его в чат
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 8e6) return json({error:"Файл слишком большой"}, 413);
    if (new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(5, buf.byteLength))) !== "%PDF-") return json({error:"Это не PDF"}, 400);
    const r = await tgDocument(env, {chat_id:user.id, caption:"Сводка «Первый год» в PDF: прививки, задания по неделям, покупки."}, buf, `first-year-${today}.pdf`, "application/pdf");
    return r.ok ? json({ok:true}) : json({error:"Telegram не принял файл: " + (r.description || "ошибка")}, 502);
  }
  if (path === "/api/import" && req.method === "POST") {      // восстановить из копии: слить отметки и прививки
    const d = body?.data ?? body;
    if (d?.app !== "first-year" || d.version !== 1 || !Array.isArray(d.children)) return json({error:"Это не копия данных «Первый год»"}, 400);
    const kids = await familyChildren(env, fid);
    await ensureVaccines(env, fid, kids, await familyVaccines(env, fid));
    const map = mapChildren(d.children.filter(b => Number.isInteger(Number(b?.id))).slice(0, 8), kids);
    const num = x => x !== null && x !== "" && Number.isFinite(Number(x)) ? Number(x) : null;
    const checks = [];
    for (const x of (Array.isArray(d.checks) ? d.checks : []).slice(0, 50000)) {
      if (typeof x?.id !== "string" || !CHECK_ID.test(x.id)) continue;
      { const d0 = dayOfCheck(x.id); if (d0 && (!realDay(d0) || daysBetween(today, d0) > 1)) continue; }
      if (x.id.startsWith("b:") && x.id.includes(":d:")) continue;
      const m = x.id.match(/^c(\d+):/);
      const id = m ? (map.has(Number(m[1])) ? `c${map.get(Number(m[1]))}:${x.id.slice(m[0].length)}` : null) : x.id;
      if (id && personal(id) && noticeUser(id) !== Number(user.id)) continue;   // прочитанное и закладки — только свои
      if (id) checks.push({id, val:x.val === 2 && id.startsWith("o:") ? 2 : 1, by:num(x.by), at:num(x.at) || Date.now()});
    }
    const codes = new Set(VACCINES.map(v => v.code)), coded = [], own = [];
    for (const v of (Array.isArray(d.vaccines) ? d.vaccines : []).slice(0, 500)) {
      const child = map.get(Number(v?.child_id)); if (!child || !VSTAT.includes(v.status)) continue;
      const row = {child, code:v.code ?? null, name:cleanText(v.name, 80), planned:isoOrNull(v.planned), status:v.status, booked_at:dtOrNull(v.booked_at),
        done_date:isoOrNull(v.done_date), note:cleanText(v.note, 300) || null, by:num(v.by), at:num(v.at) || 0};
      if (row.code === null) { if (row.name) own.push(row); } else if (codes.has(row.code)) coded.push(row);
    }
    const col = k => `json_extract(value,'$.${k}')`;
    const [rc, rv, ro] = await env.DB.batch([
      env.DB.prepare(`INSERT INTO checks(family_id,id,val,by_user,at) SELECT ?, ${col("id")}, ${col("val")}, ${col("by")}, ${col("at")} FROM json_each(?) WHERE true
        ON CONFLICT(family_id,id) DO UPDATE SET val=excluded.val, by_user=excluded.by_user, at=excluded.at WHERE checks.val=0 AND excluded.at > COALESCE(checks.at,0)`).bind(fid, JSON.stringify(checks)),
      env.DB.prepare(`INSERT INTO vaccines(family_id,child_id,code,name,planned,status,booked_at,done_date,note,by_user,at)
        SELECT ?, ${["child","code","name","planned","status","booked_at","done_date","note","by","at"].map(col).join(", ")} FROM json_each(?) WHERE true
        ON CONFLICT(child_id,code) DO UPDATE SET status=excluded.status, booked_at=excluded.booked_at, done_date=excluded.done_date, note=excluded.note,
          by_user=excluded.by_user, at=excluded.at WHERE excluded.at > COALESCE(vaccines.at,0)`).bind(fid, JSON.stringify(coded)),
      env.DB.prepare(`INSERT INTO vaccines(family_id,child_id,code,name,planned,status,booked_at,done_date,note,by_user,at)
        SELECT ?, ${["child","code","name","planned","status","booked_at","done_date","note","by","at"].map(col).join(", ")} FROM json_each(?) WHERE NOT EXISTS (
          SELECT 1 FROM vaccines v WHERE v.child_id=json_extract(value,'$.child') AND v.code IS NULL AND v.name=json_extract(value,'$.name')
          AND COALESCE(v.planned,'')=COALESCE(json_extract(value,'$.planned'),''))`).bind(fid, JSON.stringify(own))]);
    return json({ok:true, children:map.size, checks:rc.meta.changes, vaccines:rv.meta.changes + ro.meta.changes});
  }
  if (path === "/api/routine" && req.method === "POST") {
    const cfg = cleanRoutineCfg(body);
    await env.DB.prepare("UPDATE families SET routine=? WHERE id=?").bind(JSON.stringify(cfg), fid).run();
    return json({ok:true, routine:cfg});
  }
  if (path === "/api/prefs" && req.method === "POST") {   // личные настройки уведомлений
    if (body.morning === false) await env.DB.prepare("INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)").bind(MORNING_OFF(user.id), "1").run();
    if (body.morning === true) await env.DB.prepare("DELETE FROM settings WHERE k=?").bind(MORNING_OFF(user.id)).run();
    return json({ok:true});
  }
  if (path === "/api/modules" && req.method === "POST") {
    await env.DB.prepare("UPDATE families SET modules=? WHERE id=?").bind(JSON.stringify(readModules(body)), fid).run();
    return json({ok:true});
  }
  if (path === "/api/invite" && req.method === "POST") {
    if (!me.owner) return json({error:"Пригласить может только основной родитель"}, 403);
    if ((await familyMembers(env, fid)).length >= MAX_MEMBERS) return json({error:"В семье уже двое родителей"}, 409);
    return json({link:await newInvite(env, fid)});
  }
  return json({error:"not found"}, 404);
}

// ---------- админка (public/admin.html): только ADMIN_IDS ----------
const isAdmin = (env, uid) => adminIds(env).includes(Number(uid));
const INVITE_TTL = 14 * 864e5;
async function newInvite(env, fid){
  const code = [...crypto.getRandomValues(new Uint8Array(9))].map(b => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  await env.DB.prepare("INSERT INTO invites(code,family_id,created) VALUES(?,?,?)").bind(code, fid, Date.now()).run();
  const bot = await botUsername(env);
  return bot ? `https://t.me/${bot}?start=inv_${code}` : `inv_${code}`;
}
async function adminApi(env, req, path, body, user){
  if (!isAdmin(env, user.id)) return json({error:"Только для администратора"}, 403);
  const q = new URL(req.url).searchParams, now = Date.now(), wk = now - 7 * 864e5;
  const all = async (sql, ...p) => (await env.DB.prepare(sql).bind(...p).all()).results;
  const byFam = rows => Object.fromEntries(rows.map(r => [r.family_id, r.n]));
  if (path === "/api/admin/users" && req.method === "GET") {
    const users = await all(`SELECT u.user_id, u.first_name, u.last_name, u.username, u.first_seen, u.last_seen, u.src,
        m.family_id, m.name AS member_name, m.role, m.owner, l.lang, g.ok_at AS gate_at
      FROM users u LEFT JOIN members m ON m.user_id=u.user_id LEFT JOIN user_lang l ON l.user_id=u.user_id LEFT JOIN gate g ON g.user_id=u.user_id
      ORDER BY COALESCE(u.first_seen, 0) DESC, u.user_id DESC LIMIT 2000`);
    const kids = await all("SELECT family_id, name, birth, due, sex FROM children ORDER BY id");
    const mem = await all("SELECT m.family_id, m.user_id, m.name, m.owner, u.username FROM members m LEFT JOIN users u ON u.user_id=m.user_id ORDER BY m.created");
    const feeds = byFam(await all("SELECT family_id, COUNT(*) n FROM feedings WHERE start_at > ? GROUP BY family_id", wk));
    const sleeps = byFam(await all("SELECT family_id, COUNT(*) n FROM sleeps WHERE start_at > ? GROUP BY family_id", wk));
    const checks = byFam(await all("SELECT family_id, COUNT(*) n FROM checks WHERE val > 0 AND at > ? AND id NOT LIKE 'n:%' GROUP BY family_id", wk));
    const fb = Object.fromEntries((await all("SELECT user_id, COUNT(*) n FROM feedback GROUP BY user_id")).map(r => [r.user_id, r.n]));
    const fbNew = (await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status='new'").first())?.n || 0;
    return json({now, fbNew, families:new Set(mem.map(m => m.family_id)).size, users:users.map(u => ({...u,
      kids:u.family_id ? kids.filter(k => k.family_id === u.family_id).map(({name, birth, due, sex}) => ({name, birth, due, sex})) : [],
      parents:u.family_id ? mem.filter(m => m.family_id === u.family_id).length : 0,
      partner:u.family_id ? mem.find(m => m.family_id === u.family_id && m.user_id !== u.user_id) || null : null,
      week:u.family_id ? {feeds:feeds[u.family_id] || 0, sleeps:sleeps[u.family_id] || 0, checks:checks[u.family_id] || 0} : null,
      fb:fb[u.user_id] || 0}))});
  }
  if (path === "/api/admin/user" && req.method === "GET") {
    const id = Number(q.get("id"));
    const u = await env.DB.prepare(`SELECT u.*, l.lang, g.ok_at AS gate_at FROM users u LEFT JOIN user_lang l ON l.user_id=u.user_id LEFT JOIN gate g ON g.user_id=u.user_id WHERE u.user_id=?`).bind(id).first();
    const m = await getMember(env, id);
    if (!u && !m) return json({error:"Нет такого пользователя"}, 404);
    let family = null;
    if (m) {
      const fid = m.family_id, fam = await env.DB.prepare("SELECT * FROM families WHERE id=?").bind(fid).first();
      family = {id:fid, created:fam?.created, modules:modulesOf(fam), routine:routineCfg(fam),
        members:await all(`SELECT m.user_id, m.name, m.role, m.owner, m.color, m.created, u.username, u.first_name, u.last_seen FROM members m LEFT JOIN users u ON u.user_id=m.user_id WHERE m.family_id=? ORDER BY m.created`, fid),
        children:(await familyChildren(env, fid)).map(({id, name, birth, due, sex, created}) => ({id, name, birth, due, sex, created})),
        invites:await all("SELECT created FROM invites WHERE family_id=? AND created > ? ORDER BY created DESC", fid, now - INVITE_TTL),
        checks:await all("SELECT id, val, by_user, at FROM checks WHERE family_id=? AND val > 0 AND id NOT LIKE 'n:%' ORDER BY at DESC LIMIT 80", fid),
        checkDays:await all(`SELECT substr(id, instr(id, ':d:') + 3, 10) AS d, COUNT(*) AS n FROM checks WHERE family_id=? AND val > 0 AND instr(id, ':d:') > 0 GROUP BY d ORDER BY d DESC LIMIT 21`, fid),
        totals:{checks:(await env.DB.prepare("SELECT COUNT(*) AS n FROM checks WHERE family_id=? AND val > 0 AND id NOT LIKE 'n:%'").bind(fid).first()).n,
          feeds:(await env.DB.prepare("SELECT COUNT(*) AS n FROM feedings WHERE family_id=?").bind(fid).first()).n,
          sleeps:(await env.DB.prepare("SELECT COUNT(*) AS n FROM sleeps WHERE family_id=?").bind(fid).first()).n},
        feeds:await all("SELECT child_id, side, start_at, end_at, pause_ms, by_user FROM feedings WHERE family_id=? ORDER BY start_at DESC LIMIT 15", fid),
        sleeps:await all("SELECT child_id, start_at, end_at, by_user FROM sleeps WHERE family_id=? ORDER BY start_at DESC LIMIT 15", fid),
        measures:await all("SELECT child_id, date, weight_g, length_cm FROM measurements WHERE family_id=? ORDER BY date DESC LIMIT 10", fid),
        vaccines:await all("SELECT status, COUNT(*) AS n FROM vaccines WHERE family_id=? GROUP BY status", fid)};
    }
    const feedback = await all(`SELECT * FROM feedback WHERE user_id=? ${m ? "OR family_id=?" : ""} ORDER BY created DESC`, ...(m ? [id, m.family_id] : [id]));
    return json({now, user:u || {user_id:id}, member:m, family, feedback, max:MAX_MEMBERS});
  }
  if (path === "/api/admin/invite" && req.method === "POST") {   // за основного родителя: у них не вышло пригласить
    const fid = Number(body?.family_id);
    const owner = await env.DB.prepare("SELECT user_id FROM members WHERE family_id=? ORDER BY owner DESC, created LIMIT 1").bind(fid).first();
    if (!owner) return json({error:"Нет такой семьи"}, 404);
    if ((await familyMembers(env, fid)).length >= MAX_MEMBERS) return json({error:"В семье уже двое родителей"}, 409);
    const link = await newInvite(env, fid);
    if (body?.send) await tg(env, "sendMessage", {chat_id:owner.user_id, text:`🔗 Ссылка-приглашение для второго родителя — перешли её партнёру. Действует 14 дней.\n\n${link}`});
    return json({ok:true, link, sent:!!body?.send});
  }
  if (path === "/api/admin/feedback" && req.method === "GET") {
    return json({now, items:await all(`SELECT f.*, m.name AS member_name, u.first_name, u.username,
        (SELECT COUNT(*) FROM feedback_history h WHERE h.feedback_id=f.id) AS edits
      FROM feedback f LEFT JOIN members m ON m.user_id=f.user_id LEFT JOIN users u ON u.user_id=f.user_id ORDER BY f.created DESC, f.id DESC LIMIT 500`)});
  }
  if (path === "/api/admin/feedback" && req.method === "POST") {
    const f = await env.DB.prepare("SELECT * FROM feedback WHERE id=?").bind(Number(body?.id)).first();
    if (!f) return json({error:"Сообщение не найдено: возможно, его удалили"}, 404);
    if (body.act === "like") await fbLike(env, f);
    else if (body.act === "seen" || body.act === "done") await fbStatus(env, f, body.act);
    else if (body.act === "reply") { const t = cleanText(body.text, 2000); if (!t) return json({error:"Пустой ответ"}, 400); await fbSaveReply(env, f, t); }
    else return json({error:"Неизвестное действие"}, 400);
    return json({ok:true, item:await env.DB.prepare("SELECT * FROM feedback WHERE id=?").bind(f.id).first()});
  }
  return json({error:"not found"}, 404);
}

// ---------- cron ----------
async function daily(env){
  const today = todayKyiv();
  const fams = (await env.DB.prepare("SELECT * FROM families WHERE last_daily IS NULL OR last_daily < ?").bind(today).all()).results;
  for (const fam of fams) {
    try { await dailyForFamily(env, fam, today); } catch (e) { console.error("family", fam.id, e.stack || e); }
  }
}

const BOT_COMMANDS = [
  {command:"sos", description:"Экстренно: первая помощь"},
  {command:"today", description:"Рутина на сегодня"},
  {command:"week", description:"Карточка текущей недели"},
  {command:"card", description:"Карточка недели N"},
  {command:"flags", description:"Красные флаги на сейчас"},
  {command:"vaccines", description:"Прививки: что впереди и что пора сделать"},
  {command:"export", description:"Копия всех данных файлом"},
  {command:"web", description:"Иконка приложения на телефон"},
  {command:"help", description:"Команды и частые вопросы"}];
export default {
  async fetch(req, env){
    const url = new URL(req.url), path = url.pathname;
    try {
      if (path === "/tg" && req.method === "POST") {
        if (req.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) return new Response("forbidden", {status:403});
        const upd = await req.json();
        if (upd.message) await onMessage(env, upd.message);
        if (upd.callback_query) await seen(env, upd.callback_query.from, "bot");
        if (upd.callback_query?.data === "gatecheck") await onGateCallback(env, upd.callback_query);
        else if (upd.callback_query?.data?.startsWith("gear:")) await onGearCallback(env, upd.callback_query);
        else if (upd.callback_query?.data?.startsWith("fb:")) await onFeedbackCallback(env, upd.callback_query);
        else if (upd.callback_query?.data?.startsWith("vac:")) await onVacCallback(env, upd.callback_query);
        else if (upd.callback_query?.data?.startsWith("wl:")) await onWebLoginCallback(env, upd.callback_query);
        else if (upd.callback_query?.data?.startsWith("sleep")) await onSleepCallback(env, upd.callback_query);
        else if (upd.callback_query?.data?.startsWith("lang:")) await onLangCallback(env, upd.callback_query);
        else if (upd.callback_query) await onFeedCallback(env, upd.callback_query);
        return new Response("ok");
      }
      if (path.startsWith("/api/web/login/")) return webLogin(env, req, path);   // до входа — своя проверка по секрету
      if (path.startsWith("/api/")) return api(env, req, path);
      if (path === "/manifest.webmanifest") return manifest(url);
      if (path === "/setup") {
        if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) return new Response("forbidden", {status:403});
        return json({
          webhook: await tg(env, "setWebhook", {url:`${base(env)}/tg`, secret_token:env.WEBHOOK_SECRET, allowed_updates:["message","callback_query"]}),
          commands: await tg(env, "setMyCommands", {commands:BOT_COMMANDS}),
          // админам в их чате — те же команды плюс админка и отзывы
          adminCommands: await Promise.all(adminIds(env).map(id => tg(env, "setMyCommands", {scope:{type:"chat", chat_id:id}, commands:[
            {command:"admin", description:"Админка: пользователи и отзывы"},
            {command:"feedback", description:"Открытые отзывы"},
            ...BOT_COMMANDS]}))),
          menu: await tg(env, "setChatMenuButton", {menu_button:{type:"web_app", text:"Открыть", web_app:{url:`${base(env)}/`}}}),
          bot: await botUsername(env),
        });
      }
      // ручной прогон утренней рассылки (проверка): /run-daily?key=...&family=1[&date=2026-11-10]
      if (path === "/run-daily") {
        if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) return new Response("forbidden", {status:403});
        const fam = await env.DB.prepare("SELECT * FROM families WHERE id=?").bind(Number(url.searchParams.get("family"))).first();
        return json({sent: fam ? await dailyForFamily(env, fam, url.searchParams.get("date") || todayKyiv(), true) : "no family"});
      }
      if (path === "/admin") { const u = new URL(req.url); u.pathname = "/admin.html"; return env.ASSETS.fetch(new Request(u, req)); }   // админка по короткому адресу, доступ — только ADMIN_IDS (проверка в API)
      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error(e.stack || e);
      return json({error:String(e.message || e)}, 500);
    }
  },
  async scheduled(_ev, env, ctx){ ctx.waitUntil(daily(env)); },
  feedTick,
  sleepTick,
  // приложение у человека закрыто (ни одного потока событий) — прислать таймеры идущего кормления и сна
  async appClosed(env, uid){ await feedAwayFor(env, uid); await sleepAwayFor(env, uid); },
  vacTick,
};
