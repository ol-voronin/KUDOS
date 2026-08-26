import { Injectable, Logger } from '@nestjs/common';
import type { AdminStatsDto, AttributionDto, TrackEventDto } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { requireSiteId } from '../common/site-context';
import { dailySeries, rankPages, rankSources, type EventRow, type OutcomeRow } from './stats.domain';

/**
 * Збір і читання власної статистики.
 *
 * Записуємо все, що прийшло з браузера, крім того, що дозволяє когось
 * упізнати: IP і User-Agent тут не зʼявляються навіть у логах. Через це
 * таблиця подій — не персональні дані, і банер згоди їй не потрібен.
 */
@Injectable()
export class AnalyticsService {
  private readonly log = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записати подію.
   *
   * Помилка тут ніколи не доходить до відвідувача: статистика не та річ,
   * заради якої можна показати людині збій. Але й мовчати не можна — інакше
   * порожні звіти виглядають як «до нас ніхто не заходить».
   */
  async track(dto: TrackEventDto): Promise<void> {
    try {
      await this.prisma.db.analyticsEvent.create({
        data: {
          siteId: requireSiteId('події', 'запису'),
          name: dto.name,
          path: dto.path.slice(0, 500),
          sessionId: dto.sessionId,
          referrerHost: dto.referrerHost,
          utmSource: dto.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          utmTerm: dto.utmTerm,
          utmContent: dto.utmContent,
          gclid: dto.gclid,
          valueMinor: dto.valueMinor,
        },
      });
    } catch (error: unknown) {
      this.log.error(`Подію ${dto.name} не записано: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Подія з сервера — для оплати.
   *
   * Клієнтський тег на сторінці «дякуємо» не спрацює, якщо людина закрила
   * вкладку одразу після оплати, а таких помітна частка. Власні цифри мають
   * бути правильними, тож `purchase` пишеться ще й тут, із вебхука.
   */
  async trackPurchase(order: {
    id: string;
    totalMinor: number;
    sessionId: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    gclid: string;
  }): Promise<void> {
    await this.track({
      name: 'purchase',
      path: `/order/${order.id}`,
      sessionId: order.sessionId,
      referrerHost: '',
      utmSource: order.utmSource,
      utmMedium: order.utmMedium,
      utmCampaign: order.utmCampaign,
      utmTerm: '',
      utmContent: '',
      gclid: order.gclid,
      landingPath: '',
      valueMinor: order.totalMinor,
    });
  }

  async stats(days: number): Promise<AdminStatsDto> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [events, leads, orders] = await Promise.all([
      this.prisma.db.analyticsEvent.findMany({
        where: { createdAt: { gte: since } },
        select: {
          name: true, path: true, sessionId: true, createdAt: true,
          utmSource: true, utmMedium: true, utmCampaign: true, valueMinor: true,
        },
      }),
      this.prisma.db.lead.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, utmSource: true, utmMedium: true, utmCampaign: true },
      }),
      this.prisma.db.order.findMany({
        where: { placedAt: { gte: since }, status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] } },
        select: { placedAt: true, totalMinor: true, utmSource: true, utmMedium: true, utmCampaign: true },
      }),
    ]);

    const eventRows: EventRow[] = events.map((e) => ({
      name: e.name,
      path: e.path,
      sessionId: e.sessionId,
      at: e.createdAt,
      source: e.utmSource,
      medium: e.utmMedium,
      campaign: e.utmCampaign,
      valueMinor: e.valueMinor,
    }));

    const leadRows: OutcomeRow[] = leads.map((l) => ({
      at: l.createdAt, source: l.utmSource, medium: l.utmMedium, campaign: l.utmCampaign, valueMinor: 0,
    }));
    const orderRows: OutcomeRow[] = orders.map((o) => ({
      at: o.placedAt, source: o.utmSource, medium: o.utmMedium, campaign: o.utmCampaign, valueMinor: o.totalMinor,
    }));

    const visits = new Set(eventRows.map((e) => e.sessionId)).size;
    const views = eventRows.filter((e) => e.name === 'page_view').length;
    const revenueMinor = orderRows.reduce((sum, o) => sum + o.valueMinor, 0);
    const outcomes = leadRows.length + orderRows.length;

    return {
      days,
      totals: {
        views,
        visits,
        leads: leadRows.length,
        orders: orderRows.length,
        revenueMinor,
        // Соті відсотка, цілим числом: відсоток конверсії — це ставка, а не
        // гроші, і зберігати його дробом означало б тягнути float у звіт.
        conversionHundredths: visits === 0 ? 0 : Math.round((outcomes / visits) * 10_000),
      },
      daily: dailySeries(eventRows, leadRows, days, new Date()),
      sources: rankSources(eventRows, leadRows, orderRows),
      pages: rankPages(eventRows),
    };
  }
}

/** Порожня атрибуція — коли браузер нічого не прислав. */
export function attributionOf(dto: Partial<AttributionDto> | undefined): AttributionDto {
  return {
    utmSource: dto?.utmSource ?? '',
    utmMedium: dto?.utmMedium ?? '',
    utmCampaign: dto?.utmCampaign ?? '',
    utmTerm: dto?.utmTerm ?? '',
    utmContent: dto?.utmContent ?? '',
    gclid: dto?.gclid ?? '',
    landingPath: dto?.landingPath ?? '',
    referrerHost: dto?.referrerHost ?? '',
    sessionId: dto?.sessionId ?? '',
  };
}
