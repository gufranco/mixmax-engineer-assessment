import {
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  PurgeQueueCommand,
} from '@aws-sdk/client-sqs';
import type { SQSEvent, SQSRecord } from 'aws-lambda';

import { testSqsClient, QUEUE_URL } from './test-sqs-client';

export async function sendToSqs(body: string): Promise<string> {
  const result = await testSqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: body,
    }),
  );

  if (!result.MessageId) {
    throw new Error('SQS send did not return a MessageId');
  }

  return result.MessageId;
}

export async function receiveFromSqs(count: number): Promise<SQSEvent> {
  const result = await testSqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: count,
      WaitTimeSeconds: 5,
      AttributeNames: ['All'],
    }),
  );

  const messages = result.Messages ?? [];

  if (messages.length === 0) {
    throw new Error('No messages received from SQS within timeout');
  }

  const records: SQSRecord[] = messages.map((msg) => ({
    messageId: msg.MessageId!,
    receiptHandle: msg.ReceiptHandle!,
    body: msg.Body!,
    attributes: {
      ApproximateReceiveCount: msg.Attributes?.ApproximateReceiveCount ?? '1',
      SentTimestamp: msg.Attributes?.SentTimestamp ?? '0',
      SenderId: msg.Attributes?.SenderId ?? 'SENDER',
      ApproximateFirstReceiveTimestamp: msg.Attributes?.ApproximateFirstReceiveTimestamp ?? '0',
    },
    messageAttributes: {},
    md5OfBody: msg.MD5OfBody ?? '',
    eventSource: 'aws:sqs',
    eventSourceARN: `arn:aws:sqs:us-east-1:000000000000:feature-usage-updates-local`,
    awsRegion: 'us-east-1',
  }));

  return { Records: records };
}

export async function deleteFromSqs(receiptHandle: string): Promise<void> {
  await testSqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: receiptHandle,
    }),
  );
}

export async function purgeQueue(): Promise<void> {
  await testSqsClient.send(
    new PurgeQueueCommand({
      QueueUrl: QUEUE_URL,
    }),
  );
}
