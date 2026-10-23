// Лист проверки схем: node scripts/preview-pict.mjs out.jpg [dark]
import sharp from "sharp";
import { pictScene, pictSvg, PICT, PG_CSS, PICT_ORDER } from "../public/pict.js";

const dark = process.argv[3] === "dark";
// librsvg не понимает CSS-переменные — подставляем значения из PG_CSS
const lines = PG_CSS.split(/\r?\n/);
const block = dark ? lines.find(l => l.startsWith(":root[data-theme")) : lines.find(l => l.startsWith(".pg{"));
const VARS = Object.fromEntries([...block.matchAll(/(--pg-[a-z-]+):([^;}]+)/g)].map(m => [m[1], m[2]]));
const resolve = s => s.replace(/var\((--pg-[a-z-]+)\)/g, (_, k) => VARS[k]);
const frames = PICT_ORDER.map(k => [k, PICT[k].period * (process.argv[4] ? Number(process.argv[4]) : .45)]);
const tiles = [];
for (const [i, [m, t]] of frames.entries()) {
  const inner = `<rect x="0" y="0" width="700" height="400" fill="${dark ? "#11171b" : "#f4f6f1"}"/>${resolve(pictScene(PICT[m].pose(t), {guide: PICT[m], t}))}<text x="30" y="130" font-size="16" fill="#8a979b" font-family="sans-serif">${m} t=${t}</text>`;
  const svg = pictSvg(inner).replace("<svg ", `<svg width="1240" height="420" ${dark ? 'data-theme="dark" ' : ""}`);
  tiles.push({input: await sharp(Buffer.from(svg)).png().toBuffer(), left: (i % 3) * 1240, top: Math.floor(i / 3) * 420});
}
const buf = await sharp({create:{width:3720, height:1680, channels:3, background:"#fff"}}).composite(tiles).png().toBuffer();
await sharp(buf).resize({width:1500}).jpeg({quality:85}).toFile(process.argv[2]);
console.log("ok");
