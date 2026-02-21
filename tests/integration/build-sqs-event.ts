import type { SQSEvent } from 'aws-lambda';

export function buildSQSEvent(records: { messageId: string; body: string }[]): SQSEvent {
  return {
    Records: records.map((r) => ({
      messageId: r.messageId,
      receiptHandle: `receipt-${r.messageId}`,
      body: r.body,
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1705305600000',
        SenderId: 'SENDER',
        ApproximateFirstReceiveTimestamp: '1705305600000',
      },
      messageAttributes: {},
      md5OfBody: 'abc',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:feature-usage-updates',
      awsRegion: 'us-east-1',
    })),
  };
}
