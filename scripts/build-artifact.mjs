// Вставляет bot/public/data.js в артефакт first-year-plan.html между /*DATA*/ и /*END DATA*/.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const data = readFileSync(new URL("bot/public/data.js", root), "utf8").replace(/^export /gm, "");
const file = new URL("first-year-plan.html", root);
const html = readFileSync(file, "utf8");
const re = /\/\*DATA\*\/[\s\S]*?\/\*END DATA\*\//;
if (!re.test(html)) throw new Error("markers not found");
writeFileSync(file, html.replace(re, () => `/*DATA*/\n${data}\n/*END DATA*/`));
console.log("artifact rebuilt");
