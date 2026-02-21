import type { z } from 'zod';

import type { metricUpdateMessageSchema } from '../schemas/update-message.schema';

export type MetricUpdateMessage = z.infer<typeof metricUpdateMessageSchema>;
