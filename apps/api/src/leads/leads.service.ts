import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminLeadListDto, AdminLeadListQueryDto, LeadStatus } from '@dt/contracts';
import { ErrorCode } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { formatLead, type Lead, sendToTelegram } from './telegram';

const ADMIN_LEAD_SELECT = {
  id: true, number: true, status: true, name: true, phone: true, message: true,
  source: true, telegramSentAt: true, telegramError: true, createdAt: true,
} satisfies Prisma.LeadSelect;

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Порядок важливий: спершу база, потім Telegram.
   *
   * Якщо бот лежить — заявка все одно збережена, і клієнта не втрачено.
   * Якщо робити навпаки, падіння Telegram = падіння заявки.
   */
  async capture(
    input: Lead & { marketingConsent?: boolean },
    correlationId: string,
  ): Promise<{ id: string; number: number }> {
    const customer = await this.prisma.customer.upsert({
      where: { phone: input.phone },
      update: {
        name: input.name,
        ...(input.marketingConsent
          ? { marketingConsent: true, marketingConsentAt: new Date() }
          : {}),
      },
      create: {
        phone: input.phone,
        name: input.name,
        marketingConsent: input.marketingConsent ?? false,
        ...(input.marketingConsent ? { marketingConsentAt: new Date() } : {}),
      },
      select: { id: true },
    });

    const lead = await this.prisma.lead.create({
      data: {
        name: input.name,
        phone: input.phone,
        ...(input.message ? { message: input.message } : {}),
        ...(input.source ? { source: input.source } : {}),
        customerId: customer.id,
        correlationId,
      },
      select: { id: true, number: true },
    });

    try {
      await sendToTelegram(formatLead({ ...input, source: `№${lead.number} · ${input.source ?? 'сайт'}` }));
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { telegramSentAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { telegramError: message.slice(0, 500) },
      });
      // Заявка збережена — це не помилка для клієнта. Але видно в логах і в базі.
      this.logger.error(`Заявка №${lead.number} не долетіла в Telegram: ${message}`);
    }

    return lead;
  }

  /** The admin's "Заявки" list — newest first, optionally filtered by status. */
  async list(query: AdminLeadListQueryDto): Promise<AdminLeadListDto> {
    const where = query.status ? { status: query.status } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        select: ADMIN_LEAD_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { items, total, page: query.page, perPage: query.perPage };
  }

  async updateStatus(id: string, status: LeadStatus) {
    try {
      return await this.prisma.lead.update({
        where: { id },
        data: { status },
        select: ADMIN_LEAD_SELECT,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Заявку не знайдено' });
      }
      throw error;
    }
  }
}
