import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { MonobankService } from './monobank.service';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsWebhookService } from './payments-webhook.service';

@Module({
  controllers: [CheckoutController, PaymentsWebhookController],
  providers: [PrismaService, MonobankService, CheckoutService, PaymentsWebhookService],
})
export class PaymentsModule {}
