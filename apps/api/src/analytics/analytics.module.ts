import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { ContentModule } from '../content/content.module';
import { AnalyticsAdminController, AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MetaCapiService } from './meta-capi.service';
import { TrackingService } from './tracking.service';

@Module({
  imports: [AuthModule, ContentModule],
  controllers: [AnalyticsController, AnalyticsAdminController],
  providers: [AnalyticsService, TrackingService, MetaCapiService, PrismaService],
  exports: [AnalyticsService, MetaCapiService],
})
export class AnalyticsModule {}
