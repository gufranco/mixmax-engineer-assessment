import type {
  Context,
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';
import { validateUpdateMessage } from './validators/update-message.validator';
import { ValidationError } from './errors/validation.error';
import { metricRepository } from './infrastructure/metric.repository';
import { isPermanentError, isTransientError } from './infrastructure/error-classifier.util';
import { formatErrorMessage } from './errors/format-error-message.util';
import { logger } from './logging/logger';

function parseRecordBody(record: SQSRecord): unknown {
  try {
    return JSON.parse(record.body);
  } catch {
    throw new ValidationError(`malformed JSON in message ${record.messageId}: ${record.body}`);
  }
}

export const main = async (
  event: SQSEvent,
  context?: Pick<Context, 'awsRequestId'>,
): Promise<SQSBatchResponse> => {
  const log = logger.child({ requestId: context?.awsRequestId ?? 'local' });
  const batchItemFailures: SQSBatchItemFailure[] = [];

  await Promise.allSettled(
    event.Records.map(async (record) => {
      try {
        const parsed = parseRecordBody(record);
        const message = validateUpdateMessage(parsed);

        const deduplicated = await metricRepository.incrementMetric(message, record.messageId);

        if (deduplicated) {
          log.debug(
            { messageId: record.messageId, workspaceId: message.workspaceId },
            'duplicate message skipped',
          );
        } else {
          log.info(
            { messageId: record.messageId, workspaceId: message.workspaceId },
            'record processed',
          );
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          log.warn(
            { messageId: record.messageId, error: error.message, permanent: true },
            'record rejected: invalid input',
          );

          return;
        }

        if (isTransientError(error)) {
          log.warn(
            { messageId: record.messageId, error: formatErrorMessage(error), transient: true },
            'record failed: transient error, will retry',
          );
          batchItemFailures.push({ itemIdentifier: record.messageId });

          return;
        }

        if (isPermanentError(error)) {
          log.error(
            { messageId: record.messageId, error: formatErrorMessage(error), permanent: true },
            'record failed: permanent error',
          );

          return;
        }

        log.warn(
          { messageId: record.messageId, error: formatErrorMessage(error), transient: true },
          'record failed: unclassified error, treating as transient',
        );
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }),
  );

  if (batchItemFailures.length > 0) {
    log.warn(
      { total: event.Records.length, failed: batchItemFailures.length },
      'batch partially failed',
    );
  }

  return { batchItemFailures };
};
