import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

D = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(D, 'fonts'); I = os.path.join(D, 'img'); O = os.path.join(D, 'posts')
os.makedirs(O, exist_ok=True)
W, H, P = 1080, 1350, 72

INK = (11, 11, 11); PAPER = (246, 246, 243); LINE = (228, 228, 223); RED = (223, 42, 53)
YEL = (253, 202, 65); TEAL = (14, 107, 96); BLUE = (58, 90, 133); WHITE = (255, 255, 255); GREY = (107, 107, 101)

def font(kind, size):
    return ImageFont.truetype(os.path.join(F, {'disp': 'Unbounded-800.ttf', 'b': 'Onest-700.ttf', 'm': 'Onest-500.ttf'}[kind]), size)

def wrap(d, text, f, maxw):
    lines = []
    for para in text.split('\n'):
        cur = ''
        for w in para.split(' '):
            t = (cur + ' ' + w).strip()
            if d.textlength(t, font=f) <= maxw: cur = t
            else:
                if cur: lines.append(cur)
                cur = w
        lines.append(cur)
    return lines

OVER = []
def text_block(d, xy, text, kind, size, color, maxw, lh=1.12, minsize=None, maxlines=None, name=''):
    x, y = xy
    while True:
        f = font(kind, size); lines = wrap(d, text, f, maxw)
        widest = max(d.textlength(l, font=f) for l in lines)
        if (maxlines is None or len(lines) <= maxlines) and widest <= maxw: break
        if minsize and size > minsize: size -= 2; continue
        OVER.append((name, text, size)); break
    for l in lines:
        d.text((x, y), l, font=f, fill=color); y += int(size * lh)
    return y, size

def pill(d, xy, text, bg, fg, size=26, pad=(22, 12), anchor_right=False):
    f = font('b', size); tw = d.textlength(text, font=f)
    x, y = xy
    if anchor_right: x = x - tw - 2 * pad[0]
    d.rounded_rectangle([x, y, x + tw + 2 * pad[0], y + size + 2 * pad[1] + 4], radius=999, fill=bg)
    d.text((x + pad[0], y + pad[1] - 2), text, font=f, fill=fg)
    return x + tw + 2 * pad[0]

def chrome(img, d, bg, fg, tag, tagbg, tagfg):
    d.text((P, P - 8), 'БАБАКА', font=font('disp', 40), fill=fg)
    pill(d, (W - P, P - 10), tag, tagbg, tagfg, anchor_right=True)
    fb = font('b', 28)
    d.text((P, H - P - 30), 'babaka.shop', font=fb, fill=fg)
    t = '@babaka_club'; d.text((W - P - d.textlength(t, font=fb), H - P - 30), t, font=fb, fill=fg)

