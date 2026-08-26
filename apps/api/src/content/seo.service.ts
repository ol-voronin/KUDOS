import { Injectable } from '@nestjs/common';
import { BlockList, type SeoAuditDto } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { auditSeo, type AuditPage } from './seo-audit';
import { SettingsService } from './settings.service';

/**
 * Перевірка SEO по вмісту бази.
 *
 * Рахується на вимогу, а не зберігається: дефекти зʼявляються й зникають від
 * кожної правки тексту, і збережений учорашній список був би гіршим за
 * відсутній — йому вірять.
 */
@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async audit(): Promise<SeoAuditDto> {
    const [rows, settings, prints, breeds, collections] = await Promise.all([
      this.prisma.db.page.findMany({
        where: { locale: 'UK' },
        select: {
          id: true, slug: true, kind: true,
          versions: {
            where: { status: 'PUBLISHED' }, take: 1,
            select: { title: true, excerpt: true, seoTitle: true, seoDescription: true, noindex: true, blocks: true },
          },
        },
      }),
      this.settings.settings(),
      this.prisma.db.print.findMany({ where: { isPublished: true }, select: { slug: true } }),
      this.prisma.db.breed.findMany({ select: { slug: true } }),
      this.prisma.db.collection.findMany({ where: { isPublished: true }, select: { slug: true } }),
    ]);

    const pages: AuditPage[] = rows.map((p): AuditPage => {
      const v = p.versions[0];
      // Блоки, які не проходять схему, для перевірки просто порожні: сторінка
      // з таким блоком уже зламана, і сипати через це десятком SEO-зауважень
      // означало б сховати справжню причину.
      const parsed = v === undefined ? null : BlockList.safeParse(v.blocks);
      return {
        id: p.id,
        slug: p.slug,
        kind: p.kind,
        isPublished: v !== undefined,
        title: v?.title ?? p.slug,
        seoTitle: v?.seoTitle ?? '',
        seoDescription: v?.seoDescription ?? '',
        excerpt: v?.excerpt ?? '',
        noindex: v?.noindex ?? false,
        blocks: parsed?.success === true ? parsed.data : [],
      };
    });

    const findings = auditSeo({
      pages,
      allowIndexing: settings.allowIndexing,
      brand: settings.brand,
      printSlugs: new Set(prints.map((r) => r.slug)),
      breedSlugs: new Set(breeds.map((r) => r.slug)),
      collectionSlugs: new Set(collections.map((r) => r.slug)),
    });

    const published = pages.filter((p) => p.isPublished);

    return {
      findings,
      summary: {
        published: published.length,
        // «Скільки сторінок справді може потрапити в пошук» — головне число
        // на цьому екрані. Воно нуль, доки вимкнено індексацію, і саме так і
        // має бути видно.
        indexable: settings.allowIndexing ? published.filter((p) => !p.noindex).length : 0,
        errors: findings.filter((f) => f.level === 'error').length,
        warnings: findings.filter((f) => f.level === 'warning').length,
        allowIndexing: settings.allowIndexing,
      },
    };
  }
}
