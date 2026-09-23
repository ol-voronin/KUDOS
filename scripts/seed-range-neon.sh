#!/usr/bin/env bash
# Залити асортимент (`apps/api/prisma/range.ts`) у Neon — і більше нічого.
#
#   bash scripts/seed-range-neon.sh              # без цін
#   bash scripts/seed-range-neon.sh --prices     # разом із новим прайсом
#
# Чим відрізняється від setup-neon.sh: той після міграцій сіє ще й каталог, а
# сідер каталогу впізнає колекції за СТАРИМИ слагами й після ребрендингу
# створив би чотири порожні копії поруч. Тут — тільки асортимент: вироби,
# тканини, кольори, розміри, варіанти.
#
# Міграції накочують окремо й ПЕРЕД цим: bash scripts/migrate-neon.sh.
#
# Потрібен .env.neon у корені (DATABASE_URL + DIRECT_DATABASE_URL).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.neon ]; then
  echo "Немає .env.neon у корені — без нього невідомо, яку базу заливати."
  exit 1
fi

# Амперсанди в рядках Neon shell сприйняв би як запуск у фоні, тому значення
# дістаємо через node і віддаємо вже екранованими.
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

: "${DIRECT_DATABASE_URL:?немає DIRECT_DATABASE_URL у .env.neon}"

# Сідер робить сотні дрібних записів у циклі. Прямим зʼєднанням це надійніше,
# ніж через PgBouncer у transaction-режимі, який рве підготовлені стейтменти.
export DATABASE_URL="$DIRECT_DATABASE_URL"

cd apps/api
node scripts/db-target.mjs
pnpm exec tsx prisma/seed-range.ts "$@"
