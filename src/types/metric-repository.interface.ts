import type { MetricQueryRequest } from './metric-query-request.type';
import type { MetricUpdateMessage } from './metric-update-message.type';

export interface MetricRepository {
  incrementMetric(message: MetricUpdateMessage): Promise<void>;
  queryMetricCount(query: MetricQueryRequest): Promise<number>;
}
