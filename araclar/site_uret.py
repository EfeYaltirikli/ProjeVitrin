"""Sarıpekmez sitesini veriden üretir (taste-skill kiti: system.css, motion, layout; client brand tokens).
Kullanım: python3 araclar/site_uret.py
Girdi: siteler/saripekmez/veri/{projeler,site}.json   Çıktı: siteler/saripekmez/*.html, proje/*.html, haber/*.html
Kurallar: KURALLAR.md (gerçek telefon/adres istisnası, firmanın kendi fotoğrafları, Türkçe metin)."""
import json, os, html, re
from collections import Counter

ROOT = os.path.join(os.path.dirname(__file__), '..', 'siteler', 'saripekmez')
P = json.load(open(os.path.join(ROOT, 'veri', 'projeler.json')))
S = json.load(open(os.path.join(ROOT, 'veri', 'site.json')))
PR = P['projeler']
import re as _re
def _uzun(ad):
    for a, b in [(r'\bMah\.', 'Mahallesi'), (r'\bMh\.', 'Mahallesi'), (r'\bSk\.', 'Sokak'), (r'\bSok\.', 'Sokak'), (r'\bCad\.', 'Caddesi'), (r'\bApt\.', 'Apartmanı')]:
        ad = _re.sub(a, b, ad)
    return ad.strip()
for _p in PR: _p['ad'] = _uzun(_p['ad'])
F = S['firma']
TUR3D = 'proje/71-evler-mah-kocakaya-sokak.html#tur'   # 3D tur proje sayfasına gömülü
K71 = json.load(open(os.path.join(ROOT, '..', '..', 'projeler', 'saripekmez-71-evler', 'proje.json')))
e = html.escape

N_PROJE = len(PR)
N_KONUT = sum(p['konut'] for p in PR)
N_ISYERI = sum(p['isyeri'] for p in PR)
MAHALLELER = sorted({p['mahalle'] for p in PR if p['mahalle']}, key=lambda s: s.replace('Ç', 'Cz').replace('Ş', 'Sz').replace('Ö', 'Oz').replace('Ü', 'Uz'))
N_MAH = len(MAHALLELER)
BY = {p['slug']: p for p in PR}

def sayi(n): return f'{n:,}'.replace(',', '.')
def tipler(p):
    c = Counter()
    for b in p['birimler']: c[b['tip']] += b['adet']
    order = ['1+1', '2+1', '3+1', '4+1', 'villa']
    return [(t, c[t]) for t in order if c[t]]
def tip_metni(p):
    t = tipler(p)
    if not t: return ''
    return ', '.join(f'{n} adet {"villa" if k == "villa" else k}' for k, n in t)
def img(p, g='kapak', i=0):
    lst = p['gorseller'].get(g) or []
    return lst[i] if len(lst) > i else None
def kapak(p):
    return img(p, 'proje', 0) or img(p, 'kapak', 0)
def yer(p):
    return ', '.join(x for x in [p['mahalle'], p['ilce']] if x) or 'Eskişehir'

ARROW = '<svg class="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path class="m-arrow__stem" d="M1 6h8"/><path class="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5"/></svg>'
CHEV = '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
TEL = f'tel:{F["telefon_link"]}'
MAIN = 'Bizi arayın'

BRAND = open(os.path.join(ROOT, '.taste-skill', 'brand.txt')).read()
BRAND = BRAND[BRAND.index(':root'):BRAND.index('</style>')]

def head(r, title, desc, moments=(), extra=''):
    mo = ''
    if moments:
        mo = ("<script>document.documentElement.classList.add('mo-js');setTimeout(()=>document.documentElement.classList.add('mo-safe'),2500)</script>\n"
              f'<link rel="modulepreload" href="{r}assets/moments/moments.js">\n<link rel="modulepreload" href="{r}assets/moments/lib.js">\n'
              + ''.join(f'<link rel="modulepreload" href="{r}assets/moments/{m}/moment.js">\n' for m in moments))
    return f'''<!doctype html>
<html lang="tr" data-type="service" data-radius="soft" data-buttons="arrow" data-motion>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{r}share.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{r}marka/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#efe9e0">
<!-- <link rel="canonical" href="https://www.saripekmez.com.tr/">  yayın alan adı kesinleşince -->
<meta name="site-kind" content="other">
<meta name="page-type" content="service">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400..700&family=Red+Hat+Text:wght@400..600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{r}assets/system.css">
<link rel="stylesheet" href="{r}assets/ui/cards.css">
<link rel="stylesheet" href="{r}assets/motion/motion.css">
<link rel="stylesheet" href="{r}assets/layout/layout.css">
<link rel="stylesheet" href="{r}assets/icons/icon.css">
<style>
{BRAND}</style>
<link rel="stylesheet" href="{r}site.css">
{extra}<script>document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)</script>
{mo}</head>
'''

