// Ролик «Зачем это приложение» для /start: раскадровка FAQ-пункта "why" (public/faq.js) крупно, портрет 720×1280.
// node scripts/render-intro.mjs [ru|uk ...]   → public/media/intro-ru.mp4, intro-uk.mp4
// INTRO_ID=pwa node scripts/render-intro.mjs  → public/media/howto-pwa-ru.mp4, howto-pwa-uk.mp4 (инструкция для /web)
// Мини-апп поднимается локально (server.mjs, временная БД, фейковый Telegram API), страница пишется Playwright'ом (recordVideo),
// потом ffmpeg: обрезка до одного цикла кадров + 1 с на последнем, H.264 yuv420p без звука.
// Перевод — словарь public/i18n-uk.js, как в самом приложении: после обновления переводов просто перезапустить.
// playwright-core: из node_modules, если есть, иначе путь из PLAYWRIGHT_CORE (каталог пакета или index.mjs).
// Chromium: CHROME_PATH или %LOCALAPPDATA%/ms-playwright/chromium-1208/chrome-win64/chrome.exe.
// Параметры: INTRO_SLOW — во сколько раз растянуть паузы раскадровки (по умолчанию 1.6: подписи успевают прочитать).
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["ru", "uk"];
// какой пункт FAQ снимать и заголовок ролика (по умолчанию — вопрос пункта)
const ID = process.env.INTRO_ID || "why", TITLE = {pwa:"Приложение на главном экране"}[ID] || null;
const OUT = l => ID === "why" ? `intro-${l}.mp4` : `howto-${ID}-${l}.mp4`;
const W = 720, H = 1280, SLOW = Number(process.env.INTRO_SLOW || 1.6), HOLD = 1;   // HOLD — секунд на последнем кадре сверх обычного

async function loadPlaywright(){
  try { return await import("playwright-core"); } catch {}
  const p = process.env.PLAYWRIGHT_CORE;   // путь к установленному playwright-core, если его нет в node_modules проекта
  if (!p) throw new Error("Нужен playwright-core: npm i -D playwright-core или PLAYWRIGHT_CORE=<путь>");
  return import(pathToFileURL(p.endsWith(".mjs") ? p : path.join(p, "index.mjs")).href);
}
const { chromium } = await loadPlaywright();
const exe = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1208/chrome-win64/chrome.exe");

// ---------- сервер мини-аппа ----------
const fake = http.createServer((req, res) => { req.resume(); req.on("end", () => {
  const m = req.url.split("/").pop();
  const result = m === "getMe" ? {id:1, is_bot:true, username:"child_devbot"} : m.startsWith("send") ? {message_id:1} : true;
  res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ok:true, result}));
}); }).listen(0, "127.0.0.1");
await new Promise(r => fake.once("listening", r));
const TG_PORT = fake.address().port;
// свободный порт под server.mjs (рядом могут работать другие dev-серверы)
const PORT = await new Promise(r => { const s = http.createServer().listen(0, "127.0.0.1", () => { const n = s.address().port; s.close(() => r(n)); }); });
const U = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "intro-"));
const srv = spawn(process.execPath, ["server.mjs"], {cwd:ROOT, stdio:["ignore", "ignore", "inherit"],
  env:{...process.env, PORT:String(PORT), DB_PATH:path.join(TMP, "intro.db"), BOT_TOKEN:"x", WEBHOOK_SECRET:"s", APP_URL:U,
    TG_API:`http://127.0.0.1:${TG_PORT}/bot`, GATE_CHANNEL:"", DEV:"1"}});
for (let i = 0; ; i++) { try { await fetch(U + "/"); break; } catch { if (i > 50) throw new Error("server.mjs не поднялся"); await new Promise(r => setTimeout(r, 200)); } }
const browser = await chromium.launch({executablePath:exe, headless:true});

// ---------- вёрстка ролика (только для записи; стили приложения не трогаем) ----------
const CSS = `
html,body{margin:0;height:100%;overflow:hidden;background:var(--bg)}
.iv{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:78px 40px 70px;box-sizing:border-box;
  background:radial-gradient(70% 42% at 50% 52%,rgba(255,255,255,.55),transparent 70%),linear-gradient(172deg,var(--peach1) 0%,var(--bg) 38%,var(--peach1) 70%,var(--peach2) 100%);font-family:var(--body);color:var(--fg)}
.iv h1{margin:0;width:100%;white-space:nowrap;font:900 56px/1.1 var(--display);letter-spacing:-.5px;color:var(--hero-fg);text-align:center}
.iv .fq-demo{display:flex;flex-direction:column;align-items:center;justify-content:space-between;flex:1;gap:0;padding:0;border-radius:0;background:none;width:100%}
.iv .fq-phone{transform-origin:50% 50%;cursor:default;box-shadow:0 10px 26px rgba(43,36,32,.18)}
.iv .fq-ctl{max-width:640px;width:100%}
.iv .fq-dots{display:none}
.iv .fq-cap{min-height:2.6em;display:flex;align-items:center;justify-content:center;font:600 36px/1.3 var(--body);color:var(--fg);text-wrap:balance}
.iv .fq-cap b{display:none}`;

