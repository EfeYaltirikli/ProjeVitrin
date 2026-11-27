// ProjeVitrin · ortak geometri
// Daire verisinden (odalar, duvarlar, açıklıklar) hem 2D kroki hem 3D model için
// aynı türetilmiş yapıyı üretir. Koordinatlar plan metresi: x sağa, z aşağı (güneye).

export function bbox(poly) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return { x0, z0, x1, z1, w: x1 - x0, d: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

export function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const [a, b] = poly[i], [c, d] = poly[(i + 1) % poly.length]; s += a * d - c * b; }
  return Math.abs(s) / 2;
}

export function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function roomAt(data, x, z) {
  return data.odalar.find(r => pointInPoly(x, z, r.poly)) || null;
}

// Duvarı açıklıklara göre parçalara böler. Her duvar için:
// { a, b, t, tip, len, dir:[ux,uz], n:[nx,nz], spans:[{s0,s1,kind,opening}] }
// kind: 'dolu' | açıklık tipi. s mesafesi duvar başından.
export function buildWalls(data) {
  const ops = data.acikliklar.map((o, i) => ({ ...o, i }));
  const used = new Set();
  const walls = data.duvarlar.map((w, wi) => {
    const [ax, az] = w.a, [bx, bz] = w.b;
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const nx = -uz, nz = ux;
    const mine = [];
    for (const o of ops) {
      if (used.has(o.i)) continue;
      const pa = proj(o.a), pb = proj(o.b);
      const tol = (w.t || 0.2) / 2 + 0.02;
      if (Math.abs(pa.off) < tol && Math.abs(pb.off) < tol && Math.min(pa.s, pb.s) > -0.01 && Math.max(pa.s, pb.s) < len + 0.01) {
        mine.push({ s0: Math.min(pa.s, pb.s), s1: Math.max(pa.s, pb.s), kind: o.tip, opening: o, hingeAtB: (pb.s > pa.s) !== (o.mente === 'a') });
        used.add(o.i);
      }
    }
    function proj([x, z]) { const dx = x - ax, dz = z - az; return { s: dx * ux + dz * uz, off: dx * nx + dz * nz }; }
    mine.sort((p, q) => p.s0 - q.s0);
    const spans = [];
    let s = 0;
    for (const m of mine) { if (m.s0 > s + 1e-4) spans.push({ s0: s, s1: m.s0, kind: 'dolu' }); spans.push(m); s = m.s1; }
    if (s < len - 1e-4) spans.push({ s0: s, s1: len, kind: 'dolu' });
    // Kapı kanadının açıldığı taraf: yon = oda id (yoksa oda olan taraf).
    for (const sp of spans) {
      if (sp.kind !== 'kapi' && sp.kind !== 'celik_kapi') continue;
      const sm = (sp.s0 + sp.s1) / 2, off = (w.t || 0.2) / 2 + 0.3;
      const side = sg => roomAt(data, ax + ux * sm + nx * off * sg, az + uz * sm + nz * off * sg);
      const rp = side(1), rn = side(-1), want = sp.opening.yon;
      sp.side = want ? (rp && rp.id === want ? 1 : rn && rn.id === want ? -1 : (rp ? 1 : -1)) : (rp ? 1 : -1);
    }
    return { id: wi, a: w.a, b: w.b, t: w.t || 0.2, tip: w.tip || 'duvar', len, dir: [ux, uz], n: [nx, nz], spans };
  });
  const orphans = ops.filter(o => !used.has(o.i));
  if (orphans.length) console.warn('Duvara oturmayan açıklıklar:', orphans);
  return walls;
}

// Kapı ve geçitlerin iki yanındaki odaları bulur → oda komşuluğu.
export function doorLinks(data, walls) {
  const links = [];
  for (const w of walls) for (const sp of w.spans) {
    if (!['kapi', 'gecit', 'balkon_kapi', 'celik_kapi'].includes(sp.kind)) continue;
    const sm = (sp.s0 + sp.s1) / 2;
    const cx = w.a[0] + w.dir[0] * sm, cz = w.a[1] + w.dir[1] * sm;
    const off = w.t / 2 + 0.25;
    const r1 = roomAt(data, cx + w.n[0] * off, cz + w.n[1] * off);
    const r2 = roomAt(data, cx - w.n[0] * off, cz - w.n[1] * off);
    links.push({ x: cx, z: cz, wall: w, span: sp, a: r1 && r1.id, b: r2 && r2.id });
  }
  // Duvarsız bitişik odalar (hol ↔ antre gibi): kenar paylaşan ve arada duvar olmayan odalar.
  const rs = data.odalar;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const A = bbox(rs[i].poly), B = bbox(rs[j].poly);
    const touchZ = Math.abs(A.z1 - B.z0) < 0.02 || Math.abs(B.z1 - A.z0) < 0.02;
    const ovX = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
    if (touchZ && ovX > 0.6) {
      const z = Math.abs(A.z1 - B.z0) < 0.02 ? A.z1 : A.z0;
      const x = (Math.max(A.x0, B.x0) + Math.min(A.x1, B.x1)) / 2;
      links.push({ x, z, open: true, a: rs[i].id, b: rs[j].id });
    }
  }
  return links.filter(l => l.a && l.b && l.a !== l.b);
}

