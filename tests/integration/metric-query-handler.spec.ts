import { faker } from '@faker-js/faker';

import { buildBody } from './helpers/build-body';
import { buildSqsEvent } from './helpers/build-sqs-event';
import { clearTable } from './helpers/clear-table';
import { main as updatesHandler } from '../../src/metric-updates.handler';
import { main as queryHandler } from '../../src/metric-query.handler';

function fakeDateHour(): string {
  return faker.date
    .between({ from: '2023-01-01', to: '2025-12-31' })
    .toISOString()
    .substring(0, 13);
}

async function writeMetric(overrides: Record<string, unknown> = {}) {
  await updatesHandler(buildSqsEvent(buildBody(overrides)));
}

beforeEach(async () => {
  await clearTable();
});

describe('metric-query-handler', () => {
  describe('happy path', () => {
    it('should write and query workspace metric', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count = faker.number.int({ min: 1, max: 100 });
      const fromDate = `${date.substring(0, 10)}T00`;
      const toDate = `${date.substring(0, 10)}T23`;

      await writeMetric({ workspaceId, metricId, date, count });

      // Act
      const result = await queryHandler({ workspaceId, metricId, fromDate, toDate });

      // Assert
      expect(result).toHaveProperty('count', count);
      expect(result).toHaveProperty('workspaceId', workspaceId);
      expect(result).toHaveProperty('metricId', metricId);
    });

    it('should write and query user metric', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const userId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count = faker.number.int({ min: 1, max: 100 });
      const fromDate = `${date.substring(0, 10)}T00`;
      const toDate = `${date.substring(0, 10)}T23`;

      await writeMetric({ workspaceId, userId, metricId, date, count });

      // Act
      const result = await queryHandler({ workspaceId, userId, metricId, fromDate, toDate });

      // Assert
      expect(result).toHaveProperty('count', count);
      expect(result).toHaveProperty('userId', userId);
    });

    it('should sum multiple hours in range', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const baseDate = faker.date
        .between({ from: '2023-02-01', to: '2025-10-01' })
        .toISOString()
        .substring(0, 10);
      const hour1 = `${baseDate}T10`;
      const hour2 = `${baseDate}T11`;
      const hour3 = `${baseDate}T12`;
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });
      const count3 = faker.number.int({ min: 1, max: 100 });

      await writeMetric({ workspaceId, metricId, date: hour1, count: count1 });
      await writeMetric({ workspaceId, metricId, date: hour2, count: count2 });
      await writeMetric({ workspaceId, metricId, date: hour3, count: count3 });

      // Act
      const result = await queryHandler({
        workspaceId,
        metricId,
        fromDate: hour1,
        toDate: hour3,
      });

      // Assert
      expect(result).toHaveProperty('count', count1 + count2 + count3);
    });

    it('should filter by date range', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const baseDate = faker.date
        .between({ from: '2023-02-01', to: '2025-10-01' })
        .toISOString()
        .substring(0, 10);
      const insideHour = `${baseDate}T14`;
      const outsideHour = `${baseDate}T20`;
      const insideCount = faker.number.int({ min: 1, max: 100 });
      const outsideCount = faker.number.int({ min: 1, max: 100 });

      await writeMetric({ workspaceId, metricId, date: insideHour, count: insideCount });
      await writeMetric({ workspaceId, metricId, date: outsideHour, count: outsideCount });

      // Act
      const result = await queryHandler({
        workspaceId,
        metricId,
        fromDate: `${baseDate}T13`,
        toDate: `${baseDate}T15`,
      });

      // Assert
      expect(result).toHaveProperty('count', insideCount);
    });

    it('should match single hour when fromDate equals toDate', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const baseDate = faker.date
        .between({ from: '2023-02-01', to: '2025-10-01' })
        .toISOString()
        .substring(0, 10);
      const targetHour = `${baseDate}T14`;
      const otherHour = `${baseDate}T15`;
      const targetCount = faker.number.int({ min: 1, max: 100 });
      const otherCount = faker.number.int({ min: 1, max: 100 });

      await writeMetric({ workspaceId, metricId, date: targetHour, count: targetCount });
      await writeMetric({ workspaceId, metricId, date: otherHour, count: otherCount });

      // Act
      const result = await queryHandler({
        workspaceId,
        metricId,
        fromDate: targetHour,
        toDate: targetHour,
      });

      // Assert
      expect(result).toHaveProperty('count', targetCount);
    });

    it('should accumulate count from multiple increments', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const iterations = faker.number.int({ min: 3, max: 8 });

      for (let i = 0; i < iterations; i++) {
        await writeMetric({ workspaceId, metricId, date, count: 1 });
      }

      // Act
      const result = await queryHandler({
        workspaceId,
        metricId,
        fromDate: date,
        toDate: date,
      });

      // Assert
      expect(result).toHaveProperty('count', iterations);
    });
  });

  describe('edge cases', () => {
    it('should return count 0 when no matching data exists', async () => {
      // Arrange
      const baseDate = faker.date
        .between({ from: '2023-02-01', to: '2025-10-01' })
        .toISOString()
        .substring(0, 10);

      // Act
      const result = await queryHandler({
        workspaceId: faker.string.alphanumeric(8),
        metricId: faker.string.alphanumeric(10),
        fromDate: `${baseDate}T00`,
        toDate: `${baseDate}T23`,
      });

      // Assert
      expect(result).toHaveProperty('count', 0);
    });

    it('should not mix workspace and user metric data', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const userId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count = faker.number.int({ min: 1, max: 100 });
      const fromDate = `${date.substring(0, 10)}T00`;
      const toDate = `${date.substring(0, 10)}T23`;

      await writeMetric({ workspaceId, userId, metricId, date, count });

      // Act
      const wsResult = await queryHandler({ workspaceId, metricId, fromDate, toDate });

      const usrResult = await queryHandler({
        workspaceId,
        userId,
        metricId,
        fromDate,
        toDate,
      });

      // Assert
      expect(wsResult).toHaveProperty('count', count);
      expect(usrResult).toHaveProperty('count', count);
    });

    it('should not include other users data in user query', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const user1 = faker.string.alphanumeric(8);
      const user2 = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });
      const fromDate = `${date.substring(0, 10)}T00`;
      const toDate = `${date.substring(0, 10)}T23`;

      await writeMetric({ workspaceId, userId: user1, metricId, date, count: count1 });
      await writeMetric({ workspaceId, userId: user2, metricId, date, count: count2 });

      // Act
      const result = await queryHandler({
        workspaceId,
        userId: user1,
        metricId,
        fromDate,
        toDate,
      });

      // Assert
      expect(result).toHaveProperty('count', count1);
    });

    it('should isolate different metricIds', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metric1 = faker.string.alphanumeric(10);
      const metric2 = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });
      const fromDate = `${date.substring(0, 10)}T00`;
      const toDate = `${date.substring(0, 10)}T23`;

      await writeMetric({ workspaceId, metricId: metric1, date, count: count1 });
      await writeMetric({ workspaceId, metricId: metric2, date, count: count2 });

      // Act
      const result = await queryHandler({ workspaceId, metricId: metric1, fromDate, toDate });

      // Assert
      expect(result).toHaveProperty('count', count1);
    });
  });

  describe('validation errors', () => {
    it('should return error when metricId is missing', async () => {
      // Arrange
      const baseDate = faker.date
        .between({ from: '2023-02-01', to: '2025-10-01' })
        .toISOString()
        .substring(0, 10);

      // Act
      const result = await queryHandler({
        workspaceId: faker.string.alphanumeric(8),
        fromDate: `${baseDate}T00`,
        toDate: `${baseDate}T23`,
      });

      // Assert
      expect(result).toHaveProperty('error.code', 'VALIDATION_ERROR');
      expect(result).toHaveProperty('error.message', expect.stringContaining('metricId'));
      expect(result).toHaveProperty('error.requestId', 'local');
    });

    it('should return error for invalid date format', async () => {
      // Arrange
      const invalidDate = faker.date
        .between({ from: '2023-01-01', to: '2025-12-31' })
        .toISOString()
        .substring(0, 10);

      // Act
      const result = await queryHandler({
        workspaceId: faker.string.alphanumeric(8),
        metricId: faker.string.alphanumeric(10),
        fromDate: invalidDate,
        toDate: invalidDate,
      });

      // Assert
      expect(result).toHaveProperty('error.code', 'VALIDATION_ERROR');
    });

    it('should return error when date range exceeds 1825 days', async () => {
      // Act
      const result = await queryHandler({
        workspaceId: faker.string.alphanumeric(8),
        metricId: faker.string.alphanumeric(10),
        fromDate: '2020-01-01T00',
        toDate: '2025-06-01T00',
      });

      // Assert
      expect(result).toHaveProperty('error.code', 'VALIDATION_ERROR');
      expect(result).toHaveProperty('error.message', expect.stringContaining('date range exceeds'));
    });

    it('should return error when toDate is before fromDate', async () => {
      // Act
      const result = await queryHandler({
        workspaceId: faker.string.alphanumeric(8),
        metricId: faker.string.alphanumeric(10),
        fromDate: '2024-02-01T00',
        toDate: '2024-01-01T00',
      });

      // Assert
      expect(result).toHaveProperty('error.code', 'VALIDATION_ERROR');
      expect(result).toHaveProperty(
        'error.message',
        expect.stringContaining('toDate must not be before fromDate'),
      );
    });
  });

  describe('full flow', () => {
    it('should write multiple metrics and query each individually', async () => {
      // Arrange
      const ws1 = faker.string.alphanumeric(8);
      const ws2 = faker.string.alphanumeric(8);
      const metric1 = faker.string.alphanumeric(10);
      const metric2 = faker.string.alphanumeric(10);
      const date = fakeDateHour();
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });
      const count3 = faker.number.int({ min: 1, max: 100 });
      const fromDate = `${date.substring(0, 10)}T00`;
      const toDate = `${date.substring(0, 10)}T23`;

      await writeMetric({ workspaceId: ws1, metricId: metric1, count: count1, date });
      await writeMetric({ workspaceId: ws1, metricId: metric2, count: count2, date });
      await writeMetric({ workspaceId: ws2, metricId: metric1, count: count3, date });

      // Act
      const r1 = await queryHandler({ workspaceId: ws1, metricId: metric1, fromDate, toDate });
      const r2 = await queryHandler({ workspaceId: ws1, metricId: metric2, fromDate, toDate });
      const r3 = await queryHandler({ workspaceId: ws2, metricId: metric1, fromDate, toDate });

      // Assert
      expect(r1).toHaveProperty('count', count1);
      expect(r2).toHaveProperty('count', count2);
      expect(r3).toHaveProperty('count', count3);
    });

    it('should write same metric across multiple days and query spanning all', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);
      const baseDate = faker.date
        .between({ from: '2023-02-01', to: '2025-10-01' })
        .toISOString()
        .substring(0, 7);
      const date1 = `${baseDate}-10T08`;
      const date2 = `${baseDate}-15T14`;
      const date3 = `${baseDate}-20T22`;
      const count1 = faker.number.int({ min: 1, max: 100 });
      const count2 = faker.number.int({ min: 1, max: 100 });
      const count3 = faker.number.int({ min: 1, max: 100 });

      await writeMetric({ workspaceId, metricId, date: date1, count: count1 });
      await writeMetric({ workspaceId, metricId, date: date2, count: count2 });
      await writeMetric({ workspaceId, metricId, date: date3, count: count3 });

      // Act
      const result = await queryHandler({
        workspaceId,
        metricId,
        fromDate: `${baseDate}-01T00`,
        toDate: `${baseDate}-28T23`,
      });

      // Assert
      expect(result).toHaveProperty('count', count1 + count2 + count3);
    });

    it('should use daily rollups for full middle days in a mixed range', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);

      await writeMetric({ workspaceId, metricId, date: '2024-03-10T14', count: 10 });
      await writeMetric({ workspaceId, metricId, date: '2024-03-11T08', count: 20 });
      await writeMetric({ workspaceId, metricId, date: '2024-03-12T16', count: 30 });
      await writeMetric({ workspaceId, metricId, date: '2024-03-13T22', count: 40 });
      await writeMetric({ workspaceId, metricId, date: '2024-03-14T05', count: 50 });

      // Act
      const result = await queryHandler({
        workspaceId,
        metricId,
        fromDate: '2024-03-10T14',
        toDate: '2024-03-14T05',
      });

      // Assert
      expect(result).toHaveProperty('count', 150);
    });

    it('should return correct count for adjacent-day partial range', async () => {
      // Arrange
      const workspaceId = faker.string.alphanumeric(8);
      const metricId = faker.string.alphanumeric(10);

      await writeMetric({ workspaceId, metricId, date: '2024-03-10T18', count: 5 });
      await writeMetric({ workspaceId, metricId, date: '2024-03-11T06', count: 15 });

      // Act
      const result = await queryHandler({
        workspaceId,
        metricId,
        fromDate: '2024-03-10T15',
        toDate: '2024-03-11T10',
      });

      // Assert
      expect(result).toHaveProperty('count', 20);
    });
  });
});
