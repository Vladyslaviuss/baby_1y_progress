// Собирает стайлгайд ../baby-style.html: шаблон docs/baby-style.html + схематичный риг public/pict.js.
import { readFileSync, writeFileSync } from "node:fs";
const u = p => new URL(p, import.meta.url);
const src = readFileSync(u("../public/pict.js"), "utf8");
const css = src.match(/export const PG_CSS = `([\s\S]*?)`;/)[1];
const code = src.replace(/^export /gm, "");
const html = readFileSync(u("../docs/baby-style.html"), "utf8")
  .replace("/*PG_CSS*/", () => css)
  .replace(/\/\*PICT\*\/[\s\S]*?\/\*END PICT\*\//, () => `/*PICT*/\n${code}\n/*END PICT*/`);
writeFileSync(u("../../baby-style.html"), html);
console.log(`baby-style.html built, ${(html.length / 1024).toFixed(0)} KB`);
