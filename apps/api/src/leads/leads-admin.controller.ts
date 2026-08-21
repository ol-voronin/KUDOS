import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards, UsePipes,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AdminLeadDto, AdminLeadListDto, AdminLeadListQueryDto, AdminLeadStatusUpdateDto,
} from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LeadsService } from './leads.service';

/** Everything under here requires a session — see `JwtAuthGuard`. */
@ApiTags('admin')
@Controller({ path: 'admin/leads', version: '1' })
@UseGuards(JwtAuthGuard)
export class LeadsAdminController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  @UsePipes(new ZodValidationPipe(AdminLeadListQueryDto))
  list(@Query() query: AdminLeadListQueryDto): Promise<AdminLeadListDto> {
    return this.leads.list(query);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminLeadStatusUpdateDto)) dto: AdminLeadStatusUpdateDto,
  ): Promise<AdminLeadDto> {
    return this.leads.updateStatus(id, dto.status);
  }
}
