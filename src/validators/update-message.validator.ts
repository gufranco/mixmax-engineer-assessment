import type { z } from 'zod';

import { metricUpdateMessageSchema } from '../schemas/update-message.schema';
import { validateWithSchema } from './schema.validator';

export function validateUpdateMessage(input: unknown): z.infer<typeof metricUpdateMessageSchema> {
  return validateWithSchema(metricUpdateMessageSchema, input, 'message body');
}
