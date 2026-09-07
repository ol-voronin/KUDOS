import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaService } from '../common/prisma.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CollectionsAdminController } from './collections-admin.controller';
import { CollectionsAdminService } from './collections-admin.service';
import { PricingAdminController } from './pricing-admin.controller';
import { PricingAdminService } from './pricing-admin.service';
import { PrintsAdminController } from './prints-admin.controller';
import { PrintsAdminService } from './prints-admin.service';

@Module({
  imports: [AuthModule, PricingModule],
  controllers: [CatalogController, PrintsAdminController, CollectionsAdminController, PricingAdminController],
  providers: [CatalogService, PrintsAdminService, CollectionsAdminService, PricingAdminService, PrismaService],
  exports: [CatalogService],
})
export class CatalogModule {}
