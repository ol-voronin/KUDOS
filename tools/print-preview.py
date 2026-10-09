"""Орієнтовний вигляд принта: фото виробів і розташування принта на них.

Два кроки, обидва читають теки з iCloud як є:

  python3 tools/print-preview.py photos      "<Images for орієнтовний вигляд>"
  python3 tools/print-preview.py placements  "<Приклади розташування принтів>" "<Images for орієнтовний вигляд>"

── photos ──────────────────────────────────────────────────────────────

Файл `hcu_антична троянда.png` = виріб (скорочення) + колір українською.
Колір шукається за НАЗВОЮ в базі, не за транслітом — саме для цього
кольори й названо по-людськи. Кожне фото стискається до 1200 px і лягає в
`apps/web/public/garments-preview/<виріб>/<код кольору>.webp`, а реєстр
того, що є, — у `preview-photos.generated.ts`.

Класичну футболку (fcu) навмисно не чіпаємо: її плоскі фото лишаються
основою мокапа, бо виглядають нормально (рішення власника, вересень 2026).

── placements ──────────────────────────────────────────────────────────

Приклад — це фото виробу з уже накладеним принтом. Саме фото виробу в нас
є окремо (той самий кадр), тож РІЗНИЦЯ двох картинок і є принт. Далі:

  1. груба рамка з різниці;
  2. серед макетів колекції шукаємо той, що збігається;
  3. центр, масштаб і КУТ уточнюються, поки наш власний композит не
     збіжеться з прикладом (середня похибка ~1 з 255 на піксель).

Кут потрібен не для краси: на фотографіях «розкладкою» футболка лежить
під нахилом, і принт на ній теж.

Імʼя файлу визначає, на що діє розташування:
  babaka_v_pabi_fcu_ex  → уся колекція «Бабаки в пабі» на fcu;
  babaka_polo_hcu_ex    → уся колекція «Поло Бабаки» на hcu;
  Семюел Джексон_gfh_ex → лише цей принт (шукається за назвою чи slug-ом).

Результати складаються в `tools/fixtures/print-placements.json` (кеш: уже
пораховані приклади не перераховуються) і в `print-placement.generated.ts`.
Макети принтів беруться з публічного API — сайт має бути доступний.
"""
import json, os, subprocess, sys, time, unicodedata
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
PUBLIC = REPO / 'apps/web/public'
PREVIEW_DIR = PUBLIC / 'garments-preview'
GEN_DIR = REPO / 'apps/web/src/features/catalog'
CACHE = REPO / 'tools/fixtures/print-placements.json'
WORK = Path(os.environ.get('PRINT_PREVIEW_WORK', '/tmp/print-preview'))
API = os.environ.get('BABAKA_API', 'https://babaka.shop/api/v1')

GARMENTS = {
    'fcu': 'futbolka-klasychna',
    'fol': 'futbolka-oversayz-zhinocha',
    'fou': 'futbolka-oversayz-cholovicha',
    'gfs': 'hibryd-svitshot',
    'gfh': 'hibryd-hudi',
    'scu': 'svitshot-klasychnyi',
    'hcu': 'hudi-klasychnyi',
}
COLLECTION_PREFIXES = {
    'babaka_v_pabi': 'babaky-v-pabi',
    'babaka_polo': 'polo-babaky',
    'babaka_ua': 'babaka-ua',
    'babaky_z_zirkamy': 'zirky-z-babakamy',
    'КОЛЕКЦІЯ_F_CK WINTER': 'fck-winter',
}
KEEP_OLD_BASE = {'fcu'}

# Назви у файлах, що розходяться з назвами в базі. Кожен рядок — свідоме
# рішення, а не «схоже на»: сріблясто-сірий худі в базі живе як сталевий.
ALIASES = {
    'white': 'bilyi',
    'темний синій': 'temno-synii',
    'сріблястий сірий': 'stalevyi-siryi',
    'червонийe': 'chervonyi',
}

