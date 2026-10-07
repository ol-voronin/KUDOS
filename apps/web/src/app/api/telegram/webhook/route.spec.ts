import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
vi.mock('@vercel/blob', () => ({ put: (...args: unknown[]) => put(...args) }));

const { POST } = await import('./route');

/**
 * Вебхук правок. Головне — не «чи створюється issue», а «чи мовчить бот
 * там, де мусить мовчати», і «чи закритий маршрут без секрета».
 */
const ENV = {
  VERCEL_ENV: 'production',
  TELEGRAM_BOT_TOKEN: '999:test-token',
  TELEGRAM_WEBHOOK_SECRET: 'hook-secret',
  TELEGRAM_GITHUB_TOKEN: 'gh-token',
  TELEGRAM_EDITS_CHAT_ID: '-100',
  TELEGRAM_EDITS_THREAD_ID: '7',
  TELEGRAM_EDITORS: '1,2',
};

const fetchMock = vi.fn();

function update(message: Record<string, unknown>, updateId = 1) {
  return {
    update_id: updateId,
    message: { message_id: 10, message_thread_id: 7, chat: { id: -100 }, from: { id: 2, first_name: 'Даша' }, ...message },
  };
}

function post(body: unknown, secret = 'hook-secret'): Request {
  return new Request('https://babaka.shop/api/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify(body),
  });
}

function calls(host: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(host));
}

beforeEach(() => {
  Object.assign(process.env, ENV);
  put.mockReset().mockResolvedValue({ url: 'https://blob/x' });
  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes('api.github.com') && init?.method === 'POST' && url.endsWith('/issues')) {
      return new Response(JSON.stringify({ number: 42 }), { status: 201 });
    }
    if (url.includes('api.github.com')) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(ENV)) delete process.env[key];
});

describe('POST /api/telegram/webhook', () => {
  it('поганий секрет — 401 і жодного виклику', async () => {
    const res = await POST(post(update({ text: 'правка: x' }), 'wrong'));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не в Production — 404', async () => {
    process.env['VERCEL_ENV'] = 'preview';
    const res = await POST(post(update({ text: 'правка: x' })));
    expect(res.status).toBe(404);
  });

  it('без налаштувань — закрито', async () => {
    delete process.env['TELEGRAM_WEBHOOK_SECRET'];
    const res = await POST(post(update({ text: 'правка: x' })));
    expect(res.status).toBe(503);
  });

  it('тема «Реклама» — 200 і тиша', async () => {
    const res = await POST(post(update({ message_thread_id: 88, text: 'правка: x' })));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('не редактор — 200 і тиша', async () => {
    const res = await POST(post(update({ from: { id: 555 }, text: 'правка: x' })));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('правка → issue з міткою і реплай у тему правок', async () => {
    const res = await POST(post(update({ text: 'правка: зміни заголовок на головній' })));
    expect(res.status).toBe(200);

    const github = calls('api.github.com');
    const created = JSON.parse(String(github[0]![1]!.body)) as { title: string; body: string };
    expect(created.title).toBe('зміни заголовок на головній');
    expect(created.body).toContain('<!-- tg:{"chat":-100,"thread":7,"msg":10,"update":1} -->');
    expect(github.some(([url, init]) => String(url).endsWith('/issues/42/labels') && String(init!.body).includes('telegram-edit'))).toBe(true);

    const [sent] = calls('api.telegram.org');
    const payload = JSON.parse(String(sent![1]!.body)) as Record<string, unknown>;
    expect(payload['message_thread_id']).toBe(7);
    expect(String(payload['text'])).toMatch(/^Прийняв, #42 👌/u);
  });

  it('повтор того самого update_id не створює другу issue', async () => {
    put.mockRejectedValueOnce(new Error('Vercel Blob: This blob already exists'));
    await POST(post(update({ text: 'правка: x' })));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