export function unitBounds(data) {
  const pts = [];
  data.duvarlar.forEach(w => { pts.push(w.a, w.b); });
  return bbox(pts);
}

export const ODA_RENK = {
  salon: '#e9dcc6', mutfak: '#e3e6e3', yatak: '#efe3cf', hol: '#e6e3de', islak: '#dde6ea', balkon: '#e4e2da'
};

// Mobilya varsayılan ölçüleri (m): w = yerel x, d = yerel z, h = yükseklik.
// Yön kuralı: yerel +z "ön"dür (kanepenin oturma yönü, yatağın ayak ucu, dolabın kapakları).
// r derece, Y ekseni etrafında; dünya = (x + lx·cos r + lz·sin r, z − lx·sin r + lz·cos r).
export const FURN_DEF = {
  kanepe: { w: 2.2, d: 0.9, h: 0.82 }, koltuk: { w: 0.85, d: 0.85, h: 0.8 },
  sehpa: { w: 1.1, d: 0.6, h: 0.4 }, hali: { w: 2, d: 1.5, h: 0.012 },
  tv_unite: { w: 1.8, d: 0.45, h: 0.45 }, yemek_masasi: { w: 1.8, d: 0.9, h: 0.75 },
  sarkit: { w: 0.5, d: 0.5, h: 0.3 }, lambader: { w: 0.4, d: 0.4, h: 1.6 }, bitki: { w: 0.5, d: 0.5, h: 1.2 },
  buzdolabi: { w: 0.66, d: 0.66, h: 1.9 }, yatak: { w: 1.6, d: 2.05, h: 0.5 }, komodin: { w: 0.45, d: 0.4, h: 0.5 },
  gardirop: { w: 2, d: 0.6, h: 2.4 }, calisma_masasi: { w: 1.2, d: 0.55, h: 0.75 },
  lavabo: { w: 0.8, d: 0.48, h: 0.85 }, klozet: { w: 0.38, d: 0.62, h: 0.8 }, dus: { w: 1.2, d: 1, h: 2.0 },
  vestiyer: { w: 1, d: 0.38, h: 2.2 }, balkon_set: { w: 1.3, d: 0.7, h: 0.75 }
};
export function furnSize(m) {
  const d = FURN_DEF[m.tip] || { w: 0.5, d: 0.5, h: 0.5 };
  const s = m.s || 1;
  return { w: m.w ?? d.w * (m.tip === 'bitki' ? s : 1), d: m.d ?? d.d * (m.tip === 'bitki' ? s : 1), h: (m.h ?? d.h) * (m.tip === 'bitki' ? s : 1) };
}
export function toWorld(m, lx, lz) {
  const t = ((m.r || 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return [m.x + lx * c + lz * s, m.z - lx * s + lz * c];
}

// Masa sandalyeleri: yerel koordinatta [x, z, dönüş°]
export function chairSpots(m, w, d) {
  const s = m.sandalye || {};
  const spec = typeof s === 'number' ? { n: Math.floor(s / 2) - (s >= 6 ? 1 : 0), s: Math.floor(s / 2) - (s >= 6 ? 1 : 0), w: s >= 6 ? 1 : 0, e: s >= 6 ? 1 : 0 } : s;
  const out = [];
  const row = (n, z, rot) => { for (let i = 0; i < n; i++) out.push([(-w / 2) + (w / (n)) * (i + 0.5), z, rot]); };
  row(spec.n || 0, -d / 2 - 0.12, 0);
  row(spec.s || 0, d / 2 + 0.12, 180);
  for (let i = 0; i < (spec.w || 0); i++) out.push([-w / 2 - 0.12, 0, 90]);
  for (let i = 0; i < (spec.e || 0); i++) out.push([w / 2 + 0.12, 0, 270]);
  return out;
}
