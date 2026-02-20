export {};

// Points the AWS SDK at DynamoDB Local (started by jest-dynamodb preset)
process.env.AWS_ENDPOINT_URL = 'http://localhost:8000';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'fakeAccessKeyId';
process.env.AWS_SECRET_ACCESS_KEY = 'fakeSecretAccessKey';
process.env.ENV = 'local';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { main: consumer } = require('../../src/metric-updates-consumer');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { main: queryHandler } = require('../../src/metric-query-handler');

it('should write a metric and read it back', async () => {
  await consumer({
    Records: [{
      messageId: 'msg-1',
      receiptHandle: 'receipt-1',
      body: JSON.stringify({ userId: 'user-1', workspaceId: 'ws-1', metricId: 'emails-sent', count: 5, date: '2024-01-15T14' }),
      attributes: { ApproximateReceiveCount: '1', SentTimestamp: '1705305600000', SenderId: 'SENDER', ApproximateFirstReceiveTimestamp: '1705305600000' },
      messageAttributes: {},
      md5OfBody: 'abc',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:feature-usage-updates',
      awsRegion: 'us-east-1',
    }],
  });

  const result = await queryHandler({
    workspaceId: 'ws-1',
    metricId: 'emails-sent',
    fromDate: '2024-01-01T00',
    toDate: '2024-01-31T23',
  });

  expect(result.count).toBe(5);
});
