import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { ErrorCode } from '@dt/contracts';

/**
 * One validation mechanism for the whole API: the same zod schema the frontend
 * imports from @dt/contracts. Two parallel definitions of a request body drift
 * within a sprint; this makes drift impossible.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.') || '_root';
          (details[path] ??= []).push(issue.message);
        }
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Перевірте заповнені поля',
          details,
        });
      }
      throw error;
    }
  }
}
