// HTML-разметка картинок для Telegram. Рендерится заранее: npm run render (scripts/render-cards.mjs).
import { W, Q, QT, PHASES, GH, MONTHLY, gearForWeek, ageLabel, plural } from "../public/data.js";

const C = {
  bg:"#f2f4f0", card:"#ffffff", fg:"#1c2932", muted:"#5b6a70", line:"#d6ddd8",
  accent:"#b8436f", accentSoft:"#f6e3ea", en:"#2d5bb0", enSoft:"#e3ebf8",
  nat:"#a8731a", natSoft:"#f6ecd8", health:"#23806f", healthSoft:"#dcefea", warnSoft:"#f8e1db", warn:"#b4432c",
};
const CHIP = {new:[C.accentSoft,C.accent], body:[C.healthSoft,C.health], play:[C.natSoft,C.nat], task:[C.line,C.fg], order:[C.warnSoft,C.warn]};

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const col = "display:flex;flex-direction:column;";
const label = t => `<div style="display:flex;font-size:20px;font-weight:600;letter-spacing:2px;color:${C.muted};text-transform:uppercase">${esc(t)}</div>`;

function row(kind, text, sub, hint){
  const [b,f]=CHIP[kind];
  return `<div style="display:flex;align-items:flex-start;gap:16px">
    <div style="display:flex;width:30px;height:30px;border:3px solid ${C.line};border-radius:8px;margin-top:4px;flex-shrink:0"></div>
    <div style="${col}flex:1">
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px">
        <div style="display:flex;background:${b};color:${f};font-size:18px;font-weight:600;padding:3px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:1px">${esc(QT[kind])}</div>
        ${sub?`<div style="display:flex;font-size:20px;color:${C.warn}">${esc(sub)}</div>`:""}
      </div>
      <div style="display:flex;font-size:27px;line-height:1.4;margin-top:6px">${esc(text)}</div>
      ${hint?`<div style="display:flex;font-size:21px;line-height:1.4;color:${C.muted};margin-top:6px">${esc(hint)}</div>`:""}
    </div>
  </div>`;
}

export function cardHTML(n){
  const w=W[n-1], ph=PHASES.find(p=>n>=p.from&&n<=p.to);
  const gear=gearForWeek(n);
  const quests=Q[n-1].map(([k,x])=>row(k,x)).join("");
  const orders=gear.map(g=>row("order", g.x, n===1&&g.need<=3 ? "нужно уже сейчас" : `понадобится на неделе ${g.need} · через ${g.need-n} нед`, GH[g.id])).join("");
  return `<div style="${col}width:1080px;box-sizing:border-box;background:${C.bg};font-family:GolosL, GolosC;color:${C.fg};padding:48px">
    <div style="${col}background:${ph.color};border-radius:28px;padding:40px 44px;color:#ffffff">
      <div style="display:flex;width:100%;justify-content:space-between;font-size:24px;letter-spacing:2px">
        <div style="display:flex;flex:1">НЕДЕЛЯ ${n} · ${esc(ageLabel(n).replace("≈","~"))}</div><div style="display:flex">${esc(ph.name)}</div>
      </div>
      <div style="display:flex;font-family:UnbL, UnbC;font-size:58px;line-height:1.15;margin-top:18px">${esc(w.t)}</div>
    </div>
    <div style="${col}background:${C.card};border-radius:28px;padding:40px 44px;margin-top:24px;gap:26px">
      ${label("Что происходит")}
      <div style="display:flex;font-size:28px;line-height:1.45;margin-top:-12px">${esc(w.d)}</div>
      <div style="display:flex;height:2px;background:${C.line}"></div>
      ${label("Задания недели")}
      <div style="${col}gap:22px;margin-top:-6px">${quests}${orders}</div>
      <div style="display:flex;height:2px;background:${C.line}"></div>
      ${label("Почему")}
      <div style="display:flex;font-size:25px;line-height:1.45;color:${C.muted};margin-top:-12px">${esc(w.w)}</div>
      <div style="${col}background:${C.enSoft};border-radius:16px;padding:22px 26px;gap:8px">
        <div style="display:flex;font-size:19px;font-weight:600;color:${C.en};letter-spacing:2px">ЯЗЫК</div>
        <div style="display:flex;font-size:25px;line-height:1.45">${esc(w.l)}</div>
      </div>
      ${w.m?`<div style="${col}background:${C.healthSoft};border-radius:16px;padding:22px 26px;gap:8px">
        <div style="display:flex;font-size:19px;font-weight:600;color:${C.health};letter-spacing:2px">ВРАЧ</div>
        <div style="display:flex;font-size:25px;line-height:1.45">${esc(w.m)}</div>
      </div>`:""}
    </div>
    <div style="display:flex;width:100%;justify-content:space-between;font-size:20px;color:${C.muted};margin-top:24px;padding:0 8px">
      <div style="display:flex;flex:1">Первый год · неделя ${n} из 52</div><div style="display:flex">отметки и подсказки — в приложении</div>
    </div>
  </div>`;
}


// Праздничная картинка «N месяцев». Имя ребёнка — в подписи сообщения, картинка общая.
export function monthHTML(k){
  const week = Math.min(52, Math.floor(k*30.44/7)+1), ph = PHASES.find(p=>week>=p.from&&week<=p.to);
  const palette = PHASES.map(p=>p.color).concat(["#ffffff","#ffd166"]);
  let seed = k*9973; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
  const dots = Array.from({length:140}, (_,i) => {
    const x = Math.round(rnd()*1040), y = Math.round(rnd()*1040), s = 10+Math.round(rnd()*22), c = palette[i%palette.length];
    if (x > 90 && x < 950 && y > 110 && y < 960) return "";   // центр оставляем под текст
    const round = rnd() < .4, rot = Math.round(rnd()*90);
    return `<div style="display:flex;position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${round?s:Math.round(s/2)}px;background:${c};border-radius:${round?s:3}px;transform:rotate(${rot}deg)"></div>`;
  }).join("");
  return `<div style="display:flex;width:1080px;height:1080px;background:${ph.color};font-family:GolosL, GolosC;color:#ffffff;position:relative">
    ${dots}
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;position:absolute;left:0;top:0;width:1080px;height:1080px">
    <div style="display:flex;font-family:UnbL, UnbC;font-size:64px">Ураа!</div>
    <div style="display:flex;font-family:UnbL, UnbC;font-size:420px;line-height:1;margin-top:10px">${k}</div>
    <div style="display:flex;font-family:UnbL, UnbC;font-size:72px;margin-top:-10px">${plural(k,"месяц","месяца","месяцев")}</div>
    <div style="display:flex;width:860px;background:#ffffff;color:${C.fg};border-radius:28px;padding:30px 36px;margin-top:48px;font-size:30px;line-height:1.45;text-align:center;justify-content:center">${esc(MONTHLY[k]||"")}</div>
    </div>
  </div>`;
}
