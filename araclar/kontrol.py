"""Sayfayı başsız Chromium'da açar, konsol hatalarını toplar, ekran görüntüleri alır.
Kullanım: python3 araclar/kontrol.py [çıktı_klasörü] [genişlik] [yükseklik]"""
import sys, os, asyncio, json
from playwright.async_api import async_playwright
OUT = sys.argv[1] if len(sys.argv) > 1 else 'qa'
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1440
H = int(sys.argv[3]) if len(sys.argv) > 3 else 900
URL = os.environ.get('URL', 'http://127.0.0.1:8765/projeler/saripekmez-71-evler/')
STEPS = os.environ.get('STEPS', 'all')
os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
        pg.on('requestfailed', lambda r: logs.append(f'[reqfail] {r.url}'))
        try:
            await steps(pg)
        finally:
            print('\n'.join(logs) or 'konsol temiz')
            await b.close()
async def steps(pg):
        await pg.goto(URL, wait_until='networkidle')
        await pg.wait_for_timeout(3500)
        await pg.screenshot(path=f'{OUT}/01_hero.png')
        for i, sel in enumerate(['#proje', '#daireler']):
            await pg.evaluate(f"document.querySelector('{sel}').scrollIntoView()"); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'{OUT}/0{i+2}_{sel[1:]}.png')
        # daire detayı
        await pg.click('.pv-unit'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=f'{OUT}/04_detay.png')
        await pg.evaluate("document.querySelector('#tur').scrollIntoView()"); await pg.wait_for_timeout(4500)
        await pg.screenshot(path=f'{OUT}/05_tur_maket.png')
        await pg.click('.pv-seg button:nth-child(1)'); await pg.wait_for_timeout(2200)
        await pg.screenshot(path=f'{OUT}/06_tur_kroki.png')
        for rid in ['salon', 'mutfak', 'yatak1', 'banyo', 'yatak3', 'hol']:
            await pg.click(f'.pv-room[data-id="{rid}"]'); await pg.wait_for_timeout(2600)
            await pg.screenshot(path=f'{OUT}/07_ic_{rid}.png')
        await pg.evaluate("document.querySelector('#konum').scrollIntoView()"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=f'{OUT}/08_konum.png')
        await pg.evaluate("document.querySelector('#iletisim').scrollIntoView()"); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'{OUT}/09_iletisim.png')
        ov = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        print('yatay taşma px:', ov)
asyncio.run(main())
