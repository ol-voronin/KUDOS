# Правки сайту з Telegram

Даша пише правку в тему робочого чату, агент Claude вносить її в код, і правка
з'являється на **тестовій** версії сайту. На babaka.shop правки виходять лише
**пакетом**, коли Олексій зіллє PR випуску. На сайт іде платний трафік, тож
помилка в тексті чи верстці коштує грошей.

```
Telegram «правка: …»
  → /api/telegram/webhook (kudos-web, лише Production)
  → GitHub issue з міткою telegram-edit
  → .github/workflows/telegram-edit.yml: Claude у гілці tg/<N>
  → перевірка меж + typecheck/test/build → PR tg/<N> → dasha-edits, автозлиття на зеленому CI
  → Vercel Preview гілки dasha-edits
  → telegram-notify.yml: «Готово на тесті ✅ <посилання>» реплаєм Даші
…
/випуск (Олексій) → PR dasha-edits → main (без автозлиття) → Олексій зливає → сайт
```

## Команди в темі правок

| Що написати | Хто | Що станеться |
|---|---|---|
| `правка: …` або `/правка …` (можна з фото, текст у підписі) | редактори | нова issue, бот відповідає «Прийняв, #N 👌 …» |
| реплай на повідомлення бота з `#N` (текст і/або фото) | редактори | коментар до issue #N, агент доробляє правку |
| `/відкат` | редактори | відкат останньої правки **в dasha-edits** (main не чіпається) |
| `/випуск` | лише перший id у `TELEGRAM_EDITORS` (Олексій) | PR dasha-edits → main, посилання в тему |
| `/id` | будь-хто в темі | бот відповідає «твій user_id: …» |

Усе інше: повідомлення в інших темах (зокрема «Реклама», 88), в інших чатах і
від людей не зі списку `TELEGRAM_EDITORS` бот ігнорує мовчки.

Альбом із кількох фото бот прочитає лише частково. Додаткові фото краще слати
реплаями на повідомлення бота з `#N`.

## Що агент може і чого не може

Агенту дозволено змінювати тексти, верстку, стилі, зображення й компоненти вітрини в `apps/web`.

Без Олексія агент нічого не змінює, а питає коментарем, і питання приходить у тему:

- міграції БД, `apps/api` (замовлення, оплати Monobank), `packages/contracts`;
- авторизацію та адмінку;
- env, секрети, `.github`;
- видалення сторінок чи даних;
- robots, sitemap та індексацію;
- аналітику й теги (GA4, Google Ads);
- ціни в коді та оформлення замовлення.

Вміст з адмінки чи БД агент у коді не змінює. Натомість він пише, де саме в адмінці це поправити.

Межі тримаються не лише на інструкції агенту:

- в агента немає git. Коміт, пуш і PR робить воркфлоу, і лише в `tg/<N>` → `dasha-edits`;
- крок «Перевірка меж» зупиняє правку, якщо змінено файли поза дозволеними, щось видалено або схоже на зміну цін. Тоді нічого не пушиться, а Олексій отримує коментар;
- перед пушем запускаються typecheck, тести й build, а після пушу ще раз CI на PR. PR автоматично зливається лише на зеленому CI.

## Тестова версія (Preview)

Preview `kudos-web` дивиться в **продовий** API: ту саму базу й той самий
Monobank (`API_ORIGIN` однаковий для Production і Preview). Тому на Preview:

- `apps/web/src/middleware.ts` блокує все, що не GET, до `/api/v1/*`.
  Виняток — розрахунок кошика (`POST /cart/quote`), бо він нічого не записує.
  Замовлення, оплата, заявки, події статистики й вхід в адмінку на Preview не працюють;
- кнопка «Замовити» неактивна, а вгорі видно плашку «Тестова версія сайту»;
- GA4, Google Ads і власна статистика не вантажаться, щоб тестові кліки не потрапили в кампанії;
- `noindex`: заголовок `X-Robots-Tag` на всіх відповідях, `robots.txt` → `Disallow: /`, метатег robots;
- вебхук Telegram відповідає 404: він живе лише в Production.

Стабільна адреса тесту: `https://kudos-web-git-dasha-edits-devvoronin-gmailcoms-projects.vercel.app`
(впиши її в змінну `DASHA_PREVIEW_URL`, щоб у Telegram завжди йшло це посилання).

