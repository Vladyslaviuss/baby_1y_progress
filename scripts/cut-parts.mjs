// Режет лист деталей персонажа на отдельные PNG с прозрачностью. Без нейросетей:
// фон — заливка от краёв по почти-белым пикселям, мягкий край — «снятие белого» на границе, детали — связные области.
// node scripts/cut-parts.mjs media/character/parts-1.png media/character/parts
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const [src, outDir] = process.argv.slice(2);
mkdirSync(outDir, {recursive:true});
const {data, info} = await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W = info.width, H = info.height, N = W * H;
const px = i => [data[i*4], data[i*4+1], data[i*4+2]];
const whiteish = i => { const [r,g,b] = px(i), mn = Math.min(r,g,b), mx = Math.max(r,g,b); return mn > 236 && mx - mn < 20; };

// 1. фон: заливка от краёв
const bg = new Uint8Array(N), q = [];
for (let x = 0; x < W; x++) { q.push(x, (H-1)*W + x); }
for (let y = 0; y < H; y++) { q.push(y*W, y*W + W-1); }
while (q.length) {
  const i = q.pop(); if (bg[i] || !whiteish(i)) continue; bg[i] = 1;
  const x = i % W, y = (i / W) | 0;
  if (x > 0) q.push(i-1); if (x < W-1) q.push(i+1); if (y > 0) q.push(i-W); if (y < H-1) q.push(i+W);
}
// 2. альфа: фон 0; пиксели у границы с фоном — частичная прозрачность и «снятие» белого
const out = Buffer.from(data);
for (let i = 0; i < N; i++) {
  if (bg[i]) { out[i*4+3] = 0; continue; }
  const x = i % W, y = (i / W) | 0;
  let edge = false;
  for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = x+dx, yy = y+dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    if (bg[yy*W+xx]) { edge = true; break; }
  }
  if (!edge) continue;
  const [r,g,b] = px(i), mn = Math.min(r,g,b);
  const a = Math.max(0, Math.min(1, (255 - mn) / 90));
  if (a < 1) {
    out[i*4+3] = Math.round(a * 255);
    for (let c = 0; c < 3; c++) out[i*4+c] = Math.max(0, Math.min(255, Math.round((data[i*4+c] - 255 * (1 - a)) / Math.max(a, .01))));
  }
}
// 3. связные области непрозрачных пикселей
const label = new Int32Array(N).fill(-1), comps = [];
for (let i = 0; i < N; i++) {
  if (out[i*4+3] === 0 || label[i] !== -1) continue;
  const id = comps.length, st = [i]; let minx = W, miny = H, maxx = 0, maxy = 0, n = 0, sx = 0, sy = 0;
  label[i] = id;
  while (st.length) {
    const j = st.pop(), x = j % W, y = (j / W) | 0; n++; sx += x; sy += y;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    for (const k of [j-1, j+1, j-W, j+W]) {
      if (k < 0 || k >= N || label[k] !== -1 || out[k*4+3] === 0) continue;
      if ((k === j-1 && x === 0) || (k === j+1 && x === W-1)) continue;
      label[k] = id; st.push(k);
    }
  }
  comps.push({id, n, minx, miny, maxx, maxy, cx: sx/n, cy: sy/n});
}
const parts = comps.filter(c => c.n > 2000).sort((a, b) => (Math.round(a.cy / (H/2)) - Math.round(b.cy / (H/2))) || a.cx - b.cx);
const meta = [];
for (const [k, c] of parts.entries()) {
  const pad = 4, x0 = Math.max(0, c.minx - pad), y0 = Math.max(0, c.miny - pad), w = Math.min(W, c.maxx + pad + 1) - x0, h = Math.min(H, c.maxy + pad + 1) - y0;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y0 + y) * W + (x0 + x), o = (y * w + x) * 4;
    if (label[i] === c.id || (label[i] === -1 && out[i*4+3] > 0)) { out.copy(buf, o, i*4, i*4+4); }
  }
  const name = `part-${k}`;
  await sharp(buf, {raw:{width:w, height:h, channels:4}}).png().toFile(`${outDir}/${name}.png`);
  meta.push({name, x:x0, y:y0, w, h, area:c.n});
}
writeFileSync(`${outDir}/parts.json`, JSON.stringify(meta, null, 1));
console.log(meta.map(m => `${m.name} ${m.w}x${m.h} @${m.x},${m.y}`).join("\n"));
