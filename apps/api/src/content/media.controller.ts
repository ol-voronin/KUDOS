import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe,
  Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  MediaCreateDto, MediaUpdateDto, type MediaAssetDto, type MediaListDto,
} from '@dt/contracts';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MediaService } from './media.service';

@ApiTags('admin')
@Controller({ path: 'admin/media', version: '1' })
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(@Query('page') page?: string, @Query('perPage') perPage?: string): Promise<MediaListDto> {
    const p = Math.max(1, Number(page) || 1);
    const pp = Math.min(120, Math.max(1, Number(perPage) || 60));
    return this.media.list(p, pp);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(MediaCreateDto)) dto: MediaCreateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<MediaAssetDto> {
    return this.media.create(dto, req.admin.sub);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(MediaUpdateDto)) dto: MediaUpdateDto,
  ): Promise<MediaAssetDto> {
    return this.media.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<{ pathname: string }> {
    return this.media.remove(id);
  }
}
