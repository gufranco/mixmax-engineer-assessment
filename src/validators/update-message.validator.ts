import {
  metricUpdateMessageSchema,
  type MetricUpdateMessage,
} from '../schemas/update-message.schema';
import { validateWithSchema } from './schema.validator';

export function validateUpdateMessage(input: unknown): MetricUpdateMessage {
  return validateWithSchema(metricUpdateMessageSchema, input, 'message body');
}