def nav(r, cur=None):
    feat = ['71-evler-mah-kocakaya-sokak', 'luna-evleri', 'ari-konutlari-asagi-sogutonu', 'emek-mah-kizilirmak-sk']
    cards = ''.join(f'''<a class="menu-card span-3" href="{r}proje/{s}.html"><div class="panel"><img class="frame__img" src="{r}foto/{kapak(BY[s])['dosya']}" alt="{e(BY[s]['ad'])} binası" loading="lazy"></div><span class="t-card">{e(BY[s]['ad'])}</span><span class="t-small muted">{BY[s]['konut']} konut · {e(yer(BY[s]))}</span></a>''' for s in feat)
    def cur_attr(k): return ' aria-current="page"' if cur == k else ''
    return f'''<header class="nav nav--split">
  <div class="wrap nav__bar">
    <a class="skip-link" href="#top">İçeriğe geç</a>
    <nav class="nav__links" aria-label="Ana menü">
      <div class="nav__item">
        <a class="nav__link" href="{r}projeler.html"{cur_attr('projeler')}>Projeler {CHEV}</a>
        <div class="nav__menu"><div class="wrap grid">{cards}</div></div>
      </div>
      <div class="nav__item"><a class="nav__link" href="{r}kurumsal.html"{cur_attr('kurumsal')}>Kurumsal</a></div>
      <div class="nav__item"><a class="nav__link" href="{r}petrol.html"{cur_attr('petrol')}>Petrol</a></div>
      <div class="nav__item"><a class="nav__link" href="{r}haberler.html"{cur_attr('haberler')}>Haberler</a></div>
    </nav>
    <a class="nav__logo" href="{r}index.html#top" aria-label="Sarıpekmez İnşaat, ana sayfa"><img src="{r}marka/logo.svg" alt="Sarıpekmez" width="150" height="34"></a>
    <div class="nav__actions">
      <a class="btn btn--primary" href="{TEL}">{MAIN}</a>
    </div>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-label="Menü">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
    </button>
  </div>
</header>
'''

def footer(r, close_img, close_h='Daire ve projeler için bizi arayın', close_p=None):
    close_p = close_p or f'Merkez ofis {F["adres"]["merkez"]["sokak"]}, {F["adres"]["merkez"]["semt"]}.'
    m, pt = F['adres']['merkez'], F['adres']['petrol']
    return f'''<footer class="footer closing footer--dark ground-inverse" id="contact" aria-labelledby="close-h">
  <div class="wrap">
    <div class="closing__cta close--photo">
      <div class="section-head--split">
        <div><h2 id="close-h">{e(close_h)}</h2><p class="t-lead">{e(close_p)}</p></div>
        <a class="btn btn--primary" href="{TEL}">{MAIN}{ARROW}</a>
      </div>
      <div class="close__media"><img src="{r}foto/{close_img['dosya']}" alt="Sarıpekmez'in Eskişehir'deki bir apartmanı" loading="lazy" data-source="client" data-subject="bina"></div>
    </div>
    <div class="closing__links">
      <div class="grid">
        <div class="span-4 stack-4">
          <a class="nav__logo footer__brand" href="{r}index.html#top"><img src="{r}marka/footer-logo.png" alt="" width="40" height="38">Sarıpekmez</a>
          <p class="footer__lede">1972’den bu yana Eskişehir’de inşaat ve enerji.</p>
        </div>
        <div class="span-2 footer__col"><h3>Projeler</h3><ul><li><a href="{r}projeler.html#liste">Tamamlanan</a></li><li><a href="{r}projeler.html#harita">Haritada</a></li><li><a href="{r}{TUR3D}">3D tur</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Kurumsal</h3><ul><li><a href="{r}kurumsal.html#tarihce">Tarihçe</a></li><li><a href="{r}kurumsal.html#ilkeler">Misyon ve vizyon</a></li><li><a href="{r}haberler.html">Haberler</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Petrol</h3><ul><li><a href="{r}petrol.html#istasyonlar">İstasyonlar</a></li><li><a href="{r}petrol.html#videolar">Videolar</a></li></ul></div>
        <div class="span-2 footer__col"><h3>İletişim</h3><ul><li><a href="{TEL}">{F['telefon']}</a></li><li><a href="{F['instagram']}" rel="noopener">Instagram</a></li></ul></div>
      </div>
      <div class="footer__legal">
        <span>&copy; 2026 {F['grup']} &nbsp; {e(m['ad'])}: {e(m['sokak'])}, {e(m['semt'])} &nbsp; {e(pt['ad'])}: {e(pt['sokak'])}, {e(pt['semt'])}</span>
        <a href="https://www.saripekmez.com.tr/sozlesmeler/kvkk-ve-gizlilik-politikasi" rel="noopener">KVKK</a>
      </div>
    </div>
  </div>
</footer>
'''

def scripts(r, extra=''):
    return f'''<script type="module" src="{r}assets/system.js"></script>
<script type="module" src="{r}assets/motion/motion.js"></script>
<script type="module" src="{r}assets/layout/layout.js"></script>
{extra}</body>
</html>
'''

def hero_split(h1, lead, kicker, btn2, pic, alt, flt=None, pos='50% 50%'):
    f = ''
    if flt:
        f = f'<div class="ly-float"><div class="ly-float__row"><span class="ly-live">{e(flt[0])}</span><span>{e(flt[1])}</span></div><div class="ly-float__title">{e(flt[2])}</div></div>'
    b2 = f'<a class="btn btn--secondary" href="{btn2[1]}">{e(btn2[0])}</a>' if btn2 else ''
    return f'''  <section class="hero hero--split" data-enter aria-labelledby="hero-h">
    <div class="wrap"><div class="hero-text grid hero__grid">
      <div class="hero__text span-5">
        <p class="hero__kicker"><span class="dot" aria-hidden="true"></span>{e(kicker)}</p>
        <h1 id="hero-h">{e(h1)}</h1>
        <p class="hero__lead">{e(lead)}</p>
        <div class="btn-row"><a class="btn btn--primary" href="{TEL}">{MAIN}{ARROW}</a>{b2}</div>
      </div>
      <div class="hero__media span-6 start-7">
        <img src="{pic}" alt="{e(alt)}" style="--ly-pos: {pos}" fetchpriority="high" data-source="client" data-subject="bina">
        {f}
      </div>
    </div></div>
  </section>
'''

