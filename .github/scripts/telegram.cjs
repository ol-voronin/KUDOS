/**
 * Повідомлення в тему правок із GitHub Actions.
 *
 * Читає TELEGRAM_BOT_TOKEN, TELEGRAM_EDITS_CHAT_ID, TELEGRAM_EDITS_THREAD_ID
 * з оточення. Токен ніколи не друкується: помилки — лише код і опис від
 * Telegram, без адреси запиту.
 *
 * Тема «Реклама» (88) сюди не потрапляє ніколи: thread береться тільки з
 * TELEGRAM_EDITS_THREAD_ID, і якщо він збігається з 88 — відмова.
 *
 *   node .github/scripts/telegram.cjs send "текст" [reply_to_message_id]
 *
 * або з actions/github-script:  require(`${process.env.GITHUB_WORKSPACE}/_ci/.github/scripts/telegram.cjs`)
 */

const ADS_THREAD = 88;

function config() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chat = (process.env.TELEGRAM_EDITS_CHAT_ID || '').trim();
  const thread = Number((process.env.TELEGRAM_EDITS_THREAD_ID || '').trim());
  if (!token || !chat || !Number.isInteger(thread) || thread <= 0) return null;
  if (thread === ADS_THREAD) throw new Error('TELEGRAM_EDITS_THREAD_ID вказує на тему «Реклама» — відмовляюсь писати туди.');
  return { token, chat, thread };
}

async function send(text, replyTo) {
  const cfg = config();
  if (cfg === null) {
    console.log('Telegram не налаштований (TELEGRAM_* у secrets/vars) — пропускаю повідомлення.');
    return;
  }
  const payload = {
    chat_id: cfg.chat,
    message_thread_id: cfg.thread,
    text: String(text).slice(0, 4000),
    link_preview_options: { is_disabled: true },
  };
  const reply = Number(replyTo);
  if (Number.isInteger(reply) && reply > 0) {
    payload.reply_parameters = { message_id: reply, allow_sending_without_reply: true };
  }
  const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok !== true) {
    throw new Error(`Telegram sendMessage: ${body.error_code || res.status} ${body.description || ''}`.trim());
  }
}

/** Усі `<!-- tg:{…} -->` у тексті, по порядку. */
function tgBlocks(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/<!--\s*tg:(\{.*?\})\s*-->/g)) {
    try { out.push(JSON.parse(m[1])); } catch { /* зіпсований блок — пропускаємо */ }
  }
  return out;
}

/** Останнє повідомлення Даші в issue: спершу коментарі з кінця, потім тіло. */
async function lastTgMessage(github, owner, repo, issueNumber) {
  const issue = await github.rest.issues.get({ owner, repo, issue_number: issueNumber });
  const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: issueNumber, per_page: 100 });
  const texts = [issue.data.body, ...comments.map((c) => c.body)];
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const blocks = tgBlocks(texts[i]);
    if (blocks.length > 0) return blocks[blocks.length - 1].msg;
  }
  return undefined;
}

/** Прибрати приховані HTML-коментарі й зайві порожні рядки. */
function visibleText(markdown) {
  return String(markdown || '').replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { send, tgBlocks, lastTgMessage, visibleText };

if (require.main === module) {
  const [cmd, text, replyTo] = process.argv.slice(2);
  if (cmd !== 'send' || !text) {
    console.error('Використання: node telegram.cjs send "текст" [reply_to]');
    process.exit(2);
  }
  send(text, replyTo).catch((err) => { console.error(err.message); process.exit(1); });
}
