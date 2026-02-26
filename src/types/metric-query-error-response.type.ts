export interface MetricQueryErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