async function render(lang){
  const vdir = path.join(TMP, "v-" + lang); fs.mkdirSync(vdir, {recursive:true});
  const ctx = await browser.newContext({viewport:{width:W, height:H}, deviceScaleFactor:1, colorScheme:"light", reducedMotion:"no-preference",
    locale:lang === "uk" ? "uk-UA" : "ru-RU", recordVideo:{dir:vdir, size:{width:W, height:H}}});
  await ctx.addInitScript(l => { try { localStorage.setItem("lang", l); localStorage.setItem("theme", "light"); } catch {} }, lang);
  const p = await ctx.newPage(); const t0 = Date.now();
  p.on("pageerror", e => console.log(`  [${lang}] page error (приложение под роликом, на запись не влияет):`, e.message, (e.stack || "").split("\n")[1] || ""));
  await p.goto(`${U}/?dev_user=1&dev_name=%D0%90%D0%BD%D1%8F`, {waitUntil:"load"});
  await p.waitForFunction(() => document.querySelector("#view")?.children.length > 0, null, {timeout:15000}).catch(() => {});
  await p.evaluate(() => Promise.all([document.fonts.ready, document.fonts.load("900 56px Nunito"), document.fonts.load("600 36px 'Golos Text'")]));
  await p.waitForTimeout(500);
  const info = await p.evaluate(async ({css, slow, id, title}) => {
    const { faqOf, faqDemo, mountDemos } = await import("/faq.js");
    // растянуть паузы раскадровки: таймеры faq.js берут глобальный setTimeout
    const st = window.setTimeout.bind(window); window.setTimeout = (fn, ms, ...a) => st(fn, (ms || 0) * slow, ...a);
    const style = document.createElement("style"); style.textContent = css; document.head.append(style);
    const stage = document.createElement("div"); stage.className = "iv";
    const item = faqOf(id);   // заголовок — вопрос пункта («Зачем это приложение?») или свой: переводится вместе с ним
    stage.innerHTML = `<h1>${title || item.q}</h1>${faqDemo(item)}`;
    document.body.replaceChildren(stage);   // watchDom приложения переводит вставленное (uk)
    await new Promise(r => setTimeout(r));
    const h1 = stage.querySelector("h1");   // заголовок в одну строку: уменьшаем шрифт, пока не влезет
    for (let fs = 56; fs > 34 && h1.scrollWidth > h1.clientWidth; fs -= 2) h1.style.fontSize = fs - 2 + "px";
    const phone = stage.querySelector(".fq-phone"), demo = stage.querySelector(".fq-demo");
    // телефон крупно: scale + поля под увеличенный размер, чтобы вёрстка не наезжала
    const room = demo.clientHeight - stage.querySelector(".fq-ctl").offsetHeight - 40;
    const s = Math.min(2.05, room / phone.offsetHeight, 600 / phone.offsetWidth);
    phone.style.transform = `scale(${s})`; phone.style.margin = `${(phone.offsetHeight * (s - 1) / 2).toFixed(1)}px 0`;
    const frames = [...stage.querySelectorAll(".fq-fr")];
    window.__log = [];
    window.__done = new Promise(resolve => {
      let last = 0, seenLast = false;
      new MutationObserver(() => {
        const i = frames.findIndex(f => f.classList.contains("on"));
        if (i < 0 || i === last) return;
        last = i; window.__log.push({i, t:Date.now()});
        if (i === frames.length - 1) seenLast = true;
        else if (i === 0 && seenLast) resolve();
      }).observe(demo, {subtree:true, attributes:true, attributeFilter:["class"]});
    });
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const tMount = Date.now(); window.__log.push({i:0, t:tMount});
    mountDemos(stage);
    return {tMount, n:frames.length, scale:s};
  }, {css:CSS, slow:SLOW, id:ID, title:TITLE});
  await p.evaluate(() => window.__done);
  const log = await p.evaluate(() => window.__log);
  const video = p.video(); await ctx.close(); const webm = await video.path();
  const start = (info.tMount - t0) / 1000 + 0.15, want = (log.at(-1).t - t0) / 1000 - 0.06;
  // запись кадров идёт по перерисовкам: статичный последний кадр в webm может кончиться раньше — добираем стоп-кадром
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", webm]).toString().trim());
  const end = Number.isFinite(dur) && dur > start ? Math.min(want, dur - 0.05) : want, pad = HOLD + (want - end);
  const out = path.join(ROOT, "public/media", OUT(lang));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", start.toFixed(3), "-t", (end - start).toFixed(3), "-i", webm,   // -t до -i: режет вход, стоп-кадр tpad не обрезается
    "-vf", `fps=30,tpad=stop_mode=clone:stop_duration=${pad.toFixed(2)},format=yuv420p`, "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-profile:v", "high", "-movflags", "+faststart", out]);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`${lang}: ${info.n} кадров, scale ${info.scale.toFixed(2)}, ${(end - start + pad).toFixed(1)} с, ${kb} КБ → ${out}`);
  console.log("   смены кадров (с от начала):", log.map(x => `${x.i}@${((x.t - info.tMount) / 1000).toFixed(1)}`).join(" "));
}

try { for (const l of LANGS) await render(l); }
finally { await browser.close(); srv.kill(); fake.close(); await new Promise(r => setTimeout(r, 500)); try { fs.rmSync(TMP, {recursive:true, force:true}); } catch {} }
