// ProjeVitrin · sayfa uygulaması
// Proje klasöründeki proje.json'u okur ve tüm bölümleri kurar. Yeni bir firma/proje için
// yalnız proje klasörü (proje.json, daire-*.json, marka/) değişir; motor aynı kalır.
import { createSite3D } from './site3d.js';
import { createPlan } from './plan2d.js';
import { bbox } from './geom.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};
const svg = s => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstChild; };
const fmt = n => String(Math.round(n * 10) / 10).replace('.', ',');

const IC = {
  isi: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 26h24M8 22c0-3 3-3 3-6s-3-3-3-6M16 22c0-3 3-3 3-6s-3-3-3-6M24 22c0-3 3-3 3-6s-3-3-3-6" stroke-linecap="round"/></svg>',
  garaj: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 13 16 5l13 8v14H3z"/><path d="M8 27V16h16v11M8 19h16M8 22h16M8 25h16"/></svg>',
  asansor: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="3" width="20" height="26" rx="2"/><path d="M16 3v26M10 11l2.5-3 2.5 3M22 21l-2.5 3-2.5-3"/></svg>',
  balkon: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 4h20v14H6zM16 4v14M3 18h26M5 18v10M27 18v10M5 28h22M10 18v10M16 18v10M22 18v10"/></svg>',
  kup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3h18v18H3zM3 12h8v9M11 3v5M15 12h6"/></svg>',
  goz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  geri: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  tam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
  arti: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
  eksi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14"/></svg>',
  ulasim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4M9 2h6"/></svg>',
  egitim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/></svg>',
  saglik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
  park: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22v-6M7 16h10l-5-12z"/></svg>',
  alisveris: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8h14l-1 13H6zM9 8a3 3 0 0 1 6 0"/></svg>'
};
const POI = {
  ulasim: { ad: 'Ulaşım', renk: '#2f6db5' }, egitim: { ad: 'Eğitim', renk: '#8a5a2b' }, saglik: { ad: 'Sağlık', renk: '#c2412d' },
  park: { ad: 'Park', renk: '#3e8a4f' }, alisveris: { ad: 'Alışveriş', renk: '#6b4fa0' }
};
const ODA_TON = { Salon: '#17181a', Mutfak: '#5b5e63', 'Yatak odası': '#9a958b', Banyo: '#c9c3b8', Duş: '#c9c3b8', WC: '#c9c3b8', Hol: '#dcd6cc', Antre: '#dcd6cc', Balkon: '#fab209' };

