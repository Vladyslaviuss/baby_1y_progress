// Схематичные анимации упражнений (пиктограммы, без лица). Единый риг для приложения, стайлгайда и видео.
// Малыш всегда головой влево. Вид сбоку (side) или сверху (top) в одной рамке.
// Углы в градусах: 0 — вправо, отрицательные — вверх. Углы конечностей — относительно оси туловища.
// Цвета — CSS-переменные (--pg-*): схема сама подстраивается под светлую и тёмную тему.
import { tr } from "./i18n.js";

export const PG_CSS = `
.pg{--pg-ok:#3F8F5A;--pg-warn:#B4432C;--pg-body:#C9B8AC;--pg-far:#E3D6CC;--pg-active:#C46A45;--pg-active-far:#EBB59C;--pg-adult:#2E4B3F;--pg-adult-far:#7F978B;--pg-mat:#F1E6DC;--pg-guide:#C46A45;--pg-prop:#E9C46A}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .pg{--pg-ok:#7CC48E;--pg-warn:#F29A82;--pg-body:#8E7E72;--pg-far:#5C5048;--pg-active:#EDA07E;--pg-active-far:#8A5640;--pg-adult:#8FC1A6;--pg-adult-far:#56756A;--pg-mat:#2E2723;--pg-guide:#EDA07E;--pg-prop:#B8953F}}
:root[data-theme="dark"] .pg{--pg-ok:#7CC48E;--pg-warn:#F29A82;--pg-body:#8E7E72;--pg-far:#5C5048;--pg-active:#EDA07E;--pg-active-far:#8A5640;--pg-adult:#8FC1A6;--pg-adult-far:#56756A;--pg-mat:#2E2723;--pg-guide:#EDA07E;--pg-prop:#B8953F}`;

export const VIEWBOX = "16 110 620 210";
const MAT_Y = 300;
const L = {torso:128, torsoR:26, headR:42, thigh:70, shin:62, upper:38, fore:34};
const W = {thigh:30, shin:23, upper:19, fore:16};

const rad = d => d * Math.PI / 180;
const pt = (p, a, l) => [p[0] + l * Math.cos(rad(a)), p[1] + l * Math.sin(rad(a))];
const f = n => Math.round(n * 10) / 10;
const ln = (a, b, w, c, extra = "") => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const dot = (p, r, c, extra = "") => `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="${c}" ${extra}/>`;
const C = {body:"var(--pg-body)", far:"var(--pg-far)", act:"var(--pg-active)", actFar:"var(--pg-active-far)", adult:"var(--pg-adult)", adultFar:"var(--pg-adult-far)", mat:"var(--pg-mat)", guide:"var(--pg-guide)", prop:"var(--pg-prop)"};

// ---------- скелет (вид сбоку) ----------
// pose: {S:[x,y] плечо, a: угол туловища (0 — лежит, голова слева), head: наклон головы, headLift: подъём головы (на животе),
//        thigh/knee/up/elbow: [ближняя, дальняя] относительно туловища, breath, active:"legs"|"arms"|"head"|null}
export function skeleton(p){
  const a = p.a ?? 0, d = a, n = a - 90;            // d — вдоль туловища к ногам, n — «вверх» от спины
  const S = p.S ?? [196, 258];
  const c1 = pt(pt(S, n, -10), d, -18), c2 = pt(c1, d, L.torso);
  const hipN = pt(pt(c2, d, -8), n, 4), hipF = pt(pt(hipN, n, 9), d, -6), shF = pt(pt(S, n, 8), d, 8);
  const neck = pt(c1, d, -14);
  const headBase = pt(pt(c1, d, -L.headR - 12), n, 20);
  const head = p.headLift !== undefined ? pt(neck, d + 180 + p.headLift, L.headR + 12) : (p.head ? rotateAround(headBase, neck, p.head) : headBase);
  const leg = (hip, th, kn) => { const k = pt(hip, a + th, L.thigh), sa = a + th + kn, an = pt(k, sa, L.shin); return {hip, knee:k, ankle:an, shinA:sa, footA: sa - 82 * (p.prone ? -1 : 1)}; };
  const arm = (sh, up, el) => { const e = pt(sh, a + up, L.upper), w = pt(e, a + up + el, L.fore); return {sh, elbow:e, wrist:w, foreA: a + up + el}; };
  const on = (along, side) => pt(pt(c1, d, along), n, side);   // точка на теле: вдоль от плеч, вбок от оси (+ к спине/верху)
  return {a, c1, c2, neck, head, on, n, d,
    legN: leg(hipN, p.thigh[0], p.knee[0]), legF: leg(hipF, p.thigh[1], p.knee[1]),
    armN: arm(S, p.up[0], p.elbow[0]), armF: arm(shF, p.up[1], p.elbow[1])};
}
function rotateAround(p, c, ang){
  const r = rad(ang), x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * Math.cos(r) - y * Math.sin(r), c[1] + x * Math.sin(r) + y * Math.cos(r)];
}
const legSvg = (j, c) => ln(j.hip, j.knee, W.thigh, c) + ln(j.knee, j.ankle, W.shin, c) + ln(j.ankle, pt(j.ankle, j.footA, 16), 15, c);
const armSvg = (j, c) => ln(j.sh, j.elbow, W.upper, c) + ln(j.elbow, j.wrist, W.fore, c) + dot(j.wrist, 10.5, c);