## Гілки

| Гілка | Що це |
|---|---|
| `main` | сайт. Лише PR, злиття руками Олексієм. Автозлиття заборонене |
| `dasha-edits` | збірка правок з Telegram. Сюди йдуть **тільки** PR з Telegram, з автозлиттям на зеленому CI. Не видаляти |
| `tg/<N>` | робоча гілка агента для issue #N |
| `revert/<N>-<run>` | відкат правки #N |
| `sync/main-<sha>` | злиття main у dasha-edits після кожного пушу в main |

## Мітки

- `telegram-edit`: issue з Telegram (саме мітка запускає агента) і PR агента;
- `on-preview`: про цей PR уже написали «Готово на тесті»;
- `reverted`: PR правки, який відкотили через `/відкат`.

## Секрети та змінні

**Vercel → kudos-web → Settings → Environment Variables, лише Production:**

| Змінна | Значення |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен бота (той самий бот) |
| `TELEGRAM_WEBHOOK_SECRET` | випадковий рядок `[A-Za-z0-9_-]`, той самий передається в setWebhook |
| `TELEGRAM_EDITS_CHAT_ID` | `-1004296608260` |
| `TELEGRAM_EDITS_THREAD_ID` | id теми правок (не 88!) |
| `TELEGRAM_EDITORS` | user_id через кому, **першим іде Олексій** |
| `TELEGRAM_GITHUB_TOKEN` | fine-grained PAT, див. нижче |
| `TELEGRAM_GITHUB_REPO` | необов'язково, за замовчуванням `ol-voronin/kudos` |

`BLOB_READ_WRITE_TOKEN` уже є: його використовують фото правок (`edits/<issue>/<msg>.jpg`)
і позначки ідемпотентності (`telegram/updates/<update_id>.txt`).

**GitHub → Settings → Secrets and variables → Actions:**

| Тип | Назва | Для чого |
|---|---|---|
| secret | `EDITS_GH_PAT` | PR, коментарі й пуші від воркфлоу. Без PAT не запуститься CI на PR і не прийдуть сповіщення |
| secret | `TELEGRAM_BOT_TOKEN` | повідомлення в тему |
| secret | `ANTHROPIC_API_KEY` або `CLAUDE_CODE_OAUTH_TOKEN` | агент Claude |
| variable | `TELEGRAM_EDITS_CHAT_ID` | `-1004296608260` |
| variable | `TELEGRAM_EDITS_THREAD_ID` | id теми правок |
| variable | `DASHA_PREVIEW_URL` | стабільна адреса тесту (необов'язково) |

**PAT** (fine-grained, тільки репозиторій `ol-voronin/kudos`): Contents RW, Pull requests RW,
Issues RW, Actions RW, Workflows RW (sync переносить у dasha-edits і зміни `.github`).
Той самий PAT підходить і для `TELEGRAM_GITHUB_TOKEN` у Vercel.

## Увімкнути / вимкнути

```bash
# увімкнути (значення ті самі, що в Vercel Production)
TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… node scripts/telegram-webhook.mjs set
# стан
TELEGRAM_BOT_TOKEN=… node scripts/telegram-webhook.mjs info
# вимкнути
TELEGRAM_BOT_TOKEN=… node scripts/telegram-webhook.mjs delete
```

`deleteWebhook` вимикає лише читання теми правок. Щоденний звіт у тему
«Реклама» працює як і раніше: він лише викликає `sendMessage`.

Щоб тимчасово зупинити агента, не чіпаючи бота, вимкни воркфлоу *Telegram edit*
в Actions (⋯ → Disable workflow).

## Файли

- `apps/web/src/app/api/telegram/webhook/route.ts` — вебхук;
- `apps/web/src/features/telegram-edits/*` — розбір повідомлень, GitHub, Telegram, Blob;
- `apps/web/src/middleware.ts`, `apps/web/src/lib/deploy-env.ts` — захист Preview;
- `.github/workflows/telegram-{edit,notify,release,revert}.yml`, `sync-dasha-edits.yml`;
- `.github/scripts/telegram.cjs` — відправка в тему з Actions (відмовляється писати в тему 88);
- `scripts/telegram-webhook.mjs` — setWebhook / getWebhookInfo / deleteWebhook.
