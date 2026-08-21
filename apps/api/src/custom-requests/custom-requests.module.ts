import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CustomRequestsController } from './custom-requests.controller';
import { CustomRequestsService } from './custom-requests.service';

@Module({
  controllers: [CustomRequestsController],
  providers: [CustomRequestsService, PrismaService],
})
export class CustomRequestsModule {}
