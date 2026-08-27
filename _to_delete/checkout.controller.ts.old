import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { ReadyPrintCheckoutRequestDto } from '@dt/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CheckoutService } from './checkout.service';

@ApiTags('checkout')
@Controller({ version: '1' })
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  /**
   * Unauthenticated and pays real money — rate-limited hard, same posture as
   * the leads and custom-request endpoints.
   */
  @Post('checkout/ready-print')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  @UsePipes(new ZodValidationPipe(ReadyPrintCheckoutRequestDto))
  createReadyPrintCheckout(@Body() dto: ReadyPrintCheckoutRequestDto) {
    return this.checkout.createReadyPrintCheckout(dto);
  }

  /** Backs the "thank you" page the customer lands on after paying (or not). */
  @Get('orders/:id/status')
  getOrderStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.checkout.getPublicOrderStatus(id);
  }
}