// ---------- руки взрослого и предметы ----------
// Прихват поперёк голени + обрубок предплечья в сторону dir.
function gripShin(j, at, c, dir){
  const g = pt(j.knee, j.shinA, L.shin * at);
  const a = pt(g, j.shinA + 90, 19), b = pt(g, j.shinA - 90, 19), wrist = pt(g, dir, 26), stub = pt(wrist, dir, 46);
  return `<g opacity=".92">${ln(wrist, stub, 20, c, 'opacity=".55"')}${ln(g, wrist, 18, c)}${ln(a, b, 17, c)}</g>`;
}
// Ладонь взрослого (круг) + предплечье от неё в сторону dir. Пальцы-указатель: fingers — короткая капсула.
function hand(p, dir, c, len = 60, extra = ""){
  const w = pt(p, dir, 24), e = pt(w, dir, len);
  return `<g ${extra}>${ln(w, e, 20, c, 'opacity=".55"')}${ln(p, w, 18, c)}${dot(p, 15, c)}</g>`;
}
function fingers(p, ang, c){ const b = pt(p, ang + 180, 26); return `${ln(b, p, 10, c)}${ln(pt(b, ang + 180, 2), pt(b, ang + 180, 40), 20, c, 'opacity=".55"')}`; }
function impact(p, ang, k){   // штрихи удара
  if (k <= 0) return "";
  return [-28, 0, 28].map(o => { const a = pt(p, ang + o, 22), b = pt(p, ang + o, 22 + 16 * k); return ln(a, b, 3.5, C.guide, `opacity="${f(k)}"`); }).join("");
}
function arrowAt(p, ang, size = 12){
  const tip = pt(p, ang, size), l = pt(tip, ang + 150, size), r = pt(tip, ang - 150, size);
  return `<path d="M${f(l[0])} ${f(l[1])} L${f(tip[0])} ${f(tip[1])} L${f(r[0])} ${f(r[1])}" fill="none" stroke="${C.guide}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}
const mat = (y = MAT_Y) => `<rect x="30" y="${y}" width="600" height="10" rx="5" fill="${C.mat}"/>`;

// ---------- сцена вида сбоку ----------
function sideScene(p){
  const s = skeleton(p), A = p.active;
  const legC = A === "legs" ? [C.act, C.actFar] : [C.body, C.far];
  const armC = A === "arms" ? [C.act, C.actFar] : [C.body, C.far];
  const headC = A === "head" ? C.act : C.body;
  const b = 1 + 0.035 * (p.breath ?? 0), mid = pt(s.c1, s.a, L.torso / 2);
  const torso = `<g transform="translate(${f(mid[0])} ${f(mid[1])}) rotate(${f(s.a)}) scale(1 ${f(b * 1000) / 1000}) rotate(${f(-s.a)}) translate(${f(-mid[0])} ${f(-mid[1])})">${ln(s.c1, s.c2, L.torsoR * 2, A === "torso" ? C.act : C.body)}</g>`;
  const g = p.grips || [];
  const gF = g.find(x => x.leg === "far"), gN = g.find(x => x.leg === "near");
  const under = (p.under || []).join(""), over = (p.over || []).join("");
  return `${p.mat === false ? "" : mat()}${under}
    ${gF ? gripShin(s.legF, gF.at, C.adultFar, gF.dir ?? -22) : ""}
    ${armSvg(s.armF, armC[1])}${legSvg(s.legF, legC[1])}
    ${torso}${dot(s.head, L.headR, headC)}
    ${legSvg(s.legN, legC[0])}
    ${gN ? gripShin(s.legN, gN.at, C.adult, gN.dir ?? 28) : ""}
    ${armSvg(s.armN, armC[0])}${over}`;
}

// ---------- вид сверху (лежит на спине, голова слева) ----------
// pose: {turn: 0..1 — поворот на бок к зрителю, arms:[ближняя(снизу), дальняя(сверху)] углы, legs:[...], active}
const TOP = {head:[120, 214], c1:[170, 214], c2:[288, 214], half:28, shY:20, hipY:15};
function topScene(p){
  const turn = p.turn ?? 0, A = p.active;
  const sq = 1 - 0.55 * turn, dy = 14 * turn;                     // туловище «сужается» и съезжает при повороте
  const y = TOP.c1[1] + dy;
  const shN = [TOP.c1[0] + 10, y + TOP.shY * sq], shF = [TOP.c1[0] + 10, y - TOP.shY * sq];
  const hipN = [TOP.c2[0] - 4, y + TOP.hipY * sq], hipF = [TOP.c2[0] - 4, y - TOP.hipY * sq];
  const limb = (o, a1, l1, w1, a2, l2, w2, end, c) => { const m = pt(o, a1, l1), e = pt(m, a2, l2); return ln(o, m, w1, c) + ln(m, e, w2, c) + end(e, a2, c); };
  const footEnd = (e, a, c) => ln(e, pt(e, a + 90, 13), 15, c);
  const handEnd = (e, a, c) => dot(e, 10.5, c);
  const armC = A === "arms" ? [C.act, C.actFar] : [C.body, C.far], legC = A === "legs" ? [C.act, C.actFar] : [C.body, C.far];
  const [aN, aF] = p.arms ?? [[110, 70], [-110, -70]], [lN, lF] = p.legs ?? [[14, -4], [-14, 4]];
  const farArm = limb(shF, aF[0], L.upper, W.upper, aF[1], L.fore, W.fore, handEnd, armC[1]);
  const farLeg = limb(hipF, lF[0], L.thigh, W.thigh, lF[1], L.shin, W.shin, footEnd, legC[1]);
  const nearArm = limb(shN, aN[0], L.upper, W.upper, aN[1], L.fore, W.fore, handEnd, armC[0]);
  const nearLeg = limb(hipN, lN[0], L.thigh, W.thigh, lN[1], L.shin, W.shin, footEnd, legC[0]);
  const torso = `<rect x="${TOP.c1[0] - TOP.half}" y="${f(y - TOP.half * sq - 6 * (1 - sq))}" width="${TOP.c2[0] - TOP.c1[0] + TOP.half * 2}" height="${f((TOP.half * 2) * sq + 12 * (1 - sq))}" rx="${f(TOP.half * sq + 6 * (1 - sq))}" fill="${A === "torso" ? C.act : C.body}"/>`;
  return `<rect x="30" y="140" width="600" height="160" rx="24" fill="${C.mat}" opacity=".6"/>${(p.under || []).join("")}
    ${turn < 0.85 ? farArm + farLeg : ""}${torso}${dot([TOP.head[0], TOP.head[1] + dy * .6], L.headR, C.body)}${nearLeg}${nearArm}
    ${turn >= 0.85 ? farLeg : ""}${(p.over || []).join("")}`;
}

// Траектория: точка trace(t) за период → пунктир + стрелка направления сейчас.
function guide(M, t){
  if (!M.trace) return "";
  const N = 56, pts = [];
  for (let i = 0; i <= N; i++) pts.push(M.trace(i / N * M.period));
  const now = M.trace(t), nx = M.trace(t + 0.06);
  if (Math.hypot(nx[0] - now[0], nx[1] - now[1]) < 0.3) return `<polyline points="${pts.map(q => `${f(q[0])},${f(q[1])}`).join(" ")}" fill="none" stroke="${C.guide}" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round" opacity=".7"/>`;
  const ang = Math.atan2(nx[1] - now[1], nx[0] - now[0]) * 180 / Math.PI;
  return `<polyline points="${pts.map(q => `${f(q[0])},${f(q[1])}`).join(" ")}" fill="none" stroke="${C.guide}" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round" opacity=".7"/>${arrowAt(now, ang, 14)}`;
}

