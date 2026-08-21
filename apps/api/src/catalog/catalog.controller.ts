import { Controller, Get, Param, Query, UsePipes } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CatalogQueryDto, type PrintOfferDto } from '@dt/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';

/**
 * Thin by design: parse, delegate, return. No business logic lives here.
 */
@ApiTags('catalog')
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('prints')
  @UsePipes(new ZodValidationPipe(CatalogQueryDto))
  listPrints(@Query() query: CatalogQueryDto) {
    return this.catalog.listPrints(query);
  }

  @Get('prints/:slug')
  @ApiOkResponse({ description: 'One print with every variant it is offered on' })
  getPrint(@Param('slug') slug: string): Promise<PrintOfferDto> {
    return this.catalog.getPrintOffer(slug);
  }

  /** The long-tail SEO entry point: every print carrying this breed. */
  @Get('breeds/:slug')
  getBreed(@Param('slug') slug: string) {
    return this.catalog.getBreedPage(slug);
  }

  @Get('collections/:slug')
  getCollection(@Param('slug') slug: string) {
    return this.catalog.getCollectionPage(slug);
  }
}
