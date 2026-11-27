// Sarıpekmez · projeler süzgeci, sayfalama ve harita (Leaflet). Kit davranışlarına dokunmaz.
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- süzgeç + sayfalama ----------
  const list = $('.pv-list');
  if (list) {
    const per = +list.dataset.pager || 9;
    const items = $$(':scope > li', list);
    const pager = $('.pv-pager'), empty = $('.pv-empty'), count = $('[data-f-count]');
    let tip = '', mah = '', durum = 'biten', page = 0;
    const apply = () => {
      const hit = durum !== 'biten' ? [] : items.filter(li => {
        const a = li.querySelector('.tile');
        return (!tip || a.dataset.tip.split(' ').includes(tip)) && (!mah || a.dataset.mah === mah);
      });
      const pages = Math.max(1, Math.ceil(hit.length / per)); page = Math.min(page, pages - 1);
      items.forEach(li => { li.hidden = true; });
      hit.slice(page * per, page * per + per).forEach(li => { li.hidden = false; });
      empty.hidden = durum === 'biten' && hit.length > 0;
      if (durum !== 'biten') empty.querySelector('h3').textContent = 'Yakında duyurulacak';
      else if (!hit.length) empty.querySelector('h3').textContent = 'Bu seçime uyan proje yok';
      count.textContent = durum === 'biten' ? `${hit.length} proje` : 'Yakında';
      pager.replaceChildren(...(pages > 1 ? Array.from({ length: pages }, (_, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = i + 1;
        b.setAttribute('aria-label', `Sayfa ${i + 1}`); if (i === page) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', () => { page = i; apply(); list.scrollIntoView({ block: 'nearest' }); }); return b;
      }) : []));
    };
    $$('[data-f-tip]').forEach(b => b.addEventListener('click', () => {
      tip = b.dataset.fTip; page = 0; $$('[data-f-tip]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); apply();
    }));
    $$('[data-f-durum]').forEach(b => b.addEventListener('click', () => {
      durum = b.dataset.fDurum; page = 0; $$('[data-f-durum]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); apply();
    }));
    const sel = $('[data-f-mah]'); if (sel) sel.addEventListener('change', () => { mah = sel.value; page = 0; apply(); });
    apply();
  }

  // ---------- harita ----------
  const mapEl = $('#pv-map');
  function initMap() {
    if (!mapEl || !window.L) return;
    const map = L.map(mapEl, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap katkıcıları' }).addTo(map);
    if (window.PV_PINS) {
      // aynı mahalledeki projeler tek noktada toplanır (konum mahalle düzeyinde)
      const groups = {};
      for (const p of window.PV_PINS) { const k = p.k.join(','); (groups[k] = groups[k] || []).push(p); }
      const bounds = [];
      for (const k in groups) {
        const g = groups[k], ll = g[0].k; bounds.push(ll);
        const icon = L.divIcon({ className: '', html: g.length > 1 ? `<div class="pv-pin pv-pin--n">${g.length}</div>` : '<div class="pv-pin"></div>', iconSize: g.length > 1 ? [28, 28] : [18, 18], iconAnchor: g.length > 1 ? [14, 14] : [9, 9] });
        const html = `<b>${g[0].m || 'Eskişehir'}</b><br>` + g.slice(0, 6).map(p => `<a href="proje/${p.s}.html">${p.a}</a> · ${p.n} konut`).join('<br>') + (g.length > 6 ? `<br>+${g.length - 6} proje` : '');
        L.marker(ll, { icon, title: `${g[0].m}: ${g.length} proje` }).addTo(map).bindPopup(g.length === 1 ? `<img src="${g[0].f}" alt="">` + html : html);
      }
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    } else if (mapEl.dataset.pin) {
      const ll = mapEl.dataset.pin.split(',').map(Number);
      map.setView(ll, 15);
      L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="pv-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
      L.circle(ll, { radius: 350, color: '#1f2128', weight: 1, dashArray: '4 4', fillColor: '#fab209', fillOpacity: 0.12 }).addTo(map);
    }
  }
  if (document.readyState === 'complete') initMap(); else addEventListener('load', initMap);
})();
