import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentCancelRequestDto, PaymentFinalizeRequestDto } from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaymentsAdminService } from './payments-admin.service';

/** Everything under here requires a session — see `JwtAuthGuard`. */
@ApiTags('admin')
@Controller({ path: 'admin/payments', version: '1' })
@UseGuards(JwtAuthGuard)
export class PaymentsAdminController {
  constructor(private readonly paymentsAdmin: PaymentsAdminService) {}

  @Post(':invoiceId/finalize')
  @HttpCode(HttpStatus.OK)
  finalize(
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(PaymentFinalizeRequestDto)) dto: PaymentFinalizeRequestDto,
  ) {
    return this.paymentsAdmin.finalize(invoiceId, dto.amountMinor);
  }

  @Post(':invoiceId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(PaymentCancelRequestDto)) dto: PaymentCancelRequestDto,
  ) {
    return this.paymentsAdmin.cancel(invoiceId, dto.amountMinor);
  }
}
