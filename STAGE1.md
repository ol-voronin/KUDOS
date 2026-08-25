# Етап 1 CMS — модель і рендер

Розпаковано в репозиторій автоматично. Що зробити:

    pnpm install
    pnpm --filter @dt/contracts build
    ./scripts/setup-neon.sh
    pnpm -r typecheck && pnpm -r test
    git add -A && git commit -m "CMS етап 1: сторінки з блоків" && git push

## ВИДАЛЕНІ ФАЙЛИ

Тарбол не видаляє. Приберіть руками — їхній вміст тепер у базі:

    git rm -r apps/web/src/app/oferta apps/web/src/app/pryvatnist \
              apps/web/src/app/spivpratsia apps/web/src/app/svoya-ideya
    git rm apps/web/src/components/legal-page.tsx

## Гейт етапу

Відкрити /oferta, /pryvatnist, /spivpratsia, /svoya-ideya — мають виглядати
як раніше. Адреси ті самі, обробляє їх тепер /[slug] з бази.
