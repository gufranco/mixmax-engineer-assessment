import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const CONNECTION_TIMEOUT_MS = 3_000;
const REQUEST_TIMEOUT_MS = 5_000;

export const dynamoClient = new DynamoDBClient({
  requestHandler: new NodeHttpHandler({
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    requestTimeout: REQUEST_TIMEOUT_MS,
  }),
});
