// npm run test:widgets. Путь виджета: кормление → sendWidget → кнопки внутри (widget_query) → состояние; /month; откат на старое при ошибке.
import {spawn} from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const BOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), OUT = fs.mkdtempSync(path.join(os.tmpdir(), "rita-widgets-"));
const calls = []; let mid = 100, failWidget = false;
const fake = http.createServer((req, res) => { let b = ""; req.on("data", c => b += c); req.on("end", () => {
  const m = req.url.split("/").pop(); let body = {}; try { body = JSON.parse(b); } catch {}
  calls.push({m, body});
  let out = {ok:true, result:true};
  if (m === "getMe") out.result = {id:1, is_bot:true, username:"child_devbot"};
  if (m === "sendWidget" && failWidget) out = {ok:false, description:"Bad Request: method not found"};
  else if (m.startsWith("send")) out.result = {message_id:++mid};
  res.setHeader("content-type", "application/json"); res.end(JSON.stringify(out));
}); }).listen(8789);
const DB = path.join(OUT, `w${Date.now()}.db`); for (const s of ["", "-wal", "-shm"]) try { fs.unlinkSync(DB + s); } catch {}
const srv = spawn(process.execPath, ["server.mjs"], {cwd:BOT, stdio:["ignore", "ignore", "inherit"],
  env:{...process.env, PORT:"8788", DB_PATH:DB, BOT_TOKEN:"x", WEBHOOK_SECRET:"s", APP_URL:"http://localhost:8788", TG_API:"http://localhost:8789/bot", GATE_CHANNEL:"", DEV:"1", FEED_TICK_MS:"600000", ADMIN_IDS:"1"}});
await new Promise(r => setTimeout(r, 1500));
const U = "http://localhost:8788";
const post = (p, body, uid) => fetch(U + p, {method:"POST", headers:{"content-type":"application/json", "x-dev-user":String(uid), "x-dev-name":"T"}, body:JSON.stringify(body)}).then(r => r.json());
const get = (p, uid) => fetch(U + p, {headers:{"x-dev-user":String(uid)}}).then(r => r.json());
const tgPost = upd => fetch(U + "/tg", {method:"POST", headers:{"content-type":"application/json", "x-telegram-bot-api-secret-token":"s"}, body:JSON.stringify({update_id:Date.now(), ...upd})});
let fails = 0; const ok = (c, n) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails++; };
const last = m => calls.filter(c => c.m === m).at(-1);
const wait = ms => new Promise(r => setTimeout(r, ms));
let qn = 0;
const wq = async (uid, msg, data) => { const n = calls.length; await tgPost({widget_query:{id:"q" + ++qn, from:{id:uid, is_bot:false, first_name:"T"}, chat:{id:uid, type:"private"}, message_id:msg, data}});
  const a = calls.slice(n).find(c => c.m === "answerWidgetQuery"); return a ? JSON.parse(a.body.data) : null; };
