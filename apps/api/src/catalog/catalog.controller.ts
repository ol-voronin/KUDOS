import { Controller, Get, Param, Query, UsePipes } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CatalogQueryDto, type BreedListDto, type BreedPageDto, type CollectionListDto,
  type CollectionPageDto, type HomeDto, type PrintListDto, type PrintOfferDto,
  type RangeDto, type SearchResultDto, type SitemapDto,
} from '@dt/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';

/**
 * Thin by design: parse, delegate, return. No business logic lives here.
 */
@ApiTags('catalog')
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * Уся головна одним запитом. Порядок і склад блоків — рішення сервера:
   * коли фронт збирає головну з пʼяти ендпоінтів, «що показувати першим»
   * непомітно переїжджає в React-компонент.
   */
  @Get('home')
  getHome(): Promise<HomeDto> {
    return this.catalog.getHome();
  }

  /**
   * Асортимент: що ми шиємо, з чого, в яких кольорах і розмірах.
   *
   * Окремий ендпоінт, а не поле в /home: цю сторінку відкривають до вибору
   * принта («покажіть спершу, що у вас узагалі є») і після нього («а ця
   * футболка мені підійде?»). Обидва входи мають працювати без принта.
   */
  @Get('range')
  getRange(): Promise<RangeDto> {
    return this.catalog.getRange();
  }

  /** Усі породи, включно з порожніми — сторінка без принтів усе одно працює. */
  @Get('breeds')
  listBreeds(): Promise<BreedListDto> {
    return this.catalog.listBreeds();
  }

  @Get('collections')
  listCollections(): Promise<CollectionListDto> {
    return this.catalog.listCollections();
  }

  /** Пошук: породи, колекції й принти окремо — це різні наміри. */
  @Get('search')
  search(@Query('q') q?: string): Promise<SearchResultDto> {
    return this.catalog.search(q ?? '');
  }

  /** Плоскі списки slug-ів для sitemap.xml. */
  @Get('sitemap')
  getSitemap(): Promise<SitemapDto> {
    return this.catalog.getSitemap();
  }

  @Get('prints')
  @UsePipes(new ZodValidationPipe(CatalogQueryDto))
  listPrints(@Query() query: CatalogQueryDto): Promise<PrintListDto> {
    return this.catalog.listPrints(query);
  }

  @Get('prints/:slug')
  @ApiOkResponse({ description: 'One print with every variant it is offered on' })
  getPrint(@Param('slug') slug: string): Promise<PrintOfferDto> {
    return this.catalog.getPrintOffer(slug);
  }

  /** The long-tail SEO entry point: every print carrying this breed. */
  @Get('breeds/:slug')
  getBreed(@Param('slug') slug: string): Promise<BreedPageDto> {
    return this.catalog.getBreedPage(slug);
  }

  @Get('collections/:slug')
  getCollection(@Param('slug') slug: string): Promise<CollectionPageDto> {
    return this.catalog.getCollectionPage(slug);
  }
}
