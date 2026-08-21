import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { CustomRequestCreateDto } from '@dt/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CustomRequestsService } from './custom-requests.service';

@ApiTags('custom-requests')
@Controller({ path: 'custom-requests', version: '1' })
export class CustomRequestsController {
  constructor(private readonly service: CustomRequestsService) {}

  /**
   * The brief. Rate-limited hard: this endpoint is unauthenticated, accepts
   * free text and creates work for two people.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @UsePipes(new ZodValidationPipe(CustomRequestCreateDto))
  create(@Body() dto: CustomRequestCreateDto) {
    return this.service.create(dto);
  }
}