export async function boot(cfgUrl = 'proje.json') {
  const P = await (await fetch(cfgUrl)).json();
  const F = P.firma, PR = P.proje;
  document.documentElement.style.setProperty('--pv-accent', F.renkler.vurgu);
  document.documentElement.style.setProperty('--pv-navy', F.renkler.lacivert);
  document.title = `${PR.tam_ad} · ${F.ad}`;

  // ---------- üst bar ----------
  const top = h('header', { class: 'pv-top' }, h('div', { class: 'pv-wrap pv-top__in' },
    h('a', { class: 'pv-top__logo', href: '#ust', 'aria-label': `${F.ad}, başa dön` }, h('img', { src: F.logo, alt: F.ad, width: 134, height: 30 })),
    h('nav', { class: 'pv-top__nav', 'aria-label': 'Bölümler' },
      h('a', { href: '#proje' }, 'Proje'), h('a', { href: '#daireler' }, 'Daireler'), h('a', { href: '#tur' }, '3D Tur'), h('a', { href: '#konum' }, 'Konum'), h('a', { href: '#iletisim' }, 'İletişim')),
    h('a', { class: 'pv-btn pv-btn--ink', href: `tel:${F.telefon_link}` }, svg(IC.tel), 'Bilgi alın')));
  document.body.prepend(h('a', { class: 'pv-skip', href: '#proje' }, 'İçeriğe geç'), top);
  addEventListener('scroll', () => top.classList.toggle('is-solid', scrollY > 40), { passive: true });

  const main = h('main', { id: 'ust' });
  document.body.append(main);

  // ---------- hero ----------
  const counts = { A: 0, B: 0, C: 0 };
  P.daireler.forEach(d => { counts[d.blok] = (counts[d.blok] || 0) + (d.adet || 1); });
  const heroGl = h('div', { class: 'pv-hero__gl' });
  const tags = h('div', { class: 'pv-tags' });
  const hero = h('section', { class: 'pv-hero', 'aria-label': 'Proje tanıtımı' }, heroGl, h('div', { class: 'pv-hero__veil' }), tags,
    h('div', { class: 'pv-hero__copy' }, h('div', { class: 'pv-wrap' },
      h('p', { class: 'pv-eyebrow' }, h('i'), `${PR.durum} · ${PR.semt}`),
      h('h1', { class: 'pv-h1' }, PR.ad.split(' ').slice(0, -1).join(' '), ' ', h('em', {}, PR.ad.split(' ').slice(-1)[0])),
      h('p', { class: 'pv-lead' }, PR.ozet),
      h('ul', { class: 'pv-stats' }, PR.rakamlar.map(r => h('li', {}, h('b', { class: 'pv-num' }, r.deger), h('span', {}, r.etiket)))),
      h('div', { class: 'pv-cta' },
        h('a', { class: 'pv-btn pv-btn--accent', href: '#tur' }, svg(IC.kup), 'Daireyi 3D gezin'),
        h('a', { class: 'pv-btn pv-btn--ghost', href: '#daireler' }, 'Daire tiplerini inceleyin')))),
    h('p', { class: 'pv-hint' }, 'Sürükleyin: döndürün · Bloğa tıklayın: daireleri görün'));
  main.append(hero);

  let site = null;
  const tagEls = {};
  for (const b of P.bloklar) {
    tagEls[b.id] = h('button', { class: 'pv-tag', type: 'button', onclick: () => goBlock(b.id), onpointerenter: () => site && site.setHover(b.id), onpointerleave: () => site && site.setHover(null) },
      b.ad, h('small', {}, `${counts[b.id]} daire`));
    tags.append(tagEls[b.id]);
  }
  const streetEls = (P.vaziyet.sokaklar || []).map(s => { const e = h('span', { class: 'pv-street' }, s.ad); tags.append(e); return { e, s }; });
  try {
    site = createSite3D(heroGl, P.vaziyet, {
      background: '#e9e4da',
      onBlock: id => goBlock(id),
      onHover: id => { for (const k in tagEls) tagEls[k].classList.toggle('is-hover', k === id); },
      onFrame: () => {
        for (const b of P.bloklar) { const p = site.project(...site.blockTop(b.id)); Object.assign(tagEls[b.id].style, { left: p.x + 'px', top: p.y + 'px', display: p.behind ? 'none' : '' }); }
        for (const { e, s } of streetEls) { const p = site.project(s.etiket[0], 0.3, s.etiket[1]); Object.assign(e.style, { left: p.x + 'px', top: p.y + 'px', display: p.behind ? 'none' : '' }); }
      }
    });
  } catch (err) { console.error(err); heroGl.append(h('p', { class: 'pv-note', style: 'padding:120px 24px' }, '3D görünüm bu cihazda açılamadı.')); }

  // ---------- proje / özellikler ----------
  main.append(h('section', { class: 'pv-sec', id: 'proje' }, h('div', { class: 'pv-wrap' },
    h('div', { class: 'pv-head' }, h('div', {},
      h('p', { class: 'pv-kicker' }, 'Proje'),
      h('h2', { class: 'pv-h2' }, `${PR.sokaklar.join(', ').replace(/, ([^,]*)$/, ' ve $1')} arasında`),
      h('p', { class: 'pv-sub' }, `${P.bloklar.length} blok, ${PR.kat_sayisi} konut katı. ${P.bloklar.map(b => `${b.ad} katta ${b.kat_basi_daire} daire`).join(', ')}.`))),
    h('div', { class: 'pv-feats' }, PR.ozellikler.map(o => h('article', { class: 'pv-feat' }, svg(IC[o.ikon] || IC.kup), h('h3', {}, o.baslik), h('p', {}, o.metin)))))));

  // ---------- daireler ----------
  const unitsGrid = h('div', { class: 'pv-units', role: 'list' });
  let filter = 'Tümü', openId = null;
  const filters = ['Tümü', '3+1', '2+1', ...P.bloklar.map(b => b.ad)];
  const filterBar = h('div', { class: 'pv-filters', role: 'group', 'aria-label': 'Daire filtresi' });
  const renderFilters = () => { filterBar.replaceChildren(...filters.map(f => h('button', { class: 'pv-chip', type: 'button', 'aria-pressed': String(f === filter), onclick: () => { filter = f; openId = null; renderFilters(); renderUnits(); } }, f))); };
  const net = d => d.odalar.filter(o => o[0] !== 'Balkon').reduce((s, o) => s + o[1], 0);
  const balk = d => d.odalar.filter(o => o[0] === 'Balkon').reduce((s, o) => s + o[1], 0);
  function renderUnits() {
    const list = P.daireler.filter(d => filter === 'Tümü' || d.tip === filter || `${d.blok} Blok` === filter);
    const items = [];
    const cols = Math.max(1, getComputedStyle(unitsGrid).gridTemplateColumns.split(' ').length);
    const openIdx = list.findIndex(d => d.id === openId);
    const detailAt = openIdx < 0 ? -1 : Math.min(list.length, Math.ceil((openIdx + 1) / cols) * cols) - 1;
    list.forEach((d, idx) => {
      const tot = d.odalar.reduce((s, o) => s + o[1], 0);
      const card = h('button', { class: 'pv-unit', type: 'button', role: 'listitem', 'aria-expanded': String(openId === d.id), onclick: () => { openId = openId === d.id ? null : d.id; renderUnits(); if (openId) setTimeout(() => $('.pv-detail', unitsGrid)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50); } },
        h('div', { class: 'pv-unit__top' },
          h('div', {}, h('div', { class: 'pv-unit__id' }, `${d.blok} Blok · ${d.no} nolu daire`), h('div', { class: 'pv-unit__tip' }, d.tip)),
          h('div', { class: 'pv-unit__m2' }, h('b', { class: 'pv-num' }, d.brut), h('span', {}, 'm² brüt'))),
        h('div', { class: 'pv-mini', 'aria-hidden': 'true' }, d.odalar.map(o => h('i', { style: `flex:${o[1]};background:${ODA_TON[o[0]] || '#ccc'}` }))),
        h('div', { class: 'pv-unit__meta' },
          h('span', {}, `≈ ${fmt(net(d))} m² net`), h('span', {}, `${d.odalar.filter(o => o[0] === 'Balkon').length} balkon`), h('span', {}, `Her katta 1 · ${d.adet} adet`)),
        h('div', {}, d.tur3d ? h('span', { class: 'pv-badge pv-badge--3d' }, svg(IC.kup), '3D gezilebilir') : h('span', { class: 'pv-badge' }, 'Kroki ve oda listesi')));
      items.push(card);
      if (idx === detailAt) items.push(detail(list[openIdx], tot));
    });
    unitsGrid.replaceChildren(...items);
  }
  function detail(d) {
    const max = Math.max(...d.odalar.map(o => o[1]));
    return h('div', { class: 'pv-detail' },
      h('div', {},
        h('p', { class: 'pv-kicker' }, `${d.blok} Blok · ${d.no} nolu daire`),
        h('h3', {}, `${d.tip}, ${d.brut} m² brüt`),
        h('table', { class: 'pv-sched' }, h('tbody', {}, d.odalar.map(o => h('tr', {}, h('td', {}, o[0]), h('td', { class: 'bar' }, h('i', { style: `width:${(o[1] / max) * 100}%;background:${ODA_TON[o[0]] || '#888'}` })), h('td', { class: 'pv-num' }, `${fmt(o[1])} m²`)))))),
      h('div', {},
        h('div', { class: 'pv-sums' },
          h('div', {}, h('b', { class: 'pv-num' }, fmt(net(d))), h('span', {}, 'm² net iç alan')),
          h('div', {}, h('b', { class: 'pv-num' }, fmt(balk(d))), h('span', {}, 'm² balkon')),
          h('div', {}, h('b', { class: 'pv-num' }, d.brut), h('span', {}, 'm² brüt'))),
        h('p', { class: 'pv-note' }, `Net alan, satış planındaki oda alanlarının toplamıdır. ${d.teyit ? `${d.teyit} kaynakta net okunamadı, teyit edilecek.` : ''}`),
        d.tur3d
          ? h('a', { class: 'pv-btn pv-btn--accent', href: '#tur' }, svg(IC.kup), 'Bu daireyi 3D gezin')
          : h('p', { class: 'pv-note' }, 'Bu dairenin 3D modeli hazırlanıyor. Benzer yaşamı görmek için C Blok 3+1 turuna göz atın.'),
        h('p', {}, h('a', { class: 'pv-btn pv-btn--ghost', href: `tel:${F.telefon_link}`, style: 'margin-top:10px' }, svg(IC.tel), 'Bu daire için arayın'))));
  }
  function goBlock(id) {
    filter = `${id} Blok`; openId = P.daireler.find(d => d.blok === id)?.id || null; renderFilters(); renderUnits();
    $('#daireler').scrollIntoView({ behavior: 'smooth' });
  }
  main.append(h('section', { class: 'pv-sec pv-sec--alt', id: 'daireler' }, h('div', { class: 'pv-wrap' },
    h('div', { class: 'pv-head' }, h('div', {},
      h('p', { class: 'pv-kicker' }, 'Daireler'),
      h('h2', { class: 'pv-h2' }, `${P.daireler.length} tip, ${P.daireler.reduce((s, d) => s + (d.adet || 1), 0)} daire`),
      h('p', { class: 'pv-sub' }, 'Her blokta her kat aynı. Bir daireye dokunun, oda oda alanlarını görün.')), filterBar),
    unitsGrid)));
  renderFilters(); renderUnits();

  // ---------- 3D tur ----------
  const turDaire = P.daireler.find(d => d.tur3d);
  if (turDaire) await buildTour(main, P, turDaire);

  // ---------- konum ----------
  buildMap(main, P);

  // ---------- iletişim ----------
  main.append(h('section', { class: 'pv-sec', id: 'iletisim' }, h('div', { class: 'pv-wrap' },
    h('div', { class: 'pv-contact' },
      h('div', {},
        h('p', { class: 'pv-kicker' }, 'İletişim'),
        h('h2', { class: 'pv-h2' }, 'Daireyi yerinde görün'),
        h('p', { class: 'pv-sub' }, `${F.ad} satış ofisi tüm sorularınızı yanıtlar ve yerinde gezi ayarlar.`),
        h('div', { class: 'pv-cta', style: 'margin-top:24px' },
          h('a', { class: 'pv-btn pv-btn--accent', href: `tel:${F.telefon_link}` }, svg(IC.tel), F.telefon),
          h('a', { class: 'pv-btn', href: F.instagram, target: '_blank', rel: 'noopener' }, 'Instagram'))),
      h('dl', {},
        h('div', {}, h('dt', {}, 'Ofis'), h('dd', {}, F.adres)),
        h('div', {}, h('dt', {}, 'Telefon'), h('dd', {}, `${F.telefon} · Faks ${F.faks}`)),
        h('div', {}, h('dt', {}, 'Proje'), h('dd', {}, `${PR.tam_ad}, ${PR.semt}`)))))));

  document.body.append(h('footer', { class: 'pv-foot' }, h('div', { class: 'pv-wrap pv-foot__in' },
    h('p', { style: 'margin:0;max-width:60em' }, `3D modeller ve görseller temsilîdir; mobilya ve malzemeler örnek amaçlıdır. ${PR.not} ${P.vaziyet.not}`),
    h('p', { style: 'margin:0' }, `© ${new Date().getFullYear()} ${F.ad}`))));
}

