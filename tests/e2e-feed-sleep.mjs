// E2E: кормление (пауза, правка) и сон (два родителя, норма, режим). Поднимает server.mjs с фейковым Telegram API.
// Запуск: npm run test:e2e  (скриншоты — в shots-sleep/, база — shots-sleep.db; обе в .gitignore)
import http from "node:http";
import {spawn} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {chromium} from "playwright-core";
import {fileURLToPath} from "node:url";
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const OUT = path.resolve(process.env.SHOTS_DIR || "shots-sleep"); fs.mkdirSync(OUT, {recursive:true}); for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), {force:true});
const sent = [];
const fake = http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => {
  const m = req.url.split("/").pop(); let result = true;
  if (m === "getMe") result = {id:1, is_bot:true, username:"child_devbot"};
  try { sent.push({m, ...JSON.parse(b)}); } catch {}
  if (m.startsWith("send")) result = {message_id:77};
  res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ok:true, result}));
}); }).listen(8799);
const DB = path.resolve(process.env.SHOTS_DB || "shots-sleep.db"); for (const s of ["", "-wal", "-shm"]) try { fs.unlinkSync(DB + s); } catch {}
const srv = spawn(process.execPath, ["server.mjs"], {cwd:ROOT, stdio:["ignore", "ignore", "inherit"],
  env:{...process.env, PORT:"8798", DB_PATH:DB, BOT_TOKEN:"x", WEBHOOK_SECRET:"s", APP_URL:"http://localhost:8798", TG_API:"http://localhost:8799/bot", GATE_CHANNEL:"", DEV:"1", FEED_TICK_MS:"600000", CLOSED_GRACE_MS:"1500", ADMIN_IDS:"9"}});
await new Promise(r => setTimeout(r, 1500));
const U = "http://localhost:8798";
const post = (p, body, uid = 1) => fetch(U + p, {method:"POST", headers:{"content-type":"application/json", "x-dev-user":String(uid), "x-dev-name":"Test"}, body:JSON.stringify(body)}).then(r => r.json());
const get = (p, uid = 1) => fetch(U + p, {headers:{"x-dev-user":String(uid)}}).then(r => r.json());
const tgPost = upd => fetch(U + "/tg", {method:"POST", headers:{"content-type":"application/json", "x-telegram-bot-api-secret-token":"s"}, body:JSON.stringify({update_id:Date.now(), ...upd})});
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

const st0 = await get("/api/state");
const T = st0.today, add = (iso, k) => new Date(Date.parse(iso + "T00:00:00Z") + k * 864e5).toISOString().slice(0, 10);
await post("/api/onboard", {children:[{name:"Рита", birth:add(T, -66), sex:"girl"}], role:"mama", my_name:"Аня", color:"raspberry", modules:{}});
let st = await get("/api/state"); const kid = st.children[0].id;
ok(st.modules.sleep === true && Array.isArray(st.sleeps), "модуль сна включён по умолчанию, sleeps в состоянии");

// ---- пауза в кормлении (API + бот) ----
const {id:fid1} = await post("/api/feed/start", {child_id:kid, side:"L"});
await post("/api/feed/away", {id:fid1});                       // бот присылает таймер
ok(sent.some(x => x.m === "sendMessage" && /feedpause:/.test(JSON.stringify(x.reply_markup))), "таймер в боте: есть кнопка «Пауза»");
await wait(1200);
await post("/api/feed/pause", {id:fid1});
st = await get("/api/state"); let f = st.feeds.find(x => x.id === fid1);
ok(f.paused_at && !f.end_at, "пауза: paused_at выставлен, кормление не закрыто");
ok(sent.some(x => x.m === "editMessageText" && /на пауз/.test(x.text) && /feedresume:/.test(JSON.stringify(x.reply_markup))), "бот: сообщение стало «на паузе» с кнопкой «Продолжить»");
await wait(1500);
await post("/api/feed/resume", {id:fid1});
st = await get("/api/state"); f = st.feeds.find(x => x.id === fid1);
ok(!f.paused_at && f.pause_ms >= 1400 && f.pause_ms < 3000, `продолжили: pause_ms=${f.pause_ms}`);
// пауза кнопкой в боте → стоп кнопкой: конец = момент паузы
await tgPost({callback_query:{id:"1", from:{id:1, first_name:"Аня"}, data:`feedpause:${fid1}`, message:{chat:{id:1}, message_id:77}}});
st = await get("/api/state"); f = st.feeds.find(x => x.id === fid1); const pAt = f.paused_at;
ok(!!pAt, "бот: кнопка «Пауза» ставит на паузу");
await tgPost({callback_query:{id:"2", from:{id:1, first_name:"Аня"}, data:`feedpause:${fid1}`, message:{chat:{id:1}, message_id:77}}});
ok(sent.some(x => x.m === "answerCallbackQuery" && /^Уже на пауз/.test(x.text || "")), "повторная пауза — «Уже на паузе»");
await wait(1000);
await post("/api/feed/stop", {id:fid1});
st = await get("/api/state"); f = st.feeds.find(x => x.id === fid1);
ok(f.end_at === pAt && !f.paused_at, "закончили на паузе — конец кормления = начало паузы");

// ---- сон (API) ----
const now = Date.now(), H = 3600e3;
const nightSt = new Date(add(T, -1) + "T00:00").getTime() - 3 * H;   // позавчера 21:00 → вчера 03:00 (не зависит от времени запуска)
let r = await post("/api/sleep/add", {child_id:kid, start_at:nightSt, end_at:nightSt + 6 * H});
ok(r.ok, "сон задним числом через полночь записан");
r = await post("/api/sleep/add", {child_id:kid, start_at:now - 40 * H, end_at:now - 20 * H});
ok(r.error, "сон дольше 16 ч — отказ: " + r.error);
r = await post("/api/sleep/add", {child_id:kid, start_at:now - 2 * H, end_at:now + 2 * H});
ok(r.error, "сон в будущем — отказ");
for (let d = 1; d <= 13; d++) for (const [h, len] of [[-3, 6], [3.5, 2.5], [9.5, 1.5], [13, 1.8], [17, .6]]) {
  const b = new Date(add(T, -d) + "T00:00").getTime() + h * H; if (b + len * H < now - H) await post("/api/sleep/add", {child_id:kid, start_at:b, end_at:b + (len + (d > 7 ? -.4 : 0)) * H});
}
const {id:sid} = await post("/api/sleep/start", {child_id:kid});
st = await get("/api/state");
ok(st.sleeps.some(s => s.id === sid && !s.end_at), "старт сна: открытая запись");
const {id:sid2} = await post("/api/sleep/start", {child_id:kid});
st = await get("/api/state");
ok(st.sleeps.find(s => s.id === sid).end_at && st.sleeps.filter(s => !s.end_at).length === 1, "второй старт закрывает прошлый сон");
r = await post("/api/sleep/delete", {id:sid}, 2);
ok(!r.ok || (await get("/api/state")).sleeps.some(s => s.id === sid), "чужая семья не может удалить сон");
// свернули приложение во время сна — бот присылает таймер с кнопкой «Проснулась»
{ let n = sent.length; await post("/api/sleep/away", {id:sid2}, 2);
  ok(!sent.slice(n).some(x => x.m === "sendMessage"), "чужой away по сну — сообщения нет");
  await post("/api/sleep/away", {id:sid2});
  const m = sent.slice(n).find(x => x.m === "sendMessage");
  ok(m && /Рита (спит|спить)/.test(m.text) && /(Уснула|Заснула) в/.test(m.text) && JSON.stringify(m.reply_markup).includes(`sleepwake:${sid2}`) && /(Проснулась|Прокинулася)/.test(JSON.stringify(m.reply_markup)), "сон в боте: «Рита спит», таймер и кнопка «Проснулась»");
  n = sent.length; await post("/api/sleep/away", {id:sid2});
  ok(!sent.slice(n).some(x => x.m === "sendMessage"), "повторный away — второго сообщения нет");
  await tgPost({callback_query:{id:"5", from:{id:1, first_name:"Аня"}, data:`sleepwake:${sid2}`, message:{chat:{id:1}, message_id:77}}});
  ok((await get("/api/state")).sleeps.find(s => s.id === sid2).end_at, "кнопка «Проснулась» в боте закрывает сон");
  ok(sent.slice(n).some(x => x.m === "editMessageText" && /Сон записан/.test(x.text) && !x.reply_markup), "сообщение стало «Сон записан» без кнопок");
  ok(sent.slice(n).some(x => x.m === "answerCallbackQuery" && /^Сон записан/.test(x.text)), "ответ на кнопку — «Сон записан»");
  const {id:s3} = await post("/api/sleep/start", {child_id:kid}); await post("/api/sleep/away", {id:s3});
  n = sent.length; await post("/api/sleep/stop", {id:s3});
  ok(sent.slice(n).some(x => x.m === "editMessageText" && /Сон записан/.test(x.text)), "«Проснулась» в приложении тоже закрывает сообщение в боте");
  await post("/api/sleep/start", {child_id:kid}); }

