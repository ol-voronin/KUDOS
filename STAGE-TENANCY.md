# Мультитенантність: належність сайту й межа модуля

    pnpm install
    pnpm --filter @dt/contracts build
    ./scripts/setup-neon.sh
    pnpm -r typecheck && pnpm -r test
    git add -A && git commit -m "Належність сайту, ізоляція даних, межа ядро/модуль" && git push

Міграція 20260825230000_sites створює сайт `primary`, робить усіх наявних
адміністраторів його власниками і проставляє siteId наявним сторінкам.

## Що змінилося в коді

`PrismaService` більше НЕ успадковує PrismaClient. Замість
`this.prisma.page` тепер `this.prisma.db.page` — і це не косметика:
сирий клієнт став приватним, тож дістати дані повз ізоляцію не можна
навіть навмисно, воно просто не збереться.

Скрипти, які працюють із вмістом, обгортаються в `withSite()`:

    import { withSite } from './tenant-client';
    await withSite(async (prisma, siteId) => { ... });

Інший сайт — змінна `SITE_KEY`.

## Що станеться, якщо забути

  · запит до Page/PageVersion/MediaAsset/Redirect без контексту сайту
    падає з поясненням, а не віддає дані всіх сайтів;
  · нова таблиця, не віднесена до орендних чи спільних, валить перший же
    запит до себе — і тест `tenancy.spec.ts` ловить це ще до запуску;
  · сирий PrismaClient у новому сідері ловить `check-prisma-usage.mjs`.
