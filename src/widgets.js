// HTML-виджеты Telegram (Bot API 10.4, https://core.telegram.org/bots/widgets): живой таймер кормления и праздничная карточка месяца.
// Виджет — HTML в пузыре сообщения, без сети, ≤4 КБ после zlib. Код после отправки не меняется, меняется только состояние (chat_data),
// и пишет его только бот (editMessageWidgetData). Кнопки виджета приходят боту как widget_query.
// Пока включено не всем: WIDGET_USERS (id через запятую или *), по умолчанию — только ADMIN_IDS.
// Не принялось (старый клиент API, ошибка размера) — вызывающий шлёт обычное сообщение, как раньше.
import { langOf, trFor } from "./tg.js";

export function widgetsOn(env, uid){
  const list = String(env.WIDGET_USERS || env.ADMIN_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
  return list.includes("*") || list.includes(String(uid));
}
const escH = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
// JSON внутрь <script>: без «</script>» и с безопасными для HTML символами
const js = v => JSON.stringify(v).replace(/</g, "\\u003c");
const pack = s => s.replace(/\n\s*/g, "");

// ---------- таймер кормления ----------
// Состояние: {s начало, p мс пауз, q начало текущей паузы, e конец, a «14:05», b «14:10» (пауза с), z «14:23» (конец)}.
// Секунды виджет считает сам; поправку часов телефона берёт фоновым запросом f:t (бот отвечает серверным временем).
const FEED_CSS = `<style>
body{margin:0;padding:10px 14px 6px}
.h{font-weight:600}
.m{color:var(--tg-theme-hint-color);font-size:.88em}
.t{font-size:2.7em;font-weight:700;line-height:1.15;margin:2px 0;font-variant-numeric:tabular-nums}
.ps .t,.dn .t{color:var(--tg-theme-hint-color)}
.bar{height:4px;border-radius:2px;background:var(--tg-theme-secondary-bg-color);overflow:hidden;margin:2px 0 8px}
.bar i{display:block;height:100%;width:0;background:var(--tg-theme-button-color)}
.r{display:flex;gap:8px;margin-top:8px}
.r button{flex:1}
.e{color:var(--tg-theme-destructive-text-color);font-size:.85em}
</style>`;
const FEED_JS = `<script>
const W=window.TelegramWidget,L=__L__,$=i=>document.getElementById(i);
let S=__S__,off=0,busy=0;
const rd=()=>{try{const n=JSON.parse(W.chatData);if(n)S=n}catch(x){}};
if(W)rd();
const now=()=>Date.now()+off,f2=n=>String(n).padStart(2,"0");
const len=()=>Math.max(0,(S.e||S.q||now())-S.s-(S.p||0));
const clock=ms=>{const s=Math.floor(ms/1e3),h=Math.floor(s/3600),m=Math.floor(s/60)%60;return(h?h+":"+f2(m):m)+":"+f2(s%60)};
const dur=ms=>{const m=Math.round(ms/6e4);return m<60?m+" "+L.mi:Math.floor(m/60)+" "+L.h+" "+m%60+" "+L.mi};
function tick(){const l=len();$("t").textContent=S.e?dur(l):clock(l);$("b").style.width=S.e||S.q?"0":Math.floor(l/1e3)%60/59*100+"%"}
function btn(t,a){const b=document.createElement("button");b.textContent=t;b.onclick=()=>act(a,b);return b}
function row(...x){const r=document.createElement("div");r.className="r";r.append(...x);return r}
function draw(){
$("w").className=S.e?"dn":S.q?"ps":"";
$("h").textContent=(S.e?L.done:S.q?L.paused:L.on)+" · "+L.side;
$("m").textContent=L.kid+" · "+(S.e?S.a+"–"+S.z:L.from+" "+S.a+(S.q?" · "+L.pf+" "+S.b:""))+(S.p?" · "+L.pz+" "+dur(S.p):"");
const k=$("k");k.replaceChildren();
if(!S.e){k.append(row(S.q?btn(L.res,"r"):btn(L.pau,"p"),btn(L.stop,"s")));if(L.sw)k.append(row(btn(L.sw,"w")))}
tick()}
function act(a,b){if(busy||!W)return;busy=1;b.disabled=true;$("e").textContent="";
W.request("f:"+a).then(x=>{busy=0;try{const n=JSON.parse(x.result);if(n.err)$("e").textContent=n.err;else S=n}catch(y){}try{W.HapticFeedback.impactOccurred("light")}catch(y){}draw()},
er=>{busy=0;b.disabled=false;$("e").textContent=L.err+" ("+er.code+")"})}
if(W){W.onEvent("chatDataChanged",()=>{rd();draw()});
busy=1;W.request("f:t").then(x=>{busy=0;try{const n=JSON.parse(x.result);if(n.n)off=n.n-Date.now()}catch(y){}tick()},()=>{busy=0})}
draw();setInterval(tick,1e3);
</script>`;
const FEED_BODY = `<div id="w"><div class="h" id="h"></div><div class="t" id="t">0:00</div><div class="bar"><i id="b"></i></div><div class="m" id="m"></div><div id="k"></div><div class="e" id="e"></div></div>`;
const SIDE_W = {L:"левая грудь", R:"правая грудь", B:"бутылочка"};

export function feedState(f, hm){
  return {s:f.start_at, p:f.pause_ms || 0, q:f.paused_at || 0, e:f.end_at || 0, a:hm(f.start_at), b:f.paused_at ? hm(f.paused_at) : "", z:f.end_at ? hm(f.end_at) : ""};
}
export async function feedWidgetHtml(env, uid, f, kidName){
  const l = await langOf(env, uid), t = s => trFor(l, s);
  const L = {on:t("Кормление идёт"), paused:t("Кормление на паузе"), done:t("Кормление записано"), side:t(SIDE_W[f.side]),
    kid:kidName, from:t("начало"), pf:t("пауза с"), pz:t("паузы"), mi:t("мин"), h:t("ч"),
    pau:"⏸ " + t("Пауза"), res:"▶️ " + t("Продолжить"), stop:"⏹ " + t("Закончить"),
    sw:f.side === "B" ? "" : "🔁 " + t("Сменить грудь"), err:t("Не отправилось, попробуй ещё раз")};
  return pack(FEED_CSS) + FEED_BODY + FEED_JS.replace("__L__", js(L)).replace("__S__", js(feedState(f, () => "")));
}

// ---------- карточка месяца ----------
// Кольцо «k из 12» дорисовывается при показе, по нажатию на кольцо — конфетти. Состояния нет: всё зашито в HTML.
const MONTH_CSS = `<style>
body{margin:0;padding:14px 14px 8px;position:relative;overflow:hidden}
.n{display:flex;align-items:center;gap:14px}
svg{width:76px;height:76px;flex:none;touch-action:none}
.rb{fill:none;stroke:var(--tg-theme-secondary-bg-color);stroke-width:7}
.ra{fill:none;stroke:var(--tg-theme-button-color);stroke-width:7;stroke-linecap:round}
.rt{font-weight:800;font-size:30px;fill:var(--tg-theme-text-color)}
.h{font-weight:700;font-size:1.15em;line-height:1.25}
.m{color:var(--tg-theme-hint-color);font-size:.88em}
.d{display:flex;gap:4px;margin:12px 0 8px}
.d i{flex:1;height:6px;border-radius:3px;background:var(--tg-theme-secondary-bg-color)}
.d .on{background:var(--tg-theme-button-color)}
ul{margin:4px 0 6px;padding-left:1.2em}
.p{position:absolute;left:0;top:0;width:7px;height:11px;border-radius:2px;pointer-events:none}
</style>`;
const MONTH_JS = `<script>
const W=window.TelegramWidget,K=__K__,C=2*Math.PI*31,a=document.getElementById("a");
const still=matchMedia("(prefers-reduced-motion: reduce)").matches;
function ring(){if(still){a.style.strokeDasharray=C*K/12+" "+C;return}const t0=performance.now();
const f=t=>{const x=Math.min(1,(t-t0)/900),e=1-Math.pow(1-x,3);a.style.strokeDasharray=C*K/12*e+" "+C;if(x<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
const COL=["#e4643f","#d39a12","#23806f","#2d5bb0","#b8436f","#7a5bd0"];
function boom(){if(still)return;const w=document.body.offsetWidth,ps=[];
for(let i=0;i<16;i++){const s=document.createElement("i");s.className="p";s.style.background=COL[i%6];document.body.append(s);
ps.push({s,x:w*(.15+Math.random()*.7),y:-12,vx:(Math.random()-.5)*2.2,vy:1.6+Math.random()*2.2,r:Math.random()*360,vr:(Math.random()-.5)*14})}
const t0=performance.now();const f=t=>{for(const p of ps){p.x+=p.vx;p.y+=p.vy;p.vy+=.05;p.r+=p.vr;p.s.style.transform="translate("+p.x+"px,"+p.y+"px) rotate("+p.r+"deg)"}
if(t-t0<2600)requestAnimationFrame(f);else ps.forEach(p=>p.s.remove())};requestAnimationFrame(f)}
document.getElementById("c").onclick=()=>{boom();try{W&&W.HapticFeedback.notificationOccurred("success")}catch(e){}};
ring();boom();
</script>`;
export async function monthWidgetHtml(env, uid, {title, k, items, ofYear, usually, note}){
  const l = await langOf(env, uid), t = s => trFor(l, s);
  const list = t(items || "").replace(/\.$/, "").split(/,\s*/).filter(Boolean).map(x => x[0].toUpperCase() + x.slice(1));
  const dots = Array.from({length:12}, (_, i) => `<i${i < k ? ` class="on"` : ""}></i>`).join("");
  const body = `<div class="n"><svg id="c" viewBox="0 0 76 76"><circle class="rb" cx="38" cy="38" r="31"/>`
    + `<circle id="a" class="ra" cx="38" cy="38" r="31" transform="rotate(-90 38 38)" style="stroke-dasharray:0 999"/>`
    + `<text class="rt" x="38" y="49" text-anchor="middle">${k}</text></svg>`
    + `<div><div class="h">${escH(t(title))}</div><div class="m">${escH(t(ofYear))}</div></div></div>`
    + `<div class="d">${dots}</div>`
    + (list.length ? `<div class="m">${escH(t(usually))}</div><ul>${list.map(x => `<li>${escH(x)}</li>`).join("")}</ul>` : "")
    + `<div class="m">${escH(t(note))}</div>`;
  return pack(MONTH_CSS) + body + MONTH_JS.replace("__K__", js(k));
}
