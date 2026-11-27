// ProjeVitrin · vaziyet maketi (dış görünüş)
// Blok kütleleri veriden üretilir: zemin kat garaj + N konut katı + kırma çatı,
// cephede pencere ritmi ve balkonlar. Bloklar tıklanabilir.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/examples/jsm/environments/RoomEnvironment.js';

const FLOOR_H = 3.0;

export function createSite3D(host, site, opts = {}) {
  const mobile = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'pv-gl';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = new THREE.Color(opts.background || '#e9e4da');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 90, 190);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);
  scene.add(new THREE.HemisphereLight('#fff8ee', '#cfc5b4', 0.7));
  const sun = new THREE.DirectionalLight('#ffe4bd', 3.4);
  sun.position.set(-40, 55, 45); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 45, bottom: -45, near: 10, far: 160 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const M = {
    siva: new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.9 }),
    gri: new THREE.MeshStandardMaterial({ color: '#7c8088', roughness: 0.85 }),
    koyu: new THREE.MeshStandardMaterial({ color: '#4c4f55', roughness: 0.8 }),
    cam: new THREE.MeshStandardMaterial({ color: '#2d3a44', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.6 }),
    ahsap: new THREE.MeshStandardMaterial({ color: '#8f7a66', roughness: 0.7 }),
    korkuluk: new THREE.MeshStandardMaterial({ color: '#9fb3ba', roughness: 0.05, transparent: true, opacity: 0.45 }),
    cati: new THREE.MeshStandardMaterial({ color: '#9b6b58', roughness: 0.85 }),
    garaj: new THREE.MeshStandardMaterial({ color: '#5c6066', roughness: 0.6, metalness: 0.3 }),
    asfalt: new THREE.MeshStandardMaterial({ color: '#8d8a86', roughness: 1 }),
    kaldirim: new THREE.MeshStandardMaterial({ color: '#d6d0c6', roughness: 1 }),
    cim: new THREE.MeshStandardMaterial({ color: '#a7b08a', roughness: 1 }),
    yaprak: new THREE.MeshStandardMaterial({ color: '#7f8f58', roughness: 0.9, flatShading: true }),
    yaprak2: new THREE.MeshStandardMaterial({ color: '#a4683f', roughness: 0.9, flatShading: true }),
    govde: new THREE.MeshStandardMaterial({ color: '#6b5a4a', roughness: 1 }),
    cizgi: new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 1 })
  };
  const add = (geo, mat, x, y, z, parent, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };

  // ---------- zemin ve sokaklar ----------
  const world = new THREE.Group(); scene.add(world);
  add(new THREE.PlaneGeometry(400, 400), M.cim, 0, -0.05, 0, world, false).rotation.x = -Math.PI / 2;
  for (const s of site.sokaklar) {
    const [ax, az] = s.a, [bx, bz] = s.b, len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    const g = new THREE.Group(); g.position.set((ax + bx) / 2, 0, (az + bz) / 2); g.rotation.y = ang; world.add(g);
    add(new THREE.BoxGeometry(len, 0.1, s.genislik), M.asfalt, 0, 0, 0, g, false);
    for (const sg of [-1, 1]) add(new THREE.BoxGeometry(len, 0.18, 1.8), M.kaldirim, 0, 0.04, sg * (s.genislik / 2 + 0.9), g, false);
    for (let x = -len / 2 + 2; x < len / 2 - 2; x += 6) add(new THREE.BoxGeometry(3, 0.02, 0.15), M.cizgi, x, 0.06, 0, g, false);
  }
  // parsel zemini
  const parsel = site.parsel;
  const shape = new THREE.Shape(parsel.map(([x, z]) => new THREE.Vector2(x, -z)));
  const pg = new THREE.ShapeGeometry(shape); pg.rotateX(-Math.PI / 2);
  add(pg, M.kaldirim, 0, 0.06, 0, world, false);

  // ---------- bloklar ----------
  const blocks = [];
  for (const b of site.bloklar) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = ((b.r || 0) * Math.PI) / 180;
    g.userData.id = b.id; world.add(g);
    const mats = [];
    for (const p of b.parcalar) buildMass(g, p, b.katlar ?? 3, mats);
    blocks.push({ id: b.id, group: g, data: b, mats });
  }

  function buildMass(g, p, floors, mats) {
    const { x, z, w, d } = p; // yerel merkez ve ölçüler
    const H = FLOOR_H * (floors + 1);
    const mass = new THREE.Group(); mass.position.set(x, 0, z); g.add(mass);
    const siva = M.siva.clone(); mats.push(siva);
    // zemin kat (garaj) biraz içeride, koyu
    add(new THREE.BoxGeometry(w - 0.3, FLOOR_H, d - 0.3), M.koyu, 0, FLOOR_H / 2, 0, mass);
    add(new THREE.BoxGeometry(w, H - FLOOR_H, d), siva, 0, FLOOR_H + (H - FLOOR_H) / 2, 0, mass);
    // kat silmeleri
    for (let f = 1; f <= floors; f++) add(new THREE.BoxGeometry(w + 0.12, 0.18, d + 0.12), siva, 0, FLOOR_H * f, 0, mass);
    // köşe gri bantlar
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(1.1, H - FLOOR_H, 1.1), M.gri, sx * (w / 2 - 0.5), FLOOR_H + (H - FLOOR_H) / 2, sz * (d / 2 - 0.5), mass);
    // cepheler
    const faces = [
      { L: w, off: d / 2, rot: 0, axis: 'x', sign: 1 },
      { L: w, off: d / 2, rot: Math.PI, axis: 'x', sign: -1 },
      { L: d, off: w / 2, rot: Math.PI / 2, axis: 'z', sign: 1 },
      { L: d, off: w / 2, rot: -Math.PI / 2, axis: 'z', sign: -1 }
    ];
    faces.forEach((fc, fi) => {
      const face = new THREE.Group(); face.rotation.y = fc.rot;
      const fwd = new THREE.Vector3(0, 0, fc.off); fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      face.position.set(0, 0, 0); mass.add(face);
      const bays = Math.max(2, Math.floor((fc.L - 2.4) / 3.4));
      const bw = (fc.L - 2.4) / bays;
      const balconyBays = new Set((p.balkon && (p.balkon[fi] || p.balkon[String(fi)])) || []);
      for (let f = 1; f <= floors; f++) {
        const y0 = FLOOR_H * f;
        for (let i = 0; i < bays; i++) {
          const cx = -fc.L / 2 + 1.2 + bw * (i + 0.5);
          if (balconyBays.has(i)) {
            const bwid = Math.min(bw * 1.6, 4.2);
            add(new THREE.BoxGeometry(bwid, 0.22, 1.25), M.siva, cx, y0 + 0.11, fc.off + 0.62, face);
            add(new THREE.BoxGeometry(bwid, 0.34, 0.08), M.ahsap, cx, y0 + 0.05, fc.off + 1.25, face);
            add(new THREE.BoxGeometry(bwid - 0.1, 0.9, 0.03), M.korkuluk, cx, y0 + 0.7, fc.off + 1.22, face, false);
            add(new THREE.BoxGeometry(bwid, 0.04, 0.06), M.koyu, cx, y0 + 1.15, fc.off + 1.22, face);
            add(new THREE.BoxGeometry(bwid * 0.8, 2.25, 0.05), M.cam, cx, y0 + 0.2 + 1.12, fc.off + 0.01, face, false);
            add(new THREE.BoxGeometry(bwid * 0.8 + 0.12, 0.08, 0.1), M.koyu, cx, y0 + 2.48, fc.off + 0.02, face);
          } else {
            const ww = Math.min(1.5, bw * 0.55);
            add(new THREE.BoxGeometry(ww, 1.45, 0.06), M.cam, cx, y0 + 0.95 + 0.72, fc.off + 0.005, face, false);
            add(new THREE.BoxGeometry(ww + 0.14, 0.06, 0.16), M.koyu, cx, y0 + 0.92, fc.off + 0.05, face);
            add(new THREE.BoxGeometry(ww + 0.14, 0.08, 0.08), M.koyu, cx, y0 + 2.43, fc.off + 0.02, face);
            add(new THREE.BoxGeometry(0.06, 1.45, 0.07), M.koyu, cx, y0 + 1.67, fc.off + 0.02, face);
          }
        }
      }
      // garaj kapıları: yalnız işaretli cephelerde
      if (p.garaj && p.garaj.includes(fi)) {
        const n = Math.max(1, Math.floor(fc.L / 4.2));
        for (let i = 0; i < n; i++) {
          const cx = -fc.L / 2 + (fc.L / n) * (i + 0.5);
          add(new THREE.BoxGeometry(2.6, 2.3, 0.05), M.garaj, cx, 1.15, fc.off - 0.12, face);
          for (let k = 1; k < 8; k++) add(new THREE.BoxGeometry(2.6, 0.015, 0.02), M.koyu, cx, k * 0.29, fc.off - 0.09, face, false);
        }
      }
    });
    // kırma çatı
    const roof = hipRoof(w + 1.0, d + 1.0, Math.min(w, d) * 0.22);
    add(roof, M.cati, 0, H + 0.05, 0, mass);
    add(new THREE.BoxGeometry(w + 1.0, 0.18, d + 1.0), M.siva, 0, H, 0, mass);
  }

  function hipRoof(w, d, h) {
    const r = Math.min(w, d) / 2;
    const a = [-w / 2, 0, -d / 2], b = [w / 2, 0, -d / 2], c = [w / 2, 0, d / 2], e = [-w / 2, 0, d / 2];
    const rx = w / 2 - r, rz = d / 2 - r;
    const p1 = w >= d ? [-rx, h, 0] : [0, h, -rz], p2 = w >= d ? [rx, h, 0] : [0, h, rz];
    const tris = w >= d
      ? [[a, p1, p2], [a, p2, b], [b, p2, c], [c, p2, p1], [c, p1, e], [e, p1, a]]
      : [[a, p1, b], [b, p1, p2], [b, p2, c], [c, p2, e], [e, p2, p1], [e, p1, a]];
    const pos = [];
    for (const t of tris) for (const v of t) pos.push(...v);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    // yüzlerin dışa baktığından emin ol
    const n = g.attributes.normal; let flip = false; if (n.getY(0) < 0) flip = true;
    if (flip) { const idx = []; for (let i = 0; i < pos.length / 3; i += 3) idx.push(i, i + 2, i + 1); g.setIndex(idx); g.computeVertexNormals(); }
    return g;
  }

  // ---------- ağaçlar ----------
  const rnd = mulberry(7);
  for (const [tx, tz, kind] of site.agaclar || []) {
    const t = new THREE.Group(); t.position.set(tx, 0, tz); world.add(t);
    const s = 0.8 + rnd() * 0.5;
    add(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 2.2 * s, 6), M.govde, 0, 1.1 * s, 0, t);
    for (let i = 0; i < 4; i++) add(new THREE.IcosahedronGeometry((1.1 + rnd() * 0.5) * s, 0), kind === 'k' ? M.yaprak2 : M.yaprak, (rnd() - 0.5) * 1.2 * s, (2.6 + rnd() * 1.2) * s, (rnd() - 0.5) * 1.2 * s, t);
  }

  // ---------- kamera ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.target.set(...site.hedef);
  controls.minDistance = 35; controls.maxDistance = 150; controls.maxPolarAngle = Math.PI * 0.44; controls.minPolarAngle = Math.PI * 0.12;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; controls.autoRotateSpeed = 0.35;
  controls.enableZoom = opts.zoom !== false;
  camera.position.set(...site.kamera);
  let dirty = true; controls.addEventListener('change', () => { dirty = true; });
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; });

  // ---------- etkileşim ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let hover = null, down = null;
  const dom = renderer.domElement;
  function pick(e) {
    const r = dom.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(blocks.map(b => b.group), true);
    if (!hits.length) return null;
    let o = hits[0].object; while (o && !o.userData.id) o = o.parent; return o ? o.userData.id : null;
  }
  function setHover(id) {
    if (hover === id) return; hover = id;
    for (const b of blocks) for (const m of b.mats) m.color.set(b.id === id ? '#fff1c9' : '#f4f2ee');
    dom.style.cursor = id ? 'pointer' : 'grab'; dirty = true; opts.onHover && opts.onHover(id);
  }
  dom.addEventListener('pointermove', e => { if (!down) setHover(pick(e)); });
  dom.addEventListener('pointerleave', () => setHover(null));
  dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  dom.addEventListener('pointerup', e => {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5; down = null;
    if (!moved) { const id = pick(e); if (id && opts.onBlock) opts.onBlock(id); }
  });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.9 ? 52 : 30;
    // Metin solda (masaüstü) / altta (telefon) olduğu için kütleyi ekranda kaydır; dönüş merkezi değişmez.
    if (opts.shift !== false) { if (w / h > 1.1) camera.setViewOffset(w, h, -w * 0.24, 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.2, w, h); }
    camera.updateProjectionMatrix(); dirty = true;
  }
  new ResizeObserver(resize).observe(host); resize();
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  const tmp = new THREE.Vector3();
  function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    controls.update();
    if (!dirty && !controls.autoRotate) return;
    dirty = false;
    renderer.render(scene, camera);
    opts.onFrame && opts.onFrame();
  }
  requestAnimationFrame(loop);

  function project(x, y, z) {
    tmp.set(x, y, z).project(camera); const r = dom.getBoundingClientRect();
    return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height, behind: tmp.z > 1 };
  }
  function blockTop(id) {
    const b = blocks.find(q => q.id === id); const box = new THREE.Box3().setFromObject(b.group); const c = box.getCenter(new THREE.Vector3()); return [c.x, box.max.y + 2, c.z];
  }
  return { project, blockTop, setHover, controls, invalidate() { dirty = true; } };
}

function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
