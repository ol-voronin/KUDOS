# Етап 2, патч А — серверна половина редактора

    pnpm install
    pnpm --filter @dt/contracts build
    ./scripts/setup-neon.sh
    pnpm -r typecheck && pnpm -r test
    git add -A && git commit -m "CMS: чернетки, публікація, редіректи, скидання кешу" && git push

## ВАЖЛИВО: дві нові змінні оточення

setup-neon.sh тепер робить ДВА файли:

    vercel-api-env.txt  ->  kudos-api
    vercel-web-env.txt  ->  kudos-web

REVALIDATE_SECRET має бути однаковий у обох проєктах. Без нього публікація
спрацює, але сторінка на сайті лишиться старою — адмінка про це напише.

Змінні застосовуються лише до НОВИХ деплоїв: після вставки зробіть
Redeploy обох проєктів.

## Що зʼявилося (поки без інтерфейсу)

    GET    /api/v1/admin/content/pages
    GET    /api/v1/admin/content/pages/:id
    POST   /api/v1/admin/content/pages
    PATCH  /api/v1/admin/content/pages/:id            (адреса, порядок)
    PATCH  /api/v1/admin/content/pages/:id/draft      (зберегти чернетку)
    POST   /api/v1/admin/content/pages/:id/publish
    POST   /api/v1/admin/content/pages/:id/unpublish
    POST   /api/v1/admin/content/pages/:id/restore/:versionId
    DELETE /api/v1/admin/content/pages/:id

Екран редактора — наступний патч.
