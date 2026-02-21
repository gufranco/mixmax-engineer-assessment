import { GetItemCommand } from '@aws-sdk/client-dynamodb';

import { testDynamoClient } from './test-dynamo-client';

const TABLE_NAME = 'feature-usage-local';

export function getItem(pk: string, sk: string) {
  return testDynamoClient.send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: { S: pk },
        sk: { S: sk },
      },
    }),
  );
}
