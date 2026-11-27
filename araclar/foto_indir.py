"""Sarıpekmez proje fotoğraflarını yerel kopyalar: WebP, en uzun kenar 1600 px. Proje listesi + bilgi JSON'u üretir.
Kullanım: python3 araclar/foto_indir.py <ham_html_klasörü> <çıktı_site_klasörü>"""
import sys, os, re, json, html, io, time, urllib.request
from PIL import Image
SRC, OUT = sys.argv[1], sys.argv[2]
BASE = 'https://www.saripekmez.com.tr/public/uploads/'
def get(url):
    r = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(r, timeout=40).read()
projeler = []
for fn in sorted(os.listdir(SRC)):
    if not fn.endswith('.html'): continue
    slug = fn[:-5]; h = open(os.path.join(SRC, fn), encoding='utf-8', errors='ignore').read()
    title = html.unescape(re.search(r'<title>([^|<]+)', h).group(1).strip())
    body = re.sub(r'(?s)<(script|style)[^>]*>.*?</\1>', '', h)
    t = [l.strip() for l in html.unescape(re.sub(r'<[^>]+>', '\n', body)).split('\n') if l.strip()]
    i = max(k for k, l in enumerate(t) if l == title); j = next(k for k in range(i, len(t)) if t[k] == 'İletişim')
    info = [x for x in t[i + 1:j] if x not in ('Sarı Pekmez', 'Proje Görselleri', 'Kat Planları', 'Yapım Aşamaları')]
    # sayfadaki sıra korunarak görseller
    imgs = []
    for m in re.findall(r'href="/?public/uploads/([^"]+\.(?:jpe?g|png|webp))"', h):
        if m not in imgs: imgs.append(m)
    groups = {'kapak': [], 'proje': [], 'plan': [], 'yapim': []}
    for im in imgs:
        g = 'proje' if im.startswith('proje-gorselleri') else 'plan' if im.startswith('kat-planlari') else 'yapim' if im.startswith('yapim-asamalari') else 'kapak'
        groups[g].append(im)
    d = os.path.join(OUT, slug); os.makedirs(d, exist_ok=True)
    saved = {k: [] for k in groups}
    for g, lst in groups.items():
        for n, im in enumerate(lst):
            name = f'{g}-{n + 1:02d}.webp'; dst = os.path.join(d, name)
            if not os.path.exists(dst):
                try:
                    raw = get(BASE + im); img = Image.open(io.BytesIO(raw)).convert('RGB')
                    img.thumbnail((1600, 1600), Image.LANCZOS); img.save(dst, 'WEBP', quality=78, method=6)
                    time.sleep(0.15)
                except Exception as e:
                    print('HATA', slug, im, e); continue
            w, hh = Image.open(dst).size
            saved[g].append({'dosya': f'{slug}/{name}', 'w': w, 'h': hh, 'kaynak': BASE + im})
    projeler.append({'slug': slug, 'ad': title, 'bilgi': info, 'gorseller': saved})
    print(slug, {k: len(v) for k, v in saved.items()})
json.dump(projeler, open(os.path.join(OUT, '_ham_projeler.json'), 'w'), ensure_ascii=False, indent=1)
