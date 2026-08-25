import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../common/prisma.service';
import { ContentAdminController } from './content-admin.controller';
import { ContentAdminService } from './content-admin.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { RevalidateService } from './revalidate.service';

@Module({
  imports: [AuthModule],
  controllers: [ContentController, ContentAdminController, MediaController],
  providers: [ContentService, ContentAdminService, MediaService, RevalidateService, PrismaService],
  exports: [ContentService],
})
export class ContentModule {}
