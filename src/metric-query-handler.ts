import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';

export const main = async (request: any) => {
  const client = new DynamoDBClient({});
  const tableName = `feature-usage-${process.env.ENV || 'local'}`;

  let pk: string;
  if (request.userId) {
    pk = `USR#${request.userId}#MET#${request.metricId}`;
  } else {
    pk = `WSP#${request.workspaceId}#MET#${request.metricId}`;
  }

  const fromDate = request.fromDate;
  const toDate = request.toDate;

  const queryFrom = `H#${fromDate}`;
  const queryTo = `H#${toDate}`;

  const result: any = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'pk = :pk and sk between :fromDate and :toDate',
      ExpressionAttributeValues: {
        ':pk': { S: pk },
        ':fromDate': { S: queryFrom },
        ':toDate': { S: queryTo },
      },
    })
  );

  return {
    userId: request.userId,
    workspaceId: request.workspaceId,
    fromDate: request.fromDate,
    toDate: request.toDate,
    count: (result.Items ?? []).reduce(
      (sum: number, item: any) => sum + Number(item.count?.N ?? 0),
      0
    ),
    metricId: request.metricId,
  };
};

module.exports = { main };
