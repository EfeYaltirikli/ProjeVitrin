#!/usr/bin/env python3
"""ProjeVitrin yerel sunucusu. Çalıştırınca tarayıcıda projeyi açar."""
import http.server, socketserver, webbrowser, os, sys, threading
PORT = int(os.environ.get('PORT', 8765))
ROOT = os.path.dirname(os.path.abspath(__file__))
HEDEF = sys.argv[1] if len(sys.argv) > 1 else 'siteler/saripekmez'
if '/' not in HEDEF: HEDEF = 'projeler/' + HEDEF
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp'}
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
import urllib.request

def ac(url):
    print('ProjeVitrin çalışıyor:', url, '\nKapatmak için bu pencereyi kapatın (veya Ctrl+C).')
    if os.environ.get('NO_BROWSER') != '1': threading.Timer(0.6, lambda: webbrowser.open(url)).start()

def bizim_sunucu(port):
    try:
        urllib.request.urlopen(f'http://127.0.0.1:{port}/sunucu.py', timeout=1); return True
    except Exception: return False

for port in range(PORT, PORT + 20):
    try:
        srv = socketserver.ThreadingTCPServer(('127.0.0.1', port), H)
    except OSError:
        if bizim_sunucu(port):   # zaten açık bir ProjeVitrin sunucusu var: onu kullan
            url = f'http://127.0.0.1:{port}/{HEDEF}/'
            print('Sunucu zaten açık, sayfa açılıyor:', url)
            if os.environ.get('NO_BROWSER') != '1': webbrowser.open(url)
            sys.exit(0)
        continue
    with srv:
        ac(f'http://127.0.0.1:{port}/{HEDEF}/')
        try: srv.serve_forever()
        except KeyboardInterrupt: pass
    break
else:
    print('Boş port bulunamadı (8765-8784).')