def tile(r, p, lazy=True):
    k = kapak(p)
    t = ' · '.join(x for x in [f"{p['konut']} konut" if p['konut'] else None, f"{p['isyeri']} işyeri" if p['isyeri'] else None] if x) or 'Konut projesi'
    b = '<span class="pv-badge">3D tur</span>' if p['tur3d'] else ''
    return f'''<a class="tile" href="{r}proje/{p['slug']}.html" data-tip="{' '.join(t for t, _ in tipler(p))}" data-mah="{e(p['mahalle'] or '')}">
          <div class="tile__media"><img src="{r}foto/{k['dosya']}" alt="{e(p['ad'])} binası" {'loading="lazy"' if lazy else ''} width="{k['w']}" height="{k['h']}">{b}</div>
          <div class="tile__head"><h3>{e(p['ad'])}</h3></div>
          <p class="tile__facts">{e(yer(p))} · {e(t)}</p>
        </a>'''

TURJS = '''<script type="module">
import { mountTour } from '../../../engine/app.js';
mountTour(document.getElementById('pv-tour'), { dataUrl: '../../../projeler/saripekmez-71-evler/daire-c1.json', texBase: '../../../assets/tex/' });
</script>
'''
def sitejs(r): return f'<script src="{r}site.js" defer></script>' + chr(10)
def leaflet(v): return f'<link rel="stylesheet" href="{v}vendor/leaflet.css">' + chr(10) + f'<script src="{v}vendor/leaflet.js" defer></script>' + chr(10)

def write(path, s):
    full = os.path.join(ROOT, path); os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w').write(s)

