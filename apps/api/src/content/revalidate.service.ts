import { Injectable, Logger } from '@nestjs/common';

/**
 * Просимо сайт перечитати сторінку після публікації.
 *
 * Навіщо окремий крок. База змінюється миттєво, але відвідувачу сторінку
 * віддає кеш Next, який живе окремо і від бази, і від деплою. Без цього
 * дзвінка публікація виглядає так: натиснув «Опублікувати», відкрив сайт —
 * старий текст. Далі людина тисне ще раз, чистить кеш браузера, пише мені.
 *
 * Три рішення, які тут прийняті свідомо:
 *
 *   1. Помилка не зриває публікацію. Опублікований вміст уже в базі; кеш
 *      однаково оновиться сам за кілька хвилин. Відкочувати публікацію
 *      через недоступний вебхук було б гірше за проблему.
 *   2. Але й мовчати не можна. Причина повертається рядком і лягає в
 *      `Page.revalidateError` — адмінка показує її поруч зі сторінкою.
 *   3. Секрет обовʼязковий. Ендпоінт, який скидає кеш будь-кому, — це
 *      безкоштовний спосіб покласти сайт: досить смикати його по колу.
 */
@Injectable()
export class RevalidateService {
  private readonly log = new Logger(RevalidateService.name);

  /** Порожній рядок означає успіх. Будь-що інше — текст для адмінки. */
  async revalidate(paths: readonly string[]): Promise<string> {
    const base = process.env['WEB_URL'];
    const secret = process.env['REVALIDATE_SECRET'];

    if (!base || !secret) {
      const missing = [!base && 'WEB_URL', !secret && 'REVALIDATE_SECRET'].filter(Boolean).join(', ');
      this.log.warn(`Кеш не скинуто: не задано ${missing}`);
      return `не задано ${missing} — сайт оновиться сам протягом кількох хвилин`;
    }

    // Секрет їде в HTTP-заголовку, а заголовок фізично не вміє нести нічого,
    // крім latin-1. Кириличний секрет валить `fetch` помилкою про ByteString,
    // у якій немає ані слова про секрет — і шукати причину доводиться довго.
    if (!/^[\x20-\x7e]+$/.test(secret)) {
      this.log.error('REVALIDATE_SECRET містить не-ASCII символи — заголовок такий не приймає');
      return 'REVALIDATE_SECRET має складатися лише з латиниці, цифр і знаків';
    }

    try {
      // Таймаут обовʼязковий: без нього публікація висить рівно стільки,
      // скільки мовчить вебзастосунок, і людина в адмінці не розуміє чому.
      const res = await fetch(`${base.replace(/\/$/, '')}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ paths }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const body = (await res.text()).slice(0, 200);
        this.log.error(`Кеш не скинуто: HTTP ${res.status} ${body}`);
        return `сайт відповів ${res.status}`;
      }
      return '';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(`Кеш не скинуто: ${message}`);
      return message.includes('timed out') || message.includes('TimeoutError')
        ? 'сайт не відповів за 8 секунд'
        : message.slice(0, 200);
    }
  }
}
