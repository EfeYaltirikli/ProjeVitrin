"""Firma fotoğraflarındaki yan dolguları (çizgili desen, bulanık kopya, beyaz) kırpar, hafif ton ve netlik düzeltmesi yapar.
Kat planlarına ton düzeltmesi uygulanmaz, yalnız kırpılır.
Kullanım: python3 araclar/foto_temizle.py <foto_klasörü> [--dene dosya ...]"""
import sys, os, json
import numpy as np
from PIL import Image, ImageOps, ImageFilter

def bounds(img):
    g = img.convert('L'); a = np.asarray(g, dtype=np.float32); h, w = a.shape
    hsv = np.asarray(img.convert('HSV'), dtype=np.float32)
    sat = hsv[..., 1].mean(axis=0); bri = a.mean(axis=0)
    e = np.abs(np.diff(a, axis=0)).mean(axis=0) + np.abs(np.diff(a, axis=1, append=a[:, -1:])).mean(axis=0)
    k = 9; es = np.convolve(e, np.ones(k) / k, mode='same')
    mid = np.median(es[int(w * 0.35):int(w * 0.65)])
    hatch = (bri > 190) & (sat < 22)
    pad = (es < 0.38 * mid) | hatch | (a.std(axis=0) < 4)
    x0 = 0
    while x0 < w // 2 and pad[x0]: x0 += 1
    x1 = w
    while x1 > w // 2 and pad[x1 - 1]: x1 -= 1
    if x0 < w * 0.04: x0 = 0
    if w - x1 < w * 0.04: x1 = w
    d = np.abs(np.diff(a, axis=1)); frac = (d > 18).mean(axis=0)
    def snap(x, lo, hi):  # en güçlü dikey kenara oturt
        lo, hi = max(1, lo), min(w - 2, hi)
        if hi <= lo: return x
        return int(lo + np.argmax(frac[lo:hi])) + 1
    if x0: x0 = snap(x0, x0 - 14, x0 + 14)
    if x1 < w: x1 = snap(x1, x1 - 14, x1 + 14)
    if x1 - x0 < w * 0.3: return 0, w
    if (w - (x1 - x0)) < w * 0.15: return 0, w   # dolgu değil (gökyüzü, düz cephe)
    return x0, x1

def clean(path, ton=True, kirp=True):
    img = Image.open(path).convert('RGB'); w, h = img.size
    x0, x1 = bounds(img) if kirp else (0, w)
    changed = (x0, x1) != (0, w)
    if changed: img = img.crop((x0 + 2 if x0 else 0, 0, x1 - 2 if x1 < w else w, h))
    if ton:
        img = ImageOps.autocontrast(img, cutoff=0.4)
        img = img.filter(ImageFilter.UnsharpMask(radius=1.1, percent=55, threshold=2))
    return img, changed, (x0, x1)

if __name__ == '__main__':
    root = sys.argv[1]
    if '--dene' in sys.argv:
        out = sys.argv[sys.argv.index('--dene') + 1:]
        for f in out:
            img, ch, b = clean(os.path.join(root, f)); print(f, ch, b, img.size)
            img.save('/private/tmp/claude-501/-Users-efeyaltirikli/e0070c24-b96d-4d11-b554-9853b5f862aa/scratchpad/temiz_' + f.replace('/', '_') + '.png')
        sys.exit()
    meta = json.load(open(os.path.join(root, '_ham_projeler.json')))
    n = 0
    for p in meta:
        for g, lst in p['gorseller'].items():
            for im in lst:
                if im.get('temiz'): continue
                fp = os.path.join(root, im['dosya'])
                img, ch, b = clean(fp, ton=(g != 'plan'), kirp=(g != 'plan' and not im.get('kirpma')))
                img.save(fp, 'WEBP', quality=80, method=6)
                im['w'], im['h'] = img.size; im['temiz'] = True; im['kirpildi'] = ch; n += ch
    json.dump(meta, open(os.path.join(root, '_ham_projeler.json'), 'w'), ensure_ascii=False, indent=1)
    print('kırpılan:', n)
