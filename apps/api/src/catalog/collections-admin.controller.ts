import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  AdminCollectionAddPrintDto, AdminCollectionCreateDto, AdminCollectionReorderDto,
  AdminCollectionUpdateDto, type AdminCollectionDto, type AdminCollectionListDto,
} from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CollectionsAdminService } from './collections-admin.service';

/** Усе під цим контролером вимагає сесії — див. `JwtAuthGuard`. */
@ApiTags('admin')
@Controller({ path: 'admin/collections', version: '1' })
@UseGuards(JwtAuthGuard)
export class CollectionsAdminController {
  constructor(private readonly collections: CollectionsAdminService) {}

  @Get()
  list(): Promise<AdminCollectionListDto> {
    return this.collections.list();
  }

  /**
   * Перед `:id`: інакше Nest спробує розібрати «reorder» як UUID.
   * Повертає весь список — після перестановки таблиця перемальовується цілком.
   */
  @Patch('reorder')
  reorder(
    @Body(new ZodValidationPipe(AdminCollectionReorderDto)) dto: AdminCollectionReorderDto,
  ): Promise<AdminCollectionListDto> {
    return this.collections.reorder(dto);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<AdminCollectionDto> {
    return this.collections.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(AdminCollectionCreateDto)) dto: AdminCollectionCreateDto,
  ): Promise<AdminCollectionDto> {
    return this.collections.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminCollectionUpdateDto)) dto: AdminCollectionUpdateDto,
  ): Promise<AdminCollectionDto> {
    return this.collections.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<{ ok: true }> {
    return this.collections.remove(id);
  }

  @Post(':id/prints')
  @HttpCode(HttpStatus.CREATED)
  addPrint(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AdminCollectionAddPrintDto)) dto: AdminCollectionAddPrintDto,
  ): Promise<AdminCollectionDto> {
    return this.collections.addPrint(id, dto.printId);
  }

  @Delete(':id/prints/:printId')
  removePrint(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('printId', new ParseUUIDPipe()) printId: string,
  ): Promise<AdminCollectionDto> {
    return this.collections.removePrint(id, printId);
  }
}
