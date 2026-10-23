// Рендерит схему-подсказку в MP4 1080×1350: npm run video -- bike   (ключи — PICT_ORDER в public/pict.js)
// Кадры: схема (pict.js) → satori (вёрстка с шагами) → resvg (PNG) → ffmpeg.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import { pictScene, pictSvg, PICT, PG_CSS } from "../public/pict.js";
import { ANIMS } from "../public/anim.js";

const KEY = process.argv[2] || "bike";
const M = PICT[KEY], A = ANIMS[KEY];
if (!M || !A) { console.error(`Нет схемы «${KEY}». Есть: ${Object.keys(PICT).join(", ")}`); process.exit(1); }
const FPS = 30, W = 1080, H = 1350;
const root = new URL("../", import.meta.url);
const f = name => readFileSync(new URL(`src/fonts/${name}`, root));
const fonts = [
  {name:"GolosL", data:f("golos-text-latin-400-normal.woff"), weight:400, style:"normal"},
  {name:"GolosC", data:f("golos-text-cyrillic-400-normal.woff"), weight:400, style:"normal"},
  {name:"UnbL", data:f("unbounded-latin-500-normal.woff"), weight:500, style:"normal"},
  {name:"UnbC", data:f("unbounded-cyrillic-500-normal.woff"), weight:500, style:"normal"},
];
// resvg не понимает CSS-переменные — подставляем светлую палитру
const VARS = Object.fromEntries([...PG_CSS.split(/\r?\n/).find(l => l.startsWith(".pg{")).matchAll(/(--pg-[a-z-]+):([^;}]+)/g)].map(m => [m[1], m[2]]));
const resolve = s => s.replace(/var\((--pg-[a-z-]+)\)/g, (_, k) => VARS[k]);
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const loops = Math.max(2, Math.ceil(6 / M.period)), total = Math.round(M.period * loops * FPS);

function frameMarkup(t){
  const svg = pictSvg(resolve(pictScene(M.pose(t), {guide:M, t}))).replace("<svg ", `<svg width="952" height="322" `);
  const img = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const steps = A.steps.map((s, i) => `<div style="display:flex;gap:14px;font-size:27px;line-height:1.35"><div style="display:flex;width:38px;height:38px;border-radius:19px;background:#B8436F;color:#fff;font-size:22px;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div><div style="display:flex;flex:1">${esc(s)}</div></div>`).join("");
  return `<div style="display:flex;flex-direction:column;width:${W}px;height:${H}px;box-sizing:border-box;background:#F2F4F0;font-family:GolosL, GolosC;color:#1C2932;padding:56px 64px">
    <div style="display:flex;font-size:22px;letter-spacing:3px;color:#5B6A70">КАК ДЕЛАТЬ</div>
    <div style="display:flex;font-family:UnbL, UnbC;font-size:52px;margin-top:10px">${esc(M.title)}</div>
    <div style="display:flex;margin-top:24px;background:#F7F8F5;border-radius:24px;padding:0"><img src="${img}" width="952" height="322"/></div>
    <div style="display:flex;font-size:23px;color:#23806F;margin-top:16px">${esc(M.meta)}</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">${steps}</div>
    <div style="display:flex;margin-top:auto;font-size:22px;color:#B4432C">${esc(A.safety)}</div>
  </div>`;
}

const tmp = new URL(`media/.frames-${KEY}/`, root);
rmSync(tmp, {recursive:true, force:true}); mkdirSync(tmp, {recursive:true});
const win = u => u.pathname.replace(/^\/([A-Z]:)/, "$1");
for (let i = 0; i < total; i++) {
  const svg = await satori(html(frameMarkup(i / FPS).replace(/\n\s*/g, "")), {width:W, height:H, fonts});
  writeFileSync(new URL(`f${String(i).padStart(4,"0")}.png`, tmp), new Resvg(svg, {fitTo:{mode:"width", value:W}}).render().asPng());
}
const out = new URL(`media/anim-${KEY}.mp4`, root);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", win(new URL("f%04d.png", tmp)), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", win(out)]);
rmSync(tmp, {recursive:true, force:true});
console.log(`${total} кадров → ${win(out)}`);
