import type { z } from 'zod';

import { metricQueryRequestSchema } from '../schemas/query-request.schema';
import { validateWithSchema } from './schema.validator';

export function validateQueryRequest(input: unknown): z.infer<typeof metricQueryRequestSchema> {
  return validateWithSchema(metricQueryRequestSchema, input, 'request');
}
