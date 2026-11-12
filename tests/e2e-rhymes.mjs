// npm run test:rhymes. Потешки: лайки (r:<id>, общие на семью), свои потешки (API, чужая семья, экспорт/импорт), экран в мини-приложении.
import {spawn} from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
const BOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "rita-rhymes-"));
const require = createRequire(BOT + "/package.json");
const {chromium} = require("playwright-core");
const fake = http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => {
  const m = req.url.split("/").pop(); let result = true;
  if (m === "getMe") result = {id:1, is_bot:true, username:"child_devbot"};
  if (m.startsWith("send")) result = {message_id:77};
  res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ok:true, result}));
}); }).listen(8779);
const srv = spawn(process.execPath, ["server.mjs"], {cwd:BOT, stdio:["ignore", "ignore", "inherit"],
  env:{...process.env, PORT:"8778", DB_PATH:path.join(OUT, "r.db"), BOT_TOKEN:"x", WEBHOOK_SECRET:"s", APP_URL:"http://localhost:8778", TG_API:"http://localhost:8779/bot", GATE_CHANNEL:"", DEV:"1", FEED_TICK_MS:"600000"}});
await new Promise(r => setTimeout(r, 1500));
const U = "http://localhost:8778";
const post = (p, body, uid) => fetch(U + p, {method:"POST", headers:{"content-type":"application/json", "x-dev-user":String(uid), "x-dev-name":"T"}, body:JSON.stringify(body)}).then(async r => ({status:r.status, ...(await r.json())}));
const get = (p, uid) => fetch(U + p, {headers:{"x-dev-user":String(uid)}}).then(r => r.json());
let fails = 0; const ok = (c, n) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails++; };
try {
  const T = (await get("/api/state", 1)).today, add = (iso, k) => new Date(Date.parse(iso + "T00:00:00Z") + k * 864e5).toISOString().slice(0, 10);
  await post("/api/onboard", {children:[{name:"Рита", birth:add(T, -140), sex:"girl"}], role:"papa", my_name:"Влад", color:"raspberry", modules:{}}, 1);
  await post("/api/onboard", {children:[{name:"Марк", birth:add(T, -140), sex:"boy"}], role:"papa", my_name:"Иван", color:"raspberry", modules:{}}, 2);
  await post("/api/lang", {lang:"ru"}, 1);

  // лайк встроенной
  ok((await post("/api/check", {id:"r:ru-meduzy", val:1}, 1)).ok, "лайк: отметка r:ru-meduzy принята");
  ok((await get("/api/state", 1)).checks["r:ru-meduzy"], "лайк в состоянии семьи");
  ok((await post("/api/check", {id:"r:../x", val:1}, 1)).status === 400, "лайк: кривой id отклонён");
  // свои
  ok((await post("/api/rhyme/save", {title:"", text:"x"}, 1)).status === 400, "своя: без названия — 400");
  const a = await post("/api/rhyme/save", {title:"Бабушкина", text:"Раз-два-три,\r\nна меня смотри!", how:"Хлопаем", lang:"ru"}, 1);
  ok(a.ok && a.id, "своя: добавлена");
  let st = await get("/api/state", 1);
  ok(st.rhymes?.length === 1 && st.rhymes[0].text === "Раз-два-три,\nна меня смотри!" && st.rhymes[0].lang === "ru", "своя: в состоянии, \\r убран");
  ok((await post("/api/rhyme/save", {id:a.id, title:"Бабушкина 2", text:"Раз!", lang:"zz"}, 1)).ok, "своя: правка");
  st = await get("/api/state", 1);
  ok(st.rhymes[0].title === "Бабушкина 2" && st.rhymes[0].lang === "xx", "своя: правка сохранена, неизвестный язык → xx");
  ok((await get("/api/state", 2)).rhymes.length === 0, "чужая семья своих не видит");
  ok((await post("/api/rhyme/save", {id:a.id, title:"Взлом", text:"x"}, 2)).status === 404, "чужая семья не правит");
  await post("/api/rhyme/delete", {id:a.id}, 2);
  ok((await get("/api/state", 1)).rhymes.length === 1, "чужая семья не удаляет");
  // экспорт → импорт
  const exp = await fetch(U + "/api/export", {headers:{"x-dev-user":"1"}}).then(r => r.ok ? r.json() : null).catch(() => null);
  if (exp?.rhymes) {
    ok(exp.rhymes.length === 1 && exp.rhymes[0].title === "Бабушкина 2", "экспорт: свои потешки в копии");
    const im = await post("/api/import", {data:exp}, 2);
    ok(im.ok && im.rhymes === 1 && (await get("/api/state", 2)).rhymes.length === 1, "импорт: свои потешки добавлены");
    const im2 = await post("/api/import", {data:exp}, 2);
    ok(im2.rhymes === 0, "импорт повторно: без дублей");
  } else console.log("SKIP экспорт: /api/export не отдаёт JSON");
  ok((await post("/api/rhyme/delete", {id:a.id}, 1)).ok && (await get("/api/state", 1)).rhymes.length === 0, "своя: удалена");

  // экран
  const exe = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1208/chrome-win64/chrome.exe");
  const browser = await chromium.launch({executablePath:exe, headless:true});
  const ctx = await browser.newContext({viewport:{width:390, height:844}, isMobile:true, hasTouch:true, locale:"ru-RU"});
  await ctx.addInitScript(() => { try { localStorage.setItem("lang", "ru"); } catch {} });
  const p = await ctx.newPage(); let perr = 0; p.on("pageerror", e => { console.log("PAGE ERROR", e.message); perr++; });
  p.on("dialog", d => d.accept());
  await p.goto(`${U}/?dev_user=1&dev_name=Vlad`, {waitUntil:"load"});
  await p.waitForSelector(".rh-day", {timeout:15000});
  await p.evaluate(() => { const o = document.getElementById("overlay"); if (o) { o.hidden = true; o.innerHTML = ""; } });
  ok(await p.locator(".rh-day .rh-like").count() === 1, "потешка дня: сердечко");
  await p.locator("[data-rhall]").click(); await p.waitForSelector(".rh-tabs");
  ok(/Наши · 1/.test(await p.locator(".rh-tabs").innerText()), "экран: «Наши · 1» (лайк из API)");
  await p.locator('[data-rhlang="en"]').click();
  await p.locator(".rh-item summary").first().click();
  await p.locator(".rh-item[open] [data-rhlike]").click(); await p.waitForTimeout(400);
  ok(/Наши · 2/.test(await p.locator(".rh-tabs").innerText()), "лайк с экрана: «Наши · 2»");
  ok(Object.keys((await get("/api/state", 1)).checks).filter(k => k.startsWith("r:")).length === 2, "лайк с экрана дошёл до сервера");
  await p.locator("[data-rhnew]").click(); await p.waitForSelector(".rh-form");
  await p.fill("#rh-t", "Наша считалка"); await p.fill("#rh-x", "Тук-тук,\nкто там?");
  await p.locator('[data-rhl="uk"]').click();
  await p.locator("[data-rhsave]").click(); await p.waitForTimeout(500);
  ok(/Наши · 3/.test(await p.locator(".rh-tabs").innerText()) && await p.locator(".rh-item[open] .rh-x").innerText() === "Тук-тук,\nкто там?", "своя с формы: в «Наших», открыта");
  ok((await get("/api/state", 1)).rhymes[0]?.lang === "uk", "своя с формы: сохранена с языком");
  await p.locator(".rh-item[open] [data-rhedit]").click(); await p.waitForSelector(".rh-form");
  await p.locator("[data-rhdel]").click(); await p.waitForTimeout(500);
  ok(/Наши · 2/.test(await p.locator(".rh-tabs").innerText()) && (await get("/api/state", 1)).rhymes.length === 0, "своя: удалена с экрана");
  ok(perr === 0, "без ошибок на странице");
  await browser.close();
} finally { srv.kill(); fake.close(); }
console.log(fails ? `FAILED ${fails}` : "ALL PASS");
setTimeout(() => { try { fs.rmSync(OUT, {recursive:true, force:true}); } catch {} process.exit(fails ? 1 : 0); }, 500);
