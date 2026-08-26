import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type AdminPriceRulesDto, DiscountCreateDto, DiscountUpdateDto,
  type PriceBreakdownDto, PriceModifierCreateDto, PriceModifierUpdateDto, PriceQuoteRequestDto,
} from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PriceRulesAdminService } from './price-rules-admin.service';

@ApiTags('admin')
@Controller({ path: 'admin/price-rules', version: '1' })
@UseGuards(JwtAuthGuard)
export class PriceRulesAdminController {
  constructor(private readonly rules: PriceRulesAdminService) {}

  @Get()
  list(): Promise<AdminPriceRulesDto> {
    return this.rules.list();
  }

  @Post('modifiers')
  createModifier(
    @Body(new ZodValidationPipe(PriceModifierCreateDto)) dto: PriceModifierCreateDto,
  ): Promise<AdminPriceRulesDto> {
    return this.rules.createModifier(dto);
  }

  @Patch('modifiers/:id')
  updateModifier(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(PriceModifierUpdateDto)) dto: PriceModifierUpdateDto,
  ): Promise<AdminPriceRulesDto> {
    return this.rules.updateModifier(id, dto);
  }

  @Delete('modifiers/:id')
  deleteModifier(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminPriceRulesDto> {
    return this.rules.deleteModifier(id);
  }

  @Post('discounts')
  createDiscount(
    @Body(new ZodValidationPipe(DiscountCreateDto)) dto: DiscountCreateDto,
  ): Promise<AdminPriceRulesDto> {
    return this.rules.createDiscount(dto);
  }

  @Patch('discounts/:id')
  updateDiscount(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(DiscountUpdateDto)) dto: DiscountUpdateDto,
  ): Promise<AdminPriceRulesDto> {
    return this.rules.updateDiscount(id, dto);
  }

  @Delete('discounts/:id')
  deleteDiscount(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminPriceRulesDto> {
    return this.rules.deleteDiscount(id);
  }

  /**
   * Калькулятор. POST, хоч нічого й не змінює: вхід — обʼєкт із шести полів,
   * і тягнути його через рядок запиту означало б кодувати той самий обʼєкт
   * руками з обох боків.
   */
  @Post('quote')
  quote(
    @Body(new ZodValidationPipe(PriceQuoteRequestDto)) dto: PriceQuoteRequestDto,
  ): Promise<PriceBreakdownDto> {
    return this.rules.quote(dto);
  }
}