# =====================================================================================
# ANA SAYFA
def ana():
    r = ''
    luna = BY['luna-evleri']; yp = luna['gorseller']['yapim']
    hero_pic = f"foto/{yp[3]['dosya']}"
    feat = ['71-evler-mah-kocakaya-sokak', 'luna-evleri', 'emek-mah-kizilirmak-sk', 'ataturk-bulvari', 'ari-konutlari-asagi-sogutonu', 'zafer-mah-seher-sokak']
    tiles = [tile(r, BY[s]) for s in feat]
    pet = S['petrol']; ist = pet['istasyonlar']
    news = S['haberler']
    ch = [
        (yp[15], 'Taşıyıcı sistem', 'Betonarme karkas kat kat yükselir; aynı anda iki blokta çalışılır.'),
        (yp[9], 'Duvarlar ve balkonlar', 'Tuğla duvarlar örülür, balkon ve pencere boşlukları kesinleşir.'),
        (yp[12], 'İç mekân', 'Sıva, tesisat ve yerden ısıtma döşenir, ıslak hacimler kaplanır.'),
        (yp[3], 'Teslim', 'Cephe kaplaması biter, çevre düzenlenir ve daireler teslim edilir.'),
    ]
    chs = ''.join(f'''
        <li class="span-3 tile">
          <div class="tile__media tile--portrait"><img src="foto/{c[0]['dosya']}" alt="Luna Evleri inşaatı: {e(c[1].lower())}" loading="lazy" width="{c[0]['w']}" height="{c[0]['h']}"></div>
          <div class="tile__head"><h3>{n + 1}. {e(c[1])}</h3></div>
          <p>{e(c[2])}</p>
        </li>''' for n, c in enumerate(ch))
    s = head(r, 'Sarıpekmez İnşaat: Eskişehir’de konut projeleri',
             f'Sarıpekmez İnşaat 1972’den beri Eskişehir’de bina yapıyor: {N_PROJE} tamamlanmış proje, {N_KONUT} konut. Fotoğraflar, daire tipleri, konumlar ve 3D tur.',
             moments=('word-highlight',))
    s += f'''<body>
<!-- type: service (Sarıpekmez İnşaat, Eskişehir; konut projeleri)
     deal: hero split, nav nav-split, close close-photo, footer footer-dark, rhythm dark-band, buttons arrow, mark: client logo
     palette: client brand (start.mjs brand): warm stone ground from the plaster facades, ink, accent the logo's navy; the logo's yellow stays in the logo only (1.6:1 on the ground)
     type: red-hat (Red Hat Display / Red Hat Text)
     moments: word-highlight (#hakkimizda). photo-chapters dealt, dropped: client photographs are 820 px, the moment shows them 1280 wide (photo-upscale); #insaat is a four-step strip instead -->
{nav(r)}<main id="top">
{hero_split('Eskişehir’de apartman ve konut projeleri',
            f'1972’den beri Eskişehir’de bina yapıyoruz. Tamamlanan {N_PROJE} projede {N_KONUT} konut ve {N_ISYERI} işyeri var; her birinin fotoğrafı ve daire tipleri bu sitede.',
            '1972’den bu yana Eskişehir’de', ('Projeleri görün', 'projeler.html'), hero_pic, 'Luna Evleri, Emek Mahallesi: teslim edilmiş dört katlı bloklar',
            ('Son teslim', '18 daire', '71 Evler Kocakaya: 3 blok, daireyi 3D gezin'), '50% 60%')}
  <section class="section statement" id="hakkimizda" data-moment="word-highlight" aria-label="Hakkımızda">
    <div class="wrap">
      <p class="t-label">Sarıpekmez Grubu</p>
      <p class="mo-wh__text">1972’de yapı malzemesi satarak başladık. Bugün Eskişehir’in {N_MAH} mahallesinde yaptığımız binalarda {sayi(N_KONUT)} aile oturuyor. Malzemeyi kendi tedarikimizden alıyor, sahayı <strong>kendi ekibimizle</strong> yönetiyoruz.</p>
    </div>
  </section>
  <section class="section g2" id="projeler" style="--hm: 2" aria-labelledby="projeler-h">
    <div class="wrap">
      <div class="group">
        <div class="section-head section-head--row">
          <h2 id="projeler-h">Tamamlanan projeler. <span class="muted">{N_PROJE} bina, {N_KONUT} konut, {N_MAH} mahallede.</span></h2>
          <a class="link" href="projeler.html">Tüm projeleri görün</a>
        </div>
        <div class="grid pv-tiles">
          {''.join(f'<div class="span-4">{t}</div>' for t in tiles[:3])}
        </div>
      </div>
      <div class="grid pv-tiles pv-row2">
        {''.join(f'<div class="span-4">{t}</div>' for t in tiles[3:])}
      </div>
    </div>
  </section>
  <section class="section ground-inverse" id="tur" style="--hm: 2" aria-labelledby="tur-h">
    <div class="wrap">
      <div class="grid fill">
        <div class="span-5 stack-5">
          <h2 id="tur-h">71 Evler Kocakaya’da daireyi 3D gezin</h2>
          <p class="t-lead">C Blok’taki 126 m² 3+1 daireyi krokiden seçin, odadan odaya dolaşın. Her odanın ölçüsü satış planıyla aynı.</p>
          <ul class="rows pv-rows-inv">
            <li><span class="rows__name">Kroki</span><span class="rows__value">Odaya dokunun, içine girin</span></li>
            <li><span class="rows__name">Maket</span><span class="rows__value">Daireyi kuşbakışı döndürün</span></li>
            <li><span class="rows__name">İçeride</span><span class="rows__value">Göz hizasında etrafa bakın</span></li>
          </ul>
          <a class="link" href="{TUR3D}">3D turu açın</a>
        </div>
        <a class="frame frame--photo frame--split span-6 start-7 pv-tour-shot" href="{TUR3D}" aria-label="3D turu açın">
          <img class="frame__img" src="foto/3d/maket.webp" alt="C Blok 1 nolu dairenin 3D maketi: salon, mutfak ve yatak odaları" loading="lazy">
        </a>
      </div>
    </div>
  </section>
  <section class="section" id="insaat" style="--hm: 2" aria-labelledby="insaat-h">
    <div class="wrap">
      <div class="section-head"><h2 id="insaat-h">Luna Evleri nasıl yükseldi</h2><p>Emek Mahallesi’nde {luna['konut']} konut ve 8 dükkân: temelden teslime dört aşama.</p></div>
      <ol class="grid pv-steps fill">{chs}
      </ol>
    </div>
  </section>
  <section class="section" id="petrol" style="--hm: 2" aria-labelledby="petrol-h">
    <div class="wrap">
      <div class="grid fill">
        <div class="span-5 stack-5">
          <h2 id="petrol-h">Eskişehir ve İnönü’de iki Shell istasyonu</h2>
          <p class="t-lead">2006’dan bu yana Shell bayisiyiz; iki istasyonda günde ortalama {sayi(pet['gunluk_litre'])} litre akaryakıt satıyoruz.</p>
          <ul class="rows">
            <li><span class="rows__name">{e(ist[0]['ad'])}</span><p>{e(', '.join(ist[0]['hizmetler']))}</p><span class="rows__value">{sayi(ist[0]['alan_m2'])} m²</span></li>
            <li><span class="rows__name">{e(ist[1]['ad'])}</span><p>{e(ist[1]['hizmetler'][0])}; {ist[1]['yil']}’da açıldı</p><span class="rows__value">{sayi(ist[1]['alan_m2'])} m²</span></li>
          </ul>
          <a class="link" href="petrol.html">İstasyonları görün</a>
        </div>
        <div class="frame frame--photo frame--split span-6 start-7">
          <img class="frame__img" src="foto/{pet['gorseller'][1]['dosya']}" alt="Sarıpekmez Shell istasyonu, havadan" loading="lazy">
        </div>
      </div>
    </div>
  </section>
  <section class="section" id="haberler" style="--hm: 2" aria-labelledby="haberler-h">
    <div class="wrap">
      <div class="section-head section-head--row">
        <h2 id="haberler-h">Sarıpekmez’den haberler</h2>
        <a class="link" href="haberler.html">Tüm haberleri okuyun</a>
      </div>
      <div class="grid pv-tiles fill">
        {''.join(news_tile(r, n) for n in news)}
      </div>
    </div>
  </section>
</main>
{footer(r, img(BY['bahcelievler-mah-orhan-oguz-cad'], 'proje', 1))}{scripts(r)}'''
    write('index.html', s)

def news_tile(r, n):
    g = n['gorsel']
    return f'''<div class="span-4"><a class="tile" href="{r}haber/{n['slug']}.html">
          <div class="tile__media"><img src="{r}foto/{g['dosya']}" alt="{e(n['baslik'])}" loading="lazy" width="{g['w']}" height="{g['h']}"></div>
          <p class="tile__facts">{tarih(n['tarih'])}</p>
          <div class="tile__head"><h3>{e(n['baslik'])}</h3></div>
        </a></div>'''

AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
def tarih(t):
    y, m, d = t.split('-'); return f'{int(d)} {AYLAR[int(m) - 1]} {y}'

# =====================================================================================
# PROJELER
def projeler():
    r = ''
    tip_say = Counter()
    for p in PR:
        for t, n in tipler(p): tip_say[t] += 1
    chips = [('', 'Tümü', N_PROJE)] + [(t, 'Villa' if t == 'villa' else t, tip_say[t]) for t in ['1+1', '2+1', '3+1', '4+1', 'villa'] if tip_say[t]]
    chip_html = ''.join(f'<button class="pv-chip" type="button" data-f-tip="{t}" aria-pressed="{"true" if not t else "false"}">{e(a)} <span class="muted">{n}</span></button>' for t, a, n in chips)
    mah_opts = ''.join(f'<option value="{e(m)}">{e(m)} ({sum(1 for p in PR if p["mahalle"] == m)})</option>' for m in MAHALLELER)
    order = sorted(PR, key=lambda p: (-p['tur3d'], -(len(p['gorseller']['yapim']) > 0), -p['konut']))
    tiles = ''.join(f'<li class="span-4">{tile(r, p)}</li>' for p in order)
    pins = [{'s': p['slug'], 'a': p['ad'], 'k': p['konum'], 'n': p['konut'], 'm': p['mahalle'] or '', 'f': f"foto/{kapak(p)['dosya']}"} for p in PR if p['konum']]
    s = head(r, f'Projeler: Sarıpekmez’in Eskişehir’deki {N_PROJE} binası',
             f'Sarıpekmez İnşaat’ın tamamladığı {N_PROJE} proje: mahalleye ve daire tipine göre süzün, haritada görün.',
             extra=leaflet('../../'))
    s += f'''<body>
<!-- type: service · projeler listesi; deal as index (hero split: the map is the picture) -->
{nav(r, 'projeler')}<main id="top">
  <section class="hero hero--split" data-enter aria-labelledby="hero-h" id="harita">
    <div class="wrap"><div class="hero-text grid hero__grid">
      <div class="hero__text span-5">
        <p class="hero__kicker"><span class="dot" aria-hidden="true"></span>{N_MAH} mahallede {N_PROJE} bina</p>
        <h1 id="hero-h">Eskişehir’deki projelerimiz</h1>
        <p class="hero__lead">{N_KONUT} konut ve {N_ISYERI} işyeri teslim ettik. Haritada bir noktaya dokunun ya da listeden mahalle ve daire tipine göre süzün.</p>
        <div class="btn-row"><a class="btn btn--primary" href="{TEL}">{MAIN}{ARROW}</a><a class="btn btn--secondary" href="#liste">Listeyi görün</a></div>
      </div>
      <div class="hero__media span-6 start-7 pv-map" id="pv-map" role="region" aria-label="Projelerin haritası, mahalle konumları"></div>
    </div></div>
  </section>
  <section class="section g2" id="liste" aria-labelledby="liste-h">
    <div class="wrap">
      <div class="group">
        <div class="section-head section-head--row">
          <h2 id="liste-h">Proje listesi. <span class="muted" data-f-count>{N_PROJE} proje</span></h2>
          <div class="pv-filters">
            <div class="pv-seg" role="group" aria-label="Durum">
              <button type="button" class="pv-chip" aria-pressed="true" data-f-durum="biten">Tamamlanan</button>
              <button type="button" class="pv-chip" aria-pressed="false" data-f-durum="devam">Devam eden</button>
              <button type="button" class="pv-chip" aria-pressed="false" data-f-durum="baslayan">Başlayan</button>
            </div>
          </div>
        </div>
        <div class="pv-filterbar">
          <div class="pv-seg" role="group" aria-label="Daire tipi">{chip_html}</div>
          <label class="pv-select"><span class="t-label">Mahalle</span><select data-f-mah><option value="">Tüm mahalleler</option>{mah_opts}</select></label>
        </div>
      </div>
      <ul class="grid pv-tiles pv-list" data-pager="6">{tiles}</ul>
      <div class="pv-empty" hidden><h3>Yakında duyurulacak</h3><p>Bu aşamadaki projeler hazır olduğunda burada yer alacak. Bilgi için {e(F['telefon'])}.</p></div>
      <nav class="pv-pager" aria-label="Sayfalar"></nav>
    </div>
  </section>
</main>
{footer(r, kapak(BY['zafer-mah-seher-sokak']))}
<script>window.PV_PINS = {json.dumps(pins, ensure_ascii=False)};</script>
{scripts(r, sitejs(r))}'''
    write('projeler.html', s)

