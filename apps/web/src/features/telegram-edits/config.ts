import type { EditsConfig } from './parse';

export interface RuntimeConfig extends EditsConfig {
  botToken: string;
  webhookSecret: string;
  githubToken: string;
  githubRepo: string;
}

function int(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw || !/^-?\d+$/u.test(raw)) return null;
  return Number(raw);
}

/**
 * Усе з оточення одним махом. Якщо бракує хоч чогось — `null`, і маршрут
 * мовчки нічого не робить: напівналаштований бот гірший за вимкнений.
 */
export function readConfig(): RuntimeConfig | null {
  const botToken = process.env['TELEGRAM_BOT_TOKEN']?.trim() ?? '';
  const webhookSecret = process.env['TELEGRAM_WEBHOOK_SECRET']?.trim() ?? '';
  const githubToken = process.env['TELEGRAM_GITHUB_TOKEN']?.trim() ?? '';
  const githubRepo = process.env['TELEGRAM_GITHUB_REPO']?.trim() || 'ol-voronin/kudos';
  const chatId = int('TELEGRAM_EDITS_CHAT_ID');
  const threadId = int('TELEGRAM_EDITS_THREAD_ID');
  const editors = (process.env['TELEGRAM_EDITORS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/u.test(s))
    .map(Number);
  const botId = Number(botToken.split(':')[0]);

  if (!botToken || !webhookSecret || !githubToken || chatId === null || threadId === null) return null;
  // Порожній TELEGRAM_EDITORS — допустимо: тоді працює лише /id, і саме так
  // дізнаються id, які туди вписати.
  if (!Number.isFinite(botId) || botId <= 0) return null;

  return { botToken, webhookSecret, githubToken, githubRepo, chatId, threadId, editors, botId };
}
