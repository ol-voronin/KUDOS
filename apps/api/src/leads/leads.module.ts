import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { LeadsAdminController } from './leads-admin.controller';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AuthModule],
  controllers: [LeadsController, LeadsAdminController],
  providers: [LeadsService, PrismaService],
})
export class LeadsModule {}
