import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { formatLead, type Lead, sendToTelegram } from './telegram';

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
}