WEB_W = 1200


def nfc(s):
    return unicodedata.normalize('NFC', s)


def norm(name):
    s = nfc(name).lower().replace('’', '').replace("'", '').replace('ʼ', '')
    return ' '.join(s.replace('-', ' ').split())


def curl(url, out):
    for _ in range(8):
        r = subprocess.run(['curl', '-sS', '-f', '--max-time', '40', url, '-o', str(out)], capture_output=True)
        if r.returncode == 0 and out.exists() and out.stat().st_size > 0:
            return True
        time.sleep(1.5)
    raise SystemExit(f'не вдалося завантажити {url}')


def api_json(path, name):
    WORK.mkdir(parents=True, exist_ok=True)
    out = WORK / name
    if not out.exists():
        curl(f'{API}{path}', out)
    return json.loads(out.read_text())


def colour_codes():
    """Назва кольору → код. Беремо з будь-якого принта: API віддає всі кольори."""
    listing = api_json('/catalog/prints?limit=1', 'any-print.json')
    slug = listing['items'][0]['slug']
    detail = api_json(f'/catalog/prints/{slug}', f'{slug}.json')
    table = {norm(c['name']): c['supplierCode'] for c in detail['colours']}
    for alias, code in ALIASES.items():
        table[norm(alias)] = code
    return table


def parse_photo_name(fname):
    stem = nfc(Path(fname).stem)
    code, _, rest = stem.partition('_')
    for suffix in ('_front', '_nopeople'):
        rest = rest.replace(suffix, '')
    return code, rest


# ── photos ─────────────────────────────────────────────────────────────

def cmd_photos(src):
    table = colour_codes()
    registry, problems = {}, []
    for f in sorted(os.listdir(src)):
        if not f.lower().endswith('.png'):
            continue
        g, colour = parse_photo_name(f)
        if g not in GARMENTS:
            problems.append(f'{nfc(f)}: невідоме скорочення виробу «{g}»')
            continue
        if g in KEEP_OLD_BASE:
            continue
        code = table.get(norm(colour))
        if code is None:
            problems.append(f'{nfc(f)}: колір «{colour}» не знайдено в базі')
            continue
        slug = GARMENTS[g]
        out = PREVIEW_DIR / slug / f'{code}.webp'
        out.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(Path(src) / f).convert('RGB')
        im = im.resize((WEB_W, round(WEB_W * im.height / im.width)), Image.LANCZOS)
        im.save(out, 'WEBP', quality=80, method=6)
        registry.setdefault(slug, []).append(code)
        print(f'{nfc(f)} → {out.relative_to(PUBLIC)} ({out.stat().st_size // 1024} KB)')
    write_photos_ts(registry)
    for p in problems:
        print('!', p)


def write_photos_ts(registry):
    lines = [
        '/* ЗГЕНЕРОВАНО tools/print-preview.py photos. Не редагувати руками. */',
        '',
        '/** Які фото для орієнтовного вигляду є: `public/garments-preview/<виріб>/<колір>.webp`. */',
        'export const PREVIEW_PHOTOS: Readonly<Record<string, readonly string[]>> = {',
    ]
    for slug in sorted(registry):
        codes = ', '.join(f"'{c}'" for c in sorted(set(registry[slug])))
        lines.append(f"  '{slug}': [{codes}],")
    lines += ['};', '']
    (GEN_DIR / 'preview-photos.generated.ts').write_text('\n'.join(lines))


# ── placements ─────────────────────────────────────────────────────────

W, H = 3182, 4500  # кадр прикладів; фото виробів мають ті самі пропорції


def load_rgb(p, size=(W, H)):
    return np.asarray(Image.open(p).convert('RGB').resize(size, Image.LANCZOS)).astype(np.float32)


