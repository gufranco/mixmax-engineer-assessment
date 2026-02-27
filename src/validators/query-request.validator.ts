import { metricQueryRequestSchema, type MetricQueryRequest } from '../schemas/query-request.schema';
import { validateWithSchema } from './schema.validator';

export function validateQueryRequest(input: unknown): MetricQueryRequest {
  return validateWithSchema(metricQueryRequestSchema, input, 'request');
}
