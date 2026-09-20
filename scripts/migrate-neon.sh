#!/usr/bin/env bash
# Накотити НОВІ МІГРАЦІЇ на Neon — і більше нічого.
#
#   bash scripts/migrate-neon.sh
#
# Чим відрізняється від setup-neon.sh: той після міграцій ще й сіє довідники.
# Сідер каталогу впізнає колекції за СТАРИМИ слагами (pes-pub, polo-style…),
# тож після ребрендингу він не оновив би їх, а створив чотири порожні копії
# поруч. Для звичайного релізу потрібні саме міграції — ось вони окремо.
#
# Потрібен .env.neon у корені (DATABASE_URL + DIRECT_DATABASE_URL).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.neon ]; then
  echo "Немає .env.neon у корені — без нього невідомо, яку базу мігрувати."
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

# Міграції ходять тільки прямим зʼєднанням: PgBouncer у режимі transaction
# не тримає сесійних блокувань, на які спирається migrate.
export DATABASE_URL="$DIRECT_DATABASE_URL"

cd apps/api
node scripts/db-target.mjs
pnpm exec prisma migrate deploy