# Приклади для fcu зроблено на старому плоскому фото, покладеному на білий
# кадр. Масштаб і зсув виміряно раз за силуетом: 885 px футболки в
# паспортному фото → 3126 px у кадрі прикладу.
FCU_S = 3126 / 885
FCU_OX = 28 - 34 * FCU_S
FCU_OY = 662 - 27 * FCU_S
PASSPORT = PUBLIC / 'garments/futbolka-klasychna'


def fcu_base(code):
    p = Image.open(PASSPORT / f'{code}.webp').convert('RGBA')
    n = round(p.width * FCU_S)
    p = p.resize((n, n), Image.LANCZOS)
    c = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    c.alpha_composite(p, (round(FCU_OX), round(FCU_OY)))
    return np.asarray(c.convert('RGB')).astype(np.float32)


def fcu_to_passport(pl):
    """Рамку з кадру прикладу перекладаємо в частки квадратного паспортного фото."""
    side = 954
    cx = (pl['cx'] * W - FCU_OX) / FCU_S / side
    cy = (pl['cy'] * H - FCU_OY) / FCU_S / side
    return dict(pl, cx=cx, cy=cy, w=pl['w'] * W / FCU_S / side, h=pl['h'] * H / FCU_S / side)


def print_mockup(slug, meta):
    out = WORK / f'{slug}.webp'
    if not out.exists():
        curl(meta[slug]['mockup'], out)
    return np.asarray(Image.open(out).convert('RGBA')).astype(np.float32)


def all_prints():
    meta = {}
    cols = api_json('/catalog/collections', 'collections.json')['items']
    for c in cols:
        items = api_json(f"/catalog/prints?collection={c['slug']}&limit=200", f"coll-{c['slug']}.json")['items']
        for it in items:
            d = api_json(f"/catalog/prints/{it['slug']}", f"{it['slug']}.json")['print']
            meta[it['slug']] = dict(title=d['title'], collections=d['collectionSlugs'], mockup=d['mockupUrl'])
    return meta


