import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PageKind, type PageDto, type PageListDto, type RedirectDto } from '@dt/contracts';
import { ContentService } from './content.service';

/**
 * Публічне читання вмісту. Завжди опублікована версія, ніколи чернетка:
 * ендпоінта, який віддає чернетку без сесії, тут не буде взагалі — інакше
 * достатньо вгадати адресу, щоб прочитати те, що ще не готове.
 */
@ApiTags('content')
@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('pages')
  list(@Query('kind') kind?: string): Promise<PageListDto> {
    const parsed = PageKind.safeParse(kind);
    return this.content.listPages(parsed.success ? parsed.data : undefined);
  }

  /** Питається лише тоді, коли сторінки за адресою немає. */
  @Get('redirects/:slug')
  redirect(@Param('slug') slug: string): Promise<RedirectDto> {
    return this.content.resolveRedirect(slug);
  }

  @Get('pages/:slug')
  @ApiOkResponse({ description: 'Опублікована версія сторінки з блоками' })
  get(@Param('slug') slug: string): Promise<PageDto> {
    return this.content.getPage(slug);
  }
}
