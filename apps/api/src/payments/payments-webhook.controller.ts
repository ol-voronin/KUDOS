import { BadRequestException, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
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
});

/**
 * Monobank's callback. Not part of the public Swagger surface — it is not
 * meant to be called by anything other than Monobank's backend, verified by
 * `X-Sign` rather than by auth.
 */
@ApiExcludeController()
@Controller({ path: 'payments/monobank', version: '1' })
export class PaymentsWebhookController {
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
      throw new BadRequestException('Missing signature');
    }

    const verified = await this.monobank.verifyWebhook(req.rawBody, signature);
    if (!verified) {
      throw new BadRequestException('Invalid signature');
    }

    const body: MonobankWebhookBody = WebhookBodySchema.parse(req.body);
    await this.webhookService.handle(body);
    return { ok: true };
  }
}
