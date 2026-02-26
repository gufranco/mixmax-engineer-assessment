import { faker } from '@faker-js/faker';

import { buildBody } from './helpers/build-body';
import { buildSqsEvent } from './helpers/build-sqs-event';
import { clearTable } from './helpers/clear-table';
import { getItem } from './helpers/get-item';
import { main as handler } from '../../src/metric-updates.handler';

function fakeDateHour(): string {
  return faker.date
    .between({ from: '2023-01-01', to: '2025-12-31' })
    .toISOString()
    .substring(0, 13);
}

beforeEach(async () => {
  await clearTable();
});

describe('metric-updates-handler', () => {
  describe('happy path', () => {
    it('should write hourly and daily workspace entries', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count = faker.number.int({ min: 1, max: 100 });

      const event = buildSqsEvent(buildBody({ workspaceId, metricId, date, count }));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);

      const hourly = await getItem(`WSP#${workspaceId}#MET#${metricId}`, `H#${date}`);

      expect(hourly.Item?.['count']?.N).toBe(String(count));

      const daily = await getItem(
        `WSP#${workspaceId}#MET#${metricId}`,
        `D#${date.substring(0, 10)}`,
      );

      expect(daily.Item?.['count']?.N).toBe(String(count));
    });

    it('should write all 4 entries when userId is provided', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const userId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count = faker.number.int({ min: 1, max: 100 });

      const event = buildSqsEvent(buildBody({ workspaceId, userId, metricId, date, count }));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);

      const wsHourly = await getItem(`WSP#${workspaceId}#MET#${metricId}`, `H#${date}`);

      expect(wsHourly.Item?.['count']?.N).toBe(String(count));

      const wsDaily = await getItem(
        `WSP#${workspaceId}#MET#${metricId}`,
        `D#${date.substring(0, 10)}`,
      );

      expect(wsDaily.Item?.['count']?.N).toBe(String(count));

      const usrHourly = await getItem(`USR#${userId}#MET#${metricId}`, `H#${date}`);

      expect(usrHourly.Item?.['count']?.N).toBe(String(count));

      const usrDaily = await getItem(`USR#${userId}#MET#${metricId}`, `D#${date.substring(0, 10)}`);

      expect(usrDaily.Item?.['count']?.N).toBe(String(count));
    });

    it('should accumulate count when writing the same metric twice', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });

      await handler(buildSqsEvent(buildBody({ workspaceId, metricId, date, count: count1 })));

      // Act
      await handler(buildSqsEvent(buildBody({ workspaceId, metricId, date, count: count2 })));

      // Assert
      const hourly = await getItem(`WSP#${workspaceId}#MET#${metricId}`, `H#${date}`);

      expect(hourly.Item?.['count']?.N).toBe(String(count1 + count2));
    });

    it('should set TTL attribute roughly 90 days in the future', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();

      const event = buildSqsEvent(buildBody({ workspaceId, metricId, date }));

      // Act
      await handler(event);

      // Assert
      const hourly = await getItem(`WSP#${workspaceId}#MET#${metricId}`, `H#${date}`);
      const ttl = Number(hourly.Item?.['ttl']?.N);
      const now = Math.floor(Date.now() / 1000);
      const ninetyDays = 90 * 24 * 60 * 60;

      expect(ttl).toBeGreaterThan(now + ninetyDays - 60);
      expect(ttl).toBeLessThan(now + ninetyDays + 60);
    });

    it('should process batch of multiple records correctly', async () => {
      // Arrange
      const ws1 = faker.string.alphanumeric(8);
      const ws2 = faker.string.alphanumeric(8);
      const metric1 = faker.string.alphanumeric(10);
      const metric2 = faker.string.alphanumeric(10);
      const metric3 = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });
      const count3 = faker.number.int({ min: 1, max: 100 });

      const event = buildSqsEvent(
        buildBody({ workspaceId: ws1, metricId: metric1, count: count1, date }),
        buildBody({ workspaceId: ws1, metricId: metric2, count: count2, date }),
        buildBody({ workspaceId: ws2, metricId: metric3, count: count3, date }),
      );

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);

      const first = await getItem(`WSP#${ws1}#MET#${metric1}`, `H#${date}`);

      expect(first.Item?.['count']?.N).toBe(String(count1));

      const second = await getItem(`WSP#${ws1}#MET#${metric2}`, `H#${date}`);

      expect(second.Item?.['count']?.N).toBe(String(count2));

      const third = await getItem(`WSP#${ws2}#MET#${metric3}`, `H#${date}`);

      expect(third.Item?.['count']?.N).toBe(String(count3));
    });

    it('should handle large count values', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const largeCount = faker.number.int({ min: 100000, max: 999999 });

      const event = buildSqsEvent(buildBody({ workspaceId, metricId, date, count: largeCount }));

      // Act
      await handler(event);

      // Assert
      const hourly = await getItem(`WSP#${workspaceId}#MET#${metricId}`, `H#${date}`);

      expect(hourly.Item?.['count']?.N).toBe(String(largeCount));
    });
  });

  describe('error handling', () => {
    it('should drop malformed JSON as permanent error without retrying', async () => {
      // Arrange
      const event = buildSqsEvent('not-json{{{');

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);
    });

    it('should drop missing required field as permanent error without retrying', async () => {
      // Arrange
      const metricId = faker.string.alphanumeric(10);
      const count = faker.number.int({ min: 1, max: 100 });

      const event = buildSqsEvent(JSON.stringify({ metricId, count }));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);
    });

    it('should drop zero count as permanent error without retrying', async () => {
      // Arrange
      const event = buildSqsEvent(buildBody({ count: 0 }));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);
    });

    it('should drop invalid date format as permanent error without retrying', async () => {
      // Arrange
      const invalidDate = faker.date
        .between({ from: '2023-01-01', to: '2025-12-31' })
        .toISOString()
        .substring(0, 10);

      const event = buildSqsEvent(buildBody({ date: invalidDate }));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);
    });

    it('should process valid records and drop invalid ones in a mixed batch', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metric1 = faker.string.alphanumeric(10);
      const metric2 = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });

      const event = buildSqsEvent(
        buildBody({ workspaceId, metricId: metric1, count: count1, date }),
        'invalid-json',
        buildBody({ workspaceId, metricId: metric2, count: count2, date }),
      );

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);

      const first = await getItem(`WSP#${workspaceId}#MET#${metric1}`, `H#${date}`);

      expect(first.Item?.['count']?.N).toBe(String(count1));

      const third = await getItem(`WSP#${workspaceId}#MET#${metric2}`, `H#${date}`);

      expect(third.Item?.['count']?.N).toBe(String(count2));
    });

    it('should return empty batchItemFailures for empty Records array', async () => {
      // Arrange
      const event = { Records: [] as never[] };

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);
    });
  });

  describe('deduplication', () => {
    it('should not double-increment when the same messageId is processed twice', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count = faker.number.int({ min: 1, max: 100 });

      const event = buildSqsEvent(buildBody({ workspaceId, metricId, date, count }));

      await handler(event);

      // Act
      const result = await handler(event);

      // Assert
      expect(result.batchItemFailures).toHaveLength(0);

      const hourly = await getItem(`WSP#${workspaceId}#MET#${metricId}`, `H#${date}`);

      expect(hourly.Item?.['count']?.N).toBe(String(count));
    });

    it('should write a dedup record with 24-hour TTL', async () => {
      // Arrange
      const event = buildSqsEvent(buildBody({}));
      const messageId = event.Records[0]?.messageId;

      // Act
      await handler(event);

      // Assert
      const dedup = await getItem(`DEDUP#${messageId}`, `DEDUP#${messageId}`);

      expect(dedup.Item).toBeDefined();

      const ttl = Number(dedup.Item?.['ttl']?.N);
      const now = Math.floor(Date.now() / 1000);
      const oneDay = 24 * 60 * 60;

      expect(ttl).toBeGreaterThan(now + oneDay - 60);
      expect(ttl).toBeLessThan(now + oneDay + 60);
    });

    it('should still accumulate counts from different messageIds', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });

      await handler(buildSqsEvent(buildBody({ workspaceId, metricId, date, count: count1 })));

      // Act
      await handler(buildSqsEvent(buildBody({ workspaceId, metricId, date, count: count2 })));

      // Assert
      const hourly = await getItem(`WSP#${workspaceId}#MET#${metricId}`, `H#${date}`);

      expect(hourly.Item?.['count']?.N).toBe(String(count1 + count2));
    });
  });
});
