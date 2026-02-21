import { QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import type { MetricQueryRequest } from '../types/metric-query-request.type';
import type { MetricRepository } from '../types/metric-repository.interface';
import type { MetricUpdateMessage } from '../types/metric-update-message.type';
import { buildPartitionKey } from './partition-key.builder';
import { buildSortKey } from './sort-key.builder';
import { calculateTtl } from './calculate-ttl.util';
import { dynamoClient } from './dynamo.client';
import { getTableName } from '../config/table-name.config';

interface UpdateCommandParams {
  tableName: string;
  pk: string;
  sk: string;
  count: number;
  ttl: number;
}

function buildUpdateCommand(params: UpdateCommandParams): UpdateItemCommand {
  return new UpdateItemCommand({
    TableName: params.tableName,
    Key: {
      pk: { S: params.pk },
      sk: { S: params.sk },
    },
    UpdateExpression: 'ADD #count :inc SET #ttl = :ttl',
    ExpressionAttributeNames: {
      '#count': 'count',
      '#ttl': 'ttl',
    },
    ExpressionAttributeValues: {
      ':inc': { N: params.count.toString() },
      ':ttl': { N: params.ttl.toString() },
    },
  });
}

class DynamoMetricRepository implements MetricRepository {
  async incrementMetric(message: MetricUpdateMessage): Promise<void> {
    const tableName = getTableName();
    const ttl = calculateTtl();

    const partitions = [
      { type: 'workspace' as const, id: message.workspaceId },
      ...(message.userId ? [{ type: 'user' as const, id: message.userId }] : []),
    ];

    const commands = partitions.flatMap(({ type, id }) => {
      const pk = buildPartitionKey(type, id, message.metricId);

      return [
        buildUpdateCommand({
          tableName,
          pk,
          sk: buildSortKey('hourly', message.date),
          count: message.count,
          ttl,
        }),
        buildUpdateCommand({
          tableName,
          pk,
          sk: buildSortKey('daily', message.date),
          count: message.count,
          ttl,
        }),
      ];
    });

    await Promise.all(commands.map((cmd) => dynamoClient.send(cmd)));
  }

  async queryMetricCount(query: MetricQueryRequest): Promise<number> {
    const tableName = getTableName();

    const pk = query.userId
      ? buildPartitionKey('user', query.userId, query.metricId)
      : buildPartitionKey('workspace', query.workspaceId, query.metricId);

    const fromSk = buildSortKey('hourly', query.fromDate);
    const toSk = buildSortKey('hourly', query.toDate);

    let totalCount = 0;
    let exclusiveStartKey: Record<string, { S: string }> | undefined;

    do {
      const result = await dynamoClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'pk = :pk AND sk BETWEEN :fromDate AND :toDate',
          ExpressionAttributeValues: {
            ':pk': { S: pk },
            ':fromDate': { S: fromSk },
            ':toDate': { S: toSk },
          },
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );

      totalCount += (result.Items ?? []).reduce(
        (sum, item) => sum + Number(item['count']?.N ?? 0),
        0,
      );

      exclusiveStartKey = result.LastEvaluatedKey as Record<string, { S: string }> | undefined;
    } while (exclusiveStartKey);

    return totalCount;
  }
}

export const metricRepository: MetricRepository = new DynamoMetricRepository();
