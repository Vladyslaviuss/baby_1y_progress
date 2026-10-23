// «Советы»: статьи собираются из уже существующего контента data.js — тексты не копируются и не дописываются.
// Исключение — гайды из guides.js (id g:*): самостоятельные статьи по темам, которых в data.js нет.
// Статья: {id, sec, title, lead?, blocks:[{h?, p?, ul?, ol?}], anims?, pict?, calls?, go?}. Пустых статей нет.
import { W, ROUTINE, REMIND, RCAT, RH, RA, FLAGS, FLAGS_ALWAYS, urgentFor, FIRST_AID, FA_ANIMS, VACCINES, VACCINES_LATER, SECTION_HINTS,
         SPURTS, SPURT_SIGNS, SPURT_DO, SPURT_DOCTOR, GCAT, NOTICES, LEAP_PEAKS, LEAP_KIND, LEAP_NOTE } from "./data.js";
import { GUIDES } from "./guides.js";

// Секции по порядку показа. tone — цветовая плашка карточек (токены app.css).
export const TIP_SECS = [
  {id:"saved",  name:"Сохранённые",           tone:"accent"},
  {id:"now",    name:"Сейчас",                tone:"accent"},
  {id:"fa",     name:"Первая помощь",         tone:"warn"},
  {id:"weeks",  name:"Неделя за неделей",     tone:"phase"},
  {id:"sleep",  name:"Сон",                   tone:"lav"},
  {id:"cry",    name:"Плач и колики",         tone:"peach"},
  {id:"food",   name:"Кормление",             tone:"butter"},
  {id:"care",   name:"Уход и гигиена",        tone:"mint"},
  {id:"ill",    name:"Болезни",               tone:"health"},
  {id:"body",   name:"Тело и движение",       tone:"peach"},
  {id:"play",   name:"Игры и развитие",       tone:"pink"},
  {id:"lang",   name:"Язык и речь",           tone:"en"},
  {id:"mom",    name:"Мама",                  tone:"pink"},
  {id:"safe",   name:"Безопасность",          tone:"warn"},
  {id:"vaccines", name:"Прививки",            tone:"health"},
  {id:"things", name:"Вещи",                  tone:"accent"},
];

const has = a => Array.isArray(a) ? a.length > 0 : !!a;
const article = a => (a.blocks = a.blocks.filter(b => has(b.p) || has(b.ul) || has(b.ol)), a.blocks.length || a.go || a.kind ? a : null);

function build(){
  const out = [];
  const add = a => { const x = article(a); if (x) out.push(x); };
  for (const f of FIRST_AID) add({id:`fa:${f.id}`, sec:"fa", title:f.title, lead:f.when, calls:true,
    blocks:[{p:f.call}, {ol:f.steps}], anims:FA_ANIMS[f.id] || [], pict:(FA_ANIMS[f.id] || [])[0]});
  for (const f of FLAGS) add({id:`flags:${f.from}`, sec:"flags", from:f.from, to:f.to, title:`Красные флаги: ${f.title}`,
    blocks:[{ul:f.items}, {p:FLAGS_ALWAYS}, {h:"Срочно, не ждать", ul:urgentFor(f.from)}], go:{tab:"flags"}});
  W.forEach((w, i) => out.push({id:`w:${i + 1}`, sec:"weeks", week:i + 1, title:w.t, lead:`Неделя ${i + 1}`, blocks:[], kind:"week"}));
  const SEC = {care:"care", body:"body", play:"play", lang:"lang", food:"food", sleep:"sleep"};
  for (const r of ROUTINE) {
    const anims = [...new Set((RA[r.id] || []).flatMap(x => x[2]))];
    add({id:`r:${r.id}`, sec:SEC[r.cat], title:r.st[0][2], lead:RCAT[r.cat],
      blocks:[{p:RH[r.id]}, r.st.length > 1 ? {h:"По неделям", ul:r.st.map(([a, b, x, how]) => `Недели ${a}–${b}: ${x}. ${how}`)} : {p:r.st[0][3]}],
      anims, pict:anims[0], go:{tab:"today", routine:r.id}});
  }
  // «Помнить весь день» — тоже статьи: зачем и что именно
  for (const r of REMIND) add({id:`r:${r.id}`, sec:r.id === "talk" ? "lang" : "sleep", title:r.st[0][2], lead:"Помнить весь день",
    blocks:[{p:RH[r.id]}, ...r.st.map(([a, b, x, pts]) => ({h:r.st.length > 1 ? `Недели ${a}–${b}: ${x}` : `Недели ${a}–${b}`, ul:pts}))], go:{tab:"today"}});
  for (const g of GUIDES) add({...g, blocks:[...g.blocks]});   // гайды guides.js: своё содержимое, не из data.js
  add({id:"spurts", sec:"food", title:"Скачки роста", blocks:[{ul:SPURTS.map(s => `${s.title}: ${s.d}`)}, {h:"Признаки", ul:SPURT_SIGNS}, {h:"Что делать", ul:SPURT_DO}, {p:SPURT_DOCTOR},
    {h:"Скачки развития", p:LEAP_KIND.l.d}, {ul:[`Пики: недели ${LEAP_PEAKS.join(", ")}`]}, {p:LEAP_NOTE}], go:{tab:"growth"}});
  add({id:"vac:about", sec:"vaccines", title:"Календарь прививок", blocks:[{p:SECTION_HINTS.vaccines}, {p:VACCINES_LATER}], go:{tab:"vaccines"}});
  for (const v of VACCINES) if (v.note) add({id:`vac:${v.code.toLowerCase()}`, sec:"vaccines", title:v.name, lead:v.kind === "rec" ? "Рекомендованная, платно" : v.at.m ? `${v.at.m} мес` : "Роддом",
    blocks:[{p:v.note}], go:{tab:"vaccines"}});
  for (const c of GCAT) out.push({id:`things:${c.id}`, sec:"things", title:c.name, blocks:[], kind:"things", cat:c.id, go:{tab:"orders", cat:c.id}});
  for (const n of NOTICES) add({id:`n:${n.id}`, sec:"notice", notice:n.id, title:n.title, lead:"Важное", blocks:[{p:n.lead}, {ul:n.items}], kind:"notice"});
  return out;
}
export const ARTICLES = build();
export const articleOf = id => ARTICLES.find(a => a.id === id);
// «Связанное»: соседи по секции, ближайшие по порядку (2–4 ссылки); если своих меньше двух — добрать из соседних разделов
export function related(a, n = 3){
  const i = ARTICLES.indexOf(a), near = (x, y) => Math.abs(ARTICLES.indexOf(x) - i) - Math.abs(ARTICLES.indexOf(y) - i);
  const pool = ARTICLES.filter(x => x.id !== a.id && !x.kind && x.sec !== "notice" && x.sec !== "flags");
  const same = pool.filter(x => x.sec === a.sec).sort(near).slice(0, n);
  return same.length >= 2 ? same : [...same, ...pool.filter(x => x.sec !== a.sec && x.sec !== "fa").sort(near)].slice(0, Math.max(2, same.length));
}
