import {
  QueryCommand,
  TransactWriteItemsCommand,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';

import type { TransactWriteItem } from '@aws-sdk/client-dynamodb';
import type { MetricQueryRequest } from '../schemas/query-request.schema';
import type { MetricUpdateMessage } from '../schemas/update-message.schema';
import type { QuerySegment } from './query-granularity.util';
import { buildPartitionKey } from './partition-key.builder';
import { buildSortKey } from './sort-key.builder';
import { buildQuerySegments } from './query-granularity.util';
import { calculateTtl } from './calculate-ttl.util';
import { dynamoClient } from './dynamo.client';
import { getTableName } from '../config/table-name.config';

// Must exceed SQS maxReceiveCount * VisibilityTimeout to cover all redelivery attempts.
// Default: 3 retries * 60s = 180s. 24 hours provides a wide safety margin.
const DEDUP_TTL_SECONDS = 24 * 60 * 60;

interface UpdateParams {
  tableName: string;
  pk: string;
  sk: string;
  count: number;
  ttl: number;
}

function buildUpdateTransactItem(params: UpdateParams): TransactWriteItem {
  return {
    Update: {
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
    },
  };
}

function buildDeduplicationItem(tableName: string, messageId: string): TransactWriteItem {
  const ttl = Math.floor(Date.now() / 1000) + DEDUP_TTL_SECONDS;

  return {
    Put: {
      TableName: tableName,
      Item: {
        pk: { S: `DEDUP#${messageId}` },
        sk: { S: `DEDUP#${messageId}` },
        ttl: { N: ttl.toString() },
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    },
  };
}

function isDuplicateMessage(error: unknown): boolean {
  if (!(error instanceof TransactionCanceledException)) {
    return false;
  }

  return error.CancellationReasons?.[0]?.Code === 'ConditionalCheckFailed';
}

class DynamoMetricRepository {
  async incrementMetric(message: MetricUpdateMessage, messageId: string): Promise<boolean> {
    const tableName = getTableName();
    const ttl = calculateTtl();

    const partitions = [
      { type: 'workspace' as const, id: message.workspaceId },
      ...(message.userId ? [{ type: 'user' as const, id: message.userId }] : []),
    ];

    const transactItems: TransactWriteItem[] = [buildDeduplicationItem(tableName, messageId)];

    for (const { type, id } of partitions) {
      const pk = buildPartitionKey(type, id, message.metricId);

      transactItems.push(
        buildUpdateTransactItem({
          tableName,
          pk,
          sk: buildSortKey('hourly', message.date),
          count: message.count,
          ttl,
        }),
        buildUpdateTransactItem({
          tableName,
          pk,
          sk: buildSortKey('daily', message.date),
          count: message.count,
          ttl,
        }),
      );
    }

    try {
      await dynamoClient.send(new TransactWriteItemsCommand({ TransactItems: transactItems }));

      return false;
    } catch (error) {
      if (isDuplicateMessage(error)) {
        return true;
      }

      throw error;
    }
  }

  async queryMetricCount(query: MetricQueryRequest): Promise<number> {
    const tableName = getTableName();

    const pk = query.userId
      ? buildPartitionKey('user', query.userId, query.metricId)
      : buildPartitionKey('workspace', query.workspaceId, query.metricId);

    const segments = buildQuerySegments(query.fromDate, query.toDate);

    const counts = await Promise.all(
      segments.map((segment) => this.querySegment(tableName, pk, segment)),
    );

    return counts.reduce((sum, count) => sum + count, 0);
  }

  private async querySegment(
    tableName: string,
    pk: string,
    segment: QuerySegment,
  ): Promise<number> {
    const fromSk = buildSortKey(segment.granularity, segment.fromDate);
    const toSk = buildSortKey(segment.granularity, segment.toDate);

    let totalCount = 0;
    let exclusiveStartKey: Record<string, { S: string }> | undefined;

    do {
      const result = await dynamoClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'pk = :pk AND sk BETWEEN :fromDate AND :toDate',
          ProjectionExpression: '#count',
          ExpressionAttributeNames: { '#count': 'count' },
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

export const metricRepository = new DynamoMetricRepository();
