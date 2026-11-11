// Кормления: старт/стоп/пауза/смена груди, запись задним числом, сообщение-таймер в боте.
// Пауза не создаёт новую запись: время на паузе копится в pause_ms и не входит в длительность.
// Обычное сообщение бота редактируется раз в минуту (feedTick). Кому включены виджеты (widgets.js) — вместо него HTML-виджет:
// секунды он считает сам, кнопки внутри приходят как widget_query (onFeedWidget), бот меняет только его состояние (msg_w=1).
import { tg, langOf, trFor } from "./tg.js";
import { widgetsOn, feedWidgetHtml, feedState } from "./widgets.js";

const TZ = "Europe/Kyiv";
const SIDE = {L:"левая грудь", R:"правая грудь", B:"бутылочка"};
const hm = ms => new Intl.DateTimeFormat("ru-RU", {hour:"2-digit", minute:"2-digit", timeZone:TZ}).format(new Date(ms));
const mins = ms => Math.max(0, Math.round(ms / 60000));
const dur = ms => { const m = mins(ms); return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60} мин`; };
const MAX_ACTIVE = 3 * 3600e3;              // дольше трёх часов — скорее всего забыли остановить
const MAX_PAUSE = 3600e3;                   // на паузе дольше часа — тоже забыли
// сколько кормили: без пауз; на паузе — замерло на моменте паузы
const len = (f, now) => (f.end_at ?? f.paused_at ?? now) - f.start_at - (f.pause_ms || 0);
const json = (d, s = 200) => new Response(JSON.stringify(d), {status:s, headers:{"content-type":"application/json; charset=utf-8"}});

const nameOf = c => c?.name || "Малыш";
async function child(env, fid, id){ return env.DB.prepare("SELECT * FROM children WHERE id=? AND family_id=?").bind(id, fid).first(); }
async function feed(env, fid, id){ return env.DB.prepare("SELECT * FROM feedings WHERE id=? AND family_id=?").bind(id, fid).first(); }
export async function familyFeeds(env, fid, sinceMs){
  return (await env.DB.prepare("SELECT id, child_id, side, start_at, end_at, by_user, paused_at, pause_ms FROM feedings WHERE family_id=? AND start_at>=? ORDER BY start_at").bind(fid, sinceMs).all()).results;
}

function activeText(f, kid, now){
  if (f.paused_at) return `⏸ <b>Кормление на паузе</b> · ${SIDE[f.side]}\n${nameOf(kid)} · начало ${hm(f.start_at)}, пауза с ${hm(f.paused_at)}\n⏱ <b>${dur(len(f, now))}</b>\n\n<i>Время на паузе не считается.</i>`;
  return `🍼 <b>Кормление идёт</b> · ${SIDE[f.side]}\n${nameOf(kid)} · начало ${hm(f.start_at)}\n⏱ <b>${dur(len(f, now))}</b>${f.pause_ms ? ` · паузы ${dur(f.pause_ms)} не в счёт` : ""}\n\n<i>Время обновляется каждую минуту.</i>`;
}
const doneText = (f, kid) => `✅ <b>Кормление записано</b> · ${SIDE[f.side]}\n${nameOf(kid)} · ${hm(f.start_at)}–${hm(f.end_at)} · ${dur(len(f))}${f.pause_ms ? ` · паузы ${dur(f.pause_ms)} не в счёт` : ""}`;
const activeKeyboard = (env, f) => ({inline_keyboard:[
  [f.paused_at ? {text:"▶️ Продолжить", callback_data:`feedresume:${f.id}`} : {text:"⏸ Пауза", callback_data:`feedpause:${f.id}`}, {text:"⏹ Закончить", callback_data:`feedstop:${f.id}`}],
  ...(f.side !== "B" ? [[{text:"🔁 Сменить грудь", callback_data:`feedswitch:${f.id}`}]] : []),
  [{text:"Открыть приложение", web_app:{url:`${env.APP_URL.replace(/\/$/, "")}/?tab=feed`}}]]});

const appKb = env => ({inline_keyboard:[[{text:"Открыть приложение", web_app:{url:`${env.APP_URL.replace(/\/$/, "")}/?tab=feed`}}]]});
// виджет: секунды считает сам, бот пишет только состояние (без «изменено» и без уведомления)
const widgetData = (env, f) => tg(env, "editMessageWidgetData", {chat_id:f.chat_id, message_id:f.msg_id, chat_data:JSON.stringify(feedState(f, hm))});

// закончили на паузе — кормление кончилось в момент паузы
async function finish(env, f, now){
  const end = f.paused_at || now;
  await env.DB.prepare("UPDATE feedings SET end_at=?, paused_at=NULL WHERE id=? AND end_at IS NULL").bind(end, f.id).run();
  const done = {...f, end_at: end, paused_at: null};
  if (f.msg_id && f.msg_w) {
    await widgetData(env, done);
    await tg(env, "editMessageCaption", {chat_id:f.chat_id, message_id:f.msg_id, caption:doneText(done, await child(env, f.family_id, f.child_id)), parse_mode:"HTML", reply_markup:appKb(env)});
  } else if (f.msg_id) await tg(env, "editMessageText", {chat_id:f.chat_id, message_id:f.msg_id, text:doneText(done, await child(env, f.family_id, f.child_id)), parse_mode:"HTML"});
  return done;
}
async function start(env, fid, kidId, side, uid, now){
  const r = await env.DB.prepare("INSERT INTO feedings(family_id,child_id,side,start_at,end_at,by_user,created) VALUES(?,?,?,?,NULL,?,?)").bind(fid, kidId, side, now, uid, now).run();
  return feed(env, fid, r.meta.last_row_id);
}
async function setPause(env, f, on, now){
  if (on) await env.DB.prepare("UPDATE feedings SET paused_at=? WHERE id=? AND end_at IS NULL AND paused_at IS NULL").bind(now, f.id).run();
  else await env.DB.prepare("UPDATE feedings SET pause_ms=pause_ms+(?-paused_at), paused_at=NULL WHERE id=? AND end_at IS NULL AND paused_at IS NOT NULL").bind(now, f.id).run();
  const n = await feed(env, f.family_id, f.id);
  if (n?.msg_id && n.msg_w) await widgetData(env, n);
  else if (n?.msg_id) await tg(env, "editMessageText", {chat_id:n.chat_id, message_id:n.msg_id, text:activeText(n, await child(env, n.family_id, n.child_id), now), parse_mode:"HTML", reply_markup:activeKeyboard(env, n)});
  return n;
}
async function sendActive(env, f, chatId){
  const kid = await child(env, f.family_id, f.child_id);
  if (widgetsOn(env, chatId)) {
    const w = await tg(env, "sendWidget", {chat_id:chatId, html:await feedWidgetHtml(env, chatId, f, nameOf(kid)), chat_data:JSON.stringify(feedState(f, hm)),
      caption:`🍼 <b>Кормление идёт</b> · ${SIDE[f.side]}
