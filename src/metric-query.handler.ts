import type { Context } from 'aws-lambda';

import type { MetricQueryResponse } from './types/metric-query-response.type';
import type { MetricQueryErrorResponse } from './types/metric-query-error-response.type';
import { validateQueryRequest } from './validators/query-request.validator';
import { ValidationError } from './errors/validation.error';
import { metricRepository } from './infrastructure/metric.repository';
import { formatErrorMessage } from './errors/format-error-message.util';
import { logger } from './logging/logger';

export const main = async (
  request: unknown,
  context?: Pick<Context, 'awsRequestId'>,
): Promise<MetricQueryResponse | MetricQueryErrorResponse> => {
  const log = logger.child({ requestId: context?.awsRequestId ?? 'local' });

  let validated: ReturnType<typeof validateQueryRequest> | undefined;

  try {
    validated = validateQueryRequest(request);

    const count = await metricRepository.queryMetricCount(validated);

    log.info({ metricId: validated.metricId, count }, 'query completed');

    return { ...validated, count };
  } catch (error) {
    if (error instanceof ValidationError) {
      log.warn({ error: error.message }, 'validation failed');

      const requestId = context?.awsRequestId ?? 'local';

      return { error: { code: 'VALIDATION_ERROR', message: error.message, requestId } };
    }

    log.error(
      {
        error: formatErrorMessage(error),
        metricId: validated?.metricId,
        workspaceId: validated?.workspaceId,
        fromDate: validated?.fromDate,
        toDate: validated?.toDate,
      },
      'query failed',
    );
    throw error;
  }
};
