/**
 * Мінімум GitHub REST, потрібний вебхуку. Токен — fine-grained PAT лише на
 * цей репозиторій (Issues: write, Actions: write).
 */

interface Ctx {
  token: string;
  repo: string;
}

async function gh<T>(ctx: Ctx, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${ctx.repo}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${ctx.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'babaka-telegram-edits',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

export async function createIssue(ctx: Ctx, title: string, body: string): Promise<number> {
  // Без мітки: мітку ставимо окремо, коли тіло вже з картинками, — саме
  // подія «мітку додано» запускає агента, і він має побачити повне тіло.
  const issue = await gh<{ number: number }>(ctx, 'POST', '/issues', { title, body });
  return issue.number;
}

export async function finishIssue(ctx: Ctx, issue: number, body: string): Promise<void> {
  await gh(ctx, 'PATCH', `/issues/${issue}`, { body });
  await gh(ctx, 'POST', `/issues/${issue}/labels`, { labels: ['telegram-edit'] });
}

/** Issue з Telegram, відкрита, — у неї можна дописувати. */
export async function issueOpen(ctx: Ctx, issue: number): Promise<boolean> {
  try {
    const found = await gh<{ state: string; labels: { name: string }[]; pull_request?: unknown }>(ctx, 'GET', `/issues/${issue}`);
    return found.pull_request === undefined && found.state === 'open' && found.labels.some((l) => l.name === 'telegram-edit');
  } catch {
    return false;
  }
}

export interface OpenIssueRaw {
  number: number;
  updated_at: string;
  body: string | null;
  comments: number;
  pull_request?: unknown;
}

/** Відкриті правки з Telegram, найсвіжіші першими (без PR). */
export async function listOpenEditIssues(ctx: Ctx): Promise<OpenIssueRaw[]> {
  const items = await gh<OpenIssueRaw[]>(ctx, 'GET', '/issues?labels=telegram-edit&state=open&sort=updated&direction=desc&per_page=20');
  return items.filter((i) => i.pull_request === undefined);
}

/**
 * Тіло останнього коментаря issue (або null, якщо коментарів нема). Лише
 * коментар власника репо: репо публічне, і чужий коментар не має впливати на
 * те, куди піде повідомлення з Telegram.
 */
export async function lastCommentBody(ctx: Ctx, issue: number, count?: number): Promise<string | null> {
  let total = count;
  if (total === undefined) total = (await gh<{ comments: number }>(ctx, 'GET', `/issues/${issue}`)).comments;
  if (total <= 0) return null;
  const page = await gh<{ body: string | null; author_association?: string }[]>(
    ctx, 'GET', `/issues/${issue}/comments?per_page=1&page=${total}`,
  );
  const last = page[0];
  return last?.author_association === 'OWNER' ? (last.body ?? null) : null;
}

export async function commentIssue(ctx: Ctx, issue: number, body: string): Promise<void> {
  await gh(ctx, 'POST', `/issues/${issue}/comments`, { body });
}

export async function dispatchWorkflow(ctx: Ctx, file: string, inputs: Record<string, string>): Promise<void> {
  await gh(ctx, 'POST', `/actions/workflows/${file}/dispatches`, { ref: 'main', inputs });
}
