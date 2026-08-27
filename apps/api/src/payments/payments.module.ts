import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PricingModule } from '../pricing/pricing.module';
import { CartPricingService } from './cart-pricing.service';
import { OrdersAdminController } from './orders-admin.controller';
import { OrdersAdminService } from './orders-admin.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MonobankService } from './monobank.service';
import { PaymentsAdminController } from './payments-admin.controller';
import { PaymentsAdminService } from './payments-admin.service';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsWebhookService } from './payments-webhook.service';

@Module({
  imports: [AuthModule, PricingModule, AnalyticsModule],
  controllers: [
    OrdersController,
    PaymentsWebhookController, PaymentsAdminController, OrdersAdminController,
  ],
  providers: [
    PrismaService, MonobankService,
    CartPricingService, OrdersService, OrdersAdminService,
    PaymentsWebhookService, PaymentsAdminService,
  ],
})
export class PaymentsModule {}
