// Рендерит карточки недель и праздничные картинки в public/cards/*.png.
// Запускать после правок data.js или src/cards.js: npm run render
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import { cardHTML, monthHTML } from "../src/cards.js";
import { setLang, setBoy, trHtml } from "../public/i18n.js";
import UK from "../public/i18n-uk.js";
import BOY from "../public/i18n-boy.js";

const f = name => readFileSync(new URL(`../src/fonts/${name}`, import.meta.url));
const fonts = [
  {name:"GolosL", data:f("golos-text-latin-400-normal.woff"), weight:400, style:"normal"},
  {name:"GolosC", data:f("golos-text-cyrillic-400-normal.woff"), weight:400, style:"normal"},
  {name:"GolosL", data:f("golos-text-latin-600-normal.woff"), weight:600, style:"normal"},
  {name:"GolosC", data:f("golos-text-cyrillic-600-normal.woff"), weight:600, style:"normal"},
  {name:"UnbL", data:f("unbounded-latin-500-normal.woff"), weight:500, style:"normal"},
  {name:"UnbC", data:f("unbounded-cyrillic-500-normal.woff"), weight:500, style:"normal"},
];
const out = new URL("../public/cards/", import.meta.url);
mkdirSync(out, {recursive:true});

async function png(markup, size){
  const svg = await satori(html(markup.replace(/\n\s*/g, "")), {...size, fonts});
  return new Resvg(svg, {fitTo:{mode:"width", value:size.width}}).render().asPng();
}
const only = process.argv[2];   // npm run render -- w10  (одна картинка для проверки)
// русские карточки в cards/, украинские — в cards/uk/ (тот же макет, текст через словарь)
const outUk = new URL("uk/", out); mkdirSync(outUk, {recursive:true});
// мальчик: cards/boy/ и cards/uk/boy/ — только те карточки, где текст про ребёнка меняется; список — в src/cards-boy.js
const boyList = {ru:[], uk:[]};
for (const [lang, dir] of [["ru", out], ["uk", outUk]]) {
  const dirBoy = new URL("boy/", dir); mkdirSync(dirBoy, {recursive:true});
  const items = [...Array.from({length:52}, (_, i) => [`w${String(i + 1).padStart(2,"0")}`, () => cardHTML(i + 1), {width:1080}]),
    ...Array.from({length:12}, (_, i) => [`m${String(i + 1).padStart(2,"0")}`, () => monthHTML(i + 1), {width:1080, height:1080}])];
  for (const [name, mk, size] of items) {
    setLang(lang, UK); setBoy(null);
    const girl = lang === "uk" ? trHtml(mk()) : mk();
    setBoy(BOY); const boy = trHtml(mk()); setBoy(null);
    if (boy !== girl) boyList[lang].push(name);
    if (only && only !== name) continue;
    writeFileSync(new URL(`${name}.png`, dir), await png(girl, size));
    if (boy !== girl) writeFileSync(new URL(`${name}.png`, dirBoy), await png(boy, size));
  }
}
setLang("ru");
writeFileSync(new URL("../src/cards-boy.js", import.meta.url), `// Сгенерировано scripts/render-cards.mjs: карточки, у которых есть версия для мальчика.
export const BOY_CARDS = ${JSON.stringify(boyList)};
`);
// версия для обхода кэша Telegram по URL
writeFileSync(new URL("../src/cards-version.js", import.meta.url), `export const CARDS_VERSION = "${Date.now().toString(36)}";\n`);
console.log("rendered", only || "all");
