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

export async function issueExists(ctx: Ctx, issue: number): Promise<boolean> {
  try {
    const found = await gh<{ labels: { name: string }[]; pull_request?: unknown }>(ctx, 'GET', `/issues/${issue}`);
    return found.pull_request === undefined && found.labels.some((l) => l.name === 'telegram-edit');
  } catch {
    return false;
  }
}

export async function commentIssue(ctx: Ctx, issue: number, body: string): Promise<void> {
  await gh(ctx, 'POST', `/issues/${issue}/comments`, { body });
}

export async function dispatchWorkflow(ctx: Ctx, file: string, inputs: Record<string, string>): Promise<void> {
  await gh(ctx, 'POST', `/actions/workflows/${file}/dispatches`, { ref: 'main', inputs });
}
