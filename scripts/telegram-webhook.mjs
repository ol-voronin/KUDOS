// Вебхук бота правок: увімкнути, подивитись, вимкнути.
//
//   TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… node scripts/telegram-webhook.mjs set
//   TELEGRAM_BOT_TOKEN=… node scripts/telegram-webhook.mjs info
//   TELEGRAM_BOT_TOKEN=… node scripts/telegram-webhook.mjs delete
//
// Значення — ті самі, що в Vercel (kudos-web → Production). Скрипт НІКОЛИ не
// друкує токен і секрет: лише відповідь Telegram без них.
//
// allowed_updates = ["message"]: боту потрібні тільки повідомлення. Вебхук
// не заважає щоденному звіту в тему «Реклама» — той лише викликає
// sendMessage, а sendMessage з вебхуком сумісний (несумісний тільки getUpdates).

const URL_DEFAULT = 'https://babaka.shop/api/telegram/webhook';

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const cmd = process.argv[2];
if (!token || !['set', 'info', 'delete'].includes(cmd ?? '')) {
  console.error('Використання: TELEGRAM_BOT_TOKEN=… [TELEGRAM_WEBHOOK_SECRET=…] node scripts/telegram-webhook.mjs set|info|delete');
  process.exit(2);
}

async function call(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  const body = await res.json().catch(() => ({}));
  if (body.ok !== true) {
    console.error(`${method}: ${body.error_code ?? res.status} ${body.description ?? ''}`);
    process.exit(1);
  }
  return body.result;
}

if (cmd === 'set') {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    console.error('TELEGRAM_WEBHOOK_SECRET: 1–256 символів A-Z a-z 0-9 _ -');
    console.error("Згенерувати: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(2);
  }
  const url = process.env.TELEGRAM_WEBHOOK_URL?.trim() || URL_DEFAULT;
  await call('setWebhook', { url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });
  console.log(`Вебхук увімкнено: ${url}`);
}

if (cmd === 'delete') {
  await call('deleteWebhook', { drop_pending_updates: true });
  console.log('Вебхук вимкнено. Бот більше не читає тему правок; звіти в «Реклама» йдуть як і раніше.');
}

const info = await call('getWebhookInfo');
console.log(JSON.stringify({
  url: info.url,
  pending_update_count: info.pending_update_count,
  allowed_updates: info.allowed_updates,
  last_error_date: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : undefined,
  last_error_message: info.last_error_message,
}, null, 2));
