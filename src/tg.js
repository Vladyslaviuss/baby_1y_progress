// Telegram Bot API и проверка initData мини-приложения.
import { setLang, setBoy, tr, trHtml, DEFAULT_LANG } from "../public/i18n.js";
import UK from "../public/i18n-uk.js";
import BOY from "../public/i18n-boy.js";
import { BOY_CARDS } from "./cards-boy.js";

// Язык получателя: user_lang (по умолчанию украинский) + имена семьи для падежей. Кэш на минуту.
const LANG_CACHE = new Map();
export const forgetLang = uid => LANG_CACHE.delete(Number(uid));
export async function langOf(env, uid){
  uid = Number(uid); const c = LANG_CACHE.get(uid);
  if (c && Date.now() - c.at < 60000) return c;
  let lang = DEFAULT_LANG, names = [], boy = false;
  try {
    const r = await env.DB.prepare("SELECT lang FROM user_lang WHERE user_id=?").bind(uid).first();
    if (r?.lang) lang = r.lang;
    if (lang !== "ru") names = (await env.DB.prepare(`SELECT name FROM children WHERE family_id=(SELECT family_id FROM members WHERE user_id=?)
      UNION SELECT name FROM members WHERE family_id=(SELECT family_id FROM members WHERE user_id=?)`).bind(uid, uid).all()).results.map(x => x.name);
    // мальчик: все дети семьи с указанным полом — мальчики (двойня разного пола — как раньше)
    const sx = (await env.DB.prepare("SELECT sex FROM children WHERE family_id=(SELECT family_id FROM members WHERE user_id=?)").bind(uid).all()).results.map(x => x.sex);
    boy = sx.length > 0 && sx.every(x => x === "boy");
  } catch (e) { console.error("langOf", e.message); }
  const v = {lang, names, boy, at:Date.now()}; LANG_CACHE.set(uid, v); return v;
}
// Переводит исходящее сообщение под получателя. Синхронно — глобальный язык i18n не успевает «перепутаться».
export function localize(l, body){
  if (l.lang === "ru" && !l.boy) return body;
  const out = {...body};
  setLang(l.lang === "ru" ? "ru" : "uk", UK); setBoy(l.boy ? BOY : null);
  try {
    for (const f of ["text", "caption"]) if (typeof out[f] === "string") out[f] = trHtml(out[f], l.names);
    if (typeof out.photo === "string") { const nm = out.photo.match(/\/cards\/([wm]\d\d)\.png/)?.[1], lg = l.lang === "ru" ? "ru" : "uk";
      out.photo = out.photo.replace("/cards/", `/cards/${lg === "ru" ? "" : "uk/"}${l.boy && BOY_CARDS[lg].includes(nm) ? "boy/" : ""}`); }
    const kb = out.reply_markup?.inline_keyboard || out.reply_markup?.keyboard;
    if (kb) out.reply_markup = {...out.reply_markup, [out.reply_markup.inline_keyboard ? "inline_keyboard" : "keyboard"]:
      kb.map(row => row.map(b => typeof b === "string" ? tr(b, l.names) : {...b, text:tr(b.text, l.names)}))};
  } finally { setLang("ru"); setBoy(null); }
  return out;
}

export async function tg(env, method, body){
  const uid = body._uid ?? body.chat_id;
  if (body._uid !== undefined) { body = {...body}; delete body._uid; }
  if (uid && env.DB && /^\d+$/.test(String(uid))) body = localize(await langOf(env, uid), body);
  const r = await fetch(`${env.TG_API || "https://api.telegram.org"}/bot${env.BOT_TOKEN}/${method}`, {
    method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body),
  });
  const j = await r.json().catch(()=>({ok:false, description:`HTTP ${r.status}`}));
  if(!j.ok) console.error(`tg ${method} failed:`, j.description);
  return j;
}

// Файл в чат (sendDocument) — multipart. data: строка или ArrayBuffer/Uint8Array.
export function documentForm(fields, data, filename, type){
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  fd.append("document", new Blob([data], {type}), filename);
  return fd;
}
export async function tgDocument(env, fields, data, filename, type){
  if (fields.chat_id && env.DB) fields = localize(await langOf(env, fields.chat_id), fields);
  const r = await fetch(`${env.TG_API || "https://api.telegram.org"}/bot${env.BOT_TOKEN}/sendDocument`, {method:"POST", body:documentForm(fields, data, filename, type)});
  const j = await r.json().catch(()=>({ok:false, description:`HTTP ${r.status}`}));
  if(!j.ok) console.error("tg sendDocument failed:", j.description);
  return j;
}

const enc = new TextEncoder();
async function hmac(key, data){
  const k = await crypto.subtle.importKey("raw", typeof key==="string"?enc.encode(key):key, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
const hex = b => [...b].map(x=>x.toString(16).padStart(2,"0")).join("");

// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export async function verifyInitData(initData, botToken, maxAgeSec = 30*24*3600){
  if(!initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash"); if(!hash) return null;
  p.delete("hash");
  const dcs = [...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join("\n");
  const secret = await hmac("WebAppData", botToken);
  if(hex(await hmac(secret, dcs)) !== hash) return null;
  const age = Date.now()/1000 - Number(p.get("auth_date")||0);
  if(age > maxAgeSec) return null;
  try { return JSON.parse(p.get("user")||"null"); } catch { return null; }
}
