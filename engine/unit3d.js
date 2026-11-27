// ProjeVitrin · 3D daire görüntüleyici (three.js)
// Modlar: 'ust' (kesit kroki, yukarıdan), 'maket' (tavansız, döndürülebilir), 'ic' (göz hizasında oda içi).
// Her şey daire verisinden üretilir; yeni bir daire için yalnız JSON değişir.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from '../vendor/three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from '../vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from '../vendor/three/examples/jsm/postprocessing/OutputPass.js';
import { buildWalls, bbox, unitBounds, furnSize, doorLinks, roomAt, chairSpots } from './geom.js';

const EYE = 1.58;
const DOOR_H = 2.1, WIN_TOP = 2.3;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function createUnit3D(host, data, opts = {}) {
  const texBase = opts.texBase || 'tex/';
  const H = data.duvar_yuksekligi || 2.75;
  const B = unitBounds(data);
  const C = new THREE.Vector3(B.cx, 0, B.cz);
  const mobile = matchMedia('(max-width: 760px)').matches || /Mobi/i.test(navigator.userAgent);

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.className = 'pv-gl';

  const scene = new THREE.Scene();
  const BG = new THREE.Color(opts.background || '#ece6dc');
  scene.background = BG;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
  // Pencereden görünen gökyüzü (equirect gradyan)
  const SKY = (() => {
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 256; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#9fc0d9'); g.addColorStop(0.45, '#dde8ee'); g.addColorStop(0.5, '#efe9dc'); g.addColorStop(0.52, '#b9b8a4'); g.addColorStop(1, '#8f9277');
    x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  // ---------- ışık ----------
  const hemi = new THREE.HemisphereLight('#fff7ea', '#d8cdbd', 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe6c4', 3.2);
  sun.position.set(C.x - 9, 11, C.z + 13);
  sun.target.position.copy(C);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 45;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // ---------- malzemeler ----------
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const texCache = {};
  function tex(name, kind) {
    const key = name + kind;
    if (texCache[key]) return texCache[key];
    const t = loader.load(`${texBase}${name}_${kind}.jpg`, () => { dirty = true; });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso;
    if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace;
    return (texCache[key] = t);
  }
  const pbr = (name, o = {}) => new THREE.MeshStandardMaterial({
    map: tex(name, 'diff'), normalMap: tex(name, 'nor_gl'), roughnessMap: tex(name, 'rough'),
    normalScale: new THREE.Vector2(o.ns ?? 0.6, o.ns ?? 0.6), roughness: o.r ?? 1, color: o.c || '#ffffff', envMapIntensity: o.env ?? 1
  });
  // Porselen karo: kodla üretilir (60×120 vb.), ince derz, hafif bulut desen.
  function porselen({ tw = 0.6, td = 1.2, renk = '#e8e3dc', derz = '#cfc8be', alan = 2.4, ton = 0.035 }) {
    const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d');
    x.fillStyle = renk; x.fillRect(0, 0, N, N);
    const rnd = mulberry(Math.round(tw * 1000 + td * 7));
    const px = N / alan;
    for (let i = 0; i < 900; i++) { // bulut
      const r = (20 + rnd() * 120); x.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '120,110,100'},${ton * rnd()})`;
      x.beginPath(); x.arc(rnd() * N, rnd() * N, r, 0, 7); x.fill();
    }
    x.strokeStyle = derz; x.lineWidth = Math.max(1.5, px * 0.003);
    for (let u = 0; u <= alan + 1e-6; u += tw) { x.beginPath(); x.moveTo(u * px, 0); x.lineTo(u * px, N); x.stroke(); }
    for (let v = 0; v <= alan + 1e-6; v += td) { x.beginPath(); x.moveTo(0, v * px); x.lineTo(N, v * px); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.32, envMapIntensity: 1.1 });
  }
  const M = {
    parke: pbr('laminate_floor_02', { c: '#f4ece2', r: 0.9 }),
    seramik: porselen({ tw: 0.6, td: 1.2, renk: '#e9e5df', derz: '#d3ccc2' }),
    islak: porselen({ tw: 0.6, td: 0.6, renk: '#dcdad6', derz: '#c4c0ba', alan: 2.4, ton: 0.05 }),
    balkon: pbr('large_floor_tiles_02', { c: '#e2ddd5', r: 1 }),
    fayans: pbr('long_white_tiles', { c: '#ffffff', r: 0.5, env: 1.2, ns: 0.4 }),
    ahsap: pbr('kitchen_wood', { c: '#e9d8c2', r: 0.85, ns: 0.3 }),
    boya: new THREE.MeshStandardMaterial({ color: '#f1ede6', roughness: 0.92 }),
    vurguBoya: new THREE.MeshStandardMaterial({ color: '#d9cfc1', roughness: 0.92 }),
    kesit: new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 0.8 }),
    tavan: new THREE.MeshStandardMaterial({ color: '#f7f5f1', roughness: 0.95, side: THREE.BackSide, shadowSide: THREE.DoubleSide }),
    supurgelik: new THREE.MeshStandardMaterial({ color: '#f6f4ef', roughness: 0.5 }),
    beyazLake: new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: 0.35 }),
    antrasit: new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.45, metalness: 0.4 }),
    siyahMetal: new THREE.MeshStandardMaterial({ color: '#1e1f21', roughness: 0.4, metalness: 0.7 }),
    krom: new THREE.MeshStandardMaterial({ color: '#d9dcdf', roughness: 0.15, metalness: 1 }),
    porselen: new THREE.MeshStandardMaterial({ color: '#fbfbf9', roughness: 0.12 }),
    cam: new THREE.MeshPhysicalMaterial({ color: '#cfe0e4', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 1.6, depthWrite: false }),
    tezgah: new THREE.MeshStandardMaterial({ color: '#e6e2db', roughness: 0.28 }),
    kapi: new THREE.MeshStandardMaterial({ color: '#efebe4', roughness: 0.55 }),
    celik: new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.5, metalness: 0.3 }),
    beton: new THREE.MeshStandardMaterial({ color: '#bdb6ab', roughness: 1 }),
    zemin: new THREE.MeshStandardMaterial({ color: '#d9d2c6', roughness: 1 }),
    ekran: new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.18, metalness: 0.2 }),
    yaprak: new THREE.MeshStandardMaterial({ color: '#4e6a3c', roughness: 0.8, side: THREE.DoubleSide }),
    saksi: new THREE.MeshStandardMaterial({ color: '#cbbfae', roughness: 0.9 }),
    nevresim: new THREE.MeshPhysicalMaterial({ color: '#f4f1ec', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.6 }),
    abajur: new THREE.MeshStandardMaterial({ color: '#fff4e2', roughness: 0.9, emissive: '#ffd9a0', emissiveIntensity: 0.0 })
  };
  const fabricCache = {};
  const kumas = hex => fabricCache[hex] || (fabricCache[hex] = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.95, sheen: 0.8, sheenColor: new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.4), sheenRoughness: 0.7 }));
  const hali = hex => new THREE.MeshStandardMaterial({ color: hex, roughness: 1 });
  const ZEMIN = { parke: [M.parke, 2.0], seramik: [M.seramik, 2.4], islak: [M.islak, 2.4], balkon: [M.balkon, 2.0] };

  const root = new THREE.Group(); scene.add(root);
  const gFloors = new THREE.Group(), gWalls = new THREE.Group(), gCeil = new THREE.Group(), gFurn = new THREE.Group(), gCtx = new THREE.Group();
  root.add(gFloors, gWalls, gCeil, gFurn, gCtx);

  const shadowAll = o => o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

  // ---------- zemin, tavan, bağlam ----------
  const floorMeshes = [];
  function flatShape(poly, y, mat, tile, down = false) {
    const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2); // yukarı bakar; tavan malzemesi BackSide olduğu için alttan görünür
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
    const m = new THREE.Mesh(g, mat); m.position.y = y; return m;
  }
  for (const r of data.odalar) {
    const [mat, tile] = ZEMIN[r.zemin] || [M.seramik, 1.2];
    const fl = flatShape(r.poly, 0.002, mat.clone(), tile);
    fl.receiveShadow = true; fl.userData.room = r.id; fl.material.emissive = new THREE.Color('#fab209'); fl.material.emissiveIntensity = 0;
    gFloors.add(fl); floorMeshes.push(fl);
    if (r.tur !== 'balkon') {
      const ce = flatShape(r.poly, H, M.tavan, 1, true);
      ce.castShadow = true; ce.receiveShadow = true; gCeil.add(ce);
    }
  }
  // döşeme plağı (duvar altları) ve çekirdek
  const slab = new THREE.Mesh(new THREE.BoxGeometry(B.w + 0.4, 0.3, B.d + 0.4), M.beton);
  slab.position.set(B.cx, -0.152, B.cz); slab.receiveShadow = true; gCtx.add(slab);
  if (data.cekirdek) {
    const cb = bbox(data.cekirdek.poly);
    const core = new THREE.Mesh(new THREE.BoxGeometry(cb.w, 0.02, cb.d), new THREE.MeshStandardMaterial({ color: '#d4cdc2', roughness: 1 }));
    core.position.set(cb.cx, 0.01, cb.cz); core.receiveShadow = true; gCtx.add(core);
    // merdiven basamakları
    for (let i = 0; i < 9; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17 * (i + 1), cb.d * 0.44), M.beton);
      st.position.set(cb.x0 + 0.35 + i * 0.27, 0.085 * (i + 1), cb.z0 + cb.d * 0.26); shadowAll(st); gCtx.add(st);
    }
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(B.cx, -0.3, B.cz); ground.receiveShadow = true; gCtx.add(ground);

  // ---------- duvarlar ----------
  const walls = buildWalls(data);
  const capMats = mat => [mat, mat, M.kesit, mat, mat, mat];
  function wallBox(w, s0, s1, y0, y1, mat = M.boya, t = w.t) {
    const L = s1 - s0; if (L <= 0.001 || y1 - y0 <= 0.001) return null;
    const g = new THREE.BoxGeometry(L, y1 - y0, t);
    const m = new THREE.Mesh(g, Array.isArray(mat) ? mat : capMats(mat));
    const sm = (s0 + s1) / 2;
    m.position.set(w.a[0] + w.dir[0] * sm, (y0 + y1) / 2, w.a[1] + w.dir[1] * sm);
    m.rotation.y = Math.atan2(-w.dir[1], w.dir[0]);
    m.castShadow = true; m.receiveShadow = true; gWalls.add(m); return m;
  }
  const P = (w, s, o) => [w.a[0] + w.dir[0] * s + w.n[0] * o, w.a[1] + w.dir[1] * s + w.n[1] * o];
  // Yüzey kaplaması: ıslak hacimde fayans, diğer odalarda süpürgelik.
  function cladding(w, s0, s1, yFrom, yTo) {
    for (const sg of [1, -1]) {
      const mid = P(w, (s0 + s1) / 2, sg * (w.t / 2 + 0.15));
      const r = roomAt(data, mid[0], mid[1]); if (!r) continue;
      const wet = r.tur === 'islak';
      const L = s1 - s0, yA = wet ? yFrom : 0, yB = wet ? Math.min(yTo, 2.4) : Math.min(0.08, yTo);
      if (yB <= yA || L < 0.05) continue;
      const g = new THREE.BoxGeometry(L, yB - yA, wet ? 0.008 : 0.012);
      if (wet) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / 0.9, uv.getY(i) * (yB - yA) / 0.9); }
      const m = new THREE.Mesh(g, wet ? M.fayans : M.supurgelik);
      const c = P(w, (s0 + s1) / 2, sg * (w.t / 2 + (wet ? 0.004 : 0.006)));
      m.position.set(c[0], (yA + yB) / 2, c[1]); m.rotation.y = Math.atan2(-w.dir[1], w.dir[0]);
      m.receiveShadow = true; gWalls.add(m);
    }
  }
  const doorLeaves = [];
  for (const w of walls) {
    if (w.tip === 'korkuluk') {
      for (const sp of w.spans) {
        const L = sp.s1 - sp.s0; const sm = (sp.s0 + sp.s1) / 2; const c = P(w, sm, 0); const ry = Math.atan2(-w.dir[1], w.dir[0]);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(L, 0.95, 0.012), M.cam); glass.position.set(c[0], 0.55, c[1]); glass.rotation.y = ry; gWalls.add(glass);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.05, 0.06), M.antrasit); rail.position.set(c[0], 1.05, c[1]); rail.rotation.y = ry; shadowAll(rail); gWalls.add(rail);
        const curb = new THREE.Mesh(new THREE.BoxGeometry(L, 0.08, 0.14), M.beton); curb.position.set(c[0], 0.04, c[1]); curb.rotation.y = ry; shadowAll(curb); gWalls.add(curb);
      }
      continue;
    }
    const ext = w.t / 2;
    for (const sp of w.spans) {
      const s0 = sp.s0 - (sp.s0 < 1e-3 ? ext : 0), s1 = sp.s1 + (sp.s1 > w.len - 1e-3 ? ext : 0);
      const ry = Math.atan2(-w.dir[1], w.dir[0]);
      if (sp.kind === 'dolu') { wallBox(w, s0, s1, 0, H); cladding(w, sp.s0, sp.s1, 0, H); continue; }
      const k = sp.kind, op = sp.opening;
      const top = k === 'pencere' || k === 'balkon_kapi' ? WIN_TOP : k === 'gecit' ? 2.3 : DOOR_H + 0.05;
      wallBox(w, sp.s0, sp.s1, top, H);
      cladding(w, sp.s0, sp.s1, top, H);
      const L = sp.s1 - sp.s0, sm = (sp.s0 + sp.s1) / 2, c = P(w, sm, 0);
      if (k === 'pencere') {
        const sill = op.esik ?? 0.9;
        wallBox(w, sp.s0, sp.s1, 0, sill);
        cladding(w, sp.s0, sp.s1, 0, sill);
        const hgt = top - sill;
        // denizlik
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(L + 0.06, 0.03, w.t + 0.06), M.tezgah);
        ledge.position.set(c[0], sill + 0.015, c[1]); ledge.rotation.y = ry; shadowAll(ledge); gWalls.add(ledge);
        frame(w, sm, L, sill, hgt, ry, Math.max(1, Math.round(L / 0.8)));
      } else if (k === 'balkon_kapi') {
        frame(w, sm, L, 0, top, ry, 2);
      } else if (k === 'kapi' || k === 'celik_kapi') {
        // kasa
        const casing = M.kapi;
        for (const e of [sp.s0, sp.s1]) {
          const q = P(w, e, 0); const j = new THREE.Mesh(new THREE.BoxGeometry(0.05, DOOR_H + 0.05, w.t + 0.03), casing);
          j.position.set(q[0], (DOOR_H + 0.05) / 2, q[1]); j.rotation.y = ry; shadowAll(j); gWalls.add(j);
        }
        const hd = new THREE.Mesh(new THREE.BoxGeometry(L + 0.05, 0.05, w.t + 0.03), casing); hd.position.set(c[0], DOOR_H + 0.025, c[1]); hd.rotation.y = ry; gWalls.add(hd);
        // kanat (90° açık)
        const sgn = sp.side || 1;
        const hingeS = sp.hingeAtB ? sp.s1 - 0.03 : sp.s0 + 0.03;
        const hp = P(w, hingeS, sgn * (w.t / 2));
        const leafW = L - 0.06;
        const leaf = new THREE.Group();
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, DOOR_H - 0.02, leafW), k === 'celik_kapi' ? M.celik : M.kapi);
        panel.position.set(0, (DOOR_H - 0.02) / 2, leafW / 2); leaf.add(panel);
        const knob = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), M.krom); knob.position.set(0.05, 1.02, leafW - 0.08); leaf.add(knob);
        const knob2 = knob.clone(); knob2.position.x = -0.05; leaf.add(knob2);
        shadowAll(leaf);
        if (op.kapali) { // kapalı kanat: duvar düzleminde, menteşeden serbest uca
          const hq = P(w, hingeS, 0), vs = sp.hingeAtB ? -1 : 1;
          leaf.position.set(hq[0], 0, hq[1]); leaf.rotation.y = Math.atan2(w.dir[0] * vs, w.dir[1] * vs);
        } else {
          leaf.position.set(hp[0], 0, hp[1]);
          // yaprak yerel +z → duvar normali yönünde (sgn) açılır
          leaf.rotation.y = Math.atan2(w.n[0] * sgn, w.n[1] * sgn);
        }
        // menteşeyi duvar yönünde kaydır ki kanat kasanın içinde dursun
        gWalls.add(leaf); doorLeaves.push(leaf);
      }
    }
  }
  function frame(w, sm, L, y0, hgt, ry, panes) {
    const c = P(w, sm, 0);
    const fr = new THREE.Group(); fr.position.set(c[0], y0, c[1]); fr.rotation.y = ry;
    const ft = 0.06, fd = 0.08;
    const add = (x, y, wd, ht) => { const m = new THREE.Mesh(new THREE.BoxGeometry(wd, ht, fd), M.antrasit); m.position.set(x, y, 0); m.castShadow = true; fr.add(m); };
    add(0, ft / 2, L, ft); add(0, hgt - ft / 2, L, ft); add(-L / 2 + ft / 2, hgt / 2, ft, hgt); add(L / 2 - ft / 2, hgt / 2, ft, hgt);
    for (let i = 1; i < panes; i++) add(-L / 2 + (L / panes) * i, hgt / 2, 0.05, hgt);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(L - ft, hgt - ft), M.cam); g.position.set(0, hgt / 2, 0); fr.add(g);
    gWalls.add(fr);
  }

  // ---------- mobilya ----------
  const RB = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  const mesh = (g, m, x = 0, y = 0, z = 0, parent) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (parent) parent.add(o); return o; };
  const pendantLights = [];
  function chair(g, x, z, rot) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = rot * Math.PI / 180;
    mesh(RB(0.44, 0.06, 0.44, 0.02), M.ahsap, 0, 0.46, 0, c);
    mesh(RB(0.44, 0.42, 0.04, 0.015), M.ahsap, 0, 0.7, -0.2, c);
    for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.44, 8), M.siyahMetal, lx, 0.22, lz, c);
    g.add(c);
  }
  function plant(g, s = 1) {
    mesh(new THREE.CylinderGeometry(0.17 * s, 0.13 * s, 0.32 * s, 20), M.saksi, 0, 0.16 * s, 0, g);
    const rnd = mulberry(Math.round(s * 1000));
    for (let i = 0; i < 16; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 8, 6), M.yaprak);
      leaf.scale.set(1, 0.32, 0.55);
      const a = rnd() * Math.PI * 2, hgt = (0.45 + rnd() * 0.65) * s, rad = (0.05 + rnd() * 0.2) * s;
      leaf.position.set(Math.cos(a) * rad, hgt, Math.sin(a) * rad); leaf.rotation.set(rnd() * 0.8, a, rnd() * 0.6 - 0.3); leaf.castShadow = true; g.add(leaf);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, hgt - 0.3 * s, 4), M.yaprak); stem.position.set(Math.cos(a) * rad / 2, (hgt + 0.3 * s) / 2, Math.sin(a) * rad / 2); g.add(stem);
    }
  }
  function build(m) {
    const g = new THREE.Group();
    const { w, d, h } = furnSize(m);
    switch (m.tip) {
      case 'kanepe': {
        const fab = kumas(m.renk || '#b9b2a6');
        mesh(RB(w, 0.2, d, 0.04), fab, 0, 0.17, 0, g);
        mesh(RB(w, 0.46, 0.2, 0.06, 3), fab, 0, 0.5, -d / 2 + 0.1, g);
        for (const sx of [-1, 1]) mesh(RB(0.16, 0.36, d, 0.05, 3), fab, sx * (w / 2 - 0.08), 0.45, 0, g);
        const n = Math.max(2, Math.round((w - 0.32) / 0.75)), cw = (w - 0.32) / n;
        for (let i = 0; i < n; i++) {
          mesh(RB(cw - 0.02, 0.16, d - 0.26, 0.06, 3), fab, -w / 2 + 0.16 + cw * (i + 0.5), 0.35, 0.08, g);
          mesh(RB(cw - 0.06, 0.38, 0.14, 0.06, 3), fab, -w / 2 + 0.16 + cw * (i + 0.5), 0.6, -d / 2 + 0.25, g).rotation.x = -0.18;
        }
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.07, 8), M.siyahMetal, sx * (w / 2 - 0.08), 0.035, sz * (d / 2 - 0.08), g);
        // dekoratif kırlent
        mesh(RB(0.42, 0.4, 0.12, 0.06, 3), kumas('#8d7b62'), -w / 2 + 0.45, 0.66, -d / 2 + 0.36, g).rotation.set(-0.2, 0.25, 0.1);
        break;
      }
      case 'sehpa':
        mesh(RB(w, 0.04, d, 0.02), M.ahsap, 0, 0.38, 0, g);
        mesh(RB(w - 0.1, 0.02, d - 0.1, 0.01), M.ahsap, 0, 0.12, 0, g);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.BoxGeometry(0.03, 0.38, 0.03), M.siyahMetal, sx * (w / 2 - 0.05), 0.19, sz * (d / 2 - 0.05), g);
        mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 20), M.porselen, 0.25, 0.46, 0, g);
        mesh(RB(0.28, 0.04, 0.2, 0.01), kumas('#5f6b73'), -0.2, 0.42, 0.05, g);
        break;
      case 'hali': {
        const r = mesh(RB(w, 0.012, d, 0.005, 1), hali(m.renk || '#d9d0c1'), 0, 0.008, 0, g); r.castShadow = false;
        break;
      }
      case 'tv_unite': {
        mesh(RB(w, 0.42, d, 0.01), M.ahsap, 0, 0.27, 0, g);
        for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(w / 3 - 0.02, 0.36, 0.01), M.beyazLake, -w / 3 + i * w / 3, 0.27, d / 2 + 0.004, g);
        mesh(new THREE.BoxGeometry(1.45, 0.84, 0.03), M.ekran, 0, 0.48 + 0.07 + 0.42 + 0.42, -d / 2 + 0.08, g);
        mesh(new THREE.BoxGeometry(0.3, 0.02, 0.18), M.siyahMetal, 0, 0.49, -d / 2 + 0.12, g);
        mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), M.siyahMetal, 0, 0.55, -d / 2 + 0.1, g);
        break;
      }
      case 'yemek_masasi': {
        mesh(RB(w, 0.04, d, 0.015), M.ahsap, 0, 0.74, 0, g);
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), M.siyahMetal, sx * (w / 2 - 0.08), 0.36, sz * (d / 2 - 0.08), g);
        for (const [cx, cz, cr] of chairSpots(m, w, d)) chair(g, cx * 1.0, cz + Math.sign(cz) * 0.05, cr);
        // masa üstü
        mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.06, 24), M.porselen, 0, 0.79, 0, g);
        break;
      }
      case 'sarkit': {
        const drop = m.dusus || 0.75, y = H - drop;
        mesh(new THREE.CylinderGeometry(0.004, 0.004, drop, 4), M.siyahMetal, 0, H - drop / 2, 0, g);
        const shade = mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.abajur, 0, y, 0, g);
        shade.material = M.abajur; shade.castShadow = false;
        const l = new THREE.PointLight('#ffcf8a', 0, 5.5, 2); l.position.set(0, y - 0.1, 0); g.add(l); pendantLights.push(l);
        break;
      }
      case 'lambader': {
        mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.025, 24), M.siyahMetal, 0, 0.012, 0, g);
        mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.4, 8), M.siyahMetal, 0, 0.7, 0, g);
        const sh = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 24, 1, true), M.abajur, 0, 1.45, 0, g); sh.castShadow = false;
        const l = new THREE.PointLight('#ffc98a', 0, 4, 2); l.position.set(0, 1.35, 0); g.add(l); pendantLights.push(l);
        break;
      }
      case 'bitki': plant(g, m.s || 1); break;
      case 'yatak': {
        const fab = kumas(m.renk || '#c9c3b8');
        mesh(RB(w + 0.06, 0.26, d, 0.03), fab, 0, 0.2, 0.0, g);
        mesh(RB(w + 0.1, 1.05, 0.1, 0.04, 3), fab, 0, 0.55, -d / 2 + 0.05, g);
        mesh(RB(w - 0.02, 0.2, d - 0.14, 0.06, 3), M.nevresim, 0, 0.42, 0.05, g);
        mesh(RB(w + 0.02, 0.08, d * 0.58, 0.04, 3), M.nevresim, 0, 0.53, d / 2 - d * 0.29 - 0.03, g);
        mesh(RB(w + 0.04, 0.04, 0.5, 0.02, 2), kumas('#8e8577'), 0, 0.575, d / 2 - 0.4, g);
        const pc = w > 1.3 ? 2 : 1, pw = w > 1.3 ? (w - 0.25) / 2 : w - 0.3;
        for (let i = 0; i < pc; i++) mesh(RB(pw - 0.05, 0.14, 0.36, 0.07, 3), M.nevresim, pc === 1 ? 0 : (i ? 1 : -1) * (pw / 2 + 0.03), 0.6, -d / 2 + 0.3, g).rotation.x = -0.35;
        break;
      }
      case 'komodin':
        mesh(RB(w, 0.45, d, 0.015), M.ahsap, 0, 0.27, 0, g);
        mesh(new THREE.BoxGeometry(w - 0.04, 0.005, 0.005), M.siyahMetal, 0, 0.32, d / 2, g);
        { // gece lambası
          mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 20), M.porselen, 0.05, 0.59, -0.05, g);
          const s2 = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 20, 1, true), M.abajur, 0.05, 0.75, -0.05, g); s2.castShadow = false;
          const l = new THREE.PointLight('#ffc98a', 0, 2.5, 2); l.position.set(0.05, 0.72, 0); g.add(l); pendantLights.push(l);
        }
        break;
      case 'gardirop': {
        mesh(RB(w, h, d, 0.01), M.beyazLake, 0, h / 2, 0, g);
        const n = Math.max(2, Math.round(w / 0.5)), pw = w / n;
        for (let i = 1; i < n; i++) mesh(new THREE.BoxGeometry(0.004, h - 0.04, 0.004), M.kesit, -w / 2 + pw * i, h / 2, d / 2 + 0.002, g);
        for (let i = 0; i < n; i++) mesh(new THREE.BoxGeometry(0.012, 0.3, 0.02), M.krom, -w / 2 + pw * i + (i % 2 ? 0.05 : pw - 0.05), 1.1, d / 2 + 0.012, g);
        break;
      }
      case 'calisma_masasi':
        mesh(RB(w, 0.03, d, 0.01), M.ahsap, 0, 0.74, 0, g);
        mesh(new THREE.BoxGeometry(0.4, 0.7, d - 0.04), M.beyazLake, w / 2 - 0.22, 0.36, 0, g);
        mesh(new THREE.BoxGeometry(0.03, 0.72, d - 0.06), M.siyahMetal, -w / 2 + 0.03, 0.36, 0, g);
        chair(g, -0.1, d / 2 + 0.18, 180);
        mesh(RB(0.32, 0.22, 0.02, 0.01), M.ekran, -0.15, 0.88, -d / 2 + 0.15, g).rotation.x = -0.25;
        break;
      case 'buzdolabi':
        mesh(RB(w, h, d, 0.02), M.krom, 0, h / 2, 0, g).material = new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.3, metalness: 0.8 });
        mesh(new THREE.BoxGeometry(w - 0.02, 0.006, 0.006), M.kesit, 0, 1.15, d / 2 + 0.002, g);
        mesh(new THREE.BoxGeometry(0.02, 0.5, 0.03), M.siyahMetal, w / 2 - 0.06, 1.4, d / 2 + 0.02, g);
        break;
      case 'lavabo': {
        mesh(RB(w, 0.45, d, 0.01), M.ahsap, 0, 0.5, 0, g);
        mesh(RB(w, 0.06, d, 0.01), M.porselen, 0, 0.75, 0, g);
        mesh(new THREE.CylinderGeometry(Math.min(0.2, w * 0.3), 0.12, 0.05, 32), M.krom.clone(), 0, 0.775, 0.02, g).material.color.set('#e9ecee');
        mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), M.krom, 0, 0.88, -d / 2 + 0.06, g);
        const mir = mesh(new THREE.BoxGeometry(Math.min(w, 0.7), 0.7, 0.02), new THREE.MeshStandardMaterial({ color: '#dfe7ea', roughness: 0.02, metalness: 1 }), 0, 1.45, -d / 2 + 0.01, g); mir.castShadow = false;
        break;
      }
      case 'klozet':
        mesh(RB(0.36, 0.42, 0.18, 0.04, 3), M.porselen, 0, 0.62, -d / 2 + 0.1, g);
        mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.4, 24), M.porselen, 0, 0.2, -d / 2 + 0.4, g).scale.set(1, 1, 1.3);
        mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.025, 24), M.porselen, 0, 0.41, -d / 2 + 0.4, g).scale.set(1, 1, 1.3);
        break;
      case 'dus': {
        mesh(RB(w, 0.04, d, 0.01), M.porselen, 0, 0.02, 0, g);
        const gl = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1.95, d), M.cam); gl.position.set(-w / 2 + 0.01, 1.0, 0); g.add(gl);
        const gl2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.95, 0.01), M.cam); gl2.position.set(-w / 4, 1.0, d / 2 - 0.01); g.add(gl2);
        mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 8), M.krom, w / 2 - 0.1, 1.55, -d / 2 + 0.06, g);
        mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.015, 24), M.krom, w / 2 - 0.25, 2.08, -d / 2 + 0.25, g);
        mesh(new THREE.BoxGeometry(0.2, 0.01, 0.01), M.krom, w / 2 - 0.18, 2.1, -d / 2 + 0.16, g);
        break;
      }
      case 'vestiyer':
        mesh(RB(w, 0.9, d, 0.01), M.ahsap, 0, 0.45, 0, g);
        mesh(new THREE.BoxGeometry(w * 0.7, 1.0, 0.02), new THREE.MeshStandardMaterial({ color: '#dfe7ea', roughness: 0.03, metalness: 1 }), 0, 1.55, -d / 2 + 0.03, g);
        mesh(new THREE.BoxGeometry(w, 0.02, 0.08), M.siyahMetal, 0, 2.0, -d / 2 + 0.06, g);
        break;
      case 'balkon_set':
        mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 28), M.ahsap, 0, 0.72, 0, g);
        mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), M.siyahMetal, 0, 0.36, 0, g);
        chair(g, -0.48, 0, 90); chair(g, 0.48, 0, 270);
        break;
      case 'mutfak_L': return kitchenL(m);
      default: mesh(RB(w, h, d, 0.02), M.beyazLake, 0, h / 2, 0, g);
    }
    g.position.set(m.x, 0, m.z); g.rotation.y = ((m.r || 0) * Math.PI) / 180;
    return g;
  }
  function kitchenL(m) {
    const g = new THREE.Group();
    const D = 0.62, { x0, z0, x1, z1 } = m;
    const run = (ax, az, bx, bz) => { // dolap gövdesi + tezgâh, eksene hizalı dikdörtgen
      const w = bx - ax, d = bz - az, cx = (ax + bx) / 2, cz = (az + bz) / 2;
      mesh(new THREE.BoxGeometry(w - 0.02, 0.1, d - 0.06), M.kesit, cx, 0.05, cz, g);
      mesh(new THREE.BoxGeometry(w, 0.76, d), M.ahsap, cx, 0.48, cz, g);
      mesh(RB(w, 0.04, d + 0.02, 0.005), M.tezgah, cx, 0.88, cz, g);
    };
    run(x0, z0, x1, z0 + D);           // kuzey kol
    run(x1 - D, z0 + D, x1, z1);       // doğu kol
    // kapak çizgileri (kuzey kol: ön yüz +z, doğu kol: ön yüz −x)
    for (let x = x0 + 0.6; x < x1 - D; x += 0.6) mesh(new THREE.BoxGeometry(0.004, 0.72, 0.004), M.kesit, x, 0.5, z0 + D + 0.002, g);
    for (let z = z0 + D + 0.6; z < z1; z += 0.6) mesh(new THREE.BoxGeometry(0.004, 0.72, 0.004), M.kesit, x1 - D - 0.002, 0.5, z, g);
    // ocak
    const hob = mesh(new THREE.BoxGeometry(0.58, 0.01, 0.5), M.ekran, x0 + 0.65, 0.905, z0 + 0.3, g);
    for (const [dx, dz] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) mesh(new THREE.TorusGeometry(0.07, 0.006, 6, 24), M.antrasit, x0 + 0.65 + dx, 0.912, z0 + 0.3 + dz, g).rotation.x = Math.PI / 2;
    // davlumbaz
    mesh(new THREE.BoxGeometry(0.6, 0.08, 0.5), M.krom, x0 + 0.65, 1.6, z0 + 0.25, g);
    mesh(new THREE.BoxGeometry(0.26, H - 1.64, 0.24), M.krom, x0 + 0.65, (H + 1.64) / 2, z0 + 0.13, g);
    // evye (doğu kol, pencere önü)
    const sz = (z0 + z1) / 2 + 0.6;
    mesh(new THREE.BoxGeometry(0.4, 0.02, 0.62), M.krom, x1 - D / 2, 0.895, sz, g);
    mesh(new THREE.BoxGeometry(0.36, 0.01, 0.56), M.antrasit, x1 - D / 2, 0.9, sz, g);
    const tap = mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 20, Math.PI), M.krom, x1 - 0.12, 1.02, sz, g); tap.rotation.y = Math.PI / 2;
    // üst dolaplar: kuzey kol boyunca ve doğu kolun pencereye kadar olan kısmı
    const up = (ax, az, bx, bz) => { const w = bx - ax, d = bz - az; mesh(new THREE.BoxGeometry(w, 0.7, d), M.beyazLake, (ax + bx) / 2, 1.85, (az + bz) / 2, g); };
    up(x0 + 1.0, z0, x1, z0 + 0.35);
    up(x1 - 0.35, z0 + 0.35, x1, z0 + 1.15);
    // ankastre fırın kapağı
    mesh(new THREE.BoxGeometry(0.58, 0.58, 0.01), M.ekran, x0 + 0.65, 0.5, z0 + D + 0.006, g);
    return g;
  }
  for (const m of data.mobilya) { const o = build(m); shadowAll(o); o.traverse(c => { if (c.isMesh && (c.material === M.cam || c.material === M.abajur)) c.castShadow = false; if (c.isMesh && c.geometry.type === 'RoundedBoxGeometry' && c.material && c.material.map === undefined) {} }); gFurn.add(o); }
  // halılar gölge düşürmesin
  gFurn.traverse(c => { if (c.isMesh && c.position.y < 0.02 && c.geometry.parameters && c.geometry.parameters.height < 0.02) c.castShadow = false; });

  // Poşe: kesilen hacimlerin içi (arka yüzler) koyu görünür → kesit dolgusu
  const POCHE = 'if (!gl_FrontFacing) gl_FragColor = vec4(0.135, 0.14, 0.15, 1.0);';
  const pocheHook = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + POCHE); };
  const patched = new Set();
  for (const grp of [gWalls, gFurn, gCtx]) grp.traverse(o => {
    if (!o.isMesh) return;
    for (const mt of [].concat(o.material)) {
      if (patched.has(mt) || mt.transparent || mt === M.tavan || mt.isShadowMaterial) continue;
      mt.side = THREE.DoubleSide; mt.onBeforeCompile = pocheHook; mt.needsUpdate = true; patched.add(mt);
    }
  });

  // Oda tavan ışıkları (sayı sabit; yalnız şiddet değişir → shader yeniden derlenmez)
  const roomLights = data.odalar.filter(r => r.tur !== 'balkon').map(r => {
    const b = bbox(r.poly); const l = new THREE.PointLight('#ffe2bd', 0, Math.max(b.w, b.d) * 1.6 + 1, 2);
    l.position.set(b.cx, H - 0.55, b.cz); l.userData.area = b.w * b.d; scene.add(l); return l;
  });
  // tavan spotları (görsel)
  for (const r of data.odalar) if (r.tur !== 'balkon') {
    const b = bbox(r.poly); const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 16), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff3dd', emissiveIntensity: 1.2 }));
    spot.position.set(b.cx, H - 0.006, b.cz); gCeil.add(spot);
  }

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (!mobile && opts.ao !== false) {
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.2, thickness: 1.2, scale: 1.0, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.85;
    composer.addPass(gtao);
  }
  composer.addPass(new OutputPass());

  // ---------- kontroller ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 7; controls.maxDistance = 50; controls.maxPolarAngle = Math.PI * 0.46;
  controls.target.copy(C);
  controls.addEventListener('change', () => { dirty = true; });

  let mode = 'maket', current = null, dirty = true, anim = null;
  let yaw = 0, pitch = -0.05;
  // Mimari kesit: model ölçeklenmez, yatay bir düzlemle kesilir. Kroki 1,2 m, maket 2,05 m (lentolar görünmez).
  const CUT = { ust: 1.2, maket: 2.05, ic: H + 0.6 };
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT.maket);
  renderer.clippingPlanes = [cutPlane];
  const cut = { v: CUT.maket, anim: null };
  const onChange = opts.onChange || (() => {});

  function setCeilings(v) { gCeil.visible = v; }
  function lightsFor(m) {
    const inside = m === 'ic';
    for (const l of roomLights) l.intensity = inside ? Math.min(4.5, 1.1 + l.userData.area * 0.13) : 0;
    for (const l of pendantLights) l.intensity = inside ? 0.9 : 0;
    M.abajur.emissiveIntensity = inside ? 0.7 : 0;
    sun.intensity = inside ? 5.0 : 3.2;
    scene.environmentIntensity = inside ? 0.42 : 0.55;
    hemi.intensity = inside ? 0.2 : 0.55;
    renderer.toneMappingExposure = inside ? 0.95 : 1.0;
    scene.background = inside ? SKY : BG;
  }

  function lookFromYawPitch() {
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(dir));
  }

  function roomView(id) {
    const r = data.odalar.find(o => o.id === id);
    const k = r.kamera || { p: [bbox(r.poly).cx, bbox(r.poly).cz], t: [bbox(r.poly).cx + 1, bbox(r.poly).cz] };
    const pos = new THREE.Vector3(k.p[0], EYE, k.p[1]);
    const y = Math.atan2(k.t[0] - k.p[0], k.t[1] - k.p[1]);
    return { pos, yaw: y, pitch: k.egim ?? -0.06 };
  }

  function presetView(m) {
    if (m === 'ust') return { pos: new THREE.Vector3(C.x, camera.aspect < 0.9 ? 40 : 26, C.z + 0.01), target: C.clone() };
    const k = camera.aspect < 0.9 ? 1.3 : 1; // dar ekranda daha uzaktan
    return { pos: new THREE.Vector3(C.x - 9 * k, 19 * k, C.z + 15.5 * k), target: C.clone() };
  }

  // Animasyon: kamera konumu + bakış. Oda→oda geçişte tavanın üstünden zıplar.
  function animateTo(toPos, toLook, dur = 1.25, arc = 0, after) {
    const fromPos = camera.position.clone();
    const fromLook = new THREE.Vector3(); camera.getWorldDirection(fromLook); fromLook.add(camera.position);
    const mid = fromPos.clone().lerp(toPos, 0.5); mid.y = Math.max(fromPos.y, toPos.y) + arc;
    anim = { t0: performance.now(), dur: dur * 1000, fromPos, toPos, mid, fromLook, toLook: toLook.clone(), arc, after };
    dirty = true;
  }

  function setCut(target, dur = 900) { cut.anim = { from: cut.v, target, t0: performance.now(), dur }; }

  function enterRoom(id) {
    const v = roomView(id);
    const look = v.pos.clone().add(new THREE.Vector3(Math.sin(v.yaw), Math.sin(v.pitch), Math.cos(v.yaw)));
    const wasInside = mode === 'ic';
    mode = 'ic'; current = id; controls.enabled = false;
    setCut(CUT.ic, wasInside ? 10 : 700);
    lightsFor('ic');
    if (wasInside) setCeilings(false);
    animateTo(v.pos, look, wasInside ? 1.35 : 1.6, wasInside ? 3.2 : 0, () => { yaw = v.yaw; pitch = v.pitch; setCeilings(true); dirty = true; onChange({ mode, room: current }); });
    if (!wasInside) { setTimeout(() => { if (mode === 'ic') setCeilings(true); }, 1100); }
    onChange({ mode, room: current, moving: true });
  }

  function setMode(m) {
    if (m === 'ic') { enterRoom(current || data.odalar[0].id); return; }
    const leavingInside = mode === 'ic';
    mode = m; setCeilings(false); lightsFor(m);
    const v = presetView(m);
    setCut(CUT[m]);
    controls.enabled = false;
    animateTo(v.pos, v.target, leavingInside ? 1.6 : 1.3, 0, () => {
      controls.target.copy(v.target); controls.enabled = true; controls.enableRotate = m !== 'ust';
      controls.maxPolarAngle = m === 'ust' ? 0.0001 : Math.PI * 0.46; controls.update(); dirty = true;
      onChange({ mode, room: current });
    });
    onChange({ mode, room: current, moving: true });
  }

  // ---------- etkileşim ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hoverId = null, down = null;
  const dom = renderer.domElement;
  function pick(e) {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(floorMeshes, false)[0];
    return hit ? hit.object.userData.room : null;
  }
  function setHover(id) {
    if (id === hoverId) return; hoverId = id;
    for (const f of floorMeshes) f.material.emissiveIntensity = f.userData.room === id && mode !== 'ic' ? 0.22 : 0;
    dom.style.cursor = id && mode !== 'ic' ? 'pointer' : mode === 'ic' ? 'grab' : 'default';
    opts.onHover && opts.onHover(id); dirty = true;
  }
  dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw, pitch, t: performance.now() }; if (mode === 'ic') dom.setPointerCapture(e.pointerId); });
  dom.addEventListener('pointermove', e => {
    if (mode === 'ic') {
      if (down && !anim) {
        const k = 0.0042 * (camera.fov / 60);
        yaw = down.yaw + (e.clientX - down.x) * k; pitch = THREE.MathUtils.clamp(down.pitch + (e.clientY - down.y) * k, -0.9, 0.7);
        lookFromYawPitch(); dirty = true; dom.style.cursor = 'grabbing';
      }
      return;
    }
    if (!down) setHover(pick(e));
  });
  dom.addEventListener('pointerup', e => {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
    if (mode === 'ic') { dom.style.cursor = 'grab'; down = null; return; }
    down = null;
    if (!moved) { const id = pick(e); if (id) enterRoom(id); }
  });
  dom.addEventListener('pointerleave', () => { if (mode !== 'ic') setHover(null); });
  dom.addEventListener('wheel', e => {
    if (mode !== 'ic') return;
    e.preventDefault();
    camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 38, 82); camera.updateProjectionMatrix(); dirty = true;
  }, { passive: false });
  // klavye: oklar ile bakış
  dom.tabIndex = 0;
  dom.addEventListener('keydown', e => {
    if (mode !== 'ic') return;
    const st = 0.12;
    if (e.key === 'ArrowLeft') yaw += st; else if (e.key === 'ArrowRight') yaw -= st;
    else if (e.key === 'ArrowUp') pitch = Math.min(0.7, pitch + st); else if (e.key === 'ArrowDown') pitch = Math.max(-0.9, pitch - st);
    else return;
    e.preventDefault(); lookFromYawPitch(); dirty = true;
  });

  // ---------- boyut ----------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = mode === 'ic' ? camera.fov : (w / h < 0.9 ? 55 : 40);
    camera.updateProjectionMatrix(); dirty = true;
  }
  new ResizeObserver(resize).observe(host);

  // ---------- döngü ----------
  const links = doorLinks(data, walls);
  const tmp = new THREE.Vector3();
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) dirty = true; }).observe(host);
  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    if (!visible) return;
    if (cut.anim) {
      const a = cut.anim, t = Math.min(1, (now - a.t0) / a.dur);
      cut.v = a.from + (a.target - a.from) * ease(t);
      cutPlane.constant = cut.v; if (t >= 1) cut.anim = null; dirty = true;
    }
    if (anim) {
      const t = Math.min(1, (now - anim.t0) / anim.dur), k = ease(t);
      // ikinci derece bezier
      const a = anim.fromPos, b = anim.mid, c = anim.toPos;
      camera.position.set(
        (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * b.x + k * k * c.x,
        (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * b.y + k * k * c.y,
        (1 - k) * (1 - k) * a.z + 2 * (1 - k) * k * b.z + k * k * c.z);
      tmp.copy(anim.fromLook).lerp(anim.toLook, k);
      camera.lookAt(tmp);
      if (mode === 'ic') camera.fov = THREE.MathUtils.lerp(camera.fov, 62, 0.08); else camera.fov = THREE.MathUtils.lerp(camera.fov, host.clientWidth / host.clientHeight < 0.9 ? 55 : 40, 0.1);
      camera.updateProjectionMatrix();
      if (t >= 1) { const f = anim.after; anim = null; f && f(); }
      dirty = true;
    } else if (mode !== 'ic') {
      controls.update();
    }
    if (!dirty) return;
    dirty = false;
    composer.render();
    // plan işareti
    const d = new THREE.Vector3(); camera.getWorldDirection(d);
    opts.onCamera && opts.onCamera(camera.position.x, camera.position.z, Math.atan2(d.z, d.x) * 180 / Math.PI, mode === 'ic' && !anim);
    opts.onFrame && opts.onFrame();
  }

  // başlangıç
  setCeilings(false); lightsFor('maket');
  resize();
  const v0 = presetView('maket');
  camera.position.copy(v0.pos).add(new THREE.Vector3(-4, 6, 6)); controls.target.copy(v0.target); camera.lookAt(v0.target);
  resize();
  animateTo(v0.pos, v0.target, 2.2, 0, () => { controls.enabled = true; controls.update(); });
  controls.enabled = false;
  requestAnimationFrame(frameLoop);

  // Projeksiyon yardımcıları (HTML etiketleri için)
  function project(x, y, z) {
    tmp.set(x, y, z).project(camera);
    const r = dom.getBoundingClientRect();
    return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height, behind: tmp.z > 1 };
  }

  return {
    setMode, enterRoom, project, links,
    get mode() { return mode; }, get room() { return current; },
    look(dyaw, dpitch) { if (mode !== 'ic') return; yaw += dyaw; pitch = THREE.MathUtils.clamp(pitch + dpitch, -0.9, 0.7); lookFromYawPitch(); dirty = true; },
    zoom(df) { if (mode === 'ic') { camera.fov = THREE.MathUtils.clamp(camera.fov + df, 38, 82); camera.updateProjectionMatrix(); dirty = true; } else { const v = camera.position.clone().sub(controls.target).multiplyScalar(df > 0 ? 1.15 : 0.87); camera.position.copy(controls.target).add(v); controls.update(); dirty = true; } },
    highlight(id) { setHover(id); },
    invalidate() { dirty = true; },
    renderer, scene, camera
  };
}

function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
