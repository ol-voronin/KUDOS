import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AdminDraftSaveDto, AdminPageCreateDto, AdminPageTermsDto, AdminPageUpdateDto,
  type AdminPageDto, type AdminPageListDto, type AdminPreviewDto,
} from '@dt/contracts';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ContentAdminService } from './content-admin.service';

/**
 * Редагування вмісту. Усе під сесією — див. `JwtAuthGuard`.
 *
 * Автор кожної правки береться з токена, а не з тіла запиту: інакше «хто це
 * змінив» перетворюється на поле, яке можна надіслати яким завгодно, і
 * історія версій перестає бути доказом.
 */
@ApiTags('admin')
@Controller({ path: 'admin/content/pages', version: '1' })
@UseGuards(JwtAuthGuard)
export class ContentAdminController {
  constructor(private readonly content: ContentAdminService) {}

  @Get()
  list(): Promise<AdminPageListDto> {
    return this.content.list();
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminPageDto> {
    return this.content.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(AdminPageCreateDto)) dto: AdminPageCreateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminPageDto> {
    return this.content.create(dto, req.admin.sub);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminPageUpdateDto)) dto: AdminPageUpdateDto,
  ): Promise<AdminPageDto> {
    return this.content.update(id, dto);
  }

  @Patch(':id/terms')
  setTerms(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminPageTermsDto)) dto: AdminPageTermsDto,
  ): Promise<AdminPageDto> {
    return this.content.setTerms(id, dto);
  }

  @Patch(':id/draft')
  saveDraft(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminDraftSaveDto)) dto: AdminDraftSaveDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminPageDto> {
    return this.content.saveDraft(id, dto, req.admin.sub);
  }

  @Get(':id/preview')
  preview(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminPreviewDto> {
    return this.content.preview(id);
  }

  @Post(':id/publish')
  publish(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminPageDto> {
    return this.content.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminPageDto> {
    return this.content.unpublish(id);
  }

  @Post(':id/restore/:versionId')
  restore(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminPageDto> {
    return this.content.restore(id, versionId, req.admin.sub);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<{ ok: true }> {
    return this.content.remove(id);
  }
}