// ======================================================================
async function buildTour(main, P, d) {
  const sec = h('section', { class: 'pv-sec', id: 'tur' });
  const wrap = h('div', { class: 'pv-wrap' });
  sec.append(wrap); main.append(sec);
  const data = await (await fetch(d.tur3d)).json();
  wrap.append(h('div', { class: 'pv-head' }, h('div', {},
    h('p', { class: 'pv-kicker' }, '3D tur'),
    h('h2', { class: 'pv-h2' }, `${data.ad}, ${data.tip}`),
    h('p', { class: 'pv-sub' }, 'Krokide bir odaya dokunun, kamera o odanın içine girsin. İçeride sürükleyerek etrafa bakın, kapı etiketleriyle odadan odaya geçin.'))));
  return mountTour(wrap, { data, texBase: '../../assets/tex/' });
}

// Turu herhangi bir sayfadaki bir öğeye yerleştirir (firma sitesinin proje sayfası gibi).
// opts: { data | dataUrl, texBase, telLink }
export async function mountTour(wrap, opts = {}) {
  const narrow = matchMedia('(max-width: 1080px)');
  const data = opts.data || await (await fetch(opts.dataUrl)).json();

  const kroki = h('div', { class: 'pv-card pv-krokiwrap' }, h('span', { class: 'pv-cap' }, 'Kroki · tıklanabilir'));
  const roomsList = h('ul', { class: 'pv-rooms-list', 'aria-label': 'Odalar' });
  const side = h('div', { class: 'pv-tour__side' }, kroki, h('div', { class: 'pv-card' }, roomsList));
  const glHost = h('div', { class: 'pv-viewer__gl' });
  const overlay = h('div', { class: 'pv-tags' });
  const loading = h('div', { class: 'pv-loading' }, 'Daire hazırlanıyor…');
  const modeBtns = {};
  const seg = h('div', { class: 'pv-seg', role: 'group', 'aria-label': 'Görünüm' },
    [['ust', IC.plan, 'Kroki'], ['maket', IC.kup, 'Maket'], ['ic', IC.goz, 'İçeride']].map(([m, ic, t]) => (modeBtns[m] = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => v.setMode(m) }, svg(ic), h('span', {}, t)))));
  const viewer = h('div', { class: 'pv-viewer' }, glHost, overlay,
    h('div', { class: 'pv-bar' }, seg, h('button', { class: 'pv-iconbtn', type: 'button', 'aria-label': 'Tam ekran', onclick: () => document.fullscreenElement ? document.exitFullscreen() : viewer.requestFullscreen?.() }, svg(IC.tam))),
    h('div', { class: 'pv-zoom' },
      h('button', { class: 'pv-iconbtn', type: 'button', 'aria-label': 'Yakınlaştır', onclick: () => v.zoom(-6) }, svg(IC.arti)),
      h('button', { class: 'pv-iconbtn', type: 'button', 'aria-label': 'Uzaklaştır', onclick: () => v.zoom(6) }, svg(IC.eksi))),
    loading);
  const info = h('div', { class: 'pv-info', hidden: true, 'aria-live': 'polite' });
  const vhint = h('p', { class: 'pv-vhint' }, '');
  viewer.append(info, vhint);
  wrap.append(h('div', { class: 'pv-tour' }, side, viewer));

  const order = data.odalar.map(r => r.id);
  const byId = Object.fromEntries(data.odalar.map(r => [r.id, r]));
  const liBtns = {};
  roomsList.append(...data.odalar.map(r => h('li', {}, (liBtns[r.id] = h('button', { type: 'button', onclick: () => go(r.id), onpointerenter: () => hover(r.id), onpointerleave: () => hover(null) }, r.ad, h('span', { class: 'pv-num' }, `${fmt(r.m2)} m²`))))));

  const plan = createPlan(kroki, data, { onRoom: id => go(id), onHover: id => hover(id) });
  const { createUnit3D } = await import('./unit3d.js');
  const roomTags = {}, hotEls = [];
  for (const r of data.odalar) { roomTags[r.id] = h('button', { class: 'pv-roomtag', type: 'button', onclick: () => go(r.id), onpointerenter: () => hover(r.id), onpointerleave: () => hover(null) }, r.ad, h('small', { class: 'pv-num' }, `${fmt(r.m2)} m²`)); overlay.append(roomTags[r.id]); }

  let v;
  try {
    v = await createUnit3D(glHost, data, {
      texBase: opts.texBase || '../../assets/tex/',
      onChange: st => update(st),
      onHover: id => hover(id, true),
      onCamera: (x, z, yaw, show) => plan.setMe(x, z, yaw, show),
      onFrame: () => place()
    });
  } catch (err) {
    console.error(err); loading.textContent = '3D görünüm bu cihazda açılamadı. Kroki ve oda listesi kullanılabilir.'; return;
  }
  setTimeout(() => loading.classList.add('is-done'), 600);
  update({ mode: 'maket', room: null });

  function go(id) {
    v.enterRoom(id);
    const r = viewer.getBoundingClientRect();
    if (narrow.matches && (r.top < 0 || r.bottom > innerHeight)) viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function hover(id, from3d) {
    plan.setHover(id);
    for (const k in liBtns) liBtns[k].classList.toggle('is-hover', k === id);
    for (const k in roomTags) roomTags[k].classList.toggle('is-hover', k === id);
    if (!from3d) v && v.highlight(id);
  }
  function update(st) {
    for (const m in modeBtns) modeBtns[m].setAttribute('aria-pressed', String(m === st.mode));
    plan.setActive(st.mode === 'ic' ? st.room : null);
    for (const k in liBtns) liBtns[k].setAttribute('aria-current', String(st.mode === 'ic' && k === st.room));
    vhint.textContent = st.mode === 'ic' ? 'Sürükleyin: etrafa bakın · Tekerlek: yakınlaştırın · Etiketler: diğer odalar' : st.mode === 'ust' ? 'Bir odaya tıklayın, içine girin' : 'Sürükleyin: döndürün · Odaya tıklayın: içine girin';
    hotEls.forEach(e => e.el.remove()); hotEls.length = 0;
    if (st.mode === 'ic' && st.room) {
      const r = byId[st.room], b = bbox(r.poly);
      const i = order.indexOf(st.room), prev = byId[order[(i - 1 + order.length) % order.length]], next = byId[order[(i + 1) % order.length]];
      info.replaceChildren(
        h('p', { class: 'pv-kicker', style: 'margin-bottom:6px' }, `${i + 1} / ${order.length}`),
        h('h3', {}, r.ad),
        h('div', { class: 'pv-info__m pv-num' }, h('span', {}, `${fmt(r.m2)} m²`), h('span', {}, `≈ ${fmt(b.w)} × ${fmt(b.d)} m`), h('span', {}, ({ parke: 'Laminat parke', seramik: 'Seramik', islak: 'Seramik', balkon: 'Dış mekân seramiği' })[r.zemin] || '')),
        r.notlar && r.notlar.length ? h('ul', {}, r.notlar.map(n => h('li', {}, n))) : null,
        h('div', { class: 'pv-info__nav' },
          h('button', { class: 'pv-btn pv-btn--ghost', type: 'button', onclick: () => go(prev.id) }, svg(IC.geri), prev.ad),
          h('button', { class: 'pv-btn pv-btn--ink', type: 'button', onclick: () => go(next.id) }, next.ad, svg(IC.ok))));
      info.hidden = false;
      if (!st.moving) {
        // bu odadan geçilebilen odalar (kapı/geçit)
        const seen = new Set();
        for (const l of v.links) {
          if (l.a !== st.room && l.b !== st.room) continue;
          const other = l.a === st.room ? l.b : l.a; if (seen.has(other)) continue; seen.add(other);
          const el = h('button', { class: 'pv-hot', type: 'button', onclick: () => go(other) }, byId[other].ad, svg(IC.ok));
          overlay.append(el); hotEls.push({ el, x: l.x, z: l.z });
        }
      }
    } else info.hidden = true;
    place();
  }
  function place() {
    if (!v) return;
    const inside = v.mode === 'ic';
    for (const r of data.odalar) {
      const el = roomTags[r.id];
      if (inside || (narrow.matches && glHost.clientWidth < 700 && r.m2 < 5)) { el.style.display = 'none'; continue; }
      const b = bbox(r.poly); const p = v.project(b.cx, 0.2, b.cz);
      Object.assign(el.style, { display: p.behind ? 'none' : '', left: p.x + 'px', top: p.y + 'px' });
    }
    const W = glHost.clientWidth, H = glHost.clientHeight, placed = [];
    const vis = hotEls.map(hs => ({ hs, p: v.project(hs.x, 1.25, hs.z) })).sort((a, b) => a.p.y - b.p.y);
    for (const { hs, p } of vis) {
      const off = p.behind || p.x < 20 || p.x > W - 20 || p.y < 60 || p.y > H - 20;
      hs.el.style.display = off ? 'none' : '';
      if (off) continue;
      let y = p.y; const w = hs.el.offsetWidth || 120;
      for (let k = 0; k < 6; k++) { const hit = placed.find(q => Math.abs(q.x - p.x) < (q.w + w) / 2 + 6 && Math.abs(q.y - y) < 36); if (!hit) break; y = hit.y + 38; }
      placed.push({ x: p.x, y, w });
      hs.el.style.left = p.x + 'px'; hs.el.style.top = y + 'px';
    }
  }
}

