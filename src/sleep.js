// Сон: старт/стоп, запись задним числом, удаление.
// Свернули приложение, пока малыш спит, — бот присылает тому, кто отметил сон, сообщение-таймер с кнопкой «Проснулась»;
// оно обновляется раз в минуту (sleepTick), как у кормления. Остальным в семье ничего не шлём — сон виден в приложении.
import { tg } from "./tg.js";

const MAX_SLEEP = 16 * 3600e3;              // один сон дольше 16 часов — ошибка ввода
const TZ = "Europe/Kyiv";
const hm = ms => new Intl.DateTimeFormat("ru-RU", {hour:"2-digit", minute:"2-digit", timeZone:TZ}).format(new Date(ms));
const dur = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60} мин`; };
const nameOf = c => c?.name || "Малыш";
const girl = c => c?.sex === "girl";
const appBtn = env => ({text:"Открыть приложение", web_app:{url:`${env.APP_URL.replace(/\/$/, "")}/?tab=sleep`}});
const activeText = (s, kid, now) => `😴 <b>${nameOf(kid)} спит</b>\n${girl(kid) ? "Уснула" : "Уснул"} в ${hm(s.start_at)}\n⏱ <b>${dur(now - s.start_at)}</b>\n\n<i>Время обновляется каждую минуту.</i>`;
const doneText = (s, kid) => `✅ <b>Сон записан</b>\n${nameOf(kid)} · ${hm(s.start_at)}–${hm(s.end_at)} · ${dur(s.end_at - s.start_at)}`;
const activeKeyboard = (env, s, kid) => ({inline_keyboard:[[{text:`☀️ ${girl(kid) ? "Проснулась" : "Проснулся"}`, callback_data:`sleepwake:${s.id}`}], [appBtn(env)]]});
// сон закончился — сообщение-таймер превращается в итог
async function closeMsg(env, s, end){
  if (!s.msg_id) return;
  await tg(env, "editMessageText", {chat_id:s.chat_id, message_id:s.msg_id, text:doneText({...s, end_at:end}, await child(env, s.family_id, s.child_id)), parse_mode:"HTML"});
}
async function sendActive(env, s, uid){
  const kid = await child(env, s.family_id, s.child_id);
  const m = await tg(env, "sendMessage", {chat_id:uid, text:activeText(s, kid, Date.now()), parse_mode:"HTML", reply_markup:activeKeyboard(env, s, kid)});
  if (m.ok) await env.DB.prepare("UPDATE sleeps SET chat_id=?, msg_id=? WHERE id=?").bind(uid, m.result.message_id, s.id).run();
}
// приложение закрыли совсем — таймер тому, кто отметил сон
export async function sleepAwayFor(env, uid){
  for (const s of (await env.DB.prepare("SELECT * FROM sleeps WHERE by_user=? AND end_at IS NULL AND msg_id IS NULL").bind(uid).all()).results) await sendActive(env, s, uid);
}
async function finish(env, s, end){
  await env.DB.prepare("UPDATE sleeps SET end_at=? WHERE id=? AND end_at IS NULL").bind(end, s.id).run();
  await closeMsg(env, s, end);
}
const json = (d, s = 200) => new Response(JSON.stringify(d), {status:s, headers:{"content-type":"application/json; charset=utf-8"}});

async function child(env, fid, id){ return env.DB.prepare("SELECT * FROM children WHERE id=? AND family_id=?").bind(id, fid).first(); }
async function sleep(env, fid, id){ return env.DB.prepare("SELECT * FROM sleeps WHERE id=? AND family_id=?").bind(id, fid).first(); }
// с запасом на сон, который начался до границы и ещё шёл после неё
export async function familySleeps(env, fid, sinceMs){
  return (await env.DB.prepare("SELECT id, child_id, start_at, end_at, by_user FROM sleeps WHERE family_id=? AND (start_at>=? OR end_at IS NULL) ORDER BY start_at").bind(fid, sinceMs - MAX_SLEEP).all()).results;
}

export async function sleepApi(env, path, body, user, fid){
  const now = Date.now();
  if (path === "/api/sleep/start") {
    const kid = await child(env, fid, Number(body.child_id)); if (!kid) return json({error:"not your child"}, 403);
    // один сон на ребёнка: незакрытый прошлый закрываем сейчас
    for (const s of (await env.DB.prepare("SELECT * FROM sleeps WHERE child_id=? AND end_at IS NULL").bind(kid.id).all()).results) await finish(env, s, Math.min(now, s.start_at + MAX_SLEEP));
    const r = await env.DB.prepare("INSERT INTO sleeps(family_id,child_id,start_at,end_at,by_user,created) VALUES(?,?,?,NULL,?,?)").bind(fid, kid.id, now, user.id, now).run();
    return json({ok:true, id:r.meta.last_row_id});
  }
  if (path === "/api/sleep/stop") {
    const s = await sleep(env, fid, Number(body.id)); if (!s) return json({error:"not found"}, 404);
    if (!s.end_at) await finish(env, s, Math.min(now, s.start_at + MAX_SLEEP));
    return json({ok:true});
  }
  if (path === "/api/sleep/away") {                    // свернули приложение, пока малыш спит
    const s = await sleep(env, fid, Number(body.id));
    if (s && !s.end_at && !s.msg_id && s.by_user === user.id) await sendActive(env, s, user.id);
    return json({ok:true});
  }
  if (path === "/api/sleep/add") {                     // задним числом
    const kid = await child(env, fid, Number(body.child_id)); if (!kid) return json({error:"not your child"}, 403);
    const st = Number(body.start_at), en = Number(body.end_at);
    if (!(st > now - 31 * 864e5 && en <= now + 60000)) return json({error:"Сон — за последний месяц и не в будущем"}, 400);
    if (!(en - st >= 60000 && en - st <= MAX_SLEEP)) return json({error:"Сон — от 1 минуты до 16 часов"}, 400);
    await env.DB.prepare("INSERT INTO sleeps(family_id,child_id,start_at,end_at,by_user,created) VALUES(?,?,?,?,?,?)").bind(fid, kid.id, st, Math.min(en, now), user.id, now).run();
    return json({ok:true});
  }
  if (path === "/api/sleep/edit") {
    const s = await sleep(env, fid, Number(body.id)); if (!s) return json({error:"not found"}, 404);
    if (!s.end_at) return json({error:"Сначала отметь, что малыш проснулся"}, 400);
    const st = Number(body.start_at), en = Number(body.end_at);
    if (!(st > now - 31 * 864e5 && en <= now + 60000)) return json({error:"Сон — за последний месяц и не в будущем"}, 400);
    if (!(en - st >= 60000 && en - st <= MAX_SLEEP)) return json({error:"Сон — от 1 минуты до 16 часов"}, 400);
    await env.DB.prepare("UPDATE sleeps SET start_at=?, end_at=? WHERE id=? AND family_id=?").bind(st, Math.min(en, now), s.id, fid).run();
    return json({ok:true});
  }
  if (path === "/api/sleep/delete") {
    const s = await sleep(env, fid, Number(body.id));
    if (s?.msg_id && !s.end_at) await tg(env, "deleteMessage", {chat_id:s.chat_id, message_id:s.msg_id});
    await env.DB.prepare("DELETE FROM sleeps WHERE id=? AND family_id=?").bind(Number(body.id), fid).run();
    return json({ok:true});
  }
  return json({error:"not found"}, 404);
}

// ---------- кнопка «Проснулась» в сообщении бота ----------
export async function onSleepCallback(env, cq){
  const [act, idStr] = String(cq.data || "").split(":");
  if (act !== "sleepwake") return false;
  const answer = text => tg(env, "answerCallbackQuery", {callback_query_id:cq.id, text, _uid:cq.from.id});
  const me = await env.DB.prepare("SELECT * FROM members WHERE user_id=?").bind(cq.from.id).first();
  const s = me && await sleep(env, me.family_id, Number(idStr));
  if (!s) { await answer("Сон не найден"); return true; }
  if (s.end_at) { await closeMsg(env, s, s.end_at); await answer("Уже записано"); return true; }
  await finish(env, s, Math.min(Date.now(), s.start_at + MAX_SLEEP));
  await answer("Сон записан");
  return true;
}

// ---------- раз в минуту: обновить таймеры сна в сообщениях ----------
export async function sleepTick(env){
  const now = Date.now();
  for (const s of (await env.DB.prepare("SELECT * FROM sleeps WHERE end_at IS NULL AND msg_id IS NOT NULL").all()).results) {
    if (now - s.start_at > MAX_SLEEP) {                // забыли отметить пробуждение
      await finish(env, s, s.start_at + MAX_SLEEP);
      await tg(env, "sendMessage", {chat_id:s.chat_id, text:`Похоже, сон с ${hm(s.start_at)} забыли остановить — записал 16 ч. Поправить можно в приложении.`});
      continue;
    }
    const kid = await child(env, s.family_id, s.child_id);
    await tg(env, "editMessageText", {chat_id:s.chat_id, message_id:s.msg_id, text:activeText(s, kid, now), parse_mode:"HTML", reply_markup:activeKeyboard(env, s, kid)});
  }
}
