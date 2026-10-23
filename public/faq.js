// «Вопросы и ответы»: как пользоваться приложением и ботом.
// Под каждым ответом — раскадровка: мини-экран приложения, «палец» нажимает нужное, кадры сменяются по кругу.
// Кадр: {s: разметка экрана, cap: подпись}. Что нажать — элемент с data-t; data-type — текст, который «набирается»;
// data-tick — секундомер. Разметка мини-экранов — классы .m-* в app.css, тексты — те же, что в настоящем интерфейсе.
import { colorHex, leapOf } from "./data.js";
import { tr } from "./i18n.js";

const MAMA = colorHex("raspberry"), PAPA = colorHex("blue");
const SV = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const P = {
  tips:`<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="3.5"/><rect x="4" y="13" width="7" height="7" rx="3.5"/><rect x="13" y="13" width="7" height="7" rx="2"/>`,
  feed:`<path d="M9 3h6M10 3v3l-2 3v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9l-2-3V3"/><path d="M8 13h8"/>`,
  today:`<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>`,
  growth:`<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8.5 12h2l1-2 1.5 4 1-2h1.5"/>`,
  orders:`<path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 8a3 3 0 0 1 6 0"/>`,
  gear:`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  search:`<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>`,
  bm:`<path d="M7 4h10v16l-5-4-5 4z"/>`,
  send:`<path d="M4 12l16-8-6 16-2-7z"/>`,
};
const NAV = [["tips", "Советы"], ["feed", "Кормление"], ["today", "Сегодня"], ["growth", "Здоровье"], ["orders", "Вещи"]];
const t = on => on ? " data-t" : "";

// ---------- детали мини-экрана ----------
// Экран: шапка (возраст, ⚙️, поиск), тело, нижнее меню. o.tap — что нажать в шапке или меню: "gear" | "search" | вкладка.
function scr(body, o = {}){
  const nav = o.nav === false ? "" : `<div class="m-nav">${NAV.filter(([k]) => !(o.hide || []).includes(k)).map(([k, n]) =>
    `<b class="${k === (o.cur ?? "today") ? "on" : ""}"${t(o.tap === k)}>${SV(P[k])}<span>${n}</span></b>`).join("")}</div>`;
  return `<div class="m-top"><span>${o.kid ?? "Малыш · 2 мес 9 дней"}</span><i class="m-ic${o.cur === "set" ? " on" : ""}"${t(o.tap === "gear")}>${SV(P.gear)}</i><i class="m-ic"${t(o.tap === "search")}>${SV(P.search)}</i></div>
    <div class="m-body">${body}</div>${nav}${o.toast ? `<div class="m-toast">${o.toast}</div>` : ""}${o.over || ""}`;
}
const H = (eb, title) => `<div class="m-h">${eb ? `<small>${eb}</small>` : ""}<b>${title}</b></div>`;
const card = (inner, cls = "") => `<div class="m-card ${cls}">${inner}</div>`;
const btn = (x, o = {}) => `<span class="m-btn${o.ghost ? " ghost" : ""}${o.small ? " small" : ""}"${t(o.tap)}>${x}</span>`;
const link = (x, tap) => `<span class="m-link"${t(tap)}>${x}</span>`;
const back = (x = "← Настройки", tap) => `<span class="m-link m-back"${t(tap)}>${x}</span>`;
const small = x => `<small class="m-mut">${x}</small>`;
// строка с отметкой: on — отмечено (цветом c, с именем by); tap — нажать на квадратик; info — кнопка «▶»/«?» справа
const row = (x, o = {}) => `<div class="m-row${o.on ? " on" : ""}"${o.c ? ` style="--c:${o.c}"` : ""}><i class="m-cb"${t(o.tap)}></i>
  <span class="m-t"><span>${x}</span>${o.on && o.by ? `<em class="m-by">${o.by}</em>` : ""}${o.how ? `<small>${o.how}</small>` : ""}</span>${o.info ? `<i class="m-info"${t(o.infoTap)}>${o.info}</i>` : ""}</div>`;
const field = (label, v, o = {}) => `<div class="m-field"><span class="m-lbl">${label}</span><span class="m-in${!v && !o.type ? " ph" : ""}"${t(o.tap)}${o.type ? ` data-type="${o.type}" translate="no"` : ""}>${o.type ? "" : v || o.ph || ""}</span></div>`;
const tgl = (x, sub, on, tap) => `<div class="m-tgl${on ? " on" : ""}"><span><b>${x}</b><small>${sub}</small></span><i${t(tap)}></i></div>`;
const seg = (items, on, tap) => `<div class="m-seg">${items.map((x, i) => `<span class="${i === on ? "on" : ""}"${t(i === tap)}>${x}</span>`).join("")}</div>`;
const toastOnly = x => `<div class="m-toast">${x}</div>`;

// «Сегодня»
const DAYS = [["пн", 3, "full"], ["вт", 4, "full"], ["ср", 5, "part"], ["чт", 6, "full"], ["пт", 7, "part"], ["сб", 8, ""], ["сегодня", 9, "part"]];
const days = (sel = 6, tap = -1, fill = {}) => `<div class="m-days"><div class="m-dhead"><i>‹</i><span>Октябрь ${SV(P.today)}</span><i>›</i></div><div class="m-drow">${DAYS.map(([w, n, f], i) =>
  `<span class="m-day ${fill[i] ?? f} ${i === sel ? "sel" : ""}"${t(i === tap)}><small>${w}</small><i>${n}</i></span>`).join("")}</div></div>`;
const hero = () => `<div class="m-hero"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" class="bg"/><circle cx="20" cy="20" r="16" class="fg" stroke-dasharray="17 100.5" transform="rotate(-90 20 20)"/></svg>
  <span><small>Неделя 10 · Руки и голос</small><b>2 месяца</b><em>до новой недели 3 дня</em></span></div>`;
const tiles = (o = {}) => `<div class="m-tiles"><span class="m-tile"${t(o.tap === "week")}><b>2/5</b>задания недели</span><span class="m-tile ok"${t(o.tap === "routine")}><b>${o.r ?? "4/14"}</b>рутина сегодня</span><span class="m-tile alert"${t(o.tap === "orders")}><b>2</b>пора заказать</span></div>`;
const routine = (o = {}) => card(`<div class="m-head"><b>${o.title ?? "Рутина на сегодня"}</b><em>${o.n ?? "4/14"}</em></div>${o.day ? `<div class="m-dayline"><b>${o.day}</b>${link("К сегодня")}</div>` : ""}<span class="m-eb">Уход</span>
  ${row("Витамин D 400 МЕ", {on:true, c:MAMA, by:"Мама"})}
  ${row("Прогулка", {on:o.walk, c:o.walkC ?? PAPA, by:o.walkBy ?? "Папа", tap:o.tapWalk})}
  <span class="m-eb">Тело и движение</span>
  ${row("Время на животе", {on:o.tummy, c:MAMA, by:"Мама", tap:o.tapTummy, info:"▶", infoTap:o.tapInfo})}
  ${o.anim ? `<div class="m-anim"><b>Время на животе</b><span>1. Выложи на живот на твёрдую поверхность, ручки под плечами.</span><span>2. Игрушку или своё лицо — впереди, на уровне глаз.</span></div>` : ""}
  ${row("Массаж", {info:"▶"})}`);
const todayScr = (o = {}) => scr(`${days(o.sel, o.dayTap)}${o.noHero ? "" : hero()}${tiles(o)}${o.body ?? routine(o)}`, {cur:"today", tap:o.tap, toast:o.toast});
const expecting = (tap) => scr(`<div class="m-hero exp"><span><small>Ждём малыша · ПДР 20 октября</small><b>Уже вот-вот!</b><em>Когда малыш родится, укажи дату — начнутся карточки недель, рутина и поздравления.</em></span></div>
  ${btn(`Малыш родился!`, {tap})}${card(`<b>Подготовить до родов</b><small class="m-mut">Базовый набор: что нужно дома к выписке и в первые недели.</small><div class="m-bar"><i style="width:62%"></i></div>`)}`, {cur:"today", kid:"Малыш"});
const weekMini = tap => card(`<span class="m-eb">Неделя 10 · Руки и голос</span><b>Намеренный хват</b><small class="m-mut">Тянется к игрушке и пытается схватить её сама.</small><div class="m-head"><em>задания недели 2/5</em>${btn("Вся неделя →", {small:true, tap})}</div>`, "m-week");

// «Настройки»
const SET_LIST = [["👶", "pink", "Ребёнок", "Малыш · 8 августа", "kids"], ["🎨", "lav", "Семья и цвета", "Мама и Папа", "family"], ["🧩", "mint", "Что ведём", "Прививки, Кормление, Вес и рост, Вещи", "modules"],
  ["🌗", "butter", "Оформление и язык", "Тема, язык интерфейса", "look"], ["❓", "health-soft", "Вопросы и ответы", "Как пользоваться, команды бота", "faq"], ["💬", "peach1", "Обратная связь", "Отзыв, идея, неполадка", "feedback"],
  ["📦", "en-soft", "Данные", "Копия, PDF для педиатра, восстановление", "data"]];
const settings = tap => scr(`${H("Малыш · 2 родителя", "Настройки")}${card(SET_LIST.map(([ic, c, x, s, id]) =>
  `<div class="m-set"${t(tap === id)}><i style="--c:var(--${c})">${ic}</i><span><b>${x}</b><small>${s}</small></span><em>›</em></div>`).join(""), "m-list")}`, {cur:"set"});
const setSec = (title, body, o = {}) => scr(`${back("← Настройки", o.backTap)}${H("Настройки", title)}${body}`, {cur:"set", toast:o.toast, over:o.over});
const SW = ["raspberry", "coral", "amber", "grass", "teal", "blue", "violet", "graphite"];
const swatches = (sel, taken, tap) => `<div class="m-sw">${SW.map(id => `<i class="${id === sel ? "on" : ""} ${id === taken ? "taken" : ""}" style="--c:${colorHex(id)}"${t(id === tap)}></i>`).join("")}</div>`;
const kidForm = (o = {}) => card(`<div class="m-head"><b>Малыш</b><em>${o.born ? "родился 15 октября" : "ждём к 20 октября"}</em></div>${field("Имя", "Малыш")}
  ${o.born || o.date ? field("Дата рождения", o.born ? "15.10.2026" : "", {type:o.date ? "15.10.2026" : ""}) : `${field("Предполагаемая дата родов", "20.10.2026")}${btn("Родился! Указать дату", {tap:o.tapBorn})}`}
  ${field("Пол — для норм веса ВОЗ", "Девочка")}${btn("Сохранить", {ghost:true, tap:o.tapSave})}`);

// «Кормление»
const SIDES = ["Левая", "Правая", "Бутылочка"];
const feedTiles = (n = 6) => `<div class="m-tiles"><span class="m-tile ok"><b>${n}</b>раз сегодня</span><span class="m-tile"><b>1ч 32м</b>всего сегодня</span><span class="m-tile"><b>2ч 50м</b>между кормлениями</span></div>`;
const feedIdle = (o = {}) => scr(`${H("Малыш", "Кормление")}<div class="m-fbig"><div class="m-sides">${SIDES.map((x, i) =>
  `<span class="${(o.side ?? 0) === i ? "on" : ""}"${t(o.tapSide === i)}>${x}${i === 0 ? "<small>по очереди</small>" : ""}</span>`).join("")}</div>
  ${btn("Старт", {tap:o.tapStart})}${small("Последнее: правая, 2 ч 40 мин назад")}${link("Уже покормила — записать задним числом", o.tapPast)}</div>${o.form ?? feedTiles(o.n)}`, {cur:"feed", tap:o.tap, toast:o.toast});
const feedActive = (o = {}) => scr(`${H("Малыш", "Кормление")}<div class="m-fbig on"><small class="m-eb">Левая · с 14:05 · Мама</small><b class="m-timer" data-tick="${o.from ?? 0}">0:00</b>
  <div class="m-two">${btn("Сменить грудь", {ghost:true})}${btn("Закончить", {tap:o.tapStop})}</div>${small("Если свернёшь приложение, бот пришлёт сообщение с таймером и кнопкой «Закончить».")}</div>${feedTiles()}`, {cur:"feed"});
const feedHist = (o = {}) => card(`<b>История</b><div class="m-head"><b>Сегодня</b><em>${o.n ?? 6} раз · 1 ч 32 мин</em></div>
  ${(o.first ? [o.first] : []).concat([["Л", "14:05–14:21", "16 мин"], ["П", "11:10–11:24", "14 мин"], ["Б", "08:30–08:45", "15 мин"]]).map(([s, tm, d], i) =>
    `<div class="m-frec${i === 0 && o.first ? " new" : ""}"><i class="m-fs ${s}">${s}</i><span>${tm}</span><small>${d}</small><u${t(o.delTap && i === 0)}>×</u></div>`).join("")}`);

// «Здоровье»
const health = (body, o = {}) => scr(`${H(o.eb ?? "Малыш", "Здоровье")}${seg(["Вес", "Скачки", "Прививки"], o.seg ?? 0, o.segTap)}${body}`, {cur:"growth", tap:o.tap, toast:o.toast, over:o.over});
const chart = (extra = false) => `<svg class="m-chart" viewBox="0 0 120 64" aria-hidden="true"><path d="M4 50 C30 38 60 26 116 12 L116 26 C60 38 30 50 4 58Z" class="b2"/><path d="M4 53 C30 41 60 29 116 16 L116 22 C60 35 30 47 4 55Z" class="b1"/>
  <path d="M4 54 C30 43 60 31 116 19" class="ln"/><circle cx="8" cy="54" r="1.8"/><circle cx="20" cy="49" r="1.8"/><circle cx="34" cy="44" r="1.8"/>${extra ? `<circle cx="47" cy="40" r="2.6" class="new"/>` : ""}</svg>`;
const weight = (o = {}) => `${card(`<div class="m-head"><b>Вес: Малыш</b><em>нормы для девочек</em></div>${o.saved ? `<div class="m-verdict"><b>5,4 кг</b><small>50-й перцентиль · в норме</small></div>` : ""}${chart(o.saved)}`)}
  ${card(`<b>Новый замер</b><div class="m-three">${field("Дата", "17.10")}${field("Вес, кг", "", {type:o.type ? "5,4" : "", tap:o.tapKg})}${field("Рост, см", "", {ph:"необязательно"})}</div>${btn("Сохранить замер", {tap:o.tapSave})}`)}`;
const vac = (name, when, o = {}) => `<div class="m-vac ${o.st || ""}"><span><b>${name}</b><small>${when}</small></span><span class="m-vacts">${o.act ? `<em class="${o.done ? "done" : ""}"${t(o.tapAct)}>${o.act}</em>` : ""}${o.act2 ? `<em class="ok"${t(o.tapAct2)}>${o.act2}</em>` : ""}${o.skip ? `<u${t(o.tapSkip)}>Не планируем</u>` : ""}</span></div>`;
const vacStage = (o = {}) => card(`<div class="m-head"><b>2 месяца</b><em>${o.head ?? "через 3 дня"}</em></div>
  ${vac("АКДП, полиомиелит (ИПВ), Hib, гепатит B — 1-я доза", o.v1w ?? "20 октября · через 3 дня", {act:o.v1 ?? "Записались", act2:o.v1 ? "" : "✓ Сделали", tapAct:o.tapV1, tapAct2:o.tapV1b, done:o.v1 === "сделано", skip:o.v1 !== "сделано"})}
  ${o.noPcv ? "" : vac("Пневмококк — начало курса", "платно · по желанию", {act:"Записались", skip:true, tapSkip:o.tapSkip})}
  ${vac("Ротавирус — начало курса", "платно · по желанию", {act:"Записались", skip:true})}${o.skipped ? `<div class="m-skipped"${t(o.tapSkipped)}>Не планируем: 1 ›</div>${o.skipOpen ? vac("Пневмококк — начало курса", "не планируем", {act:"Вернуть"}) : ""}` : ""}`);

// скачки развития: первые 28 недель
const LK = {c:"calm", g:"good", l:"leap", a:"anx"};
const lgrid = (cur, tap) => `<div class="m-lgrid">${Array.from({length:28}, (_, i) => { const n = i + 1, x = leapOf(n);
  return `<i class="${LK[x.k]}${x.peak ? " peak" : ""}${n === cur ? " cur" : ""}"${t(tap === n)}>${n}</i>`; }).join("")}</div>`;

// «Вещи»
const gear = (x, due, o = {}) => `<div class="m-gear${o.on ? " on" : ""}${o.skip ? " skip" : ""}"><i class="m-cb"${t(o.tap)}></i><span><b>${x}</b><small>${due}</small></span><u class="${o.skip ? "on" : ""}"${t(o.tapSkip)}>не нужно</u></div>`;
const orders = (o = {}) => scr(`${H("Доставка ~3 недели", "Вещи")}${seg(["Пора заказать", "Весь список"], o.all ? 1 : 0, o.segTap)}
  ${card(`<div class="m-head"><b>Пора заказать</b><em>${o.n ?? 2}</em></div>${o.list ?? `${gear("Мягкая детская щётка для волос", "заказать до 24 октября", {on:o.on1, tap:o.tap1})}${o.hide2 ? "" : gear("Спальный мешок по сезону (TOG)", "нужно к неделе 14", {skip:o.skip2, tapSkip:o.tapSkip2})}`}`)}
  ${card(`<div class="m-head"><b>В ближайший месяц</b><em>3</em></div>${gear("Видеоняня или радионяня", "заказать через 2 недели")}`)}`, {cur:"orders", tap:o.tap, toast:o.toast});

// «Советы», поиск, статья
const TC = [["peach", "Сон: 10 опор режима"], ["mint", "Купание"], ["lav", "Колики"], ["butter", "Прикорм"]];
const tips = (o = {}) => scr(`${H("Всё из приложения — по темам", "Советы")}
  ${o.saved ? `<span class="m-eb">Сохранённые</span><div class="m-cards">${`<span class="m-tc warn new">Высокая температура</span>`}</div>` : ""}
  <span class="m-eb">Первая помощь</span><div class="m-cards">${["Подавилась", "Не дышит, без сознания", "Судороги"].map((x, i) => `<span class="m-tc warn"${t(o.tapFa && i === 0)}>${x}</span>`).join("")}</div>
  <span class="m-eb">Неделя за неделей</span><div class="m-cards">${[8, 9, 10].map(n => `<span class="m-tc wk" style="--h:${330 - n * 12}"><em>${n}</em>Неделя ${n}</span>`).join("")}</div>
  <span class="m-eb">Сон</span><div class="m-cards">${TC.map(([c, x]) => `<span class="m-tc ${c}">${x}</span>`).join("")}</div>`, {cur:"tips", tap:o.tap});
const searchScr = (o = {}) => scr(`<div class="m-search"${t(o.tapBox)}>${SV(P.search)}<span${o.type ? ` data-type="${o.type}" translate="no"` : ""}>${o.type ? "" : o.q || `<em>температура, прикорм, сон…</em>`}</span></div>
  <div class="m-chips">${["Всё", "Здоровье", "Недели", "Задания", "Рутина"].map((x, i) => `<span class="${i === 0 ? "on" : ""}">${x}</span>`).join("")}</div>${o.res ?? `<span class="m-eb">Частые запросы</span><div class="m-chips">${["удушье", "температура", "сыпь", "колики", "сон", "прикорм"].map(x => `<span>${x}</span>`).join("")}</div>`}`, {cur:o.cur ?? "today", tap:o.tap});
const result = (meta, title, snip, tap) => `<div class="m-res"${t(tap)}><small>${meta}</small><b>${title}</b><span>${snip}</span></div>`;
const article = (o = {}) => scr(`<div class="m-art ${o.tone ?? "warn"}"><div class="m-artbar"><i>←</i><i class="${o.saved ? "on" : ""}"${t(o.tapBm)}>${SV(P.bm)}</i></div><small>${o.eb ?? "Первая помощь"}</small><b>${o.title ?? "Подавилась"}</b></div>
  ${card(o.body ?? `<div class="m-calls"><span><b>103</b>Скорая</span><span><b>112</b>Единый номер</span></div>${small("Звони на громкой связи — диспетчер подскажет, что делать, пока едет скорая.")}<span class="m-li">1. Положи её лицом вниз на своё предплечье, голова ниже тела.</span><span class="m-li">2. Основанием ладони — 5 резких ударов между лопатками.</span>`)}`, {cur:"tips", toast:o.toast});

// Telegram: чат с ботом
const chat = (msgs, o = {}) => `<div class="m-tg${o.mute ? " muted" : ""}"><div class="m-tgh"><i>←</i><span${t(o.tapHead)}><b>Первый год</b><small>бот</small></span><em>${o.mute ? "🔕" : ""}</em></div>
  <div class="m-tgb">${msgs.map(m => `<div class="m-msg${m.me ? " me" : ""}">${m.x}${m.btns ? `<div class="m-kb">${m.btns.map(([x, tap]) => `<span${t(tap)}>${x}</span>`).join("")}</div>` : ""}</div>`).join("")}</div>
  <div class="m-tgi"><span${o.type ? ` data-type="${o.type}" translate="no"` : ""}>${o.type ? "" : "Сообщение"}</span><i${t(o.tapSend)}>${SV(P.send)}</i></div>${o.over || ""}</div>`;
const tgMenu = (tap, on) => `<div class="m-pop"><b>Первый год</b><span>Открыть приложение</span><span class="${on ? "on" : ""}"${t(tap)}>${on ? "🔕 Без звука" : "🔔 Выключить звук"}</span><span>Очистить историю</span></div>`;

const share = tap => `<div class="m-shade"><div class="m-sheet"><b>Выбери чат</b>${["Папа", "Избранное", "Семейный чат"].map((x, i) => `<span${t(tap && i === 0)}><i style="--c:${[PAPA, "#8a7b70", colorHex("teal")][i]}">${x[0]}</i>${x}</span>`).join("")}</div></div>`;
const confirm = (x, tap) => `<div class="m-shade"><div class="m-dialog"><span>${x}</span><div><em>Отмена</em><em class="ok"${t(tap)}>OK</em></div></div></div>`;
const wkList = tap => `<div class="m-shade light"><div class="m-dd"><small>Ранние недели</small>${[9, 10, 11, 12].map(n => `<span class="${n === 10 ? "on" : ""}"${t(tap && n === 12)}><i style="--h:${330 - n * 12}"></i><b>Неделя ${n}</b>${n === 10 ? "<em>сейчас</em>" : ""}</span>`).join("")}</div></div>`;

// «Зачем это»: рутина с новыми пунктами недели и итоговый экран-заставка
const whyRoutine = (o = {}) => card(`<div class="m-head"><b>Рутина на сегодня</b><em>${o.n ?? "3/9"}</em></div><span class="m-eb">Тело и движение</span>
  ${row("Время на животе · 3 раза по 10 минут", {on:o.tummy, c:PAPA, by:"Папа", tap:o.tapTummy, how:"<span class=\"m-new\">новое</span> на этой неделе"})}
  ${row("Массаж ручек и ножек", {on:true, c:MAMA, by:"Мама", info:"▶"})}
  <span class="m-eb">Игры и развитие</span>
  ${row("Погремушка: тянуться и хватать", {how:"<span class=\"m-new\">новое</span> на этой неделе", info:"▶"})}
  ${row("Разговаривать и ждать ответа", {on:true, c:MAMA, by:"Мама"})}`);
// iPhone: Safari, меню «Поделиться», «На экран „Домой“» и главный экран с иконкой
const APPIC = `<img src="icons/icon-192.png" alt="">`;
const safari = (o = {}) => `<div class="m-sf"><div class="m-sfpage">${H("Малыш", "Сегодня")}${hero()}${tiles()}</div>
  <div class="m-sfbar"><span class="m-sfurl">🔒 ссылка из бота</span><div class="m-sftool"><i>‹</i><i>›</i><i class="sh"${t(o.tapShare)}>${SV(`<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>`)}</i><i>${SV(P.bm)}</i><i>⧉</i></div></div>${o.over || ""}</div>`;
const iosShare = tap => `<div class="m-shade"><div class="m-sheet m-ios"><div class="m-iosapp">${APPIC}<span><b>Первый год</b><small>ссылка из бота</small></span></div>
  ${["Скопировать", "Добавить в закладки", "На экран «Домой»", "Добавить в Избранное"].map((x, i) => `<span${t(tap && i === 2)}>${x}<em>${["⧉", "📖", "⊞", "☆"][i]}</em></span>`).join("")}</div></div>`;
const iosAdd = tap => `<div class="m-iosadd"><div class="m-iosaddh"><span>Отменить</span><b>На экран «Домой»</b><span class="ok"${t(tap)}>Добавить</span></div>
  <div class="m-iosaddrow">${APPIC}<span><b>Первый год</b><small>Открывать как веб-приложение</small></span></div></div>`;
const HOME = [["#7fb2e8", "Фото"], ["#58b368", "Камера"], ["#2aa3e0", "Telegram"], ["#3d8bfd", "Safari"], ["#f2a541", "Заметки"], ["#ef6f6c", "Музыка"], ["#9a8cf0", "Погода"]];
// приложение с главного экрана просит войти: код и кнопка «Войти через Telegram»
const loginScr = tap => `<div class="m-login">${card(`<b class="m-lt">Вход через Telegram</b><small class="m-mut">Приложение работает вместе с Telegram-ботом: он присылает рутину, напоминания и связывает вас со вторым родителем.</small>
  ${btn("Войти через Telegram", {tap})}<div class="m-code"><small>Код для проверки</small><b>4821</b></div>`)}</div>`;
const homeScr = tap => `<div class="m-home"><div class="m-hgrid">${HOME.map(([c, n]) => `<span><i style="--c:${c}"></i>${n}</span>`).join("")}<span class="me"${t(tap)}>${APPIC}Первый год</span></div></div>`;
const final = (title, sub) => scr(`<div class="m-final"><b>${title}</b><span>${sub}</span></div>`, {nav:false});

// ---------- разделы и вопросы ----------
export const FAQ_SECS = [
  {id:"start", name:"Начало"},
  {id:"family", name:"Семья"},
  {id:"day", name:"Каждый день"},
  {id:"feed", name:"Кормление"},
  {id:"health", name:"Здоровье"},
  {id:"things", name:"Вещи"},
  {id:"tips", name:"Советы и поиск"},
  {id:"set", name:"Настройки и данные"},
  {id:"bot", name:"Бот и уведомления"},
];

// a — абзацы ответа (строка или {ul:[…]}); go — «Показать в приложении»: вкладка, раздел настроек, что подсветить; mod — нужен модуль
export const FAQ = [
  {id:"why", sec:"start", q:"Зачем это приложение?",
    a:["Чтобы не держать всё в голове. Каждую неделю у малыша появляется новое: массаж, игры, время на животе, первые улыбки и звуки, потом ползание. Приложение вовремя добавляет это в рутину на день и подсказывает, как и сколько.",
      "Вы отмечаете вдвоём — по кольцам дней видно, что сделано. По неделям — что ждать в этом возрасте, а «Красные флаги» подскажут, когда стоит показать малыша педиатру.",
      "Кормление, вес по нормам ВОЗ, прививки, вещи и советы — тоже здесь, в одном месте.",
      "Малыши развиваются в своём темпе, и приложение не заменяет врача: оно помогает ничего не упустить и вовремя спросить."],
    demo:[{s:chat([{x:"🗓 <b>Неделя 10 · Руки и голос</b><br>Новое: тянется к игрушке и пробует схватить.<br>В рутине — больше времени на животе и игры с погремушкой.", btns:[["Открыть неделю", true]]}]), cap:"Каждую неделю бот пишет, что нового у малыша"},
      {s:todayScr({noHero:true, body:whyRoutine({tapTummy:true})}), cap:"Новое — массаж, игры, время на животе — появляется в рутине вовремя"},
      {s:todayScr({noHero:true, body:whyRoutine({tummy:true, n:"4/9"}), toast:"Отмечено — партнёр тоже видит"}), cap:"Отмечаете вдвоём: видно, что сделано"},
      {s:todayScr({r:"9/9", body:card(`<div class="m-head"><b>Эта неделя</b><em>ничего не упущено</em></div>${small("Полное кольцо — вся рутина дня сделана, неполное — часть.")}`)}), cap:"По кольцам дней видно, ничего ли не упустили"},
      {s:scr(`${H("Малышу 2 месяца", "Красные флаги")}${card(`<b>К 3 месяцам обычно</b><span class="m-li">• Держит голову, лёжа на животе</span><span class="m-li">• Улыбается в ответ</span><span class="m-li">• Следит глазами за игрушкой</span>${small("Если чего-то нет — покажи педиатру, не жди.")}`)}`, {cur:"today"}), cap:"Нормы по возрасту — и когда идти к педиатру"},
      {s:tips(), cap:"Кормление, вес, прививки, советы — тоже под рукой"},
      {s:final("Первый год — спокойно", "Всё про развитие малыша — в одном месте. Не нужно держать в голове."), cap:"Можно не бояться что-то забыть"}],
    go:{tab:"today"}},

  {id:"what", sec:"start", q:"Что умеет приложение?",
    a:["Ведёт первый год малыша — вдвоём с партнёром. Пять вкладок внизу:",
      {ul:["«Сегодня» — главное на день: рутина, задания недели, что пора заказать", "«Кормление» — таймер, история и график", "«Здоровье» — вес по нормам ВОЗ, скачки роста и прививки",
        "«Вещи» — что купить и когда заказать с учётом доставки", "«Советы» — статьи по темам и первая помощь"]},
      "Вверху — поиск по всему приложению и ⚙️ настройки."],
    demo:[{s:todayScr({tap:"feed"}), cap:"«Сегодня» — рутина, задания недели и заказы"},
      {s:feedIdle({tap:"growth"}), cap:"«Кормление» — таймер и история"},
      {s:health(weight(), {tap:"orders"}), cap:"«Здоровье» — вес, скачки роста, прививки"},
      {s:orders({tap:"tips"}), cap:"«Вещи» — что заказать заранее"},
      {s:tips({tap:"gear"}), cap:"«Советы» — статьи и первая помощь"},
      {s:settings(), cap:"⚙️ вверху — настройки"}],
    go:{tab:"today"}},

  {id:"pwa", sec:"start", q:"Можно открывать без Telegram — иконкой на телефоне?",
    a:["Да. Приложение ставится на главный экран как обычное: иконка «Первый год», открывается сразу на вашей семье, без Telegram. Уведомления по-прежнему приходят в бот.",
      {ul:["Возьми личную ссылку: в боте команда /web или ⚙️ Настройки → «На главный экран».",
        "iPhone: открой ссылку в Safari → «Поделиться» (в новых iOS — в меню «•••») → «На экран „Домой“» → «Добавить».",
        "Android: открой в Chrome → ⋮ → «Добавить на главный экран» или «Установить приложение»."]},
      "Если приложение на главном экране просит войти — нажми «Войти через Telegram», в боте подтверди кнопкой с тем же кодом и вернись: вход подхватится сам.",
      "Ссылка личная — как ключ от вашей семьи, не пересылай её. Второй родитель берёт свою в своём Telegram."],
    demo:[{s:chat([], {type:"/web", tapSend:true}), cap:"Напиши боту /web"},
      {s:chat([{x:"/web", me:true}, {x:"📲 <b>Приложение на главном экране</b><br>Кнопка ниже откроет приложение в браузере — уже со входом в вашу семью.", btns:[["🌐 Открыть в браузере", true]]}]), cap:"«Открыть в браузере» — откроется Safari"},
      {s:safari({tapShare:true}), cap:"Нажми «Поделиться»"},
      {s:safari({over:iosShare(true)}), cap:"Выбери «На экран „Домой“»"},
      {s:`<div class="m-sf">${iosAdd(true)}</div>`, cap:"Нажми «Добавить»"},
      {s:homeScr(true), cap:"На рабочем столе появилась иконка — открой её"},
      {s:loginScr(true), cap:"Попросит войти — нажми «Войти через Telegram»"},
      {s:chat([{x:"🔐 <b>Вход в приложение на телефоне</b><br>Код на экране приложения: <b>4821</b>", btns:[["✅ Войти (код 4821)", true]]}]), cap:"В боте сверь код и нажми «Войти»"},
      {s:todayScr(), cap:"Вернись в приложение — оно уже открыто, вход сохранится"}],
    go:{tab:"family", sec:"install"}},
  {id:"born", sec:"start", q:"Малыш родился — что нажать?",
    a:["Поздравляем! Укажи дату рождения: на «Сегодня» нажми «Малыш родился!» или открой ⚙️ Настройки → «Ребёнок» → «Родился! Указать дату».",
      "С этой даты начнутся недели, рутина на каждый день и календарь прививок."],
    demo:[{s:expecting(true), cap:"На «Сегодня» — «Малыш родился!»"},
      {s:setSec("Ребёнок", kidForm({tapBorn:true})), cap:"«Родился! Указать дату»"},
      {s:setSec("Ребёнок", kidForm({date:true, tapSave:true})), cap:"Дата рождения и «Сохранить»"},
      {s:todayScr({toast:"Поздравляем! 🎉"}), cap:"Готово: начались недели и рутина"}],
    go:{tab:"family", sec:"kids", hl:"[data-born], [id^='k-birth-']"}},

  {id:"twins", sec:"start", q:"Двойня или второй ребёнок — как добавить?",
    a:["⚙️ Настройки → «Ребёнок» → «+ Добавить ребёнка». Можно вести до четырёх детей.",
      "Дети с одной датой рождения ведутся вместе: одна рутина, а отметки у каждого свои. Если даты разные, вверху экранов появится переключатель."],
    demo:[{s:settings("kids"), cap:"⚙️ Настройки → «Ребёнок»"},
      {s:setSec("Ребёнок", `${kidForm({born:true})}${btn("+ Добавить ребёнка (двойня, брат или сестра)", {ghost:true, tap:true})}`), cap:"«+ Добавить ребёнка»"},
      {s:setSec("Ребёнок", card(`<b>Новый ребёнок</b>${field("Имя", "", {type:"Соня"})}${field("Дата рождения — если уже родился", "15.10.2026")}<div class="m-two">${btn("Добавить", {tap:true})}${link("Отмена")}</div>`)), cap:"Имя, дата — «Добавить»"},
      {s:setSec("Ребёнок", `${kidForm({born:true})}`, {toast:"Добавлено"}), cap:"Готово"}],
    go:{tab:"family", sec:"kids", hl:"#kid-add"}},

  {id:"invite", sec:"family", q:"Как позвать второго родителя?",
    a:["⚙️ Настройки → «Семья и цвета» → «Отправить приглашение». Telegram предложит выбрать чат — отправь ссылку маме или папе.",
      "По ссылке второй родитель попадёт в вашу семью: те же уведомления, общие отметки. Ссылка действует 14 дней, пригласить можно одного человека. Приглашает тот, кто создал семью."],
    demo:[{s:todayScr({tap:"gear"}), cap:"Нажми ⚙️ вверху"},
      {s:settings("family"), cap:"«Семья и цвета»"},
      {s:setSec("Семья и цвета", `${card(`<b>Ты</b>${field("Имя", "Мама")}${swatches("raspberry")}`)}${card(`<b>Позвать папу</b>${small("Ссылка в Telegram: по ней второй родитель попадёт в семью.")}${btn("Отправить приглашение", {tap:true})}`, "m-inv")}`), cap:"«Отправить приглашение»"},
      {s:setSec("Семья и цвета", card(`<b>Позвать папу</b>${btn("Отправить приглашение")}`, "m-inv"), {over:share(true)}), cap:"Выбери чат и отправь ссылку"},
      {s:chat([{x:"Присоединяйся: будем вместе вести первый год малыша", me:true}, {x:"👋 Папа теперь с вами: будет видеть отметки и получать те же уведомления."}]), cap:"Папа нажал ссылку — вы вместе"}],
    go:{tab:"family", sec:"family", hl:"#invite"}},

  {id:"colors", sec:"family", q:"Как понять, кто что отметил? Можно поменять цвета?",
    a:["Каждая отметка окрашена цветом того, кто её поставил, и подписана его именем.",
      "Свой цвет и цвет второго родителя меняются в ⚙️ Настройки → «Семья и цвета». Цвета у родителей не повторяются."],
    demo:[{s:todayScr({noHero:true, walk:true, tummy:true}), cap:"Отметки мамы и папы — разными цветами"},
      {s:settings("family"), cap:"⚙️ Настройки → «Семья и цвета»"},
      {s:setSec("Семья и цвета", `${card(`<b>Папа</b><span class="m-lbl">Цвет отметок · Папа</span>${swatches("blue", "raspberry", "grass")}`)}`), cap:"Нажми на цвет"},
      {s:setSec("Семья и цвета", `${card(`<b>Папа</b><span class="m-lbl">Цвет отметок · Папа</span>${swatches("grass", "raspberry")}`)}`, {toast:"Цвет изменён"}), cap:"Готово: у папы новый цвет"}],
    go:{tab:"family", sec:"family", hl:".swatches, [data-ocolor]"}},

  {id:"sync", sec:"family", q:"Второй родитель сразу видит мои отметки?",
    a:["Да. Отметки, кормления, замеры и прививки обновляются у обоих сразу — без перезагрузки. Когда второй родитель что-то отметит, внизу появится короткое сообщение.",
      "Утренние уведомления бота тоже приходят обоим."],
    demo:[{s:todayScr({noHero:true}), cap:"У тебя открыта «Сегодня»"},
      {s:todayScr({noHero:true, walk:true, toast:"Папа: ✓ Прогулка"}), cap:"Папа отметил прогулку — видно сразу"}],
    go:{tab:"today", hl:"#routine"}},

  {id:"routine", sec:"day", q:"Как отмечать рутину на день?",
    a:["На «Сегодня» внизу — «Рутина на сегодня». Нажми на квадратик — пункт отмечен. «▶» — анимация «как делать», «?» — зачем это нужно.",
      "Список меняется с возрастом, а в полночь отметки начинаются заново. Плитка «рутина сегодня» вверху сразу прокручивает к списку."],
    demo:[{s:todayScr({tap:"routine"}), cap:"Плитка «рутина сегодня»"},
      {s:todayScr({noHero:true, tapTummy:true}), cap:"Нажми на квадратик"},
      {s:todayScr({noHero:true, tummy:true, r:"5/14", n:"5/14", tapInfo:true}), cap:"«▶» — как делать"},
      {s:todayScr({noHero:true, tummy:true, r:"5/14", n:"5/14", anim:true}), cap:"Анимация и шаги — прямо в списке"}],
    go:{tab:"today", hl:"#routine"}},

  {id:"ownroutine", sec:"day", q:"Можно добавить свой пункт или убрать лишний?",
    a:["Да. В «Рутине на сегодня» нажми ✎ — или ⚙️ Настройки → «Своя рутина».",
      "Свой пункт: напиши, что делать, и выбери срок — 2 недели, 3 недели, месяц или бессрочно. Он появится в рутине у обоих родителей и в утреннем сообщении бота.",
      "Пункты приложения: нажми на пункт — увидишь, до какой даты он в рутине по плану. Можно продлить, сократить или не показывать вовсе. Скрытое лежит в «Не показываем» — вернуть можно в любой момент."],
    demo:[{s:todayScr({noHero:true, body:card(`<div class="m-head"><b>Рутина на сегодня</b><em>4/14 <span class="m-pen"${t(true)}>✎</span></em></div>${row("Витамин D 400 МЕ", {on:true, c:MAMA, by:"Мама"})}${row("Прогулка")}`)}), cap:"✎ у рутины"},
      {s:setSec("Своя рутина", card(`<b>Свои пункты</b>${field("Что делать", "", {type:"Сказка на ночь"})}<div class="m-chips"><span>2 недели</span><span class="on">3 недели</span><span>Месяц</span><span>Бессрочно</span></div>${btn("Добавить в рутину", {tap:true})}`)), cap:"Свой пункт и срок"},
      {s:setSec("Своя рутина", card(`<b>Пункты приложения</b><div class="m-rs"><b>Английский слот папы</b><small>Язык · весь первый год</small><div class="m-chips"><span class="on">По плану</span><span>2 недели</span><span>Месяц</span><span${t(true)}>Не показывать</span></div></div>`), {toast:"Добавлено до 6 ноября"}), cap:"До какой даты — и скрыть лишнее"},
      {s:todayScr({noHero:true, body:card(`<div class="m-head"><b>Рутина на сегодня</b><em>4/13</em></div>${row("Витамин D 400 МЕ", {on:true, c:MAMA, by:"Мама"})}<span class="m-eb">Своё</span>${row("Сказка на ночь", {how:"папа, 10 минут"})}`), toast:"Больше не показываем"}), cap:"Свой пункт — в рутине, лишнего нет"}],
    go:{tab:"family", sec:"routine"}},

  {id:"pastday", sec:"day", q:"Забыли отметить вчера. Можно задним числом?",
    a:["Да. На «Сегодня» вверху — полоса дней недели: нажми на вчерашний день и отметь, что успели. Будущие дни можно только посмотреть.",
      "Кольцо вокруг числа заполняется по мере выполнения рутины. Месяц над полосой открывает календарь за весь год."],
    demo:[{s:todayScr({dayTap:5}), cap:"Нажми на вчерашний день"},
      {s:todayScr({sel:5, title:"Рутина за день", day:"Вчера, 16 октября", n:"3/14", tapWalk:true}), cap:"Отметь, что успели"},
      {s:todayScr({sel:5, fill:{5:"part"}, title:"Рутина за день", day:"Вчера, 16 октября", n:"4/14", walk:true, walkC:MAMA, walkBy:"Мама"}), cap:"Кольцо дня заполнилось"}],
    go:{tab:"today", hl:".dstrip-wrap"}},

  {id:"week", sec:"day", q:"Где задания недели и как посмотреть другие недели?",
    a:["На «Сегодня» — карточка недели, нажми «Вся неделя →». Там задания, что важно помнить и что будет у врача.",
      "Другую неделю выбери стрелками ‹ › или из списка. Все 52 недели есть и в «Советах» → «Неделя за неделей»."],
    demo:[{s:scr(`${tiles()}${weekMini(true)}`, {cur:"today"}), cap:"«Вся неделя →»"},
      {s:scr(`${back("← Назад")}<div class="m-wknav"><i>‹</i><span${t(true)}>Неделя 10 ⌄</span><i>›</i></div><div class="m-hero wk"><span><small>Неделя 10 · 2 месяца</small><b>Намеренный хват</b></span></div>${card(`<b>Задания недели</b>${row("Игровой коврик с дугой", {on:true, c:MAMA, by:"Мама"})}${row("Мешочек текстур: шёлк, вельвет, махра, мягкая щётка")}`)}`, {cur:"today"}), cap:"Список недель"},
      {s:scr(`${back("← Назад")}<div class="m-wknav"><i>‹</i><span>Неделя 10 ⌄</span><i>›</i></div>`, {cur:"today", over:wkList(true)}), cap:"Выбери неделю"},
      {s:scr(`${back("← Назад")}<div class="m-wknav"><i>‹</i><span>Неделя 12 ⌄</span><i>›</i></div><div class="m-hero wk" style="--h:186"><span><small>Неделя 12 · 3 месяца</small><b>Три месяца</b></span></div>`, {cur:"today"}), cap:"Открыта неделя 12"}],
    go:{tab:"week", hl:".weeknav"}},

  {id:"feed", sec:"feed", mod:"feeding", q:"Как записать кормление?",
    a:["Вкладка «Кормление»: выбери «Левая», «Правая» или «Бутылочка» и нажми «Старт». Приложение подсказывает, какой грудью кормить по очереди.",
      "Во время кормления можно «Сменить грудь», в конце — «Закончить». Если свернёшь приложение, бот пришлёт сообщение с таймером и кнопкой «Закончить»."],
    demo:[{s:todayScr({tap:"feed"}), cap:"Вкладка «Кормление»"},
      {s:feedIdle({tapSide:0}), cap:"Выбери грудь или бутылочку"},
      {s:feedIdle({tapStart:true}), cap:"«Старт»"},
      {s:feedActive({tapStop:true}), cap:"Идёт таймер — «Закончить»"},
      {s:feedIdle({side:1, n:7, toast:"Кормление записано"}), cap:"Записано. Следующей — правая"}],
    go:{tab:"feed", hl:".fbig"}},

  {id:"feedpast", sec:"feed", mod:"feeding", q:"Забыли нажать «Старт». Как записать прошедшее кормление?",
    a:["На вкладке «Кормление» нажми «Уже покормила — записать задним числом», укажи дату, начало и сколько минут — «Записать».",
      "Ошибочную запись удалишь крестиком «×» в «Истории»."],
    demo:[{s:feedIdle({tapPast:true}), cap:"«Уже покормила — записать задним числом»"},
      {s:feedIdle({form:card(`<b>Записать кормление</b>${seg(SIDES, 0)}<div class="m-three">${field("Дата", "17.10")}${field("Начало", "", {type:"06:40"})}${field("Минут", "15")}</div><div class="m-two">${btn("Записать", {tap:true})}${link("Отмена")}</div>`)}), cap:"Время и минуты — «Записать»"},
      {s:scr(`${H("Малыш", "Кормление")}${feedHist({n:7, first:["Л", "06:40–06:55", "15 мин"]})}`, {cur:"feed", toast:"Записано"}), cap:"Появилось в истории"},
      {s:scr(`${H("Малыш", "Кормление")}${feedHist({n:7, first:["Л", "06:40–06:55", "15 мин"], delTap:true})}`, {cur:"feed"}), cap:"Ошибка? «×» удаляет запись"}],
    go:{tab:"feed", hl:"[data-fpast]"}},

  {id:"weight", sec:"health", mod:"growth", q:"Как добавить вес и рост?",
    a:["«Здоровье» → «Вес» → «Новый замер»: дата, вес и, если хочешь, рост — «Сохранить замер».",
      "Замер появится точкой на графике с нормами ВОЗ, сверху — перцентиль и вывод. Проведи пальцем по графику — увидишь точные значения на любой возраст."],
    demo:[{s:todayScr({tap:"growth"}), cap:"Вкладка «Здоровье»"},
      {s:health(weight({tapKg:true})), cap:"«Вес, кг»"},
      {s:health(weight({type:true, tapSave:true})), cap:"Вес — и «Сохранить замер»"},
      {s:health(weight({saved:true}), {toast:"Сохранено"}), cap:"Точка на графике ВОЗ"}],
    go:{tab:"growth", gseg:"weight", hl:"#m-kg"}},

  {id:"vacc", sec:"health", mod:"vaccines", q:"Как отмечать прививки? Напомнит ли бот?",
    a:["«Здоровье» → «Прививки»: календарь МОЗ Украины по возрасту ребёнка, ближайшая — сверху.",
      "Записались к врачу — нажми «Записались» и укажи дату и время: за час до записи бот напомнит и пришлёт кнопку «Сделали». Ещё он напоминает за 3 дня и в сам день.",
      "Записались по телефону и не отметили — не страшно: «✓ Сделали» есть сразу, без записи. Нажми на прививку, чтобы поправить дату или добавить заметку."],
    demo:[{s:health(card(`<b>Следующая</b>${small("АКДП, полиомиелит (ИПВ), Hib, гепатит B — 20 октября")}`), {segTap:2}), cap:"«Здоровье» → «Прививки»"},
      {s:health(vacStage({tapV1:true}), {seg:2, eb:"Календарь МОЗ Украины"}), cap:"«Записались»"},
      {s:health(vacStage(), {seg:2, eb:"Календарь МОЗ Украины", over:`<div class="m-shade"><div class="m-sheet"><b>Прививка</b>${field("Записались на", "20.10.2026")}${field("Время", "", {type:"14:30"})}${small("Со временем бот напомнит за час до записи и пришлёт кнопку «Сделали».")}${btn("Сохранить", {tap:true})}</div></div>`}), cap:"Дата и время записи"},
      {s:chat([{x:`💉 <b>Скоро прививка</b><br>Малыш: АКДП, полиомиелит (ИПВ), Hib, гепатит B — 1-я доза<br>🕐 Запись на 14:30<br><br>После прививки нажми «Сделали» — отмечу в календаре.`, btns:[["✅ Сделали", true], ["💉 Все прививки"]]}]), cap:"За час — напоминание в боте"},
      {s:health(vacStage({v1:"сделано", v1w:"сделано 20 октября", head:"готово"}), {seg:2, eb:"Календарь МОЗ Украины", toast:"Отмечено: сделали ✅"}), cap:"Отмечено — у обоих родителей"},
      {s:health(vacStage({tapV1b:true}), {seg:2, eb:"Календарь МОЗ Украины"}), cap:"Не записывали в приложении? «✓ Сделали» — сразу"}],
    go:{tab:"vaccines", hl:".vx"}},

  {id:"vskip", sec:"health", mod:"vaccines", q:"Не будем делать какую-то прививку. Как убрать её из списка?",
    a:["Под прививкой нажми «Не планируем». Она уйдёт вниз, в «Не планируем», и напоминаний о ней не будет.",
      "Передумали — откройте «Не планируем» и нажмите «Вернуть». Для прививок из бесплатного календаря приложение сначала переспросит."],
    demo:[{s:health(vacStage({tapSkip:true}), {seg:2, eb:"Календарь МОЗ Украины"}), cap:"«Не планируем»"},
      {s:health(vacStage({noPcv:true, skipped:true}), {seg:2, eb:"Календарь МОЗ Украины", toast:"Убрали из плана. Вернуть — внизу списка"}), cap:"Ушла вниз, напоминаний не будет"},
      {s:health(vacStage({noPcv:true, skipped:true, tapSkipped:true}), {seg:2, eb:"Календарь МОЗ Украины"}), cap:"Передумали — «Не планируем»"},
      {s:health(vacStage({noPcv:true, skipped:true, skipOpen:true}), {seg:2, eb:"Календарь МОЗ Украины"}), cap:"…и «Вернуть»"}],
    go:{tab:"vaccines", hl:".v-skip"}},

  {id:"vpast", sec:"health", mod:"vaccines", q:"Начали пользоваться позже. Как отметить уже сделанные прививки?",
    a:["Если прошедших прививок несколько, в «Прививках» появится кнопка «Всё прошедшее уже сделано» — она отметит их разом. Даты потом можно уточнить в каждой записи.",
      "Одну прививку отметь кнопкой «Сделали» у неё."],
    demo:[{s:health(card(`<div class="m-head"><b>Роддом</b><em>просрочено</em></div>${vac("БЦЖ (туберкулёз)", "2 месяца назад", {st:"over", act:"Сделали"})}${vac("АКДП, полиомиелит (ИПВ), Hib, гепатит B — 1-я доза", "3 дня назад", {st:"over", act:"Сделали"})}${btn("Всё прошедшее уже сделано", {ghost:true, small:true, tap:true})}`), {seg:2, eb:"Календарь МОЗ Украины"}), cap:"«Всё прошедшее уже сделано»"},
      {s:health(card(`<div class="m-head"><b>Роддом</b></div>${vac("БЦЖ (туберкулёз)", "сделано")}`), {seg:2, over:confirm("Отметить все прошедшие прививки по календарю как сделанные? Даты можно будет уточнить в каждой записи.", true)}), cap:"Подтверди"},
      {s:health(card(`<div class="m-head"><b>Роддом</b><em>готово</em></div>${vac("БЦЖ (туберкулёз)", "сделано", {act:"сделано", done:true})}${vac("АКДП, полиомиелит (ИПВ), Hib, гепатит B — 1-я доза", "сделано", {act:"сделано", done:true})}`), {seg:2, eb:"Календарь МОЗ Украины", toast:"Отмечено"}), cap:"Готово"}],
    go:{tab:"vaccines", hl:"[data-vpast]"}},

  {id:"spurts", sec:"health", mod:"growth", q:"Что такое скачки развития и где их смотреть?",
    a:["Недели, когда малыш учится новому и из-за этого чаще плачет, просится на руки и хуже спит. «Здоровье» → «Скачки»: сетка по неделям — где спокойно, где скачок и его пик. Нажми на неделю — откроется её карточка.",
      "Скачок видно и на карточке недели, и на «Сегодня», и в календаре — полоской под днями. Ниже в «Скачках» — скачки роста: когда малыш чаще просит есть.",
      "Сетка — по книге «Чудесные недели»: недели в ней считают от предполагаемой даты родов, а исследования эти сроки не подтвердили. Это ориентир, а не норма."],
    demo:[{s:health(weight(), {segTap:1}), cap:"«Здоровье» → «Скачки»"},
      {s:health(`${card(`<span class="m-eb">Неделя 10 · сейчас</span><b>Хорошее настроение</b>${small("Следующий пик — неделя 12, через 12 дней")}`, "m-good")}${card(lgrid(10, 12))}`, {seg:1}), cap:"Сетка по неделям — нажми на неделю"},
      {s:scr(`${back("← Назад")}<div class="m-hero wk" style="--h:186"><span><small>Неделя 12 · 3 месяца</small><b>Три месяца</b></span></div><div class="m-leapbox"><b>🌀 Пик скачка развития</b><span>Может чаще плакать, проситься на руки и к груди, хуже спать. Это временно: больше близости и спокойный режим помогают.</span></div>`, {cur:"today"}), cap:"На карточке недели — что ждать"}],
    go:{tab:"growth", gseg:"spurts", hl:".leaps"}},

  {id:"orders", sec:"things", mod:"orders", q:"Как работает «Пора заказать»?",
    a:["Вещь появляется в «Пора заказать» примерно за 3 недели до того, как понадобится: с учётом доставки. Самое срочное видно и на «Сегодня», а бот пришлёт отдельное сообщение «🛒 Пора заказать».",
      "Заказали или уже есть — поставь отметку. Не нужно — «не нужно». Отмеченное уходит из списка. Полный список на год — «Весь список»."],
    demo:[{s:todayScr({tap:"orders", noHero:true}), cap:"Вкладка «Вещи»"},
      {s:orders({tap1:true}), cap:"Заказали — отметка"},
      {s:orders({on1:true, tapSkip2:true}), cap:"Не нужно — «не нужно»"},
      {s:orders({n:0, list:`<small class="m-mut">Сейчас заказывать нечего.</small>`, toast:"Всё отмечено"}), cap:"Список пуст — всё учтено"}],
    go:{tab:"orders", hl:".row.grow"}},

  {id:"sos", sec:"tips", q:"Экстренная ситуация — где первая помощь?",
    a:["Нажми лупу вверху и напиши, что случилось: «подавилась», «температура», «ожог». Или «Советы» → «Первая помощь». В статье — кнопки звонка 103 и 112 и шаги по порядку.",
      "В боте команда /sos сразу присылает номера и короткие инструкции — работает даже без регистрации."],
    demo:[{s:todayScr({tap:"search", noHero:true}), cap:"Лупа вверху"},
      {s:searchScr({type:"подавилась"}), cap:"Напиши, что случилось"},
      {s:searchScr({q:"подавилась", res:result("Здоровье · первая помощь", "Первая помощь: Подавилась", "Не может кашлять, плакать или дышать, синеет", true)}), cap:"Открой статью"},
      {s:article(), cap:"Звонок в одно касание и шаги"}],
    go:{tab:"tips", hl:"#ts-fa"}},

  {id:"search", sec:"tips", q:"Как быстро найти ответ?",
    a:["Лупа вверху ищет по всему приложению: недели, задания, рутина, вещи, советы, первая помощь и анимации «как делать». Под строкой поиска — категории, чтобы сузить выдачу.",
      "Подходят и простые слова: «газики», «не спит», «зубы»."],
    demo:[{s:tips({tap:"search"}), cap:"Лупа вверху"},
      {s:searchScr({type:"колики", cur:"tips"}), cap:"Напиши слово"},
      {s:searchScr({q:"колики", cur:"tips", res:`${result("Советы · Плач и колики", "Колики: правило трёх", "Недели 2–16: обычно начинаются в 2–3 недели, проходят к 3–4 месяцам", true)}${result("Как делать · анимация", "Как делать: Велосипед", "Поочерёдно мягко сгибай ножки к животу…")}`}), cap:"Выбери результат"},
      {s:article({tone:"peach", eb:"Плач и колики", title:"Колики: правило трёх", body:`<span class="m-li">Недели 2–16: обычно начинаются в 2–3 недели, проходят к 3–4 месяцам</span>`}), cap:"Статья целиком"}],
    go:{tab:"search"}},

  {id:"save", sec:"tips", q:"Как сохранить совет, чтобы не искать снова?",
    a:["В статье нажми закладку вверху справа. Сохранённое появится первым рядом в «Советах» — «Сохранённые». Убрать — ещё раз нажать закладку."],
    demo:[{s:article({tone:"warn", title:"Высокая температура", tapBm:true}), cap:"Закладка вверху справа"},
      {s:article({tone:"warn", title:"Высокая температура", saved:true, toast:"Сохранено в «Советах»"}), cap:"Сохранено"},
      {s:tips({saved:true}), cap:"Теперь — в «Сохранённых»"}],
    go:{tab:"tips"}},

  {id:"flags", sec:"tips", q:"Что такое «красные флаги»?",
    a:["Признаки, с которыми стоит показать малыша педиатру, не дожидаясь планового осмотра, — для его текущего возраста. Отдельно — «Срочно, не ждать»: когда звонить 103.",
      "Где найти: «Советы» → «Сейчас» → «Красные флаги» или поиск по слову «флаги». Приложение — справка, а не диагноз: если что-то тревожит, звони врачу."],
    demo:[{s:tips({tap:"search"}), cap:"Поиск или «Советы» → «Сейчас»"},
      {s:searchScr({q:"флаги", cur:"tips", res:result("Здоровье · флаги", "Красные флаги: Рубеж 2 месяцев", "Не реагирует на громкие звуки. Не следит глазами за лицом…", true)}), cap:"«Красные флаги»"},
      {s:article({tone:"health", eb:"Красные флаги", title:"Красные флаги: Рубеж 2 месяцев", body:`${small("Покажи ребёнка педиатру, не дожидаясь планового осмотра, если сейчас:")}<span class="m-li">• Не реагирует на громкие звуки</span><span class="m-li">• Не следит глазами за лицом или движущимся предметом</span><span class="m-urgent">Срочно, не ждать: 103</span>`}), cap:"Что смотреть и когда срочно"}],
    go:{tab:"flags"}},

  {id:"modules", sec:"set", q:"Не нужны прививки или кормление. Можно убрать?",
    a:["⚙️ Настройки → «Что ведём»: выключи ненужное. Вкладка и уведомления об этом пропадут, а данные не удаляются — включишь обратно, и всё на месте.",
      "Рутина, недели, советы и первая помощь есть всегда."],
    demo:[{s:settings("modules"), cap:"⚙️ Настройки → «Что ведём»"},
      {s:setSec("Что ведём", card(`${small("Выключенное пропадает из вкладок и уведомлений. Данные не удаляются.")}${tgl("Прививки", "Календарь МОЗ, напоминания за 3 дня", true)}${tgl("Кормление", "Таймер, история, график по дням", true, true)}${tgl("Вес и рост", "Нормы ВОЗ, скачки роста", true)}${tgl("Вещи", "Полный список и что заказать за 3 недели до нужды", true)}`)), cap:"Выключи ненужное"},
      {s:scr(`${back()}${H("Настройки", "Что ведём")}${card(`${tgl("Прививки", "Календарь МОЗ, напоминания за 3 дня", true)}${tgl("Кормление", "Таймер, история, график по дням", false)}${tgl("Вес и рост", "Нормы ВОЗ, скачки роста", true)}`)}`, {cur:"set", hide:["feed"]}), cap:"Вкладка «Кормление» пропала"}],
    go:{tab:"family", sec:"modules", hl:".tgls"}},

  {id:"look", sec:"set", q:"Как включить тёмную тему или сменить язык?",
    a:["⚙️ Настройки → «Оформление и язык». Тема: «Светлая», «Тёмная» или «Как в Telegram». Язык: украинский или русский — переключается сразу, без перезапуска."],
    demo:[{s:settings("look"), cap:"⚙️ Настройки → «Оформление и язык»"},
      {s:setSec("Оформление и язык", card(`<span class="m-lbl">Язык</span>${seg(["Українська", "Русский"], 1)}<span class="m-lbl">Оформление</span>${seg(["Светлая", "Тёмная", "Как в Telegram"], 0, 1)}`)), cap:"«Тёмная»"},
      {s:`<div class="m-dark">${setSec("Оформление и язык", card(`<span class="m-lbl">Язык</span>${seg(["Українська", "Русский"], 1)}<span class="m-lbl">Оформление</span>${seg(["Светлая", "Тёмная", "Как в Telegram"], 1)}`))}</div>`, cap:"Готово — тёмная тема"}],
    go:{tab:"family", sec:"look"}},

  {id:"data", sec:"set", q:"Не пропадут ли данные? Как сделать копию или PDF для врача?",
    a:["Отметки хранятся на сервере и общие для семьи: новый телефон — открыл бота, и всё на месте. Видят их участники вашей семьи. У разработчика есть доступ, чтобы помочь, если что-то не работает, — больше никому данные не передаются.",
      "⚙️ Настройки → «Данные»:", {ul:["«Скачать копию данных» — файл придёт в чат с ботом (или командой /export)", "«PDF-сводка» — прививки и сделанные задания одним файлом, удобно показать педиатру", "«Восстановить из копии» — вернуть данные из файла"]}],
    demo:[{s:settings("data"), cap:"⚙️ Настройки → «Данные»"},
      {s:setSec("Данные", card(`${small("Копия всех отметок и прививок — файлом в чат с ботом. PDF-сводку удобно показать педиатру.")}${btn("Скачать копию данных", {ghost:true, tap:true})}${btn("PDF-сводка", {ghost:true})}${btn("Восстановить из копии", {ghost:true})}`)), cap:"«Скачать копию данных»"},
      {s:chat([{x:`📄 <b>first-year-2026-10-17.json</b><br>Копия данных «Первый год» на 17 октября: 412 отметок, 14 прививок.`}]), cap:"Файл — в чате с ботом"}],
    go:{tab:"family", sec:"data", hl:"#exp-json"}},

  {id:"feedback", sec:"set", q:"Нашли ошибку или есть идея?",
    a:["⚙️ Настройки → «Обратная связь». Выбери: отзыв, предложение или неполадка — и напиши пару слов. Мы читаем каждое сообщение, а когда сделаем — бот напишет."],
    demo:[{s:settings("feedback"), cap:"⚙️ Настройки → «Обратная связь»"},
      {s:scr(`${back("← Назад")}${H("Читаем каждое сообщение", "Обратная связь")}${card(`<b>О чём напишешь?</b>${["💬 Отзыв", "💡 Предложение", "⚠️ Неполадка"].map((x, i) => `<span class="m-opt"${t(i === 1)}>${x}</span>`).join("")}`)}`, {cur:"set"}), cap:"Выбери, о чём"},
      {s:scr(`${back("← Назад")}${H("", "💡 Предложение")}${card(`<span class="m-lbl">Чего не хватает? Как это могло бы работать?</span><span class="m-in tall" data-type="Добавьте дневник сна" translate="no"></span>${btn("Отправить", {tap:true})}`)}`, {cur:"set"}), cap:"Напиши и отправь"},
      {s:scr(`${back("← Назад")}${H("", "Обратная связь")}${card(`<b>Мои сообщения</b><span class="m-opt">💡 Предложение · отправлено</span>`)}`, {cur:"set", toast:"Спасибо! Прочитаем и ответим, если нужно"}), cap:"Отправлено"}],
    go:{tab:"feedback"}},

  {id:"notify", sec:"bot", q:"Что и когда присылает бот?",
    a:[{ul:["Каждое утро (около 9:00 по Киеву, зимой около 8:00) — рутина на день, а в день новой недели — её карточка", "За 3 дня и в день прививки — напоминание", "За час до записи на прививку (если указано время) — напоминание с кнопкой «Сделали»", "Когда пора заказать вещи — отдельное сообщение: уже есть или не нужно — отмечается кнопкой прямо в чате",
      "Раз в месяц — поздравление с новым месяцем", "Во время кормления, если приложение свёрнуто, — сообщение с таймером и кнопкой «Закончить»", "До родов — раз в неделю обратный отсчёт"]},
      "Уведомления приходят обоим родителям."],
    demo:[{s:chat([{x:`☀️ <b>Доброе утро!</b><br><b>Малыш</b>: 2 мес 9 дней, неделя 10<br>• Витамин D 400 МЕ<br>• Прогулка<br>• Время на животе<br><br>💉 <b>Прививки</b><br>• Малыш: АКДП — через 3 дня, пора записать`, btns:[["Открыть рутину"]]}]), cap:"Утро: рутина и напоминания"},
      {s:chat([{x:`🛒 <b>Пора заказать</b><br>Доставка ~3 недели, поэтому заказывай сейчас.<br>• Спальный мешок по сезону (TOG)`, btns:[["✅ Спальный мешок по сезону (TOG)", true], ["Не нужно"]]}]), cap:"Заказ — с кнопками прямо в чате"},
      {s:chat([{x:`🍼 <b>Кормление идёт</b> · Левая<br>Малыш · начало 14:05<br>⏱ <b>8 мин</b>`, btns:[["⏹ Закончить", true], ["🔁 Сменить грудь"]]}]), cap:"Кормление — таймер в чате"}],
    go:null},

  {id:"mute", sec:"bot", q:"Слишком много уведомлений. Как убрать?",
    a:["Ненужные темы выключи в ⚙️ Настройки → «Что ведём»: например, без прививок не будет и напоминаний о них.",
      "Заглушить бота совсем — в Telegram: открой чат, нажми на имя бота вверху → «Выключить звук». Сообщения будут приходить без звука."],
    demo:[{s:chat([{x:`☀️ <b>Доброе утро!</b><br><b>Малыш</b>: 2 мес 9 дней, неделя 10`}], {tapHead:true}), cap:"Чат с ботом → имя вверху"},
      {s:chat([{x:`☀️ <b>Доброе утро!</b><br><b>Малыш</b>: 2 мес 9 дней, неделя 10`}], {over:tgMenu(true)}), cap:"«Выключить звук»"},
      {s:chat([{x:`☀️ <b>Доброе утро!</b><br><b>Малыш</b>: 2 мес 9 дней, неделя 10`}], {mute:true}), cap:"Сообщения приходят тихо"}],
    go:{tab:"family", sec:"modules", hl:".tgls"}},

  {id:"commands", sec:"bot", q:"Какие команды есть в боте?",
    a:[{ul:["/today — рутина на сегодня", "/week — карточка текущей недели", "/card 12 — карточка любой недели, от 1 до 52", "/flags — красные флаги по возрасту", "/vaccines — ближайшие и просроченные прививки",
      "/export — копия всех данных файлом", "/sos — первая помощь: номера и что делать", "/help — справка и частые вопросы"]},
      "Команды видны в меню слева от поля ввода. Кнопка «Открыть» рядом — открывает приложение."],
    demo:[{s:chat([{x:"/card 12", me:true}], {type:"/card 12", tapSend:true}), cap:"Напиши команду"},
      {s:chat([{x:"/card 12", me:true}, {x:`<span class="m-pic" style="--h:186">12</span><b>Неделя 12 · Три месяца</b>`, btns:[["Открыть неделю"]]}]), cap:"Бот присылает карточку недели"},
      {s:chat([{x:"/help", me:true}, {x:`<b>Команды</b><br>/today — рутина на сегодня<br>/week — карточка текущей недели<br>/sos — первая помощь…`, btns:[["❓ Вопросы и ответы"]]}]), cap:"/help — все команды"}],
    go:null},

  {id:"doctor", sec:"bot", q:"Приложение заменяет врача?",
    a:["Нет. Нормы веса — стандарты ВОЗ, прививки — календарь МОЗ Украины, остальное — общая справка. Она помогает не забыть важное и вовремя заметить тревожные признаки, но решения о лечении — с педиатром.",
      "Если ребёнку плохо — звони 103, не жди ответа в приложении."],
    demo:[{s:tips({tapFa:true}), cap:"Первая помощь — в «Советах»"},
      {s:article(), cap:"Звонок 103 — в одно касание"}],
    go:{tab:"tips", hl:"#ts-fa"}},
];

export const faqOf = id => FAQ.find(x => x.id === id);

// ---------- проигрывание раскадровок ----------
export function faqDemo(item){
  const fr = item.demo || [];
  if (!fr.length) return "";
  return `<div class="fq-demo" data-demo="${item.id}">
    <div class="fq-phone" aria-hidden="true">${fr.map((f, i) => `<div class="fq-fr${i ? "" : " on"}">${f.s}</div>`).join("")}<span class="fq-finger"></span></div>
    <div class="fq-ctl">${fr.length > 1 ? `<div class="fq-dots">${fr.map((_, i) => `<button type="button" data-fqstep="${i}" aria-label="Шаг ${i + 1}" aria-current="${i === 0}"></button>`).join("")}</div>` : ""}
      <p class="fq-cap">${fr.map((f, i) => `<span${i ? " hidden" : ""}><b>${i + 1}.</b> ${f.cap}</span>`).join("")}</p></div>
  </div>`;
}
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const clockTxt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// Где остановились: живые обновления перерисовывают экран — раскадровка продолжает с того же кадра и паузы
const KEEP = {};
// Запускает все ещё не запущенные раскадровки внутри root. Остановка — сама: узел ушёл из DOM.
export function mountDemos(root){
  for (const el of root.querySelectorAll(".fq-demo:not([data-run])")) play(el);
}
function play(el){
  el.dataset.run = "1";
  const phone = el.querySelector(".fq-phone"), finger = el.querySelector(".fq-finger");
  const frames = [...el.querySelectorAll(".fq-fr")], caps = [...el.querySelectorAll(".fq-cap > span")], dots = [...el.querySelectorAll("[data-fqstep]")];
  const id = el.dataset.demo, kept = KEEP[id];
  let timers = [], auto = !still() && !(kept && kept.paused), cur = kept && kept.i < frames.length ? kept.i : 0;
  const clear = () => { timers.forEach(clearTimeout); timers.forEach(clearInterval); timers = []; };
  const later = (ms, fn) => timers.push(setTimeout(() => el.isConnected ? fn() : clear(), ms));
  // палец позиционируется от внутреннего края рамки телефона. Свойство translate, а не transform:
  // пульсация нажатия (scale) тогда сжимает палец на месте, а не тянет его к углу телефона
  const point = n => { const r = n.getBoundingClientRect(), p = phone.getBoundingClientRect(), k = p.width / phone.offsetWidth || 1;
    finger.style.translate = `${((r.left + r.width / 2 - p.left) / k - phone.clientLeft).toFixed(1)}px ${((r.top + r.height / 2 - p.top) / k - phone.clientTop).toFixed(1)}px`; };
  function show(i){
    clear(); cur = i; KEEP[id] = {i, paused:!auto};
    frames.forEach((f, j) => f.classList.toggle("on", j === i));
    caps.forEach((c, j) => c.hidden = j !== i);
    dots.forEach((d, j) => d.setAttribute("aria-current", j === i));
    const f = frames[i], target = f.querySelector("[data-t]"), typ = f.querySelector("[data-type]");
    f.querySelectorAll(".m-press").forEach(n => n.classList.remove("m-press"));
    f.querySelectorAll(".m-toast").forEach(n => { n.style.animation = "none"; void n.offsetWidth; n.style.animation = ""; });   // тост — заново с каждым показом
    for (const tk of f.querySelectorAll("[data-tick]")) {
      let s = Number(tk.dataset.tick) || 0; tk.textContent = clockTxt(s);
      if (auto) timers.push(setInterval(() => { if (!el.isConnected) return clear(); tk.textContent = clockTxt(++s); }, 1000));
    }
    finger.classList.remove("tap");
    const typed = typ ? tr(typ.dataset.type) : "";   // набирается уже на языке интерфейса
    if (typ) typ.textContent = auto ? "" : typed;
    if (!auto) { finger.classList.toggle("vis", !!target); if (target) point(target); return; }
    let at = 450;
    if (typ) { const s = typed; for (let c = 1; c <= s.length; c++) later(at + c * 110, () => typ.textContent = s.slice(0, c)); at += s.length * 110 + 250; }
    if (!target) { finger.classList.remove("vis"); return later(Math.max(at, f.querySelector("[data-tick]") ? 3600 : 2600), () => show((i + 1) % frames.length)); }
    later(at, () => { finger.classList.add("vis"); point(target); });
    later(at + 700, () => { finger.classList.add("tap"); target.classList.add("m-press"); });
    later(at + 1300, () => show(i + 1 < frames.length ? i + 1 : 0));
  }
  el.addEventListener("click", e => {
    const d = e.target.closest("[data-fqstep]"); if (!d) return;
    auto = false; show(Number(d.dataset.fqstep));   // ручной шаг — автопоказ на паузе
  });
  // касание телефона — пауза / продолжить
  phone.addEventListener("click", () => { if (auto) { auto = false; show(cur); } else if (!still()) { auto = true; show(cur); } });
  // кадр отрисован — палец к первой цели (размеры известны только после вставки в DOM)
  requestAnimationFrame(() => show(cur));
}