try {
  const T = (await get("/api/state", 1)).today, add = (iso, k) => new Date(Date.parse(iso + "T00:00:00Z") + k * 864e5).toISOString().slice(0, 10);
  await post("/api/onboard", {children:[{name:"Рита", birth:add(T, -140), sex:"girl"}], role:"papa", my_name:"Влад", color:"raspberry", modules:{}}, 1);
  await post("/api/onboard", {children:[{name:"Марк", birth:add(T, -140), sex:"boy"}], role:"papa", my_name:"Иван", color:"raspberry", modules:{}}, 2);
  await post("/api/lang", {lang:"ru"}, 1); await post("/api/lang", {lang:"ru"}, 2);
  const kid1 = (await get("/api/state", 1)).children[0].id, kid2 = (await get("/api/state", 2)).children[0].id;

  // админ: таймер приходит виджетом
  const {id} = await post("/api/feed/start", {child_id:kid1, side:"L"}, 1);
  await post("/api/feed/away", {id}, 1);
  const w = last("sendWidget");
  ok(w && w.body.chat_id === 1 && w.body.allow_queries === true, "sendWidget админу, с allow_queries");
  ok(w && /Кормление идёт/.test(w.body.html) && JSON.parse(w.body.chat_data).s > 0, "html и chat_data на месте");
  ok(w && /Кормление идёт/.test(w.body.caption) && w.body.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app, "подпись и кнопка приложения");
  ok(!calls.some(c => c.m === "sendMessage" && /Кормление идёт/.test(c.body.text || "")), "обычного сообщения-таймера нет");
  const m1 = mid;
  const t = await wq(1, m1, "f:t"); ok(t && Math.abs(t.n - Date.now()) < 5000, "f:t: серверное время");
  let s = await wq(1, m1, "f:p");
  ok(last("editMessageWidgetData") && JSON.parse(last("editMessageWidgetData").body.chat_data).q > 0, "f:p: состояние виджета обновлено");
  await wait(1100);
  s = await wq(1, m1, "f:r"); ok(s && s.q === 0 && s.p >= 1000, "f:r: продолжили, пауза посчитана");
  const before = calls.filter(c => c.m === "sendWidget").length;
  s = await wq(1, m1, "f:w"); ok(s && s.e > 0, "f:w: старый виджет закрыт");
  ok(calls.filter(c => c.m === "sendWidget").length === before + 1 && /правая грудь/.test(last("sendWidget").body.caption), "f:w: новый виджет на правую грудь");
  ok(/Кормление записано/.test(calls.filter(c => c.m === "editMessageCaption").at(-1)?.body.caption || ""), "подпись старого: записано");
  const m2 = mid;
  s = await wq(1, m2, "f:s"); ok(s && s.e > 0, "f:s: закончили");
  s = await wq(1, m2, "f:s"); ok(s && s.e > 0, "f:s повторно: просто состояние");
  const st = await get("/api/state", 1), fs1 = (st.feeds || []).filter(f => f.child_id === kid1);
  ok(fs1.length === 2 && fs1.every(f => f.end_at) && fs1.map(f => f.side).join() === "L,R", "в базе два закрытых кормления L,R");
  s = await wq(2, m2, "f:s"); ok(s && s.err, "чужой пользователь: не найдено");
  s = await wq(1, 999, "x:1"); ok(s && s.err, "неизвестная кнопка: ответ с ошибкой");

  // сон: виджет с «Проснулась»
  const sl = await post("/api/sleep/start", {child_id:kid1}, 1);
  await post("/api/sleep/away", {id:sl.id}, 1);
  const sw = last("sendWidget");
  ok(sw && /Рита спит/.test(sw.body.caption) && /Проснулась/.test(sw.body.html) && JSON.parse(sw.body.chat_data).s > 0, "сон: виджет админу");
  const ms = mid;
  ok((await wq(1, ms, "s:t"))?.n > 0, "s:t: серверное время");
  s = await wq(1, ms, "s:w"); ok(s && s.e > 0 && s.z, "s:w: проснулась, состояние закрыто");
  ok(/Сон записан/.test(calls.filter(c => c.m === "editMessageCaption").at(-1)?.body.caption || ""), "сон: подпись — записан");
  s = await wq(1, ms, "s:w"); ok(s && s.e > 0, "s:w повторно: просто состояние");
  const sls = (await get("/api/state", 1)).sleeps || [];
  ok(sls.length === 1 && sls[0].end_at, "сон в базе закрыт");
  s = await wq(2, ms, "s:w"); ok(s && s.err, "сон: чужой — не найден");

  // не админ: как раньше
  const r2 = await post("/api/feed/start", {child_id:kid2, side:"R"}, 2);
  await post("/api/feed/away", {id:r2.id}, 2);
  ok(!calls.some(c => c.m === "sendWidget" && c.body.chat_id === 2) && last("sendMessage")?.body.chat_id === 2, "не админ: обычное сообщение-таймер");

  // /month
  await tgPost({message:{message_id:1, from:{id:1, first_name:"T"}, chat:{id:1, type:"private"}, date:1, text:"/month 5"}});
  ok(/5 из 12 месяцев/.test(last("sendWidget")?.body.html || "") && /Рите 5 месяцев/.test(last("sendWidget").body.caption), "/month 5: виджет админу");
  await tgPost({message:{message_id:2, from:{id:2, first_name:"T"}, chat:{id:2, type:"private"}, date:1, text:"/month 5"}});
  ok(last("sendPhoto")?.body.chat_id === 2 && /m05\.png/.test(last("sendPhoto").body.photo), "/month 5: картинка не админу");
  // старый Telegram API не знает sendWidget — откат
  failWidget = true;
  await tgPost({message:{message_id:3, from:{id:1, first_name:"T"}, chat:{id:1, type:"private"}, date:1, text:"/month 3"}});
  ok(last("sendPhoto")?.body.chat_id === 1 && /m03\.png/.test(last("sendPhoto").body.photo), "sendWidget отказал: карточка картинкой");
  const r3 = await post("/api/feed/start", {child_id:kid1, side:"B"}, 1);
  await post("/api/feed/away", {id:r3.id}, 1);
  ok(last("sendMessage")?.body.chat_id === 1 && /Кормление идёт/.test(last("sendMessage").body.text), "sendWidget отказал: таймер обычным сообщением");
  const setup = await fetch(U + "/setup?key=s").then(r => r.json());
  ok(calls.some(c => c.m === "setWebhook" && c.body.allowed_updates.includes("widget_query")), "webhook подписан на widget_query");
} finally { srv.kill(); fake.close(); }
setTimeout(() => { try { fs.rmSync(OUT, {recursive:true, force:true}); } catch {} process.exit(fails ? 1 : 0); }, 500);
console.log(fails ? `FAILED ${fails}` : "ALL PASS");
