import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn();
const list = vi.fn();
vi.mock('@vercel/blob', () => ({ put: (...args: unknown[]) => put(...args), list: (...args: unknown[]) => list(...args) }));

const { POST } = await import('./route');
const { albumTiming } = await import('@/features/telegram-edits/storage');
albumTiming.settleMs = 0;
albumTiming.pollMs = 0;
albumTiming.pollTries = 3;

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

interface FakeIssue { number: number; updated_at: string; body: string; comments: number; state?: string; lastComment?: string }
let openIssues: FakeIssue[] = [];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

beforeEach(() => {
  Object.assign(process.env, ENV);
  openIssues = [];
  put.mockReset().mockImplementation(async (path: string) => ({ url: `https://blob/${path}` }));
  list.mockReset().mockResolvedValue({ blobs: [] });
  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url.includes('api.github.com')) {
      const path = url.replace('https://api.github.com/repos/ol-voronin/kudos', '');
      if (method === 'POST' && path === '/issues') return json({ number: 42 }, 201);
      if (method === 'GET' && path.startsWith('/issues?')) return json(openIssues);
      const comments = /^\/issues\/(\d+)\/comments\?/u.exec(path);
      if (method === 'GET' && comments) {
        const found = openIssues.find((i) => i.number === Number(comments[1]));
        return json(found?.lastComment ? [{ body: found.lastComment, author_association: 'OWNER' }] : []);
      }
      const one = /^\/issues\/(\d+)$/u.exec(path);
      if (method === 'GET' && one) {
        const found = openIssues.find((i) => i.number === Number(one[1]));
        if (!found) return json({ message: 'Not Found' }, 404);
        return json({ ...found, state: found.state ?? 'open', labels: [{ name: 'telegram-edit' }] });
      }
      return json({});
    }
    if (url.includes('/getFile')) return json({ ok: true, result: { file_path: 'voice/file.oga' } });
    if (url.includes('api.telegram.org/file/')) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    return json({ ok: true, result: {} });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of Object.keys(ENV)) delete process.env[key];
});

function github(method: string, pathPart: string) {
  return calls('api.github.com').filter(([url, init]) => ((init as RequestInit | undefined)?.method ?? 'GET') === method && String(url).includes(pathPart));
}

function created() {
  return github('POST', '/issues').filter(([url]) => String(url).endsWith('/issues'));
}

function sentTexts(): string[] {
  return calls('api.telegram.org')
    .filter(([url]) => String(url).endsWith('/sendMessage'))
    .map(([, init]) => String((JSON.parse(String((init as RequestInit).body)) as { text: string }).text));
}

function dispatched(): { file: string; inputs: Record<string, string> }[] {
  return github('POST', '/dispatches').map(([url, init]) => ({
    file: /workflows\/([^/]+)\/dispatches/u.exec(String(url))![1]!,
    inputs: (JSON.parse(String((init as RequestInit).body)) as { inputs: Record<string, string> }).inputs,
  }));
}

