// Язык интерфейса. Исходник везде русский; украинский — словарь «русский фрагмент → перевод»
// (i18n/uk.json → public/i18n-uk.js, собирается scripts/i18n-build.mjs).
// Перевод идёт на выходе: в мини-аппе — по текстовым узлам DOM, в боте — по исходящим сообщениям.
import { dative, genitive } from "./data.js";

export const LANGS = [["uk", "Українська"], ["ru", "Русский"]];
export const DEFAULT_LANG = "uk";

const CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/;
const L = "А-Яа-яЁёІіЇїЄєҐґA-Za-z'ʼ’";

// Фрагменты строки: без тегов, по кавычкам, переводам строк и HTML-сущностям; значения атрибутов — отдельно
export function segments(s){
  if (!s || !CYR.test(s)) return [];
  const parts = [];
  // кусок шаблона может начаться или закончиться посреди тега (`…${x}">Текст</div><span style="…`)
  const attrs = piece => { for (const m of piece.matchAll(/=\s*"([^"]*)"/g)) parts.push(m[1]); return "\n"; };
  s = s.replace(/^[^<>]*>/, m => /["=]/.test(m) ? attrs(m) : m).replace(/<[^>]*$/, attrs);
  const rest = s.replace(/<[^>]*>/g, tag => { for (const m of tag.matchAll(/=\s*"([^"]*)"/g)) parts.push(m[1]); return "\n"; });
  parts.push(...rest.split(/[\n\r"`]|&[a-z]+;|&#\d+;/));
  return parts.map(p => p.trim()).filter(p => CYR.test(p) && !/[{}]/.test(p));
}

let dict = null, re = null, lang = DEFAULT_LANG;
// Мальчик: тексты написаны про девочку, мужская версия — словарь фрагментов i18n/boy.json ({ru:{}, uk:{}}),
// применяется на выходе поверх перевода. Только фрагменты про ребёнка — мама и предметы не меняются.
let boy = null; const boyRe = {};
export function setBoy(m){ boy = m || null; boyRe.ru = boyRe.uk = null; }
export const isBoy = () => !!boy;
function boyApply(core){
  const mp = boy && (lang === "ru" ? boy.ru : boy.uk); if (!mp || !core) return core;
  if (mp[core]) return mp[core];
  if (!boyRe[lang]) { const keys = Object.keys(mp).sort((a, b) => b.length - a.length); boyRe[lang] = keys.length ? new RegExp(`(?<![${L}])(?:${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![${L}])`, "g") : /$^/; }
  return core.replace(boyRe[lang], k => mp[k] || k);
}
const SHORT = new Set(["для", "при", "под", "над", "без", "про", "или", "раз", "год", "все", "всё", "еще", "ещё", "уже"]);
export const getLang = () => lang;
export function setLang(l, d){ lang = l === "ru" ? "ru" : "uk"; if (d) { dict = d; re = null; } }
export const ready = () => lang === "ru" || !!dict;

function bigRe(){
  if (re) return re;
  // короткие слова и предлоги («в», «с», «по») зависят от контекста — их переводим только целиком, не внутри фраз
  const keys = Object.keys(dict).filter(k => dict[k] && k !== dict[k] && k.trim().length > 2 && !SHORT.has(k.toLowerCase())).sort((a, b) => b.length - a.length);
  const esc = k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  re = new RegExp(`(?<![${L}])(?:${keys.map(esc).join("|")})(?![${L}])`, "g");
  return re;
}

// Имена в косвенных падежах: русская форма → украинская (Рите → Риті, Риты → Рити)
const HUSH = /[жчшщ]$/i;
export function ukDative(n){
  n = (n || "").trim(); if (!n) return n;
  if (/[іи]я$/i.test(n)) return n.slice(0, -1) + "ї";
  if (/[ая]$/i.test(n)) return n.slice(0, -1) + "і";
  if (/[йь]$/i.test(n)) return n.slice(0, -1) + "ю";
  if (/[бвгґдзклмнпрстфхцчшщж]$/i.test(n)) return n + "у";
  return n;
}
export function ukGenitive(n){
  n = (n || "").trim(); if (!n) return n;
  if (/[іи]я$/i.test(n)) return n.slice(0, -1) + "ї";
  if (/а$/i.test(n)) return n.slice(0, -1) + (HUSH.test(n.slice(0, -1)) ? "і" : "и");
  if (/я$/i.test(n)) return n.slice(0, -1) + "і";
  if (/[йь]$/i.test(n)) return n.slice(0, -1) + "я";
  if (/[бвгґдзклмнпрстфхцчшщж]$/i.test(n)) return n + "а";
  return n;
}
let names = [];
export function setNames(list){ names = [...new Set((list || []).map(x => (x || "").trim()).filter(x => x.length > 1))]; }

function trLine(line, nm){
  if (!CYR.test(line)) return line;
  const m = line.match(/^(\s*)([\s\S]*?)(\s*)$/);
  let core = m[2];
  const hit = dict[core];
  if (hit) core = hit;
  else core = core.replace(bigRe(), k => dict[k] || k);
  core = boyApply(core);
  for (const n of nm) {
    const swap = (from, to) => { if (from !== n && from !== to) core = core.replace(new RegExp(`(?<![${L}])${from}(?![${L}])`, "g"), to); };
    swap(dative(n), ukDative(n)); swap(genitive(n), ukGenitive(n));
  }
  return m[1] + core + m[3];
}
// Перевод обычного текста (несколько строк допускается)
export function tr(text, nm = names){
  if (!text || !CYR.test(text)) return text;
  if (lang === "ru") return boy ? text.split("\n").map(l => { const m = l.match(/^(\s*)([\s\S]*?)(\s*)$/); return m[1] + boyApply(m[2]) + m[3]; }).join("\n") : text;
  if (!dict) return text;
  return text.split("\n").map(l => trLine(l, nm)).join("\n");
}
// Перевод HTML-разметки Telegram/карточек: теги не трогаем, атрибуты-подписи переводим
export function trHtml(html, nm = names){
  if (!html || !CYR.test(html) || (lang === "ru" ? !boy : !dict)) return html;
  return html.split(/(<[^>]*>)/).map(p => p.startsWith("<")
    ? p.replace(/(title|aria-label|placeholder|alt)="([^"]*)"/g, (_, a, v) => `${a}="${tr(v, nm)}"`)
    : tr(p, nm)).join("");
}

// Мини-апп: переводит всё, что попадает в DOM
const ATTRS = ["title", "aria-label", "placeholder", "alt"];
export function watchDom(root = document.body){
  const done = new WeakMap();
  const text = n => { if (done.get(n) === n.data) return; const p = n.parentNode?.nodeName; if (p === "SCRIPT" || p === "STYLE" || p === "TEXTAREA" || n.parentElement?.closest('[translate="no"]')) return; const t = tr(n.data); if (t !== n.data) n.data = t; done.set(n, n.data); };
  const el = e => { for (const a of ATTRS) { const v = e.getAttribute?.(a); if (v && CYR.test(v)) { const t = tr(v); if (t !== v) e.setAttribute(a, t); } } };
  const walk = node => {
    if (lang === "ru" ? !boy : !dict) return;
    if (node.nodeType === 3) return text(node);
    if (node.nodeType !== 1) return;
    el(node);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? text(n) : el(n);
  };
  walk(root); if (document.title) document.title = tr(document.title);
  new MutationObserver(ms => { for (const m of ms) {
    if (m.type === "characterData") text(m.target);
    else if (m.type === "attributes") el(m.target);
    else m.addedNodes.forEach(walk);
  } }).observe(root, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS});
  return walk;
}
