import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PrintsAdminController } from './prints-admin.controller';
import { PrintsAdminService } from './prints-admin.service';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController, PrintsAdminController],
  providers: [CatalogService, PrintsAdminService, PrismaService],
  exports: [CatalogService],
})
export class CatalogModule {}
