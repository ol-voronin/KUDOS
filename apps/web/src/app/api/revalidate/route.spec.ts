import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

const { POST } = await import('./route');

/**
 * Ендпоінт скидання кешу.
 *
 * Перевіряємо не «чи працює», а «чи не відкритий»: цей маршрут перебудовує
 * сторінки, тож незахищений він стає безкоштовним способом навантажити сайт.
 */
function post(body: unknown, secret?: string): Request {
  return new Request('http://localhost/api/revalidate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret === undefined ? {} : { 'x-revalidate-secret': secret }),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    revalidatePath.mockClear();
    process.env['REVALIDATE_SECRET'] = 's3cret-value';
  });

  it('без секрета в оточенні маршрут закритий, а не відкритий', async () => {
    // Найважливіший тест у файлі. Забути змінну оточення легко; якби при
    // цьому перевірка просто вимикалася, дірка зʼявилася б непомітно.
    delete process.env['REVALIDATE_SECRET'];
    const res = await POST(post({ paths: ['/oferta'] }, 'anything'));
    expect(res.status).toBe(503);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('без заголовка — 401', async () => {
    const res = await POST(post({ paths: ['/oferta'] }));
    expect(res.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('з чужим секретом — 401', async () => {
    const res = await POST(post({ paths: ['/oferta'] }, 'wrong-value'));
    expect(res.status).toBe(401);
  });

  it('зі своїм секретом скидає вказані шляхи', async () => {
    const res = await POST(post({ paths: ['/oferta', '/sitemap.xml'] }, 's3cret-value'));
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith('/oferta');
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
  });

  it('відкидає шляхи, які не починаються зі слеша або лізуть угору', async () => {
    const res = await POST(post({ paths: ['../../etc', 'oferta', '/добре'] }, 's3cret-value'));
    expect(res.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/добре');
  });

  it('порожній або надто довгий список — 400', async () => {
    expect((await POST(post({ paths: [] }, 's3cret-value'))).status).toBe(400);
    const many = Array.from({ length: 51 }, (_, i) => `/p${i}`);
    expect((await POST(post({ paths: many }, 's3cret-value'))).status).toBe(400);
  });

  it('усі шляхи негодящі — 400, а не тихий успіх', async () => {
    const res = await POST(post({ paths: ['oferta'] }, 's3cret-value'));
    expect(res.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
