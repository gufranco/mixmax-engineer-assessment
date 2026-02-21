import type { MetricQueryRequest } from './metric-query-request.type';

export interface MetricQueryResponse extends MetricQueryRequest {
  count: number;
}
