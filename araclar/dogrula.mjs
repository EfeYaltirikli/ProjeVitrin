// ProjeVitrin · geometri doğrulayıcı
// Kullanım: ~/.local/bin/node araclar/dogrula.mjs projeler/<proje>/daire-xx.json
// Kontroller: oda alanı ↔ plan m², mobilya oda içinde mi, duvara/mobilyaya giriyor mu,
// kapı süpürme alanı, kamera noktaları, duvara oturmayan açıklıklar.
import fs from 'node:fs';
import { buildWalls, polyArea, pointInPoly, roomAt, furnSize, chairSpots, bbox } from '../engine/geom.js';

const file = process.argv[2];
if (!file) { console.error('Kullanım: node araclar/dogrula.mjs <daire.json>'); process.exit(2); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const out = { FAIL: [], WARN: [], OK: [] };
const say = (lvl, msg) => out[lvl].push(msg);
const TOL = 0.05;

// ---- yardımcılar: yönlü dikdörtgen (OBB) ----
const rad = d => (d * Math.PI) / 180;
function obb(cx, cz, w, d, rDeg = 0, ad = '') {
  const t = rad(rDeg), c = Math.cos(t), s = Math.sin(t);
  return { cx, cz, hw: w / 2, hd: d / 2, ux: [c, -s], uz: [s, c], ad };
}
function corners(o) {
  const r = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) r.push([o.cx + a * o.hw * o.ux[0] + b * o.hd * o.uz[0], o.cz + a * o.hw * o.ux[1] + b * o.hd * o.uz[1]]);
  return r;
}
function shrink(o, k) { return { ...o, hw: Math.max(0.001, o.hw - k), hd: Math.max(0.001, o.hd - k) }; }
function overlap(A, B) { // SAT
  for (const ax of [A.ux, A.uz, B.ux, B.uz]) {
    const pa = corners(A).map(p => p[0] * ax[0] + p[1] * ax[1]), pb = corners(B).map(p => p[0] * ax[0] + p[1] * ax[1]);
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}
function inObb(o, x, z) {
  const dx = x - o.cx, dz = z - o.cz;
  return Math.abs(dx * o.ux[0] + dz * o.ux[1]) <= o.hw && Math.abs(dx * o.uz[0] + dz * o.uz[1]) <= o.hd;
}
const loc = (m, lx, lz) => { const t = rad(m.r || 0), c = Math.cos(t), s = Math.sin(t); return [m.x + lx * c + lz * s, m.z - lx * s + lz * c]; };

// ---- 1. alanlar ----
for (const r of data.odalar) {
  const a = polyArea(r.poly), d = (a - r.m2) / r.m2 * 100;
  const msg = `${r.ad}: model ${a.toFixed(2)} m² / plan ${r.m2} m² (${d >= 0 ? '+' : ''}${d.toFixed(1)}%)`;
  say(Math.abs(d) > 15 ? 'FAIL' : Math.abs(d) > 8 ? 'WARN' : 'OK', 'Alan · ' + msg);
}
// oda çakışması
for (let i = 0; i < data.odalar.length; i++) for (let j = i + 1; j < data.odalar.length; j++) {
  const A = bbox(data.odalar[i].poly), B = bbox(data.odalar[j].poly);
  const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), oz = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0);
  if (ox > 0.01 && oz > 0.01) say('FAIL', `Oda çakışması · ${data.odalar[i].ad} ↔ ${data.odalar[j].ad} (${(ox * oz).toFixed(3)} m²)`);
}

// ---- 2. duvarlar ve açıklıklar ----
const walls = buildWalls(data);
const used = walls.reduce((n, w) => n + w.spans.filter(s => s.kind !== 'dolu').length, 0);
if (used !== data.acikliklar.length) say('FAIL', `Açıklık · ${data.acikliklar.length - used} açıklık hiçbir duvara oturmuyor`);
const wallBoxes = [];
for (const w of walls) for (const sp of w.spans) {
  if (sp.kind !== 'dolu' && sp.kind !== 'pencere') continue; // pencere altı denizlik dolu sayılır (mobilya önüne konabilir ama içine giremez)
  const sm = (sp.s0 + sp.s1) / 2;
  const o = obb(w.a[0] + w.dir[0] * sm, w.a[1] + w.dir[1] * sm, sp.s1 - sp.s0, w.t, 0, `duvar#${w.id}`);
  o.ux = [w.dir[0], w.dir[1]]; o.uz = [w.n[0], w.n[1]];
  wallBoxes.push(o);
}

