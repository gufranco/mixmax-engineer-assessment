import { randomUUID } from 'node:crypto';

import type { SQSEvent, SQSRecord } from 'aws-lambda';

export function buildSqsEvent(...bodies: string[]): SQSEvent {
  const records: SQSRecord[] = bodies.map((body) => ({
    messageId: randomUUID(),
    receiptHandle: randomUUID(),
    body,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: String(Date.now()),
      SenderId: 'test',
      ApproximateFirstReceiveTimestamp: String(Date.now()),
    },
    messageAttributes: {},
    md5OfBody: '',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:feature-usage-updates-local',
    awsRegion: 'us-east-1',
  }));

  return { Records: records };
}
