import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { LeadsService } from './leads.service';

const LeadDto = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().regex(/^\+?\d{10,15}$/, 'Телефон у форматі +380XXXXXXXXX'),
  message: z.string().max(1000).optional(),
  source: z.string().max(120).optional(),
  /// Окрема галочка. Заявка — це згода на відповідь щодо неї, не на розсилку.
  marketingConsent: z.boolean().optional(),
});

@Controller({ path: 'leads', version: '1' })
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
  async create(
    @Body() body: unknown,
    @Req() req: Request & { correlationId?: string },
  ): Promise<{ ok: true; number: number }> {
    const dto = LeadDto.parse(body);
    const lead = await this.leads.capture(dto, req.correlationId ?? 'unknown');
    return { ok: true, number: lead.number };
  }
}
