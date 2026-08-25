import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AdminGarmentUpdateDto, AdminPrintPriceUpdateDto, type AdminPricingDto,
} from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PricingAdminService } from './pricing-admin.service';

@ApiTags('admin')
@Controller({ path: 'admin/pricing', version: '1' })
@UseGuards(JwtAuthGuard)
export class PricingAdminController {
  constructor(private readonly pricing: PricingAdminService) {}

  @Get()
  get(): Promise<AdminPricingDto> {
    return this.pricing.get();
  }

  @Patch('garments/:id')
  updateGarment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminGarmentUpdateDto)) dto: AdminGarmentUpdateDto,
  ): Promise<AdminPricingDto> {
    return this.pricing.updateGarment(id, dto);
  }

  @Patch('print-prices')
  updatePrintPrices(
    @Body(new ZodValidationPipe(AdminPrintPriceUpdateDto)) dto: AdminPrintPriceUpdateDto,
  ): Promise<AdminPricingDto> {
    return this.pricing.updatePrintPrices(dto);
  }
}
