import { DeleteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';

import { testDynamoClient } from './test-dynamo-client';

const TABLE_NAME = 'feature-usage-local';

export async function clearTable(): Promise<void> {
  const scan = await testDynamoClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'pk, sk',
    }),
  );

  if (!scan.Items || scan.Items.length === 0) {
    return;
  }

  await Promise.all(
    scan.Items.map((item) => {
      const pk = item['pk'];
      const sk = item['sk'];

      if (!pk || !sk) {
        return Promise.resolve();
      }

      return testDynamoClient.send(
        new DeleteItemCommand({
          TableName: TABLE_NAME,
          Key: { pk, sk },
        }),
      );
    }),
  );
}
