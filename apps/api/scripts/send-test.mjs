// Перевірити бота за 10 секунд, без запуску всього API:
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node scripts/send-test.mjs
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
if (!token || !chatId) {
  console.error('Задай TELEGRAM_BOT_TOKEN і TELEGRAM_CHAT_ID');
  process.exit(1);
}
const text = '🔔 <b>Нова заявка</b>\n\n👤 Тест\n📞 <a href="tel:+380671234567">+380671234567</a>';
const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
});
console.log(res.ok ? '✅ Надіслано' : `❌ HTTP ${res.status}: ${await res.text()}`);
