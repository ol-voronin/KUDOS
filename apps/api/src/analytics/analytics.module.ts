import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { ContentModule } from '../content/content.module';
import { AnalyticsAdminController, AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TrackingService } from './tracking.service';

@Module({
  imports: [AuthModule, ContentModule],
  controllers: [AnalyticsController, AnalyticsAdminController],
  providers: [AnalyticsService, TrackingService, PrismaService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
