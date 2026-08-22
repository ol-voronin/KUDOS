import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res,
  UseGuards, UsePipes,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AdminLeadDetailDto, AdminLeadDto, AdminLeadExportQueryDto, AdminLeadListDto,
  AdminLeadListQueryDto, AdminLeadStatusUpdateDto,
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

  @Get('export/csv')
  @UsePipes(new ZodValidationPipe(AdminLeadExportQueryDto))
  async exportCsv(
    @Query() query: AdminLeadExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.leads.exportCsv(query);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="leads.csv"');
    return csv;
  }

  @Get(':id')
  getDetail(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminLeadDetailDto> {
    return this.leads.getDetail(id);
  }

  @Post(':id/resend-telegram')
  @HttpCode(HttpStatus.OK)
  resendTelegram(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminLeadDto> {
    return this.leads.resendTelegram(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminLeadStatusUpdateDto)) dto: AdminLeadStatusUpdateDto,
  ): Promise<AdminLeadDto> {
    return this.leads.updateStatus(id, dto.status);
  }
}