${nameOf(kid)} · начало ${hm(f.start_at)}`, parse_mode:"HTML", allow_queries:true, reply_markup:appKb(env)});
    if (w.ok && w.result?.message_id) {
      await env.DB.prepare("UPDATE feedings SET chat_id=?, msg_id=?, msg_w=1 WHERE id=?").bind(chatId, w.result.message_id, f.id).run();
      return;
    }
    console.error("feed widget: не ушёл, шлю обычное сообщение —", w.description);
  }
  const m = await tg(env, "sendMessage", {chat_id:chatId, text:activeText(f, kid, Date.now()), parse_mode:"HTML", reply_markup:activeKeyboard(env, f)});
  if (m.ok) await env.DB.prepare("UPDATE feedings SET chat_id=?, msg_id=? WHERE id=?").bind(chatId, m.result.message_id, f.id).run();
}

// приложение закрыли совсем (сервер увидел, что поток событий оборвался) — таймер тому, кто начал кормление
export async function feedAwayFor(env, uid){
  for (const f of (await env.DB.prepare("SELECT * FROM feedings WHERE by_user=? AND end_at IS NULL AND msg_id IS NULL").bind(uid).all()).results) await sendActive(env, f, uid);
}

// ---------- API мини-приложения ----------
export async function feedApi(env, path, body, user, fid){
  if (!path.startsWith("/api/feed")) return null;
  const now = Date.now();
  if (path === "/api/feed/start") {
    const kid = await child(env, fid, Number(body.child_id)); if (!kid) return json({error:"not your child"}, 403);
    const side = SIDE[body.side] ? body.side : "L";
    const act = await env.DB.prepare("SELECT * FROM feedings WHERE child_id=? AND end_at IS NULL").bind(kid.id).first();
    if (act) await finish(env, act, now);            // одно активное кормление на ребёнка
    const f = await start(env, fid, kid.id, side, user.id, now);
    return json({ok:true, id:f.id});
  }
  if (path === "/api/feed/stop" || path === "/api/feed/switch") {
    const f = await feed(env, fid, Number(body.id)); if (!f) return json({error:"not found"}, 404);
    if (f.end_at) return json({ok:true});
    await finish(env, f, now);
    if (path === "/api/feed/switch") {
      const n = await start(env, fid, f.child_id, f.side === "L" ? "R" : "L", user.id, now);
      if (f.msg_id) await sendActive(env, n, f.chat_id);   // сообщение-таймер переезжает на новую грудь
      return json({ok:true, id:n.id});
    }
    return json({ok:true});
  }
  if (path === "/api/feed/pause" || path === "/api/feed/resume") {
    const f = await feed(env, fid, Number(body.id)); if (!f) return json({error:"not found"}, 404);
    if (!f.end_at) await setPause(env, f, path === "/api/feed/pause", now);
    return json({ok:true});
  }
  if (path === "/api/feed/away") {                     // приложение свернули во время кормления
    const f = await feed(env, fid, Number(body.id));
    if (f && !f.end_at && !f.msg_id) await sendActive(env, f, user.id);
    return json({ok:true});
  }
  if (path === "/api/feed/add") {                      // задним числом
    const kid = await child(env, fid, Number(body.child_id)); if (!kid) return json({error:"not your child"}, 403);
    const side = SIDE[body.side] ? body.side : "L", st = Number(body.start_at), m = Number(body.minutes);
    if (!(st > now - 31 * 864e5 && st <= now)) return json({error:"Время кормления — за последний месяц и не в будущем"}, 400);
    if (!(m >= 1 && m <= 180)) return json({error:"Длительность от 1 до 180 минут"}, 400);
    await env.DB.prepare("INSERT INTO feedings(family_id,child_id,side,start_at,end_at,by_user,created) VALUES(?,?,?,?,?,?,?)")
      .bind(fid, kid.id, side, st, Math.min(now, st + m * 60000), user.id, now).run();
    return json({ok:true});
  }
  if (path === "/api/feed/edit") {                     // поправить записанное: сторона, начало, минуты (паузы при этом обнуляются — минуты уже чистые)
    const f = await feed(env, fid, Number(body.id)); if (!f) return json({error:"not found"}, 404);
    if (!f.end_at) return json({error:"Сначала закончи кормление"}, 400);
    const side = SIDE[body.side] ? body.side : f.side, st = Number(body.start_at), m = Number(body.minutes);
    if (!(st > now - 31 * 864e5 && st <= now)) return json({error:"Время кормления — за последний месяц и не в будущем"}, 400);
    if (!(m >= 1 && m <= 180)) return json({error:"Длительность от 1 до 180 минут"}, 400);
    await env.DB.prepare("UPDATE feedings SET side=?, start_at=?, end_at=?, pause_ms=0, paused_at=NULL WHERE id=? AND family_id=?")
      .bind(side, st, Math.min(now, st + m * 60000), f.id, fid).run();
    return json({ok:true});
  }
  if (path === "/api/feed/delete") {
    const f = await feed(env, fid, Number(body.id));
    if (f?.msg_id && !f.end_at) await tg(env, "deleteMessage", {chat_id:f.chat_id, message_id:f.msg_id});
    await env.DB.prepare("DELETE FROM feedings WHERE id=? AND family_id=?").bind(Number(body.id), fid).run();
    return json({ok:true});
  }
  return json({error:"not found"}, 404);
}

// ---------- кнопки в сообщении бота ----------
export async function onFeedCallback(env, cq){
  const [act, idStr] = String(cq.data || "").split(":");
  if (!act.startsWith("feed")) return false;
  const answer = text => tg(env, "answerCallbackQuery", {callback_query_id:cq.id, text, _uid:cq.from.id});
  const me = await env.DB.prepare("SELECT * FROM members WHERE user_id=?").bind(cq.from.id).first();
  const f = me && await feed(env, me.family_id, Number(idStr));
  if (!f) { await answer("Кормление не найдено"); return true; }
  if (f.end_at) { await answer("Уже записано"); return true; }
  const now = Date.now();
  if (act === "feedstop") {
    const done = await finish(env, f, now);
    await answer("Записано");
    await tg(env, "sendMessage", {chat_id:cq.from.id, parse_mode:"HTML",
      text:`Супер, кормление записано 👍\n${SIDE[done.side]} · ${dur(len(done))}. История и график — во вкладке «Кормление».`,
      reply_markup:{inline_keyboard:[[{text:"Открыть историю", web_app:{url:`${env.APP_URL.replace(/\/$/, "")}/?tab=feed`}}]]}});
  } else if (act === "feedpause" || act === "feedresume") {
    const pause = act === "feedpause";
    if (!!f.paused_at === pause) { await answer(pause ? "Уже на паузе" : "Уже идёт"); return true; }
    await setPause(env, f, pause, now);
    await answer(pause ? "Пауза" : "Продолжаем");
  } else if (act === "feedswitch") {
    await finish(env, f, now);
    const n = await start(env, me.family_id, f.child_id, f.side === "L" ? "R" : "L", cq.from.id, now);
    await sendActive(env, n, cq.from.id);
    await answer(`Теперь ${SIDE[n.side]}`);
  }
  return true;
}

// ---------- раз в минуту: обновить таймеры в сообщениях ----------
export async function feedTick(env){
  const now = Date.now();
  const rows = (await env.DB.prepare("SELECT * FROM feedings WHERE end_at IS NULL AND msg_id IS NOT NULL").all()).results;
  for (const f of rows) {
    const kid = await child(env, f.family_id, f.child_id);
    // забыли остановить: закрываем на 3 часах кормления (или на моменте паузы, если пауза дольше часа) и сообщаем
    if (f.paused_at ? now - f.paused_at > MAX_PAUSE : len(f, now) > MAX_ACTIVE) {
      const done = await finish(env, f, f.start_at + (f.pause_ms || 0) + MAX_ACTIVE);
      await tg(env, "sendMessage", {chat_id:f.chat_id, text:`Похоже, кормление ${hm(f.start_at)} забыли остановить — записал ${dur(len(done))}. Поправить можно в приложении.`});
      continue;
    }
    if (f.paused_at || f.msg_w) continue;              // на паузе цифры стоят; виджет считает время сам
    await tg(env, "editMessageText", {chat_id:f.chat_id, message_id:f.msg_id, text:activeText(f, kid, now), parse_mode:"HTML", reply_markup:activeKeyboard(env, f)});
  }
}

// ---------- кнопки внутри виджета-таймера (widget_query) ----------
// f:t — фоновый запрос виджета при показе: серверное время для поправки часов телефона.
// Ответ — новое состояние JSON (виджет перерисуется сразу, не дожидаясь editMessageWidgetData) или {err}.
export async function onFeedWidget(env, q){
  const [kind, act] = String(q.data || "").split(":");
  if (kind !== "f") return false;
  const l = await langOf(env, q.from.id);
  const reply = d => tg(env, "answerWidgetQuery", {widget_query_id:q.id, data:JSON.stringify(d.err ? {err:trFor(l, d.err)} : d)});
  if (act === "t") { await reply({n:Date.now()}); return true; }
  const me = await env.DB.prepare("SELECT * FROM members WHERE user_id=?").bind(q.from.id).first();
  const f = me && q.chat && await env.DB.prepare("SELECT * FROM feedings WHERE chat_id=? AND msg_id=? AND family_id=?").bind(q.chat.id, q.message_id, me.family_id).first();
  if (!f) { await reply({err:"Кормление не найдено"}); return true; }
  if (f.end_at) { await reply(feedState(f, hm)); return true; }
  const now = Date.now();
  if (act === "s") {
    const done = await finish(env, f, now);
    await reply(feedState(done, hm));
  } else if (act === "p" || act === "r") {
    const n = (!!f.paused_at === (act === "p")) ? f : await setPause(env, f, act === "p", now);
    await reply(feedState(n, hm));
  } else if (act === "w" && f.side !== "B") {
    const done = await finish(env, f, now);
    await reply(feedState(done, hm));
    const n = await start(env, me.family_id, f.child_id, f.side === "L" ? "R" : "L", q.from.id, now);
    await sendActive(env, n, q.from.id);
  } else await reply({err:"Не понял кнопку"});
  return true;
}
