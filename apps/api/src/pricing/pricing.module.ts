import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { PriceBookService } from './price-book.service';
import { PriceRulesAdminController } from './price-rules-admin.controller';
import { PriceRulesAdminService } from './price-rules-admin.service';

/**
 * Правила ціни як спільна залежність.
 *
 * Окремий модуль існує рівно для того, щоб каталог і каса не мали кожен свою
 * копію читання правил. Ціна — це те місце, де дві реалізації однієї логіки
 * коштують грошей буквально.
 */
@Module({
  imports: [AuthModule],
  controllers: [PriceRulesAdminController],
  providers: [PriceBookService, PriceRulesAdminService, PrismaService],
  exports: [PriceBookService],
})
export class PricingModule {}