export function pictScene(pose, opts = {}){
  if (pose.raw) return `<g class="pg">${pose.raw}</g>`;   // своя сцена (СЛР крупно)
  const body = pose.view === "top" ? topScene(pose) : sideScene(pose);
  return `<g class="pg">${body}${opts.guide ? guide(opts.guide, opts.t) : ""}</g>`;
}
export const pictSvg = (inner, cls = "", viewBox = VIEWBOX) => `<svg class="${cls}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img">${inner}</svg>`;

// ---------- движение ----------
const ease = u => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
const lerp = (a, b, u) => a + (b - a) * u;
const L2 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
const cyc = (t, T) => (((t % T) + T) % T) / T;
export function kf(p, frames){
  for (let i = 1; i < frames.length; i++) {
    const [a, va] = frames[i-1], [b, vb] = frames[i];
    if (p <= b) return lerp(va, vb, ease((p - a) / (b - a || 1)));
  }
  return frames.at(-1)[1];
}
const breath = t => 0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 2.4);
const rest = t => ({breath: breath(t), up:[-70, -78], elbow:[-40, -36], thigh:[-24, -30], knee:[60, 64]});

const bikePose = t => { const w = 2 * Math.PI / 2.2, Lg = ph => ({th: -58 + 46 * Math.cos(w * t + ph), kn: 70 - 56 * Math.cos(w * t + ph + 0.55)}), n = Lg(0), r = Lg(Math.PI);
  return {...rest(t), active:"legs", thigh:[n.th, r.th], knee:[n.kn, r.kn], grips:[{leg:"far", at:.5}, {leg:"near", at:.5}]}; };
