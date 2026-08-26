import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PricingModule } from '../pricing/pricing.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { MonobankService } from './monobank.service';
import { PaymentsAdminController } from './payments-admin.controller';
import { PaymentsAdminService } from './payments-admin.service';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsWebhookService } from './payments-webhook.service';

@Module({
  imports: [AuthModule, PricingModule, AnalyticsModule],
  controllers: [CheckoutController, PaymentsWebhookController, PaymentsAdminController],
  providers: [PrismaService, MonobankService, CheckoutService, PaymentsWebhookService, PaymentsAdminService],
})
export class PaymentsModule {}
