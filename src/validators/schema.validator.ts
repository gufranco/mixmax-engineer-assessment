import type { z } from 'zod';

import { ValidationError } from '../errors/validation.error';

function ensureObject(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ValidationError(`${label} must be a non-null object`);
  }

  return input as Record<string, unknown>;
}

export function validateWithSchema<T extends z.ZodType>(
  schema: T,
  input: unknown,
  label: string,
): z.infer<T> {
  const obj = ensureObject(input, label);
  const result = schema.safeParse(obj);

  if (!result.success) {
    const firstIssue = result.error.issues[0];

    throw new ValidationError(firstIssue?.message ?? 'Validation failed');
  }

  return result.data as z.infer<T>;
}
