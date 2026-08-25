#!/usr/bin/env bash
# Одна команда: накотити схему на Neon, засіяти довідники, створити адміна
# і скласти блок змінних для Vercel.
#
#   bash scripts/setup-neon.sh
#
# Потрібен файл .env.neon у корені з двома рядками підключення.
# Запускати з машини, де є інтернет — контейнери Claude до Neon не дістають.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

if [ ! -f .env.neon ]; then
  echo "Немає .env.neon у корені. Потрібні два рядки:"
  echo "  DATABASE_URL=<pooled>"
  echo "  DIRECT_DATABASE_URL=<direct>"
  exit 1
fi

# .env.neon не можна просто source: у рядках Neon є амперсанди,
# і shell сприйняв би їх як запуск у фоні. Тому розбираємо через node
# і віддаємо назад у вигляді безпечно екранованих присвоєнь.
eval "$(node -e '
const fs = require("node:fs");
const q = (s) => "\x27" + String(s).split("\x27").join("\x27\\\x27\x27") + "\x27";
for (const line of fs.readFileSync(".env.neon", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  const k = t.slice(0, i).trim();
  if (!/^[A-Z_][A-Z0-9_]*$/.test(k)) continue;
  const v = t.slice(i + 1).trim().replace(/^["\x27]|["\x27]$/g, "");
  console.log("export " + k + "=" + q(v));
}')"

: "${DATABASE_URL:?немає DATABASE_URL у .env.neon}"
: "${DIRECT_DATABASE_URL:?немає DIRECT_DATABASE_URL у .env.neon}"

# Найчастіша помилка — у файлі залишився текст-підказка замість рядка.
# Ловимо це тут, інакше Prisma скаже лише незрозуміле P1013.
for name in DATABASE_URL DIRECT_DATABASE_URL; do
  value="${!name}"
  case "$value" in
    postgres://*|postgresql://*) ;;
    *)
      echo "У .env.neon змінна $name не схожа на рядок підключення."
      echo "Там зараз ${#value} символів, а рядок Neon починається з postgresql://"
      echo
      echo "Відкрий .env.neon у редакторі і встав рядки з Neon одразу після знака =,"
      echo "без кутових дужок і без лапок. Neon -> проєкт kudos -> Connect."
      echo "  DATABASE_URL        — з увімкненим Pooled connection (у хості є -pooler)"
      echo "  DIRECT_DATABASE_URL — з вимкненим Pooled connection"
      exit 1
      ;;
  esac
done

if [ "$DATABASE_URL" = "$DIRECT_DATABASE_URL" ]; then
  echo "DATABASE_URL і DIRECT_DATABASE_URL однакові."
  echo "Перший має бути пулований (-pooler у хості), другий — без пулу."
  exit 1
fi

# Міграції ходять тільки прямим зʼєднанням: PgBouncer у режимі transaction
# не тримає сесійних блокувань, на які спирається migrate.
export DATABASE_URL="$DIRECT_DATABASE_URL"

cd apps/api

echo "==> prisma generate"
pnpm exec prisma generate

echo "==> migrate deploy"
pnpm exec prisma migrate deploy

echo "==> базові довідники"
pnpm exec tsx prisma/seed.ts

echo "==> асортимент: тканини, кольори, вироби, розміри, варіанти"
pnpm exec tsx prisma/seed-range.ts

echo "==> каталог: породи й колекції"
pnpm exec tsx prisma/seed-catalog.ts

echo "==> адмін"
if [ -f "$ROOT/admin-credentials.txt" ]; then
  echo "admin-credentials.txt уже є — адміна не чіпаю, пароль лишається старий."
else
  ADMIN_EMAIL="${ADMIN_EMAIL:-dev.voronin@gmail.com}"
  ADMIN_PASSWORD="$(node -e 'console.log(require("node:crypto").randomBytes(12).toString("base64url"))')"
  ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" node scripts/create-admin.mjs
  umask 077
  printf 'email:  %s\nпароль: %s\n\nЗмінити: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @dt/api run create-admin\n' \
    "$ADMIN_EMAIL" "$ADMIN_PASSWORD" > "$ROOT/admin-credentials.txt"
  echo "Пароль адмінки записано у admin-credentials.txt (у чат він не потрапляє)."
fi

cd "$ROOT"
echo "==> блок змінних для Vercel"
node scripts/vercel-env.mjs

echo
echo "Готово. Далі: відкрити vercel-api-env.txt, скопіювати весь текст"
echo "і вставити у Vercel -> kudos-api -> Environment Variables -> Add -> поле Key."
