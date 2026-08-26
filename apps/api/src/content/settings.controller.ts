import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  MenuItemCreateDto, MenuItemUpdateDto, SiteSettingsUpdateDto, type SiteChromeDto,
} from '@dt/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SettingsService } from './settings.service';

/** Публічне: те, що потрібно оболонці сайту. Один запит на шапку й футер. */
@ApiTags('content')
@Controller({ path: 'content', version: '1' })
export class SiteChromeController {
  constructor(private readonly settings: SettingsService) {}

  @Get('site')
  chrome(): Promise<SiteChromeDto> {
    return this.settings.chrome();
  }
}

@ApiTags('admin')
@Controller({ path: 'admin/settings', version: '1' })
@UseGuards(JwtAuthGuard)
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<SiteChromeDto> {
    return this.settings.adminChrome();
  }

  @Patch()
  update(
    @Body(new ZodValidationPipe(SiteSettingsUpdateDto)) dto: SiteSettingsUpdateDto,
  ): Promise<SiteChromeDto> {
    return this.settings.update(dto);
  }

  @Post('menu')
  createMenuItem(
    @Body(new ZodValidationPipe(MenuItemCreateDto)) dto: MenuItemCreateDto,
  ): Promise<SiteChromeDto> {
    return this.settings.createMenuItem(dto);
  }

  @Patch('menu/:id')
  updateMenuItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(MenuItemUpdateDto)) dto: MenuItemUpdateDto,
  ): Promise<SiteChromeDto> {
    return this.settings.updateMenuItem(id, dto);
  }

  @Delete('menu/:id')
  deleteMenuItem(@Param('id', new ParseUUIDPipe()) id: string): Promise<SiteChromeDto> {
    return this.settings.deleteMenuItem(id);
  }
}
