# Збірка API для контейнерного хостингу (Railway / Render / Fly).
#
# Багатоетапна: у фінальний образ не потрапляють ні devDependencies, ні
# вихідники. Prisma-клієнт генерується на етапі збірки — без цього застосунок
# упаде на першому ж запиті до бази.

# ── етап 1: залежності й збірка ──────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# openssl потрібен рушіям Prisma; ca-certificates — для HTTPS до Monobank і Telegram.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9 --activate

# Спершу тільки маніфести — щоб шар із залежностями кешувався, поки вони не змінились.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @dt/contracts... --filter @dt/api...

COPY packages/contracts packages/contracts
COPY apps/api apps/api

RUN pnpm --filter @dt/contracts build \
  && pnpm --filter @dt/api exec prisma generate \
  && pnpm --filter @dt/api build

# Прибираємо devDependencies з дерева, яке поїде далі.
RUN pnpm prune --prod

# ── етап 2: рантайм ──────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Не root: якщо процес зламають, він не матиме прав на образ.
RUN useradd --create-home --shell /bin/bash app
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/packages/contracts ./packages/contracts
COPY --from=builder --chown=app:app /app/apps/api ./apps/api
USER app

# Хостинг підставляє свій PORT; main.ts його читає.
ENV PORT=4000
EXPOSE 4000

# Міграції НЕ запускаються тут навмисно: контейнер може підніматись у кількох
# копіях, і паралельний `migrate deploy` — це гонка за блокування. Міграції —
# окремим кроком у деплої (див. DEPLOY.md).
CMD ["node", "apps/api/dist/main.js"]
