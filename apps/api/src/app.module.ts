import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { PrismaService } from './common/prisma.service';
import { CatalogModule } from './catalog/catalog.module';
import { CustomRequestsModule } from './custom-requests/custom-requests.module';
import { LeadsModule } from './leads/leads.module';

@Module({
  imports: [
    // Assume every endpoint is publicly exposed, because it is.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    CatalogModule,
    CustomRequestsModule,
    LeadsModule,
  ],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
