import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import {
  ConversionActionCreateDto, ConversionActionUpdateDto, StatsRangeDto, TrackEventDto,
  type AdminStatsDto, type ConversionActionDto, type TrackingConfigDto,
} from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';
import { TrackingService } from './tracking.service';

/**
 * Прийом подій із браузера.
 *
 * Обмеження частоти тут не про зловмисника, а про звичайну помилку: цикл у
 * компоненті, який шле подію на кожен рендер, зіпсує статистику швидше, ніж
 * хтось помітить. Ліміт високий, бо перегляди сторінок — це нормальний потік.
 */
@ApiTags('analytics')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly tracking: TrackingService,
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  async track(@Body(new ZodValidationPipe(TrackEventDto)) dto: TrackEventDto): Promise<void> {
    await this.analytics.track(dto);
  }

  /** Ідентифікатори тегів для браузера. Порожні — скрипти не вантажаться. */
  @Get('config')
  config(): Promise<TrackingConfigDto> {
    return this.tracking.config();
  }
}

@ApiTags('admin')
@Controller({ path: 'admin/analytics', version: '1' })
@UseGuards(JwtAuthGuard)
export class AnalyticsAdminController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly tracking: TrackingService,
  ) {}

  @Get('stats')
  stats(@Query(new ZodValidationPipe(StatsRangeDto)) query: StatsRangeDto): Promise<AdminStatsDto> {
    return this.analytics.stats(query.days);
  }

  @Get('conversions')
  list(): Promise<ConversionActionDto[]> {
    return this.tracking.list(false);
  }

  @Post('conversions')
  create(
    @Body(new ZodValidationPipe(ConversionActionCreateDto)) dto: ConversionActionCreateDto,
  ): Promise<ConversionActionDto[]> {
    return this.tracking.create(dto);
  }

  @Patch('conversions/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ConversionActionUpdateDto)) dto: ConversionActionUpdateDto,
  ): Promise<ConversionActionDto[]> {
    return this.tracking.update(id, dto);
  }

  @Delete('conversions/:id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<ConversionActionDto[]> {
    return this.tracking.remove(id);
  }
}
