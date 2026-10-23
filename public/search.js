// Поиск по всему содержимому: недели, задания, рутина, покупки, здоровье, «как делать».
import { W, Q, QT, QH, QA, GEAR, GH, GCAT, GEAR_SKIP, ROUTINE, REMIND, RH, RCAT, FLAGS, urgentFor, FIRST_AID } from "./data.js";
import { ANIMS } from "./anim.js";
import { PICT } from "./pict.js";
import { tr } from "./i18n.js";
import { TIP_SECS, ARTICLES } from "./tips.js";
import { SYN, ALIAS } from "./search-syn.js";
import { NOTICES } from "./data.js";
import { FAQ } from "./faq.js";

export const CATS = [
  {id:"all",    name:"Всё"},
  {id:"health", name:"Здоровье"},
  {id:"week",   name:"Недели"},
  {id:"quest",  name:"Задания"},
  {id:"routine",name:"Рутина"},
  {id:"gear",   name:"Вещи"},
  {id:"how",    name:"Как делать"},
  {id:"tips",   name:"Советы"},
  {id:"faq",    name:"Помощь"},
];
export const norm = s => String(s).toLowerCase().replace(/ё/g, "е").replace(/[ʼ’]/g, "'");
// Служебные слова и «ребёнок» во всех формах: «не спит», «на животе», «когда прикорм» не должны матчить всё подряд.
const STOP = new Set("не на по от до за из ли как что когда сколько можно нужно надо при для или это у с к о и а но же ну мой моя наш наша ребенок малыш малышка дочь дочка сын грудничок младенец новорожденный".split(" "));
// Грубое отсечение окончаний: «газики» найдёт «газиках», «температуры» — «температура».
const ENDING = /(ами|ями|ів|їв|ов|ев|ей|ой|ою|ею|ий|ій|ый|ая|ое|ые|ах|ях|ом|ем|і|ї|и|ы|а|я|е|у|ю|о|ь)$/;   // русские и украинские
// Глагольные окончания и -ся/-сь: «просыпается» → «просып», «ползает» → «полз», «давать» → «дава».
const VERB = /(ается|яется|ится|ется|ются|утся|ться|ешь|ишь|ает|яет|ует|ют|ут|ит|ет|ть|ла|ли|ло|ся|сь)$/;
// длинные основы укорачиваем ещё на букву: «зригування» найдёт «зригувань», «срыгивание» — «срыгиваний»
const stem = w => { let s = w.replace(VERB, ""); if (s === w || s.length < 4) s = w.replace(ENDING, ""); return s.length >= 8 ? s.slice(0, -1) : s.length >= 4 ? s : w; };
const WORD = /[^a-zа-яіїєґ0-9']+/;
const words0 = q => norm(q).split(WORD).filter(w => w.length > 1 && !STOP.has(w));
// Каждое слово запроса — группа вариантов: само слово + алиасы (search-syn.js), всё в основах.
const terms = q => words0(q).map(w => [...new Set([w, ...(ALIAS[w] || "").split(" ").filter(Boolean)].map(stem))]);
// Совпадение только с начала слова: «вес» не находит «подвески», «купать» — «покупать».
const tok = s => " " + norm(s).replace(new RegExp(WORD.source, "g"), " ") + " ";
const has = (hay, alts) => alts.some(w => hay.includes(" " + w));

// Совпадение со служебным синонимом (search-syn.js) весит больше заголовка.
// go — куда вести по нажатию: {tab, week?, hint?, sos?, anim?, gear?, skip?, article?, notice?}
function build(){
  const out = [];
  // индекс строится на языке интерфейса: украинский запрос ищет по переведённому тексту
  // и русский исходник тоже: украинский интерфейс находит по русскому запросу
  const add = (cat, title, text, go, meta="", syn="") => { const t0 = title, x0 = text; title = tr(title); text = tr(text); meta = tr(meta);
    const src = t0 !== title ? ` ${t0}` : "";
    out.push({cat, title, text, go, meta, syn: tok(syn), tt: tok(title + src), hay: tok(`${title} ${text} ${syn}${src}${x0 !== text ? " " + x0 : ""}`)}); };
  for (const f of FIRST_AID) add("health", `Первая помощь: ${f.title}`, `${f.when}. ${f.call} ${f.steps.join(" ")}`, {article:`fa:${f.id}`}, "первая помощь", SYN[`fa:${f.id}`]);
  for (const f of FLAGS) add("health", `Красные флаги: ${f.title}`, f.items.join(". "), {tab:"flags"}, "флаги");
  add("health", "Срочно: температура, дыхание, обезвоживание", [...new Set([0,4,8].flatMap(urgentFor))].join(". "), {tab:"flags"}, "срочно", SYN.urgent);
  W.forEach((w, i) => {
    const n = i + 1;
    add("week", `Неделя ${n}: ${w.t}`, `${w.d} ${w.a.join(". ")} ${w.w} ${w.l}`, {tab:"week", week:n}, `неделя ${n}`);
    if (w.m) add("health", `Врач, неделя ${n}`, w.m, {tab:"week", week:n}, `неделя ${n}`);
    Q[i].forEach(([k, x], j) => add("quest", x, QH[i][j], {tab:"week", week:n, quest:j, anims:QA[`${n}:${j}`]}, `${QT[k]} · неделя ${n}`));
  });
  for (const r of ROUTINE) for (const [a, b, x, how] of r.st)
    add("routine", x, `${how}. ${RH[r.id]}`, {tab:"today", routine:r.id, from:a, to:b}, `${RCAT[r.cat].toLowerCase()} · недели ${a}–${b}`);
  for (const r of REMIND) for (const [a, b, x, pts] of r.st)
    add("routine", x, `${pts.join(" ")} ${RH[r.id] || ""}`, {tab:"today"}, `помнить весь день · недели ${a}–${b}`);
  const catName = id => (GCAT.find(c => c.id === id)?.name || "").toLowerCase();
  for (const g of GEAR) add("gear", g.x, [g.cond, GH[g.id], g.warn].filter(Boolean).join(". "), {tab:"orders", gear:g.id}, g.need >= 4 ? `${catName(g.cat)} · нужно к неделе ${g.need}` : catName(g.cat), SYN[`gear:${g.id}`]);
  for (const g of GEAR_SKIP) add("gear", g.x, g.why, {tab:"orders", skip:g.id}, "не покупать");
  for (const n of NOTICES) add("health", n.title, `${n.lead} ${n.items.join(" ")}`, {notice:n.id}, "важное", SYN[`n:${n.id}`]);
  // статьи «Советов», которых нет среди записей выше (недели, рутина, первая помощь, вещи уже проиндексированы); g:* — гайды guides.js
  for (const a of ARTICLES) if (["spurts"].includes(a.id) || a.id.startsWith("g:") || a.sec === "vaccines") add("tips", a.title, a.blocks.map(b => [b.h, b.p, ...(b.ul || []), ...(b.ol || [])].filter(Boolean).join(" ")).join(" "), {article:a.id}, TIP_SECS.find(x => x.id === a.sec)?.name || "", SYN[a.id]);
  // «Вопросы и ответы»: как пользоваться приложением и ботом
  for (const q of FAQ) add("faq", q.q, q.a.map(p => typeof p === "string" ? p : p.ul.join(". ")).join(" "), {faq:q.id}, "вопросы и ответы", SYN[`faq:${q.id}`]);
  for (const [id, a] of Object.entries(ANIMS)) add("how", `Как делать: ${PICT[id].title}`, `${a.steps.join(" ")} ${a.reps}. ${a.safety}`, {anim:id}, "анимация");
  return out;
}
let INDEX = null;
const PRIO = {tips:2, health:1};   // при равном счёте статьи и здоровье выше заданий и недель

// Все слова запроса → иначе нечёткая замена длинных слов (1 правка) → иначе все, кроме одного (для 2+ слов).
// Счёт: за каждое слово 1, +3 если оно в синонимах записи, +3 если в заголовке; +3 за фразу целиком в заголовке.
export function search(q, cat="all"){
  let groups = terms(q);
  if (!groups.length) return [];
  INDEX ||= build();
  const pool = INDEX.filter(e => cat === "all" || e.cat === cat);
  const run = (gs, need) => pool.map(e => { const hit = gs.filter(g => has(e.hay, g)); return hit.length >= need ? {...e, hit} : null; }).filter(Boolean);
  let res = run(groups, groups.length);
  if (!res.length) {
    const fx = groups.map(g => pool.some(e => has(e.hay, g)) ? g : fuzzy(g[0]));
    if (fx.some((g, i) => g !== groups[i])) { groups = fx; res = run(groups, groups.length); }
  }
  if (!res.length && groups.length > 1) res = run(groups, groups.length - 1);
  const raw = norm(q).split(WORD).filter(w => w.length > 1), phrase = raw.map(stem).join(" ");
  const seen = new Set();
  return res
    .map(e => ({...e, score: e.hit.reduce((s, g) => s + 1 + (has(e.syn, g) ? 3 : 0) + (has(e.tt, g) ? 3 : 0), 0) + (e.cat === "health" ? 1 : 0) + (raw.length > 1 && e.tt.includes(" " + phrase) ? 3 : 0)}))
    .sort((a, b) => b.score - a.score || (PRIO[b.cat] ?? 0) - (PRIO[a.cat] ?? 0))
    // одинаковые шаги рутины в разных диапазонах недель — показываем один, с лучшим счётом
    .filter(e => { const k = e.cat + "|" + e.title; return seen.has(k) ? false : seen.add(k); });
}

// Опечатка в длинном слове (≥7 букв основы): ищем в словаре индекса начала слов на расстоянии 1 правки.
let VOC = null;
function fuzzy(w){
  if (w.length < 7) return [w];
  VOC ||= [...new Set(INDEX.flatMap(e => e.hay.split(" ")).filter(x => x.length >= 6))];
  const d = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return 9;
    const m = [...Array(a.length + 1)].map((_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i-1][j] + 1, m[i][j-1] + 1, m[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) m[i][j] = Math.min(m[i][j], m[i-2][j-2] + 1);
    }
    return m[a.length][b.length];
  };
  const c = [...new Set(VOC.map(x => x.slice(0, w.length)))].filter(x => d(w, x) <= 1);
  return c.length ? c.slice(0, 5) : [w];
}

const reEsc = w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Кусок текста вокруг совпадения самого длинного слова запроса (с начала слова), с подсветкой начал слов.
export function snippet(text, q, esc){
  const words = terms(q).flat().sort((a, b) => b.length - a.length);
  const t = String(text), nt = norm(t);
  let at = 0;
  for (const w of words) { const m = new RegExp(`(^|[^a-zа-яіїєґ0-9'])${reEsc(w)}`).exec(nt); if (m) { at = m.index + m[1].length; break; } }
  let start = Math.max(0, at - 40);
  if (start) { const sp = t.slice(start, at).search(/\s/); start = sp < 0 ? at : start + sp + 1; }   // не резать слово пополам
  const piece = t.slice(start, start + 150);
  let html = esc(piece);
  // одно регулярное выражение на все слова (длинные первыми), чтобы <mark> не вкладывались друг в друга
  if (words.length) html = html.replace(new RegExp(`(^|[^А-Яа-яЁёІіЇїЄєҐґA-Za-z0-9'])(${words.map(w => reEsc(w).replace(/е/g, "[её]")).join("|")})`, "gi"), "$1<mark>$2</mark>");
  return (start ? "…" : "") + html + (start + 150 < t.length ? "…" : "");
}
