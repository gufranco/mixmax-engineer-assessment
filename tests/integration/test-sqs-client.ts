import { SQSClient } from '@aws-sdk/client-sqs';

export const QUEUE_URL =
  'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/feature-usage-updates-local';

export const testSqsClient = new SQSClient({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});
