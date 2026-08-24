import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CustomRequestCreateDto } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { sendToTelegram } from '../common/telegram';
import { formatBrief } from './format-brief';

@Injectable()
export class CustomRequestsService {
  private readonly logger = new Logger(CustomRequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts the customer by phone, then records the brief in one transaction.
   * The request arrives with no price: an unquoted brief has no total, and
   * inventing one before the work is scoped is how a 16-hour job gets sold for
   * the price of a two-hour one.
   */
  async create(dto: CustomRequestCreateDto): Promise<{ id: string; number: number }> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const customer = await tx.customer.upsert({
        where: { phone: dto.contact.phone },
        update: { name: dto.contact.name, ...(dto.contact.email ? { email: dto.contact.email } : {}) },
        create: {
          phone: dto.contact.phone,
          name: dto.contact.name,
          ...(dto.contact.email ? { email: dto.contact.email } : {}),
        },
        select: { id: true },
      });

      const request = await tx.customRequest.create({
        data: {
          customerId: customer.id,
          dogName: dto.dog.name,
          dogBreed: dto.dog.breed,
          photoKeys: dto.dog.photoKeys,
          mood: dto.brief.mood,
          references: dto.brief.referenceUrls,
          ...(dto.brief.notes ? { notes: dto.brief.notes } : {}),
          garmentType: dto.product.garmentType,
          ...(dto.product.preferredLine ? { preferredLine: dto.product.preferredLine } : {}),
          ...(dto.product.sizeLabel ? { sizeLabel: dto.product.sizeLabel } : {}),
          ...(dto.product.colourNote ? { colourNote: dto.product.colourNote } : {}),
          customerSuppliedArtwork: dto.customerSuppliedArtwork,
          ...(dto.deadline ? { deadline: dto.deadline } : {}),
        },
        select: { id: true, number: true },
      });

      // Log the identifiers, never the brief contents or contact details.
      this.logger.log(`custom_request.created id=${request.id} number=${request.number}`);
      return request;
    }).then(async (request) => {
      // Telegram — після транзакції і поза нею: бриф уже в базі, і якщо
      // повідомлення не долетить, заявка на 3000₴ не зникне разом із ним.
      await this.notify(dto, request.number);
      return request;
    });
  }

  private async notify(dto: CustomRequestCreateDto, number: number): Promise<void> {
    try {
      await sendToTelegram(formatBrief({
        number,
        customerName: dto.contact.name,
        customerPhone: dto.contact.phone,
        dogName: dto.dog.name,
        dogBreed: dto.dog.breed,
        garmentType: dto.product.garmentType,
        mood: dto.brief.mood,
        photoCount: dto.dog.photoKeys.length,
        customerSuppliedArtwork: dto.customerSuppliedArtwork,
        ...(dto.brief.notes ? { notes: dto.brief.notes } : {}),
        ...(dto.product.sizeLabel ? { sizeLabel: dto.product.sizeLabel } : {}),
        ...(dto.deadline ? { deadline: dto.deadline } : {}),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Бриф №${number} не долетів у Telegram: ${message}`);
    }
  }
}
