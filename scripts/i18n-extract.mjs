// Собирает все русские фразы из кода в словарь i18n/uk.json (ключ — русский фрагмент, значение — украинский).
// Фрагменты режутся так же, как их потом увидит переводчик в рантайме: по тегам, кавычкам и ${…}.
// Уже переведённое сохраняется; новые ключи получают "" и попадают в i18n/todo.json с контекстом.
// Запуск: node scripts/i18n-extract.mjs
import fs from "node:fs";
import {parse} from "acorn";
import {simple} from "acorn-walk";
import {segments} from "../public/i18n.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const JS = ["public/data.js", "public/app.js", "public/anim.js", "public/search.js", "public/tips.js", "public/guides.js", "public/guides-more.js", "public/faq.js", "public/vacc-info.js", "public/daytips.js", "public/pict.js", "src/worker.js", "src/feed.js", "src/sleep.js", "src/cards.js"];
const found = new Map();   // key -> [контекст]
const add = (s, file, line, src) => { for (const k of segments(s)) { if (!found.has(k)) found.set(k, []); const c = found.get(k); if (c.length < 2) c.push(`${file}:${line}: ${src.trim().slice(0, 160)}`); } };

for (const f of JS) {
  const code = fs.readFileSync(ROOT + f, "utf8"), lines = code.split("\n");
  const ast = parse(code, {ecmaVersion:"latest", sourceType:"module", locations:true});
  const at = n => [n.loc.start.line, lines[n.loc.start.line - 1]];
  simple(ast, {
    Literal(n){ if (typeof n.value === "string") add(n.value, f, ...at(n)); },
    TemplateElement(n){ add(n.value.cooked ?? n.value.raw, f, ...at(n)); },
  });
}
// index.html: текст между тегами и атрибуты
const html = fs.readFileSync(ROOT + "public/index.html", "utf8");
html.split("\n").forEach((l, i) => { for (const m of l.matchAll(/>([^<]+)</g)) add(m[1], "public/index.html", i + 1, l); for (const m of l.matchAll(/="([^"]+)"/g)) add(m[1], "public/index.html", i + 1, l); });

const path = ROOT + "i18n/uk.json";
fs.mkdirSync(ROOT + "i18n", {recursive:true});
const old = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
const out = {}, todo = [];
for (const k of [...found.keys()].sort()) { out[k] = old[k] ?? ""; if (!out[k]) todo.push({k, ctx:found.get(k)}); }
fs.writeFileSync(path, JSON.stringify(out, null, 1));
fs.writeFileSync(ROOT + "i18n/todo.json", JSON.stringify(todo, null, 1));
const gone = Object.keys(old).filter(k => !(k in out)).length;
console.log(`ключей ${Object.keys(out).length}, без перевода ${todo.length}, удалено устаревших ${gone}`);