# =====================================================================================
# PROJE DETAY
def proje(p):
    r = '../'
    k = kapak(p)
    hero_img = img(p, 'proje', 1) or k
    tmet = tip_metni(p)
    facts = []
    if p['konut']: facts.append(('Konut', f"{p['konut']}", tmet))
    if p['isyeri']: facts.append(('İşyeri', f"{p['isyeri']}", ''))
    if p['insaat_alani']: facts.append(('İnşaat alanı', f"{sayi(p['insaat_alani'])} m²", ''))
    if p['blok']: facts.append(('Blok', str(p['blok']), ''))
    if p['yil']: facts.append(('Yıl', str(p['yil']), ''))
    for b in p['birimler']:
        if b.get('not') and 'm²' in b.get('not', ''): facts.append(('Daire', b['not'], ''))
    rows = ''.join(f'<li><span class="rows__name">{e(a)}</span>{f"<p>{e(c)}</p>" if c else ""}<span class="rows__value">{e(b)}</span></li>' for a, b, c in facts)
    rows += ''.join(f'<li><span class="rows__name">{e(o)}</span></li>' for o in p['ozellikler'])
    if p['adres']: rows += f'<li><span class="rows__name">Adres</span><p>{e(p["adres"])}</p></li>'
    lead_bits = [tmet and f'{tmet}', p['isyeri'] and f"{p['isyeri']} işyeri", p['insaat_alani'] and f"{sayi(p['insaat_alani'])} m² inşaat alanı"]
    lead = '; '.join(b for b in lead_bits if b) or 'Sarıpekmez İnşaat’ın tamamladığı bir konut projesi.'
    lead = lead[0].upper() + lead[1:] + '.'
    if p['tur3d']: lead += ' C Blok 3+1 daireyi 3D gezebilirsiniz.'
    btn2 = ('3D turu açın', '#tur') if p['tur3d'] else ('Fotoğrafları görün', '#fotograflar')
    gal = p['gorseller']['proje'][:8] or p['gorseller']['kapak']
    secs = ''
    if p['tur3d']:
        dl = K71['daireler']
        net = lambda d: sum(o[1] for o in d['odalar'] if o[0] != 'Balkon')
        drows = ''.join(f'<li><span class="rows__name">{d["blok"]} Blok · {d["no"]} nolu daire, {d["tip"]}</span><p>{", ".join(f"{o[0].lower()} {str(o[1]).replace(chr(46), chr(44))} m²" for o in d["odalar"][:5])}{" · 3D gezilebilir" if d.get("tur3d") else ""}</p><span class="rows__value">{d["brut"]} m² brüt · ≈ {round(net(d))} m² net</span></li>' for d in dl)
        secs += f'''  <section class="section pv-tour-sec" id="tur" aria-labelledby="tur-h">
    <div class="wrap">
      <div class="section-head section-head--row">
        <h2 id="tur-h">C Blok 1 nolu daire, 3D tur</h2>
        <p class="t-small muted">Krokide bir odaya dokunun; içeride sürükleyerek etrafa bakın.</p>
      </div>
      <div class="pv-tourhost" id="pv-tour"></div>
    </div>
  </section>
  <section class="section" id="daireler" aria-labelledby="daire-h">
    <div class="wrap">
      <div class="section-head"><h2 id="daire-h">Daire tipleri. <span class="muted">Her blokta her kat aynı; {len(dl)} tip.</span></h2></div>
      <ul class="rows fill">{drows}</ul>
    </div>
  </section>
'''
    # fotoğraflar
    n = len(gal)
    cls = 'pv-wall--1' if n == 1 else 'pv-wall--2' if n in (2, 4) else 'pv-wall--3'
    secs += f'''  <section class="section{' g2' if n > 4 else ''}" id="fotograflar" aria-labelledby="foto-h">
    <div class="wrap">
      <div class="section-head"><h2 id="foto-h">{e(p['ad'])} fotoğrafları</h2></div>
      <div class="pv-wall {cls}" data-lightbox>
        {''.join(f'<a href="{r}foto/{g["dosya"]}" class="pv-wall__item"><img src="{r}foto/{g["dosya"]}" alt="{e(p["ad"])}, görsel {i + 1}" loading="lazy" width="{g["w"]}" height="{g["h"]}"></a>' for i, g in enumerate(gal))}
      </div>
    </div>
  </section>
'''
    if p['gorseller']['plan']:
        pl = p['gorseller']['plan']
        secs += f'''  <section class="section" id="planlar" aria-labelledby="plan-h">
    <div class="wrap">
      <div class="section-head"><h2 id="plan-h">Kat planları</h2></div>
      <div class="pv-wall {'pv-wall--2' if len(pl) % 2 == 0 else 'pv-wall--3'} pv-wall--plan" data-lightbox>
        {''.join(f'<a href="{r}foto/{g["dosya"]}" class="pv-wall__item"><img src="{r}foto/{g["dosya"]}" alt="{e(p["ad"])} kat planı {i + 1}" loading="lazy" width="{g["w"]}" height="{g["h"]}"></a>' for i, g in enumerate(pl))}
      </div>
    </div>
  </section>
'''
    if p['gorseller']['yapim']:
        yp = p['gorseller']['yapim']
        pick = [yp[int(i * (len(yp) - 1) / 3)] for i in range(4)] if len(yp) >= 4 else yp
        secs += f'''  <section class="section" id="yapim" aria-labelledby="yapim-h">
    <div class="wrap">
      <div class="section-head section-head--row"><h2 id="yapim-h">Yapım aşamaları. <span class="muted">{len(yp)} fotoğraf.</span></h2></div>
      <div class="pv-wall pv-wall--4" data-lightbox>
        {''.join(f'<a href="{r}foto/{g["dosya"]}" class="pv-wall__item"><img src="{r}foto/{g["dosya"]}" alt="{e(p["ad"])} inşaatı, aşama {i + 1}" loading="lazy" width="{g["w"]}" height="{g["h"]}"></a>' for i, g in enumerate(pick))}
        {''.join(f'<a href="{r}foto/{g["dosya"]}" class="pv-wall__item" hidden><img src="{r}foto/{g["dosya"]}" alt="{e(p["ad"])} inşaatı" loading="lazy"></a>' for g in yp if g not in pick)}
      </div>
    </div>
  </section>
'''
    if p['konum']:
        secs += f'''  <section class="section" id="konum" aria-labelledby="konum-h">
    <div class="wrap">
      <div class="grid fill">
        <div class="span-5 stack-5">
          <h2 id="konum-h">Konum. <span class="muted">{e(yer(p))}.</span></h2>
          <ul class="rows">{rows}</ul>
          <p class="t-small muted">Haritadaki nokta mahallenin merkezini gösterir.</p>
        </div>
        <div class="frame frame--split span-6 start-7 pv-map" id="pv-map" data-pin="{p['konum'][0]},{p['konum'][1]}" role="region" aria-label="{e(p['mahalle'] or 'Proje')} mahallesi haritası"></div>
      </div>
    </div>
  </section>
'''
    tx = ''
    if p['tur3d']:
        tx = ('<link rel="stylesheet" href="../../../engine/tur.css">' + chr(10) +
              '<script type="importmap">{ "imports": { "three": "../../../vendor/three/build/three.module.js" } }</script>' + chr(10))
    s = head(r, f'{p["ad"]}: Sarıpekmez İnşaat projesi, {yer(p)}',
             f'{p["ad"]} ({yer(p)}): {lead}',
             extra=leaflet('../../../') + tx)
    s += f'''<body>
{nav(r, 'projeler')}<main id="top">
{hero_split(p['ad'], lead, f"Tamamlandı · {yer(p)}", btn2, f"{r}foto/{hero_img['dosya']}", f"{p['ad']} binası")}
{secs}</main>
{footer(r, k if k is not hero_img else (img(p, 'proje', 0) or k), close_h=f'{p["ad"]} hakkında bilgi alın')}{scripts(r, sitejs(r) + (TURJS if p['tur3d'] else ''))}'''
    write(f'proje/{p["slug"]}.html', s)

