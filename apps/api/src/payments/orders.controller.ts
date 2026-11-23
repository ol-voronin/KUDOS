import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { CartQuoteRequestDto, OrderDraftRequestDto } from '@dt/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CartPricingService, toCartQuote } from './cart-pricing.service';
import { MonobankService } from './monobank.service';
import { OrdersService } from './orders.service';

@ApiTags('checkout')
@Controller({ version: '1' })
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly cart: CartPricingService,
    private readonly monobank: MonobankService,
  ) {}

  /**
   * Скільки коштує кошик.
   *
   * POST, а не GET, хоч нічого й не змінює: кошик на двадцять позицій не
   * влазить в адресний рядок як параметр, а розбивати його на запити по
   * одному означало б рахувати знижки не над кошиком, а над рядками
   * поодинці — і показати не ту суму.
   *
   * Ліміт вищий за касовий: сторінку кошика перераховують на кожну зміну
   * кількості, і це нормальна поведінка, а не зловживання.
   */
  @Post('cart/quote')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @UsePipes(new ZodValidationPipe(CartQuoteRequestDto))
  async quote(@Body() dto: CartQuoteRequestDto) {
    // `payOnline` — лише для чесного тексту біля кнопки «Замовити».
    return { ...toCartQuote(await this.cart.price(dto.items)), payOnline: this.monobank.payAtCheckout() };
  }

  /**
   * Оформлення. Коли Monobank підключений — одразу HOLD-рахунок і
   * `paymentPageUrl` у відповіді; інакше рахунок виставляє людина з адмінки.
   *
   * Неавтентифікований ендпоінт, який створює запис із персональними
   * даними, тож ліміт жорсткий — той самий, що на заявках.
   */
  @Post('checkout/order')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 3_600_000, limit: 10 } })
  @UsePipes(new ZodValidationPipe(OrderDraftRequestDto))
  createOrder(@Body() dto: OrderDraftRequestDto, @Req() req: Request) {
    return this.orders.createDraft(dto, clientOf(req));
  }

  /** Сторінка «дякуємо»: номер, стан і сума. Ні контактів, ні позицій. */
  @Get('orders/:id/status')
  getStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getPublicStatus(id);
  }
}

/**
 * IP і User-Agent покупця — для Conversions API Meta, і лише для нього.
 *
 * На Vercel справжня адреса — перша в `x-forwarded-for`: далі в ланцюжку
 * стоять проксі платформи. Браузер ходить в API напряму, тож це адреса
 * покупця, а не нашого фронту.
 */
function clientOf(req: Request): { ip: string; ua: string } {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ?? '';
  return {
    ip: (first !== '' ? first : req.ip ?? '').slice(0, 64),
    ua: String(req.headers['user-agent'] ?? '').slice(0, 500),
  };
}
