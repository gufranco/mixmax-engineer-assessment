import type {
  Context,
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
  SQSRecord,
} from 'aws-lambda';
import { validateUpdateMessage } from './validators/update-message.validator';
import { metricRepository } from './infrastructure/metric.repository';
import { formatErrorMessage } from './errors/format-error-message.util';
import { logger } from './logging/logger';

function parseRecordBody(record: SQSRecord): unknown {
  try {
    return JSON.parse(record.body);
  } catch {
    throw new Error(`malformed JSON in message ${record.messageId}: ${record.body}`);
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

        await metricRepository.incrementMetric(message);
        log.info({ messageId: record.messageId }, 'record processed');
      } catch (error) {
        log.error(
          {
            messageId: record.messageId,
            error: formatErrorMessage(error),
          },
          'record failed',
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