# =====================================================================================
def kurumsal():
    r = ''
    K = S['kurumsal']
    rail = ''.join(f'''<li class="span-3"><div class="panel"><img class="frame__img" src="foto/{g}" alt="{e(a)}" loading="lazy"></div><p class="t-label">{e(t['yil'])}</p><p class="t-card">{e(t['baslik'])}</p><p>{e(t['metin'])}</p></li>'''
                   for t, (g, a) in zip(K['tarihce'], [
                       (BY['gokmeydan-sahin-apt']['gorseller']['proje'][0]['dosya'], 'Gökmeydan Şahin Apartmanı, 1999'),
                       (kapak(BY['bahcelievler-mah-namik-kemal-sk'])['dosya'], 'Bahçelievler’de bir Sarıpekmez apartmanı'),
                       (S['petrol']['gorseller'][1]['dosya'], 'Sarıpekmez Shell istasyonu'),
                       (kapak(BY['luna-evleri'])['dosya'], 'Luna Evleri')]))
    s = head(r, 'Kurumsal: Sarıpekmez Grubu, 1972’den beri Eskişehir’de', 'Sarıpekmez Grubu’nun tarihçesi, misyonu ve vizyonu: yapı malzemesi, inşaat taahhüt ve Shell akaryakıt istasyonları.', moments=('word-highlight',))
    s += f'''<body>
{nav(r, 'kurumsal')}<main id="top">
{hero_split('1972’den beri Eskişehir’de inşaat ve enerji', K['giris'] + f' Bugüne dek {N_PROJE} konut projesi tamamladık ve iki Shell istasyonu işletiyoruz.', 'Aile şirketi, üçüncü kuşak', ('Tarihçeyi okuyun', '#tarihce'), f"foto/{img(BY['ataturk-bulvari'], 'proje', 2)['dosya']}", 'Atatürk Bulvarı’ndaki Sarıpekmez binası')}
  <section class="section" id="tarihce" aria-labelledby="tarihce-h">
    <div class="wrap">
      <div class="section-head"><h2 id="tarihce-h">Tarihçe. <span class="muted">Yarım asırda dört dönem.</span></h2></div>
      <ol class="grid rail pv-rail fill">{rail}</ol>
    </div>
  </section>
  <section class="section statement" id="ilkeler" data-moment="word-highlight" aria-label="Misyon ve vizyon">
    <div class="wrap">
      <p class="t-label">Misyonumuz ve vizyonumuz</p>
      <p class="mo-wh__text">{e(K['misyon'])} {e(K['vizyon'].replace('değer üretmek', '<strong>değer üretmek</strong>'))}</p>
    </div>
  </section>
  <section class="section" id="hedefler" aria-labelledby="hedef-h">
    <div class="wrap">
      <div class="grid fill">
        <div class="span-5 stack-5">
          <h2 id="hedef-h">Hedeflerimiz</h2>
          <ul class="rows">{''.join(f'<li><span class="rows__name">{e(h)}</span></li>' for h in K['hedefler'])}</ul>
        </div>
        <div class="frame frame--photo frame--split span-6 start-7"><img class="frame__img" src="foto/{img(BY['emek-mah-kizilirmak-sk'], 'proje', 4)['dosya']}" alt="Emek Mahallesi Kızılırmak Sokak’taki bloklar" loading="lazy"></div>
      </div>
    </div>
  </section>
</main>
{footer(r, kapak(BY['kumlubel-mah-edipler-sokak']))}{scripts(r)}'''
    s = s.replace('&lt;strong&gt;', '<strong>').replace('&lt;/strong&gt;', '</strong>')
    write('kurumsal.html', s)

