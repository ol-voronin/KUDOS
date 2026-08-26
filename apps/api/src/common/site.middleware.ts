import { Injectable, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@dt/contracts';
import { PrismaService } from './prisma.service';
import { runWithSite, type SiteContext } from './site-context';

/**
 * Визначає, чий сайт обслуговує цей запит, і ставить контекст на весь його
 * ланцюжок викликів.
 *
 * Порядок пошуку:
 *   1. збіг за доменом із `Site.hosts`;
 *   2. якщо збігу немає, а сайт в установці один — беремо його.
 *
 * Другий крок існує рівно для сьогоднішнього стану: доменів ще немає, сайт
 * один. Щойно зʼявиться другий, запит із незнайомим доменом почне падати —
 * і це правильно. Мовчки віддати перший-ліпший сайт означало б показати
 * одному клієнту вміст іншого.
 *
 * Кеш навмисно простий: перелік сайтів змінюється кілька разів на рік, а
 * запит до бази на кожен HTTP-виклик — це зайвий рейс до Франкфурта.
 */
@Injectable()
export class SiteMiddleware implements NestMiddleware {
  private cache: { at: number; sites: SiteContext[]; hosts: Map<string, SiteContext> } | null = null;

  private static readonly TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  private async load(): Promise<{ sites: SiteContext[]; hosts: Map<string, SiteContext> }> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < SiteMiddleware.TTL_MS) return this.cache;

    const rows = await this.prisma.db.site.findMany({
      where: { isActive: true },
      select: { id: true, key: true, hosts: true, modules: true },
    });

    const sites: SiteContext[] = rows.map((r: { id: string; key: string; modules: string[] }) => ({
      siteId: r.id, key: r.key, modules: r.modules,
    }));
    const hosts = new Map<string, SiteContext>();
    for (const [i, row] of (rows as Array<{ hosts: string[] }>).entries()) {
      const site = sites[i];
      if (!site) continue;
      for (const host of row.hosts) hosts.set(host.toLowerCase(), site);
    }

    this.cache = { at: now, sites, hosts };
    return this.cache;
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const { sites, hosts } = await this.load();

    // Порт у заголовку є на локальній машині й заважає збігу.
    const host = (req.headers.host ?? '').toLowerCase().split(':')[0] ?? '';
    const byHost = hosts.get(host);
    const site = byHost ?? (sites.length === 1 ? sites[0] : undefined);

    if (!site) {
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL,
        message: sites.length === 0
          ? 'В установці немає жодного активного сайту'
          : `Домен ${host} не привʼязаний до жодного сайту`,
      });
    }

    runWithSite(site, () => next());
  }
}
