import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOrderStatusUpdateDto, OrderStatus } from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrdersAdminService } from './orders-admin.service';

/** Усе під сесією — див. `JwtAuthGuard`. */
@ApiTags('admin')
@Controller({ path: 'admin/orders', version: '1' })
@UseGuards(JwtAuthGuard)
export class OrdersAdminController {
  constructor(private readonly orders: OrdersAdminService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const parsed = OrderStatus.safeParse(status);
    return this.orders.list({
      ...(parsed.success ? { status: parsed.data } : {}),
      page: Math.max(1, Number(page ?? 1) || 1),
      perPage: Math.min(100, Math.max(1, Number(perPage ?? 25) || 25)),
    });
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdminOrderStatusUpdateDto)) dto: AdminOrderStatusUpdateDto,
  ) {
    return this.orders.updateStatus(id, dto.status);
  }

  /** Створює рахунок Monobank на суму замовлення й повертає посилання. */
  @Post(':id/invoice')
  @HttpCode(HttpStatus.CREATED)
  createInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.createInvoice(id);
  }
}
