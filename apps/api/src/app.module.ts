import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { HealthController } from './common/health.controller';
import { PrismaService } from './common/prisma.service';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CatalogModule } from './catalog/catalog.module';
import { ContentModule } from './content/content.module';
import { SiteMiddleware } from './common/site.middleware';
import { CustomRequestsModule } from './custom-requests/custom-requests.module';
import { LeadsModule } from './leads/leads.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    // Assume every endpoint is publicly exposed, because it is.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    AnalyticsModule,
    CatalogModule,
    ContentModule,
    CustomRequestsModule,
    LeadsModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    SiteMiddleware,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Порядок має значення: контекст сайту мусить стояти до всього, що
    // читає дані, інакше перший же запит впаде без сайту.
    consumer.apply(CorrelationIdMiddleware, SiteMiddleware).forRoutes('*');
  }
}