// ---- экраны ----
// Chromium от Playwright: CHROME_PATH или стандартное место на Windows (npx playwright install chromium)
const exe = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || "", "ms-playwright/chromium-1208/chrome-win64/chrome.exe");
const browser = await chromium.launch({executablePath:exe, headless:true});
async function page({lang = "ru", theme = "light", q = "", uid = 1} = {}){
  const ctx = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:lang === "uk" ? "uk-UA" : "ru-RU", colorScheme:theme});
  await ctx.addInitScript(([l, t]) => { try { localStorage.setItem("lang", l); localStorage.setItem("theme", t); } catch {} }, [lang, theme]);
  const p = await ctx.newPage();
  p.on("pageerror", e => { console.log("PAGE ERROR", e.message); fails++; });
  await p.goto(`${U}/?dev_user=${uid}&dev_name=%D0%90%D0%BD%D1%8F${q}`, {waitUntil:"load"});
  await p.waitForSelector("#view .panel, #view .fbig", {timeout:15000});
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
  await p.evaluate(() => { const o = document.getElementById("overlay"); if (o) { o.hidden = true; o.innerHTML = ""; } });
  return p;
}
const shot = async (p, name, full) => { const fl = path.join(OUT, name); await p.screenshot({path:fl, fullPage:!!full}); console.log("  →", fl); };
const noRu = async (p, label) => { const t = await p.evaluate(() => document.body.innerText); const bad = [...new Set(t.match(/\S*[ыэъёЫЭЪЁ]\S*/g) || [])]; ok(!bad.length, label + (bad.length ? ": " + bad.slice(0, 12).join(" ") : "")); };

let p = await page();
const today = await p.textContent("#view");
ok(/спит/.test(await p.textContent(".livebar .live.sleep")), "«Сегодня»: идущий сон — в плашке «спит»");
// плашка наверху «Сегодня»: идут кормление и сон — у каждого таймер и кнопка закончить
{ const {id:lf} = await post("/api/feed/start", {child_id:kid, side:"L"});
  const pl = await page();
  ok((await pl.$$(".livebar .live")).length === 2, "плашка: две строки — кормление и сон");
  ok((await pl.textContent(".live:not(.sleep) .lv-btn")).trim() === "Поела" && /ест · левая/.test(await pl.textContent(".live:not(.sleep)")) && (await pl.textContent(".live.sleep .lv-btn")).trim() === "Проснулась", "кнопки «Поела» и «Проснулась»");
  const t1 = await pl.textContent(".live.sleep .ftimer"); await pl.waitForTimeout(1300);
  ok(t1 !== await pl.textContent(".live.sleep .ftimer"), "таймер в плашке тикает");
  await shot(pl, "17-livebar.png");
  ok(!(await pl.$('.feedstat[data-go="feed"]')) && !(await pl.$('.feedstat[data-go="sleep"]')), "идущие кормление и сон только в плашке — карточки ниже не дублируют");
  await pl.evaluate(() => window.scrollTo(0, 900)); await pl.waitForTimeout(200);
  ok(await pl.evaluate(() => { const r = document.querySelector(".livebar").getBoundingClientRect(); return r.top >= 0 && r.top < 60; }), "плашка остаётся сверху при прокрутке");
  await shot(pl, "17-livebar-scrolled.png");
  await pl.evaluate(() => window.scrollTo(0, 0));
  await pl.click(".live:not(.sleep) .lv-btn"); await pl.waitForTimeout(800);
  ok((await get("/api/state")).feeds.find(f => f.id === lf).end_at && (await pl.$$(".livebar .live")).length === 1, "«Поела» в плашке закрывает кормление, остаётся только сон");
  ok(await pl.$('.feedstat[data-go="feed"]') && !(await pl.$('.feedstat[data-go="sleep"]')), "после «Поела» карточка кормления вернулась, сна — нет (он в плашке)");
  await pl.click(".live.sleep .lv-go"); await pl.waitForTimeout(400);
  ok(await pl.isVisible("[data-sstop]") && !(await pl.$(".livebar")), "касание плашки открывает экран сна");
  await pl.context().close(); }
// «+ Добавить» в «Истории» сна и кормления: форма прямо в истории
{ const ph = await page({q:"&tab=sleep"}); const n0 = (await get("/api/state")).sleeps.length;
  await ph.click('[data-spast="hist"]'); await ph.waitForTimeout(300);
  ok(await ph.isVisible("#sp-form") && await ph.evaluate(() => !!document.querySelector("#sp-form").closest(".panel").querySelector("h2")?.textContent.includes("История")), "сон: «+ Добавить» открывает форму внутри «Истории»");
  await ph.fill("#sp-date", add(T, -2)); await ph.fill("#sp-from", "00:05"); await ph.fill("#sp-to", "00:50"); await shot(ph, "22-hist-add-sleep.png");
  await ph.click("#sp-save"); await ph.waitForTimeout(800);
  ok((await get("/api/state")).sleeps.length === n0 + 1 && !(await ph.$("#sp-form")), "сон из истории записан, форма закрылась");
  await ph.evaluate(() => document.querySelector('[data-fview="feed"]')?.click()); await ph.waitForTimeout(300);
  const f0 = (await get("/api/state")).feeds.length;
  await ph.click('[data-fpast="hist"]'); await ph.waitForTimeout(300);
  ok(await ph.isVisible("#fp-form"), "кормление: «+ Добавить» в истории открывает форму");
  await ph.fill("#fp-date", add(T, -2)); await ph.fill("#fp-time", "00:10"); await ph.fill("#fp-min", "12"); await ph.click("#fp-save"); await ph.waitForTimeout(800);
  ok((await get("/api/state")).feeds.length === f0 + 1, "кормление из истории записано");
  await ph.close(); }