def petrol():
    r = ''
    pet = S['petrol']; ist = pet['istasyonlar']; g = pet['gorseller']
    cards = ''.join(f'''<div class="span-6"><article class="tile">
          <div class="tile__media"><img src="foto/{gg['dosya']}" alt="{e(i['ad'])}" loading="lazy" width="{gg['w']}" height="{gg['h']}"></div>
          <div class="tile__head"><h3>{e(i['ad'])}</h3><span class="tile__price">{sayi(i['alan_m2'])} m²</span></div>
          <p class="tile__facts">{i['yil']}’dan beri</p>
          <ul class="rows">{''.join(f'<li><span class="rows__name">{e(h)}</span></li>' for h in i['hizmetler'])}</ul>
        </article></div>''' for i, gg in zip(ist, [g[2], g[4]]))
    vids = ''.join(f'''<div class="span-4"><a class="tile" href="https://www.youtube.com/watch?v={v}" rel="noopener">
          <div class="tile__media tile--wide"><img src="https://i.ytimg.com/vi/{v}/hqdefault.jpg" alt="Sarıpekmez Shell istasyonu videosu {i + 1}" loading="lazy"><span class="pv-play" aria-hidden="true"></span></div>
          <div class="tile__head"><h3>İstasyon videosu {i + 1}</h3></div>
        </a></div>''' for i, v in enumerate(pet['videolar'][:3]))
    s = head(r, 'Petrol: Sarıpekmez Shell istasyonları, Eskişehir ve İnönü', 'Sarıpekmez Petrol: 2006’dan beri Shell bayisi; Eskişehir ve İnönü’de iki istasyon, günde ortalama 45.000 litre.')
    s += f'''<body>
{nav(r, 'petrol')}<main id="top">
{hero_split('Eskişehir ve İnönü’de Shell istasyonları', pet['giris'] + f' İki istasyonda günde ortalama {sayi(pet["gunluk_litre"])} litre akaryakıt satıyoruz.', '2006’dan bu yana Shell bayisi', ('İstasyonları görün', '#istasyonlar'), f"foto/{g[0]['dosya']}", 'Sarıpekmez Shell istasyonu, havadan')}
  <section class="section" id="istasyonlar" aria-labelledby="ist-h">
    <div class="wrap">
      <div class="section-head"><h2 id="ist-h">İki istasyon. <span class="muted">Toplam {sayi(sum(i['alan_m2'] for i in ist))} m².</span></h2></div>
      <div class="grid pv-tiles fill">{cards}</div>
    </div>
  </section>
  <section class="section" id="videolar" aria-labelledby="vid-h">
    <div class="wrap">
      <div class="section-head section-head--row"><h2 id="vid-h">İstasyon videoları</h2><a class="link" href="https://www.youtube.com/watch?v={pet['videolar'][3]}" rel="noopener">YouTube’da izleyin</a></div>
      <div class="grid pv-tiles fill">{vids}</div>
    </div>
  </section>
</main>
{footer(r, g[3], close_h='İstasyonlarımız için bizi arayın', close_p=f"{F['adres']['petrol']['ad']}: {F['adres']['petrol']['sokak']}, {F['adres']['petrol']['semt']}.")}{scripts(r)}'''
    write('petrol.html', s)

def haberler():
    r = ''
    news = S['haberler']
    s = head(r, 'Haberler: Sarıpekmez Grubu’ndan duyurular', 'Sarıpekmez Grubu’nun inşaat ve enerji alanındaki son haberleri.')
    s += f'''<body>
{nav(r, 'haberler')}<main id="top">
{hero_split('Sarıpekmez Grubu’ndan haberler', 'İnşaat, yapı malzemeleri ve enerji alanındaki çalışmalarımızdan duyurular. Son haber 20 Ocak 2026 tarihli.', f'{len(news)} haber', ('Haberleri okuyun', '#liste'), f"foto/{news[0]['gorsel']['dosya']}", news[0]['baslik'])}
  <section class="section" id="liste" aria-labelledby="liste-h">
    <div class="wrap">
      <div class="section-head"><h2 id="liste-h">Tüm haberler</h2></div>
      <div class="grid pv-tiles fill">{''.join(news_tile(r, n) for n in news)}</div>
    </div>
  </section>
</main>
{footer(r, kapak(BY['borsa-caddesi']))}{scripts(r)}'''
    write('haberler.html', s)
    for n in news:
        r = '../'
        body = ''.join(f'<h2>{e(b["x"])}</h2>' if b['t'] == 'h' else f'<p>{e(b["x"])}</p>' for b in n['govde'][1:])
        s = head(r, f'{n["baslik"]} · Sarıpekmez', n['govde'][0]['x'][:150] if n['govde'] else n['baslik'])
        s += f'''<body>
{nav(r, 'haberler')}<main id="top">
{hero_split(n['baslik'][:90], (n['govde'][0]['x'] if n['govde'] else ''), tarih(n['tarih']), ('Tüm haberler', '../haberler.html'), f"{r}foto/{n['gorsel']['dosya']}", n['baslik']).replace('class="hero hero--split"', 'class="hero hero--split pv-hero--long"')}
  <section class="section pv-article-sec" id="haber" aria-label="Haber metni">
    <div class="wrap"><article class="pv-article measure">{body}</article></div>
  </section>
</main>
{footer(r, kapak(BY['fatih-mah-aktug-sokak']))}{scripts(r)}'''
        write(f'haber/{n["slug"]}.html', s)

if __name__ == '__main__':
    ana(); projeler(); kurumsal(); petrol(); haberler()
    for p in PR: proje(p)
    print('üretildi:', N_PROJE, 'proje sayfası +', len(S['haberler']), 'haber + 5 sayfa')
