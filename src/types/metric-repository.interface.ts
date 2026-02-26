import type { MetricQueryRequest } from './metric-query-request.type';
import type { MetricUpdateMessage } from './metric-update-message.type';

export interface MetricRepository {
  /** @returns `true` if the message was already processed (deduplicated), `false` if it was a new write. */
  incrementMetric(message: MetricUpdateMessage, messageId: string): Promise<boolean>;
  queryMetricCount(query: MetricQueryRequest): Promise<number>;
}
