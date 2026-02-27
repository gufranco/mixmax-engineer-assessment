import { z } from 'zod';

export const metricQueryErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    retryable: z.boolean().optional(),
  }),
});

export type MetricQueryErrorResponse = z.infer<typeof metricQueryErrorResponseSchema>;
