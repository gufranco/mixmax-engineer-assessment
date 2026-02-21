import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

process.env['AWS_ENDPOINT_URL'] = 'http://localhost:4566';
process.env['AWS_REGION'] = 'us-east-1';
process.env['AWS_ACCESS_KEY_ID'] = 'test';
process.env['AWS_SECRET_ACCESS_KEY'] = 'test';
process.env['ENV'] = 'local';

export const testDynamoClient = new DynamoDBClient({
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});
