// ProjeVitrin · etkileşimli 2D kroki (SVG)
// Aynı daire verisinden mimari çizim üretir: poşe duvarlar, kapı yayları, pencereler,
// mobilya çizgileri, oda adları ve m². Odalar tıklanabilir; "buradasınız" işareti ve bakış konisi.
import { buildWalls, bbox, unitBounds, furnSize, toWorld, chairSpots, ODA_RENK } from './geom.js';
export { chairSpots };

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const f = n => +n.toFixed(3);

export function createPlan(host, data, opts = {}) {
  const walls = buildWalls(data);
  const B = unitBounds(data);
  const pad = 0.9;
  const svg = el('svg', {
    viewBox: `${f(B.x0 - pad)} ${f(B.z0 - pad)} ${f(B.w + pad * 2)} ${f(B.d + pad * 2)}`,
    class: 'pv-plan', role: 'img', 'aria-label': `${data.ad} krokisi`
  });
  const defs = el('defs', {}, svg);
  const hatch = el('pattern', { id: 'pv-hatch', width: 0.25, height: 0.25, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 0.25, stroke: 'var(--pv-ink-3)', 'stroke-width': 0.03 }, hatch);
  const tileP = el('pattern', { id: 'pv-tile', width: 0.6, height: 0.6, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M0.6 0H0V0.6', fill: 'none', stroke: 'var(--pv-line-soft)', 'stroke-width': 0.012 }, tileP);
  const woodP = el('pattern', { id: 'pv-wood', width: 1.2, height: 0.2, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M0 0.2H1.2M0.45 0V0.2', fill: 'none', stroke: 'var(--pv-line-soft)', 'stroke-width': 0.01 }, woodP);

  const gRooms = el('g', { class: 'pv-rooms' }, svg);
  const gFloor = el('g', { class: 'pv-floorpat', 'pointer-events': 'none' }, svg);
  const gDoors = el('g', { class: 'pv-doors', 'pointer-events': 'none' }, svg); // kapılar mobilya ve etiketlerin altında
  const gFurn = el('g', { class: 'pv-furn', 'pointer-events': 'none' }, svg);
  const doorDiscs = [];
  const gWalls = el('g', { class: 'pv-walls', 'pointer-events': 'none' }, svg);
  const gLabels = el('g', { class: 'pv-labels', 'pointer-events': 'none' }, svg);
  const gMe = el('g', { class: 'pv-me', 'pointer-events': 'none', opacity: 0 }, svg);

  // Odalar
  const roomEls = {};
  for (const r of data.odalar) {
    const pts = r.poly.map(p => p.map(f).join(',')).join(' ');
    const g = el('g', { class: 'pv-room', 'data-id': r.id, tabindex: 0, role: 'button', 'aria-label': `${r.ad}, ${r.m2} metrekare` }, gRooms);
    el('polygon', { points: pts, fill: ODA_RENK[r.tur] || '#eee' }, g);
    el('polygon', { points: pts, class: 'pv-room-hl' }, g);
    const pat = r.zemin === 'parke' ? 'pv-wood' : (r.zemin === 'seramik' || r.zemin === 'islak' || r.zemin === 'balkon') ? 'pv-tile' : null;
    if (pat) el('polygon', { points: pts, fill: `url(#${pat})` }, gFloor);
    g.addEventListener('click', () => opts.onRoom && opts.onRoom(r.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onRoom && opts.onRoom(r.id); } });
    g.addEventListener('pointerenter', () => { opts.onHover && opts.onHover(r.id); });
    g.addEventListener('pointerleave', () => { opts.onHover && opts.onHover(null); });
    roomEls[r.id] = g;
  }
  if (data.cekirdek) {
    const pts = data.cekirdek.poly.map(p => p.map(f).join(',')).join(' ');
    el('polygon', { points: pts, fill: 'url(#pv-hatch)', stroke: 'none' }, gFloor);
    const b = bbox(data.cekirdek.poly);
    // merdiven basamakları
    const sg = el('g', { stroke: 'var(--pv-ink-3)', 'stroke-width': 0.015, fill: 'none' }, gFurn);
    for (let x = b.x0 + 0.3; x < b.x0 + b.w * 0.55; x += 0.27) el('line', { x1: f(x), y1: f(b.z0 + 0.2), x2: f(x), y2: f(b.z0 + b.d * 0.48) }, sg);
    const t = el('text', { x: f(b.cx), y: f(b.z1 - 0.5), class: 'pv-core-t' }, gLabels);
    t.textContent = 'KAT HOLÜ · MERDİVEN';
  }

  // Mobilya
  for (const m of data.mobilya) drawFurn(gFurn, m);

  // Duvarlar
  for (const w of walls) {
    const [ux, uz] = w.dir, [nx, nz] = w.n, h = w.t / 2;
    const P = (s, o) => [w.a[0] + ux * s + nx * o, w.a[1] + uz * s + nz * o];
    const ext = w.tip === 'korkuluk' ? 0 : h; // uçları köşeye kadar uzat
    for (const sp of w.spans) {
      const s0 = sp.s0 - (sp.s0 < 1e-3 ? ext : 0), s1 = sp.s1 + (sp.s1 > w.len - 1e-3 ? ext : 0);
      if (sp.kind === 'dolu') {
        const q = [P(s0, -h), P(s1, -h), P(s1, h), P(s0, h)];
        el('polygon', { points: q.map(p => p.map(f).join(',')).join(' '), class: w.tip === 'korkuluk' ? 'pv-rail' : 'pv-wall' }, gWalls);
      } else if (sp.kind === 'pencere') {
        const q = [P(s0, -h), P(s1, -h), P(s1, h), P(s0, h)];
        el('polygon', { points: q.map(p => p.map(f).join(',')).join(' '), class: 'pv-win' }, gWalls);
        for (const o of [-h * 0.25, h * 0.25]) { const a = P(s0, o), b = P(s1, o); el('line', { x1: f(a[0]), y1: f(a[1]), x2: f(b[0]), y2: f(b[1]), class: 'pv-win-l' }, gWalls); }
      } else if (sp.kind === 'balkon_kapi') {
        const q = [P(s0, -h), P(s1, -h), P(s1, h), P(s0, h)];
        el('polygon', { points: q.map(p => p.map(f).join(',')).join(' '), class: 'pv-win' }, gWalls);
        const m = (s0 + s1) / 2;
        for (const [a0, a1, o] of [[s0, m + 0.05, -h * 0.3], [m - 0.05, s1, h * 0.3]]) { const a = P(a0, o), b = P(a1, o); el('line', { x1: f(a[0]), y1: f(a[1]), x2: f(b[0]), y2: f(b[1]), class: 'pv-win-l' }, gWalls); }
      } else if (sp.kind === 'kapi' || sp.kind === 'celik_kapi') {
        const sgn = sp.side || 1;
        const hinge = sp.hingeAtB ? sp.s1 : sp.s0, free = sp.hingeAtB ? sp.s0 : sp.s1;
        const r = Math.abs(sp.s1 - sp.s0);
        const cls = sp.kind === 'celik_kapi' ? 'pv-door pv-door--steel' : 'pv-door';
        if (sp.opening.kapali) { // kapalı kanat: açıklığın içinde ince dikdörtgen, yay yok
          const q = [P(sp.s0, -0.025), P(sp.s1, -0.025), P(sp.s1, 0.025), P(sp.s0, 0.025)];
          el('polygon', { points: q.map(p => p.map(f).join(',')).join(' '), class: 'pv-door-closed' }, gDoors);
        } else {
          const H = P(hinge, sgn * h), Fr = P(free, sgn * h), L = [H[0] + nx * sgn * r, H[1] + nz * sgn * r];
          const sweep = arcSweep(H, Fr, L);
          el('path', { d: `M${f(H[0])} ${f(H[1])} L${f(Fr[0])} ${f(Fr[1])} A${f(r)} ${f(r)} 0 0 ${sweep} ${f(L[0])} ${f(L[1])} Z`, class: 'pv-door-sweep' }, gDoors);
          el('line', { x1: f(H[0]), y1: f(H[1]), x2: f(L[0]), y2: f(L[1]), class: cls }, gDoors);
          // çeyrek dairenin merkezi: etiket çakışma testi için
          doorDiscs.push({ x: (H[0] + Fr[0] + L[0]) / 3, z: (H[1] + Fr[1] + L[1]) / 3, r: r * 0.62 });
        }
        const e0 = P(sp.s0, 0), e1 = P(sp.s1, 0);
        for (const e of [e0, e1]) el('line', { x1: f(e[0] - nx * h), y1: f(e[1] - nz * h), x2: f(e[0] + nx * h), y2: f(e[1] + nz * h), class: 'pv-jamb' }, gWalls);
      }
    }
  }

  // Etiketler
  const labelEls = {};
  for (const r of data.odalar) {
    const b = bbox(r.poly);
    const small = b.d < 1.0 || b.w < 1.6;
    // etiket yeri: verilmişse o; değilse merkezden başlayıp kapı alanına çakışmayan ilk aday
    const lw = Math.max(r.ad.length * (small ? 0.12 : 0.155), 0.9), lh = small ? 0.45 : 0.62;
    const hitsDoor = (x, z) => doorDiscs.some(d => Math.abs(d.x - x) < lw / 2 + d.r && Math.abs(d.z - z) < lh / 2 + d.r);
    let lx = b.cx, lz = b.cz;
    if (r.etiket) [lx, lz] = r.etiket;
    else if (hitsDoor(lx, lz)) {
      const cand = [];
      for (const fx of [0.5, 0.35, 0.65, 0.25, 0.75]) for (const fz of [0.5, 0.35, 0.65, 0.25, 0.75]) cand.push([b.x0 + b.w * fx, b.z0 + b.d * fz]);
      const ok = cand.find(([x, z]) => !hitsDoor(x, z)); if (ok) [lx, lz] = ok;
    }
    const g = el('g', { class: 'pv-label' + (small ? ' pv-label--s' : ''), transform: `translate(${f(lx)} ${f(lz)})` }, gLabels);
    const t1 = el('text', { y: small ? -0.02 : -0.06, class: 'pv-label-n' }, g); t1.textContent = r.ad.toLocaleUpperCase('tr');
    const t2 = el('text', { y: small ? 0.24 : 0.3, class: 'pv-label-a' }, g); t2.textContent = `${String(r.m2).replace('.', ',')} m²`;
    labelEls[r.id] = g;
  }

  // Buradasınız işareti
  const cone = el('path', { d: 'M0 0 L1.9 -0.85 A2.1 2.1 0 0 1 1.9 0.85 Z', class: 'pv-me-cone' }, gMe);
  el('circle', { r: 0.2, class: 'pv-me-dot' }, gMe);
  el('circle', { r: 0.09, fill: '#fff' }, gMe);

  // Kuzey oku yok: parselin yönü kaynakta verilmemiş. Ölçek çubuğu:
  const sb = el('g', { class: 'pv-scale', transform: `translate(${f(B.x0)} ${f(B.z1 + 0.55)})` }, svg);
  el('rect', { x: 0, y: 0, width: 1, height: 0.08, fill: 'var(--pv-ink)' }, sb);
  el('rect', { x: 1, y: 0, width: 1, height: 0.08, fill: 'none', stroke: 'var(--pv-ink)', 'stroke-width': 0.02 }, sb);
  const st = el('text', { x: 2.15, y: 0.1, class: 'pv-scale-t' }, sb); st.textContent = '2 m';

  host.appendChild(svg);

  let active = null;
  return {
    svg, walls,
    setActive(id) {
      if (active && roomEls[active]) roomEls[active].classList.remove('is-active');
      active = id;
      if (id && roomEls[id]) roomEls[id].classList.add('is-active');
    },
    setHover(id) {
      for (const k in roomEls) roomEls[k].classList.toggle('is-hover', k === id);
    },
    setMe(x, z, yawDeg, visible = true) {
      gMe.setAttribute('opacity', visible ? 1 : 0);
      gMe.setAttribute('transform', `translate(${f(x)} ${f(z)}) rotate(${f(yawDeg)})`);
    }
  };
}

function arcSweep(H, A, B) {
  const ax = A[0] - H[0], az = A[1] - H[1], bx = B[0] - H[0], bz = B[1] - H[1];
  return ax * bz - az * bx > 0 ? 1 : 0;
}

function drawFurn(g, m) {
  const { w, d } = furnSize(m);
  const gg = el('g', { transform: `translate(${f(m.x ?? 0)} ${f(m.z ?? 0)}) rotate(${f(-(m.r || 0))})`, class: 'pv-f' }, g);
  const R = (x, y, W, D, cls = '', rx = 0.03) => el('rect', { x: f(x), y: f(y), width: f(W), height: f(D), rx, class: cls }, gg);
  const C = (x, y, r, cls = '') => el('circle', { cx: f(x), cy: f(y), r: f(r), class: cls }, gg);
  switch (m.tip) {
    case 'kanepe':
      R(-w / 2, -d / 2, w, d); R(-w / 2, -d / 2, w, 0.2); R(-w / 2, -d / 2, 0.16, d); R(w / 2 - 0.16, -d / 2, 0.16, d);
      { const n = Math.max(2, Math.round((w - 0.32) / 0.75)); const cw = (w - 0.32) / n; for (let i = 0; i < n; i++) R(-w / 2 + 0.16 + i * cw + 0.02, -d / 2 + 0.22, cw - 0.04, d - 0.28, 'pv-f-in'); }
      break;
    case 'yatak':
      R(-w / 2, -d / 2, w, d); R(-w / 2, -d / 2, w, 0.08, 'pv-f-dk');
      { const pw = w > 1.3 ? (w - 0.3) / 2 : w - 0.3; for (let i = 0; i < (w > 1.3 ? 2 : 1); i++) R(-w / 2 + 0.15 + i * (pw + 0.0), -d / 2 + 0.14, pw - 0.04, 0.32, 'pv-f-in', 0.08); }
      R(-w / 2, -d / 2 + 0.6, w, d - 0.6, 'pv-f-in', 0.02);
      el('path', { d: `M${f(-w / 2)} ${f(-d / 2 + 0.6)} L${f(w / 2)} ${f(-d / 2 + 0.95)}`, class: 'pv-f-l' }, gg);
      break;
    case 'komodin': R(-w / 2, -d / 2, w, d); C(0, 0, 0.1, 'pv-f-in'); break;
    case 'gardirop':
      R(-w / 2, -d / 2, w, d);
      el('path', { d: `M${f(-w / 2)} ${f(-d / 2)} L${f(w / 2)} ${f(d / 2)} M${f(-w / 2)} ${f(d / 2)} L${f(w / 2)} ${f(-d / 2)}`, class: 'pv-f-l' }, gg);
      break;
    case 'sehpa': R(-w / 2, -d / 2, w, d, '', 0.06); break;
    case 'hali': R(-w / 2, -d / 2, w, d, 'pv-f-rug', 0.02); break;
    case 'tv_unite': R(-w / 2, -d / 2, w, d); R(-w * 0.35, -d / 2 + 0.02, w * 0.7, 0.06, 'pv-f-dk'); break;
    case 'yemek_masasi': {
      R(-w / 2, -d / 2, w, d, '', 0.04);
      for (const c of chairSpots(m, w, d)) R(c[0] - 0.22, c[1] - 0.22, 0.44, 0.44, 'pv-f-in', 0.06);
      break;
    }
    case 'calisma_masasi': R(-w / 2, -d / 2, w, d); R(-0.22, d / 2 + 0.05, 0.44, 0.42, 'pv-f-in', 0.2); break;
    case 'buzdolabi': R(-w / 2, -d / 2, w, d); el('path', { d: `M${f(-w / 2)} ${f(-d / 2)} L${f(w / 2)} ${f(d / 2)}`, class: 'pv-f-l' }, gg); break;
    case 'lavabo': R(-w / 2, -d / 2, w, d); el('ellipse', { cx: 0, cy: 0.04, rx: f(Math.min(0.22, w * 0.3)), ry: 0.14, class: 'pv-f-in' }, gg); break;
    case 'klozet': R(-0.19, -d / 2, 0.38, 0.18); el('ellipse', { cx: 0, cy: f(-d / 2 + 0.4), rx: 0.18, ry: 0.23, class: 'pv-f-in' }, gg); break;
    case 'dus':
      R(-w / 2, -d / 2, w, d, 'pv-f-in', 0.02);
      el('path', { d: `M${f(-w / 2)} ${f(-d / 2)} L${f(w / 2)} ${f(d / 2)} M${f(-w / 2)} ${f(d / 2)} L${f(w / 2)} ${f(-d / 2)}`, class: 'pv-f-l' }, gg);
      C(0, 0, 0.06);
      break;
    case 'vestiyer': R(-w / 2, -d / 2, w, d); el('path', { d: `M${f(-w / 2)} ${f(d / 2)} L${f(w / 2)} ${f(-d / 2)}`, class: 'pv-f-l' }, gg); break;
    case 'bitki': C(0, 0, w * 0.45, 'pv-f-plant'); C(0, 0, w * 0.22, 'pv-f-in'); break;
    case 'lambader': C(0, 0, 0.18, 'pv-f-in'); break;
    case 'sarkit': break;
    case 'balkon_set': C(0, 0, 0.3); R(-0.62, -0.2, 0.36, 0.4, 'pv-f-in', 0.08); R(0.26, -0.2, 0.36, 0.4, 'pv-f-in', 0.08); break;
    case 'mutfak_L': {
      gg.setAttribute('transform', '');
      const { x0, z0, x1, z1 } = m, D = 0.62;
      el('path', { d: `M${f(x0)} ${f(z0)} H${f(x1)} V${f(z1)} H${f(x1 - D)} V${f(z0 + D)} H${f(x0)} Z`, class: '' }, gg);
      // evye ve ocak
      el('rect', { x: f(x1 - D + 0.08), y: f((z0 + z1) / 2 + 0.25), width: 0.46, height: 0.8, rx: 0.05, class: 'pv-f-in' }, gg);
      for (const [dx, dz] of [[0.14, 0.15], [0.42, 0.15], [0.14, 0.43], [0.42, 0.43]]) el('circle', { cx: f(x0 + 0.35 + dx), cy: f(z0 + dz), r: 0.09, class: 'pv-f-in' }, gg);
      break;
    }
    default: R(-w / 2, -d / 2, w, d);
  }
}
