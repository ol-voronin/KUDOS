"""Рахує зону друку для КОЖНОГО фото виробу й малює контрольний аркуш.

Зона виводиться з силуету, а не задається руками: фон рівний, виріб
темніший, тож силует відділяється порогом. Опорні точки — лінія плечей
(перший рядок, де ширина перевалює за 0.55 від найбільшої: у худі це плечі
ПІД капюшоном) і ширина корпусу під пахвами.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path('apps/web/public/garments')
ART = Path('tools/fixtures/print-sample.webp')
K_W = float(sys.argv[1]) if len(sys.argv) > 1 else 0.42
K_T = float(sys.argv[2]) if len(sys.argv) > 2 else 0.16
# Худі: капюшон і шнурки займають верх, тож друк опускаємо нижче.
HOOD_EXTRA = {'hudi-klasychnyi': 0.06, 'hibryd-hudi': 0.04}

def measure(path, bg_tol=18):
    im = Image.open(path).convert('L'); w, h = im.size; px = im.load(); bg = px[2, 2]
    rows = []
    for y in range(h):
        xs = [x for x in range(w) if abs(px[x, y] - bg) > bg_tol]
        rows.append((min(xs), max(xs)) if xs else None)
    filled = [(y, l, r) for y, lr in enumerate(rows) if lr for l, r in [lr]]
    if not filled: return None
    top, bottom = filled[0][0], filled[-1][0]
    maxW = max(r - l for _, l, r in filled)
    sy = next(y for y, l, r in filled if (r - l) >= 0.55 * maxW)
    hBody = bottom - sy
    sl, sr = rows[sy]
    # Ширину беремо ПО ПЛЕЧАХ, а не по корпусу: будь-який горизонтальний
    # заміряр нижче захоплює рукави, і в світшота з довгим рукавом «корпус»
    # виходить на третину ширший, ніж у футболки. Плечі ж є в усіх однакові
    # за змістом — і саме від них у житті відмірюють друк.
    return dict(w=w, h=h, sy=sy, hBody=hBody, bodyW=sr - sl, cx=(sl + sr) / 2)

areas, tiles, failed = {}, [], []
want = ['futbolka-klasychna', 'futbolka-oversayz-zhinocha', 'futbolka-oversayz-cholovicha',
        'hibryd-svitshot', 'hibryd-hudi', 'svitshot-klasychnyi', 'hudi-klasychnyi']
art = Image.open(ART).convert('RGBA')

def median(xs):
    xs = sorted(xs)
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2

# Зона рахується по КОЖНОМУ кольору, а потім береться медіана по виробу.
# Кадри одного виробу мали б збігатися, але не збігаються: у худі розміри
# файлів гуляють 343–356 px, а лінія плечей — на 3% висоти. Медіана гасить
# і цей дрейф, і поодинокі промахи порогу на світлих речах.
for name in sorted(p.name for p in ROOT.iterdir() if p.is_dir()):
    extra = HOOD_EXTRA.get(name, 0.0)
    xs, ys, ws = [], [], []
    for p in sorted((ROOT / name).glob('*.webp')):
        m = measure(p)
        if not m or m['bodyW'] < 0.2 * m['w'] or m['hBody'] < 0.2 * m['h']:
            failed.append(f"{name}/{p.stem}")
            continue
        pw = m['bodyW'] * K_W
        xs.append((m['cx'] - pw / 2) / m['w'])
        ys.append((m['sy'] + m['hBody'] * (K_T + extra)) / m['h'])
        ws.append(pw / m['w'])
    if not ws:
        continue
    areas[name] = dict(x=round(median(xs), 4), y=round(median(ys), 4), w=round(median(ws), 4),
                       n=len(ws))

lines = [
    '/* ЗГЕНЕРОВАНО tools/gen-print-areas.py. Не редагувати руками. */',
    '',
    "import type { PrintArea } from './print-area';",
    '',
    'export const GENERATED_AREAS: Readonly<Record<string, PrintArea>> = {',
]
for k in sorted(areas):
    a = areas[k]
    lines.append(f"  '{k}': {{ x: {a['x']}, y: {a['y']}, w: {a['w']} }},")
lines += ['};', '']
Path('apps/web/src/features/catalog/print-area.generated.ts').write_text('\n'.join(lines))

for name in want:
    p = next((q for q in sorted((ROOT / name).glob('*.webp')) if 'chornyi' in q.name),
             sorted((ROOT / name).glob('*.webp'))[0])
    a = areas[name]
    im = Image.open(p).convert('RGBA')
    pw = a['w'] * im.width
    sc = art.resize((int(pw), int(pw * art.height / art.width)), Image.LANCZOS)
    im.alpha_composite(sc, (int(a['x'] * im.width), int(a['y'] * im.height)))
    d = ImageDraw.Draw(im)
    d.line([(im.width / 2, 0), (im.width / 2, im.height)], fill=(0, 220, 0, 150), width=2)
    d.line([(0, a['y'] * im.height), (im.width, a['y'] * im.height)], fill=(0, 220, 0, 150), width=2)
    tiles.append(im.convert('RGB'))

TH = 300
sheet = Image.new('RGB', (TH * len(tiles), TH), (238, 238, 238))
for i, im in enumerate(tiles):
    sheet.paste(im.resize((TH, TH), Image.LANCZOS), (i * TH, 0))
sheet.save('/tmp/print-area-preview.png')
print(f'K_W={K_W} K_T={K_T}')
for k, a in areas.items():
    print(f"  {k:32s} x={a['x']:.3f} y={a['y']:.3f} w={a['w']:.3f}  (кадрів {a['n']})")
if failed:
    print('силует не зчитався:', ', '.join(failed))
