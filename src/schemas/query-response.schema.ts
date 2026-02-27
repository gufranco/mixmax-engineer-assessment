import { z } from 'zod';

import { metricQueryRequestBaseSchema } from './query-request.schema';

export const metricQueryResponseSchema = metricQueryRequestBaseSchema.extend({
  count: z.number().int().nonnegative(),
});

export type MetricQueryResponse = z.infer<typeof metricQueryResponseSchema>;
