// Вебхук бота правок: увімкнути, подивитись, вимкнути.
//
//   TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… node scripts/telegram-webhook.mjs set
//   TELEGRAM_BOT_TOKEN=… node scripts/telegram-webhook.mjs info
//   TELEGRAM_BOT_TOKEN=… node scripts/telegram-webhook.mjs delete
//   TELEGRAM_BOT_TOKEN=… node scripts/telegram-webhook.mjs discover
//
// discover — до ввімкнення вебхука: показує теми й людей, які писали в
// робочий чат за останню добу (getUpdates), — звідти беруться
// TELEGRAM_EDITS_THREAD_ID і TELEGRAM_EDITORS. Нічого не підтверджує й не
// «зʼїдає»: ті самі оновлення можна прочитати ще раз.
//
// Зручніше запускати не локально, а воркфлоу «Telegram setup» в Actions:
// токен там береться з secrets і нікуди не виводиться.
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
if (!token || !['set', 'info', 'delete', 'discover'].includes(cmd ?? '')) {
  console.error('Використання: TELEGRAM_BOT_TOKEN=… [TELEGRAM_WEBHOOK_SECRET=…] node scripts/telegram-webhook.mjs set|info|delete|discover');
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

if (cmd === 'discover') {
  const chatId = Number(process.env.TELEGRAM_EDITS_CHAT_ID || '-1004296608260');
  const current = await call('getWebhookInfo');
  if (current.url) {
    console.log('Вебхук уже ввімкнений — getUpdates недоступний. Напиши /id у потрібній темі, бот відповість.');
    process.exit(0);
  }
  const updates = await call('getUpdates', { limit: 100, allowed_updates: ['message'] });
  const topics = new Map();
  const people = new Map();
  for (const u of updates) {
    const m = u.message;
    if (!m || m.chat?.id !== chatId) continue;
    const thread = m.message_thread_id ?? 0;
    const created = m.forum_topic_created?.name ?? m.reply_to_message?.forum_topic_created?.name;
    const t = topics.get(thread) ?? { name: created ?? '', messages: 0, sample: '' };
    t.messages += 1;
    if (created) t.name = created;
    if (!t.sample && m.text) t.sample = m.text.slice(0, 60);
    topics.set(thread, t);
    if (m.from && !m.from.is_bot) {
      const name = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ');
      people.set(m.from.id, `${name}${m.from.username ? ` (@${m.from.username})` : ''}`);
    }
  }
  const lines = ['## Теми чату (за останню добу)', '', '| thread_id | назва | повідомлень | приклад |', '|---|---|---|---|'];
  for (const [id, t] of topics) lines.push(`| ${id || '— (General)'} | ${t.name || '?'} | ${t.messages} | ${t.sample.replace(/\|/g, '/')} |`);
  lines.push('', '## Люди', '', '| user_id | імʼя |', '|---|---|');
  for (const [id, name] of people) lines.push(`| ${id} | ${name} |`);
  if (topics.size === 0) lines.push('', 'Нічого не знайдено: напиши будь-що (наприклад /id) у потрібній темі й запусти ще раз.');
  console.log(lines.join('\n'));
  process.exit(0);
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