const kneesPose = t => { const u = kf(cyc(t, 6), [[0,0],[.28,1],[.62,1],[.9,0],[1,0]]);
  return {...rest(t), active:"legs", thigh:[lerp(-14, -118, u), lerp(-20, -112, u)], knee:[lerp(16, 122, u), lerp(22, 116, u)], grips:[{leg:"far", at:.5}, {leg:"near", at:.5}]}; };

// На животе: голова и плечи поднимаются, опора на предплечья; игрушка впереди
const tummyU = t => kf(cyc(t, 5), [[0,0],[.3,1],[.7,1],[1,0]]);
const pronePose = (t, u) => ({breath: breath(t), prone:true, active:"head", a:0, S:[196, 278], headLift: lerp(-6, 38, u),
  up:[lerp(112, 124, u), 120], elbow:[lerp(62, 52, u), 56], thigh:[2, -2], knee:[-10, -6]});
// Поза + предметы, посчитанные от готового скелета
const withProps = (pose, fn) => { const sk = skeleton(pose); return {...pose, ...fn(sk)}; };
const forearmUnder = (sk, from, to, off, ang) => {   // предплечье взрослого вдоль тела снизу
  const a1 = sk.on(from, -off), a2 = sk.on(to, -off), e = pt(a2, ang, 150);
  return [ln(a1, a2, 30, C.adult), ln(a2, e, 34, C.adult, 'opacity=".55"')];
};
const topWrist = (sh, a1, a2) => pt(pt(sh, a1, L.upper), a2, L.fore);