// ---- 3. mobilya ayak izleri ----
const SKIP = new Set(['sarkit', 'hali']);
const items = []; // { ad, oda, parts:[obb] }
data.mobilya.forEach((m, i) => {
  if (SKIP.has(m.tip)) return;
  const ad = `${m.tip}#${i}`;
  if (m.tip === 'mutfak_L') {
    const D = 0.62;
    const a = obb((m.x0 + m.x1) / 2, m.z0 + D / 2, m.x1 - m.x0, D, 0, ad);
    const b = obb(m.x1 - D / 2, (m.z0 + D + m.z1) / 2, D, m.z1 - m.z0 - D, 0, ad);
    const r = roomAt(data, (m.x0 + m.x1) / 2, (m.z0 + m.z1) / 2);
    items.push({ ad, m, oda: r && r.id, parts: [a, b] }); return;
  }
  const { w, d } = furnSize(m);
  const parts = [obb(m.x, m.z, w, d, m.r || 0, ad)];
  if (m.tip === 'yemek_masasi') for (const [cx, cz] of chairSpots(m, w, d)) { const [x, z] = loc(m, cx, cz + Math.sign(cz) * 0.05); parts.push(obb(x, z, 0.44, 0.44, m.r || 0, ad + '/sandalye')); }
  if (m.tip === 'calisma_masasi') { const [x, z] = loc(m, -0.1, d / 2 + 0.18); parts.push(obb(x, z, 0.44, 0.44, m.r || 0, ad + '/sandalye')); }
  if (m.tip === 'balkon_set') for (const sx of [-0.48, 0.48]) { const [x, z] = loc(m, sx, 0); parts.push(obb(x, z, 0.44, 0.44, m.r || 0, ad + '/sandalye')); }
  const r = roomAt(data, m.x, m.z);
  items.push({ ad, m, oda: r && r.id, parts });
});
for (const it of items) {
  if (!it.oda) { say('FAIL', `Mobilya · ${it.ad} hiçbir odanın içinde değil`); continue; }
  const room = data.odalar.find(r => r.id === it.oda);
  // oda dışına taşma (tolerans)
  for (const p of it.parts) for (const [x, z] of corners(shrink(p, TOL))) if (!pointInPoly(x, z, room.poly)) { say('FAIL', `Mobilya · ${p.ad} ${room.ad} dışına taşıyor (${x.toFixed(2)}, ${z.toFixed(2)})`); break; }
  // duvar
  for (const p of it.parts) for (const wb of wallBoxes) if (overlap(shrink(p, TOL), wb)) { say('FAIL', `Mobilya · ${p.ad} duvara giriyor (${wb.ad})`); break; }
}
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
  const A = items[i], B = items[j]; if (A.oda !== B.oda) continue;
  if (A.m.tip === 'balkon_set' || B.m.tip === 'balkon_set') {}
  for (const p of A.parts) for (const q of B.parts) if (overlap(shrink(p, TOL), shrink(q, TOL))) say('FAIL', `Çakışma · ${p.ad} ↔ ${q.ad}`);
}

// ---- 4. kapı süpürme alanı ----
const sweeps = [];
for (const w of walls) for (const sp of w.spans) {
  if ((sp.kind !== 'kapi' && sp.kind !== 'celik_kapi') || sp.opening.kapali) continue;
  const sg = sp.side || 1, L = sp.s1 - sp.s0;
  const hingeS = sp.hingeAtB ? sp.s1 : sp.s0, dirS = sp.hingeAtB ? -1 : 1;
  const hx = w.a[0] + w.dir[0] * hingeS + w.n[0] * sg * (w.t / 2), hz = w.a[1] + w.dir[1] * hingeS + w.n[1] * sg * (w.t / 2);
  const pts = [];
  for (let k = 1; k <= 6; k++) for (let a = 0; a <= 8; a++) {
    const r = (L * k) / 6, t = (a / 8) * Math.PI / 2;
    const ex = w.dir[0] * dirS * Math.cos(t) + w.n[0] * sg * Math.sin(t), ez = w.dir[1] * dirS * Math.cos(t) + w.n[1] * sg * Math.sin(t);
    pts.push([hx + ex * r, hz + ez * r]);
  }
  const rr = roomAt(data, hx + w.n[0] * sg * 0.3, hz + w.n[1] * sg * 0.3);
  sweeps.push({ ad: `kapı → ${rr ? rr.ad : '?'}`, pts });
}
for (const s of sweeps) {
  const hits = new Set();
  for (const it of items) for (const p of it.parts) if (s.pts.some(([x, z]) => inObb(shrink(p, 0.02), x, z))) hits.add(p.ad);
  if (hits.size) say('FAIL', `Kapı · ${s.ad} süpürme alanında: ${[...hits].join(', ')}`);
}
for (let i = 0; i < sweeps.length; i++) for (let j = i + 1; j < sweeps.length; j++) {
  const A = sweeps[i], B = sweeps[j];
  const near = A.pts.some(([x, z]) => B.pts.some(([u, v]) => Math.hypot(x - u, z - v) < 0.08));
  if (near) say('WARN', `Kapı · ${A.ad} ile ${B.ad} süpürme alanları kesişiyor`);
}

// ---- 5. kameralar ----
for (const r of data.odalar) {
  const k = r.kamera; if (!k) { say('WARN', `Kamera · ${r.ad} için kamera yok`); continue; }
  const [x, z] = k.p;
  const inR = roomAt(data, x, z);
  if (!inR) say('FAIL', `Kamera · ${r.ad} kamerası hiçbir odanın içinde değil`);
  for (const it of items) for (const p of it.parts) if (inObb({ ...p, hw: p.hw + 0.25, hd: p.hd + 0.25 }, x, z)) say('WARN', `Kamera · ${r.ad} kamerası ${p.ad} nesnesine 25 cm'den yakın`);
  for (const s of sweeps) if (s.pts.some(([u, v]) => Math.hypot(x - u, z - v) < 0.25)) say('FAIL', `Kamera · ${r.ad} kamerası kapı kanadının önünde (${s.ad})`);
  for (const wb of wallBoxes) if (inObb({ ...wb, hw: wb.hw + 0.2, hd: wb.hd + 0.2 }, x, z)) { say('WARN', `Kamera · ${r.ad} kamerası duvara 20 cm'den yakın`); break; }
}

// ---- rapor ----
for (const l of out.OK) console.log('OK    ' + l);
for (const l of out.WARN) console.log('WARN  ' + l);
for (const l of out.FAIL) console.log('FAIL  ' + l);
console.log(`\n${out.FAIL.length} FAIL · ${out.WARN.length} WARN · ${out.OK.length} OK`);
process.exit(out.FAIL.length ? 1 : 0);