def paste_card(img, path, box, bg=WHITE, radius=36, pad=24, mode='fit'):
    x0, y0, x1, y1 = box
    card = Image.new('RGB', (x1 - x0, y1 - y0), bg)
    src = Image.open(os.path.join(I, path)).convert('RGBA')
    inner = (card.width - 2 * pad, card.height - 2 * pad)
    if mode == 'fit':
        src.thumbnail(inner, Image.LANCZOS)
        card.paste(src, ((card.width - src.width) // 2, (card.height - src.height) // 2), src)
    else:
        src = ImageOps.fit(src, inner, Image.LANCZOS, centering=(0.5, 0.42))
        card.paste(src, (pad, pad), src)
    mask = Image.new('L', card.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, card.width - 1, card.height - 1], radius=radius, fill=255)
    img.paste(card, (x0, y0), mask)

def new(bg):
    img = Image.new('RGB', (W, H), bg); return img, ImageDraw.Draw(img)

def head(d, title, sub, fg, subfg, y=170, hsize=88, maxlines=3, ssize=36):
    y, hs = text_block(d, (P, y), title.upper(), 'disp', hsize, fg, W - 2 * P, lh=1.08, minsize=64, maxlines=maxlines, name=title)
    y += 18
    y, _ = text_block(d, (P, y), sub, 'm', ssize, subfg, W - 2 * P, lh=1.3, name=sub)
    return y, hs

posts = []

# 01 intro
def p01():
    img, d = new(PAPER); chrome(img, d, PAPER, INK, 'ПРО НАС', INK, WHITE)
    y, _ = head(d, 'Ми — БАБАКА', 'Друкуємо одяг з собаками. У Харкові. З любов’ю і шерстю на светрі.', INK, GREY)
    top = y + 36; bottom = H - P - 60; gap = 20
    cw = (W - 2 * P - gap) // 2; ch = (bottom - top - gap) // 2
    for i, f in enumerate(['pab-korhi.webp', 'pab-taksa-i-york.webp', 'pab-mops.webp', 'pab-frantsuz.webp']):
        cx = P + (i % 2) * (cw + gap); cy = top + (i // 2) * (ch + gap)
        paste_card(img, f, (cx, cy, cx + cw, cy + ch), pad=0, mode='fill', radius=28)
    pill(d, (P + 18, top + 18), 'ХАРКІВ', RED, WHITE, size=26)
    return img
posts.append(('01 Знайомство — Ми БАБАКА', p01))

def breed(bg, fg, subfg, tag, tagbg, tagfg, title, sub, imgf, card=WHITE, mode='fit'):
    img, d = new(bg); chrome(img, d, bg, fg, tag, tagbg, tagfg)
    y, _ = head(d, title, sub, fg, subfg)
    paste_card(img, imgf, (P, y + 36, W - P, H - P - 60), bg=card, mode=mode)
    return img

posts.append(('02 Порода тижня — Такса', lambda: breed(YEL, INK, INK, 'ПОРОДА ТИЖНЯ', INK, WHITE, 'Такса. Довга історія', 'Принти з таксами для тих, хто розуміє.', 'pab-taksa-i-york.webp')))

# 03 custom
def p03():
    img, d = new(PAPER); chrome(img, d, PAPER, INK, 'ПРИНТ З ФОТО', RED, WHITE)
    y, _ = head(d, 'Твій пес. Твій принт', 'Надішли фото — ми адаптуємо його в принт. +200 ₴ за місце нанесення.', INK, GREY)
    top = y + 40; bottom = H - P - 60; gap = 90; cw = (W - 2 * P - gap) // 2
    x0 = P; d.rounded_rectangle([x0, top, x0 + cw, bottom], radius=36, outline=INK, width=5)
    for yy in range(top + 20, bottom - 20, 36):  # dashed look via paper gaps
        d.line([(x0, yy), (x0, yy + 16)], fill=PAPER, width=7); d.line([(x0 + cw, yy), (x0 + cw, yy + 16)], fill=PAPER, width=7)
    cx, cy = x0 + cw // 2, (top + bottom) // 2 - 30
    d.rounded_rectangle([cx - 70, cy - 46, cx + 70, cy + 54], radius=18, outline=INK, width=6)
    d.rectangle([cx - 30, cy - 66, cx + 30, cy - 46], fill=INK)
    d.ellipse([cx - 30, cy - 22, cx + 30, cy + 38], outline=INK, width=6)
    f = font('b', 30); t = 'ТВОЄ ФОТО'; d.text((cx - d.textlength(t, font=f) / 2, cy + 86), t, font=f, fill=INK)
    ax = x0 + cw + 18; ay = (top + bottom) // 2
    d.line([(ax, ay), (ax + gap - 40, ay)], fill=RED, width=10)
    d.polygon([(ax + gap - 36, ay - 24), (ax + gap - 8, ay), (ax + gap - 36, ay + 24)], fill=RED)
    paste_card(img, 'pab-korhi.webp', (x0 + cw + gap, top, W - P, bottom))
    f = font('b', 26); t = 'ТВІЙ ПРИНТ'; tx = x0 + cw + gap + cw // 2
    pill(d, (tx - (d.textlength(t, font=f) + 44) / 2, bottom - 74), t, INK, WHITE)
    return img
posts.append(('03 Портрет з фото — Твій пес твій принт', p03))

# 04 BTS
def p04():
    img, d = new(INK); chrome(img, d, INK, WHITE, 'ЗАКУЛІССЯ', YEL, INK)
    y, _ = head(d, 'Друкуємо в Харкові', 'Від файлу принта до коробки на Новій пошті.', WHITE, (201, 201, 194))
    f = font('disp', 200); d.text((P - 6, y + 30), '4–7', font=f, fill=YEL)
    f2 = font('b', 40); d.text((P, y + 30 + 230), 'робочих днів на кожне замовлення', font=f2, fill=WHITE)
    steps = ['Принт', 'Друк', 'Перевірка', 'Пакування']
    top = y + 30 + 320; bottom = H - P - 70; gap = 16; cw = (W - 2 * P - 3 * gap) // 4
    for i, s in enumerate(steps):
        x = P + i * (cw + gap); d.rounded_rectangle([x, top, x + cw, bottom], radius=28, fill=(30, 30, 28))
        d.text((x + 24, top + 22), f'0{i+1}', font=font('disp', 44), fill=RED)
        text_block(d, (x + 24, bottom - 64), s, 'b', 32, WHITE, cw - 40, minsize=24, maxlines=1, name=s)
    return img
posts.append(('04 Закулісся — Друкуємо в Харкові', p04))

posts.append(('05 Порода тижня — Мопс у пабі', lambda: breed(INK, WHITE, (201, 201, 194), 'БАБАКИ В ПАБІ', YEL, INK, 'Мопс у пабі', 'Колекція «Бабаки в пабі»: бо п’ятниця в кожного своя.', 'pab-mops.webp')))

# 06 humor
def p06():
    img, d = new(YEL); chrome(img, d, YEL, INK, 'БОНЯ І ПАШТЕТ', INK, WHITE)
    top = 200; d.rounded_rectangle([P, top, W - P, H - P - 70], radius=40, fill=PAPER)
    d.text((P + 56, top + 56), 'ОФІЦІЙНА ЗАЯВА', font=font('b', 30), fill=GREY)
    y, _ = text_block(d, (P + 56, top + 120), 'ТАК, ВІН КІТ', 'disp', 130, INK, W - 2 * P - 112, lh=1.02, minsize=64, maxlines=2, name='так він кіт')
    y += 30
    y, _ = text_block(d, (P + 56, y), 'Паштет — наш відділ контролю якості. Перевіряє кожен світшот на вміст шерсті.', 'm', 40, INK, W - 2 * P - 112, lh=1.3, name='06sub')
    # stamp
    sx, sy = W - P - 380, H - P - 70 - 250
    st = Image.new('RGBA', (380, 170), (0, 0, 0, 0)); sd = ImageDraw.Draw(st)
    sd.rounded_rectangle([6, 6, 374, 164], radius=24, outline=RED + (255,), width=8)
    f = font('disp', 34);
    for i, t in enumerate(['ПЕРЕВІРЕНО', 'ПАШТЕТОМ']):
        sd.text((190 - sd.textlength(t, font=f) / 2, 30 + i * 56), t, font=f, fill=RED + (255,))
    st = st.rotate(8, expand=True, resample=Image.BICUBIC); img.paste(st, (sx - 20, sy - 10), st)
    d.text((P + 56, H - P - 70 - 90), 'Боня: «Я тут модель».', font=font('b', 32), fill=INK)
    return img
posts.append(('06 Боня і Паштет — Так він кіт', p06))

# 07 FAQ
def p07():
    img, d = new(PAPER); chrome(img, d, PAPER, INK, 'FAQ', INK, WHITE)
    y, _ = head(d, 'Питаєте — відповідаємо', 'Три питання, які нам ставлять найчастіше.', INK, GREY)
    items = [('ОПЛАТА', 'Гроші під захистом банку до підтвердження замовлення', RED),
             ('ДОСТАВКА', 'Новою поштою по всій Україні', TEAL),
             ('ТЕРМІН', '4–7 робочих днів на виготовлення', INK)]
    top = y + 40; bottom = H - P - 70; gap = 18; ch = (bottom - top - 2 * gap) // 3
    for i, (k, v, c) in enumerate(items):
        cy = top + i * (ch + gap); d.rounded_rectangle([P, cy, W - P, cy + ch], radius=28, fill=WHITE, outline=LINE, width=3)
        d.rounded_rectangle([P, cy, P + 18, cy + ch], radius=9, fill=c)
        d.text((P + 50, cy + 30), k, font=font('disp', 34), fill=c)
        text_block(d, (P + 50, cy + 84), v, 'm', 36, INK, W - 2 * P - 90, lh=1.25, name=v)
    return img
posts.append(('07 FAQ — Питаєте відповідаємо', p07))

posts.append(('08 Порода тижня — Коргі', lambda: breed(TEAL, WHITE, (234, 243, 241), 'ПОРОДА ТИЖНЯ', YEL, INK, 'Коргі. Низько літає', 'Принти для власників найпухнастіших булочок.', 'polo-korhi.webp', card=(253, 235, 209), mode='fill')))

# 09 UGC
def p09():
    img, d = new(INK); chrome(img, d, INK, WHITE, 'ВАШІ БАБАКИ', RED, WHITE)
    y, _ = head(d, 'Покажи свого пса', 'Фото в одязі БАБАКА + відмітка @babaka_club = ти в нашій стрічці.', WHITE, (201, 201, 194))
    top = y + 50; bottom = H - P - 80; pw = 560; px = (W - pw) // 2
    pol = Image.new('RGBA', (pw, bottom - top), (0, 0, 0, 0)); pd = ImageDraw.Draw(pol)
    pd.rectangle([0, 0, pw - 1, bottom - top - 1], fill=WHITE + (255,))
    pd.rectangle([30, 30, pw - 31, bottom - top - 130], fill=(228, 228, 223, 255))
    f = font('b', 30); t = 'тут міг би бути'; t2 = 'твій пес'
    mid = (bottom - top - 100) // 2
    pd.text((pw / 2 - pd.textlength(t, font=f) / 2, mid - 30), t, font=f, fill=GREY + (255,))
    pd.text((pw / 2 - pd.textlength(t2, font=font('disp', 40)) / 2, mid + 14), t2, font=font('disp', 40), fill=INK + (255,))
    f3 = font('b', 32); t3 = '@babaka_club'
    pd.text((pw / 2 - pd.textlength(t3, font=f3) / 2, bottom - top - 88), t3, font=f3, fill=INK + (255,))
    pol = pol.rotate(-4, expand=True, resample=Image.BICUBIC)
    img.paste(pol, ((W - pol.width) // 2, top - 10), pol)
    return img
posts.append(('09 UGC — Покажи свого пса', p09))

# 10 UA
def p10():
    img, d = new(BLUE); chrome(img, d, BLUE, WHITE, 'БАБАКА UA', YEL, INK)
    y, _ = head(d, 'Бабака UA', 'Класики, яких ти ще не бачив: з собачими мордами. До Дня української писемності та мови.', YEL, WHITE)
    top = y + 40; bottom = H - P - 60; gap = 20; cw = (W - 2 * P - gap) // 2
    paste_card(img, 'ua-skovoroda.webp', (P, top, P + cw, bottom), mode='fill', pad=0)
    paste_card(img, 'ua-shevchenko.webp', (P + cw + gap, top, W - P, bottom), mode='fill', pad=0)
    pill(d, (P + 16, bottom - 66), 'Сковорода', INK, WHITE, size=24)
    pill(d, (P + cw + gap + 16, bottom - 66), 'Шевченко', INK, WHITE, size=24)
    return img
posts.append(('10 Бабака UA — Класики', p10))

for name, fn in posts:
    img = fn(); img.save(os.path.join(O, name.split(' ')[0] + '.png'))
print('OVERFLOW:', OVER)