export const PICT = {
  bike:   {title:"Велосипед", period:2.2, meta:"1 оборот за 2,2 с · 5–10 оборотов", pose: bikePose, trace: t => skeleton(bikePose(t)).legN.ankle},
  knees:  {title:"Колени к животу", period:6, meta:"подъём 1,7 с · удержание 2 с · вниз 1,7 с", pose: kneesPose, trace: t => skeleton(kneesPose(t)).legN.knee},
  hug:    {title:"Обнимашки", period:3.2, meta:"5–8 раз · медленно, под счёт", pose(t){
    const u = kf(cyc(t, 3.2), [[0,0],[.45,1],[.6,1],[1,0]]);
    const aN = [lerp(92, -52, u), lerp(92, -112, u)], aF = [lerp(-92, 52, u), lerp(-92, 112, u)];
    const wN = topWrist([TOP.c1[0] + 10, TOP.c1[1] + TOP.shY], ...aN), wF = topWrist([TOP.c1[0] + 10, TOP.c1[1] - TOP.shY], ...aF);
    return {view:"top", active:"arms", arms:[aN, aF], over:[hand(wN, 75, C.adult, 50, 'opacity=".9"'), hand(wF, -75, C.adultFar, 50, 'opacity=".9"')]};
  }, trace: t => { const u = kf(cyc(t, 3.2), [[0,0],[.45,1],[.6,1],[1,0]]); return topWrist([TOP.c1[0] + 10, TOP.c1[1] + TOP.shY], lerp(92, -52, u), lerp(92, -112, u)); }},
  tummy:  {title:"Время на животе", period:5, meta:"поднимает голову 2–3 с · от 1–2 мин, кусочками", pose(t){
    return {...pronePose(t, tummyU(t)), under:[`<g><circle cx="60" cy="262" r="16" fill="${C.prop}"/><rect x="56" y="276" width="8" height="24" rx="4" fill="${C.prop}"/></g>`]};
  }, trace: t => skeleton(pronePose(t, tummyU(t))).head},
  ball:   {title:"Фитбол", period:2.8, meta:"медленно вперёд-назад на 10–15 см · 1–3 мин", pose(t){
    const k = Math.sin(t * 2 * Math.PI / 2.8), ang = 7 * k, cx = 330 + 16 * k, cy = 236, R = 66;
    const S = rotateAround([284, cy - R - 26 + 16], [cx, cy], ang);
    return withProps({mat:false, breath: breath(t), prone:true, a: ang, S, headLift: 12, active:"torso",
      up:[118, 122], elbow:[30, 34], thigh:[14, 10], knee:[-24, -20]}, sk => ({
      under:[mat(), `<circle cx="${f(cx)}" cy="${cy}" r="${R}" fill="${C.prop}" opacity=".9"/>`],
      over:[hand(sk.on(40, 30), ang - 70, C.adult, 50), hand(sk.on(112, 28), ang - 50, C.adult, 50)]}));
  }},
  airplane:{title:"Самолётик", period:3.4, meta:"животом на предплечье · лёгкое покачивание", pose(t){
    const k = Math.sin(t * 2 * Math.PI / 3.4), ang = 5 * k;
    return withProps({mat:false, breath: breath(t), prone:true, a: ang, S:[226, 200], headLift: 8, active:"torso",
      up:[96, 100], elbow:[8, 12], thigh:[16, 12], knee:[22, 26]}, sk => ({
      under: forearmUnder(sk, -20, 120, 34, 25 + ang),
      over:[hand(sk.on(70, 30), ang - 70, C.adult, 40)]}));
  }},
  pullsit:{title:"Подтягивание к сидению", period:5, meta:"только если держит голову · медленно, 2–3 раза", pose(t){
    const u = kf(cyc(t, 5), [[0,0],[.4,1],[.6,1],[1,0]]);
    const a = lerp(0, 40, u), hip = [318, 276], S = pt(hip, a + 180, 116);
    const base = {...rest(t), a, S, active:"torso", up:[-62, -58], elbow:[-8, -6], thigh:[-a - 6, -a - 12], knee:[16, 22]};
    return withProps(base, sk => ({over:[hand(sk.armN.wrist, -40, C.adult, 70)]}));
  }},
  roll:   {title:"Помощь с переворотом", period:4.4, meta:"ножка через ножку · по 2–3 раза в каждую сторону", pose(t){
    const p = cyc(t, 4.4), u = kf(p, [[0,0],[.25,0],[.55,1],[.8,1],[1,0]]), leg = kf(p, [[0,0],[.15,1],[.6,1],[.85,0],[1,0]]);
    const lF = [lerp(-14, 42, leg), lerp(4, 22, leg)];
    const knee = pt([TOP.c2[0] - 4, TOP.c1[1] - TOP.hipY], lF[0], L.thigh);
    return {view:"top", turn: u, active:"legs", legs:[[14, -4], lF],
      under:[`<g><circle cx="300" cy="312" r="13" fill="${C.prop}"/><rect x="296" y="323" width="8" height="14" rx="4" fill="${C.prop}"/></g>`],
      over:[hand(knee, -70, C.adult, 50, `opacity="${f(0.35 + 0.65 * leg)}"`)]};
  }},
  massage:{title:"Массаж живота", period:3, meta:"по часовой стрелке · тёплой ладонью · 5–10 кругов", pose(t){
    const w = 2 * Math.PI / 3, p = [232 + 24 * Math.cos(w * t), 214 + 16 * Math.sin(w * t)];
    return {view:"top", active:null, over:[hand(p, -70, C.act, 70)]};
  }, trace: t => { const w = 2 * Math.PI / 3; return [232 + 24 * Math.cos(w * t), 214 + 16 * Math.sin(w * t)]; }},
  backblows:{title:"Подавилась: удары по спине", get period(){ return CH_T; }, meta:"5 резких ударов между лопатками · голова ниже тела", pose:t => backBlowsPose(t)},
  thrusts:{title:"Подавилась: толчки в грудь", get period(){ return CH_T; }, meta:"5 толчков двумя пальцами · на 4 см · голова ниже тела", pose:t => thrustsPose(t)},
  cpr:    {title:"Не дышит: непрямой массаж", get period(){ return CPR_T; }, meta:"110 в минуту · 30 нажатий : 2 вдоха · глубина ~4 см", pose:t => cprPose(t)},
};
// ---------- Подавилась: схемы сбоку, крупно ----------
// Малыш на предплечье взрослого, голова ниже тела (вся группа наклонена). 5 ударов между лопатками → 5 толчков в грудину.
const CH_P = 1.0, CH_N = 5, CH_T = CH_P * CH_N + 1.4;
const chLab = (x, y, s, c, a = "start", w = 600) => `<text x="${x}" y="${y}" fill="${c}" font-size="13" font-weight="${w}" text-anchor="${a}" font-family="var(--body, sans-serif)">${tl(s)}</text>`;
// Взрослый: предплечье под малышом (локоть справа, плечо уходит вниз за кадр), кисть под головой.
// Малыш лежит вдоль предплечья, вся сцена чуть наклонена — голова ниже тела.
const CH_TILT = `rotate(-8 330 250)`;
function chokeBody(){
  const arm = `${ln([166, 270], [468, 270], 28, C.adult)}${ln([468, 270], [540, 330], 30, C.adult)}`;
  const legF = `${ln([388, 240], [428, 272], 15, C.far)}${ln([428, 272], [446, 300], 12, C.far)}`;
  const legN = `${ln([382, 246], [412, 284], 16, C.body)}${ln([412, 284], [398, 310], 13, C.body)}${dot([396, 314], 8, C.body)}`;
  const armB = `${ln([248, 246], [238, 284], 12, C.body)}${dot([237, 290], 7.5, C.body)}`;
  return {arm, legF, legN, armB, torso:`<rect x="222" y="216" width="176" height="36" rx="18" fill="${C.body}"/>`, head:dot([194, 232], 30, C.body)};
}
const chFrame = (inner, count, left, right, ok) => `<rect x="30" y="118" width="600" height="196" rx="24" fill="${C.mat}" opacity=".6"/>
  <g transform="${CH_TILT}">${inner}</g>
  ${chLab(612, 146, count, C.adult, "end", 700)}
  ${left.map(([y, s, c, w]) => chLab(46, y, s, c, "start", w)).join("")}
  ${right.map(([y, s, c, w]) => chLab(470, y, s, c, "start", w)).join("")}
  ${chLab(46, 196, "↙ голова ниже тела", "var(--pg-guide)")}`;
