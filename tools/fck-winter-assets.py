"""F*ck winter: сирі PNG (зменшені на Маку) → covers/ prints/ (зі знаком) mockups/ (без знаку), webp.

  python3 tools/fck-winter-assets.py <тека з covers/ prints/> <вихід>   (мапа — tools/fixtures/fck-winter-map.json)
"""
import sys, json, unicodedata
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None
SRC = Path(sys.argv[1]); OUT = Path(sys.argv[2])
MAP = json.load(open(Path(__file__).resolve().parent / 'fixtures' / 'fck-winter-map.json'))
LOGO = Image.open(Path(__file__).resolve().parent / "fixtures" / "logo-lockup-2000.png").convert("RGBA")
for d in ('covers', 'prints', 'mockups'): (OUT / d).mkdir(parents=True, exist_ok=True)

def watermark(width):
    a = LOGO.getchannel('A')
    k = width / LOGO.width
    a = a.resize((width, round(LOGO.height * k)), Image.LANCZOS)
    pad = 12
    canvas = Image.new('L', (a.width + 2 * pad, a.height + 2 * pad), 0); canvas.paste(a, (pad, pad))
    halo = canvas.filter(ImageFilter.MaxFilter(9))  # ~ dilate disk:4
    wm = Image.new('RGBA', canvas.size, (255, 255, 255, 0))
    wm.putalpha(halo)
    black = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); black.putalpha(canvas)
    wm.alpha_composite(black)
    al = np.asarray(wm.getchannel('A')).astype(np.float32) * 0.26
    wm.putalpha(Image.fromarray(al.astype(np.uint8)))
    return wm

def trim(im):
    if im.mode == 'RGBA':
        bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if bb: im = im.crop(bb)
    return im

def fit(im, long):
    k = long / max(im.size)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)

def nfc(s): return unicodedata.normalize('NFC', s)
files = {nfc(p.name): p for p in SRC.rglob('*.png')}
for prefix, m in MAP.items():
    slug = m['slug']
    cov = next(p for n, p in files.items() if n.startswith(prefix + '_') and 'обложка' in n)
    art = next(p for n, p in files.items() if n.startswith(prefix + '_') and 'принт' in n)
    c = Image.open(cov)
    if 'A' in c.getbands():  # обкладинки приходять із прозорими полями по боках
        c = c.crop(c.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox())
    c = c.convert('RGB')
    c = c.resize((1200, round(1200 * c.height / c.width)), Image.LANCZOS)
    c.save(OUT / 'covers' / f'{slug}.webp', 'WEBP', quality=82, method=6)
    a = Image.open(art); a = a.convert('RGBA') if 'A' in a.getbands() or a.mode == 'P' else a.convert('RGB')
    a = trim(a)
    fit(a, 900).save(OUT / 'mockups' / f'{slug}.webp', 'WEBP', quality=85, method=6)
    big = fit(a, 1600).convert('RGBA')
    wm = watermark(round(0.55 * min(big.size)))
    big.alpha_composite(wm, ((big.width - wm.width) // 2, (big.height - wm.height) // 2))
    if a.mode == 'RGB': big = big.convert('RGB')
    big.save(OUT / 'prints' / f'{slug}.webp', 'WEBP', quality=85, method=6)
    print(slug, c.size, a.mode, a.size, big.size)
