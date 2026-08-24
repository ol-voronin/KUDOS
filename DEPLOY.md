# Деплой

Усе живе на Vercel: два проєкти з одного репозиторію, база — Neon.
Свій домен підключається пізніше, коли буде обрана назва; змін у коді для
цього не потрібно.

```
Браузер ──► kudos-web (Next.js)  ──► /api/* переписується ──► kudos-api (NestJS)
                Root: apps/web                                   Root: apps/api
                                                                      │
                                                                      ▼
                                                                 Neon (Postgres)
```

**Чому браузер не ходить в API напряму.** Cookie сесії адмінки має
`sameSite: 'lax'`. Якби браузер стукав на `kudos-api.vercel.app`, а сайт був
на `kudos-web.vercel.app`, браузер вважав би це різними сайтами й не надсилав
cookie: вхід «спрацював би», а кожен наступний запит був би неавторизованим —
без жодної помилки, просто редірект на логін по колу. Переписування в
`next.config.mjs` робить так, що для браузера все відбувається в межах одного
домену. Серверні компоненти Next ходять в API напряму (`API_INTERNAL_URL`) —
їм cookie не потрібні, а зайве коло через проксі лише додавало б затримку.

**Чому два проєкти, а не один.** Next.js і NestJS — різні збірки з різними
кореневими каталогами. Vercel дозволяє один Root Directory на проєкт.

---

## 0 · Прибрати за собою

У Vercel зараз три проєкти. Два зайві:

- `kudos-api-z89q` — видалити (Settings → внизу → Delete Project).
- `kudos-api` — залишаємо, це буде API.
- `kudos-web` — вже створений мною з правильним Root Directory.

---

## 1 · База: Neon

1. neon.tech → новий проєкт, регіон **Europe (Frankfurt)** — найближчий до Києва
   й до регіону `fra1`, у якому крутитимуться обидва проєкти Vercel.
2. Взяти **два** рядки підключення (Connection Details → Connection string):
   - **Pooled** (у хості є `-pooler`) → це буде `DATABASE_URL`
   - **Direct** (без `-pooler`) → це буде `DIRECT_DATABASE_URL`

Обидва потрібні. Через пул ходить застосунок; міграції через пул не працюють,
бо PgBouncer у режимі transaction не тримає сесійних блокувань, на які
спирається `migrate`.

До пулованого рядка додати в кінець `&pgbouncer=true&connection_limit=1` —
інакше кожен холодний старт функції відкриватиме нове зʼєднання й Neon почне
відмовляти.

> Рядки підключення — це доступ до бази з телефонами клієнтів. Не надсилай їх
> у чат, нікому й ніколи. Вони потрібні лише у двох місцях: змінні Vercel і
> твій локальний термінал.

3. Накотити схему й довідники **з локальної машини** (не з білду — міграції в
   serverless-збірці це спосіб одного дня втратити базу):

```bash
cd apps/api

export DATABASE_URL="<direct>"
export DIRECT_DATABASE_URL="<direct>"

pnpm exec prisma migrate deploy     # схема + CHECK на leadTimeDays
pnpm exec prisma db seed            # тканини, кольори, розміри, ціни
pnpm run db:seed:catalog            # 18 порід + 7 колекцій + правила принтів

# адмін: пароль вводиться так, щоб не осісти в історії команд
read -rp "email адміна: " A_EMAIL
read -rsp "пароль: " A_PASS; echo
ADMIN_EMAIL="$A_EMAIL" ADMIN_PASSWORD="$A_PASS" pnpm run create-admin
unset A_PASS

unset DATABASE_URL DIRECT_DATABASE_URL
```

Для міграцій свідомо береться **direct**-рядок в обидві змінні: на цьому кроці
пул тільки заважає.

---

## 2 · Проєкт `kudos-api`

### Settings → Build & Deployment

- **Root Directory**: `apps/api`

Решту (framework, install command, регіон) бере з `apps/api/vercel.json` —
руками нічого більше не вводити.

### Settings → Deployment Protection

- **Vercel Authentication**: **Disabled**

Зараз воно увімкнене. З ним API віддає 401 усім, крім залогінених у Vercel —
включно з фронтом, який ходить у нього по серверу. Це найчастіша причина
«все задеплоїлось, але нічого не працює».

### Settings → Environment Variables (усі — Production + Preview)

