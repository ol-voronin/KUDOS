import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ErrorCode,
  type ConversionActionCreateDto, type ConversionActionDto,
  type ConversionActionUpdateDto, type TrackingConfigDto,
} from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { requireSiteId } from '../common/site-context';
import { SettingsService } from '../content/settings.service';

/**
 * Налаштування сторонніх тегів.
 *
 * Окремо від власної статистики навмисно. Це два різні механізми з різними
 * наслідками: наша таблиця подій нікого не ідентифікує й працює завжди, а
 * GA4 ставить cookie й вимагає згоди. Змішати їх в один «модуль аналітики»
 * означало б або питати згоду там, де вона не потрібна, або не питати там,
 * де потрібна.
 */
@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Що віддати браузеру.
   *
   * Порожні ідентифікатори — і жоден сторонній скрипт не вантажиться взагалі.
   * Сайт без реклами не повинен тягнути чужий код тільки тому, що модуль існує.
   */
  async config(): Promise<TrackingConfigDto> {
    const [settings, conversions] = await Promise.all([
      this.settings.settings(),
      this.list(true),
    ]);
    return {
      ga4MeasurementId: settings.ga4MeasurementId,
      googleAdsId: settings.googleAdsId,
      conversions,
    };
  }

  async list(onlyActive: boolean): Promise<ConversionActionDto[]> {
    const rows = await this.prisma.db.conversionAction.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { event: 'asc' },
      select: { id: true, event: true, label: true, sendValue: true, isActive: true },
    });
    return rows as ConversionActionDto[];
  }

  async create(dto: ConversionActionCreateDto): Promise<ConversionActionDto[]> {
    await this.prisma.db.conversionAction.upsert({
      where: { siteId_event: { siteId: requireSiteId(), event: dto.event } },
      update: { label: dto.label, sendValue: dto.sendValue, isActive: true },
      create: { ...dto, siteId: requireSiteId() },
    });
    return this.list(false);
  }

  async update(id: string, dto: ConversionActionUpdateDto): Promise<ConversionActionDto[]> {
    const exists = await this.prisma.db.conversionAction.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Конверсію не знайдено' });
    await this.prisma.db.conversionAction.update({ where: { id }, data: dto });
    return this.list(false);
  }

  async remove(id: string): Promise<ConversionActionDto[]> {
    await this.prisma.db.conversionAction.deleteMany({ where: { id } });
    return this.list(false);
  }
}
