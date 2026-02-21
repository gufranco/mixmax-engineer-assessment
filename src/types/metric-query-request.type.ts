import type { z } from 'zod';

import type { metricQueryRequestSchema } from '../schemas/query-request.schema';

export type MetricQueryRequest = z.infer<typeof metricQueryRequestSchema>;