function backBlowsPose(t){
  const u = ((t % CH_T) + CH_T) % CH_T, on = u < CH_P * CH_N, n = on ? Math.floor(u / CH_P) + 1 : CH_N;
  const p = on ? (u % CH_P) / CH_P : 0;
  const lift = on ? kf(p, [[0,0],[.5,1],[.68,0],[1,0]]) : .7, hit = on && p > .66 && p < .9 ? 1 - (p - .66) / .24 : 0;
  const ok = "var(--pg-ok)", ink = C.adult, b = chokeBody();
  const zone = `<rect x="252" y="208" width="58" height="12" rx="6" fill="${ok}" opacity="${f(.4 + .45 * hit)}" stroke="${ok}" stroke-width="2"/>`;
  // пальцы держат челюсть снизу и сбоку, рот свободен
  const jaw = `<path d="M170 262 Q158 238 172 214" fill="none" stroke="${ink}" stroke-width="11" stroke-linecap="round"/>`;
  // вторая рука: ладонь ребром к спине, удар основанием (нижней частью) ладони
  const y = 186 - 46 * lift;
  // ладонь «варежкой»: пальцы сомкнуты и вытянуты к голове, бьёт нижняя часть ладони
  const strike = `${ln([304, y - 8], [344, y - 60], 24, ink)}
    <path d="M318 ${f(y - 14)} Q322 ${f(y + 10)} 300 ${f(y + 10)} L246 ${f(y + 8)} Q232 ${f(y + 7)} 232 ${f(y - 1)} Q232 ${f(y - 9)} 246 ${f(y - 10)} L296 ${f(y - 16)} Q314 ${f(y - 18)} 318 ${f(y - 14)}Z" fill="${ink}"/>
    ${hit ? [-1, 0, 1].map(k => ln([290 + 22 * k, 202], [296 + 30 * k, 190], 3, "var(--pg-guide)", `opacity="${f(hit)}"`)).join("") : ""}
    ${ln([474, 192], [314, 214], 2, ok)}`;
  return {raw:chFrame(`${b.legF}${b.arm}${b.torso}${b.armB}${b.head}${zone}${jaw}${b.legN}${strike}`,
    on ? `${tl("Удар")} ${n} / 5` : tl("Не вышло — 5 толчков в грудь"),
    [[150, "держи челюсть пальцами,", C.adult, 500], [167, "рот не закрывай", C.adult, 500]],
    [[180, "✓ основанием ладони", ok, 700], [197, "между лопатками", C.adult, 500], [214, "5 резких ударов", C.adult, 500]], ok)};
}
function thrustsPose(t){
  const u = ((t % CH_T) + CH_T) % CH_T, on = u < CH_P * CH_N, n = on ? Math.floor(u / CH_P) + 1 : CH_N;
  const press = on ? kf((u % CH_P) / CH_P, [[0,0],[.4,1],[.55,1],[1,0]]) : 0;
  const ok = "var(--pg-ok)", ink = C.adult, b = chokeBody(), dip = 6 * press;
  // на спине: ладонь под затылком; соски — пунктир; зона чуть ниже них
  const hold = `<path d="M168 268 Q150 236 172 208" fill="none" stroke="${ink}" stroke-width="13" stroke-linecap="round"/>`;
  const nip = `<line x1="272" y1="200" x2="272" y2="218" stroke="var(--pg-guide)" stroke-width="2" stroke-dasharray="2 4"/>`;
  const zone = `<rect x="278" y="${f(210 + dip)}" width="34" height="12" rx="6" fill="${ok}" opacity="${f(.4 + .45 * press)}" stroke="${ok}" stroke-width="2"/>`;
  const tip = 214 + dip;
  // кисть: ладонь, два вытянутых пальца нормальной толщины со скруглёнными кончиками, остальные поджаты, большой палец сбоку
  const hand = `${ln([306, tip - 64], [344, tip - 106], 26, ink)}
    <rect x="280" y="${f(tip - 72)}" width="50" height="34" rx="15" fill="${ink}"/>
    <rect x="282" y="${f(tip - 46)}" width="15" height="46" rx="7.5" fill="${ink}"/><rect x="299" y="${f(tip - 46)}" width="15" height="44" rx="7.5" fill="${ink}"/>
    <rect x="315" y="${f(tip - 48)}" width="17" height="20" rx="8.5" fill="${ink}"/>
    <path d="M282 ${f(tip - 58)} Q270 ${f(tip - 52)} 274 ${f(tip - 40)}" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/>
    <path d="M297.5 ${f(tip - 44)} V${f(tip - 6)}" stroke="var(--pg-mat)" stroke-width="1.5" opacity=".5"/>
    ${ln([474, 192], [312, 212], 2, ok)}`;
  return {raw:chFrame(`${b.legF}${b.arm}${hold}${b.torso}${b.armB}${b.head}${nip}${zone}${b.legN}${hand}`,
    on ? `${tl("Толчок")} ${n} / 5` : tl("Не вышло — снова 5 ударов по спине"),
    [[150, "ладонь под затылком", C.adult, 500], [167, "и шеей", C.adult, 500]],
    [[180, "✓ 2 пальца на грудину", ok, 700], [197, "чуть ниже линии сосков", C.adult, 500], [214, "5 толчков вниз ~4 см", C.adult, 500]], ok)};
}
// ---------- СЛР крупно: грудь сверху, зоны грудины, два пальца; 30 нажатий → 2 вдоха ----------
// Голова слева, ноги справа (за кадром). Грудина — полоса по центру; линия сосков — пунктир поперёк.
// Зелёная зона — нижняя половина грудины сразу под линией сосков; красное — мечевидный отросток и живот.
const CPR_P = 60 / 110, CPR_N = 30, CPR_BR = 1.25, CPR_T = CPR_P * CPR_N + 2 * CPR_BR + 0.6;
const T_CPR = {}; const tl = s => (T_CPR[s] ??= tr(s));   // подписи переводим один раз, а не каждый кадр
function cprPose(t){
  const u = ((t % CPR_T) + CPR_T) % CPR_T, inPress = u < CPR_P * CPR_N;
  const n = inPress ? Math.floor(u / CPR_P) + 1 : CPR_N;
  const press = inPress ? kf((u % CPR_P) / CPR_P, [[0,0],[.42,1],[.55,1],[1,0]]) : 0;
  const bu = u - CPR_P * CPR_N - 0.3, breath = !inPress && bu > 0 && bu < 2 * CPR_BR ? Math.floor(bu / CPR_BR) + 1 : 0;
  const rise = breath ? Math.sin(Math.PI * Math.min(1, ((bu % CPR_BR) / CPR_BR) / .8)) : 0;
  const yC = 216, sx0 = 206, nipX = 262, tz = [268, 314], xi = 330;   // грудина: от яремной ямки до мечевидного отростка
  const ok = "var(--pg-ok)", bad = "var(--pg-warn)", ink = C.adult, lab = (x, y, s, c, a = "start", w = 600) =>
    `<text x="${x}" y="${y}" fill="${c}" font-size="13" font-weight="${w}" text-anchor="${a}" font-family="var(--body, sans-serif)">${tl(s)}</text>`;
  const sc = 1 + 0.035 * rise, dip = 3 * press;                       // вдох — грудь приподнимается; нажатие — прогиб
  const ribs = [0, 1, 2, 3, 4].map(i => { const x = 222 + i * 24;
    return `<path d="M${x} ${yC - 11} Q${x + 8} ${yC - 44} ${x + 34} ${yC - 74}M${x} ${yC + 11} Q${x + 8} ${yC + 44} ${x + 34} ${yC + 74}" fill="none" stroke="${C.far}" stroke-width="5" stroke-linecap="round"/>`; }).join("");
  const body = `<g transform="translate(330 ${yC}) scale(${f(sc)}) translate(-330 ${-yC})">
    <path d="M206 136 Q290 104 370 120 L470 124 L470 132 Q330 124 232 150Z M206 296 Q290 328 370 312 L470 308 L470 300 Q330 308 232 282Z" fill="${C.far}"/>
    <rect x="186" y="134" width="290" height="164" rx="62" fill="${C.body}"/>
    ${ribs}
    <rect x="${sx0}" y="${yC - 10 + dip}" width="${xi - sx0}" height="20" rx="10" fill="${C.far}" stroke="${C.adultFar}" stroke-width="1.5"/>
    <rect x="${sx0 + 2}" y="${yC - 8 + dip}" width="${nipX - sx0 - 6}" height="16" rx="8" fill="${C.body}" opacity=".55"/>
    <rect x="${tz[0]}" y="${yC - 12 + dip}" width="${tz[1] - tz[0]}" height="24" rx="12" fill="${ok}" opacity="${f(.28 + .25 * press)}" stroke="${ok}" stroke-width="2.5"/>
    <path d="M${xi - 2} ${yC - 9 + dip} L${xi + 18} ${yC + dip} L${xi - 2} ${yC + 9 + dip}Z" fill="${bad}" opacity=".85"/>
    <circle cx="${nipX}" cy="${yC - 50}" r="6" fill="${C.adultFar}"/><circle cx="${nipX}" cy="${yC + 50}" r="6" fill="${C.adultFar}"/>
  </g>
  <rect x="152" y="${yC - 22}" width="44" height="44" rx="14" fill="${C.body}"/>
  <circle cx="112" cy="${yC}" r="56" fill="${C.body}"/>
  <ellipse cx="128" cy="${yC}" rx="5" ry="8" fill="${C.adultFar}" opacity=".7"/><path d="M146 ${yC - 9} Q152 ${yC} 146 ${yC + 9}" fill="none" stroke="${C.adultFar}" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
  const guides = `<line x1="${nipX}" y1="${yC - 76}" x2="${nipX}" y2="${yC + 76}" stroke="${C.guide}" stroke-width="2" stroke-dasharray="3 6" opacity=".9"/>
    ${lab(nipX - 8, yC + 90, "линия сосков", C.guide, "end", 600)}
    <path d="M${tz[1] + 4} ${yC - 14} L488 ${yC - 58}" stroke="${ok}" stroke-width="2"/>${lab(494, yC - 72, "✓ сюда:", ok, "start", 700)}${lab(494, yC - 55, "2 пальца чуть", ink, "start", 500)}${lab(494, yC - 39, "ниже линии сосков", ink, "start", 500)}
    <path d="M${xi + 18} ${yC + 4} L488 ${yC + 40}" stroke="${bad}" stroke-width="2"/>${lab(494, yC + 44, "✕ не сюда:", bad, "start", 700)}${lab(494, yC + 61, "кончик грудины,", ink, "start", 500)}${lab(494, yC + 77, "живот, рёбра", ink, "start", 500)}`;
  // рука взрослого со стороны: два пальца (указательный и средний) вдоль грудины, остальные поджаты
  const tipA = [279, yC + dip * .6], tipB = [303, yC + dip * .6], wr = [300, 330], palm = [292, 300 - 6 * press];
  const fz = 1 - 0.06 * press;
  const hand = inPress || u > CPR_T - 0.3 ? `<g opacity="${inPress ? .93 : f(Math.max(0, (u - (CPR_T - 0.3)) / 0.3))}">
    <circle cx="${f(tipA[0] + 12)}" cy="${f(yC)}" r="${f(18 + 14 * press)}" fill="none" stroke="${ok}" stroke-width="2" opacity="${f(.7 * press)}"/>
    ${ln(wr, palm, 46, ink)}${dot(palm, 30, ink)}
    ${dot([palm[0] + 26, palm[1] - 10], 11, ink)}${dot([palm[0] - 24, palm[1] - 12], 11, ink)}
    ${ln([palm[0] - 10, palm[1] - 18], tipA, f(17 * fz), ink)}${ln([palm[0] + 12, palm[1] - 18], tipB, f(17 * fz), ink)}
    ${dot(tipA, 6, "var(--pg-mat)", 'opacity=".55"')}${dot(tipB, 6, "var(--pg-mat)", 'opacity=".55"')}</g>` : "";
  // вдохи: губы взрослого накрывают рот и нос
  const mouth = breath ? `<ellipse cx="136" cy="${yC}" rx="34" ry="26" fill="${ink}" opacity=".18" stroke="${ink}" stroke-width="3" stroke-dasharray="6 5"/>
    ${[0, 1, 2].map(i => `<path d="M${180 + i * 16} ${yC - 30 + i * 4} q8 -6 16 0" fill="none" stroke="${C.guide}" stroke-width="2.5" stroke-linecap="round" opacity="${f(rise)}"/>`).join("")}` : "";
  // счётчик и глубина
  const depth = `<g transform="translate(48 128)"><rect x="0" y="0" width="96" height="10" rx="5" fill="${C.far}"/><rect x="0" y="0" width="${f(96 * press)}" height="10" rx="5" fill="${ok}"/>
    ${lab(102, 10, "~4 см", ink, "start", 600)}</g>`;
  const counter = breath ? lab(360, 132, `${tl("Вдох")} ${breath} / 2 — ${tl("рот на рот и нос")}`, ink, "middle", 700)
    : inPress ? lab(360, 132, `${n} / 30`, ink, "middle", 700) : "";
  return {raw:`<rect x="30" y="118" width="600" height="196" rx="24" fill="${C.mat}" opacity=".6"/>${body}${guides}${mouth}${hand}${!breath && inPress ? depth : ""}${counter}`};
}
// Порядок для стайлгайда
export const PICT_ORDER = ["bike","knees","hug","tummy","ball","airplane","pullsit","roll","massage","backblows","thrusts","cpr"];
