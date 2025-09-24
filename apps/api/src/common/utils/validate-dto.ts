import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export function validateDto<T>(cls: new () => T, payload: unknown): T {
  const instance = plainToInstance(cls, payload ?? {});
  const errors = validateSync(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false }
  });

  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }

  return instance;
}