def fit_example(E, B, cands, meta, wide=False):
    import cv2
    from scipy.optimize import minimize

    def render(base, pr, cx, cy, s, ang):
        h, w = pr.shape[:2]
        m = cv2.getRotationMatrix2D((w / 2, h / 2), ang, s)
        m[0, 2] += cx - w / 2
        m[1, 2] += cy - h / 2
        warped = cv2.warpAffine(pr, m, (base.shape[1], base.shape[0]), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
        a = warped[..., 3:4] / 255.0
        return base * (1 - a) + warped[..., :3] * a

    # груба рамка: де приклад відрізняється від голого виробу
    d = np.abs(E - B).max(axis=2)
    m = cv2.morphologyEx((d > 45).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, np.ones((91, 91), np.uint8)))
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    pts = np.column_stack(np.where((lab == k) & (m > 0))[::-1]).astype(np.float32)
    (cx, cy), (rw, rh), ang = cv2.minAreaRect(pts)
    if ang > 45: ang -= 90; rw, rh = rh, rw
    if ang < -45: ang += 90; rw, rh = rh, rw

    down = 4
    e = cv2.resize(E, (W // down, H // down), interpolation=cv2.INTER_AREA)
    b = cv2.resize(B, (W // down, H // down), interpolation=cv2.INTER_AREA)
    r = max(rw, rh) * 0.85 / down
    box = (int(max(0, cx / down - r)), int(max(0, cy / down - r)),
           int(min(W // down, cx / down + r)), int(min(H // down, cy / down + r)))

    def err(pr, p):
        x0, y0, x1, y1 = box
        rr = render(b[y0:y1, x0:x1], pr, p[0] - x0, p[1] - y0, p[2], p[3])
        return float(np.abs(rr - e[y0:y1, x0:x1]).mean())

    tries = []
    for slug in cands:
        pr = print_mockup(slug, meta)
        h, w = pr.shape[:2]
        half = cv2.resize(pr, (max(1, w // 2), max(1, h // 2)), interpolation=cv2.INTER_AREA)
        s0 = min(rw / w, rh / h) / down * 2
        angles = sorted({round(ang, 2), round(-ang, 2), -15.0, 0.0, 15.0})
        scales = (0.6, 0.7, 0.8, 0.9, 1.0, 1.1) if wide else (1.0,)
        if wide:
            angles = sorted(set(angles) | {-10.0, -5.0, 5.0, 10.0})
        for a0 in angles:
            for k in scales:
                for dx, dy in (((0, 0),) if not wide else [(i, j) for i in (-25, 0, 25) for j in (-25, 0, 25)]):
                    p0 = [cx / down + dx, cy / down + dy, s0 * k, a0]
                    tries.append((err(half, p0), slug, p0, half, (w, h)))
    # Груба оцінка вибирає погано, коли кут угадано не так: тоді «виграє»
    # вужчий чужий макет. Тож уточнюємо кілька найкращих і беремо того,
    # хто після уточнення збігся найточніше.
    tries.sort(key=lambda t: t[0])
    best = None
    for _, slug, p0, half, (w, h) in tries[:5]:
        simplex = [p0, [p0[0] + 3, *p0[1:]], [p0[0], p0[1] + 3, *p0[2:]],
                   [p0[0], p0[1], p0[2] * 1.04, p0[3]], [*p0[:3], p0[3] + 1.5]]
        res = minimize(lambda p: err(half, p), p0, method='Nelder-Mead',
                       options={'xatol': 0.05, 'fatol': 0.01, 'maxiter': 600, 'initial_simplex': simplex})
        if best is None or res.fun < best[0].fun:
            best = (res, slug, (w, h))
        if res.fun < 2.5:
            break
    res, slug, (w, h) = best
    x, y, sd, af = res.x
    s = sd * down / 2
    return dict(slug=slug, cx=x * down / W, cy=y * down / H, w=w * s / W, h=h * s / H,
                rot=-af, err=round(float(res.fun), 3))


def cmd_placements(ex_dir, src_dir):
    meta = all_prints()
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    by_title = {norm(m['title']): s for s, m in meta.items()}
    for f in sorted(os.listdir(ex_dir)):
        name = nfc(f)
        if not name.endswith('_ex.png'):
            continue
        stamp = os.stat(Path(ex_dir) / f).st_mtime
        if name in cache and cache[name].get('mtime') == stamp:
            continue
        prefix, g = name[:-len('_ex.png')].rsplit('_', 1)
        if g not in GARMENTS:
            print('!', name, ': невідоме скорочення виробу'); continue
        if prefix in COLLECTION_PREFIXES:
            scope = {'collection': COLLECTION_PREFIXES[prefix]}
            cands = [s for s, m in meta.items() if scope['collection'] in m['collections']]
        else:
            slug = prefix if prefix in meta else by_title.get(norm(prefix))
            if slug is None:
                print('!', name, ': такого принта немає'); continue
            scope = {'print': slug}
            cands = [slug]
        E = load_rgb(Path(ex_dir) / f)
        # голий виріб того самого кольору: найближчий кадр серед фото виробу
        if g == 'fcu':
            options = [(c, (lambda c=c: fcu_base(c))) for c in ('chornyi', 'bilyi', 'slonova-kistka')]
        else:
            options = [(p, (lambda p=p: load_rgb(Path(src_dir) / p)))
                       for p in sorted(os.listdir(src_dir)) if nfc(p).startswith(g + '_')]
        small = E[::16, ::16]
        scored = []
        for label, ld in options:
            B = ld()
            scored.append((float(np.median(np.abs(small - B[::16, ::16]))), label, B))
        _, base_label, B = min(scored, key=lambda t: t[0])
        r = fit_example(E, B, cands, meta)
        r.update(scope, garment=GARMENTS[g], example=name, base=nfc(base_label), mtime=stamp)
        cache[name] = r
        print(json.dumps({k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()}, ensure_ascii=False))
    # Другий прохід. У колекції всі приклади зроблено ОДНИМ принтом; якщо
    # якийсь приклад «знайшов» інший принт і збігся погано — це промах
    # грубої рамки, а не інший принт. Переміряємо його тим, що в більшості,
    # із ширшим перебором масштабу й кута.
    from collections import Counter
    groups = {}
    for r in cache.values():
        if 'collection' in r:
            groups.setdefault(r['collection'], []).append(r)
    for coll, rows in groups.items():
        major = Counter(r['slug'] for r in rows).most_common(1)[0][0]
        for r in rows:
            if r['err'] <= 2.5 and r['slug'] == major:
                continue
            ex = Path(ex_dir) / next(f for f in os.listdir(ex_dir) if nfc(f) == r['example'])
            E = load_rgb(ex)
            g = next(k for k, v in GARMENTS.items() if v == r['garment'])
            if g == 'fcu':
                B = fcu_base(r['base'])
            else:
                B = load_rgb(Path(src_dir) / next(p for p in os.listdir(src_dir) if nfc(p) == r['base']))
            again = fit_example(E, B, [major], meta, wide=True)
            if again['err'] < r['err']:
                r.update(again)
                print('переміряно', r['example'], json.dumps(again, ensure_ascii=False))
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
    write_placements_ts(cache, meta)


def aspect(slug, meta):
    pr = print_mockup(slug, meta)
    return pr.shape[1] / pr.shape[0]


def write_placements_ts(cache, meta):
    photo_aspect = W / H
    by_collection, by_print = {}, {}
    for r in cache.values():
        pl = {k: r[k] for k in ('cx', 'cy', 'w', 'h', 'rot')}
        if 'collection' in r:
            # Рамка колекції тримає ВИСОТУ прикладу, а ширину відкриває під
            # найширший макет колекції: у «Поло» фігурки різної ширини, але
            # одного зросту, і всі мають стояти однаково.
            widest = max(aspect(s, meta) for s, m in meta.items() if r['collection'] in m['collections'])
            own = r['w'] / r['h'] / photo_aspect
            if widest > own:
                pl['w'] = r['h'] * widest * photo_aspect
            by_collection.setdefault(r['collection'], {})[r['garment']] = pl
        else:
            by_print.setdefault(r['print'], {})[r['garment']] = pl
    for group in (by_collection, by_print):
        for key in group:
            if 'futbolka-klasychna' in group[key]:
                group[key]['futbolka-klasychna'] = fcu_to_passport(group[key]['futbolka-klasychna'])

    def fmt(pl):
        return '{ ' + ', '.join(f'{k}: {pl[k]:.4f}' for k in ('cx', 'cy', 'w', 'h', 'rot')) + ' }'

    def block(name, group, doc):
        out = [f'/** {doc} */', f'export const {name}: Readonly<Record<string, Readonly<Record<string, Placement>>>> = {{']
        for key in sorted(group):
            out.append(f"  '{key}': {{")
            for g in sorted(group[key]):
                out.append(f"    '{g}': {fmt(group[key][g])},")
            out.append('  },')
        return out + ['};', '']

    lines = [
        '/* ЗГЕНЕРОВАНО tools/print-preview.py placements. Не редагувати руками. */',
        '',
        "import type { Placement } from './print-placement';",
        '',
        *block('COLLECTION_PLACEMENTS', by_collection, 'Колекція → виріб → рамка принта (з прикладу розташування).'),
        *block('PRINT_PLACEMENTS', by_print, 'Окремий принт → виріб → рамка. Перекриває колекцію.'),
    ]
    (GEN_DIR / 'print-placement.generated.ts').write_text('\n'.join(lines))
    print('записано', GEN_DIR / 'print-placement.generated.ts')


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'photos':
        cmd_photos(sys.argv[2])
    elif len(sys.argv) >= 4 and sys.argv[1] == 'placements':
        cmd_placements(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
        sys.exit(1)
