import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { MonobankService } from './monobank.service';
import { type MonobankWebhookBody, PaymentsWebhookService } from './payments-webhook.service';

const WebhookBodySchema = z.object({
  invoiceId: z.string().min(1),
  status: z.enum(['created', 'processing', 'hold', 'success', 'failure', 'reversed', 'expired']),
  failureReason: z.string().optional(),
  /** Наш orderId — запасний шлях, якщо invoiceId не встиг записатись у Payment. */
  reference: z.string().optional(),
  /** Сума в копійках; звіряється з виставленою, розбіжність логується. */
  amount: z.number().int().nonnegative().optional(),
}).passthrough();

/**
 * Monobank's callback. Not part of the public Swagger surface — it is not
 * meant to be called by anything other than Monobank's backend, verified by
 * `X-Sign` rather than by auth.
 */
@ApiExcludeController()
@Controller({ path: 'payments/monobank', version: '1' })
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(
    private readonly monobank: MonobankService,
    private readonly webhookService: PaymentsWebhookService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-sign') signature?: string,
  ): Promise<{ ok: true }> {
    // Verification needs the exact bytes Monobank signed — a re-serialised
    // JSON object is not guaranteed to match byte-for-byte. Requires
    // `rawBody: true` on the Nest app (see main.ts).
    if (!req.rawBody || !signature) {
      this.logger.warn('webhook.rejected reason=missing_signature');
      throw new BadRequestException('Missing signature');
    }

    const verified = await this.monobank.verifyWebhook(req.rawBody, signature);
    if (!verified) {
      // Logged, not just rejected — repeated hits here are a forged-webhook signal worth alerting on.
      this.logger.warn('webhook.rejected reason=invalid_signature');
      throw new BadRequestException('Invalid signature');
    }

    const body: MonobankWebhookBody = WebhookBodySchema.parse(req.body);
    this.logger.log(`webhook.received invoiceId=${body.invoiceId} status=${body.status}`);
    await this.webhookService.handle(body);
    return { ok: true };
  }
}
