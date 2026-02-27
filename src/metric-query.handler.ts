import type { Context } from 'aws-lambda';

import type { MetricQueryResponse } from './schemas/query-response.schema';
import type { MetricQueryErrorResponse } from './schemas/query-error-response.schema';
import { validateQueryRequest } from './validators/query-request.validator';
import { ValidationError } from './errors/validation.error';
import { isTransientError } from './infrastructure/error-classifier.util';
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
    const requestId = context?.awsRequestId ?? 'local';

    if (error instanceof ValidationError) {
      log.warn({ error: error.message }, 'validation failed');

      return { error: { code: 'VALIDATION_ERROR', message: error.message, requestId } };
    }

    const retryable = isTransientError(error);

    log.error(
      {
        error: formatErrorMessage(error),
        retryable,
        metricId: validated?.metricId,
        workspaceId: validated?.workspaceId,
        fromDate: validated?.fromDate,
        toDate: validated?.toDate,
      },
      'query failed',
    );

    return {
      error: {
        code: retryable ? 'TRANSIENT_ERROR' : 'INTERNAL_ERROR',
        message: 'query failed',
        requestId,
        retryable,
      },
    };
  }
};