ok((await p.textContent('#tabs button[data-tab="feed"]')).includes("Еда и сон"), "вкладка называется «Еда и сон»");
await p.click('.live.sleep .lv-go'); await p.waitForTimeout(400);
ok(await p.isVisible('[data-sstop]'), "плашка сна ведёт на экран сна, кнопка «Проснулась»");
ok((await p.textContent("[data-sstop]")).trim() === "Проснулась", "девочка — «Проснулась»");
await shot(p, "01-sleep-active.png");
await p.click("[data-sstop]"); await p.waitForTimeout(600);
ok(await p.isVisible("[data-sstart]") && /Не спит/.test(await p.textContent(".fbig")), "проснулась: «Уснула» и «Не спит …»");
await shot(p, "02-sleep-screen.png", true);
const grid = await p.$$eval('[data-chart="sg"] rect.sl-n, [data-chart="sg"] rect.sl-d', a => a.length);
ok(grid > 20, "режим по дням: блоков сна " + grid);
ok(/Как меняется/.test(await p.textContent("#view")) && /[↑↓≈]/.test(await p.$$eval(".srows", a => a.map(x => x.textContent).join(""))), "«Как меняется»: есть сравнение с прошлой неделей");
// касание строки режима
await p.evaluate(() => document.querySelector('[data-chart="sg"]').scrollIntoView({block:"center"})); await p.waitForTimeout(200);
const box = await (await p.$('[data-chart="sg"] svg')).boundingBox();
await p.mouse.click(box.x + box.width * .5, box.y + 10); await p.waitForTimeout(200);
ok(/ночью/.test(await p.textContent('[data-chart="sg"] .ch-head')) && !/(\d\d:\d\d)–/.test(await p.textContent('[data-chart="sg"] .ch-head')), "касание дня (без нулевых снов): " + (await p.textContent('[data-chart="sg"] .ch-head')).slice(0, 90));
await p.evaluate(() => document.querySelector('[data-chart="sb"]').scrollIntoView({block:"center"})); await p.waitForTimeout(200);
const bb = await (await p.$('[data-chart="sb"] svg')).boundingBox();
await p.mouse.click(bb.x + bb.width * .9, bb.y + bb.height * .5); await p.waitForTimeout(200);
ok(/ночью/.test(await p.textContent('[data-chart="sb"] .ch-head')), "касание столбика — ночь/день");
await p.click("[data-srange='30']"); await p.waitForTimeout(300); await p.evaluate(() => document.querySelector('[data-chart="sg"]').scrollIntoView({block:"center"}));
await shot(p, "03-sleep-month.png");
// записать задним числом через форму
await p.click("[data-spast]"); await p.fill("#sp-from", "22:00"); await p.fill("#sp-to", "01:30");
const d1 = await p.evaluate(() => { const d = new Date(Date.now() - 2 * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
await p.fill("#sp-date", d1); await p.click("#sp-save"); await p.waitForTimeout(600);
st = await get("/api/state");
ok(st.sleeps.some(s => s.end_at - s.start_at === 3.5 * H), "форма: 22:00–01:30 → 3,5 ч через полночь");
// норма сна: шкала на экране сна и блок в неделе
{
  const g = await p.textContent(".sgauge");
  ok(/14–17 ч/.test(g) && /в среднем/.test(g) && await p.$(".sg-mark"), "шкала нормы: 14–17 ч и метка среднего — " + (await p.textContent(".sg-st")));
  ok(/Дневных снов/.test(await p.textContent(".sgauge + .srows")), "под шкалой — ночь, дневные сны, бодрствование");
  await p.evaluate(() => document.querySelector(".sgauge").scrollIntoView({block:"center"})); await shot(p, "09-sleep-norm.png");
}
// правка сна карандашом
{
  const pens = await p.$$("[data-sedit]"); ok(pens.length > 5, "у каждого сна в истории есть карандаш: " + pens.length);
  await pens[0].scrollIntoViewIfNeeded(); await pens[0].click(); await p.waitForTimeout(300);
  ok(await p.isVisible("#se-save") && await p.isVisible(".fedit [data-sdel]"), "карандаш открывает форму с «Сохранить» и «Удалить»");
  await shot(p, "07-sleep-edit.png");
  const id = Number(await p.getAttribute("#se-save", "data-id"));
  await p.fill("#se-date", add(T, -3)); await p.fill("#se-from", "20:10"); await p.fill("#se-to", "02:40"); await p.click("#se-save"); await p.waitForTimeout(600);
  const s = (await get("/api/state")).sleeps.find(x => x.id === id);
  ok(s && s.end_at - s.start_at === 6.5 * H && new Date(s.start_at).getHours() === 20, "сон исправлен: 20:10–02:40 = 6,5 ч");
  ok(!(await p.$("#se-save")), "после сохранения форма закрылась");
  const r1 = await post("/api/sleep/edit", {id, start_at:s.start_at, end_at:s.start_at + 20 * H});
  ok(r1.error, "правка сна дольше 16 ч — отказ");
  await post("/api/onboard", {children:[{name:"Б", birth:add(T, -10)}], role:"mama", my_name:"Чужая", color:"blue", modules:{}}, 9);
  await post("/api/sleep/edit", {id, start_at:s.start_at - H, end_at:s.end_at}, 9);
  ok((await get("/api/state")).sleeps.find(x => x.id === id).start_at === s.start_at, "чужая семья не может править сон");
}
// правка кормления карандашом
{
  await p.click('[data-fview="feed"]'); await p.waitForTimeout(300);
  const pens = await p.$$("[data-fedit]"); ok(pens.length >= 1, "у кормлений в истории есть карандаш: " + pens.length);
  await pens[0].scrollIntoViewIfNeeded(); await pens[0].click(); await p.waitForTimeout(300);
  const id = Number(await p.getAttribute("#fe-save", "data-id"));
  await p.click('.fedit [data-feside="B"]'); await p.fill("#fe-date", add(T, -1)); await p.fill("#fe-time", "08:15"); await p.fill("#fe-min", "17"); await p.click("#fe-save"); await p.waitForTimeout(600);
  const f = (await get("/api/state")).feeds.find(x => x.id === id);
  ok(f.side === "B" && f.end_at - f.start_at === 17 * 60000 && !f.pause_ms && new Date(f.start_at).getHours() === 8, "кормление исправлено: бутылочка, 08:15, 17 мин, паузы обнулены");
  await (await p.$$("[data-fedit]"))[0].click(); await p.waitForTimeout(300);
  await shot(p, "08-feed-edit.png");
  const n0 = (await get("/api/state")).feeds.length;
  await p.click(".fedit [data-fdel]"); await p.waitForTimeout(600);
  ok((await get("/api/state")).feeds.length === n0 - 1, "«Удалить» в форме правки удаляет кормление");
  await p.click('[data-fview="sleep"]'); await p.waitForTimeout(300);
}
// пауза в приложении
await p.click('[data-fview="feed"]'); await p.waitForTimeout(300);
await p.click(".fstartbtn"); await p.waitForTimeout(600);
await p.click("[data-fpause]"); await p.waitForTimeout(600);
const t1 = await p.textContent(".ftimer.big"); await p.waitForTimeout(2200); const t2 = await p.textContent(".ftimer.big");
ok(t1 === t2 && await p.isVisible("[data-fresume]"), `на паузе таймер стоит (${t1} = ${t2}), кнопка «Продолжить»`);
await shot(p, "04-feed-paused.png");
await p.click("[data-fresume]"); await p.waitForTimeout(2200);
ok((await p.textContent(".ftimer.big")) !== t2, "продолжили — таймер снова идёт");
await p.click("[data-fstop]"); await p.waitForTimeout(500);
// календарь: часы сна
await p.close();

{ const pw = await page(); await pw.click('#tabs button[data-tab="today"]').catch(() => {}); await pw.evaluate(() => document.querySelector('[data-go="week"]')?.click()); await pw.waitForTimeout(500);
  const ws = await pw.textContent(".wsleep").catch(() => "");
  ok(/14–17 ч/.test(ws) && /Бодрствование/.test(ws), "неделя: блок «Сон в этом возрасте»");
  await pw.evaluate(() => document.querySelector(".wsleep").scrollIntoView({block:"center"})); await shot(pw, "10-week-sleep.png");
  await pw.click('.wsleep [data-go="sleep"]'); await pw.waitForTimeout(400);
  ok(await pw.isVisible(".sgauge"), "«Мой сон →» ведёт на экран сна"); await pw.close(); }
p = await page({lang:"uk", q:"&tab=sleep"});
ok(await p.isVisible("[data-sstart], [data-sstop]"), "?tab=sleep открывает сон");
await noRu(p, "uk: экран сна без русских букв");
await shot(p, "05-sleep-uk.png", true);
await p.click('[data-fview="feed"]'); await p.waitForTimeout(300); await p.click(".fstartbtn"); await p.waitForTimeout(500); await p.click("[data-fpause]"); await p.waitForTimeout(500);
await noRu(p, "uk: кормление на паузе без русских букв");
await p.close();
p = await page({theme:"dark", q:"&tab=sleep"}); await shot(p, "06-sleep-dark.png", true); await p.close();

// два родителя: один начал — второй видит таймер и заканчивает; Telegram молчит
{
  const inv = await post("/api/invite", {});
  await tgPost({message:{message_id:5, chat:{id:2, type:"private"}, from:{id:2, first_name:"Влад"}, text:`/start ${inv.link.split("start=")[1]}`}});
  const s2 = await get("/api/state", 2);
  ok(s2.members?.length === 2, "второй родитель в семье");
  for (const x of (await get("/api/state")).sleeps.filter(x => !x.end_at)) await post("/api/sleep/stop", {id:x.id});
  const p2 = await page({q:"&tab=sleep"}).then(async pp => { await pp.goto(`${U}/?dev_user=2&dev_name=%D0%92%D0%BB%D0%B0%D0%B4&tab=sleep`, {waitUntil:"load"}); await pp.waitForSelector("[data-sstart], [data-sstop]"); return pp; });
  const before = sent.length;
  const {id} = await post("/api/sleep/start", {child_id:kid}, 1);
  await p2.waitForSelector("[data-sstop]", {timeout:8000}).catch(() => {});
  ok(await p2.isVisible("[data-sstop]"), "второй родитель без перезагрузки видит идущий сон");
  ok(/Аня/.test(await p2.textContent(".fbig")), "видно, кто начал: " + (await p2.textContent(".fbig .eyebrow")));
  const ta = await p2.textContent(".fbig .ftimer"); await p2.waitForTimeout(2500);
  { const tb = await p2.textContent(".fbig .ftimer"); ok(ta !== tb, `таймер у второго тикает: ${ta} → ${tb}`); }
  ok(!sent.slice(before).some(x => x.m === "sendMessage" && Number(x.chat_id) === 2), "второму родителю в Telegram ничего не отправлено");
  await p2.click("[data-sstop]"); await p2.waitForTimeout(600);
  const z = (await get("/api/state")).sleeps.find(x => x.id === id);
  ok(z.end_at && z.by_user === 1, "второй родитель закончил сон, начатый первым");
  await shot(p2, "11-parent2.png");
  // сон дольше часа: «2 ч 14 мин 05 сек»
  const {DatabaseSync} = await import("node:sqlite");
  const db = new DatabaseSync(DB); const fam = db.prepare("SELECT family_id FROM children WHERE id=?").get(kid).family_id;
  db.prepare("INSERT INTO sleeps(family_id,child_id,start_at,end_at,by_user,created) VALUES(?,?,?,NULL,2,?)").run(fam, kid, Date.now() - (2 * 3600 + 14 * 60 + 5) * 1000, Date.now()); db.close();
  await p2.reload({waitUntil:"load"}); await p2.waitForSelector("[data-sstop]");
  const tl = await p2.textContent(".fbig .ftimer");
  ok(/^2 ч 14 мин \d\d сек$/.test(tl.trim()), "длинный сон: «" + tl.trim() + "»");
  await shot(p2, "12-long-timer.png");
  await p2.close();
  const pu = await page({lang:"uk", q:"&tab=sleep"}); const tu = await pu.textContent(".fbig .ftimer");
  ok(/^2 год 14 хв \d\d сек$/.test(tu.trim()), "uk: «" + tu.trim() + "»"); await pu.close();
}
// только сон, без кормления
await post("/api/modules", {feeding:false, sleep:true, vaccines:true, growth:true, orders:true}).catch(() => {});
st = await get("/api/state");
if (st.modules.feeding === false) {
  p = await page();
  ok((await p.textContent('#tabs button[data-tab="feed"]')).includes("Сон") && !(await p.$("[data-fview]")), "только сон: вкладка «Сон», без переключателя");
  await p.close();
} else console.log("SKIP модули: не нашёл, как их выключить через API");

// демо
p = await page({q:"&demo=1"}).catch(() => null);
if (p) { await p.evaluate(() => {}); await p.close(); }

// «Помнить весь день»: не в рутине и не в счёте, мягким блоком под ней; в боте — одной строкой
{
  const pr = await page();
  const rt = await pr.textContent("#routine .group, #routine").catch(() => "");
  const checks = await pr.$$eval("#routine .group", gs => gs.map(g => g.textContent).join(" "));
  ok(!/Воздух в спальне|День и ночь|Комментировать день/.test(checks), "в рутине с отметками нет «Воздух в спальне», «День и ночь», «Комментировать день»");
  const rm = await pr.textContent("#routine .remind").catch(() => "");
  ok(/Помнить весь день/.test(rm) && /Воздух в спальне/.test(rm) && /День и ночь/.test(rm) && /Зачем:/.test(rm) && !(await pr.$("#routine .remind input, #routine .remind .cb")), "блок «Помнить весь день» — без отметок, с пунктами и «зачем»");
  const prog = await pr.textContent("#routine .prog"); const nRows = await pr.$$eval("#routine .group .row", a => a.length);
  ok(prog.trim().endsWith("/" + nRows), `счёт рутины только по делам: ${prog.trim()} при ${nRows} пунктах`);
  await pr.evaluate(() => document.querySelector("#routine .remind").scrollIntoView({block:"center"})); await shot(pr, "16-remind.png");
  await pr.close();
  const n0 = sent.length;
  await tgPost({message:{message_id:11, chat:{id:1, type:"private"}, from:{id:1, first_name:"Аня"}, text:"/today"}});
  const msg = sent.slice(n0).find(x => x.m === "sendMessage")?.text || "";
  ok(/(Весь день помнить|Весь день пам)/.test(msg) && !/• Воздух в спальне|• Повітря/.test(msg), "бот /today: напоминания одной строкой, не пунктами");
  ok((msg.match(/^• /gm) || []).length >= 3, "бот /today (сам спросил): рутина пунктами");
  // отзывы: разработчик лайкает и отвечает из бота — человек видит это в приложении и получает сообщение
  { const toMe = k => sent.slice(k).filter(x => x.m === "sendMessage" && Number(x.chat_id) === 1);
    let k = sent.length; await post("/api/feedback", {kind:"idea", text:"Хочу ночную тему потемнее"});
    const fb = (await post("/api/feedback/mine", {})).items.find(i => i.text === "Хочу ночную тему потемнее");
    const adm = sent.slice(k).find(x => x.m === "sendMessage" && Number(x.chat_id) === 9);
    ok(fb && adm && /fb:like:/.test(JSON.stringify(adm.reply_markup)) && /fb:reply:/.test(JSON.stringify(adm.reply_markup)), "админу пришло предложение с кнопками «Нравится» и «Ответить»");
    k = sent.length; await tgPost({callback_query:{id:"7", from:{id:9, first_name:"Dev"}, data:`fb:like:${fb.id}`, message:{chat:{id:9}, message_id:5, reply_markup:adm.reply_markup}}});
    ok(toMe(k).some(x => /понравил|сподобал/i.test(x.text) && /ночную тему|нічну тему|ночную/.test(x.text)), "лайк: человеку пришло «понравилось» с его текстом");
    k = sent.length; await tgPost({callback_query:{id:"8", from:{id:9, first_name:"Dev"}, data:`fb:reply:${fb.id}`, message:{chat:{id:9}, message_id:5}}});
    const ask = sent.slice(k).find(x => x.m === "sendMessage" && Number(x.chat_id) === 9 && x.reply_markup?.force_reply);
    ok(ask && new RegExp(`№${fb.id}`).test(ask.text), "«Ответить»: бот просит текст ответа (force reply)");
    k = sent.length; await tgPost({message:{message_id:30, chat:{id:9, type:"private"}, from:{id:9, first_name:"Dev"}, text:"Уже в работе, будет в ноябре", reply_to_message:{message_id:6, from:{id:1, is_bot:true}, text:ask?.text || ""}}});
    ok(toMe(k).some(x => /Уже в работе, будет в ноябре/.test(x.text) && /tab=feedback/.test(JSON.stringify(x.reply_markup))), "ответ ушёл человеку в бот с кнопкой «Открыть мои сообщения»");
    const mine = (await post("/api/feedback/mine", {})).items.find(i => i.id === fb.id);
    ok(mine.liked === 1 && mine.reply === "Уже в работе, будет в ноябре" && mine.status === "seen", "в базе: нравится, ответ, статус «прочитано»");
    const pf = await page({q:"&tab=feedback"}); await pf.waitForSelector(".fb-reply", {timeout:8000}).catch(() => {});
    ok(await pf.isVisible(".fb-liked") && /Уже в работе/.test(await pf.textContent(".fb-reply")), "в приложении: «Нравится разработчику» и ответ разработчика");
    await pf.evaluate(() => document.querySelector(".fb-reply")?.scrollIntoView({block:"center"})); await shot(pf, "21-feedback-reply.png"); await pf.close(); }
  // /web: ролик-инструкция с текстом и кнопкой «Открыть в браузере» в подписи
  { const k = sent.length; await tgPost({message:{message_id:12, chat:{id:1, type:"private"}, from:{id:1, first_name:"Аня"}, text:"/web"}});
    const a = sent.slice(k).find(x => x.m === "sendAnimation");
    ok(a && /\/media\/howto-pwa-(ru|uk)\.mp4$/.test(a.animation) && /Safari/.test(a.caption) && /[?&]k=/.test(JSON.stringify(a.reply_markup)), "/web: ролик-инструкция, текст и личная ссылка в кнопке");
    const v = await fetch(a ? a.animation : U + "/media/howto-pwa-ru.mp4");
    ok(v.ok && /video\/mp4/.test(v.headers.get("content-type") || "") && Number(v.headers.get("content-length") || 1e6) > 100e3, "ролик отдаётся сервером: " + v.status + " " + v.headers.get("content-type")); }
  // утреннее сообщение: без списка дел и без «второй родитель увидит»; можно выключить себе
  const daily = async () => { const k = sent.length; await fetch(`${U}/run-daily?key=s&family=1`); return sent.slice(k).filter(x => x.m === "sendMessage" && Number(x.chat_id) === 1 && /Доброе утро|Доброго ранку/.test(x.text || "")); };
  await daily();   // в день новой недели вместо утреннего приходит карточка недели — первый прогон её забирает
  let dm = await daily();
  ok(dm.length === 1 && !/^• /m.test(dm[0].text) && !/второй родитель|другий з батьків/.test(dm[0].text), "утро: без списка рутины и без «второй родитель увидит»");
  await post("/api/prefs", {morning:false});
  ok((await get("/api/state")).prefs.morning === false, "настройка «Утреннее сообщение» выключена");
  ok(!(await daily()).length, "выключил утро — утреннего сообщения нет");
  await post("/api/prefs", {morning:true});
  ok((await daily()).length === 1, "включил обратно — пришло");
  const ps = await page(); await ps.click("#family-open"); await ps.waitForTimeout(300);
  ok((await ps.$$(".set-ic svg")).length >= 8 && !/\p{Extended_Pictographic}/u.test(await ps.$$eval(".set-ic", a => a.map(x => x.textContent).join(""))), "настройки: рисованные иконки вместо эмодзи");
  await shot(ps, "18-settings.png");
  { const pd = await page({theme:"dark"}); await pd.click("#family-open"); await pd.waitForTimeout(300); await shot(pd, "18-settings-dark.png"); await pd.close(); }
  await ps.click('[data-setsec="install"]'); await ps.waitForTimeout(400);
  ok(await ps.$('[data-demo="pwa"] .fq-fr') && await ps.evaluate(() => !!document.querySelector('[data-demo="pwa"]')?.dataset.mounted || document.querySelectorAll('[data-demo="pwa"] .fq-fr.on').length === 1), "«На главный экран»: та же анимация-инструкция");
  await ps.evaluate(() => document.querySelector('[data-demo="pwa"]').scrollIntoView({block:"center"})); await ps.waitForTimeout(300); await shot(ps, "23-install-demo.png");
  await ps.click('[data-setsec=""]').catch(() => {}); await ps.waitForTimeout(300);
  await ps.click('[data-setsec="modules"]'); await ps.waitForTimeout(300);
  ok(await ps.isVisible('input[data-pref="morning"]') && await ps.isChecked('input[data-pref="morning"]'), "в «Что ведём» есть переключатель утреннего сообщения");
  await ps.click('input[data-pref="morning"] + i').catch(() => ps.uncheck('input[data-pref="morning"]')); await ps.waitForTimeout(500);
  ok((await get("/api/state")).prefs.morning === false, "переключатель в приложении выключает утро");
  await post("/api/prefs", {morning:true}); await ps.close();
  // «Скоро в рутине»: будущие этапы серым, с недели N и почему; прикорм раньше срока не включается
  { const pr2 = await page(); await pr2.click("#family-open"); await pr2.waitForTimeout(300); await pr2.click('[data-setsec="routine"]'); await pr2.waitForTimeout(300);
    const soon = await pr2.$$(".rs-row.soon"); ok(soon.length >= 5 && /с недели \d+/.test(await pr2.textContent(".rs-row.soon")), "настройка рутины: блок «Скоро в рутине» с неделей: " + soon.length);
    await pr2.click('[data-rsopen="soon:gymn:13"]'); await pr2.waitForTimeout(300);
    const t = await pr2.textContent(".rs-row.soon.open");
    ok(/Почему с этой недели/.test(t) && /фитбол/i.test(t) && await pr2.isVisible(".rs-row.soon.open [data-rearly]"), "пункт «Скоро»: почему, нужная вещь, «Включить сейчас»");
    await shot(pr2, "19-routine-soon.png");
    { const st = await pr2.evaluate(() => { const o = document.querySelector(".rs-row.soon.open"), c = document.querySelector(".rs-row.soon:not(.open)");
        return {open:getComputedStyle(o.querySelector(".rs-chev")).transform, closed:getComputedStyle(c.querySelector(".rs-chev")).transform,
          scroll:getComputedStyle(o.querySelector(".rs-in")).overflowY, hiddenH:c.querySelector(".rs-edit").getBoundingClientRect().height, inert:c.querySelector(".rs-edit").inert}; });
      ok(st.open !== "none" && st.closed === "none" && st.scroll === "auto" && st.hiddenH < 1 && st.inert, "карточка: стрелка повёрнута у открытой, у закрытой — вправо; внутри скролл; закрытая свёрнута: " + JSON.stringify(st)); }
    await pr2.click('[data-rsopen="soon:gymn:13"]'); await pr2.waitForTimeout(400);
    ok(!(await pr2.$(".rs-row.soon.open")), "повторное нажатие сворачивает карточку");
    await pr2.click('[data-rsopen="soon:gymn:13"]'); await pr2.waitForTimeout(400);
    await pr2.evaluate(() => document.querySelector("details.rs-hid")?.setAttribute("open", ""));
    await pr2.click('[data-rsopen="soon:feed:25"]'); await pr2.waitForTimeout(300);
    ok(!(await pr2.$(".rs-row.soon.open [data-rearly]")) && /педиатр/.test(await pr2.textContent(".rs-row.soon.open")), "прикорм раньше срока не включить");
    await pr2.close(); }
  // вещь ↔ рутина: фитбол есть → «Уже есть — включить сейчас» → этап гимнастики с фитболом сегодня в рутине
  { const pg = await page({q:"&tab=orders"}); await pg.waitForSelector("#g-fitball .g-rt", {timeout:8000}).catch(() => {});
    const rt = await pg.textContent("#g-fitball .g-rt").catch(() => "");
    ok(/В рутине с \d/.test(rt) && /Гимнастика/.test(rt), "у вещи: когда появится в рутине — " + rt.trim());
    await pg.click("#glater summary"); await pg.waitForTimeout(300);
    const nLater = (await pg.$$("#glater .row.grow")).length, months = (await pg.$$("#glater .g-month")).length;
    ok(nLater > 10 && months >= 4 && (await pg.$$("#glater .g-why")).length > 5, `«Дальше по плану»: весь год — ${nLater} вещей, ${months} месяцев, с подсказками`);
    await pg.evaluate(() => document.querySelector("#glater").scrollIntoView({block:"start"})); await shot(pg, "26-things-year.png");
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.click('[data-id="o:fitball"]'); await pg.waitForTimeout(1200);
    ok(await pg.isVisible(".rt-ask") && /появится сам/.test(await pg.textContent(".rt-ask")), "отметил «есть» — предложение включить в рутину сейчас");
    await shot(pg, "20-gear-ask.png");
    await pg.click(".rt-ask [data-rearly]"); await pg.waitForTimeout(800);
    const cfg = (await get("/api/state")).routine;
    ok(cfg.adj?.gymn?.early === 13 && !(await pg.$(".rt-ask")), "«Включить сейчас» сохранено: гимнастика с этапа 13, плашка ушла");
    await pg.close();
    const pt2 = await page(); ok(/Фитбол 5 минут/.test(await pt2.textContent("#routine")), "в сегодняшней рутине — этап с фитболом"); await pt2.close();
    await post("/api/routine", {...cfg, adj:{}}); }
  // бот «Пора заказать»: у вещи — когда появится в рутине
  { const n = sent.length; await fetch(`${U}/run-daily?key=s&family=1`);
    const om = sent.slice(n).find(x => x.m === "sendMessage" && /Пора заказать|Час замовити/.test(x.text || ""));
    ok(!om || /в рутине с|у рутині з/.test(om.text) || !/Фитбол|Фітбол/.test(om.text), "бот: «Пора заказать» говорит, когда вещь появится в рутине" + (om ? "" : " (пуш уже был)")); }
  const pt = await page({q:"&tab=today"});
  const tile = await pt.textContent('.tile[data-go="today-r"]');
  ok(/пунктов · ритм дня/.test(tile) && !/\d+\/\d+/.test(tile), "плитка рутины без дроби: «" + tile.trim().replace(/\s+/g, " ") + "»");
  ok(await pt.isVisible(".nb-hint"), "под рутиной подпись «Отмечай, если хочется»");
  await pt.close();
  const pu = await page({lang:"uk"}); await noRu(pu, "uk: «Сегодня» с блоком напоминаний без русских букв"); await pu.close();
}
// FAQ: вопрос про приложение на главном экране с раскадровкой
{
  const pf = await page({q:"&tab=faq"});
  await pf.click('[data-fq="pwa"]'); await pf.waitForTimeout(400);
  const fr = await pf.$$eval('[data-demo="pwa"] .fq-fr', a => a.length);
  ok(fr === 9, "FAQ «Можно открывать без Telegram»: 9 кадров анимации");
  ok(await pf.$eval('[data-demo="pwa"] .fq-fr:nth-child(1) .m-tgb', el => el.children.length === 0) && /data-type/.test(await pf.$eval('[data-demo="pwa"] .fq-fr:nth-child(1)', el => el.innerHTML)), "кадр 1: чат пустой, /web только набирается");
  ok(await pf.$('[data-demo="pwa"] .fq-fr:nth-child(7) .m-login') && /4821/.test(await pf.textContent('[data-demo="pwa"] .fq-fr:nth-child(8)')), "кадры 7–8: вход через Telegram с кодом");
  await pf.evaluate(() => document.querySelector('[data-demo="pwa"]').scrollIntoView({block:"center"}));
  for (const i of [2, 3, 5]) { await pf.click(`[data-demo="pwa"] [data-fqstep="${i}"]`); await pf.waitForTimeout(900); await shot(pf, `13-faq-pwa-${i}.png`); }
  ok(await pf.$eval('[data-demo="pwa"] .fq-fr:nth-child(6) img', im => im.complete && im.naturalWidth > 0), "иконка приложения на «рабочем столе» загрузилась");
  await pf.close();
  const pu = await page({lang:"uk", q:"&tab=faq"}); await pu.click('[data-fq="pwa"]'); await pu.waitForTimeout(400);
  await noRu(pu, "uk: FAQ про иконку без русских букв"); await pu.close();
}
// Закрыли приложение совсем (запрос «свернули» не ушёл) — сервер сам видит, что потоков у человека нет, и шлёт таймер
{ const {id:cf} = await post("/api/feed/start", {child_id:kid, side:"R"});
  const isMsg = x => x.m === "sendMessage" && JSON.stringify(x.reply_markup || "").includes(`feedstop:${cf}`);
  const a = await page(), b = await page(); await wait(500);
  await a.evaluate(() => { const f = window.fetch; window.fetch = (u, o) => String(u).includes("/away") ? Promise.resolve(new Response("{}")) : f(u, o); });
  let n = sent.length; await a.context().close(); await wait(2500);
  ok(!sent.slice(n).some(isMsg), "закрыли одно окно, другое открыто — сообщения нет");
  // запрос «свернули» из приложения глушим: как будто Telegram убил окно раньше, чем он ушёл
  await b.evaluate(() => { const f = window.fetch; window.fetch = (u, o) => String(u).includes("/away") ? Promise.resolve(new Response("{}")) : f(u, o); });
  n = sent.length; await b.context().close(); await wait(2500);
  ok(sent.slice(n).filter(isMsg).length === 1, "закрыли последнее окно — бот прислал таймер кормления (один раз)");
  await post("/api/feed/stop", {id:cf}); }
// источники и видео в медицинских статьях
{ const pa = await page({q:"&art=" + encodeURIComponent("g:bf-lifestyle")}); await pa.waitForSelector(".srcs", {timeout:8000}).catch(() => {});
  const links = await pa.$$eval(".srcs a", a => a.map(x => x.href));
  ok(links.length >= 2 && links.some(u => /cdc\.gov|nhs\.uk/.test(u)), "статья про алкоголь при ГВ: источники CDC/NHS — " + links.length);
  await pa.evaluate(() => document.querySelector(".srcs").scrollIntoView({block:"center"})); await shot(pa, "24-sources.png"); await pa.close();
  const pc = await page({q:"&art=" + encodeURIComponent("fa:cpr")}); await pc.waitForSelector(".yt", {timeout:8000}).catch(() => {});
  ok(/youtube\.com\/watch\?v=[\w-]{11}/.test(await pc.getAttribute(".yt", "href") || "") && await pc.$(".srcs"), "«Не дышит»: видео-инструкция и источники");
  await pc.evaluate(() => document.querySelector(".yt").scrollIntoView({block:"center"})); await shot(pc, "25-video.png"); await pc.close(); }
// мальчик: тексты про ребёнка в мужском роде (ru и uk), статьи по полу, карточка недели для мальчика
{ await post("/api/lang", {lang:"ru"}, 7);
  await post("/api/onboard", {children:[{name:"Миша", birth:add(T, -66), sex:"boy"}], role:"papa", my_name:"Олег", color:"blue", modules:{}}, 7);
  const pb = await page({uid:7, q:"&art=" + encodeURIComponent("fa:choke")}); await pb.waitForSelector(".art-body", {timeout:8000});
  const tb = await pb.textContent(".art-body");
  ok(/Положи его лицом вниз/.test(tb) && !/Положи её/.test(tb), "мальчик: «Подавилась» — «Положи его лицом вниз»");
  await pb.goto(`${U}/?dev_user=7&dev_name=O&tab=today`); await pb.waitForSelector("#view .panel", {timeout:8000}); await pb.waitForTimeout(600);
  await pb.evaluate(() => document.querySelector('#tabs button[data-tab="tips"]')?.click()); await pb.waitForTimeout(600);
  const tips = await pb.textContent("#view");
  ok(/Гигиена мальчика/.test(tips) && !/Гигиена девочки/.test(tips), "мальчик: в «Советах» гигиена мальчика, без гигиены девочки");
  await pb.close();
  await post("/api/lang", {lang:"uk"}, 7);   // язык и на сервере: иначе приложение подстраивается под сервер и перезагружается
  const pu = await page({uid:7, lang:"uk", q:"&art=" + encodeURIComponent("fa:choke")}); await pu.waitForSelector(".art-body", {timeout:8000});
  ok(/Поклади його/.test(await pu.textContent(".art-body")), "мальчик uk: «Поклади його обличчям донизу»"); await pu.close();
  await post("/api/lang", {lang:"ru"}, 7);
  const pg = await page({q:"&art=" + encodeURIComponent("fa:choke")}); await pg.waitForSelector(".art-body", {timeout:8000});
  ok(/Положи её/.test(await pg.textContent(".art-body")), "девочка: по-прежнему «Положи её»"); await pg.close();
  // бот: карточка недели для мальчика и мужской род в тексте
  const {DatabaseSync} = await import("node:sqlite"); const fam = new DatabaseSync(DB).prepare("SELECT family_id FROM members WHERE user_id=7").get().family_id;
  const k = sent.length; await fetch(`${U}/run-daily?key=s&family=${fam}`);
  const card = sent.slice(k).find(x => x.m === "sendPhoto" && Number(x.chat_id) === 7);
  ok(card && /\/cards\/boy\/w10\.png/.test(card.photo), "бот: мальчику — карточка недели из cards/boy/ (" + (card?.photo || "нет") + ")");
  const cardG = sent.slice(0).find(x => x.m === "sendPhoto" && Number(x.chat_id) === 1 && /w\d\d\.png/.test(x.photo));
  ok(!cardG || !/\/boy\//.test(cardG.photo), "бот: девочке карточка без boy/"); }
// Вход через Telegram в приложении на главном экране: сервер без DEV — как на проде
{
  const DB2 = path.resolve((process.env.SHOTS_DB || "shots-sleep.db") + ".login"); for (const x of ["", "-wal", "-shm"]) try { fs.unlinkSync(DB2 + x); } catch {}
  const srv2 = spawn(process.execPath, ["server.mjs"], {cwd:ROOT, stdio:["ignore", "ignore", "inherit"],
    env:{...process.env, PORT:"8797", DB_PATH:DB2, BOT_TOKEN:"x", WEBHOOK_SECRET:"s", APP_URL:"http://localhost:8797", TG_API:"http://localhost:8799/bot", GATE_CHANNEL:"", DEV:"", FEED_TICK_MS:"600000"}});
  await wait(1500);
  const U2 = "http://localhost:8797", tg2 = upd => fetch(U2 + "/tg", {method:"POST", headers:{"content-type":"application/json", "x-telegram-bot-api-secret-token":"s"}, body:JSON.stringify({update_id:Date.now(), ...upd})});
  const ctx = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:"ru-RU"});
  await ctx.addInitScript(() => { try { localStorage.setItem("lang", "ru"); } catch {} });
  const pl = await ctx.newPage(); pl.on("pageerror", e => { console.log("PAGE ERROR", e.message); fails++; });
  await pl.goto(U2 + "/?pwa=1", {waitUntil:"load"}); await pl.waitForSelector("[data-wlgo]", {timeout:10000}).catch(() => {});
  const href = await pl.getAttribute("[data-wlgo]", "href").catch(() => null), code = (await pl.textContent(".wl-code b").catch(() => "")).trim();
  ok(/^https:\/\/t\.me\/child_devbot\?start=wl_[A-Za-z0-9_-]{16,32}$/.test(href || "") && /^\d{4}$/.test(code), `экран входа: ссылка в бота и код ${code}`);
  await shot(pl, "14-login.png");
  const id = href.split("wl_")[1], n0 = sent.length;
  await tg2({message:{message_id:7, chat:{id:1, type:"private"}, from:{id:1, first_name:"Аня"}, text:`/start wl_${id}`}});
  const ask = sent.slice(n0).find(x => x.m === "sendMessage" && /wl:/.test(JSON.stringify(x.reply_markup || {})));
  ok(ask && ask.text.includes(code) && JSON.stringify(ask.reply_markup).includes(code), "бот показал тот же код и кнопку «Войти»");
  const claimNo = await fetch(U2 + "/api/web/login/claim", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({id, secret:"x".repeat(43)})}).then(r => r.status);
  ok(claimNo === 410, "чужой секрет — вход не отдаётся");
  await tg2({callback_query:{id:"9", from:{id:1, first_name:"Аня"}, data:`wl:${id}`, message:{chat:{id:1}, message_id:78}}});
  await pl.bringToFront(); await pl.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await pl.waitForFunction(() => { try { return !!localStorage.getItem("wt"); } catch { return false; } }, null, {timeout:10000}).catch(() => {});
  await pl.waitForTimeout(1500);
  const txt = await pl.textContent("#view");
  ok(!/Вход через Telegram/.test(txt) && await pl.evaluate(() => !!localStorage.getItem("wt")), "после «Войти» в боте приложение вошло само: " + txt.trim().slice(0, 60));
  await shot(pl, "15-after-login.png");
  await tg2({callback_query:{id:"10", from:{id:1, first_name:"Аня"}, data:`wl:${id}`, message:{chat:{id:1}, message_id:78}}});
  ok(sent.some(x => x.m === "answerCallbackQuery" && /устарел|застар/.test(x.text || "")), "повторное «Войти» по той же заявке — устарела");
  const n1 = sent.length; await tg2({message:{message_id:8, chat:{id:1, type:"private"}, from:{id:1, first_name:"Аня"}, text:"/start wl_AAAAAAAAAAAAAAAAAAAAAA"}});
  ok(sent.slice(n1).some(x => /устарел|застар/.test(x.text || "")), "несуществующая заявка — бот говорит, что устарела");
  await ctx.close(); srv2.kill();
}
// ---------- админка ----------
{
  ok((await get("/api/admin/users", 1)).error, "админка: обычному пользователю — отказ");
  await tgPost({message:{message_id:31, chat:{id:555, type:"private"}, from:{id:555, first_name:"Новенький", username:"newbie_test", language_code:"uk"}, text:"/start"}});
  { const w = sent.filter(x => x.chat_id === 555 && x.m === "sendAnimation").pop();
    ok(w && /welcome-uk\.mp4/.test(w.animation) && /Привіт! Це «Перший рік»/.test(w.caption) && /lang:ru/.test(JSON.stringify(w.reply_markup)), "приветствие: ролик, текст по-украински и кнопка «Русский язык»");
    const k0 = sent.length; await tgPost({callback_query:{id:"51", from:{id:555, first_name:"Новенький"}, data:"lang:ru", message:{chat:{id:555}, message_id:40}}});
    const e = sent.slice(k0).find(x => x.m === "editMessageMedia");
    ok(e && /welcome-ru\.mp4/.test(e.media.media) && /Привет! Это «Первый год»/.test(e.media.caption) && /lang:uk/.test(JSON.stringify(e.reply_markup)), "приветствие: «Русский язык» — то же сообщение по-русски, кнопка обратно");
    ok(/<title>Админка/.test(await fetch(U + "/admin").then(r => r.text())), "/admin отдаёт страницу админки"); }
  const L = await get("/api/admin/users", 9);
  const u1 = L.users?.find(u => u.user_id === 1), nb = L.users?.find(u => u.user_id === 555);
  ok(u1 && u1.family_id && u1.kids.length && u1.week, "админка: в списке родитель с семьёй, ребёнком и активностью за неделю");
  ok(nb && nb.username === "newbie_test" && !nb.family_id && nb.first_seen > Date.now() - 60e3, "админка: новый человек из бота виден сразу, с @username и без семьи");
  const D = await get("/api/admin/user?id=1", 9);
  ok(D.family?.members?.length && D.family.children.length && Array.isArray(D.family.checks) && D.family.totals.feeds > 0 && D.family.modules, "админка: детали — родители, дети, отметки, кормления, что ведут");
  let k = sent.length;
  const inv = await post("/api/admin/invite", {family_id:D.family.id, send:true}, 9);
  if (D.family.members.length >= 2) ok(/двое/.test(inv.error || ""), "админка: в полной семье приглашение не создаётся");
  else {
    ok(/^https:\/\/t\.me\/child_devbot\?start=inv_/.test(inv.link || ""), "админка: ссылка-приглашение за основного родителя");
    ok(sent.slice(k).some(x => x.m === "sendMessage" && (x.text || "").includes(inv.link)), "админка: ссылка ушла основному родителю в бот");
  }
  k = sent.length; await post("/api/feedback", {kind:"issue", text:"<img src=x onerror=alert(1)> не грузится вкладка"});
  const fbs = await get("/api/admin/feedback", 9), bad = fbs.items?.find(i => i.text.startsWith("<img"));
  ok(bad && bad.status === "new", "админка: отзыв в общем списке");
  k = sent.length; const done = await post("/api/admin/feedback", {id:bad.id, act:"done"}, 9);
  ok(done.item?.status === "done" && sent.slice(k).some(x => x.chat_id === 1 && /учли|врахували/.test(x.text || "")), "админка: «Сделано» — человеку спасибо в бот");
  k = sent.length; await post("/api/admin/feedback", {id:bad.id, act:"reply", text:"Починили, обновите приложение"}, 9);
  ok(sent.slice(k).some(x => x.chat_id === 1 && /Починили/.test(x.text || "")), "админка: ответ из админки ушёл человеку");
  k = sent.length; await tgPost({message:{message_id:32, chat:{id:9, type:"private"}, from:{id:9, first_name:"Dev"}, text:"/admin"}});
  ok(sent.slice(k).some(x => /8798\/admin"/.test(JSON.stringify(x.reply_markup || {}))), "/admin: кнопка открыть админку");
  k = sent.length; await tgPost({message:{message_id:33, chat:{id:1, type:"private"}, from:{id:1, first_name:"Аня"}, text:"/admin"}});
  ok(!sent.slice(k).some(x => /8798\/admin"/.test(JSON.stringify(x.reply_markup || {}))), "/admin не админу — без админки");
  // страница
  const ctx = await browser.newContext({viewport:{width:390, height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:"ru-RU"});
  const pa = await ctx.newPage(); let perr = 0; pa.on("pageerror", e => { console.log("PAGE ERROR", e.message); perr++; });
  pa.on("dialog", d => { perr++; d.dismiss(); });
  await pa.goto(U + "/admin?dev_user=9", {waitUntil:"load"}); await pa.waitForSelector("[data-user]", {timeout:8000}).catch(() => {});
  ok(await pa.$$eval("[data-user]", a => a.length) >= 2 && /новых за 7 дней/.test(await pa.textContent("#ad")), "страница админки: список и цифры");
  await shot(pa, "30-admin-list.png", true);
  await pa.click('[data-user="1"]'); await pa.waitForSelector("text=Родители", {timeout:8000}).catch(() => {});
  const dtx = await pa.textContent("#ad");
  ok(/Родители/.test(dtx) && /Что ведут/.test(dtx) && /Последние отметки/.test(dtx), "страница админки: карточка пользователя");
  await shot(pa, "31-admin-user.png", true);
  await pa.click('[data-go="fb"]'); await pa.waitForSelector("[data-fbid]", {timeout:8000}).catch(() => {});
  await pa.click('[data-fbfilter="all"]');
  ok(!(await pa.$("#ad img")) && /<img src=x/.test(await pa.textContent("#ad")), "страница админки: текст отзыва экранирован");
  await shot(pa, "32-admin-fb.png", true);
  ok(!perr, "страница админки: без ошибок");
  await ctx.close();
  const pn = await (await browser.newContext()).newPage(); await pn.goto(U + "/admin?dev_user=1", {waitUntil:"load"}); await pn.waitForTimeout(1500);
  ok(/Только для администратора/.test(await pn.textContent("#ad")), "страница админки: не админу — отказ");
}
await browser.close(); srv.kill(); fake.close();
console.log(fails ? `FAILS: ${fails}` : "ALL PASS"); process.exit(fails ? 1 : 0);