// ======================================================================
function buildMap(main, P) {
  const K = P.konum;
  const mapEl = h('div', { class: 'pv-map', role: 'region', 'aria-label': 'Konum haritası' });
  const list = h('ul');
  main.append(h('section', { class: 'pv-sec pv-sec--alt', id: 'konum' }, h('div', { class: 'pv-wrap' },
    h('div', { class: 'pv-head' }, h('div', {},
      h('p', { class: 'pv-kicker' }, 'Konum'),
      h('h2', { class: 'pv-h2' }, 'Tramvaya, okullara yürüme mesafesi'),
      h('p', { class: 'pv-sub' }, K.aciklama))),
    h('div', { class: 'pv-loc' }, mapEl, h('div', { class: 'pv-card pv-poi' }, list)))));

  const dist = (a, b) => { const R = 6371000, r = Math.PI / 180, dp = (b[0] - a[0]) * r, dl = (b[1] - a[1]) * r; const x = Math.sin(dp / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const items = K.yerler.map(y => ({ ...y, m: dist(K.merkez, y.konum) })).sort((a, b) => a.m - b.m);
  if (!window.L) { mapEl.append(h('p', { style: 'padding:24px' }, 'Harita yüklenemedi (internet bağlantısı gerekli).')); }
  let map = null; const markers = [];
  if (window.L) {
    map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView(K.merkez, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap katkıcıları' }).addTo(map);
    const pin = L.divIcon({ className: '', html: '<div class="pv-pin"><span>71</span></div>', iconSize: [44, 44], iconAnchor: [4, 40] });
    L.marker(K.merkez, { icon: pin, title: P.proje.tam_ad, zIndexOffset: 1000 }).addTo(map).bindPopup(`<b>${P.proje.tam_ad}</b><br>${K.yaklasik ? 'Yaklaşık konum' : ''}`);
    if (K.yaklasik) L.circle(K.merkez, { radius: 170, color: '#17181a', weight: 1, dashArray: '4 4', fillColor: '#fab209', fillOpacity: 0.12 }).addTo(map);
    for (const y of items) {
      const ic = L.divIcon({ className: '', html: `<div class="pv-dot" style="background:${POI[y.tur].renk}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
      markers.push(L.marker(y.konum, { icon: ic, title: y.ad }).addTo(map).bindPopup(`<b>${y.ad}</b><br>${POI[y.tur].ad} · ${Math.round(y.m / 10) * 10} m`));
    }
  }
  list.append(...items.map((y, i) => h('li', {}, h('button', { type: 'button', onclick: () => { if (map) { map.setView(y.konum, 16, { animate: true }); markers[i].openPopup(); } } },
    h('span', { class: 'ic', style: `background:${POI[y.tur].renk}` }, svg(IC[y.tur])),
    h('span', {}, h('b', {}, y.ad), h('small', {}, POI[y.tur].ad)),
    h('span', { class: 'd pv-num' }, `${y.m < 1000 ? Math.round(y.m / 10) * 10 + ' m' : fmt(y.m / 1000) + ' km'}`, h('small', {}, `${Math.max(1, Math.round((y.m * 1.25) / 80))} dk yürüme`))))));
}