function bodyOf(call: unknown[] | undefined): string {
  return String((call![1] as RequestInit).body);
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();
const block = (from: number) => `<!-- tg:{"chat":-100,"thread":7,"msg":1,"update":1,"from":${from}} -->`;

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
    const res = await POST(post(update({ message_thread_id: 88, text: 'зміни заголовок' })));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('не редактор — 200 і тиша, навіть без префікса і з голосовим', async () => {
    for (const message of [{ text: 'правка: x' }, { text: 'зміни заголовок' }, { voice: { file_id: 'v' } }]) {
      const res = await POST(post(update({ from: { id: 555 }, ...message })));
      expect(res.status).toBe(200);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('просто текст без префікса → issue з міткою і коротка відповідь', async () => {
    const res = await POST(post(update({ text: 'зміни заголовок на головній' })));
    expect(res.status).toBe(200);

    const issue = JSON.parse(bodyOf(created()[0])) as { title: string; body: string };
    expect(issue.title).toBe('зміни заголовок на головній');
    expect(issue.body).toContain('<!-- tg:{"chat":-100,"thread":7,"msg":10,"update":1,"from":2,"owner":1} -->');
    expect(github('POST', '/issues/42/labels').some((c) => bodyOf(c).includes('telegram-edit'))).toBe(true);

    const [sent] = calls('api.telegram.org');
    const payload = JSON.parse(bodyOf(sent)) as Record<string, unknown>;
    expect(payload['message_thread_id']).toBe(7);
    expect(payload['text']).toBe('Прийняв, #42 👌');
  });

  it('«правка:» лишилась і завжди відкриває нову правку', async () => {
    openIssues = [{ number: 5, updated_at: minutesAgo(2), body: `x\n\n${block(2)}`, comments: 0 }];
    await POST(post(update({ text: 'правка: зміни заголовок' })));
    expect(created()).toHaveLength(1);
    expect(github('POST', '/issues/5/comments')).toHaveLength(0);
  });

  it('свіжа відкрита правка того ж автора (< 20 хв) — доповнення, а не нова issue', async () => {
    openIssues = [{ number: 5, updated_at: minutesAgo(3), body: `x\n\n${block(2)}`, comments: 1 }];
    await POST(post(update({ text: 'і ще кнопку зеленою' })));
    expect(created()).toHaveLength(0);
    expect(bodyOf(github('POST', '/issues/5/comments')[0])).toContain('і ще кнопку зеленою');
    expect(sentTexts()).toEqual(['Додав до #5 👌']);
  });

  it('свіжа правка іншого редактора — не склеюємо', async () => {
    openIssues = [{ number: 5, updated_at: minutesAgo(3), body: `x\n\n${block(1)}`, comments: 0 }];
    await POST(post(update({ text: 'зміни футер' })));
    expect(created()).toHaveLength(1);
    expect(github('POST', '/issues/5/comments')).toHaveLength(0);
  });

  it('стара правка, де бот спитав і чекає, — «ок» іде туди відповіддю', async () => {
    openIssues = [{
      number: 6, updated_at: minutesAgo(300), body: `x\n\n${block(2)}`, comments: 2,
      lastComment: 'Яку кнопку: «Купити» чи «Кошик»?\n\n<!-- claude-question -->\n<!-- claude-bot -->',
    }];
    await POST(post(update({ text: 'ок' })));
    expect(created()).toHaveLength(0);
    expect(github('POST', '/issues/6/comments')).toHaveLength(1);
    expect(github('GET', '/issues/6/comments?per_page=1&page=2')).toHaveLength(1);
  });

  it('стара правка без питання — нова issue', async () => {
    openIssues = [{ number: 6, updated_at: minutesAgo(300), body: `x\n\n${block(2)}`, comments: 1, lastComment: 'щось <!-- claude-bot -->' }];
    await POST(post(update({ text: 'зміни футер' })));
    expect(created()).toHaveLength(1);
  });

  it('«дякую» без питання бота — тиша, жодної issue', async () => {
    openIssues = [{ number: 5, updated_at: minutesAgo(3), body: `x\n\n${block(2)}`, comments: 0 }];
    await POST(post(update({ text: 'дякую' })));
    expect(created()).toHaveLength(0);
    expect(github('POST', '/comments')).toHaveLength(0);
    expect(sentTexts()).toEqual([]);
  });

  it('реплай на бота з #N — коментар до #N; закрита #N — нова правка', async () => {
    const replyTo = { message_id: 5, from: { id: 999, is_bot: true }, chat: { id: -100 }, text: 'Прийняв, #9 👌' };
    openIssues = [{ number: 9, updated_at: minutesAgo(600), body: `x\n\n${block(1)}`, comments: 0 }];
    await POST(post(update({ text: 'і шрифт більший', reply_to_message: replyTo })));
    expect(github('POST', '/issues/9/comments')).toHaveLength(1);

    fetchMock.mockClear();
    openIssues = [{ number: 9, updated_at: minutesAgo(600), body: `x\n\n${block(1)}`, comments: 0, state: 'closed' }];
    await POST(post(update({ text: 'і шрифт більший', reply_to_message: replyTo }, 2)));
    expect(github('POST', '/issues/9/comments')).toHaveLength(0);
    expect(created()).toHaveLength(1);
  });

  it('голосове → файл у Blob, issue і «Слухаю 🎧, #N» одразу, без розшифровки', async () => {
    await POST(post(update({ voice: { file_id: 'v1', duration: 7 } })));
    expect(put).toHaveBeenCalledWith('edits/42/10.ogg', expect.anything(), expect.objectContaining({ contentType: 'audio/ogg' }));
    expect(bodyOf(github('PATCH', '/issues/42')[0])).toContain('🎙 Голосове: https://blob/edits/42/10.ogg');
    const issue = JSON.parse(bodyOf(created()[0])) as { title: string };
    expect(issue.title).toBe('Голосове з Telegram');
    expect(sentTexts()).toEqual(['Слухаю 🎧, #42']);
  });

  it('альбом: перше фото створює issue і відповідає, решта — коментарі туди ж мовчки', async () => {
    const photo = [{ file_id: 'p', width: 10, height: 10 }];
    await POST(post(update({ message_id: 20, photo, caption: 'ось так треба', media_group_id: 'g1' }, 10)));
    expect(created()).toHaveLength(1);
    expect(put).toHaveBeenCalledWith('telegram/groups/g1/issue-42.txt', '1', expect.anything());
    expect(sentTexts()).toEqual(['Прийняв, #42 👌']);

    fetchMock.mockClear();
    put.mockImplementation(async (path: string) => {
      if (path === 'telegram/groups/g1/lock.txt') throw new Error('Vercel Blob: This blob already exists');
      return { url: `https://blob/${path}` };
    });
    list.mockResolvedValue({ blobs: [{ pathname: 'telegram/groups/g1/issue-42.txt' }] });
    await POST(post(update({ message_id: 21, photo, media_group_id: 'g1' }, 11)));
    expect(created()).toHaveLength(0);
    expect(bodyOf(github('POST', '/issues/42/comments')[0])).toContain('![](https://blob/edits/42/21.jpg)');
    expect(sentTexts()).toEqual([]);
  });

  it('«викладай на сайт» від будь-якого редактора → підготовка випуску з id Олексія', async () => {
    await POST(post(update({ text: 'викладай на сайт' })));
    expect(dispatched()).toEqual([{
      file: 'telegram-release.yml',
      inputs: { action: 'prepare', reply_to: '10', owner_id: '1', requested_by: 'Даша' },
    }]);
  });

  it('«так» Олексія на «Випускаємо?» → злиття; «так» Даші — чекаємо Олексія; «ні» — скасування', async () => {
    const prompt = { message_id: 60, from: { id: 999, is_bot: true }, chat: { id: -100 }, text: 'Випускаємо? (PR #77, версія abc1234)' };
    await POST(post(update({ from: { id: 1 }, text: 'так', reply_to_message: prompt })));
    expect(dispatched()).toEqual([{ file: 'telegram-release.yml', inputs: { action: 'merge', reply_to: '10', pr: '77', sha: 'abc1234' } }]);

    fetchMock.mockClear();
    await POST(post(update({ from: { id: 2 }, text: 'так', reply_to_message: prompt }, 2)));
    expect(dispatched()).toEqual([]);
    expect(sentTexts()).toEqual(['Чекаємо на відповідь Олексія 🙂']);

    fetchMock.mockClear();
    await POST(post(update({ from: { id: 1 }, text: 'ні', reply_to_message: prompt }, 3)));
    expect(dispatched()).toEqual([{ file: 'telegram-release.yml', inputs: { action: 'cancel', reply_to: '10', pr: '77' } }]);
  });

  it('повтор того самого update_id не створює другу issue', async () => {
    put.mockRejectedValueOnce(new Error('Vercel Blob: This blob already exists'));
    await POST(post(update({ text: 'зміни x' })));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
