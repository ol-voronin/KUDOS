import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post,
  Query, UseGuards, UsePipes,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AdminBreedCreateDto, AdminPrintCreateDto, AdminPrintDto, AdminPrintImageCreateDto,
  AdminPrintImageReorderDto, AdminPrintListDto, AdminPrintListQueryDto, AdminPrintUpdateDto,
  type CatalogOptionDto,
} from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrintsAdminService } from './prints-admin.service';

/** Усе під цим контролером вимагає сесії — див. `JwtAuthGuard`. */
@ApiTags('admin')
@Controller({ path: 'admin/prints', version: '1' })
@UseGuards(JwtAuthGuard)
export class PrintsAdminController {
  constructor(private readonly prints: PrintsAdminService) {}

  @Get()
  @UsePipes(new ZodValidationPipe(AdminPrintListQueryDto))
  list(@Query() query: AdminPrintListQueryDto): Promise<AdminPrintListDto> {
    return this.prints.list(query);
  }

  /** Породи й колекції для селектів у формі. Окремо, щоб форма робила один запит. */
  @Get('options')
  options(): Promise<{ breeds: CatalogOptionDto[]; collections: CatalogOptionDto[] }> {
    return this.prints.options();
  }

  @Post('breeds')
  @HttpCode(HttpStatus.CREATED)
  createBreed(
    @Body(new ZodValidationPipe(AdminBreedCreateDto)) dto: AdminBreedCreateDto,
  ): Promise<CatalogOptionDto> {
    return this.prints.createBreed(dto);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminPrintDto> {
    return this.prints.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(AdminPrintCreateDto)) dto: AdminPrintCreateDto): Promise<AdminPrintDto> {
    return this.prints.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminPrintUpdateDto)) dto: AdminPrintUpdateDto,
  ): Promise<AdminPrintDto> {
    return this.prints.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<{ ok: true }> {
    return this.prints.remove(id);
  }

  /**
   * Реєстрація фото, яке вже лежить у сховищі.
   *
   * Заливає вебзастосунок: тільки в нього є `BLOB_READ_WRITE_TOKEN`. API про
   * сховище не знає нічого — він власник даних, не файлів.
   */
  @Post(':id/images')
  @HttpCode(HttpStatus.CREATED)
  addImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminPrintImageCreateDto)) dto: AdminPrintImageCreateDto,
  ): Promise<AdminPrintDto> {
    return this.prints.addImage(id, dto);
  }

  @Patch(':id/images/order')
  reorderImages(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminPrintImageReorderDto)) dto: AdminPrintImageReorderDto,
  ): Promise<AdminPrintDto> {
    return this.prints.reorderImages(id, dto);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('imageId', new ParseUUIDPipe()) imageId: string,
  ): Promise<AdminPrintDto> {
    return this.prints.removeImage(id, imageId);
  }
}
