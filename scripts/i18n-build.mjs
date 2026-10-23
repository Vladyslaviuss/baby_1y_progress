// Сливает переводы (i18n/chunks/out*.json, если есть) в i18n/uk.json и собирает public/i18n-uk.js.
// i18n/uk-extra.json — то, чего нет в исходниках литералами: месяцы и дни недели из toLocaleDateString, падежи.
// Запуск: node scripts/i18n-build.mjs  (после правок текста: сначала i18n-extract)
import fs from "node:fs";

const R = new URL("../", import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, R), "utf8"));
const uk = read("i18n/uk.json");
const dir = new URL("i18n/chunks/", R);
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => /^out\d+\.json$/.test(f))) {
  const o = JSON.parse(fs.readFileSync(new URL(f, dir), "utf8"));
  for (const [k, v] of Object.entries(o)) if (k in uk && v && !uk[k]) uk[k] = v;
}
fs.writeFileSync(new URL("i18n/uk.json", R), JSON.stringify(uk, null, 1));
const extra = read("i18n/uk-extra.json");
const all = {...Object.fromEntries(Object.entries(uk).filter(([, v]) => v)), ...extra};
const missing = Object.values(uk).filter(v => !v).length;
fs.writeFileSync(new URL("public/i18n-uk.js", R), `// Сгенерировано scripts/i18n-build.mjs из i18n/uk.json + i18n/uk-extra.json. Руками не править.\nexport default ${JSON.stringify(all)};\n`);
// мальчик: i18n/boy.json → public/i18n-boy.js (подгружается, только если в семье мальчик)
const boyPath = new URL("i18n/boy.json", R);
if (fs.existsSync(boyPath)) { const b = read("i18n/boy.json");
  fs.writeFileSync(new URL("public/i18n-boy.js", R), `// Сгенерировано scripts/i18n-build.mjs из i18n/boy.json. Руками не править.\nexport default ${JSON.stringify(b)};\n`);
  console.log(`мальчик: ru ${Object.keys(b.ru || {}).length}, uk ${Object.keys(b.uk || {}).length}`); }
console.log(`в словаре ${Object.keys(all).length}, без перевода ${missing}`);
if (missing) process.exitCode = 1;