| Змінна | Значення |
|---|---|
| `DATABASE_URL` | pooled-рядок Neon + `&pgbouncer=true&connection_limit=1` |
| `DIRECT_DATABASE_URL` | direct-рядок Neon |
| `JWT_ACCESS_SECRET` | **новий** секрет, не той, що локально |
| `JWT_REFRESH_SECRET` | **новий** секрет, інший |
| `JWT_ACCESS_TTL` | `900` |
| `JWT_REFRESH_TTL` | `2592000` |
| `CORS_ORIGINS` | `https://<WEB>` |
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `TELEGRAM_CHAT_ID` | id чату |
| `WEB_PUBLIC_URL` | `https://<WEB>` |
| `API_PUBLIC_URL` | `https://<API>` |
| `MONOBANK_TOKEN` | поки можна не ставити — оплата вимкнеться сама |

Секрети генеруються так:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Прод-секрети мають відрізнятися від локальних. Якщо вони однакові, то
скомпрометований ноутбук = скомпрометована адмінка.

`NODE_ENV=production` Vercel виставляє сам — руками не додавати. Саме від нього
залежить прапорець `secure` на cookie сесії.

---

## 3 · Проєкт `kudos-web`

Root Directory (`apps/web`) вже виставлений. Потрібні лише змінні:

| Змінна | Значення |
|---|---|
| `API_ORIGIN` | `https://<API>` |
| `API_INTERNAL_URL` | `https://<API>/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | `https://<WEB>` |

`NEXT_PUBLIC_API_URL` **не задавати**. Якщо її задати, браузер піде в API
напряму — і зламає cookie сесії (див. початок файлу).

`NEXT_PUBLIC_SITE_URL` запікається у збірку: після її зміни потрібен новий
деплой, інакше в `sitemap.xml` і canonical залишиться старе.

---

## 4 · Домени

`<API>` і `<WEB>` — це продові домени з дашборда (Project → Domains, той, що
без `-git-` у назві). Очікувано:

- `<WEB>` = `kudos-web-devvoronin-gmailcoms-projects.vercel.app`
- `<API>` = `kudos-api-devvoronin-gmailcoms-projects.vercel.app`

Але звірити з дашбордом: Vercel іноді видає коротший варіант.

Порядок: спочатку задеплоїти `kudos-api` (він ні від кого не залежить),
взяти його домен, підставити у змінні `kudos-web`, задеплоїти `kudos-web`,
взяти його домен, підставити у `CORS_ORIGINS` і `WEB_PUBLIC_URL` в `kudos-api`
і передеплоїти API. Одне коло — інакше ніяк, домени видаються після першого
деплою.

---

## 5 · Деплой

```bash
git add -A
git commit -m "Деплой на Vercel: два проєкти, конфіг збірки, Neon"
git push
```

Обидва проєкти зберуться самі — вони підписані на `main`.

---

## 6 · Перевірка після деплою

1. `curl https://<API>/api/v1/health` → `{"status":"ok","database":true}`.
   `"database":false` = не той `DATABASE_URL` або Neon спить.
   HTML замість JSON = не вимкнена Vercel Authentication.
2. `https://<WEB>` відкривається, головна не порожня.
3. `https://<WEB>/api/v1/health` віддає той самий JSON — значить проксі живий.
   Це найважливіша перевірка: якщо тут 404, адмінка не працюватиме.
4. `https://<WEB>/admin/login` → увійти створеним адміном. Після входу
   перезавантажити сторінку: якщо викинуло на логін — cookie не долетіла.
   Якщо логін віддає 500 — дивись Runtime Logs проєкту `kudos-api`: найімовірніше
   не підтягнувся нативний модуль `argon2`, яким хешуються паролі.
5. Надіслати тестову заявку з `/zayavka` → має прийти в Telegram.
6. `https://<WEB>/sitemap.xml` → адреси з правильним доменом, не з localhost.

---

## Локальна розробка після цих змін

Нічого не змінилося. `.env` у корені, `pnpm dev` в обох застосунках,
`API_ORIGIN` і `API_INTERNAL_URL` за замовчуванням дивляться на `localhost:4000`.
Єдине: після `pnpm install` потрібен `pnpm --filter @dt/api exec prisma generate`,
якщо змінювалась схема.

## Оплата Monobank

Вебхук Monobank стукає на `API_PUBLIC_URL`. Поки API був на localhost, банк
не міг достукатися й статуси оплат зависали б у `CREATED`. Після деплою це
працює. Але **до першої реальної оплати** на сайті мають зʼявитися публічна
оферта і політика конфіденційності — без них це порушення і правил банку, і
закону про захист персональних даних (ім'я й телефон їдуть у Telegram).
