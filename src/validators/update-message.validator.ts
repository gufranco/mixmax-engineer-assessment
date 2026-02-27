import {
  metricUpdateMessageSchema,
  type MetricUpdateMessage,
} from '../schemas/update-message.schema';
import { validateWithSchema } from './schema.validator';
import { ValidationError } from '../errors/validation.error';

const MAX_SUPPORTED_VERSION = 1;

export function validateUpdateMessage(input: unknown): MetricUpdateMessage {
  // Check version before full validation so unsupported versions get a clear
  // rejection instead of confusing field-level errors from a v1 schema.
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const version = (input as Record<string, unknown>)['schemaVersion'];

    if (typeof version === 'number' && version > MAX_SUPPORTED_VERSION) {
      throw new ValidationError(`unsupported schema version: ${version}`);
    }
  }

  return validateWithSchema(metricUpdateMessageSchema, input, 'message body');
}
