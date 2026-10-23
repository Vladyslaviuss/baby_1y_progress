// Фото для карточек «Советов»: предметы на однотонном фоне, без лиц. Источник — Pexels (бесплатная лицензия, указание автора не обязательно).
// Файлы — public/img/tips/<ключ>.jpg, 720 px по ширине. Нет фото — карточка остаётся цветной со схемой.
const BY_ID = {
  "r:vitd":"dropper", "r:skin":"muslin", "r:walk":"stroller", "r:teeth":"toothbrush",
  "r:tummy":"bunny", "r:massage":"lotion", "r:gymn":"ball",
  "r:face":"bear", "r:cards":"shapes", "r:toys":"rattle",
  "r:read":"books", "r:en":"blocks", "r:talk":"rainbow", "r:songs":"xylophone",
  "r:daynight":"moon", "r:feed":"spoons", "r:allerg":"peanut", "r:cup":"cup", "r:eyes":"tissues", "r:bath":"ducks2", "r:nails":"scissors", "r:air":"thermo2", "spurts":"scale",
  "vac:about":"calendar", "vac:bcg":"vial", "vac:hx1":"syringe", "vac:hx2":"plaster", "vac:mmr2":"vial", "vac:pcv":"syringe", "vac:rota":"plaster",
  "vac:flu":"vial", "vac:mening":"syringe", "vac:var":"plaster", "vac:hepa":"vial",
  "things:prep":"babybox", "things:air":"humid", "things:sleep":"crib", "things:hygiene":"shampoo", "things:bath":"ducks", "things:clothes":"knits",
  "things:medkit":"medkit", "things:feeding":"formula", "things:walk":"stroller", "things:safety":"socket", "things:toys":"woodtoys",
  "things:mom":"mug", "things:travel":"suitcase",
  "n:heating":"humid", "n:summer-heat":"fan", "n:windows":"curtain", "n:flu":"vial", "n:car-heat":"fan", "n:holidays":"babybox",
  "g:sleep-rules":"crib", "g:sids":"pinkblanket", "g:pacifier":"pacis", "g:why-cry":"pacis", "g:colic":"pinkknit", "g:breath-holding":"clock",
  "g:spit-up":"bottles", "g:low-milk":"milk3", "g:milk-storage":"milk", "g:formula":"formula",
  "g:dress-walk":"socks", "g:skin-dry-wet":"cream", "g:diaper-rash":"creamtube", "g:diapers":"diaper", "g:skin-harmless":"lotion", "g:girl-hygiene":"shampoo", "g:boy-hygiene":"shampoo",
  "g:cold":"tissues", "g:fever-home":"thermo", "g:vomit-fever":"thermo2", "g:rehydration":"water", "g:rash-glass":"glass", "g:sick-log":"notebook",
  "g:stool-colors":"shapes", "g:dosing":"medsyr", "g:hips":"bunny", "g:doctor-visit":"steth",
  "g:wound-sting":"plaster", "g:home-safety":"socket",
  "g:mom-first":"mug", "g:breast-problems":"tea", "g:mom-meds":"pills", "g:ppd":"curtain", "g:grandparents":"bear",
  "g:not-teeth":"teether", "g:safe-toys":"woodtoys", "g:speech-pause":"clock2", "g:vac-prep":"calendar", "g:vac-after":"steth2",
  // добавлено позже: первая помощь, «День и ночь» и новые статьи
  "fa:choke":"grapes", "fa:cpr":"firstaid", "fa:seizure":"stopwatch", "fa:fever":"thermo3", "fa:head":"icepack", "fa:burn":"coolwater", "fa:swallow":"batteries", "fa:allergy":"antihist", "fa:nose-object":"beads",
  "r:dn":"nightlight", "g:swaddle":"swaddle", "g:latch":"nursingpillow", "g:hand-express":"milkbag", "g:top-up":"scoop", "g:formula-amount":"bottlemark", "g:bottles":"bottlebrush",
  "g:bath":"towel", "g:eyes":"cottonpads", "g:navel":"swabs", "g:hemangioma":"camera", "g:newborn-normal":"onesie", "g:hiccups":"bib", "g:head-shape":"babyhat",
  "g:ear":"eardrops", "g:croup":"coughsyrup", "g:decongestant":"nasalspray", "g:sick-feeding":"sippy", "g:sick-night":"lamp", "g:constipation":"prunes", "g:med-mistakes":"medcup",
  "g:car":"toycar", "g:kitchen":"kettle", "g:mercury":"glassthermo", "g:bf-lifestyle":"coffee", "g:mom-sick":"lemontea", "g:ask-help":"notes", "g:no-analgin":"blister", "g:drops-how":"dropperbottle",
};
export const photoOf = a => { const k = BY_ID[a.id] || (a.id.startsWith("flags:") ? (Number(a.from) / 2 % 2 ? "steth2" : "steth") : null); return k ? `img/tips/${k}.jpg` : null; };
