import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminLeadDetailDto, AdminLeadDto, AdminLeadExportQueryDto, AdminLeadListDto,
  AdminLeadListQueryDto, LeadStatus,
} from '@dt/contracts';
import { ErrorCode } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { sendToTelegram } from '../common/telegram';
import { rowsToCsv } from './csv';
import { formatLead, type Lead } from './telegram';

const ADMIN_LEAD_SELECT = {
  id: true, number: true, status: true, name: true, phone: true, message: true,
  source: true, telegramSentAt: true, telegramError: true, createdAt: true,
} satisfies Prisma.LeadSelect;

const CSV_HEADER = ['№', 'Статус', 'Ім\u2019я', 'Телефон', 'Повідомлення', 'Джерело', 'Telegram', 'Створено'];

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

  /** The admin's "Заявки" list — newest first, optionally filtered by status/phone. */
  async list(query: AdminLeadListQueryDto): Promise<AdminLeadListDto> {
    const where = this.buildWhere(query);

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

  private buildWhere(query: { status?: LeadStatus; phone?: string }): Prisma.LeadWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.phone ? { phone: { contains: query.phone } } : {}),
    };
  }

  /** Lead detail screen: the lead plus its customer's other leads (repeat clients). */
  async getDetail(id: string): Promise<AdminLeadDetailDto> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: {
        ...ADMIN_LEAD_SELECT,
        customer: {
          select: {
            id: true, name: true, phone: true, marketingConsent: true,
            _count: { select: { leads: true } },
          },
        },
      },
    });
    if (!lead) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Заявку не знайдено' });

    const { customer, ...rest } = lead;

    const previousLeads = customer
      ? await this.prisma.lead.findMany({
          where: { customerId: customer.id, id: { not: id } },
          select: ADMIN_LEAD_SELECT,
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];

    return {
      ...rest,
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            marketingConsent: customer.marketingConsent,
            totalLeads: customer._count.leads,
          }
        : null,
      previousLeads,
    };
  }

  /** Manual retry for a lead that didn't reach Telegram the first time. */
  async resendTelegram(id: string): Promise<AdminLeadDto> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true, number: true, name: true, phone: true, message: true, source: true },
    });
    if (!lead) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Заявку не знайдено' });

    try {
      await sendToTelegram(formatLead({
        name: lead.name,
        phone: lead.phone,
        ...(lead.message ? { message: lead.message } : {}),
        source: `№${lead.number} · ${lead.source ?? 'сайт'} · повтор`,
      }));
      return await this.prisma.lead.update({
        where: { id },
        data: { telegramSentAt: new Date(), telegramError: null },
        select: ADMIN_LEAD_SELECT,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.lead.update({ where: { id }, data: { telegramError: message.slice(0, 500) } });
      this.logger.error(`Повторне надсилання заявки №${lead.number} не долетіло: ${message}`);
      throw new BadGatewayException({ code: ErrorCode.TELEGRAM_DELIVERY_FAILED, message: 'Не вдалося надіслати в Telegram' });
    }
  }

  /** CSV for the current filter — capped, this is an export button, not a report engine. */
  async exportCsv(query: AdminLeadExportQueryDto): Promise<string> {
    const leads = await this.prisma.lead.findMany({
      where: this.buildWhere(query),
      select: ADMIN_LEAD_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const rows = leads.map((lead) => [
      String(lead.number),
      lead.status,
      lead.name,
      lead.phone,
      lead.message ?? '',
      lead.source ?? '',
      lead.telegramSentAt ? 'доставлено' : 'не долетіло',
      lead.createdAt.toISOString(),
    ]);

    return rowsToCsv([CSV_HEADER, ...rows]);
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
